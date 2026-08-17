import type { SupabaseClient } from "@supabase/supabase-js";
import { PET_MEDIA_BUCKET } from "@/lib/pets";
import type { Memory, MemoryMedia, MemoryMediaWithUrl, MemoryWithMediaUrl } from "@/types/database";

const MEDIA_TTL_SECONDS = 60 * 60;

async function attachMediaUrls(supabase: SupabaseClient, memory: Memory, petIds: string[], rows: MemoryMedia[]): Promise<MemoryWithMediaUrl> {
  const ordered = [...rows].sort((a, b) => a.position - b.position);
  const legacyRows: MemoryMedia[] = ordered.length === 0 && memory.media_path ? [{ id: `legacy-${memory.id}`, household_id: memory.household_id, memory_id: memory.id, storage_path: memory.media_path, position: 0, created_at: memory.created_at }] : [];
  const media: MemoryMediaWithUrl[] = await Promise.all([...ordered, ...legacyRows].map(async (item) => {
    const { data, error } = await supabase.storage.from(PET_MEDIA_BUCKET).createSignedUrl(item.storage_path, MEDIA_TTL_SECONDS);
    return { ...item, url: error ? null : data.signedUrl };
  }));
  return { ...memory, media_url: media.find((item) => item.url)?.url ?? null, media, pet_ids: petIds };
}

async function attachPetsAndMedia(supabase: SupabaseClient, householdId: string, memories: Memory[]) {
  if (memories.length === 0) return [];
  const ids = memories.map((memory) => memory.id);
  const [{ data: links, error }, { data: mediaRows, error: mediaError }] = await Promise.all([
    supabase.from("memory_pets").select("memory_id, pet_id").eq("household_id", householdId).in("memory_id", ids),
    supabase.from("memory_media").select("*").eq("household_id", householdId).in("memory_id", ids).order("position", { ascending: true }),
  ]);
  if (error) throw error;
  if (mediaError) throw mediaError;
  const petIdsByMemory = new Map<string, string[]>();
  const mediaByMemory = new Map<string, MemoryMedia[]>();
  for (const link of links ?? []) {
    const current = petIdsByMemory.get(link.memory_id) ?? [];
    current.push(link.pet_id);
    petIdsByMemory.set(link.memory_id, current);
  }
  for (const row of (mediaRows ?? []) as MemoryMedia[]) {
    const current = mediaByMemory.get(row.memory_id) ?? [];
    current.push(row);
    mediaByMemory.set(row.memory_id, current);
  }
  return Promise.all(memories.map((memory) => attachMediaUrls(supabase, memory, petIdsByMemory.get(memory.id) ?? (memory.pet_id ? [memory.pet_id] : []), mediaByMemory.get(memory.id) ?? [])));
}

export async function listMemories(supabase: SupabaseClient, householdId: string, archived = false): Promise<MemoryWithMediaUrl[]> {
  let query = supabase.from("memories").select("*").eq("household_id", householdId).order("occurred_at", { ascending: false });
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return attachPetsAndMedia(supabase, householdId, (data ?? []) as Memory[]);
}

export async function getMemory(supabase: SupabaseClient, householdId: string, memoryId: string): Promise<MemoryWithMediaUrl | null> {
  const { data, error } = await supabase.from("memories").select("*").eq("id", memoryId).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await attachPetsAndMedia(supabase, householdId, [data as Memory]))[0] ?? null;
}
