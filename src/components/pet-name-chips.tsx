export function formatPetNames(petIds: string[], names: Map<string, string>, emptyLabel = "Família") {
  if (petIds.length === 0) return emptyLabel;
  const labels = petIds.map((id) => names.get(id)).filter(Boolean) as string[];
  return labels.length > 0 ? labels.join(", ") : emptyLabel;
}

export function PetNameChips({ petIds, names, emptyLabel = "Família" }: { petIds: string[]; names: Map<string, string>; emptyLabel?: string }) {
  const labels = petIds.map((id) => names.get(id)).filter(Boolean) as string[];
  if (labels.length === 0) return <span className="rounded-full bg-[var(--cream)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted)]">{emptyLabel}</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {labels.map((name) => (
        <span key={name} className="rounded-full bg-[var(--cream)] px-2 py-0.5 text-[10px] font-bold">{name}</span>
      ))}
    </span>
  );
}
