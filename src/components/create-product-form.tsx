"use client";

import { useState, useTransition } from "react";
import { PackagePlus } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import type { CreateProductResult } from "@/app/(app)/shopping/actions";

/**
 * Catalog-only form: one mount = one product_id intent, so a retry reuses the same Product.
 * Transaction facts (date, store, price, payment) live in Registrar compra, never here.
 */
export function CreateProductForm({
  action,
  configured,
}: {
  action: (formData: FormData) => Promise<CreateProductResult>;
  configured: boolean;
}) {
  const [productId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const disabled = !configured || pending;

  return (
    <form
      className="cat-card mt-6 space-y-5 p-5 md:p-7"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        startTransition(async () => {
          setError(null);
          const formData = new FormData(form);
          formData.set("product_id", productId);
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
      <input type="hidden" name="product_id" value={productId} />
      {error ? (
        <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Nome
          <input disabled={disabled} required name="product_name" className="field mt-2" placeholder="Ex.: Sachê de frango" />
        </label>
        <label className="text-sm font-bold">
          Marca
          <input disabled={disabled} name="brand" className="field mt-2" placeholder="Ex.: GranPlus" />
        </label>
        <label className="text-sm font-bold">
          Categoria
          <select disabled={disabled} required name="category" className="field mt-2">
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
          <input disabled={disabled} name="package_size" className="field mt-2" placeholder="Ex.: 3 kg ou 85 g" />
        </label>
      </div>
      <label className="block text-sm font-bold">
        Notas
        <textarea disabled={disabled} name="product_notes" rows={3} className="field mt-2 resize-none" placeholder="Sabor, fase de vida, onde costuma encontrar..." />
      </label>
      <SubmitButton
        disabled={disabled}
        pendingLabel="Salvando..."
        className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PackagePlus size={18} /> Cadastrar produto
      </SubmitButton>
    </form>
  );
}
