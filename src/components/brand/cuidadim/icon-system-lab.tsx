"use client";

import {
  ICON_INVENTORY,
  ICON_INVENTORY_NOTES,
  NAV_ICON_BRIEFING,
  ROLE_LABELS,
  entriesBrand,
  entriesByWave,
  entriesNeutralOk,
  entriesUiStates,
  entriesWave1Custom,
  type IconInventoryEntry,
  type IconInventoryStatus,
  type IconRole,
} from "@/components/brand/cuidadim/icon-system-inventory";

function StatusBadge({ status }: { status: IconInventoryStatus }) {
  const key =
    status === "APPROVED" ||
    status === "APPROVED ASSET" ||
    status === "APPROVED BRAND ASSET" ||
    status === "APPROVED MOTIF ASSET" ||
    status === "APPROVED MOTIF" ||
    status === "APPROVED BEHAVIOR" ||
    status === "ALTERNATE ASSET"
      ? "APPROVED"
      : status === "CANDIDATE" || status === "TO DESIGN"
        ? "CANDIDATE"
        : status === "MISSING" ||
            status === "PENDING ASSET" ||
            status === "LEGACY" ||
            status === "MISSING FROM FINAL FOLDER" ||
            status === "DEFERRED — NO FINAL ASSET PROVIDED"
          ? status === "PENDING ASSET" ||
            status === "MISSING FROM FINAL FOLDER" ||
            status === "DEFERRED — NO FINAL ASSET PROVIDED"
            ? "MISSING"
            : status
          : "AMBIGUOUS";
  return (
    <span className="cd-status" data-status={key}>
      {status}
    </span>
  );
}

function SimpleList({
  title,
  lead,
  items,
}: {
  title: string;
  lead?: string;
  items: { name: string; status: IconInventoryStatus; note?: string }[];
}) {
  return (
    <div className="cd-surface-xl p-4">
      <p className="cd-label">{title}</p>
      {lead ? <p className="cd-meta mt-1">{lead}</p> : null}
      <ul className="cd-small mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.name} className="flex flex-wrap items-baseline gap-2">
            <span className="font-semibold text-[var(--text-primary)]">{i.name}</span>
            <StatusBadge status={i.status} />
            {i.note ? <span className="cd-meta w-full">{i.note}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InventoryTable({ rows }: { rows: IconInventoryEntry[] }) {
  if (rows.length === 0) {
    return <p className="cd-meta mt-2">Nenhum item neste grupo.</p>;
  }
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse text-left text-xs">
        <thead>
          <tr className="text-[var(--text-secondary)]">
            <th className="px-2 py-2 font-bold">Nome</th>
            <th className="px-2 py-2 font-bold">Onde</th>
            <th className="px-2 py-2 font-bold">Atual</th>
            <th className="px-2 py-2 font-bold">Status</th>
            <th className="px-2 py-2 font-bold">Wave</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-[var(--border)] align-top">
              <td className="px-2 py-2">
                <p className="font-semibold text-[var(--text-primary)]">{row.name}</p>
                {row.notes ? <p className="cd-meta mt-0.5 max-w-[16rem]">{row.notes}</p> : null}
              </td>
              <td className="px-2 py-2 text-[var(--text-secondary)] max-w-[12rem]">{row.where}</td>
              <td className="px-2 py-2 text-[var(--text-secondary)]">
                {row.currentIcon ?? "—"}
              </td>
              <td className="px-2 py-2">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-2 py-2">{row.wave ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Fase 3C — Icon System: Wave 1 APPROVED ASSET.
 * Wave 2/3 bloqueadas. Sem desenhar novos.
 */
export function IconSystemLab() {
  const brand = entriesBrand();
  const wave1 = entriesWave1Custom();
  const neutrals = entriesNeutralOk();
  const states = entriesUiStates();
  const roles = Object.keys(ROLE_LABELS) as IconRole[];

  return (
    <div className="space-y-12">
      <div className="cd-alert cd-alert-accent">
        <strong>04 · Icon System · 3C.</strong> Wave 1 ={" "}
        <strong>APPROVED ASSET</strong> (fonte: assets finais). Pawmark = APPROVED BRAND ASSET.
        Wave 2/3 bloqueadas.
      </div>

      <p className="cd-small max-w-2xl text-[var(--text-secondary)]">{ICON_INVENTORY_NOTES.principle}</p>
      <p className="cd-small max-w-2xl text-[var(--text-secondary)]">{ICON_INVENTORY_NOTES.approved}</p>
      <p className="cd-small max-w-2xl text-[var(--text-secondary)]">{ICON_INVENTORY_NOTES.pawSplit}</p>
      <p className="cd-small max-w-2xl text-[var(--text-secondary)]">{ICON_INVENTORY_NOTES.waveLock}</p>

      {/* 1. Brand */}
      <div>
        <h3 className="cd-h3">Brand · fora da Wave de ícones</h3>
        <div className="mt-4">
          <SimpleList
            title="Brand"
            lead="Logo / motif / app mark — não são navigation glyphs."
            items={brand.map((b) => ({
              name: b.name,
              status: b.status,
              note: b.notes,
            }))}
          />
        </div>
      </div>

      {/* 2. Custom Wave 1 */}
      <div>
        <h3 className="cd-h3">Custom Wave 1 · 5 glifos</h3>
        <p className="cd-small mt-1 text-[var(--text-secondary)]">
          Integrados no Brand Lab a partir de <code>assets finais</code>. Status: APPROVED ASSET.
        </p>
        <div className="mt-4">
          <SimpleList
            title="Navigation + Assistente"
            items={wave1.map((i) => ({
              name: i.name,
              status: i.status,
              note: i.notes,
            }))}
          />
        </div>
      </div>

      {/* Briefing — historical */}
      <div>
        <h3 className="cd-h3">Briefing histórico · navigation icons</h3>
        <p className="cd-meta mt-1">Referência de produção anterior — Wave 1 já entregue.</p>
        <div className="cd-surface-lg mt-4 space-y-2 p-4">
          <p className="cd-small">· {NAV_ICON_BRIEFING.master}</p>
          <p className="cd-small">· {NAV_ICON_BRIEFING.opticalSizes}</p>
          <p className="cd-small">· {NAV_ICON_BRIEFING.color}</p>
          <p className="cd-small">· {NAV_ICON_BRIEFING.geometry}</p>
          <p className="cd-small">· {NAV_ICON_BRIEFING.constraints}</p>
          <p className="cd-small font-semibold text-[var(--text-primary)]">
            · {NAV_ICON_BRIEFING.identity}
          </p>
        </div>
      </div>

      {/* 3. Neutral utilities */}
      <div>
        <h3 className="cd-h3">Neutral utilities</h3>
        <p className="cd-small mt-1 text-[var(--text-secondary)]">
          Glifos simples e consistentes. Não carregam identidade autoral forte. Fora da família
          custom Wave 1.
        </p>
        <ul className="cd-small mt-3 columns-1 gap-x-8 space-y-1 sm:columns-2">
          {neutrals.map((i) => (
            <li key={i.id} className="break-inside-avoid">
              · {i.name}
            </li>
          ))}
        </ul>
      </div>

      {/* 4. States */}
      <div>
        <h3 className="cd-h3">States · não são glifos novos</h3>
        <div className="mt-4">
          <SimpleList
            title="Selected · Especial / Marco"
            lead="Reutilizam a estrela Cozy Celestial. Sem ícone 'Selected' nem 'Especial'."
            items={states.map((s) => ({
              name: s.name,
              status: s.status,
              note: s.notes,
            }))}
          />
        </div>
      </div>

      {/* Waves 2/3 locked */}
      <div>
        <h3 className="cd-h3">Wave 2 / Wave 3 · bloqueadas</h3>
        <p className="cd-small mt-1 text-[var(--text-secondary)]">
          CONTINUAM BLOQUEADAS. Não criar Finanças, Rotinas, Viagens, Agenda, Plano, Vacina,
          Medicação, etc. agora.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="cd-surface-lg p-4">
            <p className="cd-label">Wave 2 · bloqueada</p>
            <ul className="cd-small mt-2 max-h-48 space-y-1 overflow-y-auto">
              {entriesByWave(2).map((i) => (
                <li key={i.id}>· {i.name}</li>
              ))}
            </ul>
          </div>
          <div className="cd-surface-lg p-4">
            <p className="cd-label">Wave 3 · bloqueada</p>
            <ul className="cd-small mt-2 max-h-48 space-y-1 overflow-y-auto">
              {entriesByWave(3).map((i) => (
                <li key={i.id}>· {i.name}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Full inventory reference */}
      <div>
        <h3 className="cd-h3">Inventário completo · referência</h3>
        <p className="cd-small mt-1 text-[var(--text-secondary)]">
          Total: {ICON_INVENTORY.length} entradas.
        </p>
        <div className="mt-6 space-y-10">
          {roles.map((role) => {
            const rows = ICON_INVENTORY.filter((e) => e.role === role);
            return (
              <div key={role}>
                <p className="cd-label">{ROLE_LABELS[role]}</p>
                <InventoryTable rows={rows} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="cd-alert">
        <strong>Próximo (produto real):</strong> fora desta fase. Brand Lab only.{" "}
        {ICON_INVENTORY_NOTES.noDraw}
      </div>
    </div>
  );
}
