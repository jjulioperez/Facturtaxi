import { supabase } from "./supabaseClient";

export type BrandingKind = "logo" | "stamp" | "signature";

/**
 * Sube una imagen (logo/sello/firma) al bucket privado "branding" y devuelve
 * una URL firmada de larga duración para poder incrustarla en los PDFs.
 * Se sobrescribe siempre el mismo archivo por tipo, así no se acumulan
 * versiones antiguas.
 */
export async function uploadBrandingImage(userId: string, kind: BrandingKind, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${userId}/${kind}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(path, file, { upsert: true, contentType: file.type || "image/png" });
  if (uploadError) throw new Error(`No se pudo subir la imagen: ${uploadError.message}`);

  // 10 años: son imágenes propias del usuario, no hace falta renovarlas a menudo.
  const { data, error: signError } = await supabase.storage
    .from("branding")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (signError || !data) throw new Error(signError?.message ?? "No se pudo generar la URL de la imagen");

  return data.signedUrl;
}
