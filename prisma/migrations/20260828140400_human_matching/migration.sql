-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'MATCHED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "match_queue" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "level" "CefrLevel" NOT NULL,
    "allowed_levels" TEXT[],
    "status" "QueueStatus" NOT NULL DEFAULT 'WAITING',
    "enqueued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "match_id" TEXT,

    CONSTRAINT "match_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_a_id" TEXT NOT NULL,
    "user_b_id" TEXT NOT NULL,
    "topic_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "end_reason" TEXT,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "blocker_id" TEXT NOT NULL,
    "blocked_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_queue_status_level_enqueued_at_idx" ON "match_queue"("status", "level", "enqueued_at");

-- CreateIndex
CREATE UNIQUE INDEX "matches_room_id_key" ON "matches"("room_id");

-- CreateIndex
CREATE INDEX "matches_user_a_id_idx" ON "matches"("user_a_id");

-- CreateIndex
CREATE INDEX "matches_user_b_id_idx" ON "matches"("user_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_blocker_id_blocked_id_key" ON "blocks"("blocker_id", "blocked_id");
