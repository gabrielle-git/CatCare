"use client";

import {
  ColorApplicationDemo,
  ConstructionBoard,
  StrokeDoDont,
} from "@/components/brand/cuidadim/asset-production-boards";
import {
  ConceptAgora,
  ConceptAssistenteA,
  ConceptAssistenteB,
  ConceptCuidados,
} from "@/components/brand/cuidadim/asset-production-concepts";
import { IconAssistente } from "@/components/brand/cuidadim/icons/icons";
import { PawIcon } from "@/components/brand/cuidadim/icons/PawIcon";
import type { ReactNode } from "react";

const PURPLE = "#2A1F2F";
const GOLD = "#CCA863";
const ROSA = "#DAACBA";
const ROSA_LIGHT = "#F0DBE1";
const CREME = "#FCFAF5";
const GRAFITE = "#6B586E";

const CORE = [
  { name: "PURPLE", hex: PURPLE, use: "Estrutura Light · texto · nav" },
  { name: "GOLD", hex: GOLD, use: "Accent intencional · estrela · selected" },
  { name: "ROSA", hex: ROSA, use: "Apoio · accents suaves" },
  { name: "ROSA LIGHT", hex: ROSA_LIGHT, use: "Wash · surface soft" },
  { name: "CREME", hex: CREME, use: "Bg Light · estrutura Dark" },
  { name: "GRAFITE", hex: GRAFITE, use: "Tagline · texto secundário" },
] as const;

const PURPLE_SCALE = [
  { step: "50", hex: "#F4F1F5", use: "Wash Light" },
  { step: "100", hex: "#E4DEE6", use: "Border soft" },
  { step: "300", hex: "#9C8CA3", use: "Muted" },
  { step: "500", hex: "#5B4A63", use: "Mid" },
  { step: "700", hex: "#3A2C40", use: "Deep" },
  { step: "900", hex: "#2A1F2F", use: "Nav Light master" },
] as const;

const GOLD_SCALE = [
  { step: "100", hex: "#F3E9D3", use: "Glow soft" },
  { step: "300", hex: "#DEC08A", use: "Highlight" },
  { step: "500", hex: "#CCA863", use: "Accent master" },
  { step: "700", hex: "#A8834A", use: "Deep gold" },
] as const;

const SIZES = [20, 24, 32] as const;

const LOGO_EXPORTS = [
  {
    id: "primary",
    title: "LOGO PRIMARY",
    specs: ["Texto+curva #2A1F2F", "Estrelas #CCA863", "BG transparent"],
    files: ["logo-primary.svg"],
    preview: "/brand/cuidadim/final/logo/logo-primary.svg",
    surface: CREME,
    status: "APPROVED ASSET" as const,
  },
  {
    id: "reverse",
    title: "LOGO REVERSE",
    specs: ["Texto+curva #FCFAF5", "Estrelas #CCA863", "BG transparent"],
    files: ["logo-reverse.svg"],
    preview: "/brand/cuidadim/final/logo/logo-reverse.svg",
    surface: PURPLE,
    status: "APPROVED ASSET" as const,
  },
  {
    id: "tagline-light",
    title: "TAGLINE PRIMARY",
    specs: ["Logo #2A1F2F + #CCA863", "Tagline conforme asset", "BG transparent"],
    files: ["logo-tagline-primary.svg"],
    preview: "/brand/cuidadim/final/logo/logo-tagline-primary.svg",
    surface: CREME,
    status: "APPROVED ASSET" as const,
  },
  {
    id: "tagline-dark",
    title: "TAGLINE REVERSE",
    specs: ["Logo #FCFAF5 + #CCA863", "Tagline conforme asset", "BG transparent"],
    files: ["logo-tagline-reverse.svg"],
    preview: "/brand/cuidadim/final/logo/logo-tagline-reverse.svg",
    surface: PURPLE,
    status: "APPROVED ASSET" as const,
  },
  {
    id: "mono-dark",
    title: "MONO DARK",
    specs: ["Roxo escuro"],
    files: ["logo-mono-dark.svg"],
    preview: "/brand/cuidadim/final/logo/logo-mono-dark.svg",
    surface: CREME,
    status: "APPROVED ASSET" as const,
  },
  {
    id: "mono-light",
    title: "MONO LIGHT",
    specs: ["Creme"],
    files: ["logo-mono-light.svg"],
    preview: "/brand/cuidadim/final/logo/logo-mono-light.svg",
    surface: PURPLE,
    status: "APPROVED ASSET" as const,
  },
] as const;

function FinalGlyph({ src, size }: { src: string; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="cd-final-nav-icon"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

function Pill({
  children,
  tone = "CANDIDATE",
}: {
  children: string;
  tone?: "APPROVED" | "CANDIDATE" | "MISSING" | "LEGACY" | "AMBIGUOUS";
}) {
  return (
    <span className="cd-status" data-status={tone}>
      {children}
    </span>
  );
}

function ConceptBanner() {
  return (
    <div className="cd-apg-concept-banner" role="note">
      CONCEPT REFERENCE — NOT PRODUCTION ASSET
    </div>
  );
}

function DualPreview({
  light,
  dark,
}: {
  light: (size: number) => ReactNode;
  dark: (size: number) => ReactNode;
}) {
  return (
    <div className="cd-apg-dual">
      <div className="cd-apg-preview" style={{ background: CREME }}>
        <p className="cd-apg-preview-label" style={{ color: GRAFITE }}>
          LIGHT
        </p>
        <div className="cd-apg-preview-row">
          <div className="cd-apg-hero-glyph">{light(48)}</div>
          {SIZES.map((s) => (
            <div key={`l-${s}`} className="cd-apg-size-cell">
              {light(s)}
              <span style={{ color: GRAFITE }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="cd-apg-preview" style={{ background: PURPLE }}>
        <p className="cd-apg-preview-label" style={{ color: CREME }}>
          DARK
        </p>
        <div className="cd-apg-preview-row">
          <div className="cd-apg-hero-glyph">{dark(48)}</div>
          {SIZES.map((s) => (
            <div key={`d-${s}`} className="cd-apg-size-cell">
              {dark(s)}
              <span style={{ color: CREME }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GlyphCard({
  title,
  status,
  statusTone,
  note,
  children,
}: {
  title: string;
  status: string;
  statusTone?: "APPROVED" | "CANDIDATE" | "MISSING" | "LEGACY" | "AMBIGUOUS";
  note: string;
  children: ReactNode;
}) {
  return (
    <article className="cd-apg-glyph-card">
      <header className="cd-apg-glyph-head">
        <h4 className="cd-h3">{title}</h4>
        <Pill tone={statusTone}>{status}</Pill>
      </header>
      <p className="cd-small mt-2 text-[var(--text-secondary)]">{note}</p>
      <div className="mt-4">{children}</div>
    </article>
  );
}

/**
 * Fase 3C — Asset Production Guide: estado final dos assets entregues.
 */
export function AssetProductionGuide() {
  return (
    <div className="space-y-16">
      <div className="cd-alert cd-alert-accent">
        <strong>05 · Asset Production Guide · 3C.</strong> Estado final. Wave 1 ={" "}
        <strong>APPROVED ASSET / FINAL ASSET</strong>. Concepts históricos = secundários.
      </div>

      {/* 05.1 */}
      <section className="cd-apg-board">
        <p className="cd-label">05.1</p>
        <h3 className="cd-h3 mt-1">Official colors</h3>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CORE.map((c) => (
            <div key={c.hex} className="cd-apg-swatch">
              <div className="cd-apg-swatch-chip cd-apg-swatch-chip-lg" style={{ background: c.hex }} />
              <div className="cd-apg-swatch-meta">
                <p className="font-bold text-[var(--text-primary)]">{c.name}</p>
                <p className="cd-apg-hex">{c.hex}</p>
                <p className="cd-meta mt-1">{c.use}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="cd-label">Purple scale</p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {PURPLE_SCALE.map((c) => (
                <div key={c.hex} className="cd-apg-swatch">
                  <div className="cd-apg-swatch-chip" style={{ background: c.hex }} />
                  <div className="cd-apg-swatch-meta">
                    <p className="font-bold">{c.step}</p>
                    <p className="cd-apg-hex">{c.hex}</p>
                    <p className="cd-meta">{c.use}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="cd-label mt-6">Gold scale</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {GOLD_SCALE.map((c) => (
                <div key={c.hex} className="cd-apg-swatch">
                  <div className="cd-apg-swatch-chip" style={{ background: c.hex }} />
                  <div className="cd-apg-swatch-meta">
                    <p className="font-bold">{c.step}</p>
                    <p className="cd-apg-hex">{c.hex}</p>
                    <p className="cd-meta">{c.use}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="cd-apg-side-panel">
            <p className="cd-label">Light / Dark</p>
            <p className="cd-meta mt-2 mb-3">Estrutural ↔ currentColor · Gold preservado</p>
            <ColorApplicationDemo />
          </div>
        </div>
      </section>

      {/* 05.2 */}
      <section className="cd-apg-board">
        <p className="cd-label">05.2</p>
        <h3 className="cd-h3 mt-1">Illustrator construction spec</h3>
        <div className="mt-5 grid gap-6 lg:grid-cols-[auto_1fr]">
          <ConstructionBoard size={280} />
          <div className="space-y-4">
            <div className="cd-apg-spec-grid">
              {[
                ["MASTER", "24 × 24 px"],
                ["SAFE AREA", "~2 px"],
                ["STROKE", "2 px"],
                ["LINECAP", "round"],
                ["LINEJOIN", "round"],
                ["NAV LIGHT", PURPLE],
                ["NAV DARK", CREME],
                ["ACCENT", GOLD],
              ].map(([k, v]) => (
                <div key={k} className="cd-apg-spec-cell">
                  <p className="cd-label">{k}</p>
                  <p className="cd-apg-hex mt-1">{v}</p>
                </div>
              ))}
            </div>
            <StrokeDoDont width={320} />
            <p className="cd-small text-[var(--text-secondary)]">
              Estrutural → <code>currentColor</code> na implementação. Gold → preservado quando
              intencional no glifo. Sem shadow / filter / gradient no SVG.
            </p>
          </div>
        </div>
      </section>

      {/* 05.3 Wave 1 */}
      <section className="cd-apg-board">
        <p className="cd-label">05.3</p>
        <h3 className="cd-h3 mt-1">Wave 1 · FINAL ASSET / APPROVED ASSET</h3>

        <div className="mt-6 space-y-8">
          <GlyphCard
            title="1 · Agora"
            status="APPROVED ASSET"
            statusTone="APPROVED"
            note="FINAL ASSET · icon-agora-on-light / on-dark. Casa Cuidadim com estrela gold."
          >
            <DualPreview
              light={(s) => (
                <FinalGlyph src="/brand/cuidadim/final/icons/icon-agora-on-light.svg" size={s} />
              )}
              dark={(s) => (
                <FinalGlyph src="/brand/cuidadim/final/icons/icon-agora-on-dark.svg" size={s} />
              )}
            />
            <details className="cd-apg-nested mt-6">
              <summary className="cd-label cursor-pointer">Histórico · concept reference</summary>
              <div className="mt-3">
                <ConceptBanner />
                <DualPreview
                  light={(s) => <ConceptAgora size={s} structure={PURPLE} star={GOLD} />}
                  dark={(s) => <ConceptAgora size={s} structure={CREME} star={GOLD} />}
                />
              </div>
            </details>
          </GlyphCard>

          <GlyphCard
            title="2 · Pets"
            status="APPROVED ASSET"
            statusTone="APPROVED"
            note="FINAL ASSET · pata SEM estrela. Dark = cópia impl (#FCFAF5). ≠ Pawmark."
          >
            <DualPreview
              light={(s) => (
                <FinalGlyph src="/brand/cuidadim/final/icons/icon-pets.svg" size={s} />
              )}
              dark={(s) => (
                <FinalGlyph src="/brand/cuidadim/final/icons/impl/icon-pets-on-dark.svg" size={s} />
              )}
            />
            <div className="cd-apg-nested mt-6">
              <div className="flex flex-wrap items-center gap-2">
                <p className="cd-label">Pawmark</p>
                <Pill tone="APPROVED">APPROVED BRAND ASSET</Pill>
              </div>
              <p className="cd-meta mt-1">Pata + estrela acima · ≠ Pets nav · PWA ainda não</p>
              <div className="mt-3">
                <DualPreview
                  light={(s) => (
                    <FinalGlyph src="/brand/cuidadim/final/brand/pawmark.svg" size={s} />
                  )}
                  dark={(s) => (
                    <FinalGlyph src="/brand/cuidadim/final/brand/pawmark.svg" size={s} />
                  )}
                />
              </div>
              <p className="cd-meta mt-3">
                ALTERNATE ASSET · pata + estrela no centro → final/brand/archive/
              </p>
            </div>
          </GlyphCard>

          <GlyphCard
            title="3 · Cuidados"
            status="APPROVED ASSET"
            statusTone="APPROVED"
            note="FINAL ASSET · light/dark. ACCEPTED SOURCE VARIATION · on-light star #CDA963."
          >
            <DualPreview
              light={(s) => (
                <FinalGlyph src="/brand/cuidadim/final/icons/icon-cuidados-on-light.svg" size={s} />
              )}
              dark={(s) => (
                <FinalGlyph src="/brand/cuidadim/final/icons/icon-cuidados-on-dark.svg" size={s} />
              )}
            />
            <details className="cd-apg-nested mt-6">
              <summary className="cd-label cursor-pointer">Histórico · concept reference</summary>
              <div className="mt-3">
                <ConceptBanner />
                <DualPreview
                  light={(s) => <ConceptCuidados size={s} structure={PURPLE} />}
                  dark={(s) => <ConceptCuidados size={s} structure={CREME} />}
                />
              </div>
            </details>
          </GlyphCard>

          <GlyphCard
            title="4 · Memórias (nav)"
            status="APPROVED ASSET"
            statusTone="APPROVED"
            note="FINAL ASSET · navigation only. ≠ pictogram Memórias. Single multi-color · as-is."
          >
            <DualPreview
              light={(s) => (
                <FinalGlyph src="/brand/cuidadim/final/icons/icon-memorias.svg" size={s} />
              )}
              dark={(s) => (
                <FinalGlyph src="/brand/cuidadim/final/icons/icon-memorias.svg" size={s} />
              )}
            />
          </GlyphCard>

          <GlyphCard
            title="5 · Assistente"
            status="APPROVED ASSET"
            statusTone="APPROVED"
            note="FINAL ASSET · on-light / on-dark. Label-only path encerrado no Brand Lab."
          >
            <DualPreview
              light={(s) => (
                <FinalGlyph
                  src="/brand/cuidadim/final/icons/icon-assistente-on-light.svg"
                  size={s}
                />
              )}
              dark={(s) => (
                <FinalGlyph
                  src="/brand/cuidadim/final/icons/icon-assistente-on-dark.svg"
                  size={s}
                />
              )}
            />
            <details className="cd-apg-nested mt-6">
              <summary className="cd-label cursor-pointer">Histórico · exploration</summary>
              <div className="mt-3 space-y-4">
                <div className="cd-apg-rejected">
                  <div className="flex flex-wrap items-center gap-3">
                    <IconAssistente size={28} color={PURPLE} />
                    <div>
                      <Pill tone="LEGACY">REJECTED — histórico</Pill>
                      <p className="cd-small mt-1 text-[var(--text-secondary)]">
                        Sparkles legado — não é o asset final.
                      </p>
                    </div>
                  </div>
                </div>
                <ConceptBanner />
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="cd-apg-explore-card">
                    <p className="cd-label">Concept A (histórico)</p>
                    <DualPreview
                      light={(s) => <ConceptAssistenteA size={s} structure={PURPLE} star={GOLD} />}
                      dark={(s) => <ConceptAssistenteA size={s} structure={CREME} star={GOLD} />}
                    />
                  </div>
                  <div className="cd-apg-explore-card">
                    <p className="cd-label">Concept B (histórico)</p>
                    <DualPreview
                      light={(s) => <ConceptAssistenteB size={s} structure={PURPLE} star={GOLD} />}
                      dark={(s) => <ConceptAssistenteB size={s} structure={CREME} star={GOLD} />}
                    />
                  </div>
                </div>
              </div>
            </details>
          </GlyphCard>
        </div>
      </section>

      {/* 05.4 Logo */}
      <section className="cd-apg-board">
        <p className="cd-label">05.4</p>
        <h3 className="cd-h3 mt-1">Logo production matrix</h3>
        <div className="cd-apg-immutable mt-4">
          SOMENTE COR MUDA ENTRE AS VARIANTES — geometria imutável
          <span className="cd-meta mt-1 block font-normal normal-case tracking-normal">
            Não alterar letras · kerning · spacing · curva do m · estrelas · proporções · posições
          </span>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {LOGO_EXPORTS.map((item) => (
            <div key={item.id} className="cd-apg-logo-card">
              <div
                className="cd-apg-logo-stage"
                style={{ background: item.surface }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.preview}
                  alt=""
                  className="max-h-12 w-auto max-w-[88%] object-contain"
                />
              </div>
              <div className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="cd-label">{item.title}</p>
                  <Pill tone="APPROVED">{item.status}</Pill>
                </div>
                <ul className="cd-meta mt-2 space-y-0.5">
                  {item.specs.map((s) => (
                    <li key={s}>· {s}</li>
                  ))}
                </ul>
                <p className="cd-apg-hex mt-2">{item.files.join(" · ")}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 05.5 Export */}
      <section className="cd-apg-board">
        <p className="cd-label">05.5</p>
        <h3 className="cd-h3 mt-1">Export checklist · estado 3C</h3>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="cd-apg-check-card">
            <p className="cd-label">Nav icons · APPROVED ASSET</p>
            <ul className="cd-apg-file-list mt-3">
              {[
                "icon-agora-on-light.svg / on-dark.svg",
                "icon-pets.svg (+ impl on-dark)",
                "icon-cuidados-on-light.svg / on-dark.svg",
                "icon-memorias.svg",
                "icon-assistente-on-light.svg / on-dark.svg",
              ].map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="cd-meta mt-3">
              Fonte: assets finais → public/brand/cuidadim/final/icons/
            </p>
          </div>
          <div className="cd-apg-check-card">
            <p className="cd-label">Logo · APPROVED ASSET</p>
            <ul className="cd-apg-file-list mt-3">
              {LOGO_EXPORTS.flatMap((l) => l.files).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 05.6 Do / Don't */}
      <section className="cd-apg-board">
        <p className="cd-label">05.6</p>
        <h3 className="cd-h3 mt-1">Do / Don&apos;t</h3>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="cd-apg-do">
            <p className="cd-label">DO</p>
            <div className="mt-4 flex items-end justify-around gap-2">
              <ConceptAgora size={40} structure={PURPLE} star={GOLD} />
              <PawIcon size={40} color={PURPLE} />
              <ConceptCuidados size={40} structure={PURPLE} />
            </div>
            <ul className="cd-small mt-4 space-y-1">
              <li>· simples · legível em 20px</li>
              <li>· curvas suaves · mesma espessura</li>
              <li>· respiro · gold intencional</li>
              <li>· aparência adulta · família coerente</li>
            </ul>
          </div>
          <div className="cd-apg-dont">
            <p className="cd-label">DON&apos;T</p>
            <div className="mt-4 flex items-end justify-around gap-3">
              <div className="cd-apg-dont-sample" title="abstrato rejeitado">
                <IconAssistente size={36} color={PURPLE} />
              </div>
              <div className="cd-apg-dont-sample" title="mecânico">
                <svg width={36} height={36} viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="4" y="4" width="16" height="16" stroke={PURPLE} strokeWidth="2" />
                  <path d="M8 12h8M12 8v8" stroke={PURPLE} strokeWidth="2" strokeLinecap="square" />
                </svg>
              </div>
              <div className="cd-apg-dont-sample" title="estrelas aleatórias">
                <svg width={36} height={36} viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="12" r="9" fill={PURPLE} opacity="0.12" />
                  <path
                    d="M8 4c.2 1.4.5 2.5 1.2 3.4.7 1 1.8 1.4 3.3 1.6-1.5.2-2.6.6-3.3 1.6-.7.9-1 2-1.2 3.4-.2-1.4-.5-2.5-1.2-3.4-.7-1-1.8-1.4-3.3-1.6 1.5-.2 2.6-.6 3.3-1.6.7-.9 1-2 1.2-3.4z"
                    fill={GOLD}
                  />
                  <path
                    d="M17 12c.15 1 .35 1.8.85 2.4.5.7 1.3 1 2.4 1.15-1.1.15-1.9.45-2.4 1.15-.5.6-.7 1.4-.85 2.4-.15-1-.35-1.8-.85-2.4-.5-.7-1.3-1-2.4-1.15 1.1-.15 1.9-.45 2.4-1.15.5-.6.7-1.4.85-2.4z"
                    fill={GOLD}
                  />
                </svg>
              </div>
            </div>
            <ul className="cd-small mt-4 space-y-1">
              <li>· copiar Lucide · estrela aleatória</li>
              <li>· excesso de detalhe · símbolo abstrato</li>
              <li>· gradients · shadows no SVG</li>
              <li>· formas infantis · peso irregular · estilos misturados</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="cd-alert">
        3C: assets finais no Brand Lab. Wave 1 APPROVED ASSET. Produto real intacto. Sem commit.
      </div>
    </div>
  );
}
