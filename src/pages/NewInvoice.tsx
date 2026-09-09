import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import { listClients, createClient } from "../lib/clients";
import { computeAmounts, createInvoice } from "../lib/invoices";
import { generateInvoicePdf } from "../lib/pdf/generateInvoicePdf";
import { signPdfWithCertificate } from "../lib/pdf/signPdf";
import type { Client } from "../types";
import Spinner from "../components/Spinner";

type Step = "form" | "sign" | "done";

export default function NewInvoice() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const [newClient, setNewClient] = useState({ name: "", tax_id: "", address: "", phone: "", email: "" });

  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [baseAmount, setBaseAmount] = useState<number>(0);
  const [ivaRate, setIvaRate] = useState<number>(10);

  const [signWithCertificate, setSignWithCertificate] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");

  const [step, setStep] = useState<Step>("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingClient, setPendingClient] = useState<Client | null>(null);
  const [finalPdfUrl, setFinalPdfUrl] = useState<string | null>(null);
  const [invoiceLabel, setInvoiceLabel] = useState<string>("");

  useEffect(() => {
    listClients()
      .then(setClients)
      .finally(() => setClientsLoading(false));
  }, []);

  useEffect(() => {
    if (profile) setIvaRate(profile.default_iva);
  }, [profile]);

  const { ivaAmount, total } = useMemo(() => computeAmounts(baseAmount || 0, ivaRate || 0), [baseAmount, ivaRate]);

  if (profileLoading) return <Spinner label="Cargando..." />;

  async function resolveClient(): Promise<Client> {
    if (clientMode === "existing") {
      const found = clients.find((c) => c.id === selectedClientId);
      if (!found) throw new Error("Selecciona un cliente");
      return found;
    }
    if (!newClient.name.trim()) throw new Error("El nombre del cliente es obligatorio");
    if (!user) throw new Error("Sesión no válida");
    return createClient(user.id, newClient);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!user || !profile) return;
    if (baseAmount <= 0) {
      setError("El importe base debe ser mayor que 0");
      return;
    }

    setBusy(true);
    try {
      const client = await resolveClient();
      setPendingClient(client);

      if (signWithCertificate) {
        setStep("sign");
        setBusy(false);
        return;
      }

      await finishInvoice(client);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ha ocurrido un error");
      setBusy(false);
    }
  }

  async function finishInvoice(client: Client, signedPdfBytes?: Uint8Array) {
    if (!user || !profile) return;
    setBusy(true);
    setError(null);
    try {
      const { invoice, pdfBytes } = await createInvoice(user.id, profile, {
        client,
        serviceDate,
        description,
        baseAmount,
        ivaRate,
        signedPdfBytes,
      });
      const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
      setFinalPdfUrl(URL.createObjectURL(blob));
      setInvoiceLabel(`${invoice.series}-${String(invoice.number).padStart(4, "0")}`);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la factura");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignAndFinish() {
    if (!pendingClient || !profile || !certFile || !certPassword) {
      setError("Sube el certificado .p12/.pfx y escribe la contraseña");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const draftInvoice = {
        series: profile.invoice_series_prefix,
        number: 0,
        issue_date: new Date().toISOString().slice(0, 10),
        service_date: serviceDate,
        description,
        base_amount: baseAmount,
        iva_rate: ivaRate,
        iva_amount: ivaAmount,
        total_amount: total,
      };
      const unsignedPdf = await generateInvoicePdf({ profile, client: pendingClient, invoice: draftInvoice });
      const certBytes = await certFile.arrayBuffer();
      const signedPdf = await signPdfWithCertificate(unsignedPdf, certBytes, certPassword);
      setCertPassword("");
      await finishInvoice(pendingClient, signedPdf);
    } catch (err) {
      setError(
        err instanceof Error
          ? `No se pudo firmar el PDF (revisa el certificado y la contraseña): ${err.message}`
          : "No se pudo firmar el PDF"
      );
      setBusy(false);
    }
  }

  if (step === "sign" && pendingClient) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-900">Firmar con certificado digital</h1>
        <div className="card space-y-4">
          <p className="text-sm text-slate-600">
            Sube tu certificado digital (<code>.p12</code> o <code>.pfx</code>) y escribe su contraseña. Todo
            ocurre en tu navegador: ni el certificado ni la contraseña se envían ni se guardan en ningún sitio,
            solo se usan una vez para firmar esta factura.
          </p>
          <div>
            <label className="label">Certificado (.p12 / .pfx)</label>
            <input
              type="file"
              accept=".p12,.pfx"
              className="input"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCertFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label className="label">Contraseña del certificado</label>
            <input
              type="password"
              className="input"
              value={certPassword}
              onChange={(e) => setCertPassword(e.target.value)}
              autoComplete="off"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => setStep("form")} disabled={busy}>
              Volver
            </button>
            <button className="btn-primary" onClick={handleSignAndFinish} disabled={busy}>
              {busy ? "Firmando..." : "Firmar y emitir factura"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="space-y-6">
        <div className="card text-center">
          <div className="mb-2 text-4xl">✅</div>
          <h1 className="text-lg font-bold text-slate-900">Factura {invoiceLabel} emitida</h1>
          <p className="mt-1 text-sm text-slate-500">Ya puedes descargarla o crear una nueva.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {finalPdfUrl && (
              <a href={finalPdfUrl} download={`factura-${invoiceLabel}.pdf`} className="btn-primary">
                ⬇ Descargar PDF
              </a>
            )}
            <button className="btn-secondary" onClick={() => navigate("/facturas")}>
              Ver historial
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setStep("form");
                setPendingClient(null);
                setFinalPdfUrl(null);
                setDescription("");
                setBaseAmount(0);
                setSignWithCertificate(false);
                setCertFile(null);
              }}
            >
              Nueva factura
            </button>
          </div>
        </div>
        {finalPdfUrl && (
          <div className="card overflow-hidden p-0">
            <iframe title="Factura generada" src={finalPdfUrl} className="h-[600px] w-full" />
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Nueva factura</h1>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Cliente</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className={clientMode === "existing" ? "btn-primary flex-1" : "btn-secondary flex-1"}
            onClick={() => setClientMode("existing")}
          >
            Cliente existente
          </button>
          <button
            type="button"
            className={clientMode === "new" ? "btn-primary flex-1" : "btn-secondary flex-1"}
            onClick={() => setClientMode("new")}
          >
            Cliente nuevo
          </button>
        </div>

        {clientMode === "existing" ? (
          clientsLoading ? (
            <Spinner />
          ) : clients.length === 0 ? (
            <p className="text-sm text-slate-400">No tienes clientes todavía. Crea uno nuevo.</p>
          ) : (
            <select className="select" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
              <option value="">Selecciona un cliente...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Nombre / Razón social</label>
              <input
                className="input"
                required
                value={newClient.name}
                onChange={(e) => setNewClient((c) => ({ ...c, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">NIF / CIF</label>
              <input
                className="input"
                value={newClient.tax_id}
                onChange={(e) => setNewClient((c) => ({ ...c, tax_id: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input
                className="input"
                value={newClient.phone}
                onChange={(e) => setNewClient((c) => ({ ...c, phone: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Dirección</label>
              <input
                className="input"
                value={newClient.address}
                onChange={(e) => setNewClient((c) => ({ ...c, address: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={newClient.email}
                onChange={(e) => setNewClient((c) => ({ ...c, email: e.target.value }))}
              />
            </div>
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Servicio</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Fecha del servicio</label>
            <input
              type="date"
              className="input"
              required
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Descripción / trayecto</label>
            <input
              className="input"
              placeholder="Ej: Trayecto Aeropuerto - Centro ciudad"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Importe base (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              required
              value={baseAmount || ""}
              onChange={(e) => setBaseAmount(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">IVA (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={ivaRate}
              onChange={(e) => setIvaRate(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-slate-500">Base imponible</span>
            <span>{(baseAmount || 0).toFixed(2)} €</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-500">IVA ({ivaRate || 0}%)</span>
            <span>{ivaAmount.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 py-1 pt-2 font-semibold">
            <span>Total</span>
            <span>{total.toFixed(2)} €</span>
          </div>
        </div>
      </div>

      <div className="card">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={signWithCertificate}
            onChange={(e) => setSignWithCertificate(e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
          />
          <span className="text-sm text-slate-700">Firmar esta factura con certificado digital (.p12/.pfx)</span>
        </label>
        {!signWithCertificate && (
          <p className="mt-1 pl-8 text-xs text-slate-400">
            Si no la firmas con certificado, se aplicará el sello/firma manual configurados en Plantilla (si los
            has subido).
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
        {busy ? "Generando..." : signWithCertificate ? "Continuar a la firma" : "Generar factura"}
      </button>
    </form>
  );
}
