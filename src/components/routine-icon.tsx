"use client";

import { createElement } from "react";
import { parseRoutineIconKey } from "@/lib/routine-icons";
import { resolveLucideComponent } from "@/lib/routine-lucide-catalog";

const DEFAULT_LUCIDE_CLASS = "text-[var(--lavender-strong)]";

export function RoutineIcon({
  iconKey,
  size = 20,
  className,
}: {
  iconKey: string;
  size?: number;
  className?: string;
}) {
  const parsed = parseRoutineIconKey(iconKey);
  if (parsed.kind === "emoji") {
    return (
      <span
        className={`inline-flex items-center justify-center leading-none ${className ?? ""}`}
        style={{ fontSize: size, width: size, height: size }}
        aria-hidden="true"
      >
        {parsed.emoji}
      </span>
    );
  }
  const Lucide = resolveLucideComponent(parsed.stored);
  return createElement(Lucide, {
    size,
    className: className ?? DEFAULT_LUCIDE_CLASS,
    "aria-hidden": true,
    strokeWidth: 2,
  });
}
