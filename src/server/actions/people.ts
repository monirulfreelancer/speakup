"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDirectory } from "@/server/people";
import type { DirectoryPerson } from "@/server/people";

/*
 * Directory actions. "Load more" re-runs the SAME server query with a page
 * offset, so paging respects the current search and level filter rather
 * than paging through an unfiltered table.
 */

export async function loadMorePeople(input: {
  search?: string;
  level?: string;
  page: number;
}): Promise<{ people: DirectoryPerson[]; hasMore: boolean }> {
  const parsed = z
    .object({
      search: z.string().max(100).optional(),
      level: z.string().max(2).optional(),
      page: z.number().int().min(0).max(200),
    })
    .safeParse(input);
  if (!parsed.success) return { people: [], hasMore: false };

  const { people, hasMore } = await getDirectory(parsed.data);
  return { people, hasMore };
}

export type BlockResult = { ok: true } | { ok: false; error: string };

/** Blocking is mutual invisibility: neither of you appears to the other. */
export async function blockUser(userId: string): Promise<BlockResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in" };
  if (session.user.id === userId) return { ok: false, error: "You cannot block yourself" };

  const parsed = z.string().min(1).safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Unknown person" };

  const target = await db.user.findUnique({ where: { id: parsed.data }, select: { id: true } });
  if (!target) return { ok: false, error: "Unknown person" };

  await db.block.upsert({
    where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: parsed.data } },
    create: { blockerId: session.user.id, blockedId: parsed.data },
    update: {},
  });

  return { ok: true };
}
