import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import { PerfNavigationProbe } from "@/components/perf-navigation-probe";
import { isDemoMode } from "@/lib/demo-mode";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const showDemoBanner = hasSupabaseEnv() && (await isDemoMode());

  return (
    <div className="min-h-svh lg:flex">
      <PerfNavigationProbe />
      <DesktopSidebar />
      <main className="min-h-svh min-w-0 flex-1 pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0">
        {showDemoBanner && (
          <div className="border-b border-[var(--border)] bg-[var(--peach)] px-4 py-3 text-sm sm:px-5 md:px-8">
            <strong>Modo demonstração.</strong>{" "}
            <span className="text-pretty">Dados de exemplo — nada é salvo.</span>{" "}
            <Link href="/login" className="font-bold underline">Crie sua conta ou faça login</Link>
            {" · "}
            <Link href="/demo/sair" className="font-bold underline">Sair da demo</Link>
          </div>
        )}
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
