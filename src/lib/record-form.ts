import type { HealthRecordType, NeonatalRecordType } from "@/types/database";

export const quickRecordTypes = new Set([
  "weight", "feeding", "urine", "stool", "temperature",
  "vaccine", "medication", "consultation", "observation",
]);

export type RecordSource = "weight" | "health" | "neonatal";

const neonatalKinds = new Set<NeonatalRecordType>(["feeding", "weight", "urine", "stool", "temperature", "observation"]);
const healthKinds = new Set<HealthRecordType>(["vaccine", "medication", "consultation", "exam", "disease", "allergy", "surgery", "other"]);

export function resolveRecordSource(kind: string): RecordSource | null {
  if (kind === "weight") return "weight";
  if (neonatalKinds.has(kind as NeonatalRecordType) && kind !== "weight") return "neonatal";
  if (healthKinds.has(kind as HealthRecordType) || kind === "observation") return "health";
  return null;
}

export function recordKindFromHealth(type: HealthRecordType) {
  return type === "other" ? "observation" : type;
}

export function recordKindFromNeonatal(type: NeonatalRecordType) {
  return type;
}

export function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export function numberValue(formData: FormData, name: string) {
  const parsed = Number(value(formData, name).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseLocalDateTime(raw: string, offsetMinutes: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) + offsetMinutes * 60_000).toISOString();
}

export function toLocalDateTimeInput(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
