import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/*
 * Health check for Coolify. Reports whether the database is reachable but
 * still returns 200 with db:false when it isn't — the container is alive
 * either way, and a restart loop won't fix a down database.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return NextResponse.json({
    status: "ok",
    db: dbOk,
    timestamp: new Date().toISOString(),
  });
}
