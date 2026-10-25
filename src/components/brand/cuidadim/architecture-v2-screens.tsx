"use client";

import { createContext, useContext, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Baby,
  Bell,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  FileStack,
  HeartPulse,
  Minus,
  Paperclip,
  Pencil,
  Plus,
  Repeat,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Syringe,
  Pill,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";
import { FourPointStar } from "@/components/brand/cuidadim/icons/FourPointStar";
import { PawIcon } from "@/components/brand/cuidadim/icons/PawIcon";
import {
  ADULT_PETS,
  AGENDA_GROUPS,
  AGENDA_REMINDERS,
  AGENDA_WEEK,
  DIA_CATS,
  FIN_TABS,
  HEALTH_PLANS,
  HISTORY,
  HISTORY_NEONATAL,
  HISTORY_PERIODS,
  HISTORY_TYPES,
  KITTENS,
  MONTHS_LONG,
  NEONATAL_HISTORY,
  PREVENTION_STATUS,
  RECORD_TYPES,
  ROTINAS,
  ROTINA_SECTIONS,
  SAUDE_CATS,
  TODAY,
  dayLabel,
  daysAgo,
  findPet,
  formatDate,
  humanAgeLabel,
  isKitten,
  lifeStageLabel,
  longDate,
  namesOf,
  petName,
  petsOf,
  planOf,
  type ArchPet,
  type CareTab,
  type Go,
  type HealthPlan,
  type HistoryPeriod,
  type PetId,
  type PetSub,
  type ProtoVariant,
  type ProtoView,
  type RecordItem,
  type RecordTypeId,
  type SaudeCat,
  type ShellId,
  type Tone,
} from "@/components/brand/cuidadim/architecture-v2-data";
import { Flag, FlagNote, RegisterEntry, RegisterFlow } from "@/components/brand/cuidadim/architecture-v2-register";

const INK = "#2A1F2F";

type CareView = Extract<ProtoView, { area: "cuidados" }>;

const STATUS_LABEL: Record<Tone, string> = {
  ok: "Em dia",
  today: "Hoje",
  warn: "Em breve",
  late: "Atrasado",
};

function StatusChip({ tone, label }: { tone?: Tone; label?: string }) {
  if (!tone && !label) return null;
  return (
    <span className="cd-status-chip" data-tone={tone}>
      {label ?? (tone ? STATUS_LABEL[tone] : "")}
    </span>
  );
}

function PetAvatar({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span className="cd-arch-avatar" data-size={size}>
      <PawIcon size={size === "sm" ? 12 : 15} color={INK} />
    </span>
  );
}

function SectionHead({ title, star, action }: { title: string; star?: boolean; action?: React.ReactNode }) {
  return (
    <div className="cd-home-section-head">
      <h3 className="cd-home-section-title">
        {title}
        {star ? <FourPointStar size={10} /> : null}
      </h3>
      {action}
    </div>
  );
}

function LinkButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="cd-btn-v2-tertiary" onClick={onClick}>
      {children}
    </button>
  );
}

function BackTo({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="cd-arch-back" onClick={onClick}>
      <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
      {label}
    </button>
  );
}

type Kind = "registro" | "rotina" | "agenda";

const KINDS: Record<Kind, { label: string; text: string; Icon: LucideIcon }> = {
  registro: { label: "Registro", text: "algo que aconteceu", Icon: Check },
  rotina: { label: "Rotina", text: "algo planejado para se repetir", Icon: Repeat },
  agenda: { label: "Agenda", text: "compromissos e lembretes temporais", Icon: CalendarClock },
};

function KindPill({ kind }: { kind: Kind }) {
  const { label, Icon } = KINDS[kind];
  return (
    <span className="cd-arch-kind" data-kind={kind}>
      <Icon size={11} strokeWidth={2} aria-hidden />
      {label}
    </span>
  );
}

function KindHeader({ kind, text }: { kind: Kind; text?: string }) {
  return (
    <p className="cd-arch-kind-head" data-kind={kind}>
      <KindPill kind={kind} />
      <span>{text ?? KINDS[kind].text}</span>
    </p>
  );
}

function ChipFilter<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="cd-arch-filter">
      <span className="cd-field-v2-label">{label}</span>
      <div className="cd-arch-chip-row cd-arch-chip-scroll">
        {options.map((o) => (
          <button
            key={String(o.id)}
            type="button"
            className="cd-chip-v2 cd-arch-chip-btn"
            data-active={value === o.id ? "true" : undefined}
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* —— Calendar (Agenda mês + Histórico personalizado) —— */

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function isoOf(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function MiniCalendar({
  range,
  onPick,
  dots,
}: {
  range?: { start?: string; end?: string };
  onPick?: (iso: string) => void;
  dots?: Set<string>;
}) {
  const [ym, setYm] = useState({ y: 2026, m: 9 });
  const first = new Date(Date.UTC(ym.y, ym.m, 1)).getUTCDay();
  const count = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array.from({ length: first }, () => null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const shift = (delta: number) =>
    setYm(({ y, m }) => {
      const next = m + delta;
      return { y: y + Math.floor(next / 12), m: ((next % 12) + 12) % 12 };
    });
  const end = range?.end ?? range?.start;

  return (
    <div className="cd-arch-cal">
      <div className="cd-arch-cal-head">
        <button type="button" className="cd-util-btn" aria-label="Mês anterior" onClick={() => shift(-1)}>
          <ChevronLeft size={15} strokeWidth={1.75} />
        </button>
        <p className="text-sm font-semibold">
          {MONTHS_LONG[ym.m]} {ym.y}
        </p>
        <button type="button" className="cd-util-btn" aria-label="Próximo mês" onClick={() => shift(1)}>
          <ChevronRight size={15} strokeWidth={1.75} />
        </button>
      </div>
      <div className="cd-arch-cal-grid" role="grid">
        {WEEKDAYS.map((w, i) => (
          <span key={`${w}-${i}`} className="cd-arch-cal-wd">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={`b-${i}`} />;
          const iso = isoOf(ym.y, ym.m, d);
          const inRange = range?.start && end ? iso >= range.start && iso <= end : false;
          const edge = iso === range?.start || iso === range?.end;
          return (
            <button
              key={iso}
              type="button"
              className="cd-arch-cal-day"
              data-in-range={inRange ? "true" : undefined}
              data-edge={edge ? "true" : undefined}
              data-today={iso === TODAY ? "true" : undefined}
              aria-pressed={edge}
              onClick={() => onPick?.(iso)}
            >
              {d}
              {dots?.has(iso) ? <span className="cd-arch-cal-dot" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* —— Cuidados · header + sub navigation —— */

const CARE_TABS: { id: CareTab; label: string }[] = [
  { id: "overview", label: "Visão geral" },
  { id: "saude", label: "Saúde" },
  { id: "alimhig", label: "Alimentação e higiene" },
  { id: "agenda", label: "Agenda" },
  { id: "rotinas", label: "Rotinas" },
  { id: "historico", label: "Histórico" },
];

function CareSubnav({ view, go, neonatal }: { view: CareView; go: Go; neonatal: boolean }) {
  return (
    <nav className="cd-arch-subnav" aria-label="Cuidados">
      <div className="cd-arch-subnav-primary">
        {CARE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="cd-arch-tab"
            data-active={view.tab === tab.id ? "true" : undefined}
            aria-current={view.tab === tab.id ? "page" : undefined}
            onClick={() => go({ area: "cuidados", tab: tab.id })}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {neonatal ? (
        <>
          <span className="cd-arch-subnav-divider" aria-hidden />
          <button
            type="button"
            className="cd-arch-tab cd-arch-tab-context"
            data-active={view.tab === "neonatal" ? "true" : undefined}
            onClick={() => go({ area: "cuidados", tab: "neonatal" })}
          >
            <span className="cd-arch-dot" aria-hidden />
            Neonatal
          </button>
        </>
      ) : null}
    </nav>
  );
}

/* —— Cuidados · Visão geral —— */

const SHORTCUTS: { tab: CareTab; label: string; meta: string; Icon: LucideIcon; kind: Kind }[] = [
  { tab: "saude", label: "Saúde", meta: "1 vacina pendente", Icon: HeartPulse, kind: "registro" },
  { tab: "alimhig", label: "Alimentação e higiene", meta: "3 refeições hoje", Icon: UtensilsCrossed, kind: "registro" },
  { tab: "agenda", label: "Agenda", meta: "1 atrasado · 1 hoje", Icon: CalendarDays, kind: "agenda" },
  { tab: "rotinas", label: "Rotinas", meta: "6 rotinas · 1 atrasada", Icon: Repeat, kind: "rotina" },
  { tab: "historico", label: "Histórico", meta: "4 registros hoje", Icon: Clock, kind: "registro" },
];

function CareOverview({ go, neonatal }: { go: Go; neonatal: boolean }) {
  return (
    <>
      {neonatal ? (
        <button type="button" className="cd-arch-context-banner" onClick={() => go({ area: "cuidados", tab: "neonatal" })}>
          <Baby size={18} strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-semibold">Cuidados neonatais · {KITTENS.length} filhotes</span>
            <span className="cd-meta">{namesOf(KITTENS.map((k) => k.id))} · 15 dias</span>
          </span>
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}

      <section className="cd-arch-attention">
        <p className="cd-label flex items-center gap-1.5">
          Pede atenção
          <FourPointStar size={9} />
        </p>
        <div className="cd-arch-attention-rows">
          <button type="button" className="cd-arch-attention-row" onClick={() => go({ area: "cuidados", tab: "agenda" })}>
            <span className="text-sm font-semibold">Comprar ração</span>
            <span className="cd-arch-attention-meta">
              <KindPill kind="agenda" />
              <span className="cd-meta">lembrete atrasado</span>
            </span>
          </button>
          <button type="button" className="cd-arch-attention-row" onClick={() => go({ area: "cuidados", tab: "rotinas" })}>
            <span className="text-sm font-semibold">Escovação da pelagem · Hinata</span>
            <span className="cd-arch-attention-meta">
              <KindPill kind="rotina" />
              <span className="cd-meta">atrasada</span>
            </span>
          </button>
          <button type="button" className="cd-arch-attention-row" onClick={() => go({ area: "cuidados", tab: "saude", saudeCat: "vacinas" })}>
            <span className="text-sm font-semibold">V4 · 2ª dose · Gwen</span>
            <span className="cd-meta">Saúde · status do protocolo preventivo</span>
          </button>
        </div>
      </section>

      <div className="cd-arch-two-col mt-5">
        <section className="cd-home-section">
          <SectionHead
            title="Próximos cuidados"
            star
            action={<LinkButton onClick={() => go({ area: "cuidados", tab: "agenda" })}>Ver agenda</LinkButton>}
          />
          <ul className="cd-home-list">
            {AGENDA_REMINDERS.filter((r) => r.group !== "Atrasados")
              .slice(0, 3)
              .map((r) => (
                <li key={r.id} className={r.tone === "today" ? "cd-home-list-item cd-home-list-item-priority" : "cd-home-list-item"}>
                  <span className="cd-home-list-icon">
                    <Bell size={16} strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="cd-home-list-title">{r.title}</p>
                    <p className="cd-meta">
                      {r.group} · {r.time}
                    </p>
                  </div>
                  {r.tone ? <StatusChip tone={r.tone} /> : null}
                </li>
              ))}
          </ul>
        </section>
        <section className="cd-home-section">
          <SectionHead
            title="Atividade recente"
            action={<LinkButton onClick={() => go({ area: "cuidados", tab: "historico" })}>Ver histórico</LinkButton>}
          />
          <ul className="cd-home-list">
            {HISTORY.slice(0, 3).map((h) => {
              const Icon = RECORD_TYPES[h.type].icon;
              return (
                <li key={h.id} className="cd-home-list-item">
                  <span className="cd-home-list-icon">
                    <Icon size={17} strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="cd-home-list-title">
                      {RECORD_TYPES[h.type].label} · {petName(h.pet)}
                    </p>
                    <p className="cd-meta">
                      {h.title} · {dayLabel(h.date)} {h.time}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="cd-home-section">
        <SectionHead title="Pets" />
        <ul className="cd-arch-pet-summary">
          {ADULT_PETS.map((pet) => (
            <li key={pet.id}>
              <button type="button" className="cd-arch-pet-summary-row" onClick={() => go({ area: "pets", petId: pet.id })}>
                <PetAvatar />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold">{pet.name}</span>
                  <span className="cd-meta block truncate">{pet.meta}</span>
                </span>
                <StatusChip tone={pet.tone} label={pet.statusLabel} />
                <ChevronRight size={15} strokeWidth={1.75} className="cd-arch-chevron" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="cd-home-section">
        <SectionHead title="Atalhos" />
        <div className="cd-arch-domain-grid">
          {SHORTCUTS.map(({ tab, label, meta, Icon, kind }) => (
            <button key={tab} type="button" className="cd-arch-domain-tile" onClick={() => go({ area: "cuidados", tab })}>
              <span className="cd-arch-domain-icon">
                <Icon size={18} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="cd-meta block">{meta}</span>
              <KindPill kind={kind} />
            </button>
          ))}
        </div>
      </section>

      {!neonatal ? (
        <button type="button" className="cd-arch-secondary-row mt-4" onClick={() => go({ area: "cuidados", tab: "neonatal" })}>
          <Baby size={16} strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-semibold">Neonatal</span>
            <span className="cd-meta">Aparece em destaque quando houver filhote de até 8 semanas</span>
          </span>
          <ChevronRight size={15} strokeWidth={1.75} className="cd-arch-chevron" aria-hidden />
        </button>
      ) : null}
    </>
  );
}

/* —— Category index / detail (Saúde) —— */

type CatRow = { id: string; label: string; summary: string; attention?: string; icon: LucideIcon; note?: string };

function CategoryIndex({ groups, onOpen }: { groups: { label: string; rows: CatRow[] }[]; onOpen: (id: string) => void }) {
  return (
    <div className="cd-arch-cat-groups">
      {groups.map((group) => (
        <section key={group.label} className="cd-arch-cat-group" aria-label={group.label}>
          <p className="cd-label">{group.label}</p>
          <ul className="cd-arch-cat-list">
            {group.rows.map((row) => {
              const Icon = row.icon;
              return (
                <li key={row.id}>
                  <button type="button" className="cd-arch-cat-row" onClick={() => onOpen(row.id)}>
                    <span className="cd-arch-cat-icon">
                      <Icon size={17} strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        {row.label}
                        {row.note ? <span className="cd-chip-v2">{row.note}</span> : null}
                      </span>
                      <span className="cd-meta block truncate">{row.attention ?? row.summary}</span>
                    </span>
                    {row.attention ? <FourPointStar size={8} className="cd-arch-attention-star" title="atenção" /> : null}
                    <ChevronRight size={15} strokeWidth={1.75} className="cd-arch-chevron" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function OpenRecord({ item }: { item: RecordItem }) {
  return (
    <dl className="cd-arch-dl cd-arch-open-record">
      <div>
        <dt>Pet</dt>
        <dd>{petName(item.pet)}</dd>
      </div>
      <div>
        <dt>Quando</dt>
        <dd>{item.meta}</dd>
      </div>
      {item.place ? (
        <div>
          <dt>Clínica ou veterinário</dt>
          <dd>{item.place}</dd>
        </div>
      ) : null}
      {item.notes ? (
        <div>
          <dt>Observação</dt>
          <dd>{item.notes}</dd>
        </div>
      ) : null}
      {item.attachment ? (
        <div>
          <dt>Anexo</dt>
          <dd>{item.attachment}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function CategoryDetail({
  areaLabel,
  onBack,
  cats,
  current,
  onSelect,
  items,
  summary,
  highlight,
  onOpen,
  cta,
  reminder,
  insight,
  fromPet,
  go,
}: {
  areaLabel: string;
  onBack: () => void;
  cats: { id: string; label: string }[];
  current: string;
  onSelect: (id: string) => void;
  items: RecordItem[];
  summary: string;
  highlight?: string;
  onOpen: (id?: string) => void;
  cta?: { label: string; onClick: () => void };
  reminder?: { label: string; onClick: () => void };
  insight?: React.ReactNode;
  fromPet?: PetId;
  go: Go;
}) {
  const label = cats.find((c) => c.id === current)?.label ?? "";
  const open = items.find((i) => i.id === highlight);
  return (
    <div className="cd-arch-stack">
      {fromPet ? (
        <>
          <BackTo label={`Voltar para ${petName(fromPet)}`} onClick={() => go({ area: "pets", petId: fromPet })} />
          <FlagNote kind="future" flag="FUTURE NAVIGATION">
            Pet → Saúde → categoria → registro específico. Hoje o registro só abre em Editar.
          </FlagNote>
        </>
      ) : null}
      <div className="cd-arch-crumbs">
        <button type="button" className="cd-arch-back" onClick={onBack}>
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
          {areaLabel}
        </button>
        <span className="cd-meta">/ {label}</span>
        {open ? <span className="cd-meta">/ {open.title}</span> : null}
      </div>
      <div className="cd-arch-chip-row cd-arch-chip-scroll" role="tablist" aria-label={`Categorias de ${areaLabel}`}>
        {cats.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === current}
            className="cd-chip-v2 cd-arch-chip-btn"
            data-active={c.id === current ? "true" : undefined}
            onClick={() => onSelect(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="cd-arch-detail-head">
        <div className="min-w-0">
          <h3 className="cd-home-section-title">{label}</h3>
          <p className="cd-meta">{summary}</p>
        </div>
        {cta ? (
          <button type="button" className="cd-btn-v2-secondary" onClick={cta.onClick}>
            <Plus size={14} strokeWidth={1.75} aria-hidden />
            {cta.label}
          </button>
        ) : null}
      </div>
      {insight}
      {reminder ? (
        <button type="button" className="cd-arch-next-row" onClick={reminder.onClick}>
          <Bell size={15} strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1 text-left">
            <span className="cd-meta block">Lembrete · na Agenda</span>
            <span className="block text-sm font-semibold">{reminder.label}</span>
          </span>
          <ChevronRight size={15} strokeWidth={1.75} className="cd-arch-chevron" aria-hidden />
        </button>
      ) : null}
      <ul className="cd-home-list">
        {items.map((item) => {
          const isOpen = item.id === highlight;
          return (
            <li key={item.id} className="cd-arch-record" data-open={isOpen ? "true" : undefined}>
              <button
                type="button"
                className="cd-arch-record-row"
                aria-expanded={isOpen}
                onClick={() => onOpen(isOpen ? undefined : item.id)}
              >
                <PetAvatar size="sm" />
                <span className="min-w-0 flex-1 text-left">
                  <span className="cd-home-list-title block">
                    {item.title} <span className="cd-arch-pet-tag">· {petName(item.pet)}</span>
                  </span>
                  <span className="cd-meta block">{item.meta}</span>
                </span>
                <StatusChip tone={item.tone} label={item.status} />
              </button>
              {isOpen ? (
                <div className="cd-arch-open-wrap">
                  <p className="cd-label flex items-center gap-1.5">
                    Detalhe do registro
                    <Flag kind="future">FUTURE NAVIGATION</Flag>
                  </p>
                  <OpenRecord item={item} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* —— Saúde —— */

function PlanRows({ plans, go }: { plans: HealthPlan[]; go: Go }) {
  return (
    <ul className="cd-arch-plan-list">
      {plans.map((p) => (
        <li key={p.pet} className="cd-arch-plan-ctx">
          <div className="min-w-0 flex-1">
            <p className="cd-label">Plano de saúde</p>
            <p className="mt-1 text-sm font-semibold">{petName(p.pet)}</p>
            <p className="cd-meta">
              {p.provider} · {p.planName}
            </p>
            <ul className="cd-arch-plan-ctx-list">
              <li>
                <span className="cd-meta">Mensalidade</span>
                {p.fee}
              </li>
              <li>
                <span className="cd-meta">Cobertura</span>
                {p.coverage}
              </li>
              <li>
                <span className="cd-meta">Coparticipação</span>
                {p.copay[0].service} · {p.copay[0].value}
              </li>
            </ul>
          </div>
          <div className="cd-arch-plan-ctx-cta">
            <span className="cd-badge-v2 cd-badge-v2-apoio">{p.active ? "Ativo" : "Inativo"}</span>
            <button type="button" className="cd-btn-v2-secondary" onClick={() => go({ area: "financas", tab: "planos", fromPet: p.pet })}>
              Ver plano
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PreventionInsight({ go, cat }: { go: Go; cat?: SaudeCat }) {
  const list = PREVENTION_STATUS.filter((s) => !cat || s.cat === cat);
  if (!list.length) return null;
  return (
    <section className="cd-arch-insight" aria-label="Prevenção">
      <p className="cd-label flex flex-wrap items-center gap-1.5">
        Prevenção
        <Flag kind="insight">STATUS / INSIGHT</Flag>
      </p>
      <p className="cd-meta">Derivado do protocolo preventivo do pet. Não é categoria de registro.</p>
      <ul className="cd-arch-mini-list">
        {list.map((s) => (
          <li key={s.pet + s.text}>
            <button type="button" className="cd-arch-insight-row" onClick={() => go({ area: "cuidados", tab: "saude", saudeCat: s.cat })}>
              <span className="text-sm font-semibold">
                {s.text} · {petName(s.pet)}
              </span>
              <StatusChip tone={s.tone} label={s.tone === "warn" ? "Pendente" : undefined} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SaudeView({ view, go, neonatal }: { view: CareView; go: Go; neonatal: boolean }) {
  const cats = SAUDE_CATS.filter((c) => !c.puppyOnly || neonatal);
  const current = cats.find((c) => c.id === view.saudeCat);
  if (current) {
    return (
      <CategoryDetail
        areaLabel="Saúde"
        onBack={() => go({ area: "cuidados", tab: "saude" })}
        cats={cats}
        current={current.id}
        onSelect={(id) => go({ area: "cuidados", tab: "saude", saudeCat: id as SaudeCat })}
        items={current.items}
        summary={current.summary}
        highlight={view.highlight}
        onOpen={(id) => go({ area: "cuidados", tab: "saude", saudeCat: current.id, highlight: id, fromPet: view.fromPet })}
        cta={{ label: RECORD_TYPES[current.record].action, onClick: () => go({ area: "registrar", types: [current.record] }) }}
        reminder={current.reminder ? { label: current.reminder, onClick: () => go({ area: "cuidados", tab: "agenda" }) } : undefined}
        insight={<PreventionInsight go={go} cat={current.id} />}
        fromPet={view.fromPet}
        go={go}
      />
    );
  }

  const rows = (group: "clinico" | "medidas"): CatRow[] =>
    cats
      .filter((c) => c.group === group)
      .map((c) => ({
        id: c.id,
        label: c.label,
        summary: c.summary,
        icon: RECORD_TYPES[c.record].icon,
        note: c.puppyOnly ? "só filhotes" : undefined,
      }));

  return (
    <div className="cd-arch-stack">
      <KindHeader kind="registro" text="consultas, vacinas, medicamentos, exames e medidas de cada pet" />
      <PreventionInsight go={go} />
      <CategoryIndex
        groups={[
          { label: "Acompanhamento", rows: rows("clinico") },
          { label: "Medidas", rows: rows("medidas") },
        ]}
        onOpen={(id) => go({ area: "cuidados", tab: "saude", saudeCat: id as SaudeCat })}
      />
      <section aria-label="Planos de saúde">
        <SectionHead title="Planos de saúde" />
        <PlanRows plans={HEALTH_PLANS} go={go} />
        <p className="cd-meta mt-2">Um plano por pet · administração em Finanças → Planos.</p>
      </section>
    </div>
  );
}

/* —— Alimentação e higiene (visão de interface sobre registros já ocorridos) —— */

function AlimHigView({ go }: { go: Go }) {
  return (
    <div className="cd-arch-stack">
      <KindHeader kind="registro" text="o que já foi registrado de alimentação e higiene" />
      <div className="cd-arch-two-col">
        {DIA_CATS.map((c) => {
          const Icon = RECORD_TYPES[c.record].icon;
          const done = Array.from(new Set(c.items.map((i) => i.title)));
          return (
            <section key={c.id} className="cd-arch-log" aria-label={c.label}>
              <div className="cd-arch-log-head">
                <span className="cd-arch-cat-icon">
                  <Icon size={17} strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="cd-home-section-title">{c.label}</h3>
                  <p className="cd-meta">Hoje: {c.today}</p>
                </div>
                <button type="button" className="cd-btn-v2-secondary" onClick={() => go({ area: "registrar", types: [c.record] })}>
                  <Plus size={14} strokeWidth={1.75} aria-hidden />
                  Registrar
                </button>
              </div>
              {c.id === "higiene" ? (
                <div>
                  <p className="cd-label">Cuidados realizados</p>
                  <div className="cd-arch-chip-row mt-1">
                    {done.map((d) => (
                      <span key={d} className="cd-chip-v2">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <ul className="cd-arch-log-list">
                {c.items.map((item) => (
                  <li key={item.id}>
                    <span className="cd-arch-log-check" aria-hidden>
                      <Check size={11} strokeWidth={2.25} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {item.title} <span className="cd-arch-pet-tag">· {petName(item.pet)}</span>
                      </span>
                      <span className="cd-meta block">{item.meta}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <LinkButton onClick={() => go({ area: "cuidados", tab: "historico", historyType: c.record })}>Ver no histórico</LinkButton>
            </section>
          );
        })}
      </div>
      <p className="cd-meta">Xixi, cocô e temperatura ficam em Neonatal: são registros só de filhotes.</p>
    </div>
  );
}

/* —— Rotinas (tarefas livres) —— */

function RotinasView() {
  const statuses = ROTINAS.flatMap((r) => r.pets.map((p) => p.status));
  const count = (s: string) => statuses.filter((x) => x === s).length;
  return (
    <div className="cd-arch-stack">
      <KindHeader kind="rotina" text="algo planejado para se repetir · concluir não cria registro" />
      <div className="cd-arch-today-strip">
        {[
          { label: "Para hoje", value: count("Para hoje") },
          { label: "Atrasadas", value: count("Atrasada") },
          { label: "Concluído hoje", value: count("Concluído hoje") },
          { label: "Rotinas", value: ROTINAS.length },
        ].map((s) => (
          <div key={s.label} className="cd-arch-today-cell" data-static="true">
            <span className="cd-meta">{s.label}</span>
            <span className="text-sm font-semibold">{s.value}</span>
          </div>
        ))}
      </div>
      <div className="cd-arch-detail-head">
        <h3 className="cd-home-section-title">Rotinas</h3>
        <button type="button" className="cd-btn-v2-secondary" title="Fora desta rodada">
          <Plus size={14} strokeWidth={1.75} aria-hidden />
          Nova rotina
        </button>
      </div>
      <div className="cd-arch-cat-groups">
        {ROTINA_SECTIONS.map((section) => {
          const list = ROTINAS.filter((r) => r.section === section.id);
          if (!list.length) return null;
          return (
            <section key={section.id} aria-label={section.label}>
              <p className="cd-label">{section.label}</p>
              <ul className="cd-arch-cat-list">
                {list.map((r) => (
                  <li key={r.id} className="cd-arch-routine" data-paused={section.id === "pausadas" ? "true" : undefined}>
                    <span className="cd-arch-cat-icon">
                      <Repeat size={16} strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{r.title}</span>
                      <span className="cd-meta block">
                        {r.freq}
                        {r.time ? ` · ${r.time}` : ""}
                      </span>
                      <span className="cd-arch-pet-status">
                        {r.pets.map((p) => (
                          <StatusChip key={p.pet} tone={p.tone} label={`${petName(p.pet)} · ${p.status}`} />
                        ))}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="cd-meta">Ícones e sugestões de nome são decorativos: rotina não tem categoria.</p>
    </div>
  );
}

/* —— Agenda (compromissos e lembretes temporais) —— */

function AgendaView() {
  const [mode, setMode] = useState<"semana" | "mes">("semana");
  const dots = new Set(AGENDA_REMINDERS.map((r) => r.date));
  const nextAction = AGENDA_REMINDERS.find((r) => r.group === "Hoje");
  return (
    <div className="cd-arch-stack">
      <KindHeader kind="agenda" />
      {nextAction ? (
        <div className="cd-arch-next-row" data-static="true">
          <Bell size={15} strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1 text-left">
            <span className="cd-meta block">Próxima ação</span>
            <span className="block text-sm font-semibold">
              {nextAction.title} · hoje, {nextAction.time}
            </span>
          </span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="cd-arch-seg" role="group" aria-label="Visualização da agenda">
          <button type="button" aria-pressed={mode === "semana"} onClick={() => setMode("semana")}>
            Semana
          </button>
          <button type="button" aria-pressed={mode === "mes"} onClick={() => setMode("mes")}>
            Mês
          </button>
        </div>
        <button type="button" className="cd-btn-v2-secondary" title="Fora desta rodada">
          <Plus size={14} strokeWidth={1.75} aria-hidden />
          Novo lembrete
        </button>
      </div>
      {mode === "semana" ? (
        <div className="cd-arch-week" role="list" aria-label="Semana">
          {AGENDA_WEEK.map((d) => {
            const n = AGENDA_REMINDERS.filter((r) => r.date === d.iso).length;
            return (
              <div key={d.iso} role="listitem" className="cd-arch-week-day" data-today={d.today ? "true" : undefined}>
                <span className="cd-meta">{d.day}</span>
                <span className="cd-arch-week-date">{d.date}</span>
                <span className="cd-arch-week-dots" aria-label={`${n} lembretes`}>
                  {Array.from({ length: n }).map((_, i) => (
                    <span key={i} />
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="cd-arch-cal-wrap">
          <MiniCalendar dots={dots} />
        </div>
      )}

      <section>
        {AGENDA_GROUPS.map((g) => {
          const list = AGENDA_REMINDERS.filter((r) => r.group === g);
          if (!list.length) return null;
          return (
            <div key={g} className="cd-arch-agenda-group">
              <p className="cd-label">{g}</p>
              <ul className="cd-home-list">
                {list.map((r) => {
                  const Icon = r.record ? RECORD_TYPES[r.record].icon : Bell;
                  return (
                    <li key={r.id} className="cd-home-list-item">
                      <span className="cd-arch-time">{g === "Próximos dias" ? dayLabel(r.date) : r.time}</span>
                      <span className="cd-home-list-icon">
                        <Icon size={16} strokeWidth={1.75} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="cd-home-list-title">{r.title}</p>
                        <p className="cd-meta">
                          {r.category}
                          {r.pet ? ` · ${petName(r.pet)}` : " · família"}
                          {r.repeat ? ` · ${r.repeat}` : ""}
                        </p>
                      </div>
                      {r.tone ? <StatusChip tone={r.tone} /> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="cd-arch-future" aria-label="Agregação futura">
        <Flag kind="future">FUTURE AGGREGATION — REQUIRES NEW LOGIC</Flag>
        <p className="cd-meta">
          Protocolo preventivo, rotinas, plano e neonatal não alimentam a Agenda hoje. Exemplos que só apareceriam aqui com lógica nova:
        </p>
        <ul className="cd-arch-future-list">
          <li>V4 · 2ª dose · Gwen — protocolo preventivo</li>
          <li>Escovação da pelagem · Hinata — rotina</li>
          <li>Mamadas dos filhotes — neonatal</li>
        </ul>
      </section>
    </div>
  );
}

/* —— Histórico (família) —— */

function Timeline({ items }: { items: typeof HISTORY }) {
  const days = Array.from(new Set(items.map((h) => h.date)));
  if (!days.length) {
    return (
      <div className="cd-arch-empty">
        <p className="text-sm font-semibold">Nada neste recorte.</p>
        <p className="cd-meta">Tente outro período ou tipo.</p>
      </div>
    );
  }
  return (
    <ol className="cd-arch-timeline">
      {days.map((day) => (
        <li key={day} className="cd-arch-timeline-day">
          <p className="cd-label">{dayLabel(day)}</p>
          <ul>
            {items
              .filter((h) => h.date === day)
              .map((h) => {
                const Icon = RECORD_TYPES[h.type].icon;
                return (
                  <li key={h.id} className="cd-arch-timeline-item">
                    <span className="cd-arch-timeline-icon">
                      <Icon size={15} strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {RECORD_TYPES[h.type].label} · {h.title}
                      </p>
                      <p className="cd-meta">
                        {petName(h.pet)} · {h.time}
                        {h.detail ? ` · ${h.detail}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function sortHistory(items: typeof HISTORY) {
  return [...items].sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)));
}

function typeOptions(neonatal: boolean) {
  return [
    { id: "all" as const, label: "Todos" },
    ...HISTORY_TYPES.filter((t) => neonatal || !RECORD_TYPES[t].puppyOnly).map((t) => ({ id: t, label: RECORD_TYPES[t].label })),
  ];
}

function HistoricoView({ initialType, neonatal }: { initialType?: RecordTypeId; neonatal: boolean }) {
  const [kind, setKind] = useState<RecordTypeId | "all">(initialType ?? "all");
  const [period, setPeriod] = useState<HistoryPeriod>(30);
  const [range, setRange] = useState<{ start?: string; end?: string }>({ start: "2026-09-01", end: "2026-09-30" });
  const [query, setQuery] = useState("");

  const pick = (iso: string) =>
    setRange((r) => {
      if (!r.start || r.end) return { start: iso, end: undefined };
      return iso < r.start ? { start: iso, end: r.start } : { start: r.start, end: iso };
    });

  const inPeriod = (date: string) => {
    if (period === "custom") {
      const end = range.end ?? range.start;
      return Boolean(range.start && end && date >= range.start && date <= end);
    }
    const d = daysAgo(date);
    return d >= 0 && d < period;
  };

  const q = query.trim().toLowerCase();
  const items = sortHistory([...HISTORY, ...(neonatal ? HISTORY_NEONATAL : [])]).filter(
    (h) =>
      (kind === "all" || h.type === kind) &&
      inPeriod(h.date) &&
      (!q || `${h.title} ${RECORD_TYPES[h.type].label} ${petName(h.pet)}`.toLowerCase().includes(q))
  );

  return (
    <div className="cd-arch-stack">
      <KindHeader kind="registro" text="tudo o que já foi registrado, da família inteira" />
      <div className="cd-arch-filters">
        <label className="cd-arch-search">
          <Search size={14} strokeWidth={1.75} aria-hidden />
          <input placeholder="Buscar por leite, vacina, consulta..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar no histórico" />
          {query ? (
            <button type="button" aria-label="Limpar busca" onClick={() => setQuery("")}>
              <X size={13} strokeWidth={1.75} />
            </button>
          ) : null}
        </label>
        <ChipFilter label="Tipo" options={typeOptions(neonatal)} value={kind} onChange={setKind} />
        <ChipFilter label="Período" options={HISTORY_PERIODS} value={period} onChange={setPeriod} />
        {period === "custom" ? (
          <div className="cd-arch-range">
            <div className="cd-arch-range-fields">
              <label className="cd-field-v2">
                <span className="cd-field-v2-label">Data inicial</span>
                <span className="cd-field-v2-input cd-arch-range-value" data-empty={range.start ? undefined : "true"}>
                  {range.start ? formatDate(range.start) : "dd/mm/aaaa"}
                </span>
              </label>
              <label className="cd-field-v2">
                <span className="cd-field-v2-label">Data final</span>
                <span className="cd-field-v2-input cd-arch-range-value" data-empty={range.end ? undefined : "true"}>
                  {range.end ? formatDate(range.end) : "escolha no calendário"}
                </span>
              </label>
            </div>
            <MiniCalendar range={range} onPick={pick} />
            <p className="cd-meta">Toque na data inicial e depois na final.</p>
          </div>
        ) : null}
      </div>
      <Timeline items={items} />
    </div>
  );
}

/* —— Neonatal (contextual) —— */

function NeonatalView({ view, go, neonatal, onEnable }: { view: CareView; go: Go; neonatal: boolean; onEnable: () => void }) {
  if (!neonatal) {
    return (
      <div className="cd-arch-empty cd-arch-empty-wide">
        <Baby size={22} strokeWidth={1.5} aria-hidden />
        <p className="text-sm font-semibold">Nenhum filhote em fase neonatal.</p>
        <p className="cd-meta max-w-[22rem]">
          Neonatal só ganha aba e destaque quando há filhote de até 8 semanas. Fora disso, fica discreto na Visão geral.
        </p>
        <button type="button" className="cd-btn-v2-secondary" onClick={onEnable}>
          Ver cenário com filhotes
        </button>
      </div>
    );
  }

  if (view.neonatalHistory) {
    const days = Array.from(new Set(NEONATAL_HISTORY.map((h) => h.day)));
    return (
      <div className="cd-arch-stack">
        <BackTo label="Neonatal" onClick={() => go({ area: "cuidados", tab: "neonatal" })} />
        <div>
          <h3 className="cd-home-section-title">Histórico neonatal</h3>
          <p className="cd-meta">Filhotes em fase neonatal · alimentação, peso, xixi, cocô e temperatura</p>
        </div>
        <div className="cd-arch-chip-row">
          {["Hoje", "De", "Até"].map((c, i) => (
            <span key={c} className="cd-chip-v2" data-active={i === 0 ? "true" : undefined}>
              {c}
            </span>
          ))}
        </div>
        <ol className="cd-arch-timeline">
          {days.map((day) => (
            <li key={day} className="cd-arch-timeline-day">
              <p className="cd-label">{day}</p>
              <ul>
                {NEONATAL_HISTORY.filter((h) => h.day === day).map((h) => {
                  const Icon = RECORD_TYPES[h.type].icon;
                  return (
                    <li key={`${h.time}-${h.pet}-${h.title}`} className="cd-arch-timeline-item">
                      <span className="cd-arch-timeline-icon">
                        <Icon size={14} strokeWidth={1.75} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          {RECORD_TYPES[h.type].label} · {h.title}
                        </p>
                        <p className="cd-meta">
                          {petName(h.pet)} · {h.time}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const quick: { label: string; types: RecordTypeId[] }[] = [
    { label: "Alimentação", types: ["alimentacao"] },
    { label: "Peso", types: ["peso"] },
    { label: "Xixi e cocô", types: ["xixi", "coco"] },
  ];

  return (
    <div className="cd-arch-stack">
      <div className="cd-arch-detail-head">
        <div>
          <h3 className="cd-home-section-title">Cuidados neonatais</h3>
          <p className="cd-meta">Filhotes em fase neonatal · até 8 semanas. Some quando passam dessa fase.</p>
        </div>
        <span className="cd-chip-v2" data-active="true">
          Neonatal automático
        </span>
      </div>
      <div className="cd-arch-kitten-grid">
        {KITTENS.map((k) => {
          const max = Math.max(...k.weights);
          const info = k.kitten;
          return (
            <div key={k.id} className="cd-arch-kitten">
              <div className="flex items-center gap-2">
                <PetAvatar size="sm" />
                <p className="text-sm font-semibold">{k.name}</p>
                <span className="cd-meta ml-auto">
                  {k.meta} · {k.weight}
                </span>
              </div>
              <div className="cd-arch-bars" aria-label={`Peso de ${k.name}`}>
                {k.weights.map((v, i) => (
                  <span key={i} style={{ height: `${Math.round((v / max) * 100)}%` }} />
                ))}
              </div>
              {info ? (
                <p className="cd-meta">
                  Hoje: {info.feeds} {info.feeds === 1 ? "mamada" : "mamadas"} · {info.pees} {info.pees === 1 ? "xixi" : "xixis"} ·{" "}
                  {info.poops} {info.poops === 1 ? "cocô" : "cocôs"} · última {info.last}
                </p>
              ) : null}
              <div className="cd-arch-kitten-actions">
                {quick.map((qa) => (
                  <button
                    key={qa.label}
                    type="button"
                    className="cd-chip-v2 cd-arch-chip-btn"
                    onClick={() => go({ area: "registrar", types: qa.types, pets: [k.id] })}
                  >
                    <Plus size={11} strokeWidth={2} aria-hidden />
                    {qa.label}
                  </button>
                ))}
                <button type="button" className="cd-chip-v2 cd-arch-chip-btn" onClick={() => go({ area: "registrar" })}>
                  <Plus size={11} strokeWidth={2} aria-hidden />
                  Novo cuidado
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="cd-arch-link-quiet" onClick={() => go({ area: "cuidados", tab: "neonatal", neonatalHistory: true })}>
        Ver histórico neonatal
        <ChevronRight size={13} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

/* —— Cuidados page —— */

function CarePage({ view, go, neonatal, onEnableNeonatal }: { view: CareView; go: Go; neonatal: boolean; onEnableNeonatal: () => void }) {
  return (
    <div className="cd-arch-page">
      <header className="cd-arch-page-head">
        <p className="cd-label">Cuidados</p>
        <h2 className="cd-arch-title">Cuidados</h2>
        <p className="cd-arch-lede">Saúde, alimentação e higiene, e o que vem pela frente.</p>
      </header>
      <CareSubnav view={view} go={go} neonatal={neonatal} />
      <div className="cd-arch-care-body">
        {view.tab === "overview" ? <CareOverview go={go} neonatal={neonatal} /> : null}
        {view.tab === "saude" ? <SaudeView view={view} go={go} neonatal={neonatal} /> : null}
        {view.tab === "alimhig" ? <AlimHigView go={go} /> : null}
        {view.tab === "agenda" ? <AgendaView /> : null}
        {view.tab === "rotinas" ? <RotinasView /> : null}
        {view.tab === "historico" ? <HistoricoView key={view.historyType ?? "all"} initialType={view.historyType} neonatal={neonatal} /> : null}
        {view.tab === "neonatal" ? <NeonatalView view={view} go={go} neonatal={neonatal} onEnable={onEnableNeonatal} /> : null}
      </div>
    </div>
  );
}

/* —— Pets (contexto) —— */

/** "before" = página do pet do M0.1V, mantida só para a comparação do lab. */
export type PetPageVersion = "before" | "after";

export const PetPageVersionContext = createContext<PetPageVersion>("after");

function PetsTabs({ active, go }: { active: "pets" | "memorias"; go: Go }) {
  return (
    <div className="cd-arch-chip-row" role="tablist" aria-label="Pets">
      <button type="button" role="tab" aria-selected={active === "pets"} className="cd-chip-v2 cd-arch-chip-btn" data-active={active === "pets" ? "true" : undefined} onClick={() => go({ area: "pets" })}>
        Pets
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "memorias"}
        className="cd-chip-v2 cd-arch-chip-btn"
        data-active={active === "memorias" ? "true" : undefined}
        onClick={() => go({ area: "memorias" })}
      >
        Memórias da família
      </button>
    </div>
  );
}

function neuteredLabel(pet: ArchPet) {
  return pet.sex === "Fêmea" ? "Castrada" : "Castrado";
}

function PetsListBefore({ go, neonatal }: { go: Go; neonatal: boolean }) {
  return (
    <div className="cd-arch-page">
      <header className="cd-arch-page-head">
        <p className="cd-label">Pets</p>
        <h2 className="cd-arch-title">Pets</h2>
        <p className="cd-arch-lede">Cada pet é um contexto: cadastro, cuidados, plano e memórias.</p>
      </header>
      <div className="mb-4">
        <PetsTabs active="pets" go={go} />
      </div>
      <ul className="cd-arch-pet-summary">
        {petsOf(neonatal).map((pet) => (
          <li key={pet.id}>
            <button type="button" className="cd-arch-pet-summary-row cd-arch-pet-row-rich" onClick={() => go({ area: "pets", petId: pet.id })}>
              <span className="cd-arch-pet-photo" data-size="md" aria-hidden>
                <PawIcon size={16} color={INK} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold">{pet.name}</span>
                  {pet.neutered ? (
                    <span className="cd-arch-fact" data-tone="positive">
                      <BadgeCheck size={11} strokeWidth={2} aria-hidden />
                      {neuteredLabel(pet)}
                    </span>
                  ) : null}
                </span>
                <span className="cd-meta block truncate">
                  {[pet.breed, `${pet.meta} de vida`].filter(Boolean).join(" · ")} · {humanAgeLabel(pet.birthDate)}
                </span>
                <span className="cd-arch-pet-row-weight">
                  <Scale size={12} strokeWidth={1.75} aria-hidden />
                  {pet.weight}
                </span>
              </span>
              <StatusChip tone={pet.tone} label={pet.statusLabel} />
              <ChevronRight size={15} strokeWidth={1.75} className="cd-arch-chevron" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PetHeaderBefore({ petId, go, tab }: { petId: PetId; go: Go; tab: "overview" | "memorias" | "historico" }) {
  const pet = findPet(petId);
  const chip = (id: typeof tab, label: string, view: ProtoView) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      className="cd-chip-v2 cd-arch-chip-btn"
      data-active={tab === id ? "true" : undefined}
      onClick={() => go(view)}
    >
      {label}
    </button>
  );
  return (
    <>
      <BackTo label="Pets" onClick={() => go({ area: "pets" })} />
      <header className="cd-arch-pet-hero">
        <span className="cd-arch-pet-photo" data-size="lg" aria-label={`Foto de ${pet.name}`}>
          <PawIcon size={30} color={INK} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="cd-arch-title">{pet.name}</h2>
            <span className="cd-arch-fact" data-tone="stage">
              {pet.kitten ? <HeartPulse size={11} strokeWidth={2} aria-hidden /> : null}
              {lifeStageLabel(pet.birthDate)}
            </span>
          </div>
          <p className="cd-meta">{[pet.species, pet.breed, pet.color, pet.sex].filter(Boolean).join(" · ")}</p>
          <p className="cd-meta">
            Nascimento: {longDate(pet.birthDate)}
            {pet.birthEstimated ? " (estimada)" : ""}
          </p>
          <div className="cd-arch-pet-facts">
            <span className="cd-arch-fact">{pet.meta} de vida</span>
            <span className="cd-arch-fact">{humanAgeLabel(pet.birthDate)}</span>
            <span className="cd-arch-fact" data-tone="strong">
              <Scale size={11} strokeWidth={2} aria-hidden />
              {pet.weight}
            </span>
            {pet.neutered ? (
              <span className="cd-arch-fact" data-tone="positive">
                <BadgeCheck size={11} strokeWidth={2} aria-hidden />
                {neuteredLabel(pet)}
              </span>
            ) : null}
            {pet.microchip ? (
              <span className="cd-arch-fact">
                <Cpu size={11} strokeWidth={2} aria-hidden />
                Microchip
              </span>
            ) : null}
          </div>
        </div>
        <button type="button" className="cd-btn-v2-tertiary cd-arch-pet-edit" title="Fora desta rodada">
          <Pencil size={13} strokeWidth={1.75} aria-hidden />
          Editar perfil
        </button>
      </header>
      <div className="cd-arch-chip-row" role="tablist" aria-label="Seções do pet">
        {chip("overview", "Visão geral", { area: "pets", petId })}
        {chip("historico", "Histórico", { area: "pets", petId, sub: "historico" })}
        {chip("memorias", "Memórias", { area: "memorias", petId })}
      </div>
    </>
  );
}

function PetHistory({ petId, go, neonatal }: { petId: PetId; go: Go; neonatal: boolean }) {
  const [kind, setKind] = useState<RecordTypeId | "all">("all");
  const items = sortHistory([...HISTORY, ...HISTORY_NEONATAL]).filter((h) => h.pet === petId && (kind === "all" || h.type === kind));
  return (
    <div className="cd-arch-page">
      <PetHeader petId={petId} go={go} tab="historico" />
      <div className="cd-arch-stack mt-4">
        <KindHeader kind="registro" text={`linha do tempo só de ${petName(petId)}`} />
        <ChipFilter label="Tipo" options={typeOptions(neonatal && isKitten(petId))} value={kind} onChange={setKind} />
        <Timeline items={items} />
      </div>
    </div>
  );
}

const PET_QUICK: { label: string; type: RecordTypeId; Icon: LucideIcon }[] = [
  { label: "Peso", type: "peso", Icon: Scale },
  { label: "Vacina", type: "vacina", Icon: Syringe },
  { label: "Vermífugo", type: "vermifugo", Icon: ShieldCheck },
  { label: "Remédio", type: "medicamento", Icon: Pill },
];

function PetOverviewBefore({ petId, go }: { petId: PetId; go: Go }) {
  const pet = findPet(petId);
  const health = SAUDE_CATS.filter((c) => c.group === "clinico")
    .flatMap((c) => c.items.filter((i) => i.pet === pet.id).map((item) => ({ cat: c.id, item })))
    .slice(0, 2);
  const attachments = SAUDE_CATS.flatMap((c) => c.items).filter((i) => i.pet === pet.id && i.attachment);
  const weightItem = SAUDE_CATS.find((c) => c.id === "peso")?.items.find((i) => i.pet === pet.id);
  const upcoming = [
    ...AGENDA_REMINDERS.filter((r) => r.pet === pet.id).map((r) => ({ key: r.id, title: r.title, kind: "agenda" as const, meta: `${r.group} · ${r.time}` })),
    ...ROTINAS.flatMap((r) =>
      r.pets.filter((p) => p.pet === pet.id && p.tone && p.tone !== "ok").map((p) => ({ key: r.id, title: r.title, kind: "rotina" as const, meta: p.status }))
    ),
  ].slice(0, 3);
  const prevention = PREVENTION_STATUS.filter((s) => s.pet === pet.id);
  const plan = planOf(pet.id);
  const max = Math.max(...pet.weights);
  const min = Math.min(...pet.weights);
  const saudeTarget: ProtoView = health[0]
    ? { area: "cuidados", tab: "saude", saudeCat: health[0].cat, highlight: health[0].item.id, fromPet: pet.id }
    : { area: "cuidados", tab: "saude", fromPet: pet.id };

  return (
    <div className="cd-arch-page">
      <PetHeaderBefore petId={pet.id} go={go} tab="overview" />

      <div className="cd-arch-pet-quick" aria-label="Registrar para este pet">
        {PET_QUICK.map(({ label, type, Icon }) => (
          <button key={type} type="button" className="cd-arch-pet-quick-btn" onClick={() => go({ area: "registrar", types: [type], pets: [pet.id] })}>
            <Icon size={16} strokeWidth={1.75} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <p className="cd-label mt-5">Resumo</p>
      <div className="cd-arch-pet-grid mt-2">
        <section className="cd-arch-card">
          <p className="cd-label flex items-center gap-1.5">
            Próximos cuidados
            <FourPointStar size={8} />
          </p>
          <ul className="cd-arch-mini-list">
            {upcoming.length ? (
              upcoming.map((u) => (
                <li key={u.key}>
                  <span className="text-sm font-semibold">{u.title}</span>
                  <span className="cd-arch-attention-meta">
                    <KindPill kind={u.kind} />
                    <span className="cd-meta">{u.meta}</span>
                  </span>
                </li>
              ))
            ) : (
              <li>
                <span className="cd-meta">Nada marcado.</span>
              </li>
            )}
          </ul>
          <LinkButton onClick={() => go({ area: "cuidados", tab: "agenda" })}>Ver agenda</LinkButton>
        </section>

        <section className="cd-arch-card">
          <p className="cd-label flex flex-wrap items-center gap-1.5">
            Saúde recente
            <Flag kind="future">FUTURE NAVIGATION</Flag>
          </p>
          <ul className="cd-arch-mini-list cd-arch-mini-links">
            {health.length ? (
              health.map(({ cat, item }) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="cd-arch-mini-link"
                    onClick={() => go({ area: "cuidados", tab: "saude", saudeCat: cat, highlight: item.id, fromPet: pet.id })}
                  >
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-semibold">{item.title}</span>
                      <span className="cd-meta block">{item.meta}</span>
                    </span>
                    <span className="cd-arch-mini-link-cta">
                      Ver em Saúde
                      <ChevronRight size={13} strokeWidth={1.75} aria-hidden />
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li>
                <span className="cd-meta">Sem registros de saúde recentes.</span>
              </li>
            )}
          </ul>
          {prevention.length ? (
            <div className="cd-arch-pet-prevention">
              <Flag kind="insight">PREVENÇÃO · STATUS</Flag>
              {prevention.map((s) => (
                <span key={s.text} className="text-xs font-semibold">
                  {s.text}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="cd-arch-card">
          <p className="cd-label">Peso</p>
          <p className="cd-arch-card-value">{pet.weight}</p>
          <div className="cd-arch-bars cd-arch-bars-sm" aria-label={`Peso de ${pet.name}`}>
            {pet.weights.map((w, i) => (
              <span key={i} style={{ height: `${40 + Math.round(((w - min) / (max - min || 1)) * 60)}%` }} />
            ))}
          </div>
          <div className="cd-arch-actions">
            <LinkButton onClick={() => go({ area: "registrar", types: ["peso"], pets: [pet.id] })}>Registrar peso</LinkButton>
            {weightItem ? (
              <LinkButton onClick={() => go({ area: "cuidados", tab: "saude", saudeCat: "peso", highlight: weightItem.id, fromPet: pet.id })}>
                Ver em Saúde
              </LinkButton>
            ) : null}
          </div>
        </section>

        <section className="cd-arch-card">
          <p className="cd-label">Plano de saúde</p>
          {plan ? (
            <>
              <p className="flex items-center gap-2 text-sm font-semibold">
                {plan.provider} · {plan.planName}
                <span className="cd-badge-v2 cd-badge-v2-apoio">{plan.active ? "Ativo" : "Inativo"}</span>
              </p>
              <p className="cd-meta">
                {plan.fee} · {plan.copay[0].service} {plan.copay[0].value}
              </p>
            </>
          ) : (
            <p className="cd-meta">Sem plano para {pet.name}.</p>
          )}
          <LinkButton onClick={() => go({ area: "financas", tab: "planos", fromPet: pet.id })}>{plan ? "Ver plano" : "Ver planos"}</LinkButton>
        </section>

        <section className="cd-arch-card cd-arch-card-wide">
          <p className="cd-label flex flex-wrap items-center gap-1.5">
            Memórias recentes
            <Flag kind="logic">REQUIRES FILTERING LOGIC</Flag>
          </p>
          <div className="cd-arch-memory-row">
            {[0, 1, 2].map((i) => (
              <span key={i} className="cd-arch-memory-deferred">
                <span className="cd-meta">DEFERRED</span>
              </span>
            ))}
          </div>
          <LinkButton onClick={() => go({ area: "memorias", petId: pet.id })}>Ver memórias</LinkButton>
        </section>
      </div>

      <p className="cd-label mt-6">Sobre e cadastro</p>
      <div className="cd-arch-pet-grid mt-2">
        <section className="cd-arch-card">
          <p className="cd-label">Sobre {pet.name}</p>
          <p className="cd-small text-[var(--text-secondary)]">{pet.notes ?? "Nenhuma descrição pessoal foi adicionada ainda."}</p>
          <span className="cd-arch-quiet-row">
            <Sparkles size={13} strokeWidth={1.75} aria-hidden />
            Sugerir pelo histórico
          </span>
        </section>
        <section className="cd-arch-card">
          <p className="cd-label flex items-center gap-1.5">
            <Cpu size={13} strokeWidth={1.75} aria-hidden />
            Microchip
          </p>
          {pet.microchip ? (
            <dl className="cd-arch-dl">
              <div>
                <dt>Número</dt>
                <dd className="cd-arch-mono">{pet.microchip.number ?? "Registrado"}</dd>
              </div>
              {pet.microchip.implantedAt ? (
                <div>
                  <dt>Implantado em</dt>
                  <dd>{longDate(pet.microchip.implantedAt)}</dd>
                </div>
              ) : null}
              {pet.microchip.location ? (
                <div>
                  <dt>Local</dt>
                  <dd>{pet.microchip.location}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="cd-meta">Ainda não há microchip registrado para {pet.name}.</p>
          )}
        </section>
        {pet.neutered ? (
          <section className="cd-arch-card">
            <p className="cd-label flex items-center gap-1.5">
              <BadgeCheck size={13} strokeWidth={1.75} aria-hidden />
              Castração
            </p>
            <p className="text-sm font-semibold">{neuteredLabel(pet)}</p>
            <p className="cd-meta">{[pet.neutered.at ? longDate(pet.neutered.at) : null, pet.neutered.place].filter(Boolean).join(" · ") || "Sem data registrada"}</p>
          </section>
        ) : null}
      </div>

      <section className="cd-arch-docs" aria-label="Documentos e arquivos">
        <div className="cd-arch-docs-head">
          <p className="cd-label flex items-center gap-1.5">
            <FileStack size={13} strokeWidth={1.75} aria-hidden />
            Documentos e arquivos
          </p>
          <Flag kind="logic">FUNCTIONAL CONTRACT PENDING</Flag>
        </div>
        <div className="cd-arch-docs-grid">
          <span className="cd-arch-docs-slot">
            <span className="text-sm font-semibold">Documentos · {pet.documents}</span>
            <span className="cd-meta">Carteiras e arquivos do pet</span>
          </span>
          <span className="cd-arch-docs-slot">
            <span className="text-sm font-semibold">Anexos em registros · {attachments.length}</span>
            <span className="cd-meta">
              {attachments.length ? attachments.map((a) => a.attachment).join(" · ") : "Nenhum anexo nos registros recentes"}
            </span>
          </span>
          <span className="cd-arch-docs-slot" data-empty="true">
            <Paperclip size={14} strokeWidth={1.75} aria-hidden />
            <span className="cd-meta">Espaço reservado para a arquitetura de arquivos</span>
          </span>
        </div>
      </section>

      <div className="cd-arch-pet-shortcuts" aria-label="Atalhos">
        <button type="button" className="cd-btn-v2-primary" onClick={() => go({ area: "pets", petId: pet.id, sub: "historico" })}>
          Ver histórico
        </button>
        <button type="button" className="cd-btn-v2-secondary" onClick={() => go(saudeTarget)}>
          Ver em Saúde
          <Flag kind="future">FUTURE NAVIGATION</Flag>
        </button>
        <button type="button" className="cd-btn-v2-secondary" onClick={() => go({ area: "financas", tab: "planos", fromPet: pet.id })}>
          Ver plano
        </button>
        <button type="button" className="cd-btn-v2-secondary" onClick={() => go({ area: "memorias", petId: pet.id })}>
          Ver memórias
        </button>
        {pet.kitten ? (
          <button type="button" className="cd-btn-v2-tertiary" onClick={() => go({ area: "cuidados", tab: "neonatal", neonatalHistory: true })}>
            Ver histórico neonatal
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* —— Pets · M0.1V.1 (hierarquia leve) —— */

function PetsList({ go, neonatal }: { go: Go; neonatal: boolean }) {
  const version = useContext(PetPageVersionContext);
  if (version === "before") return <PetsListBefore go={go} neonatal={neonatal} />;
  return (
    <div className="cd-arch-page">
      <header className="cd-arch-page-head">
        <p className="cd-label">Pets</p>
        <h2 className="cd-arch-title">Pets</h2>
      </header>
      <div className="mb-2">
        <PetsTabs active="pets" go={go} />
      </div>
      <ul className="cd-arch-pet2-list">
        {petsOf(neonatal).map((pet) => (
          <li key={pet.id}>
            <button type="button" className="cd-arch-pet2-list-row" onClick={() => go({ area: "pets", petId: pet.id })}>
              <span className="cd-arch-pet-photo" data-size="md" aria-hidden>
                <PawIcon size={16} color={INK} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-semibold">{pet.name}</span>
                <span className="cd-meta block truncate">{[pet.species, lifeStageLabel(pet.birthDate), pet.meta].join(" · ")}</span>
              </span>
              {!pet.kitten && pet.tone !== "ok" ? <StatusChip tone={pet.tone} label={pet.statusLabel} /> : null}
              <ChevronRight size={15} strokeWidth={1.75} className="cd-arch-chevron" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type PetTab = "overview" | PetSub | "memorias";

const PET_TABS: { id: PetTab; label: string; view: (petId: PetId) => ProtoView }[] = [
  { id: "overview", label: "Visão geral", view: (petId) => ({ area: "pets", petId }) },
  { id: "saude", label: "Saúde", view: (petId) => ({ area: "pets", petId, sub: "saude" }) },
  { id: "historico", label: "Histórico", view: (petId) => ({ area: "pets", petId, sub: "historico" }) },
  { id: "memorias", label: "Memórias", view: (petId) => ({ area: "memorias", petId }) },
  { id: "perfil", label: "Perfil", view: (petId) => ({ area: "pets", petId, sub: "perfil" }) },
];

function PetHeader({ petId, go, tab }: { petId: PetId; go: Go; tab: PetTab }) {
  const version = useContext(PetPageVersionContext);
  if (version === "before" && (tab === "overview" || tab === "historico" || tab === "memorias")) {
    return <PetHeaderBefore petId={petId} go={go} tab={tab} />;
  }
  const pet = findPet(petId);
  return (
    <>
      <BackTo label="Pets" onClick={() => go({ area: "pets" })} />
      <header className="cd-arch-pet2-head">
        <span className="cd-arch-pet-photo" data-size="lg" aria-label={`Foto de ${pet.name}`}>
          <PawIcon size={26} color={INK} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="cd-arch-pet2-name">{pet.name}</h2>
          <p className="cd-arch-pet2-line">{[pet.species, pet.breed, pet.sex?.toLowerCase()].filter(Boolean).join(" · ")}</p>
          <p className="cd-arch-pet2-context">
            <span>{lifeStageLabel(pet.birthDate)}</span>
            {pet.neutered ? (
              <span className="cd-arch-pet2-neutered">
                <BadgeCheck size={12} strokeWidth={2} aria-hidden />
                {neuteredLabel(pet)}
              </span>
            ) : null}
          </p>
        </div>
        <button type="button" className="cd-arch-pet2-edit" title="Fora desta rodada">
          <Pencil size={13} strokeWidth={1.75} aria-hidden />
          <span>Editar perfil</span>
        </button>
      </header>
      <nav className="cd-arch-pet2-tabs" role="tablist" aria-label={`Seções de ${pet.name}`}>
        {PET_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className="cd-arch-pet2-tab"
            data-active={tab === t.id ? "true" : undefined}
            onClick={() => go(t.view(petId))}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}

function PetSection({ title, flag, action, children }: { title: string; flag?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="cd-arch-pet2-section" aria-label={title}>
      <div className="cd-arch-pet2-section-head">
        <h3 className="cd-arch-pet2-section-title">{title}</h3>
        {flag}
        {action ? <span className="cd-arch-pet2-section-action">{action}</span> : null}
      </div>
      {children}
    </section>
  );
}

type PetRowTone = Kind | "saude" | "neutral";

function PetRow({
  Icon,
  tone = "neutral",
  title,
  meta,
  cta,
  onClick,
}: {
  Icon: LucideIcon;
  tone?: PetRowTone;
  title: string;
  meta?: string;
  cta?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="cd-arch-pet2-row-icon" data-tone={tone}>
        <Icon size={14} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-semibold">{title}</span>
        {meta ? <span className="cd-meta block">{meta}</span> : null}
      </span>
      {cta ? (
        <span className="cd-arch-pet2-row-cta">
          {cta}
          <ChevronRight size={13} strokeWidth={1.75} aria-hidden />
        </span>
      ) : null}
    </>
  );
  return (
    <li>
      {onClick ? (
        <button type="button" className="cd-arch-pet2-row" onClick={onClick}>
          {body}
        </button>
      ) : (
        <div className="cd-arch-pet2-row">{body}</div>
      )}
    </li>
  );
}

function PetLinks({ children }: { children: React.ReactNode }) {
  return <div className="cd-arch-pet2-links">{children}</div>;
}

function PetQuickActions({ pet, go }: { pet: ArchPet; go: Go }) {
  return (
    <div className="cd-arch-pet2-actions" role="group" aria-label={`Registrar para ${pet.name}`}>
      <span className="cd-arch-pet2-actions-label">
        <Plus size={13} strokeWidth={2} aria-hidden />
        Registrar
      </span>
      {PET_QUICK.map(({ label, type, Icon }) => (
        <button key={type} type="button" className="cd-arch-pet2-action" onClick={() => go({ area: "registrar", types: [type], pets: [pet.id] })}>
          <Icon size={14} strokeWidth={1.75} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

const ROW_ICON: Record<Kind | "saude", LucideIcon> = {
  agenda: CalendarClock,
  rotina: Repeat,
  registro: Check,
  saude: ShieldCheck,
};

function PetOverview({ petId, go }: { petId: PetId; go: Go }) {
  const version = useContext(PetPageVersionContext);
  if (version === "before") return <PetOverviewBefore petId={petId} go={go} />;
  const pet = findPet(petId);
  const saudeView: ProtoView = { area: "pets", petId, sub: "saude" };
  const upcoming: { key: string; title: string; meta: string; tone: Kind | "saude"; cta: string; view: ProtoView }[] = [
    ...PREVENTION_STATUS.filter((s) => s.pet === petId).map((s) => ({
      key: s.text,
      title: s.text,
      meta: "Protocolo preventivo",
      tone: "saude" as const,
      cta: "Ver em Saúde",
      view: saudeView,
    })),
    ...AGENDA_REMINDERS.filter((r) => r.pet === petId).map((r) => ({
      key: r.id,
      title: r.title,
      meta: `${dayLabel(r.date)} · ${r.time}`,
      tone: "agenda" as const,
      cta: "Ver agenda",
      view: { area: "cuidados", tab: "agenda" } as ProtoView,
    })),
    ...ROTINAS.flatMap((r) =>
      r.pets
        .filter((p) => p.pet === petId && p.tone && p.tone !== "ok")
        .map((p) => ({
          key: r.id,
          title: r.title,
          meta: `${p.status} · ${r.freq}`,
          tone: "rotina" as const,
          cta: "Ver rotinas",
          view: { area: "cuidados", tab: "rotinas" } as ProtoView,
        }))
    ),
  ];
  const history = sortHistory([...HISTORY, ...HISTORY_NEONATAL]).filter((h) => h.pet === petId);
  const recent = history.slice(0, 4);
  const lastWeight = history.find((h) => h.type === "peso");
  const showWeight = lastWeight && daysAgo(lastWeight.date) <= 30;
  const plan = planOf(petId);
  const historyView: ProtoView = { area: "pets", petId, sub: "historico" };

  return (
    <div className="cd-arch-page">
      <PetHeader petId={petId} go={go} tab="overview" />
      <div className="cd-arch-pet2-body">
        <PetQuickActions pet={pet} go={go} />
        <div className="cd-arch-pet2-grid">
          <div className="cd-arch-pet2-col">
            {pet.kitten ? (
              <PetSection title="Fase neonatal">
                <ul className="cd-arch-pet2-rows">
                  <PetRow
                    Icon={Baby}
                    tone="saude"
                    title={`Hoje: ${pet.kitten.feeds} ${pet.kitten.feeds === 1 ? "mamada" : "mamadas"}`}
                    meta={`Última às ${pet.kitten.last}`}
                    cta="Histórico neonatal"
                    onClick={() => go({ area: "cuidados", tab: "neonatal", neonatalHistory: true })}
                  />
                </ul>
              </PetSection>
            ) : null}

            <PetSection title="Próximos cuidados">
              {upcoming.length ? (
                <ul className="cd-arch-pet2-rows">
                  {upcoming.map((u) => (
                    <PetRow key={u.key} Icon={ROW_ICON[u.tone]} tone={u.tone} title={u.title} meta={u.meta} cta={u.cta} onClick={() => go(u.view)} />
                  ))}
                </ul>
              ) : (
                <p className="cd-arch-pet2-empty">Nada marcado para {pet.name}.</p>
              )}
            </PetSection>

            <PetSection title="Atividade recente">
              {recent.length ? (
                <ul className="cd-arch-pet2-rows">
                  {recent.map((h) => (
                    <PetRow
                      key={h.id}
                      Icon={RECORD_TYPES[h.type].icon}
                      title={`${RECORD_TYPES[h.type].label} · ${h.title}`}
                      meta={`${dayLabel(h.date)} · ${h.time}`}
                    />
                  ))}
                </ul>
              ) : (
                <p className="cd-arch-pet2-empty">Nada registrado ainda.</p>
              )}
              <PetLinks>
                <LinkButton onClick={() => go(historyView)}>Ver histórico</LinkButton>
                <LinkButton onClick={() => go(saudeView)}>Ver em Saúde</LinkButton>
                <Flag kind="future">ABRIR REGISTRO · FUTURE NAVIGATION</Flag>
              </PetLinks>
            </PetSection>
          </div>

          <div className="cd-arch-pet2-col" data-aside="true">
            {showWeight && lastWeight ? (
              <PetSection title="Último peso registrado">
                <p className="cd-arch-pet2-weight">
                  <strong>{lastWeight.title}</strong>
                  <span className="cd-meta"> · {dayLabel(lastWeight.date)}</span>
                </p>
                <PetLinks>
                  <LinkButton onClick={() => go({ area: "registrar", types: ["peso"], pets: [petId] })}>Registrar novo peso</LinkButton>
                  <LinkButton onClick={() => go(historyView)}>Ver histórico</LinkButton>
                </PetLinks>
              </PetSection>
            ) : null}

            {plan ? (
              <PetSection title="Plano de saúde">
                <ul className="cd-arch-pet2-rows">
                  <PetRow
                    Icon={ShieldCheck}
                    title={`${plan.provider} · ${plan.planName}`}
                    meta={plan.active ? "Ativo" : "Inativo"}
                    cta="Ver plano"
                    onClick={() => go({ area: "financas", tab: "planos", fromPet: petId })}
                  />
                </ul>
              </PetSection>
            ) : null}

            <PetSection title="Memórias" flag={<Flag kind="logic">REQUIRES FILTERING LOGIC</Flag>}>
              <div className="cd-arch-pet2-memories" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} />
                ))}
              </div>
              <PetLinks>
                <LinkButton onClick={() => go({ area: "memorias", petId })}>Ver memórias</LinkButton>
              </PetLinks>
            </PetSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function PetSaude({ petId, go }: { petId: PetId; go: Go }) {
  const pet = findPet(petId);
  const kitten = isKitten(petId);
  const prevention = PREVENTION_STATUS.filter((s) => s.pet === petId);
  const plan = planOf(petId);
  return (
    <div className="cd-arch-page">
      <PetHeader petId={petId} go={go} tab="saude" />
      <div className="cd-arch-pet2-body">
        {prevention.length ? (
          <PetSection title="Prevenção" flag={<Flag kind="insight">STATUS / INSIGHT</Flag>}>
            <ul className="cd-arch-pet2-rows">
              {prevention.map((s) => (
                <PetRow
                  key={s.text}
                  Icon={ShieldCheck}
                  tone="saude"
                  title={s.text}
                  meta="Protocolo preventivo"
                  cta="Abrir"
                  onClick={() => go({ area: "cuidados", tab: "saude", saudeCat: s.cat, fromPet: petId })}
                />
              ))}
            </ul>
          </PetSection>
        ) : null}

        <PetSection title={`Saúde de ${pet.name}`}>
          <ul className="cd-arch-pet2-rows">
            {SAUDE_CATS.filter((c) => (c.puppyOnly ? kitten : true)).map((c) => {
              const last = c.items.find((i) => i.pet === petId);
              return (
                <PetRow
                  key={c.id}
                  Icon={RECORD_TYPES[c.record].icon}
                  title={c.label}
                  meta={last ? `${last.title} · ${last.meta}` : "Nenhum registro"}
                  cta="Abrir"
                  onClick={() => go({ area: "cuidados", tab: "saude", saudeCat: c.id, highlight: last?.id, fromPet: petId })}
                />
              );
            })}
          </ul>
        </PetSection>

        {plan ? (
          <PetSection title="Plano de saúde">
            <ul className="cd-arch-pet2-rows">
              <PetRow
                Icon={ShieldCheck}
                title={`${plan.provider} · ${plan.planName}`}
                meta={`${plan.active ? "Ativo" : "Inativo"} · ${plan.coverage}`}
                cta="Ver plano"
                onClick={() => go({ area: "financas", tab: "planos", fromPet: petId })}
              />
            </ul>
          </PetSection>
        ) : null}

        <PetLinks>
          <LinkButton onClick={() => go({ area: "cuidados", tab: "saude" })}>Saúde da família em Cuidados</LinkButton>
        </PetLinks>
      </div>
    </div>
  );
}

function ProfileItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cd-arch-pet2-dl-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function PetProfile({ petId, go }: { petId: PetId; go: Go }) {
  const pet = findPet(petId);
  const attachments = SAUDE_CATS.flatMap((c) => c.items).filter((i) => i.pet === petId && i.attachment);
  return (
    <div className="cd-arch-page">
      <PetHeader petId={petId} go={go} tab="perfil" />
      <div className="cd-arch-pet2-body">
        <div className="cd-arch-pet2-grid">
          <div className="cd-arch-pet2-col">
            <section className="cd-arch-pet2-age" aria-label="Idade">
              <p className="cd-label">Idade</p>
              <p className="cd-arch-pet2-age-main">{pet.meta} de vida</p>
              <p className="cd-arch-pet2-age-human">
                <FourPointStar size={9} />
                {humanAgeLabel(pet.birthDate)}
              </p>
              <p className="cd-meta">Equivalência aproximada</p>
            </section>

            <PetSection title="Sobre o pet">
              <dl className="cd-arch-pet2-dl">
                <ProfileItem label="Espécie">{pet.species}</ProfileItem>
                <ProfileItem label="Raça">{pet.breed ?? "Não informada"}</ProfileItem>
                <ProfileItem label="Sexo">{pet.sex ?? "Não informado"}</ProfileItem>
                <ProfileItem label="Cor / pelagem">{pet.color ?? "Não informada"}</ProfileItem>
                <ProfileItem label="Nascimento">
                  {longDate(pet.birthDate)}
                  {pet.birthEstimated ? <span className="cd-meta"> · estimada</span> : null}
                </ProfileItem>
                <ProfileItem label="Fase de vida">{lifeStageLabel(pet.birthDate)}</ProfileItem>
                <ProfileItem label="Peso atual">{pet.weight}</ProfileItem>
              </dl>
            </PetSection>

            <PetSection title={`Sobre ${pet.name}`}>
              <p className="cd-small text-[var(--text-secondary)]">{pet.notes ?? "Nenhuma descrição pessoal foi adicionada ainda."}</p>
              <span className="cd-arch-quiet-row">
                <Sparkles size={13} strokeWidth={1.75} aria-hidden />
                Sugerir pelo histórico
              </span>
            </PetSection>
          </div>

          <div className="cd-arch-pet2-col" data-aside="true">
            <PetSection title="Identificação">
              {pet.microchip ? (
                <div className="cd-arch-pet2-chip">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <Cpu size={14} strokeWidth={1.75} aria-hidden />
                    Microchip
                  </p>
                  <p className="cd-arch-mono cd-arch-pet2-chip-number">{pet.microchip.number ?? "Registrado"}</p>
                  <p className="cd-meta">
                    {[pet.microchip.implantedAt ? `Implantado em ${longDate(pet.microchip.implantedAt)}` : null, pet.microchip.location].filter(Boolean).join(" · ") ||
                      "Sem detalhes de implantação"}
                  </p>
                </div>
              ) : (
                <p className="cd-arch-pet2-empty">Nenhum microchip registrado.</p>
              )}
            </PetSection>

            {pet.neutered ? (
              <PetSection title="Status cadastral">
                <dl className="cd-arch-pet2-dl">
                  <ProfileItem label="Castração">
                    <span className="cd-arch-pet2-neutered">
                      <BadgeCheck size={12} strokeWidth={2} aria-hidden />
                      {neuteredLabel(pet)}
                    </span>
                    {pet.neutered.at || pet.neutered.place ? (
                      <span className="cd-meta block">
                        {[pet.neutered.at ? longDate(pet.neutered.at) : null, pet.neutered.place].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                  </ProfileItem>
                </dl>
              </PetSection>
            ) : null}

            <PetSection title="Documentos e arquivos" flag={<Flag kind="logic">FUNCTIONAL CONTRACT PENDING</Flag>}>
              <ul className="cd-arch-pet2-rows">
                <PetRow Icon={FileStack} title={`Documentos · ${pet.documents}`} meta="Carteiras e arquivos do pet" />
                <PetRow
                  Icon={Paperclip}
                  title={`Anexos em registros · ${attachments.length}`}
                  meta={attachments.length ? attachments.map((a) => a.attachment).join(" · ") : "Nenhum anexo nos registros recentes"}
                />
              </ul>
              <p className="cd-arch-pet2-reserved">Espaço reservado para a arquitetura de arquivos</p>
            </PetSection>
          </div>
        </div>
        <PetLinks>
          <button type="button" className="cd-btn-v2-secondary" title="Fora desta rodada">
            <Pencil size={13} strokeWidth={1.75} aria-hidden />
            Editar perfil
          </button>
        </PetLinks>
      </div>
    </div>
  );
}

/* —— Memórias (A: top-level · B: dentro de Pets) —— */

function MemoriasView({ view, go, shell }: { view: Extract<ProtoView, { area: "memorias" }>; go: Go; shell: ShellId }) {
  const pet = view.petId;
  const tiles = (
    <>
      {pet ? <FlagNote kind="logic" flag="REQUIRES FILTERING LOGIC">Memórias ainda não filtram por pet.</FlagNote> : null}
      <div className="cd-arch-chip-row cd-arch-chip-scroll">
        {["Todas", "Primeiras vezes", "Dia a dia", "Fotos favoritas"].map((f, i) => (
          <span key={f} className="cd-chip-v2" data-active={i === 0 ? "true" : undefined}>
            {f}
          </span>
        ))}
      </div>
      <div className="cd-arch-memory-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="cd-arch-memory-deferred" data-tall={i % 3 === 0 ? "true" : undefined}>
            <span className="cd-meta">DEFERRED · ilustração</span>
          </span>
        ))}
      </div>
    </>
  );

  if (shell === "B") {
    return (
      <div className="cd-arch-page">
        {pet ? (
          <>
            <PetHeader petId={pet} go={go} tab="memorias" />
            <p className="cd-meta mt-3">
              Memórias de {petName(pet)}. As da família ficam em{" "}
              <button type="button" className="cd-arch-inline-link" onClick={() => go({ area: "memorias" })}>
                Pets › Memórias da família
              </button>
              .
            </p>
          </>
        ) : (
          <>
            <header className="cd-arch-page-head">
              <p className="cd-label">Pets</p>
              <h2 className="cd-arch-title">Memórias da família</h2>
              <p className="cd-arch-lede">Memórias da família e de cada pet, dentro de Pets.</p>
            </header>
            <PetsTabs active="memorias" go={go} />
          </>
        )}
        <div className="cd-arch-stack mt-4">{tiles}</div>
      </div>
    );
  }

  return (
    <div className="cd-arch-page">
      {pet ? <BackTo label={`Voltar para ${petName(pet)}`} onClick={() => go({ area: "pets", petId: pet })} /> : null}
      <header className="cd-arch-page-head">
        <p className="cd-label">Memórias</p>
        <h2 className="cd-arch-title">Memórias</h2>
        <p className="cd-arch-lede">Exploration A · Memórias é destino próprio na navegação.</p>
      </header>
      <div className="cd-arch-stack">
        <div className="cd-arch-chip-row cd-arch-chip-scroll">
          {[{ id: undefined, name: "Família" }, ...ADULT_PETS].map((p) => (
            <button
              key={p.name}
              type="button"
              className="cd-chip-v2 cd-arch-chip-btn"
              data-active={pet === p.id ? "true" : undefined}
              onClick={() => go({ area: "memorias", petId: p.id })}
            >
              {p.name}
            </button>
          ))}
        </div>
        {tiles}
      </div>
    </div>
  );
}

/* —— Finanças (B: top-level · A: dentro de Mais) —— */

function PlanAdmin({ fromPet }: { fromPet?: PetId }) {
  const without = ADULT_PETS.filter((p) => !planOf(p.id));
  return (
    <div className="cd-arch-stack">
      <p className="cd-meta">Cada plano pertence a um pet.</p>
      {HEALTH_PLANS.map((p) => (
        <section key={p.pet} className="cd-arch-plan-card" data-focus={fromPet === p.pet ? "true" : undefined} aria-label={`Plano de ${petName(p.pet)}`}>
          <div className="cd-arch-plan-card-head">
            <div className="min-w-0">
              <p className="cd-label">Plano de saúde · {petName(p.pet)}</p>
              <p className="cd-arch-plan-name">
                {p.provider} · {p.planName}
              </p>
              <p className="cd-meta">
                {p.fee} · desde {p.since}
              </p>
            </div>
            <span className="cd-badge-v2 cd-badge-v2-apoio">{p.active ? "Ativo" : "Inativo"}</span>
          </div>
          <p className="cd-small">
            <span className="cd-meta">Cobertura · </span>
            {p.coverage}
          </p>
          <div>
            <p className="cd-label">Serviços e coparticipação</p>
            <ul className="cd-arch-plain-list">
              {p.copay.map((s) => (
                <li key={s.service}>
                  {s.status === "coberto" ? (
                    <Check size={14} strokeWidth={2} className="cd-arch-yes" aria-hidden />
                  ) : s.status === "parcial" ? (
                    <Minus size={14} strokeWidth={2} className="cd-arch-yes" aria-hidden />
                  ) : (
                    <X size={14} strokeWidth={2} className="cd-arch-no" aria-hidden />
                  )}
                  <span className="text-sm">{s.service}</span>
                  <span className="cd-meta">· {s.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
      {without.length ? (
        <div className="cd-arch-secondary-row" data-static="true">
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">{namesOf(without.map((p) => p.id))}</span>
            <span className="cd-meta"> · sem plano</span>
          </span>
          <button type="button" className="cd-btn-v2-tertiary" title="Fora desta rodada">
            Adicionar plano
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FinancasPage({ view, go, shell }: { view: Extract<ProtoView, { area: "financas" }>; go: Go; shell: ShellId }) {
  const tab = FIN_TABS.find((t) => t.id === view.tab) ?? FIN_TABS[0];
  return (
    <div className="cd-arch-page">
      {view.fromPet ? <BackTo label={`Voltar para ${petName(view.fromPet)}`} onClick={() => go({ area: "pets", petId: view.fromPet })} /> : null}
      <header className="cd-arch-page-head">
        <p className="cd-label">{shell === "A" ? "Mais › Finanças" : "Finanças"}</p>
        <h2 className="cd-arch-title">Finanças</h2>
        <p className="cd-arch-lede">Papel do domínio na navegação. Só Planos está prototipado.</p>
      </header>
      <nav className="cd-arch-subnav" aria-label="Finanças">
        <div className="cd-arch-subnav-primary">
          {FIN_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="cd-arch-tab"
              data-active={t.id === tab.id ? "true" : undefined}
              onClick={() => go({ area: "financas", tab: t.id, fromPet: view.fromPet })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      {tab.id === "planos" ? (
        <PlanAdmin fromPet={view.fromPet} />
      ) : (
        <div className="cd-arch-empty cd-arch-empty-wide">
          <p className="cd-label">{tab.label}</p>
          <p className="text-sm font-semibold">{tab.role}</p>
          <Flag kind={tab.today === "new" ? "future" : "insight"}>{tab.today === "new" ? "NEW FEATURE" : "MOVE / REORGANIZATION"}</Flag>
        </div>
      )}
    </div>
  );
}

/* —— Mais (A) —— */

function MaisPage({ go, shell }: { go: Go; shell: ShellId }) {
  return (
    <div className="cd-arch-page">
      <header className="cd-arch-page-head">
        <p className="cd-label">Mais</p>
        <h2 className="cd-arch-title">Mais</h2>
        <p className="cd-arch-lede">
          {shell === "A"
            ? "Exploration A · Finanças e conta vivem aqui, fora do dock."
            : "Exploration B não tem Mais no dock · conteúdo equivalente a definir."}
        </p>
      </header>
      <div className="cd-arch-cat-groups">
        <section>
          <p className="cd-label">Finanças</p>
          <ul className="cd-arch-cat-list">
            {FIN_TABS.map((t) => (
              <li key={t.id}>
                <button type="button" className="cd-arch-cat-row" onClick={() => go({ area: "financas", tab: t.id })}>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-semibold">{t.label}</span>
                    <span className="cd-meta block truncate">{t.role}</span>
                  </span>
                  <ChevronRight size={15} strokeWidth={1.75} className="cd-arch-chevron" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <p className="cd-label">Conta</p>
          <ul className="cd-arch-cat-list">
            {["Conta e família", "Ajustes"].map((label) => (
              <li key={label}>
                <span className="cd-arch-cat-row" data-static="true">
                  <span className="min-w-0 flex-1 text-left text-sm font-semibold">{label}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* —— Out of scope placeholders —— */

function OutOfScope({ title, note, go }: { title: string; note: string; go: Go }) {
  return (
    <div className="cd-arch-page">
      <div className="cd-arch-empty cd-arch-empty-wide">
        <p className="cd-label">{title}</p>
        <p className="text-sm font-semibold">Fora desta exploração.</p>
        <p className="cd-meta max-w-[22rem]">{note}</p>
        <button type="button" className="cd-btn-v2-secondary" onClick={() => go({ area: "cuidados", tab: "overview" })}>
          Ir para Cuidados
        </button>
      </div>
    </div>
  );
}

/* —— Router —— */

export function ProtoScreen({
  view,
  go,
  shell,
  neonatal,
  onEnableNeonatal,
}: {
  view: ProtoView;
  go: Go;
  variant: ProtoVariant;
  shell: ShellId;
  neonatal: boolean;
  onEnableNeonatal: () => void;
}) {
  switch (view.area) {
    case "cuidados":
      return <CarePage view={view} go={go} neonatal={neonatal} onEnableNeonatal={onEnableNeonatal} />;
    case "registrar": {
      const types = view.types ?? [];
      const key = `${types.join(".") || "entry"}-${(view.pets ?? []).join(".")}-${view.saved ? "saved" : "edit"}-${neonatal ? "n" : ""}`;
      return types.length ? (
        <RegisterFlow key={key} view={{ ...view, types }} go={go} neonatal={neonatal} />
      ) : (
        <RegisterEntry key={key} go={go} />
      );
    }
    case "pets":
      if (!view.petId) return <PetsList go={go} neonatal={neonatal} />;
      if (view.sub === "historico") return <PetHistory petId={view.petId} go={go} neonatal={neonatal} />;
      if (view.sub === "saude") return <PetSaude petId={view.petId} go={go} />;
      if (view.sub === "perfil") return <PetProfile petId={view.petId} go={go} />;
      return <PetOverview petId={view.petId} go={go} />;
    case "memorias":
      return <MemoriasView view={view} go={go} shell={shell} />;
    case "financas":
      return <FinancasPage view={view} go={go} shell={shell} />;
    case "mais":
      return <MaisPage go={go} shell={shell} />;
    case "agora":
      return (
        <OutOfScope
          title={shell === "A" ? "Agora" : "Início"}
          note="O conteúdo do Início é a Home V2 (seção 03 do Brand Lab). Aqui só a posição na navegação."
          go={go}
        />
      );
    case "assistente":
      return <OutOfScope title="Assistente" note="Utility própria · fora desta exploração." go={go} />;
  }
}
