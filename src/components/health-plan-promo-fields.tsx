import type { HealthPlan } from "@/types/database";

export function HealthPlanPromoFields({ plan }: { plan?: Pick<HealthPlan, "promo_coupon_code" | "zero_waiting_consultation" | "zero_waiting_vaccine" | "promo_notes"> | null }) {
  return (
    <section className="cat-card space-y-4 p-5 md:p-7">
      <div>
        <h2 className="text-lg font-bold">Promoção na contratação</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Cupom ou campanha que alterou carências ou benefícios na adesão — útil para consultas e vacinas com carência zero.
        </p>
      </div>
      <label className="block text-sm font-bold">
        Código do cupom
        <input
          name="promo_coupon_code"
          defaultValue={plan?.promo_coupon_code ?? ""}
          className="field mt-2"
          placeholder="Ex.: CAREnciaZERO"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-3 rounded-2xl bg-[var(--cream)] px-4 py-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="zero_waiting_consultation"
            defaultChecked={plan?.zero_waiting_consultation ?? false}
            className="size-4 accent-[var(--lavender)]"
          />
          Carência zero em consultas
        </label>
        <label className="flex items-center gap-3 rounded-2xl bg-[var(--cream)] px-4 py-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="zero_waiting_vaccine"
            defaultChecked={plan?.zero_waiting_vaccine ?? false}
            className="size-4 accent-[var(--lavender)]"
          />
          Carência zero em vacinas
        </label>
      </div>
      <label className="block text-sm font-bold text-[var(--muted)]">
        Outras promoções ou carências
        <textarea
          name="promo_notes"
          rows={2}
          defaultValue={plan?.promo_notes ?? ""}
          className="field mt-2 resize-none"
          placeholder="Ex.: exames simples ainda com 45 dias; promo válida só na contratação..."
        />
      </label>
    </section>
  );
}

export function HealthPlanPromoBadges({
  plan,
}: {
  plan: Pick<HealthPlan, "promo_coupon_code" | "zero_waiting_consultation" | "zero_waiting_vaccine" | "promo_notes">;
}) {
  const items: string[] = [];
  if (plan.promo_coupon_code) items.push(`Cupom ${plan.promo_coupon_code}`);
  if (plan.zero_waiting_consultation) items.push("Consultas sem carência");
  if (plan.zero_waiting_vaccine) items.push("Vacinas sem carência");
  if (items.length === 0 && !plan.promo_notes) return null;

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="rounded-full bg-[var(--peach)] px-2.5 py-1 text-[10px] font-bold text-[#96613e]">
              {item}
            </span>
          ))}
        </div>
      )}
      {plan.promo_notes && <p className="text-xs text-[var(--muted)]">{plan.promo_notes}</p>}
    </div>
  );
}
