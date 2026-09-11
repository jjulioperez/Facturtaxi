export interface ParsedTicket {
  service_origin?: string;
  service_destination?: string;
  service_time?: string;
  tariff_number?: string;
  supplements?: string;
  base_amount?: number;
  iva_rate?: number;
}

function toNumber(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function cleanBlock(s: string): string {
  return s
    .split("\n")
    .map((l) => l.trim().replace(/,\s*$/, ""))
    .filter(Boolean)
    .join(", ");
}

/**
 * Extrae los datos de un servicio (origen, destino, hora, tarifa,
 * suplementos, importe) a partir del texto de un ticket/recibo de taxímetro
 * compartido desde otra app (p.ej. PideTaxi). El formato exacto puede variar
 * entre apps de taxímetro; esto está ajustado al formato de recibo de Radio
 * Taxi Cádiz (etiquetas "ORIGEN:", "DESTINO:", "HORA INICIO:", "TARIFAS TR:",
 * líneas de suplemento que empiezan por "*", "IVA INCL. X%", "TOTAL(I/IVA)").
 * Todo lo que no se reconozca simplemente se deja sin rellenar: el taxista
 * siempre revisa y puede corregir los campos antes de emitir la factura.
 */
export function parseTicketText(raw: string): ParsedTicket {
  const text = raw.replace(/\r\n?/g, "\n");
  const result: ParsedTicket = {};

  const horaMatch = text.match(/HORA\s*INICIO\s*:?\s*([0-2]?\d[:.,][0-5]\d)/i);
  if (horaMatch) result.service_time = horaMatch[1].replace(/[.,]/, ":");

  const tarifaMatch = text.match(/TARIFAS?(?:\s*TR)?\s*:?\s*(\S+)/i);
  if (tarifaMatch) result.tariff_number = `Tarifa ${tarifaMatch[1]}`;

  const supplementMatches = [...text.matchAll(/(?:^|\n)[ \t]*\*[ \t]+([\d.,]+)[ \t]*EUR/gim)];
  if (supplementMatches.length) {
    result.supplements = supplementMatches.map((m) => `${m[1]}€`).join(" + ");
  }

  const ivaMatch = text.match(/IVA\s*(?:INCL\.?)?\s*(\d+(?:[.,]\d+)?)\s*%/i);
  const ivaRate = ivaMatch ? toNumber(ivaMatch[1]) : null;
  if (ivaRate != null) result.iva_rate = ivaRate;

  const totalMatch =
    text.match(/TOTAL\s*\(I\/IVA\)\s*:?\s*([\d.,]+)\s*EUR/i) || text.match(/TOTAL[^\d\n]{0,20}([\d.,]+)\s*EUR/i);
  const total = totalMatch ? toNumber(totalMatch[1]) : null;
  if (total != null) {
    const rate = ivaRate ?? 0;
    result.base_amount = Math.round((total / (1 + rate / 100)) * 100) / 100;
  }

  const origenMatch = text.match(/-?\s*ORIGEN\s*:?\s*\n?([\s\S]*?)(?=\n\s*-?\s*DESTINO\s*:)/i);
  if (origenMatch) result.service_origin = cleanBlock(origenMatch[1]);

  const destinoMatch = text.match(/-?\s*DESTINO\s*:?\s*\n?([\s\S]*?)(?=\n\s*-{2,}|\n\s*CLIENTE|\n\s*NIF\s*:|$)/i);
  if (destinoMatch) result.service_destination = cleanBlock(destinoMatch[1]);

  return result;
}
