import { useEffect, useMemo, useState } from "react";
import { downloadInvoicePdf, listInvoices } from "../lib/invoices";
import type { InvoiceWithClient } from "../types";
import Spinner from "../components/Spinner";

export default function InvoiceHistory() {
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Historial de facturas</h1>
        <p className="text-sm text-slate-500">Ordenadas por número, de la más reciente a la más antigua.</p>
      </div>

      <input
        className="input"
        placeholder="Buscar por número o cliente..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className="card text-center text-sm text-slate-400">No hay facturas que mostrar.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-sm">
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
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {formatDate(inv.issue_date)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{inv.clients?.name ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-800">
                    {inv.total_amount.toFixed(2)} €
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      className="btn-secondary px-3 py-1.5 text-xs"
                      disabled={downloadingId === inv.id}
                      onClick={() => handleDownload(inv)}
                    >
                      {downloadingId === inv.id ? "..." : "⬇ Descargar"}
                    </button>
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
