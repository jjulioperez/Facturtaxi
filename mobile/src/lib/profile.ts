import { supabase } from "./supabaseClient";
import type { Profile } from "../types";

export async function updateProfile(userId: string, patch: Partial<Profile>): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(error.message);
}
