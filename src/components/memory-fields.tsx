import { MemoryPhotoInput } from "@/components/memory-photo-input";
import { PetMultiSelect } from "@/components/pet-multi-select";
import type { MemoryWithMediaUrl, PetWithPhotoUrl } from "@/types/database";

function localDateTime(value: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
  return parts.replace(" ", "T");
}

export function MemoryFields({ pets, defaultValues, disabled = false }: { pets: PetWithPhotoUrl[]; defaultValues?: MemoryWithMediaUrl; disabled?: boolean }) {
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold">Tipo de lembrança<select disabled={disabled} name="type" defaultValue={defaultValues?.type ?? "milestone"} className="field mt-2"><option value="milestone">Primeira vez ou marco</option><option value="diary">Momento do dia a dia</option><option value="photo">Foto que merece ficar guardada</option></select></label><label className="block text-sm font-bold">Quando aconteceu?<input disabled={disabled} required name="occurred_at" type="datetime-local" defaultValue={defaultValues ? localDateTime(defaultValues.occurred_at) : ""} className="field mt-2" /></label></div>
    <label className="block text-sm font-bold">Título <span className="text-[var(--danger)]">*</span><input disabled={disabled} required maxLength={120} name="title" defaultValue={defaultValues?.title ?? ""} className="field mt-2" placeholder="Ex.: Abriu os olhinhos" /></label>
    <label className="block text-sm font-bold">Conte um pouquinho<textarea disabled={disabled} maxLength={2000} name="body" defaultValue={defaultValues?.body ?? ""} rows={4} className="field mt-2 resize-none" placeholder="O que aconteceu, quem estava junto e por que você quer lembrar desse momento?" /></label>
    <PetMultiSelect pets={pets.map((pet) => ({ id: pet.id, name: pet.name }))} defaultSelectedIds={defaultValues?.pet_ids} disabled={disabled} legend="Quem aparece nessa memória?" hint="Pode escolher mais de um gatinho." />
    <MemoryPhotoInput currentMedia={defaultValues?.media} disabled={disabled} />
  </div>;
}
