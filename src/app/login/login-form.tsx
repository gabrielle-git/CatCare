"use client";

import { useRef } from "react";
import { authenticate } from "./actions";

export function LoginForm({ configured }: { configured: boolean }) {
  const intentRef = useRef<HTMLInputElement>(null);

  return (
    <form action={authenticate} className="mt-6 space-y-4">
      <input ref={intentRef} type="hidden" name="intent" defaultValue="login" />
      <label className="block text-sm font-semibold">E-mail<input required type="email" name="email" autoComplete="email" className="focus-ring mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 font-normal" /></label>
      <label className="block text-sm font-semibold">Senha<input required minLength={6} type="password" name="password" autoComplete="current-password" className="focus-ring mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 font-normal" /></label>
      <button type="submit" disabled={!configured} onClick={() => { if (intentRef.current) intentRef.current.value = "login"; }} className="focus-ring w-full rounded-2xl bg-[var(--lavender-strong)] px-4 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-50">Entrar</button>
      <button type="submit" disabled={!configured} onClick={() => { if (intentRef.current) intentRef.current.value = "signup"; }} className="focus-ring w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50">Criar conta</button>
    </form>
  );
}
