import { pool } from "./db";
import type { PartnerProfile } from "./events";

/*
 * Match, room membership and presence persistence.
 *
 * The auto-matching queue was removed with the people directory: users now
 * pick who to call, and part 2 will create Match rows directly. The Match
 * table and every room/call helper below are unchanged and still in use.
 */

export async function endMatchByRoom(roomId: string, reason: string): Promise<void> {
  await pool.query(
    `UPDATE matches
     SET ended_at = now(),
         end_reason = $2,
         duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - started_at))::int)
     WHERE room_id = $1 AND ended_at IS NULL`,
    [roomId, reason],
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
