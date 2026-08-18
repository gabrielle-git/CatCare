import type { SupabaseClient } from "@supabase/supabase-js";
import { PET_MEDIA_BUCKET } from "@/lib/pets";

async function listFolderPaths(supabase: SupabaseClient, prefix: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from(PET_MEDIA_BUCKET).list(prefix, { limit: 1000, offset: 0 });
  if (error || !data) return [];
  const nested = await Promise.all(data.map(async (item) => {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (!item.id) return listFolderPaths(supabase, path);
    return [path];
  }));
  return nested.flat();
}

export async function removeHouseholdMedia(supabase: SupabaseClient, householdId: string) {
  const [pets, memories, media, documents, expenses] = await Promise.all([
    supabase.from("pets").select("photo_path").eq("household_id", householdId),
    supabase.from("memories").select("media_path").eq("household_id", householdId),
    supabase.from("memory_media").select("storage_path").eq("household_id", householdId),
    supabase.from("documents").select("storage_path").eq("household_id", householdId),
    supabase.from("expenses").select("receipt_path").eq("household_id", householdId),
  ]);

  const fromTables = [
    ...(pets.data ?? []).map((row) => row.photo_path),
    ...(memories.data ?? []).map((row) => row.media_path),
    ...(media.data ?? []).map((row) => row.storage_path),
    ...(documents.data ?? []).map((row) => row.storage_path),
    ...(expenses.data ?? []).map((row) => row.receipt_path),
  ].filter((path): path is string => Boolean(path));

  const fromBucket = await listFolderPaths(supabase, householdId);
  const paths = [...new Set([...fromTables, ...fromBucket])];
  if (paths.length === 0) return;

  for (let index = 0; index < paths.length; index += 100) {
    const chunk = paths.slice(index, index + 100);
    const { error } = await supabase.storage.from(PET_MEDIA_BUCKET).remove(chunk);
    if (error) throw new Error(error.message);
  }
}
