"use client";

import { FinalNavImg } from "@/components/brand/cuidadim/final-asset-img";
import {
  FINAL_BRAND,
  FINAL_ESTRELA,
  FINAL_LOGOS,
  FINAL_NAV_ICONS,
  FINAL_PICTOGRAMS,
  VISUAL_FREEZE_V1,
} from "@/components/brand/cuidadim/final-assets";

const NAV_SIZES = [20, 24, 32] as const;

function Tone({ status }: { status: string }) {
  const key =
    status.startsWith("APPROVED") || status === "ALTERNATE ASSET"
      ? "APPROVED"
      : status.startsWith("DEFERRED") || status.includes("MISSING")
        ? "MISSING"
        : "CANDIDATE";
  return (
    <span className="cd-status" data-status={key}>
      {status}
    </span>
  );
}

/**
 * Fase 3D — Visual Freeze V1 registration + final icon/logo QA board (Brand Lab only).
 */
export function VisualFreezeLab() {
  return (
    <div className="space-y-10">
      <div className="cd-alert cd-alert-accent">
        <strong>{VISUAL_FREEZE_V1.id}</strong> · Fase {VISUAL_FREEZE_V1.phase}. Brand Lab congelado
        para esta rodada. Produto real ainda não migrado.
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="cd-surface-xl p-4">
          <p className="cd-label">Congelado</p>
          <ul className="cd-small mt-3 space-y-1.5 text-[var(--text-secondary)]">
            {VISUAL_FREEZE_V1.frozen.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </div>
        <div className="cd-surface-xl p-4">
          <p className="cd-label">Explicitamente NÃO congelado</p>
          <ul className="cd-small mt-3 space-y-1.5 text-[var(--text-secondary)]">
            {VISUAL_FREEZE_V1.notFrozen.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h3 className="cd-h3">Final asset status</h3>
        <ul className="cd-small mt-3 space-y-2">
          {FINAL_NAV_ICONS.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[var(--text-primary)]">{n.label}</span>
              <Tone status={n.status} />
            </li>
          ))}
          <li className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--text-primary)]">Logos</span>
            <Tone status="APPROVED ASSET" />
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--text-primary)]">Pawmark</span>
            <Tone status={FINAL_BRAND.pawmark.status} />
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--text-primary)]">Four-point star</span>
            <Tone status={FINAL_ESTRELA.status} />
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--text-primary)]">Sempre Juntos</span>
            <Tone status={FINAL_PICTOGRAMS.couple.status} />
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--text-primary)]">Cuidado Pet</span>
            <Tone status={FINAL_PICTOGRAMS.care.status} />
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--text-primary)]">Memórias illustration</span>
            <Tone status={FINAL_PICTOGRAMS.memories.status} />
          </li>
        </ul>
      </div>

      {/* Icon size QA */}
      <div>
        <h3 className="cd-h3">Icon QA · 20 / 24 / 32</h3>
        <p className="cd-meta mt-1">Masters intactos. Só box de implementação.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {(["light", "dark"] as const).map((theme) => (
            <div
              key={theme}
              className="cd-surface-lg p-4"
              style={{
                background: theme === "dark" ? "var(--cuidadim-purple)" : "var(--cuidadim-creme)",
                color: theme === "dark" ? "var(--cuidadim-creme)" : "var(--cuidadim-purple)",
              }}
            >
              <p className="cd-label" style={{ color: "inherit", opacity: 0.7 }}>
                {theme.toUpperCase()}
              </p>
              <div className="mt-3 space-y-4">
                {FINAL_NAV_ICONS.filter((n) => n.id !== "assistente").map((nav) => (
                  <div key={nav.id} className="flex flex-wrap items-end gap-4">
                    <span className="w-20 text-xs font-semibold">{nav.label}</span>
                    {NAV_SIZES.map((size) => (
                      <div key={`${nav.id}-${size}`} className="flex flex-col items-center gap-1">
                        <FinalNavImg id={nav.id} theme={theme} size={size} />
                        <span className="text-[10px] opacity-70">{size}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="flex flex-wrap items-end gap-4">
                  <span className="w-20 text-xs font-semibold">Assistente</span>
                  {NAV_SIZES.map((size) => (
                    <div key={`assistente-${size}`} className="flex flex-col items-center gap-1">
                      <FinalNavImg id="assistente" theme={theme} size={size} />
                      <span className="text-[10px] opacity-70">{size}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logo QA */}
      <div>
        <h3 className="cd-h3">Logo QA</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FINAL_LOGOS.filter((l) =>
            ["PRIMARY", "REVERSE", "TAGLINE PRIMARY", "TAGLINE REVERSE"].includes(l.role)
          ).map((logo) => {
            const dark =
              logo.role === "REVERSE" || logo.role === "TAGLINE REVERSE";
            return (
              <figure key={logo.path} className="cd-swatch">
                <div
                  className="relative grid min-h-[5.5rem] place-items-center px-4 py-5"
                  style={{
                    background: dark ? "var(--cuidadim-purple)" : "var(--cuidadim-creme)",
                  }}
                >
                  <span className="absolute left-2 top-2">
                    <Tone status={logo.status} />
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logo.path}
                    alt={logo.role}
                    className="max-h-11 w-auto max-w-[92%] object-contain"
                  />
                </div>
                <figcaption className="border-t border-[var(--border)] px-3 py-2">
                  <p className="text-xs font-bold">{logo.role}</p>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </div>
  );
}
