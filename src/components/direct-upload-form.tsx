"use client";

import { useState, useTransition } from "react";
import {
  collectAttachmentIntentsFromForm,
  compensateIfNeeded,
  runDirectAttachmentUploads,
} from "@/lib/attachment-direct-upload-client";

type Mode = "records-create" | "records-edit" | "documents";

/**
 * Wraps a Server Action form: uploads files direct-to-Supabase first,
 * then calls the factual action with metadata-only FormData.
 */
export function DirectUploadForm({
  action,
  className,
  children,
  mode,
  onActionResult,
  initialError,
}: {
  action: (formData: FormData) => void | Promise<unknown>;
  className?: string;
  children: React.ReactNode;
  mode: Mode;
  /** For edit-record style results that return { ok, redirectTo }. */
  onActionResult?: (result: unknown) => void;
  initialError?: string | null;
}) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      action={(formData) => {
        startTransition(async () => {
          setError(null);
          setStatus(null);
          let newlyCreatedPaths: string[] = [];
          try {
            const intents = collectAttachmentIntentsFromForm(formData, {
              unscoped: mode === "documents",
            });
            if (mode === "documents" && formData.get("require_files") === "1" && intents.length === 0) {
              throw new Error("Adicione ao menos um arquivo.");
            }
            const upload = await runDirectAttachmentUploads(formData, intents, (progress) => {
              setStatus(progress.message);
            });
            newlyCreatedPaths = upload.newlyCreatedPaths;
            setStatus("Salvando...");
            const result = await action(formData);
            if (onActionResult) onActionResult(result);
          } catch (cause) {
            // Next.js redirect throws; rethrow so navigation proceeds.
            const digest = cause && typeof cause === "object" && "digest" in cause
              ? String((cause as { digest?: string }).digest ?? "")
              : "";
            if (digest.startsWith("NEXT_REDIRECT")) throw cause;
            if (newlyCreatedPaths.length) {
              await compensateIfNeeded(newlyCreatedPaths);
            }
            const message = cause instanceof Error
              ? cause.message
              : "Não foi possível salvar. Tente novamente.";
            setError(message);
            setStatus(null);
          }
        });
      }}
    >
      {error ? (
        <div className="mb-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}
      {status || pending ? (
        <p className="mb-4 text-sm font-semibold text-[var(--lavender-strong)]" aria-live="polite">
          {status ?? "Enviando arquivos..."}
        </p>
      ) : null}
      {children}
    </form>
  );
}
