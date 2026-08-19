import { redirect } from "next/navigation";
import { ensurePetloveLeveGuide } from "@/lib/health-plan-guides";
import { ensureHousehold } from "@/lib/households";
import { demoHealthPlanGuides } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function PetloveLegacyRedirectPage() {
  if (!hasSupabaseEnv()) {
    redirect(`/health-plan/guides/${demoHealthPlanGuides[0].id}`);
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const household = await ensureHousehold(supabase, data.user.id);
  const guide = await ensurePetloveLeveGuide(supabase, household.id);
  redirect(`/health-plan/guides/${guide.id}`);
}
