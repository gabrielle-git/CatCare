"use client";

import { Heart, icons, type LucideIcon } from "lucide-react";
import { iconMap, isRoutineIconKey, kebabToPascal, type RoutineIconKey } from "@/lib/routine-icons";
import {
  ROUTINE_LUCIDE_CURATED,
  ROUTINE_LUCIDE_SEARCHABLE,
  searchCuratedLucideIcons,
} from "@/lib/routine-lucide-curated";

export { ROUTINE_LUCIDE_CURATED, ROUTINE_LUCIDE_SEARCHABLE, searchCuratedLucideIcons };

export function lucideIconExists(kebab: string) {
  const pascal = kebabToPascal(kebab);
  return pascal in icons;
}

export function resolveLucideComponent(stored: string): LucideIcon {
  if (isRoutineIconKey(stored)) return iconMap[stored as RoutineIconKey];
  const kebab = stored.startsWith("lucide:") ? stored.slice(7) : stored;
  const pascal = kebabToPascal(kebab);
  const dynamic = icons[pascal as keyof typeof icons];
  if (dynamic) return dynamic;
  return Heart;
}
