"use client";

import { signup } from "../login/actions";
import { SubmitButton } from "@/components/submit-button";

export function SignupForm({ configured, nextPath }: { configured: boolean; nextPath?: string }) {
  return (
    <form action={signup} className="mt-6 space-y-4">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <label className="block text-sm font-semibold">Seu nome<input required name="display_name" autoComplete="name" maxLength={60} className="focus-ring mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 font-normal" placeholder="Ex.: Helena" /></label>
      <label className="block text-sm font-semibold">E-mail<input required type="email" name="email" autoComplete="email" className="focus-ring mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 font-normal" /></label>
      <label className="block text-sm font-semibold">Senha<input required minLength={6} type="password" name="password" autoComplete="new-password" className="focus-ring mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 font-normal" /></label>
      <SubmitButton disabled={!configured} pendingLabel="Criando conta..." className="focus-ring w-full rounded-2xl bg-[var(--lavender-strong)] px-4 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-50">Criar conta</SubmitButton>
    </form>
  );
}
