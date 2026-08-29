-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(60) NOT NULL,
    "topic" TEXT NOT NULL,
    "level" "CefrLevel" NOT NULL,
    "host_id" TEXT NOT NULL,
    "max_size" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "close_reason" TEXT,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_participants" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "room_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rooms_closed_at_created_at_idx" ON "rooms"("closed_at", "created_at" DESC);

-- CreateIndex
CREATE INDEX "room_participants_room_id_left_at_idx" ON "room_participants"("room_id", "left_at");

-- CreateIndex
CREATE INDEX "room_participants_user_id_left_at_idx" ON "room_participants"("user_id", "left_at");

-- AddForeignKey
ALTER TABLE "room_participants" ADD CONSTRAINT "room_participants_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A user may hold only ONE live membership per room. Prisma cannot express a
-- partial unique index, so it is declared here: without it, a double-tap on
-- Join could insert two live rows and consume two of the five seats.
CREATE UNIQUE INDEX "room_participants_live_unique"
  ON "room_participants" ("room_id", "user_id")
  WHERE "left_at" IS NULL;
