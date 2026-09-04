import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";
import { formatDateTime } from "@/lib/format";

type Reminder = {
  id: string;
  title: string;
  pet_id: string | null;
  due_at: string;
};

export function HomeAgendaPanel({
  reminders,
  petNames,
}: {
  reminders: Reminder[];
  petNames: Map<string, string>;
}) {
  return (
    <section className="cat-card min-w-0 p-5 md:p-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--mint-soft)] text-[var(--success)]">
          <CalendarClock size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Agenda</p>
          <h2 className="font-bold">Próximos cuidados</h2>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {reminders.length === 0 ? (
          <p className="rounded-[18px] bg-[var(--cream)] p-4 text-sm text-[var(--muted)]">Nada pendente por enquanto.</p>
        ) : (
          reminders.map((reminder) => (
            <div key={reminder.id} className="min-w-0 rounded-[18px] border border-[var(--border)] p-3.5">
              <p className="break-words text-sm font-bold">{reminder.title}</p>
              <p className="mt-1 break-words text-xs text-[var(--muted)]">
                {petNames.get(reminder.pet_id ?? "") ?? "Família"} • {formatDateTime(reminder.due_at)}
              </p>
            </div>
          ))
        )}
      </div>
      <Link
        href="/agenda"
        className="focus-ring mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[var(--mint-soft)] px-4 py-3 text-xs font-bold text-[var(--success)]"
      >
        Abrir agenda <ChevronRight size={15} aria-hidden="true" />
      </Link>
    </section>
  );
}
