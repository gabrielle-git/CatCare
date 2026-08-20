"use client";

import { useState } from "react";

export type PetMultiSelectOption = { id: string; name: string; neonatal?: boolean };

export function PetMultiSelect({
  pets,
  name = "pet_ids",
  defaultSelectedIds,
  disabled = false,
  required = true,
  multiple = true,
  legend = "Quais pets?",
  hint = "Pode escolher mais de um.",
  onSelectionChange,
}: {
  pets: PetMultiSelectOption[];
  name?: string;
  defaultSelectedIds?: string[];
  disabled?: boolean;
  required?: boolean;
  multiple?: boolean;
  legend?: string;
  hint?: string;
  onSelectionChange?: (ids: string[]) => void;
}) {
  const initial =
    defaultSelectedIds !== undefined
      ? defaultSelectedIds
      : required && pets[0]?.id
        ? [pets[0].id]
        : [];
  const [selected, setSelected] = useState<Set<string>>(() => new Set(multiple ? initial : initial.slice(0, 1)));

  function toggle(id: string) {
    if (disabled) return;
    const next = new Set(selected);
    if (!multiple) {
      next.clear();
      next.add(id);
    } else if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
    onSelectionChange?.([...next]);
  }

  return (
    <fieldset disabled={disabled}>
      {legend ? (
        <legend className="text-sm font-bold">
          {legend} {required && <span className="text-[var(--danger)]">*</span>}
        </legend>
      ) : null}
      {multiple && hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
      {!multiple ? <p className="mt-1 text-xs text-[var(--muted)]">Este registro está ligado a um pet.</p> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {pets.map((pet) => (
          <label
            key={pet.id}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${selected.has(pet.id) ? "border-[var(--lavender)] bg-[var(--lavender-soft)]/50" : "border-[var(--border)] bg-white"}`}
          >
            <input
              type="checkbox"
              name={name}
              value={pet.id}
              checked={selected.has(pet.id)}
              onChange={() => toggle(pet.id)}
              disabled={disabled}
              className="size-4 accent-[var(--lavender)]"
            />
            {pet.name}
            {pet.neonatal ? " • filhote" : ""}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
