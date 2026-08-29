import type { ReactNode } from "react";

/*
 * Soft-bordered surface. Borders rather than heavy shadows: shadows read as
 * muddy smears in dark mode, a border stays crisp in both themes.
 */
export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  return (
    <Tag className={`rounded-2xl border-2 border-line bg-surface ${className}`}>{children}</Tag>
  );
}
