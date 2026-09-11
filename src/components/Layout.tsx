import { NavLink, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { exitDemoMode, isDemoMode } from "../lib/demoMode";

const navItems = [
  { to: "/", label: "Inicio", icon: "🏠" },
  { to: "/nueva-factura", label: "Nueva factura", icon: "🧾" },
  { to: "/facturas", label: "Historial", icon: "📂" },
  { to: "/clientes", label: "Clientes", icon: "👤" },
  { to: "/plantilla", label: "Plantilla", icon: "🎨" },
];

export default function Layout() {
  const demo = isDemoMode();

  function handleSignOut() {
    if (demo) exitDemoMode();
    else supabase.auth.signOut();
  }

  return (
    <>
      {demo && (
        <div className="bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-white">
          🚀 MODO DEMO — los datos son ficticios y no se guardan.{" "}
          <button onClick={handleSignOut} className="underline">
            Salir del modo demo
          </button>
        </div>
      )}
      <div className="flex min-h-screen flex-col pb-16 md:flex-row md:pb-0">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-5 py-5 text-lg font-bold text-brand-700">
          <span>🚕</span> Facturtaxi
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={handleSignOut}
          className="m-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          ↩ Cerrar sesión
        </button>
      </aside>

      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2 text-base font-bold text-brand-700">
          <span>🚕</span> Facturtaxi
        </div>
        <button onClick={handleSignOut} className="text-sm font-medium text-slate-500">
          Salir
        </button>
      </header>

      <main className="flex-1 px-4 py-5 md:px-8 md:py-8">
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-slate-200 bg-white md:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                isActive ? "text-brand-700" : "text-slate-500"
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      </div>
    </>
  );
}
