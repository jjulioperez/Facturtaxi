import { supabase } from "./supabaseClient";
import type { Client } from "../types";

export async function listClients(): Promise<Client[]> {
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
  const { data, error } = await supabase
    .from("clients")
    .insert({ user_id: userId, ...input })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Client;
}

export async function updateClient(id: string, input: NewClientInput): Promise<Client> {
  const { data, error } = await supabase.from("clients").update(input).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data as Client;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error("No se puede eliminar: este cliente tiene facturas asociadas.");
    }
    throw new Error(error.message);
  }
}
