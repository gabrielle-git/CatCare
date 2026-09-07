"use client";

import { useEffect, useState, type ComponentProps } from "react";
import {
  factualDateInputMax,
  factualDateTimeInputMax,
  validateFactualCivilDate,
  validateFactualDateTimeLocal,
} from "@/lib/factual-datetime";

type DateProps = Omit<ComponentProps<"input">, "type" | "max"> & {
  type?: "date";
};

type DateTimeProps = Omit<ComponentProps<"input">, "type" | "max"> & {
  type?: "datetime-local";
};

/**
 * Date input with live max=today (APP_TIMEZONE) and clear validation message.
 * Server actions still re-validate — this is UX only.
 */
export function FactualDateInput({ onChange, ...props }: DateProps) {
  const [max, setMax] = useState(() => factualDateInputMax());
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMax(factualDateInputMax());
    const id = window.setInterval(() => setMax(factualDateInputMax()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      <input
        {...props}
        type="date"
        max={max}
        onChange={(event) => {
          const value = event.target.value;
          if (!value) {
            setMessage(null);
          } else {
            const result = validateFactualCivilDate(value);
            setMessage(result.ok ? null : result.message);
            if (!result.ok) event.target.setCustomValidity(result.message);
            else event.target.setCustomValidity("");
          }
          onChange?.(event);
        }}
      />
      {message && (
        <span className="mt-1 block text-xs font-semibold text-[var(--danger)]" role="alert">
          {message}
        </span>
      )}
    </>
  );
}

/**
 * Datetime-local input with live max=now and clear validation message.
 */
export function FactualDateTimeInput({ onChange, ...props }: DateTimeProps) {
  const [max, setMax] = useState(() => factualDateTimeInputMax());
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setMax(factualDateTimeInputMax());
    refresh();
    const id = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      <input
        {...props}
        type="datetime-local"
        max={max}
        onChange={(event) => {
          const value = event.target.value;
          if (!value) {
            setMessage(null);
            event.target.setCustomValidity("");
          } else {
            const result = validateFactualDateTimeLocal(value);
            const msg = result.ok ? null : result.message;
            setMessage(msg);
            event.target.setCustomValidity(msg ?? "");
          }
          onChange?.(event);
        }}
      />
      {message && (
        <span className="mt-1 block text-xs font-semibold text-[var(--danger)]" role="alert">
          {message}
        </span>
      )}
    </>
  );
}
