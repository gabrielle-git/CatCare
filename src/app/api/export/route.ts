import { NextResponse } from "next/server";
import { ensureHousehold } from "@/lib/households";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!hasSupabaseEnv()) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Entre na sua conta para exportar." }, { status: 401 });
  const household = await ensureHousehold(supabase, data.user.id);
  const tables = ["pets", "weight_records", "health_records", "vaccine_doses", "neonatal_records", "expenses", "reminders", "documents", "memories", "memory_pets", "memory_media", "products", "purchases", "product_reviews"] as const;
  const entries = await Promise.all(tables.map(async (table) => {
    const result = await supabase.from(table).select("*").eq("household_id", household.id);
    return [table, result.error ? { error: result.error.message } : result.data ?? []] as const;
  }));
  const payload = { exported_at: new Date().toISOString(), household: { id: household.id, name: household.name }, data: Object.fromEntries(entries) };
  return new NextResponse(JSON.stringify(payload, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="catcare-${new Date().toISOString().slice(0, 10)}.json"` } });
}
