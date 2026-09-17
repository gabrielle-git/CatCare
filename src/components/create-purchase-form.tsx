"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ShoppingBasket, Star } from "lucide-react";
import { FactualDateInput } from "@/components/factual-datetime-input";
import { PetMultiSelect } from "@/components/pet-multi-select";
import { StarRating } from "@/components/star-rating";
import { SubmitButton } from "@/components/submit-button";
import { membershipLabel } from "@/lib/benefit-memberships";
import { civilDateInAppTz } from "@/lib/factual-datetime";
import type { CreatePurchaseResult } from "@/app/(app)/shopping/actions";
import type { BenefitMembership, Product } from "@/types/database";

const scoreFields = [
  { name: "quality_score", legend: "Qualidade" },
  { name: "acceptance_score", legend: "Aceitação dos pets" },
  { name: "cost_benefit_score", legend: "Custo-benefício" },
] as const;

/**
 * One form mount = one purchase intent (purchase_id + expense_id + optional new_product_id/review_id).
 * Pending disable is UX; server ownership/reuse prevents duplicate expenses.
 */
export function CreatePurchaseForm({
  action,
  products,
  pets,
  memberships,
  configured,
  initialError,
}: {
  action: (formData: FormData) => Promise<CreatePurchaseResult>;
  products: Product[];
  pets: { id: string; name: string }[];
  memberships: BenefitMembership[];
  configured: boolean;
  initialError?: string | null;
}) {
  const [purchaseId] = useState(() => crypto.randomUUID());
  const [expenseId] = useState(() => crypto.randomUUID());
  const [newProductId] = useState(() => crypto.randomUUID());
  const [reviewId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-6 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        startTransition(async () => {
          setError(null);
          const formData = new FormData(form);
          formData.set("purchase_id", purchaseId);
          formData.set("expense_id", expenseId);
          formData.set("new_product_id", newProductId);
          formData.set("review_id", reviewId);
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
      <input type="hidden" name="purchase_id" value={purchaseId} />
      <input type="hidden" name="expense_id" value={expenseId} />
      <input type="hidden" name="new_product_id" value={newProductId} />
      <input type="hidden" name="review_id" value={reviewId} />

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

      <section className="cat-card p-5 md:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">1. Produto</p>
        <h2 className="mt-1 text-xl font-bold">O que você comprou?</h2>
        <label className="mt-5 block text-sm font-bold">
          Usar um produto já acompanhado
          <select disabled={!configured || pending} name="product_id" className="field mt-2">
            <option value="">Cadastrar um produto novo</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.brand ? `${product.brand} • ` : ""}
                {product.name}
                {product.package_size ? ` — ${product.package_size}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 rounded-[20px] bg-[var(--cream)] p-4">
          <p className="text-xs font-bold">Se for um produto novo</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">
              Nome
              <input disabled={!configured || pending} name="product_name" className="field mt-2" placeholder="Ex.: Sachê de frango" />
            </label>
            <label className="text-sm font-bold">
              Marca
              <input disabled={!configured || pending} name="brand" className="field mt-2" placeholder="Ex.: GranPlus" />
            </label>
            <label className="text-sm font-bold">
              Categoria
              <select disabled={!configured || pending} name="category" className="field mt-2">
                <option value="dry_food">Ração seca</option>
                <option value="wet_food">Sachê / alimento úmido</option>
                <option value="litter">Areia</option>
                <option value="treat">Petisco</option>
                <option value="hygiene">Higiene</option>
                <option value="medicine">Medicamento</option>
                <option value="accessory">Acessório</option>
                <option value="other">Outro</option>
              </select>
            </label>
            <label className="text-sm font-bold">
              Tamanho da embalagem
              <input disabled={!configured || pending} name="package_size" className="field mt-2" placeholder="Ex.: 3 kg ou 85 g" />
            </label>
          </div>
        </div>
      </section>

      <section className="cat-card p-5 md:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">2. Compra</p>
        <h2 className="mt-1 text-xl font-bold">Preço e onde encontrou</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">
            Loja ou vendedor
            <input disabled={!configured || pending} required name="store_name" className="field mt-2" placeholder="Ex.: Cobasi" />
          </label>
          <label className="text-sm font-bold">
            Canal
            <select disabled={!configured || pending} required name="channel" className="field mt-2">
              <option value="physical_store">Loja física</option>
              <option value="online_store">Loja online</option>
              <option value="marketplace">Marketplace</option>
              <option value="delivery">Aplicativo / delivery</option>
              <option value="veterinary">Clínica veterinária</option>
              <option value="other">Outro</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Valor pago (R$)
            <input disabled={!configured || pending} required name="amount" type="number" min="0" step="0.01" inputMode="decimal" className="field mt-2" placeholder="0,00" />
          </label>
          <label className="text-sm font-bold">
            Quantidade de pacotes
            <input disabled={!configured || pending} required name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" className="field mt-2" />
          </label>
          <label className="text-sm font-bold">
            Data
            <FactualDateInput disabled={!configured || pending} required name="purchased_on" defaultValue={civilDateInAppTz()} className="field mt-2" />
          </label>
        </div>
        <div className="mt-4 rounded-[20px] bg-[var(--cream)] p-4">
          <p className="text-xs font-bold">Cupom e desconto (opcional)</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">
              Valor antes do desconto (R$)
              <input disabled={!configured || pending} name="subtotal" type="number" min="0" step="0.01" inputMode="decimal" className="field mt-2" placeholder="Se souber o preço de tabela" />
            </label>
            <label className="text-sm font-bold">
              Desconto (R$)
              <input disabled={!configured || pending} name="discount" type="number" min="0" step="0.01" inputMode="decimal" className="field mt-2" placeholder="0,00" />
            </label>
            <label className="text-sm font-bold sm:col-span-2">
              Código do cupom
              <input disabled={!configured || pending} name="coupon_code" className="field mt-2" placeholder="Ex.: PETLOVE10" />
            </label>
            {memberships.length > 0 ? (
              <label className="text-sm font-bold sm:col-span-2">
                Desconto de assinatura (opcional)
                <select disabled={!configured || pending} name="membership_id" className="field mt-2" defaultValue="">
                  <option value="">Nenhuma assinatura</option>
                  {memberships.map((item) => (
                    <option key={item.id} value={item.id}>
                      {membershipLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="sm:col-span-2 text-xs text-[var(--muted)]">
                Cadastre clubes em{" "}
                <Link href="/health-plan" className="font-bold underline">
                  Plano de saúde
                </Link>{" "}
                para vincular descontos de assinatura.
              </p>
            )}
          </div>
        </div>
        <div className="mt-4">
          <PetMultiSelect pets={pets} defaultSelectedIds={[]} disabled={!configured || pending} required={false} legend="Para quem?" hint="Opcional — um, vários pets ou nenhum (casa toda)." />
        </div>
        <label className="mt-4 block text-sm font-bold">
          Link do produto
          <input disabled={!configured || pending} name="product_url" type="url" className="field mt-2" placeholder="https://... (opcional)" />
        </label>
      </section>

      <section className="cat-card p-5 md:p-7">
        <div className="flex items-center gap-2">
          <Star size={18} className="text-[var(--lavender-strong)]" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">3. Avaliação opcional</p>
            <h2 className="mt-1 text-xl font-bold">Valeu a pena?</h2>
          </div>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">Preencha as três notas quando já tiver uma opinião; senão, avalie depois.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {scoreFields.map((field) => (
            <StarRating key={field.name} name={field.name} legend={field.legend} allowEmpty disabled={!configured || pending} />
          ))}
        </div>
        <label className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold">
          <input disabled={!configured || pending} type="checkbox" name="would_buy_again" className="size-4 accent-[var(--lavender)]" /> Eu compraria novamente
        </label>
        <label className="mt-4 block text-sm font-bold">
          Comentário da avaliação
          <textarea disabled={!configured || pending} name="review_notes" rows={3} className="field mt-2 resize-none" placeholder="Rendimento, cheiro, textura, reação dos pets..." />
        </label>
      </section>

      <SubmitButton
        disabled={!configured || pending}
        pendingLabel="Salvando..."
        className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ShoppingBasket size={18} /> Salvar compra e atualizar comparações
      </SubmitButton>
    </form>
  );
}
