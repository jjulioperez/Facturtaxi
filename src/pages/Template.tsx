import { useEffect, useState, type ChangeEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import { supabase } from "../lib/supabaseClient";
import { uploadBrandingImage } from "../lib/branding";
import { deleteCertificateFile, uploadCertificateFile } from "../lib/certificate";
import { setInvoiceCounter } from "../lib/invoices";
import { generateInvoicePdf } from "../lib/pdf/generateInvoicePdf";
import type { Profile, TemplateStyle } from "../types";
import Spinner from "../components/Spinner";

const STYLES: { value: TemplateStyle; label: string }[] = [
  { value: "clasico", label: "Clásico" },
  { value: "moderno", label: "Moderno" },
  { value: "simple", label: "Simple" },
];

type FormState = Pick<
  Profile,
  "company_name" | "tax_id" | "address" | "phone" | "email" | "accent_color" | "template_style" | "default_iva" | "invoice_series_prefix"
>;

const emptyForm: FormState = {
  company_name: "",
  tax_id: "",
  address: "",
  phone: "",
  email: "",
  accent_color: "#0d9488",
  template_style: "clasico",
  default_iva: 10,
  invoice_series_prefix: String(new Date().getFullYear()),
};

export default function Template() {
  const { user } = useAuth();
  const { profile, loading, refresh } = useProfile();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [images, setImages] = useState<{ logo_url: string | null; stamp_url: string | null; signature_url: string | null }>({
    logo_url: null,
    stamp_url: null,
    signature_url: null,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [nextNumberInput, setNextNumberInput] = useState<number>(1);
  const [numberSaving, setNumberSaving] = useState(false);
  const [numberMessage, setNumberMessage] = useState<string | null>(null);
  const [certInfo, setCertInfo] = useState<{ path: string; filename: string } | null>(null);
  const [certBusy, setCertBusy] = useState(false);
  const [certMessage, setCertMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        company_name: profile.company_name,
        tax_id: profile.tax_id,
        address: profile.address,
        phone: profile.phone,
        email: profile.email,
        accent_color: profile.accent_color,
        template_style: profile.template_style,
        default_iva: profile.default_iva,
        invoice_series_prefix: profile.invoice_series_prefix,
      });
      setImages({ logo_url: profile.logo_url, stamp_url: profile.stamp_url, signature_url: profile.signature_url });
      setCertInfo(
        profile.certificate_path && profile.certificate_filename
          ? { path: profile.certificate_path, filename: profile.certificate_filename }
          : null
      );
    }
  }, [profile]);

  if (loading) return <Spinner label="Cargando plantilla..." />;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
      if (error) throw error;
      await refresh();
      setMessage("Datos guardados correctamente.");
    } catch (err) {
      setMessage(err instanceof Error ? `Error: ${err.message}` : "No se pudieron guardar los datos.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetNextNumber() {
    if (!profile) return;
    if (!Number.isInteger(nextNumberInput) || nextNumberInput < 1) {
      setNumberMessage("Introduce un número entero de 1 o mayor.");
      return;
    }
    setNumberSaving(true);
    setNumberMessage(null);
    try {
      await setInvoiceCounter(profile.invoice_series_prefix, nextNumberInput);
      setNumberMessage(
        `Hecho: tu próxima factura será ${profile.invoice_series_prefix}-${String(nextNumberInput).padStart(4, "0")}.`
      );
    } catch (err) {
      setNumberMessage(err instanceof Error ? `Error: ${err.message}` : "No se pudo actualizar el número.");
    } finally {
      setNumberSaving(false);
    }
  }

  async function handleCertificateUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setCertBusy(true);
    setCertMessage(null);
    try {
      const path = await uploadCertificateFile(user.id, file);
      const { error } = await supabase
        .from("profiles")
        .update({ certificate_path: path, certificate_filename: file.name })
        .eq("id", user.id);
      if (error) throw error;
      setCertInfo({ path, filename: file.name });
      await refresh();
      setCertMessage("Certificado guardado. Se te pedirá la contraseña cada vez que firmes una factura.");
    } catch (err) {
      setCertMessage(err instanceof Error ? `Error: ${err.message}` : "No se pudo guardar el certificado.");
    } finally {
      setCertBusy(false);
      e.target.value = "";
    }
  }

  async function handleCertificateDelete() {
    if (!user || !certInfo) return;
    setCertBusy(true);
    setCertMessage(null);
    try {
      await deleteCertificateFile(certInfo.path);
      const { error } = await supabase
        .from("profiles")
        .update({ certificate_path: null, certificate_filename: null })
        .eq("id", user.id);
      if (error) throw error;
      setCertInfo(null);
      await refresh();
      setCertMessage("Certificado eliminado de tu cuenta.");
    } catch (err) {
      setCertMessage(err instanceof Error ? `Error: ${err.message}` : "No se pudo eliminar el certificado.");
    } finally {
      setCertBusy(false);
    }
  }

  async function handleUpload(kind: "logo" | "stamp" | "signature", e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(kind);
    setMessage(null);
    try {
      const url = await uploadBrandingImage(user.id, kind, file);
      const column = `${kind}_url` as const;
      const { error } = await supabase.from("profiles").update({ [column]: url }).eq("id", user.id);
      if (error) throw error;
      setImages((prev) => ({ ...prev, [column]: url }));
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? `Error subiendo imagen: ${err.message}` : "No se pudo subir la imagen.");
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  }

  async function handlePreview() {
    setPreviewBusy(true);
    try {
      const previewProfile: Profile = {
        id: user?.id ?? "preview",
        approved: true,
        certificate_path: null,
        certificate_filename: null,
        ...form,
        ...images,
      };
      const bytes = await generateInvoicePdf({
        profile: previewProfile,
        client: {
          id: "preview",
          user_id: previewProfile.id,
          name: "Cliente de ejemplo, S.L.",
          tax_id: "B12345678",
          address: "Calle Ejemplo 123, 28001 Madrid",
          phone: "600 000 000",
          email: "cliente@ejemplo.com",
        },
        invoice: {
          series: form.invoice_series_prefix,
          number: 1,
          issue_date: new Date().toISOString().slice(0, 10),
          service_date: new Date().toISOString().slice(0, 10),
          description: "Trayecto Aeropuerto - Centro ciudad",
          base_amount: 25,
          iva_rate: form.default_iva,
          iva_amount: Math.round(25 * form.default_iva) / 100,
          total_amount: 25 + Math.round(25 * form.default_iva) / 100,
        },
      });
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setMessage(err instanceof Error ? `Error generando la vista previa: ${err.message}` : "No se pudo generar la vista previa.");
    } finally {
      setPreviewBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Plantilla de factura</h1>
        <p className="text-sm text-slate-500">
          Estos datos e imágenes se usan para generar todas tus facturas.
        </p>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Datos fiscales</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Nombre / Razón social</label>
            <input className="input" value={form.company_name} onChange={(e) => update("company_name", e.target.value)} />
          </div>
          <div>
            <label className="label">NIF / CIF</label>
            <input className="input" value={form.tax_id} onChange={(e) => update("tax_id", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Dirección</label>
            <input className="input" value={form.address} onChange={(e) => update("address", e.target.value)} />
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input className="input" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Facturación</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Prefijo de serie</label>
            <input
              className="input"
              value={form.invoice_series_prefix}
              onChange={(e) => update("invoice_series_prefix", e.target.value)}
              placeholder="2026"
            />
            <p className="mt-1 text-xs text-slate-400">Ej: "2026" da facturas 2026-0001, 2026-0002...</p>
          </div>
          <div>
            <label className="label">IVA por defecto (%)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={form.default_iva}
              onChange={(e) => update("default_iva", Number(e.target.value))}
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <label className="label">Próximo número de factura (serie {form.invoice_series_prefix || "—"})</label>
          <p className="mb-2 text-xs text-slate-400">
            Útil para continuar la numeración de facturas que ya emitiste fuera de la app. Guarda antes el prefijo
            de serie si lo has cambiado.
          </p>
          <div className="flex gap-3">
            <input
              className="input"
              type="number"
              min={1}
              step={1}
              value={nextNumberInput}
              onChange={(e) => setNextNumberInput(Number(e.target.value))}
            />
            <button type="button" className="btn-secondary shrink-0" onClick={handleSetNextNumber} disabled={numberSaving}>
              {numberSaving ? "..." : "Actualizar"}
            </button>
          </div>
          {numberMessage && <p className="mt-2 text-sm text-slate-600">{numberMessage}</p>}
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Diseño</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Color de acento</label>
            <input
              type="color"
              className="h-10 w-full rounded-lg ring-1 ring-inset ring-slate-300"
              value={form.accent_color}
              onChange={(e) => update("accent_color", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Estilo de plantilla</label>
            <select
              className="select"
              value={form.template_style}
              onChange={(e) => update("template_style", e.target.value as TemplateStyle)}
            >
              {STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <ImageUploader
            label="Logo"
            currentUrl={images.logo_url}
            busy={uploading === "logo"}
            onChange={(e) => handleUpload("logo", e)}
          />
          <ImageUploader
            label="Sello"
            currentUrl={images.stamp_url}
            busy={uploading === "stamp"}
            onChange={(e) => handleUpload("stamp", e)}
          />
          <ImageUploader
            label="Firma manual"
            currentUrl={images.signature_url}
            busy={uploading === "signature"}
            onChange={(e) => handleUpload("signature", e)}
          />
        </div>
        <p className="text-xs text-slate-400">
          Recomendado: imágenes PNG con fondo transparente para el sello y la firma.
        </p>
      </div>

      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Certificado digital (firma electrónica)</h2>
        <p className="text-xs text-slate-500">
          Guarda aquí tu certificado (.p12/.pfx) para no tener que subirlo cada vez que firmes una factura. Se
          guarda cifrado y privado en tu cuenta — solo tú puedes acceder a él. La contraseña nunca se guarda: te la
          seguirá pidiendo cada vez que firmes (o se recordará solo en memoria durante tu sesión, como hasta ahora).
        </p>

        {certInfo ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3">
            <span className="text-sm text-slate-700">🔒 Certificado guardado: <strong>{certInfo.filename}</strong></span>
            <label className="btn-secondary cursor-pointer text-xs">
              {certBusy ? "..." : "Cambiar"}
              <input type="file" accept=".p12,.pfx" className="hidden" disabled={certBusy} onChange={handleCertificateUpload} />
            </label>
            <button type="button" className="btn-danger text-xs" onClick={handleCertificateDelete} disabled={certBusy}>
              Eliminar
            </button>
          </div>
        ) : (
          <label className="btn-secondary inline-flex w-full cursor-pointer justify-center sm:w-auto">
            {certBusy ? "Subiendo..." : "Subir certificado (.p12 / .pfx)"}
            <input type="file" accept=".p12,.pfx" className="hidden" disabled={certBusy} onChange={handleCertificateUpload} />
          </label>
        )}
        {certMessage && <p className="text-sm text-slate-600">{certMessage}</p>}
      </div>

      {message && <p className="text-sm text-slate-600">{message}</p>}

      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        <button className="btn-secondary" onClick={handlePreview} disabled={previewBusy}>
          {previewBusy ? "Generando..." : "👁 Vista previa del PDF"}
        </button>
      </div>

      {previewUrl && (
        <div className="card p-0 overflow-hidden">
          <iframe title="Vista previa de factura" src={previewUrl} className="h-[600px] w-full" />
        </div>
      )}
    </div>
  );
}

function ImageUploader({
  label,
  currentUrl,
  busy,
  onChange,
}: {
  label: string;
  currentUrl: string | null;
  busy: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
        {currentUrl ? (
          <img src={currentUrl} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-slate-400">Sin imagen</span>
        )}
      </div>
      <label className="btn-secondary mt-2 w-full cursor-pointer text-xs">
        {busy ? "Subiendo..." : "Cambiar imagen"}
        <input type="file" accept="image/png,image/jpeg" className="hidden" disabled={busy} onChange={onChange} />
      </label>
    </div>
  );
}
