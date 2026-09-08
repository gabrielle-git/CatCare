import type { RoutineIconKey } from "@/lib/routine-icons";

export type RoutinePreset = {
  id: string;
  title: string;
  icon_key: RoutineIconKey;
  recurrence_days: number | null;
  instructions?: string;
};

/** Atalhos de preenchimento — não viram tipos especiais no banco. */
export const routinePresets: RoutinePreset[] = [
  { id: "dental", title: "Higiene dental", icon_key: "dental", recurrence_days: 1, instructions: "Use escova pequena e pasta veterinária." },
  { id: "brush", title: "Escovação da pelagem", icon_key: "brush", recurrence_days: 2 },
  { id: "nails", title: "Corte de unhas", icon_key: "scissors", recurrence_days: 15 },
  { id: "eyes", title: "Limpeza dos olhos", icon_key: "eye", recurrence_days: 3 },
  { id: "ears", title: "Limpeza das orelhas", icon_key: "ear", recurrence_days: 7 },
  { id: "bath", title: "Banho", icon_key: "bath", recurrence_days: 30 },
  { id: "dry_bath", title: "Banho a seco", icon_key: "bath", recurrence_days: 30 },
  { id: "grooming", title: "Tosa", icon_key: "scissors", recurrence_days: null },
  { id: "hygienic_grooming", title: "Tosa higiênica", icon_key: "scissors", recurrence_days: null },
];

export const ROUTINE_FREQUENCY_OPTIONS = [
  { value: "1", label: "Todos os dias", days: 1 },
  { value: "2", label: "A cada 2 dias", days: 2 },
  { value: "3", label: "A cada 3 dias", days: 3 },
  { value: "7", label: "Toda semana", days: 7 },
  { value: "15", label: "A cada 15 dias", days: 15 },
  { value: "30", label: "A cada 30 dias", days: 30 },
  { value: "custom", label: "Personalizado", days: null },
  { value: "as_needed", label: "Quando necessário", days: null, asNeeded: true },
] as const;
