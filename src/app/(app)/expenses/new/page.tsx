import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { CreateExpenseForm } from "@/components/create-expense-form";
import { ensureHousehold } from "@/lib/households";
import { demoPets } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { isLiveData } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase/server";
import { createExpense } from "../actions";

async function loadPetsForForm() {
  if (!(await isLiveData())) return { pets: demoPets, configured: false };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { pets: [], configured: true };
  const household = await ensureHousehold(supabase, data.user.id);
  return { pets: await listPets(supabase, household.id), configured: true };
}

export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ pets, configured }, flags] = await Promise.all([loadPetsForForm(), searchParams]);
  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/expenses" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Voltar aos gastos
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-[18px] bg-[var(--lavender-soft)]">
          <ReceiptText size={20} />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Novo lançamento</p>
          <h1 className="text-3xl font-bold tracking-[-0.04em]">Adicionar gasto</h1>
        </div>
      </div>
      <CreateExpenseForm
        action={createExpense}
        pets={pets.map((pet) => ({ id: pet.id, name: pet.name }))}
        configured={configured}
        initialError={flags.error}
      />
    </div>
  );
}
