import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    "Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env y rellena los valores de tu proyecto Supabase."
  );
}

// Si faltan las variables de entorno, se usa una URL de relleno con formato
// válido: createClient() lanza una excepción con una URL vacía, y eso
// dejaría toda la app en blanco. Con isSupabaseConfigured en false se
// muestra una pantalla de configuración en vez de intentar usar este cliente.
const fallbackUrl = "https://placeholder.supabase.co";

// flowType "pkce" hace que la vuelta del login con GitHub llegue como
// "?code=..." (query string) en vez de "#access_token=..." (fragmento),
// que es imprescindible porque la app usa HashRouter para las rutas.
export const supabase = createClient(supabaseUrl || fallbackUrl, supabaseAnonKey || "placeholder", {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
});
