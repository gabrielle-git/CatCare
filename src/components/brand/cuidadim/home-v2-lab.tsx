"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  IconAgenda,
  IconDespesas,
  IconFamilia,
  IconVacina,
  IconAlimentacao,
  IconPeso,
} from "@/components/brand/cuidadim/icons/icons";
import { FourPointStar } from "@/components/brand/cuidadim/icons/FourPointStar";
import { PawIcon } from "@/components/brand/cuidadim/icons/PawIcon";
import { FinalLogoImg, FinalNavImg } from "@/components/brand/cuidadim/final-asset-img";
import type { FinalNavId } from "@/components/brand/cuidadim/final-assets";

const INK_LIGHT = "#2A1F2F";
const INK_DARK = "#FCFAF5";

type LabTheme = "light" | "dark";

function inkFor(theme: LabTheme) {
  return theme === "dark" ? INK_DARK : INK_LIGHT;
}

type PetId = "luna" | "theo" | "mimi" | "bob";

const PETS: {
  id: PetId;
  name: string;
  meta: string;
  status: "ok" | "today" | "warn";
  statusLabel: string;
}[] = [
  { id: "luna", name: "Luna", meta: "Gata · 4 anos", status: "ok", statusLabel: "Em dia" },
  { id: "theo", name: "Theo", meta: "Cão · 2 anos", status: "today", statusLabel: "Hoje" },
  { id: "mimi", name: "Mimi", meta: "Gata · 1 ano", status: "ok", statusLabel: "Em dia" },
  { id: "bob", name: "Bob", meta: "Cão · 7 anos", status: "warn", statusLabel: "Atenção" },
];

/** Demo family size for collapse UX — Brand Lab mock only. */
const DEMO_PETS = PETS;

const PRIMARY_NAV: {
  id: FinalNavId;
  label: string;
  active: boolean;
}[] = [
  { id: "agora", label: "Agora", active: true },
  { id: "pets", label: "Pets", active: false },
  { id: "cuidados", label: "Cuidados", active: false },
  { id: "memorias", label: "Memórias", active: false },
];

function MissingIcon({ label }: { label: string }) {
  return (
    <span className="cd-icon-missing" title={`MISSING · ${label}`}>
      —
      <span className="sr-only">MISSING · {label}</span>
    </span>
  );
}

function MaisSheet({ onClose, ink }: { onClose?: () => void; ink: string }) {
  return (
    <div className="cd-mais-sheet" role="dialog" aria-label="Mais">
      <div className="cd-mais-sheet-head">
        <p className="cd-label">Mais</p>
        {onClose ? (
          <button type="button" className="cd-btn-v2-tertiary" onClick={onClose}>
            Fechar
          </button>
        ) : null}
      </div>
      <button type="button" className="cd-mob-sheet-row">
        <IconDespesas size={17} color={ink} />
        <span>
          Casa / Finanças
          <em className="cd-naming-hint"> NAMING TO RESOLVE</em>
        </span>
      </button>
      <button type="button" className="cd-mob-sheet-row">
        <IconFamilia size={17} color={ink} />
        Conta e Família
      </button>
      <p className="cd-meta mt-2">Assistente não entra aqui — utility própria.</p>
    </div>
  );
}

/* —— Content —— */

function EditorialHeader({ compact }: { compact?: boolean }) {
  return (
    <header className={compact ? "cd-home-editorial cd-home-editorial-compact" : "cd-home-editorial"}>
      <div className="cd-home-editorial-text">
        <p className="cd-label">Domingo · 20 set</p>
        <h2 className="cd-home-greeting">Boa tarde, família.</h2>
        <p className="cd-home-lede">
          {compact
            ? "Um cuidado pede atenção hoje."
            : "Dois pets em foco. Um cuidado pede atenção hoje — o resto segue em ritmo calmo."}
        </p>
      </div>
    </header>
  );
}

function AgoraSection({
  petName,
  compact,
  ink,
}: {
  petName: string;
  compact?: boolean;
  ink: string;
}) {
  return (
    <section className="cd-home-section" aria-labelledby="home-agora">
      <div className="cd-home-section-head">
        <h3 id="home-agora" className="cd-home-section-title">
          Agora
          <FourPointStar size={11} title="atenção imediata" />
        </h3>
        <span className="cd-chip-v2" data-active="true">
          1 atenção
        </span>
      </div>
      <ul className="cd-home-list">
        <li className="cd-home-list-item cd-home-list-item-priority">
          <span className="cd-home-list-icon">
            <IconVacina size={18} color={ink} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="cd-home-list-title">Vermífugo · {petName}</p>
            <p className="cd-meta">Dose de hoje · até 21h</p>
          </div>
          <span className="cd-status-chip" data-tone="today">
            Hoje
          </span>
        </li>
        <li className="cd-home-list-item">
          <span className="cd-home-list-icon">
            <IconAlimentacao size={18} color={ink} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="cd-home-list-title">Jantar · Theo</p>
            <p className="cd-meta">Rotina · porção da noite</p>
          </div>
          <span className="cd-status-chip" data-tone="ok">
            Em dia
          </span>
        </li>
        {!compact ? (
          <li className="cd-home-list-item">
            <span className="cd-home-list-icon">
              <MissingIcon label="Rotina" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="cd-home-list-title">Passeio curto</p>
              <p className="cd-meta">
                Rotina · <em className="cd-naming-hint">MISSING icon</em>
              </p>
            </div>
            <span className="cd-chip-v2">Neutro</span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function PetRowButton({
  pet,
  active,
  onSelect,
  ink,
}: {
  pet: (typeof DEMO_PETS)[number];
  active: boolean;
  onSelect: (id: PetId) => void;
  ink: string;
}) {
  return (
    <button
      type="button"
      className="cd-pet-row cd-pet-row-interactive cd-home-pet-chip"
      data-active={active ? "true" : undefined}
      onClick={() => onSelect(pet.id)}
    >
      <span className="cd-avatar-v2">
        <PawIcon size={16} color={ink} />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-semibold">{pet.name}</p>
        <p className="cd-meta">{pet.meta}</p>
      </div>
      <span className="cd-status-chip" data-tone={pet.status}>
        {pet.statusLabel}
      </span>
      {active ? (
        <FourPointStar size={6} className="cd-pet-star-beside" title="selected" />
      ) : null}
    </button>
  );
}

function PetContext({
  active,
  onSelect,
  collapsedDefault,
  forceExpanded,
  ink,
}: {
  active: PetId;
  onSelect: (id: PetId) => void;
  collapsedDefault: boolean;
  forceExpanded?: boolean;
  ink: string;
}) {
  const [expanded, setExpanded] = useState(!collapsedDefault || Boolean(forceExpanded));
  const activePet = DEMO_PETS.find((p) => p.id === active) ?? DEMO_PETS[0];
  const count = DEMO_PETS.length;
  const showList = forceExpanded || expanded;

  return (
    <section className="cd-home-section" aria-labelledby="home-pets">
      <button
        type="button"
        className="cd-home-pets-toggle"
        aria-expanded={showList}
        onClick={() => {
          if (forceExpanded) return;
          setExpanded((v) => !v);
        }}
      >
        <h3 id="home-pets" className="cd-home-section-title">
          Pets
          {count > 1 ? <span className="cd-home-pets-count">· {count}</span> : null}
        </h3>
        {!forceExpanded ? (
          <ChevronDown
            size={16}
            strokeWidth={1.75}
            className={showList ? "cd-home-pets-chevron cd-home-pets-chevron-open" : "cd-home-pets-chevron"}
            aria-hidden
          />
        ) : (
          <span className="cd-meta">expandido</span>
        )}
      </button>

      <div
        className={
          showList
            ? "cd-home-pet-stack cd-home-pet-stack-open"
            : "cd-home-pet-stack cd-home-pet-stack-collapsed"
        }
      >
        {showList ? (
          DEMO_PETS.map((pet) => (
            <PetRowButton
              key={pet.id}
              pet={pet}
              active={active === pet.id}
              onSelect={onSelect}
              ink={ink}
            />
          ))
        ) : (
          <PetRowButton pet={activePet} active onSelect={onSelect} ink={ink} />
        )}
      </div>
    </section>
  );
}

function ProximosSection({ ink }: { compact?: boolean; ink: string }) {
  return (
    <section className="cd-home-section" aria-labelledby="home-proximos">
      <div className="cd-home-section-head">
        <h3 id="home-proximos" className="cd-home-section-title">
          Próximos
        </h3>
        <span className="cd-meta">horizonte</span>
      </div>
      <div className="cd-home-timeline">
        <div className="cd-home-timeline-group">
          <p className="cd-label">Amanhã</p>
          <div className="cd-home-timeline-row">
            <IconAgenda size={16} color={ink} />
            <span className="cd-home-timeline-copy">Consulta · Luna · 10h30</span>
            <span className="cd-badge-v2 cd-badge-v2-apoio">Apoio</span>
          </div>
        </div>
        <div className="cd-home-timeline-group">
          <p className="cd-label">Esta semana</p>
          <div className="cd-home-timeline-row">
            <IconPeso size={16} color={ink} />
            <span className="cd-home-timeline-copy">Pesar Theo · qui</span>
            <span className="cd-chip-v2">Neutro</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function RecenteMemoriaSection({ compact }: { compact?: boolean }) {
  return (
    <section className="cd-home-section cd-home-recente" aria-labelledby="home-recente">
      <div className="cd-home-section-head">
        <h3 id="home-recente" className="cd-home-section-title">
          Recente
        </h3>
        <button type="button" className="cd-btn-v2-tertiary">
          Histórico
        </button>
      </div>
      <div className={compact ? "cd-home-recente-body cd-home-recente-body-compact" : "cd-home-recente-body"}>
        <ul className="cd-home-activity">
          <li>
            <span className="cd-meta">ontem</span>
            <span className="cd-home-activity-copy">Peso · Theo · 8,2 kg</span>
          </li>
          {!compact ? (
            <li>
              <span className="cd-meta">sex</span>
              <span className="cd-home-activity-copy">Banho · Luna</span>
            </li>
          ) : null}
        </ul>
        <figure className="cd-home-memory">
          <div className="cd-home-memory-deferred" aria-hidden>
            <span className="cd-meta">DEFERRED</span>
            <span className="cd-small">Memórias illustration</span>
          </div>
          <figcaption>
            <p className="cd-label flex items-center gap-1.5">
              Memória
              <FourPointStar size={9} />
            </p>
            <p className="cd-home-memory-title">Primeiro solzinho do Theo</p>
            <p className="cd-meta">há 3 dias · no final asset</p>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function RestanteSection() {
  return (
    <section className="cd-home-section cd-home-restante" aria-labelledby="home-restante">
      <h3 id="home-restante" className="cd-label">
        Também nesta casa
      </h3>
      <div className="cd-home-restante-links">
        <button type="button" className="cd-btn-v2-tertiary">
          Casa / Finanças
          <em className="cd-naming-hint"> provisório</em>
        </button>
        <button type="button" className="cd-btn-v2-tertiary">
          Conta e Família
        </button>
      </div>
    </section>
  );
}

function HomeMain({
  activePet,
  onSelectPet,
  variant,
  petsForceExpanded,
  theme,
}: {
  activePet: PetId;
  onSelectPet: (id: PetId) => void;
  variant: "desktop" | "mobile";
  petsForceExpanded?: boolean;
  theme: LabTheme;
}) {
  const petName = DEMO_PETS.find((p) => p.id === activePet)?.name ?? "Luna";
  const compact = variant === "mobile";
  const ink = inkFor(theme);

  return (
    <div className={compact ? "cd-home cd-home-mobile" : "cd-home cd-home-desktop"}>
      <EditorialHeader compact={compact} />
      <AgoraSection petName={petName} compact={compact} ink={ink} />
      <PetContext
        active={activePet}
        onSelect={onSelectPet}
        collapsedDefault={compact}
        forceExpanded={petsForceExpanded}
        ink={ink}
      />
      <ProximosSection compact={compact} ink={ink} />
      <RecenteMemoriaSection compact={compact} />
      <RestanteSection />
    </div>
  );
}

/* —— Shells —— */

function DesktopHomeA({
  theme = "light",
  maisOpenDefault = false,
}: {
  theme?: LabTheme;
  maisOpenDefault?: boolean;
}) {
  const [activePet, setActivePet] = useState<PetId>("luna");
  const [moreOpen, setMoreOpen] = useState(maisOpenDefault);
  const ink = inkFor(theme);

  return (
    <div className="cd-frame-desktop" data-brand="cuidadim" data-theme={theme}>
      <div className="cd-med">
        <aside className="cd-med-rail">
          <FinalLogoImg theme={theme} compact />
          <button type="button" className="cd-med-util" title="Assistente · APPROVED ASSET">
            <FinalNavImg id="assistente" theme={theme} size={16} />
            <span>Assistente</span>
          </button>
          <nav className="cd-med-nav" aria-label="Primary">
            {PRIMARY_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className="cd-med-item"
                data-active={item.active ? "true" : undefined}
              >
                <FinalNavImg id={item.id} theme={theme} size={18} />
                <span>{item.label}</span>
                {item.active ? (
                  <>
                    <span className="cd-rail-indicator" aria-hidden />
                    <FourPointStar size={6} className="cd-nav-star cd-rail-star" title="selected" />
                  </>
                ) : null}
              </button>
            ))}
          </nav>
          <div className="cd-med-rail-footer">
            <button type="button" className="cd-reg-soft cd-reg-rail">
              <span>Registrar</span>
            </button>
            <div className="relative">
              <button
                type="button"
                className="cd-med-mais"
                data-active={moreOpen ? "true" : undefined}
                onClick={() => setMoreOpen((v) => !v)}
                title="Mais · overflow"
              >
                <span>Mais</span>
                <ChevronDown
                  size={12}
                  strokeWidth={1.75}
                  className={moreOpen ? "cd-home-pets-chevron-open" : undefined}
                />
              </button>
              {moreOpen ? (
                <div className="cd-med-overflow cd-med-overflow-up">
                  <p className="cd-label mb-2">Mais</p>
                  <button type="button" className="cd-med-overflow-row">
                    <IconDespesas size={16} color={ink} />
                    <span>
                      Casa / Finanças
                      <em className="cd-naming-hint"> NAMING TO RESOLVE</em>
                    </span>
                  </button>
                  <button type="button" className="cd-med-overflow-row">
                    <IconFamilia size={16} color={ink} />
                    Conta e Família
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </aside>
        <main className="cd-med-main">
          <HomeMain
            activePet={activePet}
            onSelectPet={setActivePet}
            variant="desktop"
            theme={theme}
          />
        </main>
      </div>
    </div>
  );
}

function MobileHomeA({
  theme = "light",
  petsExpanded = false,
  maisOpenDefault = false,
}: {
  theme?: LabTheme;
  petsExpanded?: boolean;
  maisOpenDefault?: boolean;
}) {
  const [activePet, setActivePet] = useState<PetId>("luna");
  const [moreOpen, setMoreOpen] = useState(maisOpenDefault);
  const ink = inkFor(theme);

  return (
    <div className="cd-frame-mobile" data-brand="cuidadim" data-theme={theme}>
      <div className="cd-mob">
        <header className="cd-mob-header">
          <FinalLogoImg theme={theme} compact />
          <button
            type="button"
            className="cd-util-btn"
            title="Assistente · APPROVED ASSET"
            aria-label="Assistente"
          >
            <FinalNavImg id="assistente" theme={theme} size={20} />
          </button>
        </header>
        <main className="cd-mob-main">
          <HomeMain
            activePet={activePet}
            onSelectPet={setActivePet}
            variant="mobile"
            petsForceExpanded={petsExpanded || undefined}
            theme={theme}
          />
        </main>

        <div className="cd-mob-action-strip">
          {theme === "dark" ? (
            <button type="button" className="cd-reg-line cd-reg-full">
              <span>Registrar cuidado</span>
              <FourPointStar size={11} />
            </button>
          ) : (
            <button type="button" className="cd-reg-soft cd-reg-full">
              <span>Registrar cuidado</span>
            </button>
          )}
          <button
            type="button"
            className="cd-mob-mais-link"
            data-active={moreOpen ? "true" : undefined}
            onClick={() => setMoreOpen((v) => !v)}
          >
            Mais
            <ChevronDown
              size={13}
              strokeWidth={1.75}
              className={moreOpen ? "cd-home-pets-chevron-open" : undefined}
            />
          </button>
          {moreOpen ? (
            <div className="cd-mob-mais-sheet" role="dialog" aria-label="Mais">
              <MaisSheet onClose={() => setMoreOpen(false)} ink={ink} />
            </div>
          ) : null}
        </div>

        <nav className="cd-mob-dock cd-mob-dock-4" aria-label="Primary">
          {PRIMARY_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className="cd-mob-dock-item"
              data-active={item.active ? "true" : undefined}
            >
              <span className="cd-mob-dock-icon">
                <FinalNavImg id={item.id} theme={theme} size={19} />
                {item.active ? (
                  <FourPointStar size={7} className="cd-nav-star" title="selected" />
                ) : null}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

/**
 * Fase 3C — Home V2 com assets finais (Brand Lab only).
 * Light + Dark APPROVED. Arquitetura preservada. Produto real intacto.
 */
export function HomeV2Lab() {
  return (
    <div className="space-y-16">
      <div className="cd-alert cd-alert-accent">
        <strong>03 · Home V2 · Freeze V1.</strong> Assets finais. Light + Dark. Arquitetura e Cozy
        Celestial intactos. Memórias illustration = DEFERRED. Não é a Home real.
      </div>

      <ul className="cd-small space-y-1 text-[var(--text-secondary)]">
        <li>· Arquitetura: Editorial → Agora → Pets → Próximos → Recente/Memória → Restante</li>
        <li>· Dock 4 · Mais = short sheet mobile / overflow desktop</li>
        <li>· Selected pet B: estrela fora do chip · ~5px de respiro · APPROVED</li>
        <li>· Wave 1 nav + Assistente = APPROVED ASSET (fonte: assets finais)</li>
      </ul>

      {/* —— Selected B locked —— */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Pet selected · B</h3>
          <span className="cd-status" data-status="APPROVED">
            APPROVED DIRECTION
          </span>
        </div>
        <p className="cd-small mt-1 max-w-xl text-[var(--text-secondary)]">
          Estrela fora do chip · associada ao status · ~4–6px de respiro · sem tocar chip/borda.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="cd-surface-xl p-4" data-brand="cuidadim" data-theme="light">
            <p className="cd-label">Light</p>
            <div className="mt-3 max-w-sm space-y-1">
              <PetRowButton
                pet={DEMO_PETS[0]}
                active
                onSelect={() => undefined}
                ink={INK_LIGHT}
              />
              <PetRowButton
                pet={DEMO_PETS[1]}
                active={false}
                onSelect={() => undefined}
                ink={INK_LIGHT}
              />
            </div>
          </div>
          <div className="cd-surface-xl p-4" data-brand="cuidadim" data-theme="dark">
            <p className="cd-label">Dark</p>
            <div className="mt-3 max-w-sm space-y-1">
              <PetRowButton
                pet={DEMO_PETS[0]}
                active
                onSelect={() => undefined}
                ink={INK_DARK}
              />
              <PetRowButton
                pet={DEMO_PETS[1]}
                active={false}
                onSelect={() => undefined}
                ink={INK_DARK}
              />
            </div>
          </div>
        </div>
      </div>

      {/* —— Light —— */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Light · Desktop</h3>
          <span className="cd-status" data-status="APPROVED">
            APPROVED DIRECTION
          </span>
        </div>
        <div className="cd-frame-scale-desktop mt-4">
          <DesktopHomeA theme="light" maisOpenDefault />
        </div>
      </div>

      <div>
        <h3 className="cd-h3">Light · Mobile · Pets collapsed</h3>
        <div className="mt-4 flex justify-center lg:justify-start">
          <MobileHomeA theme="light" />
        </div>
      </div>

      <div>
        <h3 className="cd-h3">Light · Mobile · Pets expanded</h3>
        <div className="mt-4 flex justify-center lg:justify-start">
          <MobileHomeA theme="light" petsExpanded />
        </div>
      </div>

      {/* —— Dark —— */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Dark · Desktop</h3>
          <span className="cd-status" data-status="APPROVED">
            APPROVED DIRECTION
          </span>
        </div>
        <p className="cd-small mt-1 text-[var(--text-secondary)]">
          Contraste secundário refinado · Mais overflow compacto.
        </p>
        <div className="cd-frame-scale-desktop mt-4">
          <DesktopHomeA theme="dark" maisOpenDefault />
        </div>
      </div>

      <div>
        <h3 className="cd-h3">Dark · Mobile · Pets collapsed</h3>
        <p className="cd-small mt-1 text-[var(--text-secondary)]">
          Registrar = Line + gold mote
        </p>
        <div className="mt-4 flex justify-center lg:justify-start">
          <MobileHomeA theme="dark" />
        </div>
      </div>

      <div>
        <h3 className="cd-h3">Dark · Mobile · Pets expanded</h3>
        <div className="mt-4 flex justify-center lg:justify-start">
          <MobileHomeA theme="dark" petsExpanded />
        </div>
      </div>

      <div>
        <h3 className="cd-h3">Dark · Mobile · Mais aberto</h3>
        <p className="cd-small mt-1 text-[var(--text-secondary)]">
          Short sheet da action strip · não popover flutuante
        </p>
        <div className="mt-4 flex justify-center lg:justify-start">
          <MobileHomeA theme="dark" maisOpenDefault />
        </div>
      </div>
    </div>
  );
}
