import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "./db";
import type { CefrLevel, MatchedTopic, PartnerProfile } from "./events";

/*
 * The matching queue.
 *
 * Concurrency model: every matcher run locks the WAITING rows it considers
 * with SELECT ... FOR UPDATE SKIP LOCKED inside one transaction. Two
 * concurrent runs therefore see disjoint row sets and can never double-match
 * a user; a user locked by another run is simply invisible to this one and
 * gets picked up next tick.
 */

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function adjacentLevels(level: CefrLevel): CefrLevel[] {
  const i = LEVELS.indexOf(level);
  return LEVELS.filter((_, j) => Math.abs(i - j) <= 1);
}

export type QueueRow = {
  id: string;
  user_id: string;
  level: CefrLevel;
  allowed_levels: CefrLevel[];
  enqueued_at: Date;
};

export type MatchResult = {
  roomId: string;
  matchId: string;
  topic: MatchedTopic;
  a: { userId: string; queueId: string };
  b: { userId: string; queueId: string };
};

export type ExpiredEntry = { userId: string; queueId: string };

/** Adds a user to the queue (cancelling any previous waiting entry). */
export async function enqueue(
  userId: string,
  level: CefrLevel,
  allowedLevels: CefrLevel[],
  timeoutSeconds: number,
): Promise<{ position: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE match_queue SET status = 'CANCELLED' WHERE user_id = $1 AND status = 'WAITING'`,
      [userId],
    );
    await client.query(
      `INSERT INTO match_queue (id, user_id, level, allowed_levels, status, enqueued_at, expires_at)
       VALUES ($1, $2, $3, $4, 'WAITING', now(), now() + ($5 || ' seconds')::interval)`,
      [randomUUID(), userId, level, allowedLevels, String(timeoutSeconds)],
    );
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM match_queue WHERE status = 'WAITING'`);
    await client.query("COMMIT");
    return { position: rows[0].n };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function dequeue(userId: string): Promise<void> {
  await pool.query(
    `UPDATE match_queue SET status = 'CANCELLED' WHERE user_id = $1 AND status = 'WAITING'`,
    [userId],
  );
}

export async function queuePosition(userId: string): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n
     FROM match_queue
     WHERE status = 'WAITING'
       AND enqueued_at <= (SELECT enqueued_at FROM match_queue WHERE user_id = $1 AND status = 'WAITING' ORDER BY enqueued_at DESC LIMIT 1)`,
    [userId],
  );
  return rows.length ? rows[0].n : null;
}

function levelsCompatible(a: QueueRow, b: QueueRow): boolean {
  const distance = Math.abs(LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
  if (distance > 1) return false;
  return a.allowed_levels.includes(b.level) && b.allowed_levels.includes(a.level);
}

async function pickTopic(client: PoolClient, a: CefrLevel, b: CefrLevel): Promise<{ id: string; title: string; icon: string } | null> {
  // Valid for both levels: min_level <= lower AND max_level >= higher, using
  // enum declaration order (Postgres compares enums by that order).
  const lower = LEVELS[Math.min(LEVELS.indexOf(a), LEVELS.indexOf(b))];
  const higher = LEVELS[Math.max(LEVELS.indexOf(a), LEVELS.indexOf(b))];
  const { rows } = await client.query(
    `SELECT id, title, icon FROM topics
     WHERE is_active AND min_level <= $1 AND max_level >= $2
     ORDER BY random() LIMIT 1`,
    [lower, higher],
  );
  return rows[0] ?? null;
}

/**
 * One matcher pass. Returns the pairs made and the entries that timed out,
 * so the caller can emit socket events AFTER the transaction committed.
 */
export async function runMatcher(): Promise<{ matches: MatchResult[]; expired: ExpiredEntry[] }> {
  const client = await pool.connect();
  const matches: MatchResult[] = [];
  const expired: ExpiredEntry[] = [];
  try {
    await client.query("BEGIN");

    // Expire overdue entries (locked rows only — SKIP LOCKED keeps us out of
    // any row another run is currently pairing).
    const expiredRows = await client.query(
      `UPDATE match_queue SET status = 'EXPIRED'
       WHERE id IN (
         SELECT id FROM match_queue
         WHERE status = 'WAITING' AND expires_at < now()
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, user_id`,
    );
    for (const row of expiredRows.rows) {
      expired.push({ userId: row.user_id, queueId: row.id });
    }

    // Lock the remaining waiting rows, FIFO.
    const { rows } = await client.query<QueueRow>(
      `SELECT id, user_id, level, allowed_levels, enqueued_at
       FROM match_queue
       WHERE status = 'WAITING'
       ORDER BY enqueued_at
       FOR UPDATE SKIP LOCKED`,
    );

    if (rows.length >= 2) {
      // Blocks touching any queued user, both directions, in one query.
      const userIds = rows.map((r) => r.user_id);
      const blockRows = await client.query(
        `SELECT blocker_id, blocked_id FROM blocks
         WHERE blocker_id = ANY($1) AND blocked_id = ANY($1)`,
        [userIds],
      );
      const blocked = new Set(
        blockRows.rows.flatMap((b) => [
          `${b.blocker_id}:${b.blocked_id}`,
          `${b.blocked_id}:${b.blocker_id}`,
        ]),
      );

      const taken = new Set<string>();
      for (let i = 0; i < rows.length; i++) {
        const a = rows[i];
        if (taken.has(a.id)) continue;
        // Longest-waiting eligible partner first — rows are already FIFO.
        for (let j = i + 1; j < rows.length; j++) {
          const b = rows[j];
          if (taken.has(b.id)) continue;
          if (a.user_id === b.user_id) continue;
          if (!levelsCompatible(a, b)) continue;
          if (blocked.has(`${a.user_id}:${b.user_id}`)) continue;

          const matchId = randomUUID();
          const roomId = `room_${randomUUID()}`;
          const topic = await pickTopic(client, a.level, b.level);
          await client.query(
            `INSERT INTO matches (id, room_id, user_a_id, user_b_id, topic_id, started_at, duration_seconds)
             VALUES ($1, $2, $3, $4, $5, now(), 0)`,
            [matchId, roomId, a.user_id, b.user_id, topic?.id ?? null],
          );
          await client.query(
            `UPDATE match_queue SET status = 'MATCHED', match_id = $1 WHERE id = ANY($2)`,
            [matchId, [a.id, b.id]],
          );

          taken.add(a.id);
          taken.add(b.id);
          matches.push({
            roomId,
            matchId,
            topic: topic ? { title: topic.title, icon: topic.icon } : null,
            a: { userId: a.user_id, queueId: a.id },
            b: { userId: b.user_id, queueId: b.id },
          });
          break;
        }
      }
    }

    await client.query("COMMIT");
    return { matches, expired };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

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

export type { PartnerProfile };
