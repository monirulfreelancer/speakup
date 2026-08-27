import type { CefrLevel } from "@/generated/prisma/enums";

/*
 * CEFR level badge. Colour groups by band: A green, B blue, C purple.
 * Explicit class strings (not template interpolation) so Tailwind's scanner
 * sees every class.
 */

const BAND_CLASSES: Record<CefrLevel, string> = {
  A1: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  A2: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  B1: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  B2: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  C1: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  C2: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
};

export function LevelBadge({ level, className = "" }: { level: CefrLevel; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 font-mono text-sm font-bold ${BAND_CLASSES[level]} ${className}`}
    >
      {level}
    </span>
  );
}
