import type { Client, Invoice } from "../types";

function sanitizePhoneForWhatsapp(phone: string): string | null {
  const digits = phone.replace(/[^\d]/g, "").replace(/^0+/, "");
  if (!digits) return null;
  // Número español típico (9 dígitos, sin prefijo de país): se asume +34.
  if (digits.length === 9) return `34${digits}`;
  return digits;
}

function fullNumber(invoice: Pick<Invoice, "series" | "number">) {
  return `${invoice.series}-${String(invoice.number).padStart(4, "0")}`;
}

function messageText(invoice: Pick<Invoice, "series" | "number" | "total_amount">, shareUrl: string) {
  return (
    `Hola, aquí tienes tu factura nº ${fullNumber(invoice)} por importe de ${invoice.total_amount.toFixed(2)} €.\n\n` +
    `Puedes descargarla aquí: ${shareUrl}`
  );
}

function openViaAnchor(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Abre WhatsApp (web o app, según el dispositivo) con un mensaje ya
 * redactado con el enlace de descarga de la factura. El taxista revisa y
 * pulsa enviar él mismo; esta función no envía nada automáticamente.
 */
export function openWhatsAppShare(
  client: Client,
  invoice: Pick<Invoice, "series" | "number" | "total_amount">,
  shareUrl: string
): { ok: true } | { ok: false; reason: string } {
  const phone = sanitizePhoneForWhatsapp(client.phone || "");
  if (!phone) return { ok: false, reason: "Este cliente no tiene un teléfono guardado." };
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(messageText(invoice, shareUrl))}`;
  openViaAnchor(url);
  return { ok: true };
}

/**
 * Abre el cliente de email por defecto con un borrador ya redactado con el
 * enlace de descarga de la factura. El taxista revisa y pulsa enviar él
 * mismo.
 */
export function openEmailShare(
  client: Client,
  invoice: Pick<Invoice, "series" | "number" | "total_amount">,
  shareUrl: string
): { ok: true } | { ok: false; reason: string } {
  if (!client.email) return { ok: false, reason: "Este cliente no tiene un email guardado." };
  const subject = `Factura ${fullNumber(invoice)}`;
  const url = `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(messageText(invoice, shareUrl))}`;
  openViaAnchor(url);
  return { ok: true };
}
