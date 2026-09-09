import { supabase } from "../lib/supabaseClient";

export default function PendingApproval() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card max-w-sm space-y-3 text-center">
        <div className="text-3xl">⏳</div>
        <h1 className="text-lg font-bold text-slate-900">Cuenta pendiente de aprobación</h1>
        <p className="text-sm text-slate-600">
          Tu cuenta se ha creado correctamente, pero el administrador todavía tiene que aprobarla
          antes de que puedas entrar. Vuelve a intentarlo más tarde.
        </p>
        <button onClick={() => supabase.auth.signOut()} className="btn-secondary w-full">
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
