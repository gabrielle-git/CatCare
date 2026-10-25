"use client";

import "@/styles/cuidadim-architecture-v2.css";
import { useState } from "react";
import { ChevronDown, Plus, Wallet } from "lucide-react";
import { FinalLogoImg, FinalNavImg } from "@/components/brand/cuidadim/final-asset-img";
import { FourPointStar } from "@/components/brand/cuidadim/icons/FourPointStar";
import { IconFamilia } from "@/components/brand/cuidadim/icons/icons";
import { type Go, type ProtoView, type ShellId } from "@/components/brand/cuidadim/architecture-v2-data";
import { Flag, type FlagKind } from "@/components/brand/cuidadim/architecture-v2-register";
import { PetPageVersionContext, ProtoScreen, type PetPageVersion } from "@/components/brand/cuidadim/architecture-v2-screens";

/** Rail logo candidate after Gaby's review: 64 small · 70 balanced · 78 large. */
const LOGO_WIDTH = 70;

/* —— Top-level shells —— */

type NavKey = "agora" | "pets" | "cuidados" | "memorias" | "registrar" | "financas" | "mais";

type NavItem = { key: NavKey; label: string; view: ProtoView };

const SHELL_NAV: Record<ShellId, NavItem[]> = {
  A: [
    { key: "agora", label: "Agora", view: { area: "agora" } },
    { key: "pets", label: "Pets", view: { area: "pets" } },
    { key: "cuidados", label: "Cuidados", view: { area: "cuidados", tab: "overview" } },
    { key: "memorias", label: "Memórias", view: { area: "memorias" } },
  ],
  B: [
    { key: "agora", label: "Início", view: { area: "agora" } },
    { key: "pets", label: "Pets", view: { area: "pets" } },
    { key: "registrar", label: "Registrar", view: { area: "registrar" } },
    { key: "cuidados", label: "Cuidados", view: { area: "cuidados", tab: "overview" } },
    { key: "financas", label: "Finanças", view: { area: "financas", tab: "resumo" } },
  ],
};

function navKeyOf(view: ProtoView, shell: ShellId): NavKey | null {
  switch (view.area) {
    case "assistente":
      return null;
    case "memorias":
      return shell === "A" ? "memorias" : "pets";
    case "financas":
      return shell === "A" ? "mais" : "financas";
    case "mais":
      return shell === "A" ? "mais" : null;
    default:
      return view.area;
  }
}

function NavIcon({ id, size }: { id: NavKey; size: number }) {
  if (id === "registrar") {
    return (
      <span className="cd-arch-nav-action" aria-hidden>
        <Plus size={size - 4} strokeWidth={2} />
      </span>
    );
  }
  if (id === "financas") return <Wallet size={size} strokeWidth={1.6} aria-hidden />;
  if (id === "mais") return <ChevronDown size={size} strokeWidth={1.6} aria-hidden />;
  return <FinalNavImg id={id} theme="light" size={size} />;
}

type FrameProps = {
  shell: ShellId;
  view: ProtoView;
  go: Go;
  neonatal: boolean;
  onEnableNeonatal: () => void;
};

function ShellTag({ shell }: { shell: ShellId }) {
  return (
    <span className="cd-arch-shell-tag" data-shell={shell}>
      {shell === "A" ? "EXPLORATION A — PREVIOUS" : "EXPLORATION B — SELECTED BY HUMAN REVIEW"}
    </span>
  );
}

function DesktopProto(props: FrameProps) {
  const { shell, view, go } = props;
  const active = navKeyOf(view, shell);
  return (
    <div className="cd-arch-frame-scroll">
      <div className="cd-arch-frame-desktop" data-brand="cuidadim" data-theme="light">
        <div className="cd-med cd-arch-med" data-shell={shell}>
          <aside className="cd-med-rail">
            <button type="button" className="cd-arch-rail-logo" style={{ width: LOGO_WIDTH }} onClick={() => go({ area: "agora" })} aria-label="Cuidadim">
              <FinalLogoImg theme="light" className="cd-arch-rail-logo-img" />
            </button>
            <button type="button" className="cd-med-util" data-active={view.area === "assistente" ? "true" : undefined} onClick={() => go({ area: "assistente" })}>
              <FinalNavImg id="assistente" theme="light" size={16} />
              <span>Assistente</span>
            </button>
            <nav className="cd-med-nav" aria-label={`Navegação principal · exploration ${shell}`}>
              {SHELL_NAV[shell].map((item) => {
                const on = active === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className="cd-med-item"
                    data-nav={item.key}
                    data-active={on ? "true" : undefined}
                    aria-current={on ? "page" : undefined}
                    onClick={() => go(item.view)}
                  >
                    <NavIcon id={item.key} size={18} />
                    <span>{item.label}</span>
                    {on ? (
                      <>
                        <span className="cd-rail-indicator" aria-hidden />
                        <FourPointStar size={6} className="cd-nav-star cd-rail-star" />
                      </>
                    ) : null}
                  </button>
                );
              })}
            </nav>
            <div className="cd-med-rail-footer">
              {shell === "A" ? (
                <>
                  <button
                    type="button"
                    className="cd-reg-soft cd-reg-rail"
                    data-active={active === "registrar" ? "true" : undefined}
                    onClick={() => go({ area: "registrar" })}
                  >
                    <span>Registrar</span>
                    {active === "registrar" ? <FourPointStar size={8} /> : null}
                  </button>
                  <button
                    type="button"
                    className="cd-med-mais"
                    data-active={active === "mais" ? "true" : undefined}
                    onClick={() => go({ area: "mais" })}
                  >
                    <span>Mais</span>
                    <ChevronDown size={12} strokeWidth={1.75} />
                  </button>
                </>
              ) : null}
              <button type="button" className="cd-med-account" title="Conta · fora desta exploração">
                <IconFamilia size={15} />
                <span>Conta</span>
              </button>
            </div>
          </aside>
          <main className="cd-med-main cd-arch-main" data-variant="desktop">
            <ProtoScreen {...props} variant="desktop" />
          </main>
        </div>
      </div>
    </div>
  );
}

function MobileProto(props: FrameProps) {
  const { shell, view, go } = props;
  const active = navKeyOf(view, shell);
  const items = SHELL_NAV[shell];
  return (
    <div className="cd-frame-mobile cd-arch-frame-mobile" data-brand="cuidadim" data-theme="light">
      <div className="cd-mob">
        <header className="cd-mob-header">
          <button type="button" className="cd-arch-mob-logo" onClick={() => go({ area: "agora" })} aria-label="Cuidadim">
            <FinalLogoImg theme="light" compact />
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="cd-util-btn"
              aria-label="Assistente"
              data-active={view.area === "assistente" ? "true" : undefined}
              onClick={() => go({ area: "assistente" })}
            >
              <FinalNavImg id="assistente" theme="light" size={20} />
            </button>
            {shell === "B" ? (
              <button type="button" className="cd-util-btn" aria-label="Conta" title="Conta · fora desta exploração">
                <IconFamilia size={17} />
              </button>
            ) : null}
          </div>
        </header>
        <main className="cd-mob-main cd-arch-main" data-variant="mobile">
          <ProtoScreen {...props} variant="mobile" />
        </main>
        {shell === "A" ? (
          <div className="cd-mob-action-strip">
            <button
              type="button"
              className="cd-reg-soft cd-reg-full"
              data-active={active === "registrar" ? "true" : undefined}
              onClick={() => go({ area: "registrar" })}
            >
              <span>Registrar cuidado</span>
              {active === "registrar" ? <FourPointStar size={11} /> : null}
            </button>
            <button
              type="button"
              className="cd-mob-mais-link"
              data-active={active === "mais" ? "true" : undefined}
              onClick={() => go({ area: "mais" })}
            >
              Mais
              <ChevronDown size={13} strokeWidth={1.75} />
            </button>
          </div>
        ) : null}
        <nav className={shell === "A" ? "cd-mob-dock cd-mob-dock-4" : "cd-mob-dock cd-arch-dock-b"} aria-label={`Navegação principal · exploration ${shell}`}>
          {items.map((item) => {
            const on = active === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className="cd-mob-dock-item"
                data-nav={item.key}
                data-active={on ? "true" : undefined}
                aria-current={on ? "page" : undefined}
                onClick={() => go(item.view)}
              >
                <span className="cd-mob-dock-icon">
                  <NavIcon id={item.key} size={19} />
                  {on ? <FourPointStar size={7} className="cd-nav-star" /> : null}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/* —— Lab content —— */

type MapItem = { label: string; view: ProtoView; neonatal?: boolean };

const MAP: { group: string; items: MapItem[] }[] = [
  {
    group: "Navegação B",
    items: [
      { label: "Início", view: { area: "agora" } },
      { label: "Pets", view: { area: "pets" } },
      { label: "Registrar", view: { area: "registrar" } },
      { label: "Cuidados", view: { area: "cuidados", tab: "overview" } },
      { label: "Finanças", view: { area: "financas", tab: "resumo" } },
    ],
  },
  {
    group: "Cuidados",
    items: [
      { label: "Saúde", view: { area: "cuidados", tab: "saude" } },
      { label: "Saúde › Consultas", view: { area: "cuidados", tab: "saude", saudeCat: "consultas" } },
      { label: "Alimentação e higiene", view: { area: "cuidados", tab: "alimhig" } },
      { label: "Agenda", view: { area: "cuidados", tab: "agenda" } },
      { label: "Rotinas", view: { area: "cuidados", tab: "rotinas" } },
      { label: "Histórico", view: { area: "cuidados", tab: "historico" } },
      { label: "Neonatal", view: { area: "cuidados", tab: "neonatal" }, neonatal: true },
    ],
  },
  {
    group: "Registrar cuidado",
    items: [
      { label: "Consulta · 1 cuidado", view: { area: "registrar", types: ["consulta"], pets: ["dobby"] } },
      {
        label: "Consulta + Vacina + Medicamento · 2 pets",
        view: { area: "registrar", types: ["consulta", "vacina", "medicamento"], pets: ["dobby", "anya"] },
      },
      { label: "Xixi + Cocô · filhote", view: { area: "registrar", types: ["xixi", "coco"], pets: ["pingo"] }, neonatal: true },
      { label: "Peso · 2 pets", view: { area: "registrar", types: ["peso"], pets: ["dobby", "anya"] } },
      { label: "Alimentação · 2 pets", view: { area: "registrar", types: ["alimentacao"], pets: ["anya", "gwen"] } },
      { label: "Higiene", view: { area: "registrar", types: ["higiene"], pets: ["hinata"] } },
    ],
  },
  {
    group: "Pets · Memórias · Finanças",
    items: [
      { label: "Dobby · Visão geral", view: { area: "pets", petId: "dobby" } },
      { label: "Dobby · Saúde", view: { area: "pets", petId: "dobby", sub: "saude" } },
      { label: "Dobby · Histórico", view: { area: "pets", petId: "dobby", sub: "historico" } },
      { label: "Dobby · Perfil", view: { area: "pets", petId: "dobby", sub: "perfil" } },
      { label: "Gwen · Visão geral", view: { area: "pets", petId: "gwen" } },
      { label: "Gwen · Perfil", view: { area: "pets", petId: "gwen", sub: "perfil" } },
      { label: "Hinata · Perfil", view: { area: "pets", petId: "hinata", sub: "perfil" } },
      { label: "Pingo · Visão geral", view: { area: "pets", petId: "pingo" }, neonatal: true },
      { label: "Pets › Memórias", view: { area: "memorias" } },
      { label: "Dobby · Memórias", view: { area: "memorias", petId: "dobby" } },
      { label: "Finanças › Planos", view: { area: "financas", tab: "planos" } },
    ],
  },
];

function viewKey(view: ProtoView) {
  switch (view.area) {
    case "cuidados":
      return `c:${view.tab}:${view.saudeCat ?? ""}`;
    case "registrar":
      return `r:${(view.types ?? []).join(".")}:${(view.pets ?? []).join(".")}`;
    case "pets":
      return `p:${view.petId ?? ""}:${view.sub ?? ""}`;
    case "financas":
      return `f:${view.tab}`;
    case "memorias":
      return `m:${view.petId ?? ""}`;
    default:
      return view.area;
  }
}

const QUESTIONS = [
  "A. Registro, Rotina e Agenda ficaram distinguíveis só pelo desenho?",
  "B. “Alimentação e higiene” resolve a confusão com Rotinas?",
  "C. A página do pet ficou leve no mobile, com os dados cadastrais em Perfil?",
  "D. O dock de 5 com Registrar no centro funciona no mobile?",
  "E. Memórias dentro de Pets fica fácil de achar?",
];

const CONTRACT = [
  { kind: "Registro", text: "algo que aconteceu", where: "Saúde · Alimentação e higiene · Histórico · Neonatal" },
  { kind: "Rotina", text: "algo planejado para se repetir", where: "Rotinas" },
  { kind: "Agenda", text: "compromissos e lembretes temporais", where: "Agenda · atrasados, hoje, amanhã, próximos" },
];

const MARKERS: { kind: FlagKind; label: string; meaning: string }[] = [
  { kind: "future", label: "FUTURE NAVIGATION", meaning: "Pet → Saúde → categoria → registro específico. Hoje o registro só abre em Editar." },
  { kind: "future", label: "FUTURE AGGREGATION", meaning: "Protocolo, rotinas, plano ou neonatal alimentando a Agenda: requer lógica nova." },
  { kind: "future", label: "NEW FEATURE", meaning: "Finanças › Resumo." },
  { kind: "logic", label: "REQUIRES FILTERING LOGIC", meaning: "Memórias recortadas por pet." },
  { kind: "logic", label: "FUNCTIONAL CONTRACT PENDING", meaning: "Documentos e arquivos seguem a arquitetura funcional." },
  { kind: "insight", label: "STATUS / INSIGHT", meaning: "Prevenção derivada do protocolo preventivo, não categoria." },
];

const FUTURE_MODEL = [
  "Consulta: diagnóstico e profissional como campos próprios.",
  "Medicamento: dose como campo próprio.",
  "Rotinas com categoria.",
  "Detalhe de registro (hoje só existe Editar).",
];

const LAB_NOTES = [
  "“Alimentação e higiene” é organização de interface: não vira enum, tabela ou domínio de backend.",
  "Perfil do pet possui contexto próprio de histórico.",
  "Histórico da família não tem filtro por pet; o agrupamento por dia é evolução visual.",
  "Temperatura existe no Registrar neonatal, sem card ou resumo próprio.",
  "Início mostra só a posição na navegação; o conteúdo é a Home V2 (seção 03).",
];

const CATCARE_ISSUES = [
  "Higiene com vários cuidados pode falhar ao salvar.",
  "Multi-tipo com título em branco pode herdar o título da vacina.",
  "Idade neonatal não é checada na edição.",
  "Lembrete que repete não gera a próxima ocorrência.",
  "Agenda depende do fuso horário do servidor.",
  "Chip “Outro” do Histórico não retorna resultados.",
  "Histórico neonatal do pet não mostra alimentação nem peso novo.",
  "Agenda ignora o feedback de ?updated / ?deleted.",
];

const PRESERVATION_CONTRACT = [
  "Existing CatCare behavior is authoritative.",
  "Visual redesign must not remove existing capabilities.",
  "Multi-type + multi-pet is mandatory.",
  "Existing backend/data decisions remain intact unless explicitly revised by Gaby.",
  "File/document behavior follows the functional architecture.",
  "Any mismatch must be solved in UI first, not by deleting product behavior.",
];

const TOP_LEVEL_COMPARE: { criterion: string; a: string; b: string }[] = [
  { criterion: "Dock", a: "Agora · Pets · Cuidados · Memórias", b: "Início · Pets · Registrar · Cuidados · Finanças" },
  { criterion: "Ação", a: "Registrar separado do dock", b: "Registrar no centro do dock" },
  { criterion: "Memórias", a: "Destino próprio", b: "Dentro de Pets (família e por pet)" },
  { criterion: "Finanças", a: "Mais › Finanças", b: "Destino próprio: Resumo, Gastos, Compras, Planos" },
];

/* —— Logo (1:1) —— */

const LOGO_VARIANTS: { width: number; label: string; note: string; verdict: string; chosen?: boolean }[] = [
  { width: 64, label: "64px", note: "64 × 11,5 px", verdict: "Gaby: pequeno demais" },
  { width: 70, label: "70px · candidato", note: "70 × 12,5 px", verdict: "Gaby: melhor equilíbrio", chosen: true },
  { width: 78, label: "78px", note: "78 × 14 px", verdict: "Gaby: grande demais" },
];

function LogoExploration() {
  return (
    <div className="cd-arch-logo-board" data-brand="cuidadim" data-theme="light">
      {LOGO_VARIANTS.map((v) => (
        <figure key={v.width} className="cd-arch-logo-case" data-chosen={v.chosen ? "true" : undefined}>
          <div className="cd-arch-logo-rail">
            <span className="cd-arch-logo-slot" style={{ width: v.width }}>
              <FinalLogoImg theme="light" className="cd-arch-rail-logo-img" />
            </span>
            <span className="cd-med-util">
              <FinalNavImg id="assistente" theme="light" size={16} />
              <span>Assistente</span>
            </span>
            <span className="cd-med-item" data-active="true">
              <FinalNavImg id="agora" theme="light" size={18} />
              <span>Agora</span>
              <span className="cd-rail-indicator" aria-hidden />
              <FourPointStar size={6} className="cd-nav-star cd-rail-star" />
            </span>
          </div>
          <figcaption>
            <span className="cd-status" data-status={v.chosen ? "CANDIDATE" : "LEGACY"}>
              {v.chosen ? "CANDIDATE" : "DESCARTADO"}
            </span>
            <p className="text-xs font-bold">{v.label}</p>
            <p className="cd-meta">{v.note}</p>
            <p className="cd-meta">{v.verdict}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/* —— Pet page · before / after —— */

const PET_COMPARE: { version: PetPageVersion; label: string }[] = [
  { version: "before", label: "BEFORE — M0.1V PET PAGE" },
  { version: "after", label: "AFTER — M0.1V.1 PET PAGE" },
];

function PetPageCompare() {
  const [views, setViews] = useState<Record<PetPageVersion, ProtoView>>({
    before: { area: "pets", petId: "dobby" },
    after: { area: "pets", petId: "dobby" },
  });
  const frame = (version: PetPageVersion) => ({
    shell: "B" as const,
    view: views[version],
    go: (view: ProtoView) => setViews((v) => ({ ...v, [version]: view })),
    neonatal: false,
    onEnableNeonatal: () => undefined,
  });
  return (
    <div className="cd-arch-petcmp">
      {(["mobile", "desktop"] as const).map((device) => (
        <div key={device} className="cd-arch-petcmp-row" data-device={device}>
          {PET_COMPARE.map(({ version, label }) => (
            <PetPageVersionContext.Provider key={version} value={version}>
              <div className="cd-arch-petcmp-col">
                <span className="cd-arch-petcmp-tag" data-version={version}>
                  {label} · {device === "mobile" ? "MOBILE" : "DESKTOP"}
                </span>
                <div className="cd-arch-petcmp-frame" data-device={device}>
                  {device === "mobile" ? <MobileProto {...frame(version)} /> : <DesktopProto {...frame(version)} />}
                </div>
              </div>
            </PetPageVersionContext.Provider>
          ))}
        </div>
      ))}
    </div>
  );
}

/* —— Section —— */

export function ArchitectureV2Lab() {
  const [view, setView] = useState<ProtoView>({ area: "cuidados", tab: "overview" });
  const [neonatal, setNeonatal] = useState(false);
  const [previousView, setPreviousView] = useState<ProtoView>({ area: "cuidados", tab: "overview" });

  const shared = { view, go: setView, neonatal, onEnableNeonatal: () => setNeonatal(true) };
  const previous = { view: previousView, go: setPreviousView, neonatal: false, onEnableNeonatal: () => undefined };
  const currentKey = viewKey(view);

  return (
    <div className="space-y-12">
      <div className="cd-arch-status-banner">
        <span className="cd-status" data-status="CANDIDATE">
          M0.1V — FINAL VISUAL CANDIDATE
        </span>
        <p className="text-sm font-semibold">
          Arquitetura visual consolidada após auditoria funcional e revisão humana. Ainda não implementada no produto real.
        </p>
        <p className="cd-meta">Estado local do lab · sem rotas, banco ou formulários reais. App real e shell real intactos.</p>
      </div>

      <div className="cd-arch-decision">
        <span className="cd-arch-decision-tag">DECISION — HUMAN REVIEW</span>
        <p className="text-sm font-semibold">Exploration B selected.</p>
        <p className="cd-meta">Início · Pets · Registrar · Cuidados · Finanças. Memórias continua existindo, dentro de Pets.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="cd-surface-lg p-4">
          <p className="cd-label">Registro · Rotina · Agenda</p>
          <ul className="cd-arch-contract mt-3">
            {CONTRACT.map((c) => (
              <li key={c.kind}>
                <span className="cd-arch-contract-kind" data-kind={c.kind.toLowerCase()}>
                  {c.kind}
                </span>
                <span className="text-sm font-semibold">= {c.text}</span>
                <span className="cd-meta">{c.where}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="cd-surface-xl p-4">
          <p className="cd-label">Perguntas para a Gaby</p>
          <ul className="cd-small mt-3 space-y-1.5 text-[var(--text-secondary)]">
            {QUESTIONS.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
        <div className="cd-surface-lg p-4">
          <p className="cd-label">Marcadores no protótipo</p>
          <ul className="cd-arch-marker-list mt-3">
            {MARKERS.map((m) => (
              <li key={m.label}>
                <Flag kind={m.kind}>{m.label}</Flag>
                <span className="cd-meta">{m.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="cd-surface-lg space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="cd-label">Cenário neonatal</p>
            <div className="cd-arch-seg mt-2" role="group" aria-label="Cenário neonatal">
              <button type="button" aria-pressed={!neonatal} onClick={() => setNeonatal(false)}>
                Sem filhote
              </button>
              <button type="button" aria-pressed={neonatal} onClick={() => setNeonatal(true)}>
                Com filhotes (15 dias)
              </button>
            </div>
          </div>
          <p className="cd-meta max-w-md">Desktop e mobile andam juntos. Logo do rail fixo em {LOGO_WIDTH}px.</p>
        </div>
        <div>
          <p className="cd-label">Mapa · clique para ir direto</p>
          <div className="cd-arch-map mt-3">
            {MAP.map((g) => (
              <div key={g.group} className="cd-arch-map-group">
                <p className="text-xs font-bold">{g.group}</p>
                <div className="cd-arch-map-items">
                  {g.items.map((item) => {
                    const active = viewKey(item.view) === currentKey;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        className="cd-chip-v2 cd-arch-chip-btn"
                        data-active={active ? "true" : undefined}
                        aria-pressed={active}
                        onClick={() => {
                          if (item.neonatal) setNeonatal(true);
                          setView(item.view);
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Shell B · desktop</h3>
          <ShellTag shell="B" />
        </div>
        <DesktopProto shell="B" {...shared} />
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Shell B · mobile</h3>
          <ShellTag shell="B" />
        </div>
        <div className="cd-arch-mobile-single">
          <MobileProto shell="B" {...shared} />
          <div className="cd-arch-mobile-notes">
            <p className="cd-label">Composição do dock</p>
            <ul className="cd-small space-y-1.5 text-[var(--text-secondary)]">
              <li>5 destinos com o mesmo peso de leitura.</li>
              <li>Registrar no centro, como ação: círculo cheio, sem competir com o destaque ativo.</li>
              <li>Destaque ativo: texto forte, sublinhado e estrela dourada.</li>
              <li>Conta e Assistente no header.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Página do pet · before × after</h3>
          <span className="cd-status" data-status="CANDIDATE">
            M0.1V.1 · PARA AVALIAÇÃO
          </span>
        </div>
        <p className="cd-small max-w-2xl text-[var(--text-secondary)]">
          Mesmas informações, nova hierarquia: header leve, Visão geral com o que importa agora, dados cadastrais na aba Perfil. Comparação
          temporária, só para a revisão. Os dois lados são clicáveis.
        </p>
        <PetPageCompare />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="cd-surface-lg p-4">
          <p className="cd-label">Hierarquia M0.1V</p>
          <ul className="cd-arch-tree mt-3">
            <li>
              <strong>Início</strong> · Home V2 (seção 03)
            </li>
            <li>
              <strong>Pets</strong> · lista leve: foto, nome, espécie, fase e idade
              <ul>
                <li>Pet · Visão geral · Saúde · Histórico · Memórias · Perfil</li>
                <li>Memórias da família · dentro de Pets</li>
              </ul>
            </li>
            <li>
              <strong>Registrar</strong> · cuidado(s) → pet(s) → campos → salvar todos
              <ul>
                <li>Multi-tipo + multi-pet na mesma operação</li>
                <li>Por pet só onde existe hoje: peso, quantidade de alimentação, observação e anexos</li>
              </ul>
            </li>
            <li>
              <strong>Cuidados</strong>
              <ul>
                <li>Visão geral</li>
                <li>Saúde · consultas, vacinas, medicamentos, vermífugos, exames, peso · prevenção como status · plano por pet</li>
                <li>Alimentação e higiene · registros</li>
                <li>Agenda · compromissos e lembretes temporais</li>
                <li>Rotinas · planos recorrentes por status</li>
                <li>Histórico · busca, tipo, 7 · 30 · 90 · personalizado</li>
                <li>Neonatal · contextual</li>
              </ul>
            </li>
            <li>
              <strong>Finanças</strong> · Resumo (novo), Gastos, Compras, Planos
            </li>
          </ul>
        </div>
        <div className="cd-surface-lg space-y-4 p-4">
          <div>
            <p className="cd-label">Registrar · CatCare atual × M0.1V</p>
            <div className="cd-arch-compare mt-3" role="table" aria-label="Ordem do Registrar">
              <div className="cd-arch-compare-row cd-arch-compare-head" role="row">
                <span role="columnheader" />
                <span role="columnheader">CatCare atual</span>
                <span role="columnheader">M0.1V</span>
              </div>
              {[
                { s: "1", a: "Quais pets?", b: "Cuidado(s) · + Adicionar outro cuidado" },
                { s: "2", a: "O que aconteceu? (vários tipos)", b: "Pet(s), no próprio formulário" },
                { s: "3", a: "Campos por tipo + quando + observação", b: "Um bloco por cuidado + quando + observação" },
                { s: "4", a: "Salvar N registros", b: "Resumo pets × cuidados · salvar todos" },
              ].map((r) => (
                <div key={r.s} className="cd-arch-compare-row" role="row">
                  <span role="rowheader" className="font-semibold">
                    Passo {r.s}
                  </span>
                  <span role="cell">{r.a}</span>
                  <span role="cell">{r.b}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="cd-arch-future">
            <Flag kind="future">FUTURE / NOT CURRENT — DATA MODEL</Flag>
            <ul className="cd-arch-future-list">
              {FUTURE_MODEL.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <details className="cd-arch-tech">
        <summary>
          <span className="cd-label">Previous exploration · A × B</span>
          <span className="cd-meta">Registro da decisão · B selecionada pela revisão humana</span>
        </summary>
        <div className="mt-4 space-y-4">
          <div className="cd-arch-compare" role="table" aria-label="Comparação A × B">
            <div className="cd-arch-compare-row cd-arch-compare-head" role="row">
              <span role="columnheader" />
              <span role="columnheader">A · previous</span>
              <span role="columnheader">B · selected by human review</span>
            </div>
            {TOP_LEVEL_COMPARE.map((r) => (
              <div key={r.criterion} className="cd-arch-compare-row" role="row">
                <span role="rowheader" className="font-semibold">
                  {r.criterion}
                </span>
                <span role="cell">{r.a}</span>
                <span role="cell">{r.b}</span>
              </div>
            ))}
          </div>
          <div className="cd-arch-previous">
            {(["A", "B"] as const).map((shell) => (
              <div key={shell} className="cd-arch-previous-item">
                <ShellTag shell={shell} />
                <div className="cd-arch-previous-frame">
                  <MobileProto shell={shell} {...previous} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </details>

      <details className="cd-arch-tech">
        <summary>
          <span className="cd-label">Notas internas do lab</span>
          <span className="cd-meta">Não é texto de interface</span>
        </summary>
        <div className="mt-4 space-y-3">
          <ul className="cd-small space-y-1.5 text-[var(--text-secondary)]">
            {LAB_NOTES.map((n) => (
              <li key={n}>· {n}</li>
            ))}
          </ul>
          <p className="cd-arch-flag-note" data-kind="logic">
            <Flag kind="logic">FILE/DOCUMENT UX MUST FOLLOW FUNCTIONAL ARCHITECTURE.</Flag>
            <span>Visual adapts after functional contract is supplied.</span>
          </p>
        </div>
      </details>

      <details className="cd-arch-tech">
        <summary>
          <span className="cd-label">CURRENT CATCARE ISSUES FOUND DURING M0.1 AUDIT</span>
          <span className="cd-meta">Backlog técnico · separado das decisões visuais · nada corrigido</span>
        </summary>
        <div className="mt-4 space-y-3">
          <p className="cd-arch-flag-note" data-kind="issue">
            <Flag kind="issue">CURRENT CATCARE ISSUE — multi-care hygiene save requires remediation</Flag>
          </p>
          <ol className="cd-arch-issues">
            {CATCARE_ISSUES.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ol>
        </div>
      </details>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Logo do rail · 1:1</h3>
          <span className="cd-status" data-status="CANDIDATE">
            CANDIDATE · {LOGO_WIDTH}px
          </span>
        </div>
        <p className="cd-small mt-1 max-w-2xl text-[var(--text-secondary)]">
          Avaliação da Gaby: 64px pequeno demais, 70px melhor equilíbrio, 78px grande demais. Fixado em 70px nos protótipos acima. Shell real
          inalterado.
        </p>
        <div className="mt-4">
          <LogoExploration />
        </div>
      </div>

      <section className="cd-arch-preservation" aria-label="Functional preservation contract">
        <p className="cd-label">FUNCTIONAL PRESERVATION CONTRACT</p>
        <ul>
          {PRESERVATION_CONTRACT.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="cd-meta">Documentação interna do lab.</p>
      </section>
    </div>
  );
}
