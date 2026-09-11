export type TemplateStyle = "clasico" | "moderno" | "simple";

export interface Profile {
  id: string;
  company_name: string;
  tax_id: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string | null;
  stamp_url: string | null;
  signature_url: string | null;
  accent_color: string;
  template_style: TemplateStyle;
  default_iva: number;
  invoice_series_prefix: string;
  approved: boolean;
  certificate_path: string | null;
  certificate_filename: string | null;
  created_at?: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  tax_id: string;
  address: string;
  phone: string;
  email: string;
  created_at?: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string;
  series: string;
  number: number;
  issue_date: string;
  service_date: string;
  description: string;
  service_origin: string | null;
  service_destination: string | null;
  service_time: string | null;
  tariff_number: string | null;
  supplements: string | null;
  base_amount: number;
  iva_rate: number;
  iva_amount: number;
  total_amount: number;
  pdf_path: string | null;
  signed_with_certificate: boolean;
  rectifies_invoice_id: string | null;
  rectification_reason: string | null;
  created_at?: string;
  clients?: Client;
}

export interface InvoiceWithClient extends Invoice {
  clients: Client;
}
