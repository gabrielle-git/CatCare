"use client";

import { useState } from "react";
import {
  IconDespesas,
  IconFamilia,
  IconHome,
  IconMemorias,
  IconPets,
  IconSaude,
  IconSettings,
  IconAgenda,
  IconNeonatal,
  IconPlanoSaude,
} from "@/components/brand/cuidadim/icons/icons";
import { FourPointStar } from "@/components/brand/cuidadim/icons/FourPointStar";
import {
  REGISTER_TREATMENTS,
  SHELL_2B_NOTES,
} from "@/components/brand/cuidadim/product-shell-meta";

const INK_LIGHT = "#2A1F2F";
const INK_DARK = "#FCFAF5";

type LabTheme = "light" | "dark";

function ink(theme: LabTheme) {
  return theme === "dark" ? INK_DARK : INK_LIGHT;
}

function StatusBadge({
  status,
}: {
  status: "APPROVED DIRECTION" | "CANDIDATE" | "MISSING" | "PENDING ASSET" | "ARCHIVED";
}) {
  const key =
    status === "APPROVED DIRECTION"
      ? "APPROVED"
      : status === "CANDIDATE"
        ? "CANDIDATE"
        : status === "MISSING"
          ? "MISSING"
          : status === "PENDING ASSET"
            ? "LEGACY"
            : "AMBIGUOUS";
  return (
    <span className="cd-status" data-status={key}>
      {status}
    </span>
  );
}

function LogoPending({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? "cd-logo-pending cd-logo-pending-compact" : "cd-logo-pending"}>
      <span>{SHELL_2B_NOTES.logo}</span>
    </div>
  );
}

function ContentPlaceholder({ title }: { title: string }) {
  return (
    <div className="cd-shell-content">
      <p className="cd-label">Placeholder</p>
      <h3 className="cd-h2 mt-2 flex items-center gap-2">
        {title}
        {title === "Memórias" ? <FourPointStar size={14} title="Marco especial" /> : null}
      </h3>
      <p className="cd-small mt-2 max-w-md text-[var(--text-secondary)]">{SHELL_2B_NOTES.noHome}</p>
      <div className="mt-6 space-y-2.5">
        <div className="cd-shell-ph-line w-[68%]" />
        <div className="cd-shell-ph-line w-[48%]" />
        <div className="cd-shell-ph-line w-[58%]" />
      </div>
    </div>
  );
}

function MissingIcon({ label }: { label: string }) {
  return (
    <span className="cd-icon-missing" title={`MISSING · ${label}`}>
      —
      <span className="sr-only">MISSING · {label}</span>
    </span>
  );
}

type DestId = "agora" | "pets" | "cuidados" | "memorias";

const PRIMARY: { id: DestId; label: string; Icon: typeof IconHome }[] = [
  { id: "agora", label: "Agora", Icon: IconHome },
  { id: "pets", label: "Pets", Icon: IconPets },
  { id: "cuidados", label: "Cuidados", Icon: IconSaude },
  { id: "memorias", label: "Memórias", Icon: IconMemorias },
];

function titleFor(id: DestId | "casa" | "conta") {
  if (id === "casa") return "Casa / Finanças";
  if (id === "conta") return "Conta e Família";
  return PRIMARY.find((p) => p.id === id)?.label ?? "Agora";
}

/* —— Desktop A · rail compacto · APPROVED —— */
function DesktopA({
  registerStyle,
  theme,
}: {
  registerStyle: "soft" | "line";
  theme: LabTheme;
}) {
  const [active, setActive] = useState<DestId>("agora");
  const [moreOpen, setMoreOpen] = useState(false);
  const [contaOpen, setContaOpen] = useState(false);

  return (
    <div className="cd-frame-desktop cd-frame-desktop-medium" data-brand="cuidadim">
      <div className="cd-med">
        <aside className="cd-med-rail">
          <LogoPending compact />

          <button type="button" className="cd-med-util" title="Assistente · utility label-only">
            <span>Assistente</span>
          </button>

          <nav className="cd-med-nav" aria-label="Primary">
            {PRIMARY.map((item) => (
              <button
                key={item.id}
                type="button"
                className="cd-med-item"
                data-active={active === item.id ? "true" : undefined}
                onClick={() => {
                  setActive(item.id);
                  setMoreOpen(false);
                  setContaOpen(false);
                }}
              >
                <item.Icon size={18} color={ink(theme)} active={active === item.id} />
                <span>{item.label}</span>
                {active === item.id ? (
                  <>
                    <span className="cd-rail-indicator" aria-hidden />
                    <FourPointStar size={6} className="cd-nav-star cd-rail-star" title="selected" />
                  </>
                ) : null}
              </button>
            ))}
            <div className="relative">
              <button
                type="button"
                className="cd-med-item"
                data-active={moreOpen ? "true" : undefined}
                onClick={() => {
                  setMoreOpen((v) => !v);
                  setContaOpen(false);
                }}
              >
                <IconSettings size={18} color={ink(theme)} />
                <span>Mais</span>
              </button>
              {moreOpen ? (
                <div className="cd-med-overflow">
                  <p className="cd-label mb-2">Mais · secondary</p>
                  <button type="button" className="cd-med-overflow-row">
                    <IconDespesas size={16} color={ink(theme)} />
                    <span>
                      Casa / Finanças
                      <em className="cd-naming-hint"> NAMING TO RESOLVE</em>
                    </span>
                  </button>
                  <p className="cd-meta mt-2">Assistente e Conta ficam fora deste overflow.</p>
                </div>
              ) : null}
            </div>
          </nav>

          <div className="cd-med-rail-footer">
            {registerStyle === "soft" ? (
              <button type="button" className="cd-reg-soft cd-reg-rail">
                <span>Registrar</span>
              </button>
            ) : (
              <button type="button" className="cd-reg-line cd-reg-rail">
                <span>Registrar</span>
                <FourPointStar size={9} />
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                className="cd-med-account"
                data-active={contaOpen ? "true" : undefined}
                onClick={() => {
                  setContaOpen((v) => !v);
                  setMoreOpen(false);
                }}
                title="Conta · perfil · preferências"
              >
                <IconFamilia size={15} color={ink(theme)} />
                <span>Conta</span>
              </button>
              {contaOpen ? (
                <div className="cd-med-overflow cd-med-overflow-up">
                  <p className="cd-label mb-2">Conta</p>
                  <button type="button" className="cd-med-overflow-row">
                    Perfil
                  </button>
                  <button type="button" className="cd-med-overflow-row">
                    Preferências
                    <em className="cd-naming-hint"> tema Light/Dark aqui (futuro)</em>
                  </button>
                  <button type="button" className="cd-med-overflow-row">
                    Família
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </aside>
        {active === "cuidados" ? (
          <nav className="cd-med-context">
            <span className="cd-label">Contextual</span>
            {["Saúde", "Agenda", "Neonatal", "Plano"].map((label) => (
              <button key={label} type="button" className="cd-wide-context-chip">
                {label}
              </button>
            ))}
          </nav>
        ) : null}
        <main className="cd-med-main">
          <ContentPlaceholder title={titleFor(active)} />
        </main>
      </div>
    </div>
  );
}

/* —— Mobile A · APPROVED —— */
function MobileA({
  registerStyle,
  theme,
}: {
  registerStyle: "soft" | "line";
  theme: LabTheme;
}) {
  const [active, setActive] = useState<DestId>("agora");
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="cd-frame-mobile" data-brand="cuidadim">
      <div className="cd-mob">
        <header className="cd-mob-header">
          <LogoPending compact />
          <button type="button" className="cd-util-btn" title="Assistente · utility label-only">
            <span className="cd-apg-icon-slot" aria-hidden />
            <span className="sr-only">Assistente</span>
          </button>
        </header>
        <main className="cd-mob-main">
          <ContentPlaceholder title={titleFor(active)} />
        </main>
        <div className="cd-mob-reg-wrap">
          {registerStyle === "soft" ? (
            <button type="button" className="cd-reg-soft cd-reg-full">
              <span>Registrar cuidado</span>
            </button>
          ) : (
            <button type="button" className="cd-reg-line cd-reg-full">
              <span>Registrar cuidado</span>
              <FourPointStar size={12} />
            </button>
          )}
        </div>
        <nav className="cd-mob-dock" aria-label="Primary">
          {PRIMARY.map((item) => (
            <button
              key={item.id}
              type="button"
              className="cd-mob-dock-item"
              data-active={active === item.id ? "true" : undefined}
              onClick={() => {
                setActive(item.id);
                setMoreOpen(false);
              }}
            >
              <span className="cd-mob-dock-icon">
                <item.Icon size={19} color={ink(theme)} active={active === item.id} />
                {active === item.id ? (
                  <FourPointStar size={7} className="cd-nav-star" title="selected" />
                ) : null}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
          <button
            type="button"
            className="cd-mob-dock-item"
            data-active={moreOpen ? "true" : undefined}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <IconSettings size={19} color={ink(theme)} />
            <span>Mais</span>
          </button>
        </nav>
        {moreOpen ? (
          <div className="cd-mob-sheet">
            <p className="cd-label">Mais · secondary</p>
            <button type="button" className="cd-mob-sheet-row">
              <IconDespesas size={17} color={ink(theme)} />
              Casa / Finanças
              <em className="cd-naming-hint"> NAMING TO RESOLVE</em>
            </button>
            <button type="button" className="cd-mob-sheet-row">
              <MissingIcon label="Finanças icon" />
              Finanças
              <em className="cd-naming-hint"> MISSING icon</em>
            </button>
            <button type="button" className="cd-mob-sheet-row">
              <IconFamilia size={17} color={ink(theme)} />
              Conta e Família
            </button>
            <p className="cd-meta mt-2">Assistente: só no header (utility). Tema: preferência futura.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* —— Desktop B · header · ARCHIVED (histórico) —— */
function DesktopBArchived({
  registerStyle,
  theme,
}: {
  registerStyle: "soft" | "line";
  theme: LabTheme;
}) {
  const [active, setActive] = useState<DestId | "casa">("agora");

  return (
    <div className="cd-frame-desktop" data-brand="cuidadim">
      <div className="cd-wide">
        <header className="cd-wide-header">
          <LogoPending />
          <nav className="cd-wide-nav" aria-label="Primary (archived exploration)">
            {PRIMARY.map((item) => (
              <button
                key={item.id}
                type="button"
                className="cd-wide-item"
                data-active={active === item.id ? "true" : undefined}
                onClick={() => setActive(item.id)}
              >
                <item.Icon size={17} color={ink(theme)} active={active === item.id} />
                <span className="cd-nav-label">{item.label}</span>
                {active === item.id ? (
                  <FourPointStar size={8} className="cd-nav-star" title="selected" />
                ) : null}
              </button>
            ))}
            <button
              type="button"
              className="cd-wide-item"
              data-active={active === "casa" ? "true" : undefined}
              onClick={() => setActive("casa")}
            >
              <IconDespesas size={17} color={ink(theme)} active={active === "casa"} />
              <span>
                Casa / Finanças
                <em className="cd-naming-hint"> provisório</em>
              </span>
            </button>
          </nav>
          <div className="cd-wide-right">
            {registerStyle === "soft" ? (
              <button type="button" className="cd-reg-soft">
                <span>Registrar</span>
              </button>
            ) : (
              <button type="button" className="cd-reg-line">
                <span>Registrar</span>
                <FourPointStar size={11} />
              </button>
            )}
            <button type="button" className="cd-util-btn" title="Assistente · utility label-only">
              <span className="cd-apg-icon-slot" aria-hidden />
              <span className="sr-only">Assistente</span>
            </button>
            <button type="button" className="cd-util-btn" title="Conta e Família">
              <IconFamilia size={17} color={ink(theme)} />
            </button>
          </div>
        </header>
        {active === "cuidados" ? (
          <div className="cd-wide-context">
            <span className="cd-label">Contextual</span>
            {[
              { label: "Saúde", Icon: IconSaude },
              { label: "Agenda", Icon: IconAgenda },
              { label: "Neonatal", Icon: IconNeonatal },
              { label: "Plano", Icon: IconPlanoSaude },
              { label: "Rotina", missing: true },
            ].map((c) =>
              "missing" in c && c.missing ? (
                <span key={c.label} className="cd-wide-context-chip cd-wide-context-missing">
                  <MissingIcon label={c.label} />
                  {c.label}
                  <em className="cd-naming-hint"> MISSING</em>
                </span>
              ) : (
                <button key={c.label} type="button" className="cd-wide-context-chip">
                  {"Icon" in c && c.Icon ? <c.Icon size={14} color={ink(theme)} /> : null}
                  {c.label}
                </button>
              ),
            )}
          </div>
        ) : null}
        <main className="cd-wide-main">
          <ContentPlaceholder title={titleFor(active)} />
        </main>
      </div>
    </div>
  );
}

export function ProductShellLab({ theme }: { theme: LabTheme }) {
  const [registerStyle, setRegisterStyle] = useState<"soft" | "line">("soft");

  return (
    <div className="space-y-12">
      <div className="cd-alert cd-alert-accent">
        <strong>Fase 2C.3 · fechamento.</strong> Desktop A + Mobile A ={" "}
        <strong>APPROVED DIRECTION</strong>. Desktop B = histórico. Tema: <strong>{theme}</strong>.
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusBadge status="APPROVED DIRECTION" />
        <StatusBadge status="CANDIDATE" />
        <StatusBadge status="MISSING" />
        <StatusBadge status="PENDING ASSET" />
        <StatusBadge status="ARCHIVED" />
      </div>

      <div className="cd-alert">
        <strong>Logo:</strong> {SHELL_2B_NOTES.logo} — <StatusBadge status="PENDING ASSET" />.{" "}
        <strong>Icons:</strong> {SHELL_2B_NOTES.iconsCandidate}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="cd-label">Registrar cuidado · tratamentos (SPECIAL CASE)</p>
        {REGISTER_TREATMENTS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="cd-chip-v2"
            data-active={
              (t.id === "register-soft" && registerStyle === "soft") ||
              (t.id === "register-line" && registerStyle === "line")
                ? "true"
                : undefined
            }
            onClick={() => setRegisterStyle(t.id === "register-soft" ? "soft" : "line")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="cd-small text-[var(--text-secondary)]">
        {REGISTER_TREATMENTS.find((t) =>
          registerStyle === "soft" ? t.id === "register-soft" : t.id === "register-line",
        )?.note}
      </p>

      {/* —— Official —— */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Desktop A · rail compacto</h3>
          <StatusBadge status="APPROVED DIRECTION" />
        </div>
        <p className="cd-small mt-1 text-[var(--text-secondary)]">{SHELL_2B_NOTES.desktopA}</p>
        <div className="cd-frame-scale-desktop mt-4">
          <DesktopA registerStyle={registerStyle} theme={theme} />
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Mobile A · dock</h3>
          <StatusBadge status="APPROVED DIRECTION" />
        </div>
        <p className="cd-small mt-1 text-[var(--text-secondary)]">
          Agora · Pets · Cuidados · Memórias · Mais. Assistente só no topo.
        </p>
        <div className="mt-4 flex justify-center lg:justify-start">
          <MobileA registerStyle={registerStyle} theme={theme} />
        </div>
      </div>

      {/* —— Archived —— */}
      <div className="cd-archive-block">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Desktop B · header horizontal</h3>
          <StatusBadge status="ARCHIVED" />
        </div>
        <p className="cd-small mt-1 text-[var(--text-secondary)]">
          Exploração histórica — não é a proposta principal. Mantido só para referência.
        </p>
        <div className="cd-frame-scale-desktop mt-4 opacity-80">
          <DesktopBArchived registerStyle={registerStyle} theme={theme} />
        </div>
      </div>

      <div className="cd-surface-xl p-5">
        <p className="cd-label">Ícones · status</p>
        <ul className="cd-small mt-2 space-y-1">
          {SHELL_2B_NOTES.iconsMissing.map((m) => (
            <li key={m}>· MISSING · {m}</li>
          ))}
          <li>· CANDIDATE · família de nav (Home, Pets/Paw, Saúde, Memórias…)</li>
          <li>· PENDING ASSET · logo final oficial</li>
        </ul>
      </div>
    </div>
  );
}
