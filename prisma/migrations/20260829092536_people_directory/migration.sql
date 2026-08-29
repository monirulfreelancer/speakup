-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" VARCHAR(200),
ADD COLUMN     "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "last_seen_at" TIMESTAMP(3);
