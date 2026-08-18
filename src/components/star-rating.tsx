"use client";

import { useId, useState } from "react";
import { Star } from "lucide-react";
import { SCORE_LABELS } from "@/lib/score-labels";

export function StarRating({
  name,
  legend,
  defaultValue = 0,
  allowEmpty = false,
  required = false,
  disabled = false,
}: {
  name: string;
  legend: string;
  defaultValue?: number;
  allowEmpty?: boolean;
  required?: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const legendId = useId();
  const label = value > 0 ? SCORE_LABELS[value] : allowEmpty ? "Avaliar depois" : "Toque para avaliar";

  return (
    <fieldset className="text-sm font-bold">
      <legend id={legendId} className="mb-2">{legend}</legend>
      <input type="hidden" name={name} value={value > 0 ? String(value) : ""} required={required && value === 0} />
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-labelledby={legendId}>
        {[1, 2, 3, 4, 5].map((score) => {
          const active = value >= score;
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={value === score}
              aria-label={`${score} — ${SCORE_LABELS[score]}`}
              disabled={disabled}
              onClick={() => setValue(score === value && allowEmpty ? 0 : score)}
              className="focus-ring rounded-lg p-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Star size={26} className={active ? "fill-[var(--lavender)] text-[var(--lavender)]" : "text-[var(--border)]"} />
            </button>
          );
        })}
        <span className="ml-1 text-xs font-semibold text-[var(--muted)]">{label}</span>
      </div>
    </fieldset>
  );
}
