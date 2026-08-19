import type { Pet } from "@/types/database";
import { MicrochipFields } from "@/components/microchip-fields";

export function PetFields({ defaultValues, includeInitialWeight = false, disabled = false }: { defaultValues?: Partial<Pet>; includeInitialWeight?: boolean; disabled?: boolean }) {
  return (
    <div className="space-y-5">
      <label className="block text-sm font-bold">
        Nome do gatinho <span className="text-[var(--danger)]">*</span>
        <input disabled={disabled} required name="name" defaultValue={defaultValues?.name ?? ""} className="field mt-2" placeholder="Ex.: Dobby" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-bold">
          Sexo
          <select disabled={disabled} name="sex" defaultValue={defaultValues?.sex ?? "unknown"} className="field mt-2">
            <option value="unknown">Não informado</option>
            <option value="male">Macho</option>
            <option value="female">Fêmea</option>
          </select>
        </label>
        <label className="block text-sm font-bold">
          Nascimento
          <input disabled={disabled} type="date" name="birth_date" defaultValue={defaultValues?.birth_date ?? ""} className="field mt-2" />
        </label>
      </div>

      <label className="flex items-center gap-3 rounded-2xl bg-[var(--cream)] px-4 py-3 text-sm font-semibold">
        <input disabled={disabled} type="checkbox" name="birth_date_estimated" defaultChecked={defaultValues?.birth_date_estimated ?? false} className="size-4 accent-[var(--lavender)]" />
        A data de nascimento é estimada
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-bold">
          Raça
          <input disabled={disabled} name="breed" defaultValue={defaultValues?.breed ?? ""} className="field mt-2" placeholder="Ex.: SRD" />
        </label>
        <label className="block text-sm font-bold">
          Cor
          <input disabled={disabled} name="color" defaultValue={defaultValues?.color ?? ""} className="field mt-2" placeholder="Ex.: tigrado" />
        </label>
      </div>

      {includeInitialWeight && (
        <label className="block text-sm font-bold">
          Peso inicial (kg)
          <input disabled={disabled} type="text" name="initial_weight_kg" className="field mt-2" placeholder="Ex.: 4,2" inputMode="decimal" />
          <span className="mt-1.5 block text-xs font-normal text-[var(--muted)]">A primeira pesagem já aparecerá no histórico.</span>
        </label>
      )}

      <label className="flex items-center gap-3 rounded-2xl bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold">
        <input disabled={disabled} type="checkbox" name="neutered" defaultChecked={defaultValues?.neutered ?? false} className="size-4 accent-[var(--lavender)]" />
        Castrado(a)
      </label>

      <MicrochipFields defaultValues={defaultValues} disabled={disabled} />

      <label id="description" className="block scroll-mt-6 text-sm font-bold">
        Descrição e observações
        <textarea disabled={disabled} name="notes" defaultValue={defaultValues?.notes ?? ""} rows={4} className="field mt-2 resize-none" placeholder="Como ele é, do que gosta, alergias ou algo importante" />
        <span className="mt-1.5 block text-xs font-normal text-[var(--muted)]">Este texto aparece no cartão “Sobre” do perfil.</span>
      </label>

      <label className="block text-sm font-bold">
        Foto
        <input disabled={disabled} type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="field mt-2 text-sm" />
        <span className="mt-1.5 block text-xs font-normal text-[var(--muted)]">JPG, PNG ou WebP, até 5 MB.</span>
      </label>
    </div>
  );
}
