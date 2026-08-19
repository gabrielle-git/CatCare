"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { BENEFIT_MEMBERSHIP_HINTS, BENEFIT_MEMBERSHIP_LABELS } from "@/lib/benefit-memberships";
import type { BenefitMembership, BenefitMembershipKind } from "@/types/database";

export function BenefitMembershipForm({
  kind,
  membership,
  action,
  editable,
  title,
  isNew = false,
}: {
  kind: BenefitMembershipKind;
  membership: BenefitMembership | null;
  action: (formData: FormData) => void;
  editable: boolean;
  title?: string;
  isNew?: boolean;
}) {
  const [editingBenefits, setEditingBenefits] = useState(isNew || !(membership?.notes?.trim()));
  const label = title ?? BENEFIT_MEMBERSHIP_LABELS[kind];
  const hint = BENEFIT_MEMBERSHIP_HINTS[kind];
  const monthlyFee = membership?.monthly_fee_cents != null ? (membership.monthly_fee_cents / 100).toFixed(2) : "";
  const benefitsText = membership?.notes?.trim() ?? "";

  return (
    <form action={action} className="rounded-[20px] border border-[var(--border)] bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">{label}</h3>
          {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
        </div>
        {membership?.active && membership.renews_at && (
          <span className="rounded-full bg-[var(--mint-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--success)]">
            Renova {formatShortDate(membership.renews_at)}
          </span>
        )}
      </div>

      <input type="hidden" name="kind" value={kind} />
      {membership?.id && <input type="hidden" name="membership_id" value={membership.id} />}

      {kind === "other" && (
        <label className="mt-4 block text-xs font-bold">
          Nome do clube
          <input
            disabled={!editable}
            name="custom_name"
            required
            defaultValue={membership?.custom_name ?? ""}
            placeholder="Ex.: Clube Petz"
            className="field mt-1.5"
          />
        </label>
      )}

      <label className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--cream)] px-4 py-3 text-sm font-semibold">
        <input
          type="checkbox"
          name="active"
          defaultChecked={membership?.active ?? false}
          disabled={!editable}
          className="size-4 accent-[var(--lavender)]"
        />
        Tenho esta assinatura ativa
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold">
          Valor (R$/mês)
          <input
            disabled={!editable}
            name="monthly_fee"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            defaultValue={monthlyFee}
            placeholder="Opcional"
            className="field mt-1.5"
          />
        </label>
        <label className="text-xs font-bold">
          Próxima renovação
          <input
            disabled={!editable}
            name="renews_at"
            type="date"
            defaultValue={membership?.renews_at ?? ""}
            className="field mt-1.5"
          />
        </label>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-[var(--muted)]">Benefícios do clube</p>
          {editable && !editingBenefits && (
            <button
              type="button"
              onClick={() => setEditingBenefits(true)}
              className="focus-ring inline-flex items-center gap-1 rounded-lg bg-[var(--cream)] px-2 py-1 text-[10px] font-bold"
            >
              <Pencil size={11} /> Editar
            </button>
          )}
        </div>
        {editingBenefits || !benefitsText ? (
          <textarea
            disabled={!editable}
            name="notes"
            rows={4}
            defaultValue={membership?.notes ?? ""}
            placeholder="Ex.: frete grátis acima de R$ 99, 10% em rações, cashback…"
            className="field mt-1.5 min-h-[5.5rem] resize-y"
            onBlur={() => {
              if (benefitsText) setEditingBenefits(false);
            }}
          />
        ) : (
          <>
            <input type="hidden" name="notes" value={membership?.notes ?? ""} />
            <div className="mt-1.5 rounded-[14px] bg-[var(--cream)] px-3.5 py-3 text-sm leading-relaxed whitespace-pre-wrap">
              {benefitsText}
            </div>
          </>
        )}
      </div>

      {editable && (
        <button type="submit" className="focus-ring mt-4 rounded-xl bg-[var(--graphite)] px-4 py-2.5 text-xs font-bold text-white">
          Salvar {label}
        </button>
      )}

      {membership?.active && membership.monthly_fee_cents != null && (
        <p className="mt-3 text-[11px] text-[var(--muted)]">
          Custo mensal registrado: <strong className="text-[var(--foreground)]">{formatCurrency(membership.monthly_fee_cents)}</strong>
        </p>
      )}
    </form>
  );
}
