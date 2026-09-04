import { sanitizeRoutineIconKey } from "@/lib/routine-icons";
import { ROUTINE_FREQUENCY_OPTIONS } from "@/lib/routine-presets";

const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export function parseRecurrenceFromForm(formData: FormData): { recurrence_days: number | null; error?: string } {
  const mode = value(formData, "frequency_mode");
  const option = ROUTINE_FREQUENCY_OPTIONS.find((item) => item.value === mode);
  if (!option) return { recurrence_days: null, error: "Escolha uma frequência válida." };
  if ("asNeeded" in option && option.asNeeded) return { recurrence_days: null };
  if (option.value === "custom") {
    const raw = Number(value(formData, "custom_recurrence_days"));
    if (!Number.isInteger(raw) || raw <= 0 || raw > 365) {
      return { recurrence_days: null, error: "Informe um intervalo entre 1 e 365 dias." };
    }
    return { recurrence_days: raw };
  }
  if (option.days == null) return { recurrence_days: null, error: "Escolha uma frequência válida." };
  return { recurrence_days: option.days };
}

export function parsePreferredTime(formData: FormData): string | null {
  const raw = value(formData, "preferred_time");
  if (!raw) return null;
  if (!/^\d{2}:\d{2}$/.test(raw)) return null;
  return raw;
}

export function parseStartsOn(formData: FormData): { starts_on: string; error?: string } {
  const raw = value(formData, "starts_on");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { starts_on: "", error: "Informe uma data inicial válida." };
  }
  return { starts_on: raw };
}

export function parseRoutineForm(formData: FormData) {
  const title = value(formData, "title");
  const icon_key = sanitizeRoutineIconKey(value(formData, "icon_key"));
  const instructions = value(formData, "instructions") || null;
  const active = value(formData, "active") !== "0";
  const recurrence = parseRecurrenceFromForm(formData);
  const starts = parseStartsOn(formData);
  const preferred_time = parsePreferredTime(formData);

  if (!title) return { error: "Informe o nome da rotina." } as const;
  if (recurrence.error) return { error: recurrence.error } as const;
  if (starts.error) return { error: starts.error } as const;

  return {
    title,
    icon_key,
    instructions,
    active,
    recurrence_days: recurrence.recurrence_days,
    starts_on: starts.starts_on,
    preferred_time,
  } as const;
}
