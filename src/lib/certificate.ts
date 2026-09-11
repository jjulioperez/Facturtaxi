import { supabase } from "./supabaseClient";

/**
 * Sube el certificado digital (.p12/.pfx) al bucket privado "certificates",
 * en una ruta fija por usuario (se sobrescribe si ya había uno). Solo el
 * propio usuario puede leerlo (RLS). La contraseña del certificado NUNCA se
 * sube ni se guarda aquí ni en ningún otro sitio.
 */
export async function uploadCertificateFile(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "p12";
  const path = `${userId}/certificate.${ext}`;
  const { error } = await supabase.storage
    .from("certificates")
    .upload(path, file, { upsert: true, contentType: "application/x-pkcs12" });
  if (error) throw new Error(`No se pudo subir el certificado: ${error.message}`);
  return path;
}

export async function downloadCertificateFile(path: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from("certificates").download(path);
  if (error || !data) throw new Error(error?.message ?? "No se pudo descargar el certificado guardado");
  return await data.arrayBuffer();
}

export async function deleteCertificateFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from("certificates").remove([path]);
  if (error) throw new Error(error.message);
}
