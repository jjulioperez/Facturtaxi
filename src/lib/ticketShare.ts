import { Capacitor, registerPlugin } from "@capacitor/core";
import { parseTicketText, type ParsedTicket } from "./ticketParser";

interface TicketSharePlugin {
  getPendingSharedText(): Promise<{ text: string | null }>;
}

const TicketShare = registerPlugin<TicketSharePlugin>("TicketShare");

/**
 * Si la app Android se abrió porque el taxista compartió un ticket desde
 * otra app (p.ej. su taxímetro) con el menú "Compartir" del sistema,
 * devuelve los datos ya extraídos de ese texto. Solo existe en la app
 * Android nativa: en la web (o si algo falla) devuelve null sin más.
 */
export async function getPendingSharedTicket(): Promise<ParsedTicket | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { text } = await TicketShare.getPendingSharedText();
    if (!text) return null;
    return parseTicketText(text);
  } catch {
    return null;
  }
}
