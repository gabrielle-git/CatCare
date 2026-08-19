"use client";

import { useState } from "react";
import type { Pet } from "@/types/database";

export function MicrochipFields({ defaultValues, disabled = false }: { defaultValues?: Partial<Pet>; disabled?: boolean }) {
  const [enabled, setEnabled] = useState(defaultValues?.has_microchip ?? false);

  return (
    <section className="rounded-[22px] border border-[var(--border)] bg-[var(--cream)] p-4">
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input
          disabled={disabled}
          type="checkbox"
          name="has_microchip"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="size-4 accent-[var(--lavender)]"
        />
        Tem microchip
      </label>
      {enabled && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold sm:col-span-2">
            Número do chip
            <input
              disabled={disabled}
              required
              name="microchip_number"
              defaultValue={defaultValues?.microchip_number ?? ""}
              className="field mt-2 font-mono text-sm tracking-wide"
              placeholder="Ex.: 900123456789012"
              inputMode="numeric"
            />
          </label>
          <label className="block text-sm font-bold">
            Data de implantação
            <input
              disabled={disabled}
              type="date"
              name="microchip_implanted_at"
              defaultValue={defaultValues?.microchip_implanted_at ?? ""}
              className="field mt-2"
            />
          </label>
          <label className="block text-sm font-bold">
            Local no corpo
            <input
              disabled={disabled}
              name="microchip_location"
              defaultValue={defaultValues?.microchip_location ?? ""}
              className="field mt-2"
              placeholder="Ex.: pescoço esquerdo"
              list="microchip-locations"
            />
            <datalist id="microchip-locations">
              <option value="Pescoço esquerdo" />
              <option value="Pescoço direito" />
              <option value="Entre as omoplatas" />
              <option value="Flanco esquerdo" />
              <option value="Flanco direito" />
            </datalist>
          </label>
        </div>
      )}
    </section>
  );
}
