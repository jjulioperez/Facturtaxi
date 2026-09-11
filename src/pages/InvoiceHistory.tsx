import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { downloadInvoicePdf, listInvoices } from "../lib/invoices";
import { shareInvoicePdf } from "../lib/share";
import type { InvoiceWithClient } from "../types";
import Spinner from "../components/Spinner";

export default function InvoiceHistory() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    listInvoices()
      .then(setInvoices)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar las facturas"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      const fullNumber = `${inv.series}-${String(inv.number).padStart(4, "0")}`.toLowerCase();
      return fullNumber.includes(q) || inv.clients?.name?.toLowerCase().includes(q);
    });
  }, [invoices, query]);

  async function handleDownload(inv: InvoiceWithClient) {
    if (!inv.pdf_path) {
      setError(`La factura ${inv.series}-${String(inv.number).padStart(4, "0")} no tiene un PDF disponible.`);
      return;
    }
    setDownloadingId(inv.id);
    setError(null);
    try {
      const blob = await downloadInvoicePdf(inv.pdf_path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `factura-${inv.series}-${String(inv.number).padStart(4, "0")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar el PDF");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleShare(inv: InvoiceWithClient) {
    if (!inv.pdf_path) return;
    setSharingId(inv.id);
    setError(null);
    setInfo(null);
    try {
      const blob = await downloadInvoicePdf(inv.pdf_path);
      const result = await shareInvoicePdf(blob, inv, inv.clients);
      if (result.method === "downloaded") {
        setInfo(
          "Tu dispositivo no permite compartir archivos directamente: se ha descargado el PDF, adjúntalo tú mismo a WhatsApp o email."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo compartir la factura");
    } finally {
      setSharingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Historial de facturas</h1>
        <p className="text-sm text-slate-500">Ordenadas de la más reciente a la más antigua.</p>
      </div>

      <input
        className="input"
        placeholder="Buscar por número o cliente..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {info && <p className="text-sm text-slate-500">{info}</p>}

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className="card text-center text-sm text-slate-400">No hay facturas que mostrar.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nº factura</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3 text-right">Importe</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inv) => (
                <tr key={inv.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                    {inv.series}-{String(inv.number).padStart(4, "0")}
                    {inv.signed_with_certificate && (
                      <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                        FIRMADA
                      </span>
                    )}
                    {inv.rectifies_invoice_id && (
                      <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        RECTIFICATIVA
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {formatDate(inv.issue_date)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{inv.clients?.name ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-800">
                    {inv.total_amount.toFixed(2)} €
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        title="Compartir factura (PDF)"
                        className="btn-secondary px-2.5 py-1.5 text-xs"
                        disabled={sharingId === inv.id}
                        onClick={() => handleShare(inv)}
                      >
                        {sharingId === inv.id ? "..." : "📤"}
                      </button>
                      <button
                        className="btn-secondary px-3 py-1.5 text-xs"
                        disabled={downloadingId === inv.id}
                        onClick={() => handleDownload(inv)}
                      >
                        {downloadingId === inv.id ? "..." : "⬇"}
                      </button>
                      {!inv.rectifies_invoice_id && (
                        <button
                          title="Crear factura rectificativa"
                          className="btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => navigate("/nueva-factura", { state: { rectifyInvoiceId: inv.id } })}
                        >
                          Rectificar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
