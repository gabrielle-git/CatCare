import { NextResponse } from "next/server";
import { ensureHousehold } from "@/lib/households";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const HOUSEHOLD_TABLES = [
  "pets",
  "weight_records",
  "health_records",
  "vaccine_doses",
  "neonatal_records",
  "expenses",
  "reminders",
  "documents",
  "memories",
  "memory_pets",
  "memory_media",
  "products",
  "purchases",
  "product_reviews",
  "health_plans",
  "health_plan_templates",
  "health_plan_guides",
  "benefit_memberships",
] as const;

async function exportHouseholdTable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: (typeof HOUSEHOLD_TABLES)[number],
  householdId: string,
) {
  const result = await supabase.from(table).select("*").eq("household_id", householdId);
  return result.error ? { error: result.error.message } : result.data ?? [];
}

async function exportByForeignKeys<T extends string>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: T,
  column: string,
  ids: string[],
) {
  if (ids.length === 0) return [];
  const result = await supabase.from(table).select("*").in(column, ids);
  return result.error ? { error: result.error.message } : result.data ?? [];
}

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Exportação indisponível neste ambiente." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ error: "Entre na sua conta para exportar." }, { status: 401 });
  }

  const household = await ensureHousehold(supabase, data.user.id);

  const householdEntries = await Promise.all(
    HOUSEHOLD_TABLES.map(async (table) => [table, await exportHouseholdTable(supabase, table, household.id)] as const),
  );

  const plans = householdEntries.find(([table]) => table === "health_plans")?.[1];
  const guides = householdEntries.find(([table]) => table === "health_plan_guides")?.[1];

  const planIds = Array.isArray(plans) ? plans.map((row) => String((row as { id: string }).id)) : [];
  const guideIds = Array.isArray(guides) ? guides.map((row) => String((row as { id: string }).id)) : [];

  const [copayRules, guideServices] = await Promise.all([
    exportByForeignKeys(supabase, "health_plan_copay_rules", "health_plan_id", planIds),
    exportByForeignKeys(supabase, "health_plan_guide_services", "guide_id", guideIds),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    household: { id: household.id, name: household.name },
    data: Object.fromEntries([
      ...householdEntries,
      ["health_plan_copay_rules", copayRules],
      ["health_plan_guide_services", guideServices],
    ]),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="catcare-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
