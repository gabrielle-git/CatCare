import Link from "next/link";
import { ExternalLink, Percent, Stethoscope, Trash2 } from "lucide-react";
import { AddGuideServiceForm } from "@/components/add-guide-service-form";
import { ConfirmButton } from "@/components/confirm-button";
import { GuideReferenceNotes } from "@/components/guide-reference-notes";
import { formatCurrency } from "@/lib/format";
import { groupServices } from "@/lib/health-plan-guides";
import {
  estimatePetloveLeveMonthlyCents,
  PETLOVE_COPAY_PAYMENT_NOTES,
  PETLOVE_MULTI_PET_DISCOUNTS,
  PETLOVE_WAITING_PERIODS,
} from "@/lib/petlove-health-reference";
import type { HealthPlanGuideWithServices, HealthPlanWithCopays } from "@/types/database";
import { HealthPlanPromoBadges } from "./health-plan-promo-fields";

function CopayCell({ cents }: { cents: number }) {
  if (cents === 0) return <span className="font-bold text-[var(--success)]">Grátis</span>;
  return <span className="font-bold text-[var(--lavender-strong)]">{formatCurrency(cents)}</span>;
}

function effectiveWaitingDays(
  groupKey: string,
  defaultDays: number,
  plans: { zero_waiting_consultation: boolean; zero_waiting_vaccine: boolean }[],
) {
  if (plans.length === 0) return defaultDays;
  if (groupKey === "consultations" && plans.some((p) => p.zero_waiting_consultation)) return 0;
  if (groupKey === "vaccines" && plans.some((p) => p.zero_waiting_vaccine)) return 0;
  return defaultDays;
}

export function HealthPlanGuidePanel({
  guide,
  editable = false,
  saveBaseFeeAction,
  addServiceAction,
  deleteServiceAction,
  saveNotesAction,
  householdPlans = [],
}: {
  guide: HealthPlanGuideWithServices;
  editable?: boolean;
  saveBaseFeeAction?: (formData: FormData) => void;
  addServiceAction?: (formData: FormData) => void;
  deleteServiceAction?: (serviceId: string, formData: FormData) => void;
  saveNotesAction?: (formData: FormData) => void;
  householdPlans?: Array<HealthPlanWithCopays & { pet_name: string }>;
}) {
  const baseMonthlyFeeCents = guide.base_monthly_fee_cents ?? 1790;
  const groups = groupServices(guide.services);
  const activePlans = householdPlans.filter((plan) => plan.active && (guide.provider === "petlove" ? plan.provider === "petlove" : true));
  const promoContext = activePlans.map((plan) => ({
    zero_waiting_consultation: plan.zero_waiting_consultation,
    zero_waiting_vaccine: plan.zero_waiting_vaccine,
  }));
  const exampleCounts = activePlans.length > 0 ? [activePlans.length] : [1, 2, 3, 4];
  const defaultPaymentNotes = guide.provider === "petlove" ? PETLOVE_COPAY_PAYMENT_NOTES.join("\n") : null;
  const defaultWaitingNotes = guide.provider === "petlove"
    ? PETLOVE_WAITING_PERIODS.map((item) => `${item.days} dias — ${item.group}${"note" in item && item.note ? ` (${item.note})` : ""}`).join("\n")
    : null;
  const paymentNotes = guide.payment_notes ?? defaultPaymentNotes;
  const waitingNotes = guide.waiting_notes ?? defaultWaitingNotes;

  return (
    <div className="space-y-8">
      <section className="cat-card overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[linear-gradient(135deg,var(--lavender-soft),#fff)] p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--lavender-strong)]">
                <Stethoscope size={14} /> Tabela de referência
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em]">{guide.title}</h2>
              {guide.notes && <p className="mt-2 max-w-[640px] text-sm leading-relaxed text-[var(--muted)]">{guide.notes}</p>}
            </div>
            <div className="rounded-[18px] bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Mensalidade base</p>
              {editable && saveBaseFeeAction ? (
                <form action={saveBaseFeeAction} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="guide_id" value={guide.id} />
                  <label className="text-xs font-bold">
                    R$/pet (1º pet)
                    <input
                      name="base_monthly_fee"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      defaultValue={(baseMonthlyFeeCents / 100).toFixed(2)}
                      className="field mt-1 w-28"
                    />
                  </label>
                  <button type="submit" className="focus-ring rounded-xl bg-[var(--graphite)] px-3 py-2 text-[10px] font-bold text-white">
                    Salvar
                  </button>
                </form>
              ) : (
                <>
                  <p className="text-2xl font-bold tracking-[-0.04em]">{formatCurrency(baseMonthlyFeeCents)}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--muted)]">por pet (1º pet, sem desconto)</p>
                </>
              )}
            </div>
          </div>
        </div>
        {guide.official_url && (
          <div className="p-5 text-xs leading-relaxed text-[var(--muted)] md:p-6">
            <Link href={guide.official_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-[var(--lavender-strong)] underline">
              Ver no site da operadora <ExternalLink size={12} />
            </Link>
          </div>
        )}
      </section>

      {guide.provider === "petlove" && activePlans.length > 0 && (
        <section>
          <h3 className="text-xl font-bold">Seus planos Petlove</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">Promoções registradas na contratação — edite ou remova em Plano de saúde.</p>
          <div className="mt-4 space-y-3">
            {activePlans.map((plan) => (
              <div key={plan.id} className="rounded-[18px] border border-[var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{plan.pet_name}</p>
                    <p className="text-sm text-[var(--muted)]">{plan.plan_name}</p>
                    {plan.monthly_fee_cents != null && (
                      <p className="mt-1 text-xs font-semibold">{formatCurrency(plan.monthly_fee_cents)}/mês</p>
                    )}
                  </div>
                  <Link href={`/health-plan/${plan.id}/edit`} className="focus-ring rounded-xl bg-[var(--cream)] px-3 py-2 text-[10px] font-bold">
                    Editar
                  </Link>
                </div>
                <div className="mt-3">
                  <HealthPlanPromoBadges plan={plan} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {guide.show_multi_pet_discount && (
        <section>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--lavender-strong)]">
            <Percent size={14} /> Desconto progressivo
          </p>
          <h3 className="mt-1 text-xl font-bold">Vários pets no mesmo plano</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {exampleCounts.map((count) => (
              <div key={count} className="rounded-[18px] border border-[var(--border)] bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                  {activePlans.length > 0 ? "Sua família" : "Exemplo"} — {count} {count === 1 ? "pet" : "pets"}
                </p>
                <p className="mt-2 text-xl font-bold tracking-[-0.03em]">
                  {formatCurrency(estimatePetloveLeveMonthlyCents(count, baseMonthlyFeeCents))}
                  <span className="text-sm font-semibold text-[var(--muted)]">/mês total</span>
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 overflow-hidden rounded-[18px] border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--cream)]/80 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2.5">Pet</th>
                  <th className="px-4 py-2.5">Desconto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] bg-white">
                {PETLOVE_MULTI_PET_DISCOUNTS.map((row) => (
                  <tr key={row.position}>
                    <td className="px-4 py-3 font-bold">{row.position}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="text-xl font-bold">{group.title}</h3>
          <div className="mt-3 overflow-hidden rounded-[18px] border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--cream)]/80 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2.5">Procedimento</th>
                  <th className="px-4 py-2.5">Coparticipação</th>
                  <th className="hidden px-4 py-2.5 sm:table-cell">Limite anual</th>
                  <th className="hidden px-4 py-2.5 md:table-cell">Carência</th>
                  {editable && deleteServiceAction && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] bg-white">
                {group.items.map((service) => {
                  const waiting = effectiveWaitingDays(service.group_key, service.waiting_days, promoContext);
                  return (
                    <tr key={service.id}>
                      <td className="px-4 py-3">
                        <p className="font-bold">{service.name}</p>
                        {service.notes && <p className="mt-0.5 text-[10px] text-[var(--muted)]">{service.notes}</p>}
                      </td>
                      <td className="px-4 py-3"><CopayCell cents={service.copay_cents} /></td>
                      <td className="hidden px-4 py-3 text-xs text-[var(--muted)] sm:table-cell">{service.annual_limit ?? "—"}</td>
                      <td className="hidden px-4 py-3 text-xs md:table-cell">
                        {waiting === 0 ? (
                          <span className="font-bold text-[var(--success)]">Sem carência{promoContext.length > 0 ? " (promo)" : ""}</span>
                        ) : (
                          <span className="text-[var(--muted)]">{waiting} dias</span>
                        )}
                      </td>
                      {editable && deleteServiceAction && (
                        <td className="px-4 py-3 text-right">
                          <form action={deleteServiceAction.bind(null, service.id)}>
                            <input type="hidden" name="guide_id" value={guide.id} />
                            <ConfirmButton message={`Remover "${service.name}" da tabela?`} className="focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-[var(--danger)]">
                              <Trash2 size={12} />
                            </ConfirmButton>
                          </form>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {editable && addServiceAction && (
        <AddGuideServiceForm guideId={guide.id} services={guide.services} action={addServiceAction} />
      )}

      <GuideReferenceNotes
        guideId={guide.id}
        paymentNotes={paymentNotes}
        waitingNotes={waitingNotes}
        editable={editable}
        saveAction={saveNotesAction}
        waitingTitle={guide.provider === "petlove" ? "Carências padrão (sem promo)" : "Carências e prazos"}
      />
    </div>
  );
}
