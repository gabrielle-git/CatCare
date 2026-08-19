import { APP_TIMEZONE } from "@/lib/format";
import type { HealthRecordType, NeonatalRecordType } from "@/types/database";

export const quickRecordTypes = new Set([
  "weight", "feeding", "urine", "stool", "temperature",
  "vaccine", "deworming", "medication", "consultation", "observation",
]);

export type RecordSource = "weight" | "health" | "neonatal";

const neonatalKinds = new Set<NeonatalRecordType>(["feeding", "weight", "urine", "stool", "temperature", "observation"]);
const healthKinds = new Set<HealthRecordType>(["vaccine", "deworming", "medication", "consultation", "exam", "disease", "allergy", "surgery", "other"]);

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

export function parseLocalDateTime(raw: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toLocalDateTimeInput(iso: string) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export const neonatalCareTypes = new Set(["feeding", "urine", "stool", "temperature"]);

export function isNeonatalCareType(type: string) {
  return neonatalCareTypes.has(type);
}

export function safeReturnPath(raw: string | null | undefined, fallback: string) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

export function redirectPathWithParam(path: string, key: string, value: string) {
  const safe = safeReturnPath(path, "/");
  const url = new URL(safe, "http://local");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}
