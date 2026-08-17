"use client";

import { FormEvent, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";

type AnswerKey = "vaccine" | "expenses" | "weight" | "reminder" | "food" | "litter" | "shopping" | "summary";
type Message = { role: "user" | "assistant"; text: string };

const suggestions: { key: AnswerKey; label: string }[] = [
  { key: "vaccine", label: "Qual foi a última vacina?" },
  { key: "expenses", label: "Quanto gastamos este mês?" },
  { key: "weight", label: "Como estão os pesos?" },
  { key: "reminder", label: "Qual é o próximo cuidado?" },
  { key: "food", label: "Qual ração teve melhor aceitação?" },
  { key: "litter", label: "Qual areia vale recomprar?" },
  { key: "shopping", label: "Qual compra vale mais a pena?" },
];

function identify(text: string): AnswerKey {
  const normalized = text.toLocaleLowerCase("pt-BR");
  if (/vacina|dose|imuniza/.test(normalized)) return "vaccine";
  if (/gasto|gastei|dinheiro|despesa|valor/.test(normalized)) return "expenses";
  if (/peso|pesagem|engord|crescimento/.test(normalized)) return "weight";
  if (/lembrete|agenda|próxim|proxim|quando/.test(normalized)) return "reminder";
  if (/areia|granulado|caixa/.test(normalized)) return "litter";
  if (/ração|racao|sachê|sache|petisco|comida|alimento/.test(normalized)) return "food";
  if (/compra|produto|custo|recompr/.test(normalized)) return "shopping";
  return "summary";
}

export function AssistantPanel({ answers }: { answers: Record<AnswerKey, string> }) {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: "Oi! Eu organizo respostas usando somente o que está registrado no CatCare. O que você quer revisar?" }]);
  const [draft, setDraft] = useState("");

  function ask(text: string, key = identify(text)) {
    setMessages((current) => [...current, { role: "user", text }, { role: "assistant", text: answers[key] }]);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft.trim();
    if (!question) return;
    ask(question);
    setDraft("");
  }

  return <div className="cat-card mt-6 overflow-hidden">
    <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--cream)] px-4 py-3"><div className="flex items-center gap-2 text-xs font-bold"><span className="grid size-8 place-items-center rounded-[13px] bg-[var(--lavender-soft)]"><Bot size={16} /></span> Assistente de dados</div><span className="inline-flex items-center gap-1 rounded-full bg-[var(--mint-soft)] px-2.5 py-1 text-[9px] font-bold text-[var(--success)]"><Sparkles size={10} /> Sem inventar dados</span></div>
    <div className="min-h-[360px] space-y-3 p-4 md:min-h-[410px] md:p-5">{messages.map((message, index) => <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><p className={`max-w-[86%] rounded-[18px] px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "bg-[var(--graphite)] text-white" : "border border-[var(--border)] bg-white text-[var(--muted)]"}`}>{message.text}</p></div>)}</div>
    <div className="border-t border-[var(--border)] p-4 md:p-5"><div className="mb-3 flex flex-wrap gap-2">{suggestions.map((suggestion) => <button key={suggestion.key} type="button" onClick={() => ask(suggestion.label, suggestion.key)} className="focus-ring rounded-full border border-[var(--border)] bg-white px-3 py-2 text-[10px] font-bold transition hover:bg-[var(--lavender-soft)]">{suggestion.label}</button>)}</div><form onSubmit={submit} className="flex gap-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} className="field min-w-0 flex-1" placeholder="Pergunte sobre seus gatos..." aria-label="Pergunta para o assistente" /><button aria-label="Enviar pergunta" className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white"><Send size={17} /><span className="hidden sm:inline">Enviar</span></button></form></div>
  </div>;
}
