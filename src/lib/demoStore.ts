import type { Client, Invoice, InvoiceWithClient, Profile } from "../types";
import type { InvoiceCore } from "./invoices";
import type { NewClientInput } from "./clients";

export const DEMO_USER_ID = "demo-user";

function seedProfile(): Profile {
  return {
    id: DEMO_USER_ID,
    company_name: "Antonio García Ruiz",
    tax_id: "12345678A",
    address: "Calle San Fernando 12, 11100 San Fernando, Cádiz",
    phone: "600 111 222",
    email: "demo@facturtaxi.app",
    logo_url: null,
    stamp_url: null,
    signature_url: null,
    accent_color: "#0d9488",
    template_style: "clasico",
    default_iva: 10,
    invoice_series_prefix: String(new Date().getFullYear()),
    approved: true,
    certificate_path: null,
    certificate_filename: null,
  };
}

function seedClients(): Client[] {
  return [
    {
      id: "demo-client-1",
      user_id: DEMO_USER_ID,
      name: "Hotel Playa Victoria",
      tax_id: "B11223344",
      address: "Paseo Marítimo 5, Cádiz",
      phone: "600 333 444",
      email: "reservas@hotelplaya.example",
    },
    {
      id: "demo-client-2",
      user_id: DEMO_USER_ID,
      name: "María López",
      tax_id: "44556677B",
      address: "Calle Ancha 20, Cádiz",
      phone: "600 555 666",
      email: "maria.lopez@example.com",
    },
  ];
}

interface CertificateEntry {
  path: string;
  filename: string;
  bytes: ArrayBuffer;
}

interface DemoState {
  profile: Profile;
  clients: Client[];
  invoices: InvoiceWithClient[];
  counters: Record<string, number>;
  pdfBytes: Map<string, Uint8Array>;
  certificate: CertificateEntry | null;
}

function createInitialState(): DemoState {
  return {
    profile: seedProfile(),
    clients: seedClients(),
    invoices: [],
    counters: {},
    pdfBytes: new Map(),
    certificate: null,
  };
}

let state = createInitialState();

/** Reinicia todos los datos de demostración (se llama al salir del modo demo). */
export function resetDemoState(): void {
  state = createInitialState();
}

export function getDemoProfile(): Profile {
  return state.profile;
}

export function updateDemoProfile(patch: Partial<Profile>): Profile {
  state.profile = { ...state.profile, ...patch };
  return state.profile;
}

export function listDemoClients(): Client[] {
  return [...state.clients].sort((a, b) => a.name.localeCompare(b.name));
}

export function createDemoClient(input: NewClientInput): Client {
  const client: Client = {
    id: `demo-client-${Date.now()}`,
    user_id: DEMO_USER_ID,
    ...input,
  };
  state.clients.push(client);
  return client;
}

export function updateDemoClient(id: string, input: NewClientInput): Client {
  const idx = state.clients.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Cliente no encontrado");
  state.clients[idx] = { ...state.clients[idx], ...input };
  return state.clients[idx];
}

export function deleteDemoClient(id: string): void {
  if (state.invoices.some((inv) => inv.client_id === id)) {
    throw new Error("No se puede eliminar: este cliente tiene facturas asociadas.");
  }
  state.clients = state.clients.filter((c) => c.id !== id);
}

export function listDemoInvoices(): InvoiceWithClient[] {
  return [...state.invoices].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
}

export function getDemoInvoiceById(id: string): InvoiceWithClient {
  const found = state.invoices.find((inv) => inv.id === id);
  if (!found) throw new Error("Factura no encontrada");
  return found;
}

export function reserveDemoNumber(series: string): number {
  state.counters[series] = (state.counters[series] ?? 0) + 1;
  return state.counters[series];
}

export function setDemoCounter(series: string, lastNumber: number): void {
  const highest = state.invoices
    .filter((inv) => inv.series === series)
    .reduce((max, inv) => Math.max(max, inv.number), 0);
  if (lastNumber < highest) {
    throw new Error(`No puedes fijarlo por debajo del número más alto ya emitido en esa serie (${highest}).`);
  }
  state.counters[series] = lastNumber;
}

export function insertDemoInvoice(
  core: InvoiceCore,
  extra: Pick<Invoice, "signed_with_certificate"> & Partial<Pick<Invoice, "rectifies_invoice_id" | "rectification_reason">>,
  client: Client,
  pdfBytes: Uint8Array
): InvoiceWithClient {
  const id = `demo-invoice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const pdf_path = `demo/${id}.pdf`;
  const invoice: InvoiceWithClient = {
    id,
    user_id: DEMO_USER_ID,
    client_id: client.id,
    ...core,
    pdf_path,
    signed_with_certificate: extra.signed_with_certificate,
    rectifies_invoice_id: extra.rectifies_invoice_id ?? null,
    rectification_reason: extra.rectification_reason ?? null,
    created_at: new Date().toISOString(),
    clients: client,
  };
  state.invoices.push(invoice);
  state.pdfBytes.set(pdf_path, pdfBytes);
  return invoice;
}

export function getDemoPdfBytes(pdfPath: string): Uint8Array {
  const bytes = state.pdfBytes.get(pdfPath);
  if (!bytes) throw new Error("No se encontró el PDF (modo demo)");
  return bytes;
}

export function saveDemoCertificate(filename: string, bytes: ArrayBuffer): string {
  const path = `demo/certificate-${filename}`;
  state.certificate = { path, filename, bytes };
  return path;
}

export function getDemoCertificateBytes(path: string): ArrayBuffer {
  if (!state.certificate || state.certificate.path !== path) {
    throw new Error("No se encontró el certificado guardado (modo demo)");
  }
  return state.certificate.bytes;
}

export function deleteDemoCertificate(): void {
  state.certificate = null;
}
