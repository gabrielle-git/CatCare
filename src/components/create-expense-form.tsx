"use client";

import { useState, useTransition } from "react";
import { ReceiptText } from "lucide-react";
import { FactualDateInput } from "@/components/factual-datetime-input";
import { PetMultiSelect } from "@/components/pet-multi-select";
import { SubmitButton } from "@/components/submit-button";
import { civilDateInAppTz } from "@/lib/factual-datetime";
import type { CreateExpenseResult } from "@/app/(app)/expenses/actions";

/**
 * Stable expense_id for the form mount + pending UX.
 * Server ownership/reuse is the real idempotency layer — disable alone is not enough.
 */
export function CreateExpenseForm({
  action,
  pets,
  configured,
  initialError,
}: {
  action: (formData: FormData) => Promise<CreateExpenseResult>;
  pets: { id: string; name: string }[];
  configured: boolean;
  initialError?: string | null;
}) {
  const [expenseId] = useState(() => crypto.randomUUID());
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
          formData.set("expense_id", expenseId);
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
      <input type="hidden" name="expense_id" value={expenseId} />

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

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Descrição
          <input disabled={!configured || pending} required name="description" className="field mt-2" placeholder="Ex.: Consulta de retorno" />
        </label>
        <label className="text-sm font-bold">
          Valor total (R$)
          <input disabled={!configured || pending} required name="amount" type="number" min="0" step="0.01" inputMode="decimal" className="field mt-2" placeholder="0,00" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Categoria
          <select disabled={!configured || pending} required name="category" className="field mt-2">
            <option value="veterinary">Veterinário</option>
            <option value="food">Alimentação</option>
            <option value="medication">Medicamentos</option>
            <option value="hygiene">Higiene</option>
            <option value="accessory">Acessórios</option>
            <option value="transport">Transporte</option>
            <option value="other">Outros</option>
          </select>
        </label>
        <label className="text-sm font-bold">
          Data
          <FactualDateInput disabled={!configured || pending} required name="occurred_on" defaultValue={civilDateInAppTz()} className="field mt-2" />
        </label>
      </div>
      <PetMultiSelect pets={pets} defaultSelectedIds={[]} disabled={!configured || pending} required={false} legend="Pets relacionados" hint="Opcional — escolha um ou mais pets." />
      <label className="block text-sm font-bold">
        Observações
        <textarea disabled={!configured || pending} name="notes" rows={3} className="field mt-2 resize-none" placeholder="Clínica, cupom, parcelamento ou qualquer contexto" />
      </label>
      <SubmitButton
        disabled={!configured || pending}
        pendingLabel="Salvando..."
        className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ReceiptText size={17} /> Salvar gasto
      </SubmitButton>
    </form>
  );
}
