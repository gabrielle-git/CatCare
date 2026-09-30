"use client";

import { useState } from "react";
import { Bell, ChevronDown, X } from "lucide-react";
import { FourPointStar } from "@/components/brand/cuidadim/icons/FourPointStar";
import { PawIcon } from "@/components/brand/cuidadim/icons/PawIcon";
import { PawmarkIcon } from "@/components/brand/cuidadim/icons/PawmarkIcon";
import { PAWMARK_STAR_BEFORE } from "@/components/brand/cuidadim/product-shell-meta";

const INK_LIGHT = "#2A1F2F";
const INK_DARK = "#FCFAF5";
const GOLD = "#CCA863";

type LabTheme = "light" | "dark";

function DirBadge({
  status,
}: {
  status: "APPROVED DIRECTION" | "CANDIDATE" | "SPECIAL CASE" | "PENDING ASSET" | "MISSING";
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

/** QA-only: previous star placement (glued to trail). */
function PawmarkBefore({
  size,
  strokeColor,
  starColor,
}: {
  size: number;
  strokeColor: string;
  starColor: string;
}) {
  const sw = 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={strokeColor}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Pawmark before (QA)"
    >
      <ellipse cx="6.2" cy="11" rx="2" ry="2.5" />
      <ellipse cx="10.1" cy="7.8" rx="2" ry="2.6" />
      <ellipse cx="14.3" cy="7.8" rx="2" ry="2.6" />
      <path d="M12.2 14c-2.9 0-5.2 2.1-5.2 4.3 0 1.8 1.5 2.9 3.2 2.4l1.2-.4c.5-.15 1-.15 1.5 0l1.2.4c1.7.5 3.2-.6 3.2-2.4 0-2.2-2.3-4.3-5.1-4.3z" />
      <path d="M17.3 11.4c1.6-.5 2.9-1.9 3.4-3.6" strokeWidth={sw * 0.85} />
      <path
        d={PAWMARK_STAR_BEFORE}
        fill={starColor}
        stroke={starColor}
        strokeWidth={sw * 0.3}
      />
    </svg>
  );
}

const PAWMARK_SIZES = [
  { label: "32px", sim: "32", px: 32 },
  { label: "64px", sim: "64", px: 64 },
  { label: "192px", sim: "192", px: 192 },
  { label: "512px", sim: "512", px: 512 },
] as const;

const PET_STATUSES = [
  { label: "Em dia", tone: "ok" },
  { label: "Hoje", tone: "today" },
  { label: "Atenção", tone: "warn" },
  { label: "Atrasado", tone: "late" },
] as const;

/**
 * Fase 2C.3 — UI Primitives fechados (Brand Lab only).
 */
export function UiPrimitivesLab({ theme }: { theme: LabTheme }) {
  const [selectOpen, setSelectOpen] = useState(false);
  const [selected, setSelected] = useState("Luna");
  const ink = theme === "dark" ? INK_DARK : INK_LIGHT;

  return (
    <div className="space-y-14">
      <div className="cd-alert cd-alert-accent">
        <strong>02 · UI Primitives · Fase 2C.3.</strong> Decisões vigentes. Tema:{" "}
        <strong>{theme}</strong>. Radius <strong>24</strong> / <strong>32</strong>.
      </div>

      {/* —— Pawmark —— */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">PawmarkIcon · App Icon / Brand Mark</h3>
          <DirBadge status="CANDIDATE" />
        </div>
        <p className="cd-small mt-2 max-w-xl text-[var(--text-secondary)]">
          Patinha + estrela — home screen / favicon / splash. Não é nav de Pets. Estrela da peça
          ≠ estrela em toda a família de ícones.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 max-w-lg">
          <figure className="cd-pawmark-tile">
            <PawmarkBefore size={64} strokeColor={ink} starColor={GOLD} />
            <figcaption className="cd-pawmark-caption">
              <span className="cd-label">Before</span>
              <span className="cd-meta">estrela colada no traço · QA</span>
            </figcaption>
          </figure>
          <figure className="cd-pawmark-tile">
            <PawmarkIcon size={64} strokeColor={ink} starColor={GOLD} />
            <figcaption className="cd-pawmark-caption">
              <span className="cd-label">After</span>
              <span className="cd-meta">estrela levemente acima · gap</span>
            </figcaption>
          </figure>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PAWMARK_SIZES.map((s) => (
            <figure key={s.sim} className="cd-pawmark-tile">
              <div className="cd-pawmark-frame" data-sim={s.sim}>
                <PawmarkIcon
                  size={s.px}
                  strokeColor={ink}
                  starColor={GOLD}
                  className="cd-pawmark-svg"
                />
              </div>
              <figcaption className="cd-pawmark-caption">
                <span className="cd-label">{s.label}</span>
                <span className="cd-meta">simulado</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="cd-surface-lg p-5">
            <p className="cd-label">Navigation icon</p>
            <div className="mt-4 flex items-center gap-4">
              <PawIcon size={28} color={ink} />
              <div>
                <p className="text-sm font-semibold">PawIcon</p>
                <p className="cd-meta">CANDIDATE · tab / listas · sem estrela</p>
              </div>
            </div>
          </div>
          <div className="cd-surface-lg p-5">
            <p className="cd-label">App icon / brand mark</p>
            <div className="mt-4 flex items-center gap-4">
              <PawmarkIcon size={28} strokeColor={ink} starColor={GOLD} />
              <div>
                <p className="text-sm font-semibold">PawmarkIcon</p>
                <p className="cd-meta">CANDIDATE · vitrine · estrela da peça</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* —— Radius —— */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Radius</h3>
          <DirBadge status="APPROVED DIRECTION" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="cd-surface-lg p-5">
            <p className="cd-label">LG · 24px</p>
            <p className="cd-small mt-2">
              Buttons, inputs, selects, cards padrão, dock, containers funcionais.
            </p>
          </div>
          <div className="cd-surface-xl p-5">
            <p className="cd-label">XL · 32px</p>
            <p className="cd-small mt-2">
              Superfícies maiores, módulos afetivos, destaque, empty states.
            </p>
          </div>
        </div>
        <p className="cd-meta mt-3">SM/MD técnicos — não definem a personalidade.</p>
      </div>

      {/* —— Buttons —— */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Buttons</h3>
          <DirBadge status="APPROVED DIRECTION" />
        </div>
        <p className="cd-small mt-1 text-[var(--text-secondary)]">
          Quatro papéis oficiais. Estados abaixo — não são famílias concorrentes. Registrar
          cuidado fica no shell.
        </p>

        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <p className="cd-label">Primary</p>
            <button type="button" className="cd-btn-v2-primary">
              Salvar
            </button>
          </div>
          <div className="space-y-2">
            <p className="cd-label">Secondary</p>
            <button type="button" className="cd-btn-v2-secondary">
              Cancelar
            </button>
          </div>
          <div className="space-y-2">
            <p className="cd-label">Tertiary</p>
            <button type="button" className="cd-btn-v2-tertiary">
              Ver histórico
            </button>
          </div>
          <div className="space-y-2">
            <p className="cd-label">Icon Button</p>
            <button type="button" className="cd-btn-v2-icon" aria-label="Notificações">
              <Bell size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="mt-8">
          <p className="cd-label">Estados · mesma regra</p>
          <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="cd-meta mb-2">default</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="cd-btn-v2-primary">
                  Salvar
                </button>
                <button type="button" className="cd-btn-v2-secondary">
                  Cancelar
                </button>
                <button type="button" className="cd-btn-v2-icon" aria-label="Fechar">
                  <X size={15} strokeWidth={1.75} />
                </button>
              </div>
            </div>
            <div>
              <p className="cd-meta mb-2">hover</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="cd-btn-v2-primary" data-state="hover">
                  Salvar
                </button>
                <button type="button" className="cd-btn-v2-secondary" data-state="hover">
                  Cancelar
                </button>
                <button type="button" className="cd-btn-v2-icon" data-state="hover" aria-label="Notificações">
                  <Bell size={15} strokeWidth={1.75} />
                </button>
              </div>
            </div>
            <div>
              <p className="cd-meta mb-2">active</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="cd-btn-v2-primary" data-state="active">
                  Salvar
                </button>
                <button type="button" className="cd-btn-v2-secondary" data-state="active">
                  Cancelar
                </button>
                <button type="button" className="cd-btn-v2-icon" data-state="active" aria-label="Notificações">
                  <Bell size={15} strokeWidth={1.75} />
                </button>
              </div>
            </div>
            <div>
              <p className="cd-meta mb-2">disabled</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="cd-btn-v2-primary" disabled>
                  Salvar
                </button>
                <button type="button" className="cd-btn-v2-secondary" disabled>
                  Cancelar
                </button>
                <button type="button" className="cd-btn-v2-tertiary" disabled>
                  Ver histórico
                </button>
                <button type="button" className="cd-btn-v2-icon" disabled aria-label="Fechar">
                  <X size={15} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* —— Inputs —— */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Inputs</h3>
          <DirBadge status="APPROVED DIRECTION" />
        </div>
        <div className="mt-5 grid max-w-md gap-4">
          <label className="cd-field-v2">
            <span className="cd-field-v2-label">Nome do pet</span>
            <input className="cd-field-v2-input" placeholder="Ex.: Luna" defaultValue="" />
          </label>
          <label className="cd-field-v2">
            <span className="cd-field-v2-label">Notas</span>
            <input className="cd-field-v2-input" placeholder="Opcional…" defaultValue="Tomou água" />
          </label>
        </div>
      </div>

      {/* —— Select —— */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Select</h3>
          <DirBadge status="APPROVED DIRECTION" />
        </div>
        <div className="relative mt-5 max-w-xs">
          <p className="cd-field-v2-label mb-1.5">Pet</p>
          <button
            type="button"
            className="cd-select-v2"
            data-open={selectOpen ? "true" : undefined}
            onClick={() => setSelectOpen((v) => !v)}
          >
            <span>{selected}</span>
            <ChevronDown size={14} strokeWidth={1.75} className="cd-select-v2-chevron" />
          </button>
          {selectOpen ? (
            <ul className="cd-select-v2-menu">
              {["Luna", "Mimi", "Theo"].map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    className="cd-select-v2-option"
                    data-selected={selected === opt ? "true" : undefined}
                    onClick={() => {
                      setSelected(opt);
                      setSelectOpen(false);
                    }}
                  >
                    {opt}
                    {selected === opt ? <FourPointStar size={9} /> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {/* —— Chips / badges —— */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Chips & badges</h3>
          <DirBadge status="APPROVED DIRECTION" />
        </div>
        <p className="cd-small mt-1 text-[var(--text-secondary)]">
          Quatro papéis. Soft/Apoio ≠ status de Brand Lab “CANDIDATE”.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="cd-chip-v2">Neutro</span>
          <span className="cd-chip-v2" data-active="true">
            Selected
          </span>
          <span className="cd-badge-v2">
            <FourPointStar size={9} />
            Especial
          </span>
          <span className="cd-badge-v2 cd-badge-v2-apoio">Apoio</span>
        </div>
        <ul className="cd-meta mt-3 space-y-1">
          <li>· Neutro — categoria / metadata</li>
          <li>· Selected — filtro ou estado selecionado</li>
          <li>· Especial — gold-soft · marco / destaque</li>
          <li>· Apoio — rosa suave · contexto afetivo secundário</li>
        </ul>
      </div>

      {/* —— Pet row —— */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Pet row</h3>
          <DirBadge status="APPROVED DIRECTION" />
        </div>
        <p className="cd-small mt-1 text-[var(--text-secondary)]">
          “Em dia” é status chip informativo — não botão / não CTA. A row pode ser clicável
          inteira; o status permanece só leitura.
        </p>
        <div className="mt-5 max-w-lg space-y-1">
          <button type="button" className="cd-pet-row cd-pet-row-interactive w-full text-left">
            <span className="cd-avatar-v2">
              <PawIcon size={18} color={ink} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Luna</p>
              <p className="cd-meta">Gata · 4 anos</p>
            </div>
            <span className="cd-status-chip" data-tone="ok">
              Em dia
            </span>
          </button>
          <div className="cd-pet-row">
            <span className="cd-avatar-v2">
              <PawIcon size={18} color={ink} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Theo</p>
              <p className="cd-meta">Cão · 2 anos</p>
            </div>
            <span className="cd-status-chip" data-tone="warn">
              Atenção
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {PET_STATUSES.map((s) => (
            <span key={s.label} className="cd-status-chip" data-tone={s.tone}>
              {s.label}
            </span>
          ))}
        </div>

        {/* Selected star — Option B APPROVED */}
        <div className="mt-8">
          <div className="flex flex-wrap items-center gap-2">
            <p className="cd-label">Selected pet · estrela</p>
            <span className="cd-status" data-status="APPROVED">
              APPROVED DIRECTION · B
            </span>
          </div>
          <p className="cd-small mt-1 text-[var(--text-secondary)]">
            Fora do chip · menor · sutil. Opção A arquivada.
          </p>
          <div className="mt-4 max-w-md">
            <div className="cd-pet-row cd-pet-row-interactive cd-home-pet-chip" data-active="true">
              <span className="cd-avatar-v2">
                <PawIcon size={16} color={ink} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Luna</p>
                <p className="cd-meta">Gata · 4 anos</p>
              </div>
              <span className="cd-status-chip" data-tone="today">
                Hoje
              </span>
              <FourPointStar size={6} className="cd-pet-star-beside" />
            </div>
          </div>
        </div>
      </div>

      {/* —— Feedback —— */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Feedback positivo</h3>
          <DirBadge status="APPROVED DIRECTION" />
        </div>
        <p className="cd-small mt-1 text-[var(--text-secondary)]">
          Status contextual — não alert pesado, não CTA.
        </p>
        <div className="mt-4 max-w-md">
          <div className="cd-feedback-v2">
            <FourPointStar size={11} />
            <p className="text-sm font-semibold">Vermífugo registrado</p>
          </div>
        </div>
      </div>

      {/* —— Cards —— */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cd-h3">Card / container</h3>
          <DirBadge status="APPROVED DIRECTION" />
        </div>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="cd-surface-lg p-5">
            <p className="cd-label">Surface LG · 24</p>
            <p className="cd-body mt-2">Lista aberta — sem card interno.</p>
            <ul className="mt-4 divide-y divide-[var(--border)]">
              {["Vacina · Luna", "Banho · Theo", "Peso · Mimi"].map((row) => (
                <li key={row} className="flex justify-between py-2.5 text-sm font-semibold">
                  <span>{row}</span>
                  <span className="cd-meta">hoje</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="cd-surface-xl p-6">
            <p className="cd-label flex items-center gap-1.5">
              Destaque XL · 32
              <FourPointStar size={10} />
            </p>
            <p className="cd-h3 mt-2">Memória especial</p>
            <p className="cd-small mt-2 text-[var(--text-secondary)]">
              Estrela só em marco afetivo.
            </p>
          </div>
        </div>
        <div className="cd-stat-v2 mt-5 max-w-xs">
          <p className="cd-label">Stat delicado</p>
          <p className="cd-editorial-num mt-1">3</p>
          <p className="cd-small text-[var(--text-secondary)]">cuidados próximos</p>
        </div>
      </div>

      {/* —— Cozy Celestial —— */}
      <div className="cd-surface-lg p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="cd-label">Cozy Celestial · selected</p>
          <DirBadge status="APPROVED DIRECTION" />
        </div>
        <ul className="cd-small mt-3 space-y-1.5">
          <li>· Item ativo: estrela pequena + gold glow / highlight contextual</li>
          <li>· Transição sutil · sem espalhar glow em toda surface</li>
          <li>· Não em ícones idle · não em utilities aleatórias</li>
          <li>· Usar em selected / special / feedback / marcos</li>
        </ul>
      </div>
    </div>
  );
}
