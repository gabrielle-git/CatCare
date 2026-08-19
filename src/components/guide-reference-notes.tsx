"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { parseGuideNoteLines } from "@/lib/health-plan-guides";

export function GuideReferenceNotes({
  guideId,
  paymentNotes,
  waitingNotes,
  editable,
  saveAction,
  paymentTitle = "Como paga a coparticipação",
  waitingTitle = "Carências e prazos",
}: {
  guideId: string;
  paymentNotes: string | null;
  waitingNotes: string | null;
  editable: boolean;
  saveAction?: (formData: FormData) => void;
  paymentTitle?: string;
  waitingTitle?: string;
}) {
  const [editing, setEditing] = useState(false);
  const paymentLines = parseGuideNoteLines(paymentNotes);
  const waitingLines = parseGuideNoteLines(waitingNotes);
  const hasContent = paymentLines.length > 0 || waitingLines.length > 0;

  if (!hasContent && !editable) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold">Notas de referência</h3>
        {editable && saveAction && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-[var(--cream)] px-3 py-2 text-[10px] font-bold"
          >
            <Pencil size={12} /> Editar notas
          </button>
        )}
      </div>

      {editing && saveAction ? (
        <form action={saveAction} className="cat-card grid gap-4 p-5 md:p-6">
          <input type="hidden" name="guide_id" value={guideId} />
          <label className="text-sm font-bold">
            {paymentTitle}
            <textarea
              name="payment_notes"
              rows={4}
              defaultValue={paymentNotes ?? ""}
              placeholder="Uma linha por item. Ex.: Coparticipação paga na clínica no atendimento."
              className="field mt-2 resize-none font-normal"
            />
          </label>
          <label className="text-sm font-bold">
            {waitingTitle}
            <textarea
              name="waiting_notes"
              rows={4}
              defaultValue={waitingNotes ?? ""}
              placeholder="Uma linha por item. Ex.: Exames simples — 45 dias de carência."
              className="field mt-2 resize-none font-normal"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="focus-ring rounded-xl bg-[var(--graphite)] px-4 py-2.5 text-xs font-bold text-white">
              Salvar notas
            </button>
            <button type="button" onClick={() => setEditing(false)} className="focus-ring rounded-xl bg-[var(--cream)] px-4 py-2.5 text-xs font-bold">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[20px] border border-[var(--border)] bg-white p-5">
            <h4 className="font-bold">{paymentTitle}</h4>
            {paymentLines.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
                {paymentLines.map((line) => (
                  <li key={line} className="flex gap-2"><span className="text-[var(--lavender-strong)]">•</span><span>{line}</span></li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">Nenhuma nota ainda.</p>
            )}
          </div>
          <div className="rounded-[20px] border border-[var(--border)] bg-white p-5">
            <h4 className="font-bold">{waitingTitle}</h4>
            {waitingLines.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
                {waitingLines.map((line) => (
                  <li key={line} className="flex gap-2"><span className="text-[var(--lavender-strong)]">•</span><span>{line}</span></li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">Nenhuma nota ainda.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
