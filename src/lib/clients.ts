import { supabase } from "./supabaseClient";
import type { Client } from "../types";
import { isDemoMode } from "./demoMode";
import { createDemoClient, deleteDemoClient, listDemoClients, updateDemoClient } from "./demoStore";

export async function listClients(): Promise<Client[]> {
  if (isDemoMode()) return listDemoClients();
  const { data, error } = await supabase.from("clients").select("*").order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Client[];
}

export interface NewClientInput {
  name: string;
  tax_id: string;
  address: string;
  phone: string;
  email: string;
}

export async function createClient(userId: string, input: NewClientInput): Promise<Client> {
  if (isDemoMode()) return createDemoClient(input);
  const { data, error } = await supabase
    .from("clients")
    .insert({ user_id: userId, ...input })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Client;
}

export async function updateClient(id: string, input: NewClientInput): Promise<Client> {
  if (isDemoMode()) return updateDemoClient(id, input);
  const { data, error } = await supabase.from("clients").update(input).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data as Client;
}

export async function deleteClient(id: string): Promise<void> {
  if (isDemoMode()) return deleteDemoClient(id);
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error("No se puede eliminar: este cliente tiene facturas asociadas.");
    }
    throw new Error(error.message);
  }
}
