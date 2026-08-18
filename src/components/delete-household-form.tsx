"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

export function DeleteHouseholdForm({
  householdName,
  action,
}: {
  householdName: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === householdName.trim();

  return (
    <form action={action} className="flex min-w-0 flex-col gap-2">
      <label className="text-[10px] font-bold text-[var(--muted)]">
        Digite <span className="text-[var(--foreground)]">{householdName}</span> para excluir
        <input
          name="confirm_name"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          className="field mt-1 py-2 text-xs"
          placeholder={householdName}
        />
      </label>
      <button
        type="submit"
        disabled={!matches}
        className="focus-ring inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-[10px] font-bold text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 size={13} /> Excluir família
      </button>
    </form>
  );
}
