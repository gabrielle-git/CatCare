import Link from "next/link";
import { Pencil } from "lucide-react";
import { RoutineCompleteButton } from "@/components/routine-complete-button";
import { RoutineIcon } from "@/components/routine-icon";
import {
  formatNextDueShort,
  formatPreferredTime,
  formatRecurrenceLabel,
  getPetRoutineStatus,
  type PetRoutineStatus,
} from "@/lib/routines-schedule";
import type { CareRoutineCompletion, CareRoutineWithPets } from "@/types/database";

export type RoutineCardModel = {
  routine: CareRoutineWithPets;
  petNames: Map<string, string>;
  completionsByPet: Map<string, CareRoutineCompletion>;
  editable: boolean;
  completeAction?: (formData: FormData) => Promise<void>;
};

function petStatusLine(name: string, status: PetRoutineStatus) {
  const next = formatNextDueShort(status);
  if (status.kind === "as_needed") return `${name} · Quando necessário`;
  if (status.completedToday) return `${name} · ✓ concluído hoje${next ? ` · próxima: ${next}` : ""}`;
  if (status.kind === "overdue" || status.kind === "due_today") return `${name} · pendente${next ? ` · ${next}` : ""}`;
  if (status.kind === "done") return `${name} · em dia${next ? ` · próxima: ${next}` : ""}`;
  return `${name} · ${status.label}${next ? ` · ${next}` : ""}`;
}

export function RoutineCard({ routine, petNames, completionsByPet, editable, completeAction }: RoutineCardModel) {
  const petStatuses = routine.pet_ids.map((petId) => ({
    petId,
    name: petNames.get(petId) ?? "Pet",
    status: getPetRoutineStatus(routine, completionsByPet.get(petId) ?? null),
  }));

  const pendingPets = petStatuses
    .filter(({ status }) => routine.active && status.kind !== "paused" && status.kind !== "as_needed" && !status.completedToday && (status.kind === "overdue" || status.kind === "due_today"))
    .map(({ petId, name }) => ({ id: petId, name, pending: true }));

  const asNeededAvailable = routine.active && routine.recurrence_days == null;

  const completePets =
    pendingPets.length > 0
      ? pendingPets
      : asNeededAvailable
        ? routine.pet_ids.map((petId) => ({ id: petId, name: petNames.get(petId) ?? "Pet", pending: true }))
        : [];

  const timeLabel = formatPreferredTime(routine.preferred_time);

  return (
    <article className="flex items-start gap-3 rounded-[20px] border border-[var(--border)] bg-white p-3.5">
      <span className="grid size-11 shrink-0 place-items-center rounded-[16px] bg-[var(--lavender-soft)] text-[var(--lavender-strong)]">
        <RoutineIcon iconKey={routine.icon_key} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/routines/${routine.id}`} className="focus-ring truncate text-sm font-bold hover:underline">
            {routine.title}
          </Link>
          {!routine.active && (
            <span className="rounded-full bg-[var(--cream)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">
              Pausada
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-[var(--muted)]">
          {routine.pet_ids.map((id) => petNames.get(id) ?? "Pet").join(" + ")}
          {" · "}
          {formatRecurrenceLabel(routine.recurrence_days)}
          {timeLabel ? ` · ${timeLabel}` : ""}
        </p>
        <ul className="mt-2 space-y-1" aria-label="Status por pet">
          {petStatuses.map(({ petId, name, status }) => (
            <li key={petId} className="text-[11px] font-semibold text-[var(--foreground)]">
              {petStatusLine(name, status)}
            </li>
          ))}
        </ul>
        {editable && (
          <div className="mt-2">
            <Link
              href={`/routines/${routine.id}/edit`}
              className="focus-ring inline-flex items-center gap-1 rounded-xl bg-[var(--lavender-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--lavender-strong)]"
            >
              <Pencil size={12} /> Editar
            </Link>
          </div>
        )}
      </div>
      {completeAction && (
        <RoutineCompleteButton
          routineId={routine.id}
          pets={completePets}
          editable={editable}
          completeAction={completeAction}
        />
      )}
    </article>
  );
}

export function RoutineSection({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="text-sm text-[var(--muted)]">{count}</span>
      </div>
      {count === 0 ? (
        <p className="rounded-[20px] border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <div className="space-y-2.5">{children}</div>
      )}
    </section>
  );
}
