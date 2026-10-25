import Link from "next/link";

/** Top-level switch inside Pets: roster vs family memories (Shell B). */
export function PetsDomainTabs({ active }: { active: "pets" | "memorias" }) {
  return (
    <div data-brand="cuidadim" data-theme="light" className="cd-pet-domain-tabs" role="tablist" aria-label="Pets">
      <Link
        href="/pets"
        role="tab"
        aria-selected={active === "pets"}
        className="cd-pet-domain-tab focus-ring"
        data-active={active === "pets" ? "true" : undefined}
      >
        Pets
      </Link>
      <Link
        href="/memories"
        role="tab"
        aria-selected={active === "memorias"}
        className="cd-pet-domain-tab focus-ring"
        data-active={active === "memorias" ? "true" : undefined}
      >
        Memórias da família
      </Link>
    </div>
  );
}
