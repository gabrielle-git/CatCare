"use client";

import { useRef, useState, useTransition } from "react";
import { CalendarPlus } from "lucide-react";
import { PetMultiSelect } from "@/components/pet-multi-select";
import { SubmitButton } from "@/components/submit-button";
import type { CreateReminderResult } from "@/app/(app)/agenda/actions";

const FAMILY_KEY = "family";

function ensureReminderIds(map: Record<string, string>, petIds: string[]) {
  const next = { ...map };
  const keys = petIds.length === 0 ? [FAMILY_KEY] : petIds;
  for (const key of keys) {
    if (!next[key]) next[key] = crypto.randomUUID();
  }
  return next;
}

/**
 * Manual reminder form: stable reminder ids per pet (or family) for the form intent.
 * IDs are created before submit and never regenerated on retry of the same selection.
 */
export function CreateReminderForm({
  action,
  pets,
  configured,
  initialError,
}: {
  action: (formData: FormData) => Promise<CreateReminderResult>;
  pets: { id: string; name: string }[];
  configured: boolean;
  initialError?: string | null;
}) {
  const idsRef = useRef<Record<string, string>>(ensureReminderIds({}, []));
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="cat-card mt-6 space-y-5 p-5 md:p-7"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        startTransition(async () => {
          setError(null);
          const formData = new FormData(form);
          const petIds = formData.getAll("pet_ids").map(String).filter(Boolean);
          const ids = ensureReminderIds(idsRef.current, petIds);
          idsRef.current = ids;
          formData.set("reminder_ids_json", JSON.stringify(ids));
          try {
            const result = await action(formData);
            if (result.ok) {
              window.location.replace(result.redirectTo);
              return;
            }
            setError(result.error);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Não foi possível salvar. Tente novamente.");
          }
        });
      }}
    >
      {error ? (
        <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {pending ? (
        <p className="text-sm font-semibold text-[var(--lavender-strong)]" aria-live="polite">
          Salvando...
        </p>
      ) : null}

      <label className="block text-sm font-bold">
        O que precisa ser feito?
        <input disabled={!configured || pending} required name="title" className="field mt-2" placeholder="Ex.: Dar a segunda dose da vacina" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Categoria
          <select disabled={!configured || pending} name="category" className="field mt-2">
            <option value="vaccine">Vacina</option>
            <option value="deworming">Vermífugo</option>
            <option value="medication">Medicamento</option>
            <option value="consultation">Consulta</option>
            <option value="weight">Pesagem</option>
            <option value="feeding">Alimentação / mamada</option>
            <option value="hygiene">Higiene</option>
            <option value="purchase">Compra</option>
            <option value="other">Outro</option>
          </select>
        </label>
        <label className="text-sm font-bold">
          Data e hora
          <input disabled={!configured || pending} required name="due_at" type="datetime-local" className="field mt-2" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <PetMultiSelect
            pets={pets}
            defaultSelectedIds={[]}
            disabled={!configured || pending}
            required={false}
            legend="Pets"
            hint="Opcional — deixe vazio para lembrete da família toda, ou escolha um ou mais pets."
            onSelectionChange={(ids) => {
              idsRef.current = ensureReminderIds(idsRef.current, ids);
            }}
          />
        </div>
        <label className="text-sm font-bold">
          Repetição
          <select disabled={!configured || pending} name="recurrence" className="field mt-2">
            <option value="none">Não repetir</option>
            <option value="daily">Todos os dias</option>
            <option value="weekly">Toda semana</option>
            <option value="monthly">Todo mês</option>
          </select>
        </label>
      </div>
      <label className="block text-sm font-bold">
        Detalhes
        <textarea disabled={!configured || pending} name="notes" rows={3} className="field mt-2 resize-none" placeholder="Dose, quantidade, endereço ou algo que ajude na hora" />
      </label>
      <SubmitButton
        disabled={!configured || pending}
        pendingLabel="Salvando..."
        className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CalendarPlus size={18} /> Salvar lembrete
      </SubmitButton>
    </form>
  );
}
