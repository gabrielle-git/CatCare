import { NextResponse } from "next/server";
import { EXPORT_HOUSEHOLD_TABLES } from "@/lib/export-tables";
import { ensureHousehold } from "@/lib/households";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const HOUSEHOLD_TABLES = EXPORT_HOUSEHOLD_TABLES;

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
  const pets = householdEntries.find(([table]) => table === "pets")?.[1];

  const planIds = Array.isArray(plans) ? plans.map((row) => String((row as { id: string }).id)) : [];
  const guideIds = Array.isArray(guides) ? guides.map((row) => String((row as { id: string }).id)) : [];
  const petIds = Array.isArray(pets) ? pets.map((row) => String((row as { id: string }).id)) : [];

  const [copayRules, guideServices, feedingSessions] = await Promise.all([
    exportByForeignKeys(supabase, "health_plan_copay_rules", "health_plan_id", planIds),
    exportByForeignKeys(supabase, "health_plan_guide_services", "guide_id", guideIds),
    exportByForeignKeys(supabase, "feeding_sessions", "pet_id", petIds),
  ]);

  const sessionIds = Array.isArray(feedingSessions)
    ? feedingSessions.map((row) => String((row as { id: string }).id))
    : [];
  const feedingItems = await exportByForeignKeys(supabase, "feeding_items", "session_id", sessionIds);

  const payload = {
    exported_at: new Date().toISOString(),
    household: { id: household.id, name: household.name },
    data: Object.fromEntries([
      ...householdEntries,
      ["health_plan_copay_rules", copayRules],
      ["health_plan_guide_services", guideServices],
      ["feeding_sessions", feedingSessions],
      ["feeding_items", feedingItems],
    ]),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="catcare-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
