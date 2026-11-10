/**
 * live.js — datos en vivo, directo desde el navegador.
 *
 * 1) fetchLiveQuotes: cotizaciones del día del dólar (DolarAPI).
 * 2) refreshData: trae los últimos puntos de las series que usa la página (ver live-sources.js),
 *    los combina con el historial guardado en data/*.json y recalcula las series derivadas.
 *
 * Si una fuente falla (sin conexión, límite de consultas, sitio que bloquea pedidos externos),
 * se ignora y la página sigue con el historial guardado.
 */
import { LIVE_AR, LIVE_US, DERIVED } from './live-sources.js';

const URL_QUOTES = 'https://dolarapi.com/v1/dolares';
export const REFRESH_MS = 60_000;       // cotizaciones del dólar
export const DATA_REFRESH_MS = 300_000; // series macro (cada 5 minutos)
const TIMEOUT_MS = 10_000;
const BLS_TTL_MS = 6 * 3600_000;        // BLS limita las consultas por IP: se reutiliza lo ya pedido

/* ---------- utilidades ---------- */

async function request(url, as = 'json') {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return as === 'text' ? await res.text() : await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** `notBefore`: una copia guardada antes de ese instante se descarta aunque no haya vencido (p. ej. salió un dato nuevo) */
function readCache(key, ttl, notBefore = 0) {
  try {
    const c = JSON.parse(localStorage.getItem(`macroeconomics:${key}`));
    if (c && Date.now() - c.t < ttl && c.t > notBefore) return c.pts;
  } catch { /* storage bloqueado o dato inválido */ }
  return null;
}

const RELEASE_GRACE_MS = 10 * 60_000; // BLS tarda unos minutos en reflejar una publicación en su API
let releasesPromise = null;

/**
 * Instante de la última publicación del BLS ya ocurrida (según data/calendario.json), más un margen.
 * Sirve para no reutilizar copias guardadas antes de esa publicación.
 */
function lastBlsRelease() {
  releasesPromise ??= request('data/calendario.json')
    .then((cal) => {
      const now = Date.now();
      const times = (cal.eventos ?? [])
        .filter((e) => /^BLS/.test(e.source ?? ''))
        .map((e) => Date.parse(`${e.date}T${e.time}:00${e.tz}`))
        .filter((t) => Number.isFinite(t) && t + RELEASE_GRACE_MS <= now);
      return times.length ? Math.max(...times) + RELEASE_GRACE_MS : 0;
    })
    .catch(() => 0);
  return releasesPromise;
}
function writeCache(key, pts) {
  try { localStorage.setItem(`macroeconomics:${key}`, JSON.stringify({ t: Date.now(), pts })); } catch { /* sin storage */ }
}

const ym = (d) => d.toISOString().slice(0, 7);
const monthStart = (d) => `${ym(d)}-01`;
/** Fecha del primer día de hace `n` meses */
const monthsAgo = (n) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - n); return d; };

/** Promedio mensual de pares [fechaISO, valor] */
function monthlyAvg(rows) {
  const groups = new Map();
  for (const [date, v] of rows) {
    const k = `${date.slice(0, 7)}-01`;
    (groups.get(k) ?? groups.set(k, []).get(k)).push(v);
  }
  return [...groups].map(([k, vs]) => [k, vs.reduce((a, b) => a + b, 0) / vs.length]).sort((a, b) => a[0].localeCompare(b[0]));
}

/* ---------- cotizaciones del día ---------- */

export async function fetchLiveQuotes() {
  try {
    const rows = await request(URL_QUOTES);
    if (!Array.isArray(rows) || !rows.length) return null;
    return rows.map((q) => ({ casa: q.casa, nombre: q.nombre, compra: q.compra, venta: q.venta, fecha: q.fechaActualizacion }));
  } catch {
    return null;
  }
}

/* ---------- fuentes de series ---------- */

async function fetchDatosGob(spec) {
  const collapse = spec.collapse ? `&collapse=${spec.collapse}&collapse_aggregation=${spec.agg}` : '';
  const r = await request(`https://apis.datos.gob.ar/series/api/series/?ids=${spec.ref}&limit=30&sort=desc&format=json${collapse}`);
  return r.data.filter((row) => row[1] !== null).map(([d, v]) => [d, v * (spec.scale ?? 1)]).reverse();
}

async function fetchBls(spec) {
  const cached = readCache(`bls:${spec.ref}`, BLS_TTL_MS, await lastBlsRelease());
  if (cached) return cached;
  const r = await request(`https://api.bls.gov/publicAPI/v1/timeseries/data/${spec.ref}`);
  if (r.status !== 'REQUEST_SUCCEEDED') throw new Error('BLS no respondió');
  const pts = r.Results.series[0].data
    .filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period) && Number.isFinite(parseFloat(d.value)))
    .map((d) => [`${d.year}-${d.period.slice(1)}-01`, parseFloat(d.value)])
    .sort((a, b) => a[0].localeCompare(b[0]));
  writeCache(`bls:${spec.ref}`, pts);
  return pts;
}

/** Curva del Tesoro: mes actual y anterior (una consulta por mes sirve para todas las columnas) */
async function fetchTreasuryMonths() {
  const months = [monthsAgo(1), monthsAgo(0)].map((d) => ym(d).replace('-', ''));
  const rows = [];
  for (const m of months) {
    const xml = await request(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=${m}`, 'text');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    for (const props of doc.getElementsByTagNameNS('*', 'properties')) {
      const row = {};
      for (const el of props.children) row[el.localName] = el.textContent;
      if (row.NEW_DATE) rows.push(row);
    }
  }
  return rows;
}
function treasurySeries(rows, field) {
  const pts = rows.filter((r) => r[field] && Number.isFinite(parseFloat(r[field]))).map((r) => [r.NEW_DATE.slice(0, 10), parseFloat(r[field])]);
  return monthlyAvg(pts);
}

async function fetchNyFed(spec) {
  const r = await request(`https://markets.newyorkfed.org/api/rates/${spec.path}/search.json?startDate=${monthStart(monthsAgo(1))}&endDate=${new Date().toISOString().slice(0, 10)}`);
  return monthlyAvg((r.refRates ?? []).filter((x) => x.percentRate !== undefined).map((x) => [x.effectiveDate, Number(x.percentRate)]));
}

async function fetchDebt() {
  const r = await request('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?fields=record_date,tot_pub_debt_out_amt&sort=-record_date&page%5Bsize%5D=70');
  const lastByMonth = new Map();
  for (const row of r.data) { // vienen del más nuevo al más viejo: el primero de cada mes es el cierre
    const k = `${row.record_date.slice(0, 7)}-01`;
    if (!lastByMonth.has(k)) lastByMonth.set(k, Number(row.tot_pub_debt_out_amt) / 1e9);
  }
  return [...lastByMonth].sort((a, b) => a[0].localeCompare(b[0]));
}

/* ---------- combinar con el historial ---------- */

function mergePoints(base, fresh) {
  const map = new Map(base);
  for (const [d, v] of fresh) map.set(d, v);
  return [...map].sort((a, b) => a[0].localeCompare(b[0]));
}

function ensure(data, id, freq) {
  return (data.byId[id] ??= { id, label: id, freq, points: [] });
}

function computeDerived(data, d) {
  const out = [];
  if (d.type === 'real') {
    const defl = new Map(data.byId[d.deflator]?.points ?? []);
    for (const [date, v] of data.byId[d.nominal]?.points ?? []) {
      const p = defl.get(date);
      if (p > 0) out.push([date, (v / p) * 100]);
    }
  } else if (d.type === 'diff') {
    const b = new Map(data.byId[d.b]?.points ?? []);
    for (const [date, v] of data.byId[d.a]?.points ?? []) if (b.has(date)) out.push([date, v - b.get(date)]);
  }
  ensure(data, d.id, 'M').points = out;
}

const signature = (data, ids) =>
  ids.map((id) => (data.byId[id]?.points ?? []).slice(-3).map((p) => p.join(':')).join(',')).join('|');

/**
 * Actualiza `data` con los últimos datos de las series pedidas.
 * @param {'ar'|'us'} group  catálogo a usar
 * @param {string[]} wanted  ids de series que usa la página
 * @returns {Promise<{changed:boolean, ok:number, total:number}>}
 */
export async function refreshData(data, group, wanted) {
  const catalog = group === 'ar' ? LIVE_AR : LIVE_US;
  const derived = DERIVED[group] ?? [];
  const need = new Set(wanted);
  for (const d of derived) {
    if (!need.has(d.id)) continue;
    (d.type === 'real' ? [d.nominal, d.deflator] : [d.a, d.b]).forEach((x) => need.add(x));
  }
  const specs = catalog.filter((s) => need.has(s.id));
  if (!specs.length) return { changed: false, ok: 0, total: 0 };

  const watch = [...need, ...derived.map((d) => d.id)];
  const before = signature(data, watch);

  // La curva del Tesoro se pide una sola vez para todos los plazos
  let treasury = null;
  if (specs.some((s) => s.kind === 'treasury')) treasury = fetchTreasuryMonths().catch(() => null);

  let ok = 0;
  await Promise.all(specs.map(async (spec) => {
    try {
      let pts;
      if (spec.kind === 'datosgob') pts = await fetchDatosGob(spec);
      else if (spec.kind === 'bls') pts = await fetchBls(spec);
      else if (spec.kind === 'nyfed') pts = await fetchNyFed(spec);
      else if (spec.kind === 'debt') pts = await fetchDebt();
      else if (spec.kind === 'treasury') {
        const rows = await treasury;
        if (!rows) throw new Error('Tesoro no respondió');
        pts = treasurySeries(rows, spec.field);
      }
      if (!pts?.length) return;
      const ind = ensure(data, spec.id, spec.freq);
      ind.points = mergePoints(ind.points, pts);
      ok += 1;
    } catch {
      /* se conserva el historial guardado */
    }
  }));

  derived.filter((d) => need.has(d.id)).forEach((d) => computeDerived(data, d));
  return { changed: signature(data, watch) !== before, ok, total: specs.length };
}

/** Ids de series que usa una configuración de página (paneles, tarjetas, tabla y lectura macro) */
export function usedIds(config) {
  const ids = new Set();
  const take = (ref) => ref?.id && ids.add(ref.id);
  config.kpis?.forEach((k) => take(k.ref));
  config.summary?.forEach((r) => take(r.ref));
  config.panels?.forEach((p) => { take(p.headline?.ref); p.datasets.forEach((d) => take(d.ref)); });
  // La lectura macro pide series con g({ id: '...' }): se detectan en el código de analyze()
  for (const m of String(config.analyze).matchAll(/id:\s*'([a-z0-9_]+)'/g)) ids.add(m[1]);
  return [...ids];
}


/**
 * Valores más recientes para la barra superior: rendimientos del Tesoro (10 y 2 años) y tasa efectiva de la Fed.
 * Cada valor trae el cambio contra el dato anterior en puntos básicos (pb). Si una fuente falla, se omite.
 */
export async function fetchTickerRates() {
  const out = {};
  try {
    const rows = (await fetchTreasuryMonths()).sort((a, b) => a.NEW_DATE.localeCompare(b.NEW_DATE));
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    for (const [key, field] of [['y10', 'BC_10YEAR'], ['y2', 'BC_2YEAR']]) {
      if (!last?.[field]) continue;
      out[key] = { value: parseFloat(last[field]), chg: prev?.[field] ? (parseFloat(last[field]) - parseFloat(prev[field])) * 100 : null };
    }
  } catch { /* sin curva del Tesoro */ }
  try {
    const r = await request('https://markets.newyorkfed.org/api/rates/unsecured/effr/last/2.json');
    const [a, b] = r.refRates ?? [];
    if (a) out.effr = { value: Number(a.percentRate), chg: b ? (Number(a.percentRate) - Number(b.percentRate)) * 100 : null };
  } catch { /* sin tasa de la Fed */ }
  return out;
}
