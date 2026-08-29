"use client";

/*
 * Interest chip. Selectable variant is used in the profile editor; the
 * static variant appears on directory rows and profiles.
 */
export function Chip({
  label,
  selected,
  onToggle,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
}) {
  if (!onToggle) {
    return (
      <span className="rounded-full bg-surface-raised px-3 py-1 text-xs font-semibold text-muted">
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        "min-h-11 rounded-full border-2 px-4 text-sm font-bold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        selected
          ? "border-primary bg-primary text-on-primary"
          : "border-line bg-surface text-text hover:bg-surface-raised",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
