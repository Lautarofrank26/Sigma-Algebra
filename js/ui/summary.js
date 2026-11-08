/**
 * summary.js — tabla resumen: indicadores mensuales con los últimos 6 meses lado a lado.
 * Colores por semántica (mejor/peor), no por signo. Cada país define sus filas en `summary`.
 *
 * Fila: { label, note, ref, decimals, suffix, kind, polarity }
 *   kind: 'change' → el valor es una variación (se muestra con signo y se colorea por signo)
 *         'level'  → el valor es un nivel (se colorea según suba o baje contra el mes previo)
 */
import { el } from './dom.js';
import { resolve } from '../data/loader.js';
import { fmtNum, fmtSigned, fmtDate, fmtAge } from '../lib/format.js';

const COLUMNS = 6;

/** Últimos `n` meses terminando en `lastIso` (YYYY-MM-01) */
function lastMonths(lastIso, n) {
  const [y, m] = lastIso.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1)).toISOString().slice(0, 10));
}

function tone(row, value, prev) {
  if (row.polarity === 'none' || value === undefined) return 'flat';
  // `trend`: valor con signo pero coloreado según suba o baje contra el mes previo (p. ej. inflación)
  if (row.kind === 'change' && !row.trend) {
    if (Math.abs(value) < 1e-9) return 'flat';
    return (row.polarity === 'up') === (value > 0) ? 'good' : 'bad';
  }
  if (prev === undefined || Math.abs(value - prev) < 1e-9) return 'flat';
  return (row.polarity === 'up') === (value > prev) ? 'good' : 'bad';
}

export function renderSummary(data, rows) {
  const series = rows.map((r) => ({ row: r, s: resolve(data, r.ref) })).filter((x) => x.s);
  if (!series.length) return null;

  const latest = series.map((x) => x.s.points[x.s.points.length - 1][0]).sort().pop();
  const months = lastMonths(latest, COLUMNS);

  const head = el('tr', {}, [
    el('th', {}, 'Indicador'),
    ...months.map((m) => el('th', {}, fmtDate(m, 'M', 'short'))),
    el('th', {}, 'Último dato'),
  ]);

  const body = series.map(({ row, s }) => {
    const map = new Map(s.points);
    const cells = months.map((m, i) => {
      const v = map.get(m);
      if (v === undefined) return el('td', { class: 'num t-none' }, '·');
      const prev = i > 0 ? map.get(months[i - 1]) : undefined;
      const text = row.kind === 'change' ? `${fmtSigned(v, row.decimals)}${row.suffix ?? '%'}` : `${fmtNum(v, row.decimals)}${row.suffix ?? ''}`;
      return el('td', { class: `num t-${tone(row, v, prev)}` }, text);
    });
    const [lastDate] = s.points[s.points.length - 1];
    return el('tr', {}, [
      el('td', {}, [row.label, el('small', {}, row.note)]),
      ...cells,
      el('td', {}, [fmtDate(lastDate, s.freq), el('small', {}, fmtAge(lastDate, s.freq))]),
    ]);
  });

  return el('div', { class: 'table-scroll summary' }, el('table', {}, [el('thead', {}, head), el('tbody', {}, body)]));
}

