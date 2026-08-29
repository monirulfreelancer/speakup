import "server-only";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { CefrLevel } from "@/generated/prisma/enums";

/*
 * Directory queries.
 *
 * Blocking is symmetric here: someone you blocked and someone who blocked
 * you are both invisible to you. Filtering and paging happen in SQL, never
 * on an already-truncated page — a search that only looked at the first 30
 * rows would quietly lie.
 */

export const PAGE_SIZE = 30;

export type DirectoryPerson = {
  id: string;
  name: string;
  cefrLevel: CefrLevel | null;
  bio: string | null;
  interests: string[];
  lastSeenAt: Date | null;
  avatarUpdatedAt: Date | null;
};

export async function getBlockedIds(userId: string): Promise<string[]> {
  const blocks = await db.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId));
}

export async function getDirectory(input: {
  search?: string;
  level?: string;
  page?: number;
}): Promise<{ people: DirectoryPerson[]; hasMore: boolean; total: number }> {
  const session = await auth();
  if (!session?.user?.id) return { people: [], hasMore: false, total: 0 };

  const page = Math.max(0, input.page ?? 0);
  const hidden = await getBlockedIds(session.user.id);
  const level = ["A1", "A2", "B1", "B2", "C1", "C2"].includes(input.level ?? "")
    ? (input.level as CefrLevel)
    : undefined;
  const search = input.search?.trim();

  const where = {
    id: { notIn: [session.user.id, ...hidden] },
    // Only people who finished onboarding — a half-registered account has no
    // level and nothing to show.
    onboardedAt: { not: null },
    ...(level ? { cefrLevel: level } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [people, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        cefrLevel: true,
        bio: true,
        interests: true,
        lastSeenAt: true,
        avatarUpdatedAt: true,
      },
      // Most recently seen first; the client re-sorts online users to the top
      // once presence arrives, which the server cannot know.
      orderBy: [{ lastSeenAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.user.count({ where }),
  ]);

  return { people, hasMore: (page + 1) * PAGE_SIZE < total, total };
}

export async function getPersonProfile(userId: string, viewerId: string) {
  const hidden = await getBlockedIds(viewerId);
  if (hidden.includes(userId)) return null;

  const person = await db.user.findFirst({
    where: { id: userId, onboardedAt: { not: null } },
    select: {
      id: true,
      name: true,
      cefrLevel: true,
      bio: true,
      interests: true,
      lastSeenAt: true,
      avatarUpdatedAt: true,
      createdAt: true,
      stats: { select: { totalSeconds: true, sessionsCount: true } },
    },
  });
  if (!person) return null;

  // An average over one or two ratings is noise presented as a fact, so it
  // is withheld below three.
  const ratings = await db.partnerRating.aggregate({
    where: { rateeId: userId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return {
    ...person,
    averageRating: ratings._count.rating >= 3 ? ratings._avg.rating : null,
    ratingCount: ratings._count.rating,
  };
}
