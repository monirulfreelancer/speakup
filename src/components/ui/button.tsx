"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

/*
 * The button.
 *
 * The chunky bottom edge (btn-3d) is what makes the app feel game-like:
 * a solid slab of the darker shade sits under the face and collapses on
 * :active, so pressing is physical rather than a colour change. The edge
 * colour comes from --btn-edge per variant, and the whole thing is
 * disabled under prefers-reduced-motion by the global rule.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary [--btn-edge:var(--primary-dark)] hover:brightness-105",
  secondary:
    "bg-surface text-text border-2 border-line [--btn-edge:var(--line)] hover:bg-surface-raised",
  ghost: "bg-transparent text-muted hover:bg-surface-raised hover:text-text shadow-none",
  danger: "bg-danger text-white [--btn-edge:var(--danger-dark)] hover:brightness-105",
};

const SIZES: Record<Size, string> = {
  // Never below 44px: these are pressed with thumbs.
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-12 px-5 text-base",
  lg: "min-h-14 px-7 text-lg",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth = false,
    className = "",
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const flat = variant === "ghost";
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-2xl font-bold",
        "disabled:cursor-not-allowed disabled:opacity-50",
        flat ? "" : "btn-3d active:btn-3d-press disabled:shadow-none",
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
