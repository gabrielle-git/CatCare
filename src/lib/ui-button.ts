/**
 * Compact action buttons — shared vertical scale for primary/secondary toolbars.
 * Width follows content; min-h keeps a usable touch target on mobile.
 */

export type AppButtonVariant = "primary" | "secondary" | "soft" | "danger" | "ghost" | "dangerSolid";

const COMPACT_BASE =
  "focus-ring inline-flex min-h-10 w-fit shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition";

const VARIANT_CLASS: Record<AppButtonVariant, string> = {
  primary: "bg-[var(--graphite)] text-white",
  secondary: "border border-[var(--border)] bg-white text-[var(--muted)]",
  soft: "bg-[var(--lavender-soft)] text-[var(--lavender-strong)]",
  danger: "border border-red-200 bg-white text-[var(--danger)]",
  dangerSolid: "bg-[var(--danger)] text-white",
  ghost: "bg-transparent text-[var(--muted)]",
};

export function appButtonClass(variant: AppButtonVariant, className?: string): string {
  return [COMPACT_BASE, VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
}
