export default function ConfigMissing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card max-w-md space-y-3">
        <div className="text-3xl">⚙️</div>
        <h1 className="text-lg font-bold text-slate-900">Falta configurar Supabase</h1>
        <p className="text-sm text-slate-600">
          No se han encontrado <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>. Copia{" "}
          <code>.env.example</code> a <code>.env</code>, rellena los datos de tu proyecto Supabase y reinicia la
          app. Consulta el <code>README.md</code> para los pasos completos.
        </p>
      </div>
    </div>
  );
}
