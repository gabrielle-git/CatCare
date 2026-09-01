import { Cat } from "lucide-react";

export function HomeFamilyStats({
  petCount,
  timelineCount,
  reminderCount,
}: {
  petCount: number;
  timelineCount: number;
  reminderCount: number;
}) {
  return (
    <section className="min-w-0 rounded-[24px] bg-[var(--cream)] p-5">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Cat size={17} aria-hidden="true" /> Visão da família
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <strong className="block text-2xl">{petCount}</strong>
          <span className="text-[10px] text-[var(--muted)]">pets</span>
        </div>
        <div>
          <strong className="block text-2xl">{timelineCount}</strong>
          <span className="text-[10px] text-[var(--muted)]">recentes</span>
        </div>
        <div>
          <strong className="block text-2xl">{reminderCount}</strong>
          <span className="text-[10px] text-[var(--muted)]">pendentes</span>
        </div>
      </div>
    </section>
  );
}
