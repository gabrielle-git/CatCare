import Link from "next/link";
import { Pencil } from "lucide-react";
import { formatFullDate } from "@/lib/format";
import type { Pet } from "@/types/database";

export function PetMicrochipSummary({ pet, editable }: { pet: Pet; editable: boolean }) {
  const summary = pet.has_microchip
    ? pet.microchip_number ?? "Registrado"
    : "Não registrado";

  return (
    <details className="cd-pet-microchip group">
      <summary className="focus-ring cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="cd-meta">Microchip</span>
        <span className="cd-body mt-1 block">{summary}</span>
      </summary>
      <div className="cd-pet-microchip-more">
        {pet.has_microchip ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Número</dt>
              <dd className="mt-1 font-mono text-sm font-bold tracking-wide">{pet.microchip_number}</dd>
            </div>
            {pet.microchip_implanted_at && (
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Implantado em</dt>
                <dd className="mt-1 font-semibold">{formatFullDate(`${pet.microchip_implanted_at}T12:00:00-03:00`)}</dd>
              </div>
            )}
            {pet.microchip_location && (
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Local</dt>
                <dd className="mt-1 font-semibold">{pet.microchip_location}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm leading-relaxed text-[var(--muted)]">Ainda não há microchip registrado para {pet.name}.</p>
        )}
        {editable && (
          <Link href={`/pets/${pet.id}/edit`} className="focus-ring mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--lavender-soft)] px-2.5 py-2 text-[11px] font-bold">
            <Pencil size={13} /> Editar microchip
          </Link>
        )}
      </div>
    </details>
  );
}
