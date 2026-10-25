"use client";

import { ProductArchitectureLab } from "@/components/brand/cuidadim/product-architecture-lab";
import { ProductShellLab } from "@/components/brand/cuidadim/product-shell-lab";
import { UiPrimitivesLab } from "@/components/brand/cuidadim/ui-primitives-lab";
import { HomeV2Lab } from "@/components/brand/cuidadim/home-v2-lab";
import { IconSystemLab } from "@/components/brand/cuidadim/icon-system-lab";
import { AssetProductionGuide } from "@/components/brand/cuidadim/asset-production-guide";
import { VisualFreezeLab } from "@/components/brand/cuidadim/visual-freeze-lab";
import { ArchitectureV2Lab } from "@/components/brand/cuidadim/architecture-v2-lab";
import { CUIDADIM_PICTOGRAMS } from "@/components/brand/cuidadim/pictogram-assets";
import { CUIDADIM_STATIC_ICONS } from "@/components/brand/cuidadim/icon-assets";
import {
  CUIDADIM_LOGO_COMPARE,
} from "@/components/brand/cuidadim/logo-assets";
import {
  FINAL_BRAND,
  FINAL_ESTRELA,
  FINAL_NAV_ICONS,
  FINAL_PICTOGRAMS_NOTE,
  VISUAL_FREEZE_V1,
} from "@/components/brand/cuidadim/final-assets";
import {
  IconAgenda,
  IconDespesas,
  IconHome,
  IconMemorias,
  IconPets,
  IconSaude,
  IconSettings,
} from "@/components/brand/cuidadim/icons/icons";
import { PawIcon } from "@/components/brand/cuidadim/icons/PawIcon";
import { PawmarkIcon } from "@/components/brand/cuidadim/icons/PawmarkIcon";
import { Cat, Home as LucideHome, ImageIcon as LucideImages } from "lucide-react";
import { useState } from "react";

type ThemeMode = "light" | "dark";

const ICON_SET = [
  { label: "Home", Icon: IconHome },
  { label: "Pets", Icon: IconPets },
  { label: "Memórias", Icon: IconMemorias },
  { label: "Saúde", Icon: IconSaude },
  { label: "Agenda", Icon: IconAgenda },
  { label: "Gastos", Icon: IconDespesas },
  { label: "Mais", Icon: IconSettings },
] as const;

const ICON_SIZES = [20, 24, 32, 48] as const;

const CORE_SWATCHES = [
  { name: "Purple", hex: "#2A1F2F", token: "--cuidadim-purple" },
  { name: "Gold", hex: "#CCA863", token: "--cuidadim-gold" },
  { name: "Rosa", hex: "#DAACBA", token: "--cuidadim-rosa" },
  { name: "Rosa Light", hex: "#F0DBE1", token: "--cuidadim-rosa-light" },
  { name: "Creme", hex: "#FCFAF5", token: "--cuidadim-creme" },
  { name: "Grafite", hex: "#6B586E", token: "--cuidadim-grafite" },
] as const;

function Status({ status }: { status: string }) {
  const key =
    status === "APPROVED" ||
    status === "APPROVED ASSET" ||
    status === "APPROVED PICTOGRAM" ||
    status === "APPROVED BRAND ASSET" ||
    status === "APPROVED MOTIF ASSET" ||
    status === "ALTERNATE ASSET"
      ? "APPROVED"
      : status === "CANDIDATE" || status === "AMBIGUOUS"
        ? "CANDIDATE"
        : status === "DEFERRED" ||
            status === "DEFERRED — NO FINAL ASSET PROVIDED" ||
            status === "MISSING" ||
            status === "MISSING FROM FINAL FOLDER" ||
            status === "LEGACY"
          ? "MISSING"
          : "MISSING";
  return (
    <span className="cd-status" data-status={key}>
      {status === "DEFERRED" ? "DEFERRED — NO FINAL ASSET PROVIDED" : status}
    </span>
  );
}

function Section({
  id,
  kicker,
  title,
  lead,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <p className="cd-label">{kicker}</p>
      <h2 className="cd-h2 mt-2">{title}</h2>
      {lead ? <p className="cd-small mt-2 max-w-[40rem]">{lead}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function BrandLab() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const iconColor = theme === "dark" ? "#FCFAF5" : "#2A1F2F";

  return (
    <div data-brand="cuidadim" data-theme={theme} className="cd-shell">
      <div className="mx-auto w-full min-w-0 max-w-[1200px] px-4 py-8 sm:px-6 md:px-10 md:py-12">
        <header className="flex min-w-0 flex-col gap-5 border-b border-[var(--border)] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="cd-label">Brand Lab · Fase 3D · {VISUAL_FREEZE_V1.id}</p>
            <h1 className="cd-display-xl mt-3">Cozy Celestial, delicado</h1>
            <p className="cd-body mt-3 max-w-[36rem] text-[var(--text-secondary)]">
              Visual Freeze V1. Wave 1 + logos + Home V2 congelados no Brand Lab. Produto real
              intacto.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div
              className="inline-flex rounded-[var(--cd-radius-md)] border border-[var(--border)] bg-[var(--surface)] p-1"
              role="group"
              aria-label="Tema do Brand Lab"
            >
              {(["light", "dark"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTheme(mode)}
                  className="rounded-[10px] px-3.5 py-2 text-xs font-bold capitalize"
                  style={
                    theme === mode
                      ? { background: "var(--primary)", color: "var(--primary-fg)" }
                      : { color: "var(--text-secondary)" }
                  }
                  aria-pressed={theme === mode}
                >
                  {mode}
                </button>
              ))}
            </div>
            <p className="cd-meta max-w-[14rem] text-right">
              Toggle afeta 01–02. Home V2 tem frames Light e Dark próprios.
            </p>
            <a href="#architecture-v2" className="cd-btn-v2-secondary">
              Ir para 07 · Architecture V2
            </a>
          </div>
        </header>

        <div className="mt-10 space-y-16">
          <Section
            id="visual-freeze"
            kicker="3D · Visual Freeze V1"
            title="CUIDADIM — VISUAL FREEZE V1"
            lead="Registro do freeze. Escopo aprovado desta rodada. Sem implementação no produto real."
          >
            <VisualFreezeLab />
          </Section>

          {/* 0. Product Architecture — approved */}
          <Section
            id="product-architecture"
            kicker="00 · Product Architecture"
            title="Organização do produto"
            lead="Aprovada. Domínios conceituais — não são automaticamente itens de nav."
          >
            <ProductArchitectureLab />
          </Section>

          {/* 1. Product Shell — Fase 2C · inherits lab theme */}
          <Section
            id="product-shell"
            kicker="01 · Product Shell"
            title="Shell adaptativo"
            lead="Desktop A (rail) + Mobile A = APPROVED DIRECTION. Desktop B arquivado. Light/Dark."
          >
            <ProductShellLab theme={theme} />
          </Section>

          {/* 2. UI Primitives — Fase 2C.3 · inherits lab theme */}
          <Section
            id="ui-primitives"
            kicker="02 · UI Primitives"
            title="Componentes delicados"
            lead="Button system · chips · Pet Row · feedback · Pawmark candidate. Light e Dark."
          >
            <UiPrimitivesLab theme={theme} />
          </Section>

          {/* 3. Home V2 — Light + Dark */}
          <Section
            id="home-v2"
            kicker="03 · Home V2"
            title="Home representativa · Light + Dark"
            lead="Light + Dark com assets finais. Arquitetura preservada. Não é a Home real."
          >
            <HomeV2Lab />
          </Section>

          {/* 4. Icon System — inventory only */}
          <Section
            id="icon-system"
            kicker="04 · Icon System"
            title="Inventário de iconografia"
            lead="Wave 1 = APPROVED ASSET. Pawmark = APPROVED BRAND ASSET. Wave 2/3 bloqueadas."
          >
            <IconSystemLab />
          </Section>

          {/* 5. Asset Production Guide — Illustrator reference */}
          <Section
            id="asset-production"
            kicker="05 · Asset Production Guide"
            title="Produção · estado final"
            lead="FINAL ASSET / APPROVED ASSET. Concepts históricos secundários."
          >
            <AssetProductionGuide />
          </Section>

          {/* Logo + brand marks */}
          <Section
            id="identity"
            kicker="06 · Logo / assets"
            title="APPROVED ASSET · logos e marca"
            lead="Geometria fechada (Illustrator). Fonte: assets finais. Sem Wordmark R1 como alternativa."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CUIDADIM_LOGO_COMPARE.filter((l) => l.family === "final-3c").map((logo) => (
                <figure key={logo.id} className="cd-swatch">
                  <div
                    className="relative grid min-h-[7rem] place-items-center p-4"
                    style={{
                      background:
                        logo.id.includes("reverse") || logo.id.includes("mono-light")
                          ? "var(--cuidadim-purple)"
                          : "var(--cuidadim-creme)",
                    }}
                  >
                    <span className="absolute left-2 top-2">
                      <Status status={logo.status} />
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo.path}
                      alt={logo.label}
                      className="max-h-10 w-auto max-w-[90%] object-contain"
                    />
                  </div>
                  <figcaption className="border-t border-[var(--border)] px-3 py-2">
                    <p className="text-xs font-bold">{logo.label}</p>
                    <p className="cd-meta">{logo.note ?? logo.path}</p>
                  </figcaption>
                </figure>
              ))}
            </div>

            <h3 className="cd-h3 mb-3 mt-10">Wave 1 · navigation · APPROVED ASSET</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {FINAL_NAV_ICONS.map((nav) => (
                <figure key={nav.id} className="cd-swatch">
                  <div className="relative grid min-h-[6rem] place-items-center bg-[var(--surface-muted)] p-3">
                    <span className="absolute left-2 top-2">
                      <Status status={nav.status} />
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={nav.onLight ?? nav.single}
                      alt={nav.label}
                      className="h-8 w-8 object-contain"
                    />
                  </div>
                  <figcaption className="border-t border-[var(--border)] px-3 py-2">
                    <p className="text-xs font-bold">{nav.label}</p>
                    <p className="cd-meta">{nav.notes}</p>
                    {nav.acceptedVariation ? (
                      <p className="cd-meta mt-1">{nav.acceptedVariation}</p>
                    ) : null}
                  </figcaption>
                </figure>
              ))}
            </div>

            <h3 className="cd-h3 mb-3 mt-10">Pawmark · APPROVED BRAND ASSET</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <figure className="cd-swatch">
                <div className="relative grid min-h-[8rem] place-items-center bg-[var(--cuidadim-creme)] p-4">
                  <span className="absolute left-2 top-2">
                    <Status status={FINAL_BRAND.pawmark.status} />
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={FINAL_BRAND.pawmark.path}
                    alt="Pawmark"
                    className="max-h-20 w-auto object-contain"
                  />
                </div>
                <figcaption className="border-t border-[var(--border)] px-3 py-2">
                  <p className="text-xs font-bold">Pawmark · estrela acima</p>
                  <p className="cd-meta">{FINAL_BRAND.pawmark.notes}</p>
                </figcaption>
              </figure>
              <figure className="cd-swatch">
                <div className="relative grid min-h-[8rem] place-items-center bg-[var(--surface-muted)] p-4">
                  <span className="absolute left-2 top-2">
                    <Status status={FINAL_BRAND.pawStarCenter.status} />
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={FINAL_BRAND.pawStarCenter.path}
                    alt="Paw alternate"
                    className="max-h-20 w-auto object-contain"
                  />
                </div>
                <figcaption className="border-t border-[var(--border)] px-3 py-2">
                  <p className="text-xs font-bold">ALTERNATE · estrela no centro</p>
                  <p className="cd-meta">{FINAL_BRAND.pawStarCenter.notes}</p>
                </figcaption>
              </figure>
            </div>

            <h3 className="cd-h3 mb-3 mt-10">Pictogramas · storytelling</h3>
            <div className="cd-alert mb-4">
              <Status status={FINAL_PICTOGRAMS_NOTE.status} />{" "}
              {FINAL_PICTOGRAMS_NOTE.notes}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CUIDADIM_PICTOGRAMS.map((pic) => (
                <figure key={pic.id} className="cd-swatch">
                  <div className="relative grid min-h-[10rem] place-items-center bg-[var(--surface-muted)] p-4">
                    <span className="absolute left-2 top-2">
                      <Status status={pic.status} />
                    </span>
                    {pic.status !== "MISSING" && pic.status !== "DEFERRED" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pic.path} alt={pic.label} className="max-h-28 w-auto max-w-full object-contain" />
                    ) : (
                      <div className="cd-placeholder w-full max-w-[12rem]">
                        {pic.status === "DEFERRED"
                          ? `DEFERRED · ${pic.label}`
                          : `MISSING · ${pic.label}`}
                      </div>
                    )}
                  </div>
                  <figcaption className="border-t border-[var(--border)] px-3 py-2">
                    <p className="text-xs font-bold">{pic.label}</p>
                    <p className="cd-meta">{pic.note ?? pic.path}</p>
                  </figcaption>
                </figure>
              ))}
            </div>

            <h3 className="cd-h3 mb-3 mt-8">Estrela 4 pontas</h3>
            <div className="cd-alert mb-3">
              <Status status={FINAL_ESTRELA.status} /> {FINAL_ESTRELA.notes}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={FINAL_ESTRELA.path}
                alt="Estrela 4 pontas"
                className="h-10 w-10 object-contain"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CUIDADIM_STATIC_ICONS[0].path} alt="" className="h-8 w-8 object-contain" />
              <p className="cd-small max-w-sm text-[var(--text-secondary)]">
                Motivo Cozy Celestial — selected · marco · feedback. Selected states continuam com
                FourPointStar (comportamento aprovado).
              </p>
            </div>

            <h3 className="cd-h3 mb-3 mt-8">Paleta (congelada)</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {CORE_SWATCHES.map((c) => (
                <div key={c.token} className="cd-swatch">
                  <div className="h-16" style={{ background: `var(${c.token})` }} />
                  <div className="px-2 py-2">
                    <p className="text-xs font-bold">{c.name}</p>
                    <p className="cd-meta font-mono">{c.hex}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* 7. Architecture V2 — working baseline prototype */}
          <Section
            id="architecture-v2"
            kicker="07 · Architecture V2"
            title="M0.1V · final visual candidate"
            lead="Arquitetura visual consolidada após auditoria funcional e revisão humana. Exploration B selecionada. Ainda não implementada no produto real. Desktop + Mobile clicáveis."
          >
            <ArchitectureV2Lab />
          </Section>

          {/* Typography */}
          <Section
            id="type"
            kicker="08 · Tipografia"
            title="Fraunces + DM Sans"
            lead="Display editorial (Fraunces) · UI funcional (DM Sans). Logo nunca é texto."
          >
            <div className="cd-alert mb-5">
              Fraunces <strong>não</strong> estava no repositório. Carregada via{" "}
              <code className="text-xs">next/font/google</code> só no layout de{" "}
              <code className="text-xs">/brand-lab</code> (igual ao cuidadim-brand-kit).
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="cd-module space-y-4">
                <p className="cd-label">Fraunces · display</p>
                <p className="cd-display-xl">Cuidadim</p>
                <p className="cd-h1">A vida deles, bem cuidadinha.</p>
                <p className="cd-h2">Rotina com carinho</p>
                <p className="cd-h3">Próximo cuidado</p>
                <p className="cd-editorial-num">12</p>
                <p className="cd-meta">Editorial number / highlight</p>
              </div>
              <div className="cd-module space-y-3">
                <p className="cd-label">DM Sans · UI</p>
                <p className="cd-body">
                  Body — textos corridos, descrições e conteúdo funcional do app.
                </p>
                <p className="cd-small">Small — apoio, legendas e detalhes secundários.</p>
                <p className="cd-label">Label · uppercase tracking</p>
                <p className="cd-nav-label">Nav · Início · Pets · Agenda</p>
                <button type="button" className="cd-btn-primary">
                  Button label
                </button>
                <p className="cd-meta">Metadata · há 2 horas · familiar</p>
              </div>
            </div>
          </Section>

          {/* 3. Shape language */}
          <Section
            id="shapes"
            kicker="09 · Shape language"
            title="Curvas, radius e containers"
            lead="Derivado de wordmark/ícones/pictogramas — não de .cat-card."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { r: "sm 10", v: "var(--cd-radius-sm)" },
                { r: "md 16", v: "var(--cd-radius-md)" },
                { r: "lg 24", v: "var(--cd-radius-lg)" },
                { r: "xl 32", v: "var(--cd-radius-xl)" },
              ].map((item) => (
                <div key={item.r} className="cd-panel p-4" style={{ borderRadius: item.v }}>
                  <p className="cd-label">radius {item.r}</p>
                  <div
                    className="mt-3 h-14 border border-[var(--border)] bg-[var(--surface-muted)]"
                    style={{ borderRadius: item.v }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="cd-chip">Chip neutro</span>
              <span className="cd-chip-gold">Chip gold accent</span>
              <span className="cd-chip-rosa">Chip rosa apoio</span>
            </div>
            <hr className="cd-divider mt-6" />
          </Section>

          {/* 4. Components — superseded presentation (código histórico; não vigente) */}
          <Section
            id="components"
            kicker="10 · Arquivo (não vigente)"
            title="Primitives legados do lab"
            lead="Superseded. A direção vigente está em 02 · UI Primitives. Esta seção não compete."
          >
            <div className="cd-alert">
              <strong>Não usar como referência visual.</strong> Botões/inputs antigos (
              <code className="text-xs">cd-btn-primary</code>, <code className="text-xs">cd-field</code>
              ) ficam no CSS histórico, mas a apresentação oficial é só a seção 02.
            </div>
            <p className="cd-meta mt-3">
              Para Primary / Secondary / Tertiary / Icon Button, inputs e select →{" "}
              <a href="#ui-primitives" className="cd-btn-v2-tertiary">
                02 · UI Primitives
              </a>
            </p>
          </Section>

          {/* 5. Iconography */}
          <Section
            id="icons"
            kicker="11 · Iconografia (legado lab)"
            title="cuidadim-icons-v2 · referência técnica"
            lead="Comparação técnica mínima. Inventário = 04 · Guide = 05. Não tratar esta grade como família aprovada."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left text-xs">
                <thead>
                  <tr className="text-[var(--text-secondary)]">
                    <th className="px-2 py-2 font-bold">Ícone</th>
                    {ICON_SIZES.map((s) => (
                      <th key={s} className="px-2 py-2 font-bold">
                        {s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ICON_SET.map(({ label, Icon }) => (
                    <tr key={label} className="border-t border-[var(--border)]">
                      <td className="px-2 py-2 font-bold">{label}</td>
                      {ICON_SIZES.map((size) => (
                        <td key={size} className="px-2 py-2">
                          <div className="cd-icon-tile size-14">
                            <Icon size={size} color={iconColor} />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="cd-panel mt-4 p-4">
              <p className="cd-label mb-2">Comparação técnica (não dominante)</p>
              <div className="flex flex-wrap gap-4">
                <div className="cd-icon-tile flex flex-col gap-1 px-3 py-2">
                  <LucideHome size={22} />
                  <span className="cd-meta">Lucide Home</span>
                </div>
                <div className="cd-icon-tile flex flex-col gap-1 px-3 py-2">
                  <IconHome size={22} color={iconColor} />
                  <span className="cd-meta">Cuidadim Home</span>
                </div>
                <div className="cd-icon-tile flex flex-col gap-1 px-3 py-2">
                  <Cat size={22} />
                  <span className="cd-meta">Lucide Cat</span>
                </div>
                <div className="cd-icon-tile flex flex-col gap-1 px-3 py-2">
                  <PawIcon size={22} color={iconColor} />
                  <span className="cd-meta">PawIcon · nav</span>
                </div>
                <div className="cd-icon-tile flex flex-col gap-1 px-3 py-2">
                  <PawmarkIcon size={22} strokeColor={iconColor} starColor="#CCA863" />
                  <span className="cd-meta">Pawmark · app icon</span>
                </div>
                <div className="cd-icon-tile flex flex-col gap-1 px-3 py-2">
                  <LucideImages size={22} />
                  <span className="cd-meta">Lucide Images</span>
                </div>
                <div className="cd-icon-tile flex flex-col gap-1 px-3 py-2">
                  <IconMemorias size={22} color={iconColor} />
                  <span className="cd-meta">Cuidadim Memórias</span>
                </div>
              </div>
            </div>
          </Section>

          <footer className="border-t border-[var(--border)] pt-6 pb-4">
            <p className="cd-meta">
              Brand Lab 3A.3 · Dark polish · sem commit.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
