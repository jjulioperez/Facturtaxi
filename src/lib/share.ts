import type { Client, Invoice } from "../types";

function fullNumber(invoice: Pick<Invoice, "series" | "number">) {
  return `${invoice.series}-${String(invoice.number).padStart(4, "0")}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type ShareResult = { method: "shared" } | { method: "cancelled" } | { method: "downloaded" };

/**
 * Comparte el PDF de la factura como archivo adjunto real, usando el panel
 * nativo de "Compartir" del sistema (el usuario elige ahí WhatsApp, Gmail,
 * Mail...). No se genera ni se manda ningún enlace: el PDF va adjunto tal
 * cual. Si el navegador/dispositivo no soporta compartir archivos (típico en
 * escritorio), se descarga el PDF para que el usuario lo adjunte a mano.
 */
export async function shareInvoicePdf(
  pdfBlob: Blob,
  invoice: Pick<Invoice, "series" | "number" | "total_amount">,
  client?: Pick<Client, "name">
): Promise<ShareResult> {
  const filename = `factura-${fullNumber(invoice)}.pdf`;
  const file = new File([pdfBlob], filename, { type: "application/pdf" });
  const text = `Factura nº ${fullNumber(invoice)} por importe de ${invoice.total_amount.toFixed(2)} €${
    client ? ` para ${client.name}` : ""
  }.`;

  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (canShareFiles) {
    try {
      await navigator.share({ files: [file], title: `Factura ${fullNumber(invoice)}`, text });
      return { method: "shared" };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return { method: "cancelled" };
      // Cualquier otro fallo al compartir cae al mismo fallback de descarga que sigue abajo.
    }
  }

  downloadBlob(file, filename);
  return { method: "downloaded" };
}
