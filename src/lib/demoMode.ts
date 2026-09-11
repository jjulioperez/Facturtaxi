import { resetDemoState } from "./demoStore";

const FLAG_KEY = "facturtaxi_demo_mode";

/**
 * true cuando la app está en "modo demo": todos los datos (perfil, clientes,
 * facturas, certificado) viven solo en memoria del navegador para esta
 * sesión, sin tocar la cuenta ni la base de datos reales. Se comprueba con
 * sessionStorage, así que sobrevive a recargas de página pero no a cerrar la
 * pestaña.
 */
export function isDemoMode(): boolean {
  try {
    return sessionStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

/** Entra en modo demo y recarga la app para que arranque con datos ficticios. */
export function enterDemoMode(): void {
  try {
    sessionStorage.setItem(FLAG_KEY, "1");
  } catch {
    // Sin sessionStorage (navegación privada estricta) simplemente no persiste al recargar.
  }
  window.location.hash = "#/";
  window.location.reload();
}

/** Sale del modo demo, descarta los datos ficticios y vuelve al login. */
export function exitDemoMode(): void {
  try {
    sessionStorage.removeItem(FLAG_KEY);
  } catch {
    // no-op
  }
  resetDemoState();
  window.location.hash = "#/login";
  window.location.reload();
}
