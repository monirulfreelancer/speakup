import type { PoolClient } from "pg";
import { pool } from "./db";
import type { PartnerProfile } from "./events";

/*
 * Match, room membership and presence persistence.
 *
 * The auto-matching queue was removed with the people directory: users now
 * pick who to call, and part 2 will create Match rows directly. The Match
 * table and every room/call helper below are unchanged and still in use.
 */

/* -------------------------------------------------------------------------
 * Closing a call, and crediting it
 * ---------------------------------------------------------------------- */

/*
 * Stats are written HERE, on the server, at the moment the match closes —
 * not from the browser. Someone whose phone dies mid-call, or who walks into
 * a lift, still earns the minutes they actually spoke for, and the server
 * already knows the duration.
 *
 * A call only counts if it was genuinely answered and genuinely happened:
 * answered_at set, and at least MIN_CREDITED_SECONDS of it. A misdial that
 * rang for four seconds is not a conversation, and crediting it would make
 * the numbers worthless.
 */
const MIN_CREDITED_SECONDS = 30;

/*
 * End reasons that never count, whatever the clock says. The first three
 * cannot have answered_at set anyway, so they are belt and braces; the one
 * that matters is 'abandoned', which the staleness sweep stamps on calls
 * both sides silently vanished from. Those DO carry an answered_at and a
 * long duration — the clock kept running while nobody was there — so
 * without this they would credit an hour of "practice" to two people who
 * were not present for it.
 */
const UNCREDITED_END_REASONS = ["abandoned", "no_answer", "declined", "cancelled"];

type ClosedMatch = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  answered_at: Date | null;
  started_at: Date;
  ended_at: Date;
  duration_seconds: number;
};

/**
 * Closes the open match for a room and, if it earned it, credits both
 * participants — all in ONE transaction. A crash partway cannot leave one
 * side credited and the other not, and cannot leave a closed match that
 * nothing will ever come back to credit.
 */
export async function endMatchByRoom(roomId: string, reason: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `UPDATE matches
       SET ended_at = now(),
           end_reason = $2,
           duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - started_at))::int)
       WHERE room_id = $1 AND ended_at IS NULL
       RETURNING id, user_a_id, user_b_id, answered_at, started_at, ended_at, duration_seconds`,
      [roomId, reason],
    );

    // No row means the match was already closed. Nothing to credit: whoever
    // closed it first was responsible for crediting it.
    if (rows.length === 1) await creditParticipants(client, rows[0] as ClosedMatch, reason);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    // Loud, because a swallowed failure here is silently lost practice time.
    // The match stays open and the staleness sweep will close it later.
    console.error(`[stats] failed to close room=${roomId} reason=${reason}`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function creditParticipants(
  client: PoolClient,
  match: ClosedMatch,
  reason: string,
): Promise<void> {
  if (!match.answered_at) return;
  if (match.duration_seconds < MIN_CREDITED_SECONDS) return;
  if (UNCREDITED_END_REASONS.includes(reason)) return;

  /*
   * The idempotency gate. Claiming the marker and writing the numbers happen
   * in the same transaction, so a second close path for this match — now, or
   * after some future refactor — finds stats_recorded_at already set and
   * credits nobody a second time.
   */
  const claimed = await client.query(
    `UPDATE matches SET stats_recorded_at = now()
     WHERE id = $1 AND stats_recorded_at IS NULL
     RETURNING id`,
    [match.id],
  );
  if (claimed.rowCount !== 1) return;

  // Have these two ever been credited for talking to each other before? Asked
  // before this match's own marker counts, so a first call reads as new.
  const priorTogether = await client.query(
    `SELECT 1 FROM matches
     WHERE id <> $1
       AND stats_recorded_at IS NOT NULL
       AND ((user_a_id = $2 AND user_b_id = $3) OR (user_a_id = $3 AND user_b_id = $2))
     LIMIT 1`,
    [match.id, match.user_a_id, match.user_b_id],
  );
  const newPartner = priorTogether.rowCount === 0 ? 1 : 0;

  for (const userId of [match.user_a_id, match.user_b_id]) {
    /*
     * A PracticeSession row per participant, exactly like the AI path writes.
     * That is what makes a human call appear in history AND what makes the
     * dashboard's streak work: it counts distinct days with COMPLETED rows,
     * so the reading side needed no change at all.
     *
     * The id is a uuid rather than a cuid: Prisma's cuid() default lives in
     * the client, which this service deliberately does not use. The column is
     * text and nothing parses it.
     */
    await client.query(
      `INSERT INTO practice_sessions
         (id, user_id, mode, match_id, level_at_session, started_at, ended_at, duration_seconds, status)
       SELECT gen_random_uuid()::text, u.id, 'HUMAN'::"SessionMode", $2,
              COALESCE(u.cefr_level, 'B1'::"CefrLevel"), $3, $4, $5, 'COMPLETED'::"SessionStatus"
       FROM users u WHERE u.id = $1`,
      [userId, match.id, match.started_at, match.ended_at, match.duration_seconds],
    );

    /*
     * INSERT ... ON CONFLICT, not UPDATE: only the email signup path creates
     * a user_stats row, so anyone who arrived through Google has none, and a
     * bare UPDATE would silently credit nothing.
     */
    await client.query(
      `INSERT INTO user_stats
         (id, user_id, total_seconds, sessions_count, human_sessions, distinct_partners)
       VALUES (gen_random_uuid()::text, $1, $2, 1, 1, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         total_seconds     = user_stats.total_seconds + EXCLUDED.total_seconds,
         sessions_count    = user_stats.sessions_count + 1,
         human_sessions    = user_stats.human_sessions + 1,
         distinct_partners = user_stats.distinct_partners + EXCLUDED.distinct_partners`,
      [userId, match.duration_seconds, newPartner],
    );
  }

  // One line per recorded call. Ids and a duration, nothing else.
  console.log(
    `[stats] recorded match=${match.id} users=${match.user_a_id},${match.user_b_id} duration=${match.duration_seconds}s`,
  );
}

/*
 * Room membership check for signaling. Every rtc:* / call:end relay is
 * gated on this: a socket may only signal into a room whose Match names it
 * as user A or B, and only while the call is live. Without it, any
 * authenticated user could guess a roomId and inject SDP into someone
 * else's call.
 *
 * Cached briefly because it runs on every ICE candidate, of which there are
 * many per call.
 */
const membershipCache = new Map<string, { at: number }>();
const MEMBERSHIP_TTL_MS = 30_000;

export type MembershipCheck = {
  ok: boolean;
  /** Diagnostics for the rejection log — never guess at this again. */
  found: boolean;
  endReason?: string | null;
  endedAt?: Date | null;
  members?: [string, string];
};

/**
 * THE ONE membership predicate. Every gate (room:join, rtc:*, call:*) calls
 * this — copies would drift and this exact check has already been wrong once.
 *
 * A user is a member if the Match names them on either side and the call has
 * not been deliberately closed. `ended_at` alone is NOT a valid filter: a
 * socket disconnect during ordinary navigation (leaving the find-partner
 * screen for the call screen) used to stamp end_reason='disconnected'
 * seconds after matching, which rejected BOTH legitimate members. Only
 * reasons that mean "this call is over for good" disqualify.
 */
const TERMINAL_END_REASONS = ["hangup", "left", "failed", "cancelled"];

export async function checkRoomMembership(
  roomId: string,
  userId: string,
): Promise<MembershipCheck> {
  const key = `${roomId}:${userId}`;
  const cached = membershipCache.get(key);
  if (cached && Date.now() - cached.at < MEMBERSHIP_TTL_MS) {
    return { ok: true, found: true };
  }

  const { rows } = await pool.query(
    `SELECT user_a_id, user_b_id, ended_at, end_reason
     FROM matches
     WHERE room_id = $1
     ORDER BY started_at DESC
     LIMIT 1`,
    [roomId],
  );

  if (rows.length === 0) return { ok: false, found: false };

  const row = rows[0] as {
    user_a_id: string;
    user_b_id: string;
    ended_at: Date | null;
    end_reason: string | null;
  };
  const isMember = row.user_a_id === userId || row.user_b_id === userId;
  const finished = row.end_reason !== null && TERMINAL_END_REASONS.includes(row.end_reason);
  const ok = isMember && !finished;

  // POSITIVE RESULTS ONLY. Caching a negative meant one early miss kept
  // rejecting a valid member for the whole TTL.
  if (ok) membershipCache.set(key, { at: Date.now() });

  return {
    ok,
    found: true,
    endedAt: row.ended_at,
    endReason: row.end_reason,
    members: [row.user_a_id, row.user_b_id],
  };
}

/** Boolean convenience wrapper over checkRoomMembership. */
export async function isRoomMember(roomId: string, userId: string): Promise<boolean> {
  return (await checkRoomMembership(roomId, userId)).ok;
}

export function forgetRoomMembership(roomId: string): void {
  for (const key of membershipCache.keys()) {
    if (key.startsWith(`${roomId}:`)) membershipCache.delete(key);
  }
}

/** Records which ICE path the call actually used (host / srflx / relay). */
export async function recordCandidatePairType(roomId: string, type: string): Promise<void> {
  if (!["host", "srflx", "relay", "prflx"].includes(type)) return;
  await pool.query(
    `UPDATE matches SET candidate_pair_type = $2 WHERE room_id = $1 AND candidate_pair_type IS NULL`,
    [roomId, type],
  );
}

export type { PartnerProfile };

/**
 * Stamps when a user's LAST socket went away, for the directory's
 * "Active 2h ago" line. Called only on the final disconnect, never per tab.
 */
export async function touchLastSeen(userId: string): Promise<void> {
  await pool.query(`UPDATE users SET last_seen_at = now() WHERE id = $1`, [userId]);
}

export type MatchRow = {
  id: string;
  roomId: string;
  userAId: string;
  userBId: string;
  topicTitle: string | null;
  topicIcon: string | null;
};

/** The open Match for a room, with its topic, or null. */
export async function loadOpenMatch(roomId: string): Promise<MatchRow | null> {
  const { rows } = await pool.query(
    `SELECT m.id, m.room_id, m.user_a_id, m.user_b_id, t.title, t.icon
     FROM matches m
     LEFT JOIN topics t ON t.id = m.topic_id
     WHERE m.room_id = $1 AND m.ended_at IS NULL
     LIMIT 1`,
    [roomId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    roomId: r.room_id,
    userAId: r.user_a_id,
    userBId: r.user_b_id,
    topicTitle: r.title,
    topicIcon: r.icon,
  };
}

/** Any other open Match this user is already in — the "busy" check. */
export async function openMatchElsewhere(userId: string, exceptRoomId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM matches
     WHERE ended_at IS NULL AND room_id <> $2 AND (user_a_id = $1 OR user_b_id = $1)
     LIMIT 1`,
    [userId, exceptRoomId],
  );
  return rows.length > 0;
}

/** The caller's display name and level, for the ring overlay. */
export async function loadRingProfile(
  userId: string,
): Promise<{ name: string; level: string; avatarUpdatedAt: string | null } | null> {
  const { rows } = await pool.query(
    `SELECT name, cefr_level, avatar_updated_at FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  if (rows.length === 0) return null;
  return {
    name: rows[0].name,
    level: rows[0].cefr_level ?? "B1",
    avatarUpdatedAt: rows[0].avatar_updated_at ? new Date(rows[0].avatar_updated_at).toISOString() : null,
  };
}

/*
 * STALENESS.
 *
 * A Match that nothing ever closes locks its participants out of calling
 * anyone: startCall sees an "open" row and refuses. Nothing closed them
 * once the disconnect handler stopped ending matches on navigation (which
 * it had to stop doing — it was ending matches during ordinary page
 * transitions), so this is the replacement, defined explicitly rather than
 * as a side effect of a socket lifecycle.
 *
 * Stale means either:
 *   - never answered and older than NEVER_ANSWERED_MINUTES, or
 *   - answered, but neither participant has had a connected socket for
 *     more than OFFLINE_GRACE_SECONDS.
 *
 * One UPDATE, no per-row loop: this runs every minute forever.
 */

const NEVER_ANSWERED_MINUTES = 3;
const OFFLINE_GRACE_SECONDS = 60;

/** Marks the call as genuinely begun, so the sweep stops treating it as unanswered. */
export async function markAnswered(roomId: string): Promise<void> {
  await pool.query(
    `UPDATE matches SET answered_at = now() WHERE room_id = $1 AND answered_at IS NULL`,
    [roomId],
  );
}

/**
 * Closes stale matches. `onlineUserIds` comes from the live socket map, so
 * anyone currently connected is never swept.
 * @returns how many rows were closed.
 */
export async function sweepStaleMatches(onlineUserIds: string[]): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE matches m
     SET ended_at = now(),
         end_reason = 'abandoned',
         duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - m.started_at))::int)
     FROM users ua, users ub
     WHERE m.ended_at IS NULL
       AND ua.id = m.user_a_id
       AND ub.id = m.user_b_id
       AND (
         (m.answered_at IS NULL AND m.started_at < now() - ($1 || ' minutes')::interval)
         OR (
           m.answered_at IS NOT NULL
           AND NOT (m.user_a_id = ANY($3::text[]))
           AND NOT (m.user_b_id = ANY($3::text[]))
           AND COALESCE(ua.last_seen_at, m.started_at) < now() - ($2 || ' seconds')::interval
           AND COALESCE(ub.last_seen_at, m.started_at) < now() - ($2 || ' seconds')::interval
         )
       )`,
    [String(NEVER_ANSWERED_MINUTES), String(OFFLINE_GRACE_SECONDS), onlineUserIds],
  );
  return rowCount ?? 0;
}

/**
 * One-time startup cleanup for rows stuck by the older behaviour: any open,
 * never-answered Match older than 10 minutes. Idempotent — it only ever
 * touches rows that are still open, so running it on every boot is safe.
 */
export async function cleanupAbandonedOnStartup(): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE matches
     SET ended_at = now(),
         end_reason = 'abandoned',
         duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - started_at))::int)
     WHERE ended_at IS NULL
       AND answered_at IS NULL
       AND started_at < now() - interval '10 minutes'`,
  );
  return rowCount ?? 0;
}

/* -------------------------------------------------------------------------
 * Group rooms
 * ---------------------------------------------------------------------- */

export type RoomMemberRow = {
  userId: string;
  name: string;
  level: string | null;
  avatarUpdatedAt: string | null;
  isHost: boolean;
};

export type RoomSummaryRow = {
  id: string;
  title: string;
  topic: string;
  level: string;
  hostId: string;
  maxSize: number;
  members: RoomMemberRow[];
  live: boolean;
};

function toMember(row: {
  user_id: string;
  name: string;
  cefr_level: string | null;
  avatar_updated_at: Date | null;
  host_id: string;
}): RoomMemberRow {
  return {
    userId: row.user_id,
    name: row.name,
    level: row.cefr_level,
    avatarUpdatedAt: row.avatar_updated_at ? new Date(row.avatar_updated_at).toISOString() : null,
    isHost: row.user_id === row.host_id,
  };
}

/** Every live room with its current members, for the lobby's first paint. */
export async function loadLobbyRooms(): Promise<RoomSummaryRow[]> {
  const { rows } = await pool.query(
    `SELECT r.id, r.title, r.topic, r.level::text AS level, r.host_id, r.max_size,
            p.user_id, u.name, u.cefr_level::text AS cefr_level, u.avatar_updated_at
     FROM rooms r
     JOIN room_participants p ON p.room_id = r.id AND p.left_at IS NULL
     JOIN users u ON u.id = p.user_id
     WHERE r.closed_at IS NULL
     ORDER BY r.created_at DESC, p.joined_at`,
  );

  const byRoom = new Map<string, RoomSummaryRow>();
  for (const row of rows) {
    let room = byRoom.get(row.id);
    if (!room) {
      room = {
        id: row.id,
        title: row.title,
        topic: row.topic,
        level: row.level,
        hostId: row.host_id,
        maxSize: row.max_size,
        members: [],
        live: true,
      };
      byRoom.set(row.id, room);
    }
    room.members.push(toMember(row));
  }
  return [...byRoom.values()];
}

/** One room's current state, or a live:false stub once it is gone. */
export async function loadRoom(roomId: string): Promise<RoomSummaryRow | null> {
  const { rows } = await pool.query(
    `SELECT r.id, r.title, r.topic, r.level::text AS level, r.host_id, r.max_size,
            r.closed_at, p.user_id, u.name, u.cefr_level::text AS cefr_level, u.avatar_updated_at
     FROM rooms r
     LEFT JOIN room_participants p ON p.room_id = r.id AND p.left_at IS NULL
     LEFT JOIN users u ON u.id = p.user_id
     WHERE r.id = $1
     ORDER BY p.joined_at`,
    [roomId],
  );
  if (rows.length === 0) return null;

  const first = rows[0];
  const members = rows.filter((r) => r.user_id).map(toMember);
  return {
    id: first.id,
    title: first.title,
    topic: first.topic,
    level: first.level,
    hostId: first.host_id,
    maxSize: first.max_size,
    members,
    live: first.closed_at === null && members.length > 0,
  };
}

/** Membership gate for group sockets — the same shape as checkRoomMembership. */
export async function isRoomParticipant(roomId: string, userId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM room_participants p
     JOIN rooms r ON r.id = p.room_id
     WHERE p.room_id = $1 AND p.user_id = $2 AND p.left_at IS NULL AND r.closed_at IS NULL
     LIMIT 1`,
    [roomId, userId],
  );
  return rows.length > 0;
}

/**
 * Group-room half of the sweep: drop participants whose user has had no
 * socket for over 60 seconds, then close rooms with nobody left for more
 * than 2 minutes. Runs inside the existing sweep loop — one timer, not two.
 *
 * @returns [participants cleared, rooms closed]
 */
export async function sweepRooms(onlineUserIds: string[]): Promise<[number, number]> {
  const cleared = await pool.query(
    `UPDATE room_participants p
     SET left_at = now()
     FROM users u
     WHERE p.left_at IS NULL
       AND u.id = p.user_id
       AND NOT (p.user_id = ANY($1::text[]))
       AND COALESCE(u.last_seen_at, p.joined_at) < now() - interval '60 seconds'`,
    [onlineUserIds],
  );

  const closed = await pool.query(
    `UPDATE rooms r
     SET closed_at = now(), close_reason = 'empty'
     WHERE r.closed_at IS NULL
       AND r.created_at < now() - interval '2 minutes'
       AND NOT EXISTS (
         SELECT 1 FROM room_participants p WHERE p.room_id = r.id AND p.left_at IS NULL
       )`,
  );

  return [cleared.rowCount ?? 0, closed.rowCount ?? 0];
}
