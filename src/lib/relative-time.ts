/*
 * "Active 2h ago" style text. Deliberately coarse: a learner does not need
 * to know someone was last seen 47 minutes ago, and precise timestamps on
 * strangers are a privacy smell.
 */

export function lastSeenLabel(lastSeenAt: Date | null): string {
  if (!lastSeenAt) return "New here";

  const seconds = Math.floor((Date.now() - lastSeenAt.getTime()) / 1000);
  if (seconds < 60) return "Active just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Active ${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Active ${weeks}w ago`;
  return "Active a while ago";
}
