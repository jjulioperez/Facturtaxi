import { supabase } from "./supabaseClient";
import { isDemoMode } from "./demoMode";
import { updateDemoProfile } from "./demoStore";
import type { Profile } from "../types";

export async function updateProfile(userId: string, patch: Partial<Profile>): Promise<void> {
  if (isDemoMode()) {
    updateDemoProfile(patch);
    return;
  }
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(error.message);
}
