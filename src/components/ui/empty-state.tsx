import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Never a blank box: an icon, one plain sentence, and a way forward. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-raised">
        <Icon className="size-7 text-muted" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="font-bold">{title}</p>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
