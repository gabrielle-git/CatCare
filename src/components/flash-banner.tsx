"use client";

import Link from "next/link";
import { X } from "lucide-react";

export function FlashBanner({
  href,
  tone,
  children,
}: {
  href: string;
  tone: "ok" | "error";
  children: React.ReactNode;
}) {
  const classes = tone === "ok"
    ? "bg-[var(--mint-soft)] font-semibold text-[var(--success)]"
    : "border border-red-200 bg-red-50 text-red-800";
  return (
    <div className={`mt-6 flex items-start justify-between gap-3 rounded-[20px] px-4 py-3 text-sm ${classes}`}>
      <p className="min-w-0">{children}</p>
      <Link href={href} className="focus-ring grid size-8 shrink-0 place-items-center rounded-full" aria-label="Fechar aviso">
        <X size={16} />
      </Link>
    </div>
  );
}
