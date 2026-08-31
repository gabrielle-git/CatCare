"use client";

import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Search, X } from "lucide-react";
import { icons } from "lucide-react";
import { RoutineIcon } from "@/components/routine-icon";
import {
  DEFAULT_ROUTINE_ICON,
  kebabToPascal,
  parseRoutineIconKey,
  serializeEmojiIcon,
  serializeLucideIcon,
} from "@/lib/routine-icons";
import { searchCuratedLucideIcons } from "@/lib/routine-lucide-curated";

type Tab = "emoji" | "lucide";

function LucideGridIcon({
  name,
  size = 20,
  selected = false,
}: {
  name: string;
  size?: number;
  selected?: boolean;
}) {
  const Icon = icons[kebabToPascal(name) as keyof typeof icons];
  if (!Icon) return null;
  return createElement(Icon, {
    size,
    strokeWidth: 2,
    className: selected ? "text-[var(--lavender-strong)]" : "text-[var(--muted)]",
    "aria-hidden": true,
  });
}

export function RoutineIconPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("emoji");
  const [query, setQuery] = useState("");

  const parsed = parseRoutineIconKey(value || DEFAULT_ROUTINE_ICON);

  const filteredLucide = useMemo(() => searchCuratedLucideIcons(query), [query]);

  const open = () => {
    if (disabled) return;
    setQuery("");
    setTab(parsed.kind === "emoji" ? "emoji" : "lucide");
    dialogRef.current?.showModal();
    window.setTimeout(() => {
      if (parsed.kind !== "emoji") searchRef.current?.focus();
    }, 0);
  };

  const close = () => dialogRef.current?.close();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      close();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, []);

  const selectEmoji = (emoji: { native?: string }) => {
    if (!emoji.native) return;
    onChange(serializeEmojiIcon(emoji.native));
    close();
  };

  const selectLucide = (name: string) => {
    onChange(serializeLucideIcon(name));
    close();
  };

  const dialog = (
    <dialog
      ref={dialogRef}
      className="routine-icon-picker-dialog fixed inset-0 z-[80] m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-black/40 open:flex open:items-end open:justify-center sm:open:items-center"
      aria-labelledby="routine-icon-picker-title"
      onClick={(event) => {
        if (event.target === dialogRef.current) close();
      }}
    >
      <div
        className="flex max-h-[min(92vh,720px)] min-h-[min(62vh,480px)] w-full flex-col overflow-hidden rounded-t-[24px] border border-[var(--border)] bg-[var(--cream)] shadow-2xl sm:max-w-[min(92vw,460px)] sm:rounded-[24px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 id="routine-icon-picker-title" className="text-base font-bold">
            Escolher ícone
          </h2>
          <button
            type="button"
            onClick={close}
            className="focus-ring grid size-9 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--muted)] hover:bg-[var(--lavender-soft)] hover:text-[var(--lavender-strong)]"
            aria-label="Fechar"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-[var(--border)] px-4 py-2" role="tablist" aria-label="Tipo de ícone">
          {([
            ["emoji", "Emoji"],
            ["lucide", "Ícones"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                setQuery("");
              }}
              className={`focus-ring rounded-full px-3 py-1.5 text-xs font-bold ${
                tab === id
                  ? "bg-[var(--lavender-soft)] text-[var(--lavender-strong)]"
                  : "text-[var(--muted)] hover:bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "lucide" && (
          <div className="border-b border-[var(--border)] px-4 py-3">
            <label className="routine-icon-search flex items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-white px-3 py-0.5 focus-within:border-[var(--lavender)] focus-within:shadow-[0_0_0_3px_rgba(142,125,190,0.16)]">
              <Search size={16} className="shrink-0 text-[var(--muted)]" strokeWidth={2} aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
                placeholder="Buscar ícone..."
                autoComplete="off"
                enterKeyHint="search"
                className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
              />
            </label>
          </div>
        )}

        <div
          className={`min-h-0 flex-1 overflow-auto ${tab === "emoji" ? "routine-emoji-mart" : "p-3"}`}
        >
          {tab === "emoji" ? (
            <div className="routine-emoji-mart-inner">
              <Picker
                data={data}
                onEmojiSelect={selectEmoji}
                locale="pt"
                theme="light"
                previewPosition="none"
                skinTonePosition="search"
                maxFrequentRows={2}
              />
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8" role="listbox" aria-label="Ícones Lucide">
              {filteredLucide.map((name) => {
                const selected = parsed.kind === "lucide" && parsed.kebab === name;
                return (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    title={name}
                    onClick={() => selectLucide(name)}
                    className={`focus-ring grid size-11 place-items-center rounded-xl border transition ${
                      selected
                        ? "border-[var(--lavender)] bg-[var(--lavender-soft)]"
                        : "border-[var(--border)] bg-white hover:border-[var(--lavender)]/40 hover:bg-[var(--lavender-soft)]/50"
                    }`}
                  >
                    <LucideGridIcon name={name} size={18} selected={selected} />
                  </button>
                );
              })}
              {filteredLucide.length === 0 && (
                <p className="col-span-full px-2 py-6 text-center text-sm text-[var(--muted)]">
                  Nenhum ícone encontrado.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );

  return (
    <>
      <div className="mt-2">
        <button
          type="button"
          disabled={disabled}
          onClick={open}
          className="focus-ring inline-flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-55"
          aria-haspopup="dialog"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--lavender-soft)] text-[var(--lavender-strong)]">
            <RoutineIcon iconKey={value || DEFAULT_ROUTINE_ICON} size={18} />
          </span>
          Escolher ícone
        </button>
      </div>

      {typeof document !== "undefined" ? createPortal(dialog, document.body) : null}
    </>
  );
}
