import type { CefrLevel } from "@/generated/prisma/enums";

/*
 * CEFR level badge. Colour is banded (A green, B blue, C purple) but the
 * level text is always present, so the meaning never depends on colour
 * alone.
 */

const BAND: Record<CefrLevel, string> = {
  A1: "bg-level-a-soft text-level-a",
  A2: "bg-level-a-soft text-level-a",
  B1: "bg-level-b-soft text-level-b",
  B2: "bg-level-b-soft text-level-b",
  C1: "bg-level-c-soft text-level-c",
  C2: "bg-level-c-soft text-level-c",
};

export function Badge({
  level,
  size = "md",
  className = "",
}: {
  level: CefrLevel;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      title={`English level ${level}`}
      className={[
        "inline-flex items-center rounded-full font-extrabold tabular-nums",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        BAND[level],
        className,
      ].join(" ")}
    >
      {level}
    </span>
  );
}
