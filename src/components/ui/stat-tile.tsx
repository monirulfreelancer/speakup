import type { LucideIcon } from "lucide-react";

/** One number worth being proud of. Used in a row of three on Home. */
export function StatTile({
  icon: Icon,
  value,
  label,
  tone = "default",
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  tone?: "default" | "primary" | "warning";
}) {
  const toneClass =
    tone === "primary" ? "text-primary" : tone === "warning" ? "text-warning" : "text-text";
  return (
    <div className="rounded-2xl border-2 border-line bg-surface p-3 text-center">
      <Icon className={`mx-auto size-5 ${toneClass}`} aria-hidden />
      <p className="pt-1 text-xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}
