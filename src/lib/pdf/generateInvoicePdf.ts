import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { Client, Invoice, Profile } from "../../types";

export interface InvoiceData {
  profile: Profile;
  client: Client;
  invoice: Pick<
    Invoice,
    "series" | "number" | "issue_date" | "service_date" | "description" | "base_amount" | "iva_rate" | "iva_amount" | "total_amount"
  >;
  /** Presente cuando esta factura es una rectificativa de otra anterior. */
  rectification?: { originalFullNumber: string; reason: string };
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean, 16);
  return rgb(((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255);
}

function formatCurrency(n: number) {
  return `${n.toFixed(2)} €`;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

async function fetchAsBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

async function embedImageSmart(doc: PDFDocument, url: string | null | undefined) {
  if (!url) return null;
  const bytes = await fetchAsBytes(url);
  if (!bytes) return null;
  try {
    if (/\.png(\?|$)/i.test(url)) return await doc.embedPng(bytes);
    return await doc.embedJpg(bytes);
  } catch {
    try {
      return await doc.embedPng(bytes);
    } catch {
      return null;
    }
  }
}

/**
 * Genera el PDF de una factura a partir de la plantilla configurada por el
 * usuario (logo, datos fiscales, color de acento, sello y firma manual).
 * Devuelve los bytes del PDF (sin firmar con certificado todavía).
 */
export async function generateInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const { profile, client, invoice, rectification } = data;
  const accent = hexToRgb(profile.accent_color || "#0d9488");
  const style = profile.template_style || "clasico";
  const isModerno = style === "moderno";
  const isSimple = style === "simple";
  const extraHeaderLines = rectification ? (rectification.reason ? 2 : 1) : 0;

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const pageWidth = page.getWidth();
  let cursorY = page.getHeight() - margin;

  if (isModerno) {
    // Debe cubrir el logo y las líneas de cabecera (título, número, fecha, y
    // las líneas extra de rectificativa si las hay); si no, el texto claro
    // queda ilegible sobre el fondo blanco.
    const bannerHeight = 120 + extraHeaderLines * 16;
    page.drawRectangle({ x: 0, y: page.getHeight() - bannerHeight, width: pageWidth, height: bannerHeight, color: accent });
  }

  const logo = await embedImageSmart(doc, profile.logo_url);
  if (logo) {
    const maxW = 130;
    const maxH = 60;
    const scale = Math.min(maxW / logo.width, maxH / logo.height, 1);
    page.drawImage(logo, {
      x: margin,
      y: cursorY - logo.height * scale,
      width: logo.width * scale,
      height: logo.height * scale,
    });
  }

  // Cabecera: título FACTURA + número, alineado a la derecha.
  const title = rectification ? "FACTURA RECTIFICATIVA" : "FACTURA";
  const titleSize = rectification ? 15 : 22;
  const titleColor = isModerno ? rgb(1, 1, 1) : isSimple ? rgb(0.15, 0.15, 0.15) : accent;
  const titleWidth = fontBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: pageWidth - margin - titleWidth,
    y: cursorY - 20,
    size: titleSize,
    font: fontBold,
    color: titleColor,
  });

  const fullNumber = `${invoice.series}-${String(invoice.number).padStart(4, "0")}`;
  const numberLine = `Nº ${fullNumber}`;
  const numberWidth = fontRegular.widthOfTextAtSize(numberLine, 11);
  const subtitleColor = isModerno ? rgb(0.95, 0.95, 0.95) : rgb(0.25, 0.25, 0.25);
  page.drawText(numberLine, {
    x: pageWidth - margin - numberWidth,
    y: cursorY - 38,
    size: 11,
    font: fontRegular,
    color: subtitleColor,
  });

  const dateLine = `Fecha de emisión: ${formatDate(invoice.issue_date)}`;
  const dateWidth = fontRegular.widthOfTextAtSize(dateLine, 11);
  page.drawText(dateLine, {
    x: pageWidth - margin - dateWidth,
    y: cursorY - 54,
    size: 11,
    font: fontRegular,
    color: subtitleColor,
  });

  if (rectification) {
    const rectifyLine = `Rectifica a la factura Nº ${rectification.originalFullNumber}`;
    const rectifyWidth = fontRegular.widthOfTextAtSize(rectifyLine, 10);
    page.drawText(rectifyLine, {
      x: pageWidth - margin - rectifyWidth,
      y: cursorY - 70,
      size: 10,
      font: fontRegular,
      color: subtitleColor,
    });
    if (rectification.reason) {
      const reasonLine = `Motivo: ${truncate(rectification.reason, 50)}`;
      const reasonWidth = fontRegular.widthOfTextAtSize(reasonLine, 10);
      page.drawText(reasonLine, {
        x: pageWidth - margin - reasonWidth,
        y: cursorY - 86,
        size: 10,
        font: fontRegular,
        color: subtitleColor,
      });
    }
  }

  cursorY -= (logo ? 100 : 70) + extraHeaderLines * 16;

  if (!isSimple && !isModerno) {
    page.drawLine({
      start: { x: margin, y: cursorY },
      end: { x: pageWidth - margin, y: cursorY },
      thickness: 1.5,
      color: accent,
    });
  } else if (isModerno) {
    cursorY -= 10;
  }
  cursorY -= 24;

  // Bloque emisor / cliente en dos columnas, ambos parten de la misma altura.
  const colWidth = (pageWidth - margin * 2 - 24) / 2;
  const blockTop = cursorY;

  const emisorBottom = drawPartyBlock(page, fontRegular, fontBold, {
    x: margin,
    y: blockTop,
    width: colWidth,
    title: "DATOS DEL EMISOR",
    lines: [
      profile.company_name || "(sin nombre configurado)",
      profile.tax_id ? `NIF/CIF: ${profile.tax_id}` : "",
      profile.address,
      profile.phone ? `Tel: ${profile.phone}` : "",
      profile.email,
    ],
    accent,
  }).y;

  const clientBottom = drawPartyBlock(page, fontRegular, fontBold, {
    x: margin + colWidth + 24,
    y: blockTop,
    width: colWidth,
    title: "DATOS DEL CLIENTE",
    lines: [client.name, client.tax_id ? `NIF/CIF: ${client.tax_id}` : "", client.address, client.phone, client.email],
    accent,
  }).y;

  cursorY = Math.min(emisorBottom, clientBottom) - 30;

  // Tabla de la línea de servicio.
  const tableTop = cursorY;
  const rowHeight = 26;
  page.drawRectangle({
    x: margin,
    y: tableTop - rowHeight,
    width: pageWidth - margin * 2,
    height: rowHeight,
    color: accent,
  });

  const headers = ["Concepto", "Fecha servicio", "Importe"];
  const colX = [margin + 10, margin + 300, pageWidth - margin - 110];
  headers.forEach((h, i) => {
    page.drawText(h, {
      x: colX[i],
      y: tableTop - rowHeight + 8,
      size: 10.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
  });

  const bodyTop = tableTop - rowHeight;
  const description = invoice.description || "Servicio de transporte (taxi)";
  page.drawText(truncate(description, 42), {
    x: colX[0],
    y: bodyTop - 20,
    size: 10.5,
    font: fontRegular,
    color: rgb(0.15, 0.15, 0.15),
  });
  page.drawText(formatDate(invoice.service_date), {
    x: colX[1],
    y: bodyTop - 20,
    size: 10.5,
    font: fontRegular,
    color: rgb(0.15, 0.15, 0.15),
  });
  page.drawText(formatCurrency(invoice.base_amount), {
    x: colX[2],
    y: bodyTop - 20,
    size: 10.5,
    font: fontRegular,
    color: rgb(0.15, 0.15, 0.15),
  });

  page.drawLine({
    start: { x: margin, y: bodyTop - 32 },
    end: { x: pageWidth - margin, y: bodyTop - 32 },
    thickness: 0.75,
    color: rgb(0.85, 0.85, 0.85),
  });

  // Totales, alineados a la derecha.
  let totalsY = bodyTop - 56;
  totalsY = drawTotalRow(page, fontRegular, pageWidth, margin, totalsY, "Base imponible", formatCurrency(invoice.base_amount));
  totalsY = drawTotalRow(
    page,
    fontRegular,
    pageWidth,
    margin,
    totalsY,
    `IVA (${invoice.iva_rate}%)`,
    formatCurrency(invoice.iva_amount)
  );
  page.drawLine({
    start: { x: pageWidth - margin - 220, y: totalsY + 6 },
    end: { x: pageWidth - margin, y: totalsY + 6 },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  totalsY -= 6;
  totalsY = drawTotalRow(
    page,
    fontBold,
    pageWidth,
    margin,
    totalsY,
    "TOTAL",
    formatCurrency(invoice.total_amount),
    13,
    accent
  );

  // Sello y firma manual, en la parte inferior de la página.
  const footerY = 150;
  const stamp = await embedImageSmart(doc, profile.stamp_url);
  if (stamp) {
    const maxW = 110;
    const maxH = 90;
    const scale = Math.min(maxW / stamp.width, maxH / stamp.height, 1);
    page.drawImage(stamp, {
      x: margin,
      y: footerY,
      width: stamp.width * scale,
      height: stamp.height * scale,
    });
  }

  const signature = await embedImageSmart(doc, profile.signature_url);
  if (signature) {
    const maxW = 150;
    const maxH = 70;
    const scale = Math.min(maxW / signature.width, maxH / signature.height, 1);
    const x = pageWidth - margin - signature.width * scale;
    page.drawImage(signature, {
      x,
      y: footerY + 10,
      width: signature.width * scale,
      height: signature.height * scale,
    });
    page.drawLine({
      start: { x, y: footerY + 8 },
      end: { x: pageWidth - margin, y: footerY + 8 },
      thickness: 0.75,
      color: rgb(0.7, 0.7, 0.7),
    });
    page.drawText("Firma", {
      x,
      y: footerY - 6,
      size: 9,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  page.drawText("Generado con Facturtaxi", {
    x: margin,
    y: 30,
    size: 8,
    font: fontRegular,
    color: rgb(0.7, 0.7, 0.7),
  });

  return doc.save();
}

function truncate(s: string, max: number) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function drawTotalRow(
  page: PDFPage,
  font: PDFFont,
  pageWidth: number,
  margin: number,
  y: number,
  label: string,
  value: string,
  size = 11,
  color = rgb(0.15, 0.15, 0.15)
) {
  const labelX = pageWidth - margin - 220;
  const valueWidth = font.widthOfTextAtSize(value, size);
  page.drawText(label, { x: labelX, y, size, font, color });
  page.drawText(value, { x: pageWidth - margin - valueWidth, y, size, font, color });
  return y - (size + 10);
}

function drawPartyBlock(
  page: PDFPage,
  fontRegular: PDFFont,
  fontBold: PDFFont,
  opts: { x: number; y: number; width: number; title: string; lines: string[]; accent: ReturnType<typeof rgb> }
) {
  let y = opts.y;
  page.drawText(opts.title, { x: opts.x, y, size: 10, font: fontBold, color: opts.accent });
  y -= 16;
  for (const line of opts.lines) {
    if (!line) continue;
    page.drawText(truncate(line, 48), { x: opts.x, y, size: 10.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
    y -= 15;
  }
  return { y };
}
