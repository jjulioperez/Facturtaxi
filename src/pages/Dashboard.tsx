import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../context/ProfileContext";
import { listInvoices } from "../lib/invoices";
import type { InvoiceWithClient } from "../types";
import Spinner from "../components/Spinner";

export default function Dashboard() {
  const { profile, loading: profileLoading } = useProfile();
  const [recent, setRecent] = useState<InvoiceWithClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listInvoices()
      .then((all) => setRecent(all.slice(0, 5)))
      .finally(() => setLoading(false));
  }, []);

  const profileIncomplete = !profileLoading && profile && (!profile.company_name || !profile.tax_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Hola{profile?.company_name ? `, ${profile.company_name}` : ""} 👋</h1>
        <p className="text-sm text-slate-500">Genera y gestiona tus facturas de taxi.</p>
      </div>

      {profileIncomplete && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Todavía no has completado tus datos fiscales.{" "}
          <Link to="/plantilla" className="font-semibold underline">
            Complétalos en Plantilla
          </Link>{" "}
          antes de emitir tu primera factura.
        </div>
      )}

      <Link to="/nueva-factura" className="btn-primary w-full py-4 text-base">
        🧾 Nueva factura
      </Link>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Últimas facturas</h2>
          <Link to="/facturas" className="text-sm text-brand-700 hover:underline">
            Ver todas
          </Link>
        </div>

        {loading ? (
          <Spinner />
        ) : recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Aún no has emitido ninguna factura.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {inv.series}-{String(inv.number).padStart(4, "0")}
                  </p>
                  <p className="text-xs text-slate-500">{inv.clients?.name}</p>
                </div>
                <p className="text-sm font-semibold text-slate-700">{inv.total_amount.toFixed(2)} €</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
