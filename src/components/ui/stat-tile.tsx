import type { LucideIcon } from "lucide-react";

/**
 * One number worth being proud of. `compact` is the slim variant used in
 * the Home strip, where the list below is the real content.
 */
export function StatTile({
  icon: Icon,
  value,
  label,
  tone = "default",
  compact = false,
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  tone?: "default" | "primary" | "warning";
  compact?: boolean;
}) {
  const toneClass =
    tone === "primary" ? "text-primary" : tone === "warning" ? "text-warning" : "text-text";

  if (compact) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border-2 border-line bg-surface px-2 py-2">
        <Icon className={`size-4 shrink-0 ${toneClass}`} aria-hidden />
        <span className="min-w-0">
          <span className="block text-base font-extrabold leading-tight tabular-nums">{value}</span>
          <span className="block truncate text-[11px] font-semibold leading-tight text-muted">
            {label}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-line bg-surface p-3 text-center">
      <Icon className={`mx-auto size-5 ${toneClass}`} aria-hidden />
      <p className="pt-1 text-xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}
