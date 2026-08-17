import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pet, PetWithPhotoUrl } from "@/types/database";

export const PET_MEDIA_BUCKET = "pet-media";
const PHOTO_TTL_SECONDS = 60 * 60;

async function addPhotoUrl(supabase: SupabaseClient, pet: Pet): Promise<PetWithPhotoUrl> {
  if (!pet.photo_path) return { ...pet, photo_url: null };
  const { data, error } = await supabase.storage.from(PET_MEDIA_BUCKET).createSignedUrl(pet.photo_path, PHOTO_TTL_SECONDS);
  return { ...pet, photo_url: error ? null : data.signedUrl };
}

export async function listPets(supabase: SupabaseClient, householdId: string): Promise<PetWithPhotoUrl[]> {
  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return Promise.all(((data ?? []) as Pet[]).map((pet) => addPhotoUrl(supabase, pet)));
}

export async function getPet(supabase: SupabaseClient, petId: string): Promise<PetWithPhotoUrl | null> {
  const { data, error } = await supabase.from("pets").select("*").eq("id", petId).is("archived_at", null).maybeSingle();
  if (error) throw error;
  return data ? addPhotoUrl(supabase, data as Pet) : null;
}
