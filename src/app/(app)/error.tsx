"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[640px] px-5 py-10">
      <div className="cat-card border-red-200 bg-red-50 p-5 text-sm text-red-800">
        <p className="text-xs font-bold uppercase tracking-wider">Não foi possível abrir esta página</p>
        <p className="mt-2 leading-6">{error.message}</p>
        <button type="button" onClick={reset} className="focus-ring mt-4 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-xs font-bold text-white">
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
