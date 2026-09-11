import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import { useCertificate } from "../context/CertificateContext";
import { listClients, createClient } from "../lib/clients";
import {
  buildInvoiceCore,
  computeAmounts,
  createInvoice,
  createRectificationInvoice,
  getInvoiceById,
  getInvoiceShareUrl,
  rectificationSeries,
  reserveInvoiceNumber,
} from "../lib/invoices";
import { generateInvoicePdf } from "../lib/pdf/generateInvoicePdf";
import { signPdfWithCertificate } from "../lib/pdf/signPdf";
import { openEmailShare, openWhatsAppShare } from "../lib/share";
import type { Client, Invoice } from "../types";
import Spinner from "../components/Spinner";

type Step = "form" | "sign" | "done";

export default function NewInvoice() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { certificate: cachedCertificate, setCertificate, clearCertificate } = useCertificate();
  const navigate = useNavigate();
  const location = useLocation();
  const rectifyInvoiceId = (location.state as { rectifyInvoiceId?: string } | null)?.rectifyInvoiceId ?? null;

  const [rectifyOriginal, setRectifyOriginal] = useState<Invoice | null>(null);
  const [rectifyClient, setRectifyClient] = useState<Client | null>(null);
  const [rectifyLoading, setRectifyLoading] = useState(Boolean(rectifyInvoiceId));
  const [rectifyReason, setRectifyReason] = useState("");

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
  const [finalInvoice, setFinalInvoice] = useState<Invoice | null>(null);
  const [finalClient, setFinalClient] = useState<Client | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    listClients()
      .then(setClients)
      .finally(() => setClientsLoading(false));
  }, []);

  useEffect(() => {
    if (profile) setIvaRate(profile.default_iva);
  }, [profile]);

  useEffect(() => {
    if (!rectifyInvoiceId) return;
    getInvoiceById(rectifyInvoiceId)
      .then((inv) => {
        setRectifyOriginal(inv);
        setRectifyClient(inv.clients);
        setServiceDate(inv.service_date);
        setDescription(inv.description);
        setBaseAmount(inv.base_amount);
        setIvaRate(inv.iva_rate);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar la factura original"))
      .finally(() => setRectifyLoading(false));
  }, [rectifyInvoiceId]);

  const { ivaAmount, total } = useMemo(() => computeAmounts(baseAmount || 0, ivaRate || 0), [baseAmount, ivaRate]);

  if (profileLoading || rectifyLoading) return <Spinner label="Cargando..." />;

  async function resolveClient(): Promise<Client> {
    if (rectifyClient) return rectifyClient;
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
    if (rectifyOriginal && !rectifyReason.trim()) {
      setError("Indica el motivo de la rectificación");
      return;
    }

    setBusy(true);
    try {
      const client = await resolveClient();
      setPendingClient(client);

      if (signWithCertificate) {
        if (cachedCertificate) {
          await signAndFinish(client, cachedCertificate.file, cachedCertificate.password);
        } else {
          setStep("sign");
          setBusy(false);
        }
        return;
      }

      await finishInvoice(client);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ha ocurrido un error");
      setBusy(false);
    }
  }

  async function finishInvoice(client: Client, signedPdfBytes?: Uint8Array, preAllocatedNumber?: number) {
    if (!user || !profile) return;
    setBusy(true);
    setError(null);
    try {
      const { invoice, pdfBytes } = rectifyOriginal
        ? await createRectificationInvoice(user.id, profile, {
            originalInvoice: rectifyOriginal,
            client,
            serviceDate,
            description,
            baseAmount,
            ivaRate,
            reason: rectifyReason,
            signedPdfBytes,
            preAllocatedNumber,
          })
        : await createInvoice(user.id, profile, {
            client,
            serviceDate,
            description,
            baseAmount,
            ivaRate,
            signedPdfBytes,
            preAllocatedNumber,
          });
      const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
      setFinalPdfUrl(URL.createObjectURL(blob));
      setInvoiceLabel(`${invoice.series}-${String(invoice.number).padStart(4, "0")}`);
      setFinalInvoice(invoice);
      setFinalClient(client);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la factura");
    } finally {
      setBusy(false);
    }
  }

  async function signAndFinish(client: Client, file: File, password: string) {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      // El número tiene que reservarse y quedar fijado en el PDF ANTES de
      // firmarlo: firmar "bloquea" el contenido, así que no se puede generar
      // con un número provisional y sustituirlo después de conocer el real.
      const series = rectifyOriginal ? rectificationSeries(profile) : profile.invoice_series_prefix;
      const number = await reserveInvoiceNumber(series);
      const draftInvoice = buildInvoiceCore(series, number, baseAmount, ivaRate, serviceDate, description);
      const unsignedPdf = await generateInvoicePdf({
        profile,
        client,
        invoice: draftInvoice,
        rectification: rectifyOriginal
          ? {
              originalFullNumber: `${rectifyOriginal.series}-${String(rectifyOriginal.number).padStart(4, "0")}`,
              reason: rectifyReason,
            }
          : undefined,
      });
      const certBytes = await file.arrayBuffer();
      const signedPdf = await signPdfWithCertificate(unsignedPdf, certBytes, password);
      setCertificate(file, password);
      await finishInvoice(client, signedPdf, number);
    } catch (err) {
      setError(
        err instanceof Error
          ? `No se pudo firmar el PDF (revisa el certificado y la contraseña): ${err.message}`
          : "No se pudo firmar el PDF"
      );
      setBusy(false);
      // La contraseña en caché podría ser inválida (p.ej. la cambiaste); la olvidamos
      // para no reintentar en bucle con datos incorrectos.
      clearCertificate();
    }
  }

  async function handleSignAndFinish() {
    if (!pendingClient || !certFile || !certPassword) {
      setError("Sube el certificado .p12/.pfx y escribe la contraseña");
      return;
    }
    await signAndFinish(pendingClient, certFile, certPassword);
    setCertPassword("");
  }

  async function handleShareFinal(channel: "whatsapp" | "email") {
    if (!finalInvoice || !finalClient || !finalInvoice.pdf_path) return;
    setSharing(true);
    setShareError(null);
    try {
      const shareUrl = await getInvoiceShareUrl(finalInvoice.pdf_path);
      const result =
        channel === "whatsapp"
          ? openWhatsAppShare(finalClient, finalInvoice, shareUrl)
          : openEmailShare(finalClient, finalInvoice, shareUrl);
      if (!result.ok) setShareError(result.reason);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "No se pudo generar el enlace para compartir");
    } finally {
      setSharing(false);
    }
  }

  if (step === "sign" && pendingClient) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-900">Firmar con certificado digital</h1>
        <div className="card space-y-4">
          <p className="text-sm text-slate-600">
            Sube tu certificado digital (<code>.p12</code> o <code>.pfx</code>) y escribe su contraseña. Todo
            ocurre en tu navegador: no se envían a ningún servidor. Se recordarán en memoria durante esta sesión
            para que no tengas que subirlos en cada factura (nunca se guardan en el móvil/disco).
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
                navigate("/nueva-factura", { replace: true, state: null });
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

          {finalClient && (finalClient.phone || finalClient.email) && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs text-slate-500">Enviar al cliente:</p>
              <div className="flex flex-wrap justify-center gap-3">
                {finalClient.phone && (
                  <button className="btn-secondary" disabled={sharing} onClick={() => handleShareFinal("whatsapp")}>
                    📱 WhatsApp
                  </button>
                )}
                {finalClient.email && (
                  <button className="btn-secondary" disabled={sharing} onClick={() => handleShareFinal("email")}>
                    ✉️ Email
                  </button>
                )}
              </div>
              {shareError && <p className="mt-2 text-sm text-red-600">{shareError}</p>}
            </div>
          )}
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
      <h1 className="text-xl font-bold text-slate-900">{rectifyOriginal ? "Factura rectificativa" : "Nueva factura"}</h1>

      {rectifyOriginal && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Vas a rectificar la factura <strong>{rectifyOriginal.series}-{String(rectifyOriginal.number).padStart(4, "0")}</strong>.
          Se creará una factura nueva (serie R) que hace referencia a esta y no afecta a tu numeración normal.
        </div>
      )}

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Cliente</h2>
        {rectifyClient ? (
          <p className="text-sm text-slate-600">
            {rectifyClient.name} <span className="text-slate-400">(mismo cliente que la factura original)</span>
          </p>
        ) : (
          <>
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
          </>
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

      {rectifyOriginal && (
        <div className="card space-y-2">
          <label className="label">Motivo de la rectificación</label>
          <textarea
            className="input"
            rows={2}
            required
            placeholder="Ej: Error en el importe / Datos del cliente incorrectos"
            value={rectifyReason}
            onChange={(e) => setRectifyReason(e.target.value)}
          />
        </div>
      )}

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
        {signWithCertificate && cachedCertificate && (
          <p className="mt-2 pl-8 text-xs text-slate-500">
            ✓ Usando el certificado ya cargado en esta sesión ({cachedCertificate.file.name}).{" "}
            <button type="button" className="text-brand-700 underline" onClick={clearCertificate}>
              Olvidarlo
            </button>
          </p>
        )}
        {!signWithCertificate && (
          <p className="mt-1 pl-8 text-xs text-slate-400">
            Si no la firmas con certificado, se aplicará el sello/firma manual configurados en Plantilla (si los
            has subido).
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
        {busy
          ? "Generando..."
          : signWithCertificate && !cachedCertificate
            ? "Continuar a la firma"
            : rectifyOriginal
              ? "Emitir factura rectificativa"
              : "Generar factura"}
      </button>
    </form>
  );
}
