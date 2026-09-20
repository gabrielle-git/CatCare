"use client";

import { useCallback, useState, useTransition } from "react";
import { ImagePlus } from "lucide-react";
import { MemoryFields } from "@/components/memory-fields";
import { SubmitButton } from "@/components/submit-button";
import {
  compensateMemoryUploadsIfNeeded,
  runDirectMemoryMediaUploads,
} from "@/lib/memory-direct-upload-client";
import type { MemoryMediaUploadIntent } from "@/lib/memory-media-upload";
import type { PetWithPhotoUrl } from "@/types/database";

/**
 * Create memory with stable memory_id + direct photo upload + pending UX.
 */
export function CreateMemoryForm({
  action,
  pets,
  configured,
  editable,
  initialError,
}: {
  action: (formData: FormData) => void | Promise<unknown>;
  pets: PetWithPhotoUrl[];
  configured: boolean;
  editable: boolean;
  initialError?: string | null;
}) {
  const [memoryId] = useState(() => crypto.randomUUID());
  const [intents, setIntents] = useState<MemoryMediaUploadIntent[]>([]);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onIntentsChange = useCallback((next: MemoryMediaUploadIntent[]) => {
    setIntents(next);
  }, []);

  return (
    <form
      className="cat-card mt-6 p-5 md:p-7"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        startTransition(async () => {
          setError(null);
          setStatus(null);
          let newlyCreatedPaths: string[] = [];
          try {
            const formData = new FormData(form);
            formData.set("memory_id", memoryId);
            newlyCreatedPaths = (
              await runDirectMemoryMediaUploads(formData, memoryId, intents, (progress) => {
                setStatus(progress.message);
              })
            ).newlyCreatedPaths;
            setStatus("Salvando...");
            await action(formData);
          } catch (cause) {
            const digest =
              cause && typeof cause === "object" && "digest" in cause
                ? String((cause as { digest?: string }).digest ?? "")
                : "";
            if (digest.startsWith("NEXT_REDIRECT")) throw cause;
            if (newlyCreatedPaths.length) await compensateMemoryUploadsIfNeeded(newlyCreatedPaths);
            setError(cause instanceof Error ? cause.message : "Não foi possível salvar. Tente novamente.");
            setStatus(null);
          }
        });
      }}
    >
      <input type="hidden" name="memory_id" value={memoryId} />
      {error ? (
        <div className="mb-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}
      {status || pending ? (
        <p className="mb-4 text-sm font-semibold text-[var(--lavender-strong)]" aria-live="polite">
          {status ?? "Salvando..."}
        </p>
      ) : null}
      <MemoryFields pets={pets} disabled={!editable || pending} onIntentsChange={onIntentsChange} />
      <SubmitButton
        disabled={!editable || pets.length === 0 || pending}
        pendingLabel="Salvando..."
        className="focus-ring mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-4 text-sm font-bold text-white"
      >
        <ImagePlus size={18} /> Salvar fotos e memória
      </SubmitButton>
    </form>
  );
}
