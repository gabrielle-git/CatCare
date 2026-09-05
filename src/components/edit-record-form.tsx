"use client";

/**
 * Edit-only form: after a successful Server Action, force a full document
 * navigation via window.location.replace to bypass App Router soft-nav hangs.
 */
import { useState } from "react";
import { resolveReturnTo } from "@/lib/safe-return-path";

export type EditRecordResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

function internalRedirectPath(raw: string): string {
  return resolveReturnTo(raw) ?? "/pets";
}

export function EditRecordForm({
  action,
  children,
  className,
  initialError,
}: {
  action: (formData: FormData) => Promise<EditRecordResult>;
  children: React.ReactNode;
  className?: string;
  initialError?: string | null;
}) {
  const [error, setError] = useState<string | null>(initialError ?? null);

  return (
    <form
      className={className}
      action={async (formData) => {
        setError(null);
        const result = await action(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        // Full document navigation — do not use router.push/replace/refresh.
        window.location.replace(internalRedirectPath(result.redirectTo));
      }}
    >
      {error ? (
        <div className="mb-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}
      {children}
    </form>
  );
}
