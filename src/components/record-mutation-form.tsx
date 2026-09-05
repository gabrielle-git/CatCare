"use client";

/**
 * Client navigation after a lean Server Action result.
 * Avoids App Router cases where redirect() embeds destination RSC in the action
 * POST response but the client never applies the soft navigation, leaving
 * useFormStatus pending forever ("Salvando...").
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

export type MutationResult = { redirectTo: string } | { error: string };

export function RecordMutationForm({
  action,
  children,
  className,
  initialError,
}: {
  action: (formData: FormData) => Promise<MutationResult>;
  children: React.ReactNode;
  className?: string;
  initialError?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError ?? null);

  return (
    <form
      className={className}
      action={async (formData) => {
        setError(null);
        const result = await action(formData);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        router.push(result.redirectTo);
        router.refresh();
      }}
    >
      {error ? (
        <div className="mb-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}
      {children}
    </form>
  );
}
