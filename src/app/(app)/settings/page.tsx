import Link from "next/link";
import { Bell, Cat, ChevronRight, Download, Home, LogOut, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { ensureHousehold } from "@/lib/households";
import { listMyHouseholds } from "@/lib/household-switch";
import { roleLabel } from "@/lib/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { logout, switchHousehold, updateDisplayName } from "./actions";

export const dynamic = "force-dynamic";

async function loadSettings() {
  if (!hasSupabaseEnv()) return { configured: false, email: null, displayName: "Família dos gatos", householdName: "Nossa família", members: 1, activePets: 4, archivedPets: 0, households: [] as Awaited<ReturnType<typeof listMyHouseholds>> };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { configured: true, email: null, displayName: null, householdName: null, members: 0, activePets: 0, archivedPets: 0, households: [] as Awaited<ReturnType<typeof listMyHouseholds>> };
  const household = await ensureHousehold(supabase, data.user.id);
  const [profile, members, activePets, archivedPets, households] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", data.user.id).maybeSingle(),
    supabase.from("household_members").select("*", { count: "exact", head: true }).eq("household_id", household.id),
    supabase.from("pets").select("*", { count: "exact", head: true }).eq("household_id", household.id).is("archived_at", null),
    supabase.from("pets").select("*", { count: "exact", head: true }).eq("household_id", household.id).not("archived_at", "is", null),
    listMyHouseholds(supabase).catch(() => []),
  ]);
  return { configured: true, email: data.user.email ?? null, displayName: profile.data?.display_name ?? data.user.email?.split("@")[0] ?? "Responsável", householdName: household.name, members: members.count ?? 1, activePets: activePets.count ?? 0, archivedPets: archivedPets.count ?? 0, households };
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; switched?: string; error?: string }> }) {
  const flags = await searchParams;
  const data = await loadSettings();
  const signedIn = Boolean(data.configured && data.email);
  const rows = [
    { label: "Família e membros", detail: `${data.members} ${data.members === 1 ? "pessoa com acesso" : "pessoas com acesso"}`, href: "/settings/members", icon: UsersRound, tone: "bg-[var(--rose-soft)]" },
    { label: "Notificações e rotina", detail: "Revise os lembretes que vão aparecer na agenda.", href: "/agenda", icon: Bell, tone: "bg-[var(--lavender-soft)]" },
    { label: "Privacidade e exportação", detail: signedIn ? "Baixe uma cópia JSON dos dados da família." : "A exportação fica disponível após entrar.", href: signedIn ? "/api/export" : "/login", icon: ShieldCheck, tone: "bg-[var(--mint-soft)]" },
    { label: "Meus gatos", detail: `${data.activePets} ativos • ${data.archivedPets} arquivados`, href: "/pets", icon: Cat, tone: "bg-[var(--peach)]" },
  ];

  return <div className="mx-auto w-full max-w-[900px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Configurações</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">Conta e dados</h1>    <p className="mt-2 text-sm text-[var(--muted)]">Acesso da família, privacidade e organização dos perfis.</p>
    {flags.saved && <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Nome atualizado.</div>}
    {flags.switched && <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Família ativa alterada. A home e os gatos agora refletem esta família.</div>}
    {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}

    {signedIn && data.households.length > 0 && (
      <section className="cat-card mt-6 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <span className="grid size-10 place-items-center rounded-[16px] bg-[var(--lavender-soft)]"><Home size={18} /></span>
          <div>
            <h2 className="font-bold">Suas famílias</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Troque qual família você está vendo e gerenciando agora.</p>
          </div>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {data.households.map((item) => {
            const use = switchHousehold.bind(null, item.household_id);
            return (
              <article key={item.household_id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold">{item.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{roleLabel(item.role)}{item.is_active ? " • em uso agora" : ""}</p>
                </div>
                {item.is_active ? (
                  <span className="rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-[10px] font-bold text-[var(--success)]">Ativa</span>
                ) : (
                  <form action={use}>
                    <button type="submit" className="focus-ring rounded-2xl bg-[var(--graphite)] px-4 py-2.5 text-xs font-bold text-white">Usar esta família</button>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      </section>
    )}

    <section className="cat-card mt-7 overflow-hidden"><div className="flex flex-col gap-4 bg-[linear-gradient(135deg,var(--lavender-soft),var(--rose-soft))] p-5 sm:flex-row sm:items-center sm:justify-between md:p-6"><div className="flex items-center gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-[18px] bg-white/75"><UserRound size={21} /></span><div><p className="text-xs font-semibold text-[var(--muted)]">Minha conta</p><h2 className="mt-0.5 text-lg font-bold">{data.displayName || "Você ainda não entrou"}</h2><p className="mt-1 text-xs text-[var(--muted)]">{data.email || "Modo demonstrativo local"}</p></div></div>{signedIn ? <form action={logout}><button className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-xs font-bold"><LogOut size={15} /> Sair da conta</button></form> : <Link href="/login" className="focus-ring inline-flex w-fit items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-xs font-bold text-white"><UserRound size={15} /> Entrar ou criar conta</Link>}</div>
      {signedIn && (
        <form action={updateDisplayName} className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-4 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-sm font-bold">Seu nome na família
            <input name="display_name" defaultValue={data.displayName ?? ""} maxLength={60} className="field mt-2" placeholder="Ex.: Helena, Evandro" />
            <span className="mt-1.5 block text-[10px] font-normal text-[var(--muted)]">Visível para todos os membros. Apelidos privados de outras pessoas ficam em Membros.</span>
          </label>
          <button type="submit" className="focus-ring shrink-0 rounded-2xl bg-[var(--lavender-soft)] px-4 py-3 text-xs font-bold text-[var(--lavender-strong)]">Salvar nome</button>
        </form>
      )}
      <div className="border-t border-[var(--border)] px-5 py-4 text-xs text-[var(--muted)]"><strong className="text-[var(--foreground)]">{data.householdName || "Sua família"}</strong> • Os dados pertencem à família e não a um único gatinho.</div>
    </section>

    <div className="mt-5 space-y-3">{rows.map(({ label, detail, href, icon: Icon, tone }) => {
      const content = <><span className={`grid size-11 shrink-0 place-items-center rounded-[17px] ${tone}`}><Icon size={19} /></span><span className="min-w-0 flex-1"><strong className="block text-sm">{label}</strong><span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">{detail}</span></span>{href ? label.startsWith("Privacidade") && signedIn ? <Download size={17} className="shrink-0 text-[var(--muted)]" /> : <ChevronRight size={17} className="shrink-0 text-[var(--muted)]" /> : <span className="rounded-full bg-[var(--cream)] px-2 py-1 text-[9px] font-bold text-[var(--muted)]">Em evolução</span>}</>;
      return href ? <Link key={label} href={href} className="cat-card focus-ring flex items-center gap-4 p-4 transition hover:-translate-y-0.5">{content}</Link> : <div key={label} className="cat-card flex items-center gap-4 p-4">{content}</div>;
    })}</div>
    <p className="mt-6 rounded-[20px] bg-[var(--cream)] px-4 py-3 text-xs leading-relaxed text-[var(--muted)]">O CatCare mantém fotos e documentos em armazenamento privado quando o Supabase está conectado. O modo demonstrativo não envia dados para nenhum servidor.</p>
  </div>;
}
