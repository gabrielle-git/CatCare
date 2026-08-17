export function AuthScreen({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-svh w-full max-w-[440px] bg-[var(--background)] px-5 py-10 sm:my-5 sm:min-h-[calc(100svh-40px)] sm:rounded-[32px] sm:border sm:border-[#d6d1db]">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">CatCare</p>
      <h1 className="mt-2 text-3xl font-bold">{title}</h1>
      {children}
    </main>
  );
}
