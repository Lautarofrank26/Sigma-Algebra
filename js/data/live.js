/**
 * live.js — cotizaciones del dólar en vivo, directo desde el navegador (DolarAPI).
 * Si la consulta falla (sin conexión, sitio que bloquea pedidos externos, API caída),
 * devuelve null y la página sigue mostrando el snapshot de data/dolar.json.
 */
const URL_QUOTES = 'https://dolarapi.com/v1/dolares';
export const REFRESH_MS = 60_000;

export async function fetchLiveQuotes() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(URL_QUOTES, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    return rows.map((q) => ({ casa: q.casa, nombre: q.nombre, compra: q.compra, venta: q.venta, fecha: q.fechaActualizacion }));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
