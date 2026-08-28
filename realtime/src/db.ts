import { Pool } from "pg";

/*
 * Plain pg pool. This service deliberately does NOT use Prisma: the web app
 * owns the schema and all migrations; this service just reads and writes a
 * handful of tables (match_queue, matches, blocks, topics, users) with SQL.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

export const pool = new Pool({ connectionString, max: 10 });

export async function dbHealthy(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
