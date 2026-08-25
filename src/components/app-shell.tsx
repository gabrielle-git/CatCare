import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import { isDemoMode } from "@/lib/demo-mode";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const showDemoBanner = hasSupabaseEnv() && (await isDemoMode());

  return (
    <div className="min-h-svh lg:flex">
      <DesktopSidebar />
      <main className="min-h-svh min-w-0 flex-1 pb-24 lg:pb-0">
        {showDemoBanner && (
          <div className="border-b border-[var(--border)] bg-[var(--peach)] px-5 py-3 text-sm md:px-8">
            <strong>Modo demonstração.</strong> Dados de exemplo — nada é salvo.{" "}
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
