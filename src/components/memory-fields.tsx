import { MemoryPhotoInput } from "@/components/memory-photo-input";
import type { MemoryWithMediaUrl, PetWithPhotoUrl } from "@/types/database";

function localDateTime(value: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
  return parts.replace(" ", "T");
}

export function MemoryFields({ pets, defaultValues, disabled = false }: { pets: PetWithPhotoUrl[]; defaultValues?: MemoryWithMediaUrl; disabled?: boolean }) {
  const selected = new Set(defaultValues?.pet_ids ?? []);
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold">Tipo de lembrança<select disabled={disabled} name="type" defaultValue={defaultValues?.type ?? "milestone"} className="field mt-2"><option value="milestone">Primeira vez ou marco</option><option value="diary">Momento do dia a dia</option><option value="photo">Foto que merece ficar guardada</option></select></label><label className="block text-sm font-bold">Quando aconteceu?<input disabled={disabled} required name="occurred_at" type="datetime-local" defaultValue={defaultValues ? localDateTime(defaultValues.occurred_at) : ""} className="field mt-2" /></label></div>
    <label className="block text-sm font-bold">Título <span className="text-[var(--danger)]">*</span><input disabled={disabled} required maxLength={120} name="title" defaultValue={defaultValues?.title ?? ""} className="field mt-2" placeholder="Ex.: Abriu os olhinhos" /></label>
    <label className="block text-sm font-bold">Conte um pouquinho<textarea disabled={disabled} maxLength={2000} name="body" defaultValue={defaultValues?.body ?? ""} rows={4} className="field mt-2 resize-none" placeholder="O que aconteceu, quem estava junto e por que você quer lembrar desse momento?" /></label>
    <fieldset><legend className="text-sm font-bold">Quem aparece nessa memória? <span className="text-[var(--danger)]">*</span></legend><p className="mt-1 text-xs text-[var(--muted)]">Pode escolher mais de um gatinho.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{pets.map((pet) => <label key={pet.id} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold"><input disabled={disabled} type="checkbox" name="pet_ids" value={pet.id} defaultChecked={selected.has(pet.id)} className="size-4 accent-[var(--lavender)]" /> {pet.name}</label>)}</div></fieldset>
    <MemoryPhotoInput currentMedia={defaultValues?.media} disabled={disabled} />
  </div>;
}
