import { BottomNav } from "@/components/bottom-nav";
import { DesktopSidebar } from "@/components/desktop-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh lg:flex">
      <DesktopSidebar />
      <main className="min-h-svh min-w-0 flex-1 pb-24 lg:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
