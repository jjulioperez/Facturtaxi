import { supabase } from "./supabaseClient";
import type { Client, Invoice, InvoiceWithClient, Profile } from "../types";
import { generateInvoicePdf } from "./pdf/generateInvoicePdf";

export function computeAmounts(base: number, ivaRate: number) {
  const ivaAmount = Math.round(base * ivaRate) / 100;
  const total = Math.round((base + ivaAmount) * 100) / 100;
  return { ivaAmount: Math.round(ivaAmount * 100) / 100, total };
}

interface InvoiceCore {
  series: string;
  number: number;
  issue_date: string;
  service_date: string;
  description: string;
  base_amount: number;
  iva_rate: number;
  iva_amount: number;
  total_amount: number;
}

/**
 * Pide el siguiente número correlativo de una serie (vía RPC atómica) y crea
 * la fila de la factura ANTES de generar/subir el PDF: así, si algo falla
 * generando o subiendo el PDF, el número ya queda registrado en una factura
 * real (sin huecos en la numeración) y el PDF se puede reintentar más tarde.
 */
async function insertAndUploadInvoice(
  userId: string,
  series: string,
  extraColumns: Record<string, unknown>,
  baseAmount: number,
  ivaRate: number,
  serviceDate: string,
  description: string,
  client: Client,
  pdfBytesOrGenerator: Uint8Array | ((core: InvoiceCore) => Promise<Uint8Array>)
): Promise<{ invoice: Invoice; pdfBytes: Uint8Array }> {
  const { data: number, error: rpcError } = await supabase.rpc("get_next_invoice_number", {
    p_series: series,
  });
  if (rpcError || number == null) {
    throw new Error(rpcError?.message ?? "No se pudo obtener el número de factura");
  }

  const { ivaAmount, total } = computeAmounts(baseAmount, ivaRate);
  const issueDate = new Date().toISOString().slice(0, 10);

  const invoiceCore: InvoiceCore = {
    series,
    number: number as number,
    issue_date: issueDate,
    service_date: serviceDate,
    description,
    base_amount: baseAmount,
    iva_rate: ivaRate,
    iva_amount: ivaAmount,
    total_amount: total,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("invoices")
    .insert({
      user_id: userId,
      client_id: client.id,
      ...invoiceCore,
      ...extraColumns,
      pdf_path: null,
    })
    .select("*")
    .single();
  if (insertError) throw new Error(`No se pudo guardar la factura (número ${number}): ${insertError.message}`);

  const pdfBytes =
    typeof pdfBytesOrGenerator === "function" ? await pdfBytesOrGenerator(invoiceCore) : pdfBytesOrGenerator;

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

export interface CreateInvoiceInput {
  client: Client;
  serviceDate: string;
  description: string;
  baseAmount: number;
  ivaRate: number;
  signedPdfBytes?: Uint8Array;
}

export async function createInvoice(
  userId: string,
  profile: Profile,
  input: CreateInvoiceInput
): Promise<{ invoice: Invoice; pdfBytes: Uint8Array }> {
  const series = profile.invoice_series_prefix || String(new Date().getFullYear());

  return insertAndUploadInvoice(
    userId,
    series,
    { signed_with_certificate: Boolean(input.signedPdfBytes) },
    input.baseAmount,
    input.ivaRate,
    input.serviceDate,
    input.description,
    input.client,
    input.signedPdfBytes ?? ((core) => generateInvoicePdf({ profile, client: input.client, invoice: core }))
  );
}

export interface CreateRectificationInput {
  originalInvoice: Invoice;
  client: Client;
  serviceDate: string;
  description: string;
  baseAmount: number;
  ivaRate: number;
  reason: string;
  signedPdfBytes?: Uint8Array;
}

/**
 * Crea una factura rectificativa: usa su propia serie ("R" + la serie del
 * perfil) para que quede claramente identificada y no interfiera con la
 * numeración normal, y queda enlazada a la factura original que corrige.
 */
export async function createRectificationInvoice(
  userId: string,
  profile: Profile,
  input: CreateRectificationInput
): Promise<{ invoice: Invoice; pdfBytes: Uint8Array }> {
  const baseSeries = profile.invoice_series_prefix || String(new Date().getFullYear());
  const series = `R${baseSeries}`;
  const originalFullNumber = `${input.originalInvoice.series}-${String(input.originalInvoice.number).padStart(4, "0")}`;

  return insertAndUploadInvoice(
    userId,
    series,
    {
      signed_with_certificate: Boolean(input.signedPdfBytes),
      rectifies_invoice_id: input.originalInvoice.id,
      rectification_reason: input.reason,
    },
    input.baseAmount,
    input.ivaRate,
    input.serviceDate,
    input.description,
    input.client,
    input.signedPdfBytes ??
      ((core) =>
        generateInvoicePdf({
          profile,
          client: input.client,
          invoice: core,
          rectification: { originalFullNumber, reason: input.reason },
        }))
  );
}

export async function listInvoices(): Promise<InvoiceWithClient[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, clients(*)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as InvoiceWithClient[];
}

export async function getInvoiceById(id: string): Promise<InvoiceWithClient> {
  const { data, error } = await supabase.from("invoices").select("*, clients(*)").eq("id", id).single();
  if (error || !data) throw new Error(error?.message ?? "Factura no encontrada");
  return data as InvoiceWithClient;
}

export async function downloadInvoicePdf(pdfPath: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from("invoices").download(pdfPath);
  if (error || !data) throw new Error(error?.message ?? "No se pudo descargar el PDF");
  return data;
}

/**
 * Fija manualmente el próximo número de factura de una serie (por ejemplo,
 * para continuar la numeración de facturas emitidas antes de usar la app).
 * No permite fijarlo por debajo del número más alto ya emitido en esa serie.
 */
export async function setInvoiceCounter(series: string, nextNumber: number): Promise<void> {
  const { error } = await supabase.rpc("set_invoice_counter", { p_series: series, p_last_number: nextNumber - 1 });
  if (error) throw new Error(error.message);
}

/**
 * URL firmada (temporal, sin necesidad de sesión) para compartir el PDF de
 * una factura por WhatsApp o email. Válida 90 días.
 */
export async function getInvoiceShareUrl(pdfPath: string): Promise<string> {
  const { data, error } = await supabase.storage.from("invoices").createSignedUrl(pdfPath, 60 * 60 * 24 * 90);
  if (error || !data) throw new Error(error?.message ?? "No se pudo generar el enlace para compartir");
  return data.signedUrl;
}
