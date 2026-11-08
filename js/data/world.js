/**
 * world.js — datos del día para la portada del mundo.
 * Todo se pide desde el navegador y, si una fuente falla, ese dato simplemente no se muestra.
 *   Monedas: Frankfurter (tipos de cambio de referencia del BCE, un dato por día hábil)
 *   Riesgo país y dólares: ArgentinaDatos / DolarAPI
 *   Bitcoin: CoinGecko
 *   Bonos y tasa de la Fed: Tesoro de EE.UU. y NY Fed (ver live.js)
 */
import { fetchLiveQuotes, fetchTickerRates } from './live.js';
import { changes } from '../ui/quotes.js';

const CURRENCIES = ['EUR', 'GBP', 'JPY', 'BRL', 'CNY', 'MXN'];
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

async function getJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Monedas por dólar: último valor y variación contra el día hábil anterior */
export async function fetchCurrencies() {
  const r = await getJson(`https://api.frankfurter.dev/v1/${daysAgo(10)}..?base=USD&symbols=${CURRENCIES.join(',')}`);
  const dates = Object.keys(r.rates).sort();
  const last = r.rates[dates[dates.length - 1]];
  const prev = r.rates[dates[dates.length - 2]] ?? {};
  const out = { date: dates[dates.length - 1] };
  for (const cur of CURRENCIES) {
    if (last[cur] === undefined) continue;
    // EUR y GBP se cotizan al revés (dólares por euro), el resto en unidades por dólar
    const invert = cur === 'EUR' || cur === 'GBP';
    const v = invert ? 1 / last[cur] : last[cur];
    const p = prev[cur] ? (invert ? 1 / prev[cur] : prev[cur]) : null;
    out[cur] = { value: v, chg: p ? (v / p - 1) * 100 : null };
  }
  return out;
}

/** Riesgo país (puntos básicos): último valor y cambio contra el día anterior del historial guardado */
export async function fetchRiesgo(daily) {
  const r = await getJson('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimo');
  const prev = [...(daily ?? [])].reverse().find(([d]) => d < r.fecha);
  return { value: r.valor, chg: prev ? r.valor - prev[1] : null, date: r.fecha };
}

export async function fetchBitcoin() {
  const r = await getJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
  return { value: r.bitcoin.usd, chg: r.bitcoin.usd_24h_change };
}

/**
 * Reúne todos los datos de la portada. Cada fuente es independiente: las que fallan se omiten.
 * @param {object} base contenido de data/dolar.json (cotizaciones guardadas y variaciones)
 */
export async function loadWorld(base) {
  const [quotes, rates, fx, riesgo, btc] = await Promise.allSettled([
    fetchLiveQuotes(),
    fetchTickerRates(),
    fetchCurrencies(),
    fetchRiesgo(base.daily?.riesgo),
    fetchBitcoin(),
  ]);
  const q = Object.fromEntries(((quotes.value ?? base.quotes) ?? []).map((x) => [x.casa, x]));
  const dollars = {};
  for (const [casa, id] of [['oficial', 'oficial'], ['blue', 'blue'], ['bolsa', 'mep'], ['contadoconliqui', 'ccl']]) {
    if (q[casa]) dollars[id] = { value: q[casa].venta, chg: changes(q[casa].venta, base.daily?.[id]).day };
  }
  const gap = q.contadoconliqui && q.oficial ? (q.contadoconliqui.venta / q.oficial.venta - 1) * 100 : null;
  return {
    live: Boolean(quotes.value),
    dollars,
    gap,
    rates: rates.value ?? {},
    fx: fx.value ?? {},
    riesgo: riesgo.value ?? null,
    btc: btc.value ?? null,
  };
}
