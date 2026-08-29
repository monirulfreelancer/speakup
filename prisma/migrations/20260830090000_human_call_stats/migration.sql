-- Human calls now record statistics. The realtime service credits both
-- participants inside the transaction that closes the match; this column is
-- the idempotency guard that stops a second close from crediting twice.
ALTER TABLE "matches" ADD COLUMN "stats_recorded_at" TIMESTAMP(3);

-- Dead columns: nothing has ever written either one, and the dashboard
-- computes the streak from practice_sessions instead. Keeping them would
-- leave two figures that disagree.
ALTER TABLE "user_stats" DROP COLUMN "current_streak";
ALTER TABLE "user_stats" DROP COLUMN "longest_streak";
