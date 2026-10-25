"use client";

import { useState } from "react";
import { ArrowLeft, Check, Paperclip, Plus, X } from "lucide-react";
import { FourPointStar } from "@/components/brand/cuidadim/icons/FourPointStar";
import { PawIcon } from "@/components/brand/cuidadim/icons/PawIcon";
import {
  FEEDING_PRESETS,
  FEEDING_UNITS,
  HYGIENE_PRESETS,
  KITTENS,
  QUALITY_OPTIONS,
  RECORD_GROUPS,
  RECORD_TYPES,
  VACCINE_PROTOCOL,
  isKitten,
  namesOf,
  petName,
  petsOf,
  type ArchPet,
  type Go,
  type PetId,
  type ProtoView,
  type RecordTypeId,
} from "@/components/brand/cuidadim/architecture-v2-data";

const INK = "#2A1F2F";

/* —— Lab markers —— */

export type FlagKind = "future" | "logic" | "naming" | "insight" | "issue";

export function Flag({ kind, children }: { kind: FlagKind; children: React.ReactNode }) {
  return (
    <span className="cd-arch-flag" data-kind={kind}>
      {children}
    </span>
  );
}

export function FlagNote({ kind, flag, children }: { kind: FlagKind; flag: string; children?: React.ReactNode }) {
  return (
    <p className="cd-arch-flag-note" data-kind={kind}>
      <Flag kind={kind}>{flag}</Flag>
      {children ? <span>{children}</span> : null}
    </p>
  );
}

/* —— Building blocks —— */

export function PetPicker({
  pets,
  value,
  onChange,
}: {
  pets: ArchPet[];
  value: PetId[];
  onChange: (next: PetId[]) => void;
}) {
  return (
    <div className="cd-arch-pet-picker">
      {pets.map((pet) => {
        const active = value.includes(pet.id);
        return (
          <button
            key={pet.id}
            type="button"
            className="cd-arch-pet-chip"
            data-active={active ? "true" : undefined}
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter((id) => id !== pet.id) : [...value, pet.id])}
          >
            <span className="cd-arch-pet-chip-avatar">
              <PawIcon size={12} color={INK} />
            </span>
            {pet.name}
            {active ? <Check size={12} strokeWidth={2} aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  placeholder,
  defaultValue,
  suffix,
  hint,
}: {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="cd-field-v2">
      <span className="cd-field-v2-label">{label}</span>
      <span className="cd-arch-input-wrap">
        <input className="cd-field-v2-input" placeholder={placeholder} defaultValue={defaultValue} />
        {suffix ? <span className="cd-arch-input-suffix">{suffix}</span> : null}
      </span>
      {hint ? <span className="cd-meta">{hint}</span> : null}
    </label>
  );
}

function TextArea({ label, placeholder }: { label: string; placeholder?: string }) {
  return (
    <label className="cd-field-v2">
      <span className="cd-field-v2-label">{label}</span>
      <textarea className="cd-field-v2-input cd-arch-textarea" placeholder={placeholder} rows={2} />
    </label>
  );
}

function Select({ label, options, initial, hint }: { label: string; options: string[]; initial?: string; hint?: string }) {
  return (
    <label className="cd-field-v2">
      <span className="cd-field-v2-label">{label}</span>
      <select className="cd-field-v2-input cd-arch-select" defaultValue={initial ?? options[0]}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      {hint ? <span className="cd-meta">{hint}</span> : null}
    </label>
  );
}

function MultiChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="cd-field-v2">
      <span className="cd-field-v2-label">{label}</span>
      <div className="cd-arch-chip-row">
        {options.map((opt) => {
          const on = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              className="cd-chip-v2 cd-arch-chip-btn"
              data-active={on ? "true" : undefined}
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== opt) : [...value, opt])}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Attachment({ label }: { label: string }) {
  return (
    <div className="cd-field-v2">
      <span className="cd-field-v2-label">{label}</span>
      <button type="button" className="cd-arch-dropzone">
        <Paperclip size={15} strokeWidth={1.75} aria-hidden />
        Adicionar foto ou PDF
      </button>
    </div>
  );
}

function Toggle({ label, children }: { label: string; children?: React.ReactNode }) {
  const [on, setOn] = useState(false);
  return (
    <div className="cd-field-v2">
      <button type="button" className="cd-arch-toggle-row" aria-pressed={on} onClick={() => setOn((v) => !v)}>
        <span className="cd-arch-toggle" data-on={on ? "true" : undefined} aria-hidden />
        {label}
      </button>
      {on ? children : null}
    </div>
  );
}

function PetBlocks({ pets, children }: { pets: PetId[]; children: (pet: PetId) => React.ReactNode }) {
  return (
    <div className="cd-arch-pet-blocks">
      {pets.map((id) => (
        <section key={id} className="cd-arch-pet-block" aria-label={petName(id)}>
          <p className="cd-arch-pet-block-head">
            <span className="cd-arch-pet-chip-avatar">
              <PawIcon size={12} color={INK} />
            </span>
            {petName(id)}
          </p>
          <div className="cd-arch-form">{children(id)}</div>
        </section>
      ))}
    </div>
  );
}

/* —— Tipo de cuidado —— */

function TypeTile({ type, onPick }: { type: RecordTypeId; onPick: (type: RecordTypeId) => void }) {
  const meta = RECORD_TYPES[type];
  const Icon = meta.icon;
  return (
    <button type="button" className="cd-arch-type-tile" onClick={() => onPick(type)}>
      <span className="cd-arch-type-icon">
        <Icon size={18} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="cd-arch-type-label">{meta.label}</span>
    </button>
  );
}

export function TypeGroups({ onPick, exclude = [] }: { onPick: (type: RecordTypeId) => void; exclude?: RecordTypeId[] }) {
  return (
    <div className="cd-arch-type-groups">
      {RECORD_GROUPS.map((group) => {
        const types = group.types.filter((t) => !exclude.includes(t));
        if (!types.length) return null;
        return (
          <section key={group.id} className="cd-arch-type-group" aria-label={group.label}>
            <p className="cd-label">
              {group.label}
              {group.note ? <span className="cd-arch-type-note"> · {group.note}</span> : null}
            </p>
            <div className="cd-arch-type-grid">
              {types.map((type) => (
                <TypeTile key={type} type={type} onPick={onPick} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FlowSteps({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <ol className="cd-arch-flow-steps" aria-label="Passos do registro">
      {["Cuidado(s)", "Pet(s)", "Campos", "Salvar"].map((s, i) => (
        <li key={s} data-state={i < current ? "done" : i === current ? "current" : undefined}>
          <span className="cd-arch-step-num">{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

export function RegisterEntry({ go }: { go: Go }) {
  return (
    <div className="cd-arch-page">
      <header className="cd-arch-page-head">
        <p className="cd-label">Registrar cuidado</p>
        <h2 className="cd-arch-title">O que você quer registrar?</h2>
        <p className="cd-arch-lede">Escolha um cuidado. Se precisar, adicione outros e escolha vários pets na próxima tela.</p>
      </header>
      <FlowSteps current={0} />
      <TypeGroups onPick={(type) => go({ area: "registrar", types: [type] })} />
    </div>
  );
}

/* —— Campos por tipo (só o que existe no CatCare atual) —— */

const TITLE_PLACEHOLDER: Partial<Record<RecordTypeId, string>> = {
  consulta: "Ex.: Retorno com a Dra. Ana",
  exame: "Ex.: Hemograma",
  medicamento: "Ex.: Antipulgas",
  vermifugo: "Ex.: Vermífugo",
  nota: "O que você percebeu?",
};

function TitleField({ type, multi }: { type: RecordTypeId; multi: boolean }) {
  const label = multi ? `Título (${RECORD_TYPES[type].label})` : type === "consulta" ? "Título / motivo" : "Título";
  return <Field label={label} placeholder={TITLE_PLACEHOLDER[type]} defaultValue={type === "consulta" ? "Consulta veterinária" : undefined} />;
}

function VaccineFields({ multi }: { multi: boolean }) {
  const [mode, setMode] = useState<"protocol" | "other">("protocol");
  return (
    <>
      <div className="cd-arch-seg self-start" role="group" aria-label="Origem da vacina">
        <button type="button" aria-pressed={mode === "protocol"} onClick={() => setMode("protocol")}>
          Usar protocolo do pet
        </button>
        <button type="button" aria-pressed={mode === "other"} onClick={() => setMode("other")}>
          Outra vacina
        </button>
      </div>
      {mode === "protocol" ? (
        <div className="cd-arch-field-pair cd-arch-field-pair-even">
          <Select label="Qual vacina?" options={VACCINE_PROTOCOL} initial="V4" hint="Do protocolo preventivo, conforme a espécie." />
          <Select label="Qual dose?" options={["1ª dose", "2ª dose", "3ª dose", "Reforço anual"]} initial="2ª dose" hint="Doses da vacina escolhida." />
        </div>
      ) : (
        <Field
          label="Nome da vacina"
          placeholder="Outra vacina (fora do protocolo)"
          hint="Esta vacina entra no histórico, mas não quita doses do protocolo V4/Antirrábica."
        />
      )}
      {!multi ? <Field label="Clínica ou veterinário" placeholder="Ex.: Clínica Bem-Estar" /> : null}
    </>
  );
}

function FeedingFields({ pets }: { pets: PetId[] }) {
  const [items, setItems] = useState<string[]>(["Sachê / alimento úmido"]);
  return (
    <>
      <MultiChips label={pets.length > 1 ? "O que eles comeram?" : "O que comeu?"} options={FEEDING_PRESETS} value={items} onChange={setItems} />
      {items.includes("Outro") ? <Field label="Qual alimento?" placeholder="Ex.: frango cozido" /> : null}
      {items.length ? (
        <div className="cd-field-v2">
          <span className="cd-field-v2-label">Quantidades (opcional)</span>
          <div className="cd-arch-form">
            {items.map((item) => (
              <div key={item} className="cd-arch-qty-row">
                <span className="cd-small font-semibold">{item}</span>
                <input className="cd-field-v2-input" placeholder="Qtd" defaultValue={item.startsWith("Sachê") ? "85" : undefined} aria-label={`Quantidade — ${item}`} />
                <select className="cd-field-v2-input cd-arch-select" defaultValue={item.startsWith("Leite") ? "ml" : "g"} aria-label={`Unidade — ${item}`}>
                  {FEEDING_UNITS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <Select label="Como foi?" options={QUALITY_OPTIONS} />
      {pets.length > 1 ? (
        <Toggle label="Quer ajustar as quantidades para algum pet?">
          <p className="cd-meta">Por padrão, as quantidades acima valem para todos.</p>
          <div className="cd-arch-form mt-2">
            {pets.map((id) => (
              <Field key={id} label={`Quantidade — ${petName(id)}`} placeholder="Herdar" />
            ))}
          </div>
        </Toggle>
      ) : null}
    </>
  );
}

function TypeFields({
  type,
  multi,
  pets,
  hygiene,
  onHygiene,
}: {
  type: RecordTypeId;
  multi: boolean;
  pets: PetId[];
  hygiene: string[];
  onHygiene: (next: string[]) => void;
}) {
  const meta = RECORD_TYPES[type];
  switch (type) {
    case "consulta":
    case "exame":
    case "vermifugo":
      return (
        <>
          <TitleField type={type} multi={multi} />
          {!multi ? <Field label="Clínica ou veterinário" placeholder="Ex.: Clínica Bem-Estar" /> : null}
        </>
      );
    case "medicamento":
      return (
        <>
          <TitleField type={type} multi={multi} />
          <p className="cd-meta">Informações como dose continuam no título ou observação no modelo atual.</p>
        </>
      );
    case "nota":
      return <TitleField type={type} multi={multi} />;
    case "vacina":
      return <VaccineFields multi={multi} />;
    case "peso":
      return (
        <>
          {pets.length ? (
            pets.map((id) => <Field key={id} label={`Peso (kg) — ${petName(id)}`} placeholder="0,0" suffix="kg" />)
          ) : (
            <p className="cd-meta">Escolha os pets: aparece um campo de peso para cada um.</p>
          )}
          <p className="cd-meta">Um registro por pet · atualiza o peso atual.</p>
        </>
      );
    case "alimentacao":
      return <FeedingFields pets={pets} />;
    case "higiene":
      return (
        <>
          <MultiChips label="Quais cuidados você fez?" options={HYGIENE_PRESETS} value={hygiene} onChange={onHygiene} />
          {hygiene.includes("Outro") ? <Field label="Qual outro cuidado?" placeholder="Ex.: hidratação das patas" /> : null}
          <p className="cd-meta">Cada cuidado marcado vira um registro por pet.</p>
        </>
      );
    case "xixi":
    case "coco":
      return <Select label={multi ? `Como foi? (${meta.label})` : "Como foi?"} options={QUALITY_OPTIONS} />;
    case "temperatura":
      return <Field label="Temperatura em °C" placeholder="Ex.: 37,8" suffix="°C" hint="Entre 30 e 45 °C." />;
  }
}

/* —— Registrar · Flow —— */

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export function RegisterFlow({
  view,
  go,
  neonatal,
}: {
  view: Extract<ProtoView, { area: "registrar" }> & { types: RecordTypeId[] };
  go: Go;
  neonatal: boolean;
}) {
  const [types, setTypes] = useState<RecordTypeId[]>(view.types);
  const [adding, setAdding] = useState(false);
  const [hygiene, setHygiene] = useState<string[]>(["Escovação da pelagem"]);
  const puppy = types.some((t) => RECORD_TYPES[t].puppyOnly);
  const available = puppy ? (neonatal ? KITTENS : []) : petsOf(neonatal);
  const [pets, setPets] = useState<PetId[]>((view.pets ?? []).filter((id) => available.some((p) => p.id === id)));
  const [notice, setNotice] = useState<string | null>(null);

  const multi = types.length > 1;
  const many = pets.length > 1;

  if (view.saved) {
    const saved = view.pets ?? [];
    const total = saved.length * view.types.length;
    return (
      <div className="cd-arch-page">
        <div className="cd-arch-saved">
          <div className="cd-feedback-v2">
            <FourPointStar size={11} />
            <p className="text-sm font-semibold">
              {total > 1 ? `${total} registros salvos` : RECORD_TYPES[view.types[0]].done} · {namesOf(saved)}
            </p>
          </div>
          <p className="cd-arch-lede">
            Protótipo · nada foi salvo. {view.types.map((t) => RECORD_TYPES[t].label).join(" + ")}
            {total > 1 ? ` · ${saved.length} ${plural(saved.length, "pet", "pets")} × ${view.types.length} ${plural(view.types.length, "tipo", "tipos")}, registros independentes.` : "."}
          </p>
          <div className="cd-arch-actions">
            <button
              type="button"
              className="cd-btn-v2-primary"
              onClick={() =>
                saved.length === 1 && !isKitten(saved[0])
                  ? go({ area: "pets", petId: saved[0], sub: "historico" })
                  : go({ area: "cuidados", tab: "historico" })
              }
            >
              Ver no histórico
            </button>
            <button type="button" className="cd-btn-v2-secondary" onClick={() => go({ area: "registrar" })}>
              Registrar outro
            </button>
            <button type="button" className="cd-btn-v2-tertiary" onClick={() => go({ area: "cuidados", tab: "overview" })}>
              Ir para Cuidados
            </button>
          </div>
        </div>
      </div>
    );
  }

  const addType = (type: RecordTypeId) => {
    const next = [...types, type];
    setTypes(next);
    setAdding(false);
    if (RECORD_TYPES[type].puppyOnly) {
      const removed = pets.filter((id) => !isKitten(id));
      if (removed.length) {
        setPets(pets.filter(isKitten));
        setNotice(
          `${namesOf(removed)} ${plural(removed.length, "foi desmarcado", "foram desmarcados")} — xixi, cocô e temperatura só valem para filhotes.`
        );
      }
    }
  };

  const removeType = (type: RecordTypeId) => {
    const next = types.filter((t) => t !== type);
    if (!next.length) {
      go({ area: "registrar" });
      return;
    }
    setTypes(next);
  };

  const total = pets.length * types.reduce((n, t) => n + (t === "higiene" ? Math.max(1, hygiene.length) : 1), 0);
  const sharedClinic = multi && types.some((t) => RECORD_TYPES[t].clinic);
  const reminder = !multi && RECORD_TYPES[types[0]].reminder;
  const attachTypes = types.filter((t) => RECORD_TYPES[t].attach && !(t === "higiene" && hygiene.length > 1));
  const title = multi ? `Registrar ${types.length} cuidados` : RECORD_TYPES[types[0]].action;
  const Icon = RECORD_TYPES[types[0]].icon;

  return (
    <div className="cd-arch-page cd-arch-flow">
      <button type="button" className="cd-arch-back" onClick={() => go({ area: "registrar" })}>
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        Registrar
      </button>
      <header className="cd-arch-flow-head">
        <span className="cd-arch-flow-icon">
          <Icon size={20} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="cd-arch-title">{title}</h2>
          <p className="cd-arch-lede">Pets e campos na mesma tela. Sem voltar para o início.</p>
        </div>
      </header>
      <FlowSteps current={pets.length ? 2 : 1} />

      <div className="cd-arch-form">
        <section className="cd-arch-flow-block" aria-label="Cuidados">
          <p className="cd-label">{multi ? "Cuidados" : "Cuidado"}</p>
          <div className="cd-arch-care-chips">
            {types.map((t) => {
              const TIcon = RECORD_TYPES[t].icon;
              return (
                <span key={t} className="cd-arch-care-chip">
                  <TIcon size={14} strokeWidth={1.75} aria-hidden />
                  {RECORD_TYPES[t].label}
                  <button type="button" aria-label={`Remover ${RECORD_TYPES[t].label}`} onClick={() => removeType(t)}>
                    <X size={12} strokeWidth={2} />
                  </button>
                </span>
              );
            })}
            <button type="button" className="cd-arch-add-care" aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
              <Plus size={14} strokeWidth={1.75} aria-hidden />
              Adicionar outro cuidado
            </button>
          </div>
          {adding ? (
            <div className="cd-arch-add-panel">
              <TypeGroups onPick={addType} exclude={types} />
            </div>
          ) : null}
          {multi ? <span className="cd-meta">Cada cuidado vira um bloco. Pets × cuidados = registros independentes.</span> : null}
        </section>

        <section className="cd-arch-flow-block" aria-label="Pets">
          <p className="cd-label">Pets</p>
          {available.length ? (
            <PetPicker pets={available} value={pets} onChange={setPets} />
          ) : (
            <p className="cd-meta">Nenhum filhote com até 8 semanas no momento.</p>
          )}
          <span className="cd-meta">Pode escolher mais de um — o registro será criado para cada pet selecionado.</span>
          {puppy && available.length ? <span className="cd-meta">Xixi, cocô e temperatura: só filhotes em fase neonatal aparecem aqui.</span> : null}
          {notice ? <p className="cd-arch-notice">{notice}</p> : null}
        </section>

        <section className="cd-arch-flow-block" aria-label="Campos" data-dim={pets.length ? undefined : "true"}>
          <p className="cd-label">Campos</p>
          {types.map((t) => {
            const TIcon = RECORD_TYPES[t].icon;
            return (
              <section key={t} className="cd-arch-type-block" aria-label={RECORD_TYPES[t].label}>
                {multi ? (
                  <p className="cd-arch-type-block-head">
                    <TIcon size={15} strokeWidth={1.75} aria-hidden />
                    {RECORD_TYPES[t].label}
                  </p>
                ) : null}
                <div className="cd-arch-form">
                  <TypeFields type={t} multi={multi} pets={pets} hygiene={hygiene} onHygiene={setHygiene} />
                </div>
              </section>
            );
          })}

          <section className="cd-arch-shared" aria-label={multi ? "Vale para todos os cuidados" : "Quando e observação"}>
            {multi ? <p className="cd-label">Vale para todos os cuidados</p> : null}
            <div className="cd-arch-form">
              <Field label="Quando?" defaultValue="Hoje · 19h10" />
              {sharedClinic ? <Field label="Clínica ou veterinário" placeholder="Ex.: Clínica Bem-Estar" /> : null}
              {reminder ? (
                <Field label="Lembrar novamente em (opcional)" placeholder="dd/mm/aaaa" hint="Cria um lembrete na Agenda para cada pet." />
              ) : null}
              <TextArea
                label={
                  types.length === 1 && types[0] === "higiene"
                    ? "Quer acrescentar algo importante?"
                    : many
                      ? "Observação para todos (opcional)"
                      : "Observação (opcional)"
                }
              />
              {many ? (
                <Toggle label="Quer adicionar uma observação individual?">
                  <p className="cd-meta">Se preenchida, substitui a observação geral só naquele pet.</p>
                  <div className="cd-arch-form mt-2">
                    {pets.map((id) => (
                      <TextArea key={id} label={`Observação — ${petName(id)}`} />
                    ))}
                  </div>
                </Toggle>
              ) : null}
            </div>
          </section>

          {attachTypes.length ? (
            many ? (
              <div className="cd-arch-form">
                <p className="cd-label">Arquivos por pet</p>
                <p className="cd-meta">Cada arquivo fica só no registro deste pet e deste tipo.</p>
                <PetBlocks pets={pets}>
                  {() => attachTypes.map((t) => <Attachment key={t} label={attachTypes.length > 1 ? `Anexos (${RECORD_TYPES[t].label})` : "Anexos"} />)}
                </PetBlocks>
              </div>
            ) : (
              attachTypes.map((t) => <Attachment key={t} label={attachTypes.length > 1 ? `Anexos (${RECORD_TYPES[t].label})` : "Anexos (opcional)"} />)
            )
          ) : null}
        </section>
      </div>

      {pets.length ? (
        <section className="cd-arch-save-summary" aria-label="Resumo">
          <p className="cd-arch-save-summary-math">
            {pets.length} {plural(pets.length, "pet", "pets")} × {types.length} {plural(types.length, "cuidado", "cuidados")}
          </p>
          <p className="text-sm font-semibold">
            {total} {plural(total, "registro será criado", "registros serão criados")}
          </p>
          <p className="cd-meta">
            {namesOf(pets)} · {types.map((t) => RECORD_TYPES[t].label).join(", ")}
            {types.includes("higiene") && hygiene.length > 1 ? " · higiene conta um registro por cuidado marcado" : ""}
          </p>
        </section>
      ) : null}

      <div className="cd-arch-form-footer">
        <button
          type="button"
          className="cd-btn-v2-primary"
          disabled={pets.length === 0}
          onClick={() => go({ area: "registrar", types, pets, saved: true })}
        >
          {total > 1 ? `Salvar ${total} registros` : "Salvar registro"}
        </button>
        <button type="button" className="cd-btn-v2-secondary" onClick={() => go({ area: "registrar" })}>
          Cancelar
        </button>
        <span className="cd-meta">
          {pets.length === 0
            ? "Escolha ao menos um pet."
            : total > 1
              ? `${total} registros serão criados (${pets.length} ${plural(pets.length, "pet", "pets")} × ${types.length} ${plural(types.length, "tipo", "tipos")})`
              : `Para ${petName(pets[0])}`}
        </span>
      </div>
    </div>
  );
}
