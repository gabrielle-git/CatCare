import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MORE_MENU_ACCOUNT, MORE_MENU_GROUPS } from "@/lib/more-menu";

export default function MorePage() {
  return (
    <div className="mx-auto w-full max-w-[860px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Outras áreas</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Mais</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Atalhos para os módulos que não ficam na barra principal.</p>

      <div className="mt-7 space-y-7">
        {MORE_MENU_GROUPS.map((group) => (
          <section key={group.id}>
            <p className="mb-3 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{group.label}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.items.map(({ label, detail, href, icon: Icon, tone }) => (
                <Link
                  key={href}
                  href={href}
                  className="cat-card focus-ring flex items-center gap-4 p-4 transition hover:-translate-y-0.5"
                >
                  <span className={`grid size-11 shrink-0 place-items-center rounded-[18px] ${tone}`}>
                    <Icon size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block">{label}</strong>
                    <span className="mt-1 block text-xs text-[var(--muted)]">{detail}</span>
                  </span>
                  <ChevronRight size={17} className="shrink-0 text-[var(--muted)]" />
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section>
          <p className="mb-3 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Conta</p>
          <Link
            href={MORE_MENU_ACCOUNT.href}
            className="cat-card focus-ring flex items-center gap-4 p-4 transition hover:-translate-y-0.5"
          >
            {(() => {
              const AccountIcon = MORE_MENU_ACCOUNT.icon;
              return (
                <span className={`grid size-11 shrink-0 place-items-center rounded-[18px] ${MORE_MENU_ACCOUNT.tone}`}>
                  <AccountIcon size={19} />
                </span>
              );
            })()}
            <span className="min-w-0 flex-1">
              <strong className="block">{MORE_MENU_ACCOUNT.label}</strong>
              <span className="mt-1 block text-xs text-[var(--muted)]">{MORE_MENU_ACCOUNT.detail}</span>
            </span>
            <ChevronRight size={17} className="shrink-0 text-[var(--muted)]" />
          </Link>
        </section>
      </div>
    </div>
  );
}
