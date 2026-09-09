import { supabase } from "./supabaseClient";
import type { Client, Invoice, InvoiceWithClient, Profile } from "../types";
import { generateInvoicePdf } from "./pdf/generateInvoicePdf";

export function computeAmounts(base: number, ivaRate: number) {
  const ivaAmount = Math.round(base * ivaRate) / 100;
  const total = Math.round((base + ivaAmount) * 100) / 100;
  return { ivaAmount: Math.round(ivaAmount * 100) / 100, total };
}

export interface CreateInvoiceInput {
  client: Client;
  serviceDate: string;
  description: string;
  baseAmount: number;
  ivaRate: number;
  signedPdfBytes?: Uint8Array;
}

/**
 * Pide el siguiente número correlativo (vía RPC atómica) y crea la fila de la
 * factura ANTES de generar/subir el PDF: así, si algo falla generando o
 * subiendo el PDF, el número ya queda registrado en una factura real (sin
 * huecos en la numeración) y el PDF se puede reintentar más tarde. Si se
 * pasa `signedPdfBytes` (factura ya firmada con certificado), se sube ese
 * PDF en lugar de generarlo desde cero.
 */
export async function createInvoice(
  userId: string,
  profile: Profile,
  input: CreateInvoiceInput
): Promise<{ invoice: Invoice; pdfBytes: Uint8Array }> {
  const series = profile.invoice_series_prefix || String(new Date().getFullYear());

  const { data: number, error: rpcError } = await supabase.rpc("get_next_invoice_number", {
    p_series: series,
  });
  if (rpcError || number == null) {
    throw new Error(rpcError?.message ?? "No se pudo obtener el número de factura");
  }

  const { ivaAmount, total } = computeAmounts(input.baseAmount, input.ivaRate);
  const issueDate = new Date().toISOString().slice(0, 10);

  const invoiceCore = {
    series,
    number: number as number,
    issue_date: issueDate,
    service_date: input.serviceDate,
    description: input.description,
    base_amount: input.baseAmount,
    iva_rate: input.ivaRate,
    iva_amount: ivaAmount,
    total_amount: total,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("invoices")
    .insert({
      user_id: userId,
      client_id: input.client.id,
      ...invoiceCore,
      pdf_path: null,
      signed_with_certificate: Boolean(input.signedPdfBytes),
    })
    .select("*")
    .single();
  if (insertError) throw new Error(`No se pudo guardar la factura (número ${number}): ${insertError.message}`);

  const pdfBytes =
    input.signedPdfBytes ?? (await generateInvoicePdf({ profile, client: input.client, invoice: invoiceCore }));

  const fullNumber = `${series}-${String(number).padStart(4, "0")}`;
  const pdfPath = `${userId}/factura-${fullNumber}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    throw new Error(
      `La factura ${fullNumber} se guardó pero no se pudo subir el PDF: ${uploadError.message}. Puedes reintentarlo desde el historial.`
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("invoices")
    .update({ pdf_path: pdfPath })
    .eq("id", inserted.id)
    .select("*")
    .single();
  if (updateError) throw new Error(`No se pudo enlazar el PDF con la factura: ${updateError.message}`);

  return { invoice: updated as Invoice, pdfBytes };
}

export async function listInvoices(): Promise<InvoiceWithClient[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, clients(*)")
    .order("series", { ascending: false })
    .order("number", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as InvoiceWithClient[];
}

export async function downloadInvoicePdf(pdfPath: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from("invoices").download(pdfPath);
  if (error || !data) throw new Error(error?.message ?? "No se pudo descargar el PDF");
  return data;
}
