import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import { MobileHeader } from "@/components/mobile-header";
import { isDemoMode } from "@/lib/demo-mode";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const showDemoBanner = hasSupabaseEnv() && (await isDemoMode());

  return (
    <div data-brand="cuidadim" data-theme="light" className="cd-app-canvas min-h-svh lg:flex">
      <DesktopSidebar />
      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main className="min-w-0 flex-1 pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0">
          {showDemoBanner && (
            <div data-brand="cuidadim" data-theme="light" className="cd-app-demo-notice border-b border-[var(--border)] px-4 py-3 text-sm sm:px-5 md:px-8">
              <strong>Modo demonstração.</strong>{" "}
              <span className="text-pretty">Dados de exemplo — nada é salvo.</span>{" "}
              <Link href="/login" className="font-bold underline">Crie sua conta ou faça login</Link>
              {" · "}
              <Link href="/demo/sair" className="font-bold underline">Sair da demo</Link>
            </div>
          )}
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
