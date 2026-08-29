-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('INAPPROPRIATE_LANGUAGE', 'HARASSMENT', 'NO_ENGLISH', 'SEXUAL_CONTENT', 'SPAM', 'OTHER');

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "candidate_pair_type" TEXT;

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "reported_id" TEXT NOT NULL,
    "match_id" TEXT,
    "reason" "ReportReason" NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_ratings" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "rater_id" TEXT NOT NULL,
    "ratee_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_reported_id_created_at_idx" ON "reports"("reported_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "partner_ratings_match_id_rater_id_key" ON "partner_ratings"("match_id", "rater_id");
