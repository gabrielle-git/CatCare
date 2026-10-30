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
  appearance = "default",
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
  appearance?: "default" | "quiet";
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

  const inputType = multiple ? "checkbox" : "radio";

  return (
    <fieldset disabled={disabled}>
      {legend ? (
        <legend className="text-sm font-bold">
          {legend} {required && <span className="text-[var(--danger)]">*</span>}
        </legend>
      ) : null}
      {multiple && hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
      {!multiple ? <p className="mt-1 text-xs text-[var(--muted)]">Este registro está ligado a um pet.</p> : null}
      <div
        className="mt-3 grid gap-2 sm:grid-cols-2"
        role={multiple ? "group" : "radiogroup"}
        aria-label={legend || "Seleção de pets"}
      >
        {pets.map((pet) => {
          const isSelected = selected.has(pet.id);
          return (
            <label
              key={pet.id}
              className={`flex items-center gap-2.5 text-sm font-semibold transition ${
                appearance === "quiet" ? "rounded-xl border px-3 py-2" : "cursor-pointer gap-3 rounded-2xl border px-4 py-3"
              } ${disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer"} ${
                isSelected
                  ? appearance === "quiet"
                    ? "border-[color-mix(in_srgb,var(--cuidadim-purple-300)_55%,transparent)] bg-[color-mix(in_srgb,var(--cuidadim-purple-50)_80%,#faf6f2)] text-[var(--cuidadim-purple-900)]"
                    : "border-[var(--lavender)] bg-[var(--lavender-soft)]/50 text-[var(--foreground)]"
                  : appearance === "quiet"
                    ? "border-[color-mix(in_srgb,var(--cuidadim-purple-100)_80%,transparent)] bg-transparent text-[var(--muted)]"
                    : "border-[var(--border)] bg-white text-[var(--muted)]"
              }`}
            >
              <input
                type={inputType}
                name={name}
                value={pet.id}
                checked={isSelected}
                onChange={() => toggle(pet.id)}
                disabled={disabled}
                required={required && !multiple && selected.size === 0}
                className={appearance === "quiet" ? "size-3.5 shrink-0 accent-[var(--cuidadim-purple-700)]" : "size-4 shrink-0 accent-[var(--lavender)]"}
              />
              {appearance === "quiet" ? (
                <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--cuidadim-rosa-light)_45%,#faf6f2)] text-[11px] font-semibold text-[var(--cuidadim-purple-700)]">
                  {pet.name.slice(0, 1)}
                </span>
              ) : null}
              <span className="min-w-0 flex-1">
                {pet.name}
                {pet.neonatal ? " • filhote" : ""}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
