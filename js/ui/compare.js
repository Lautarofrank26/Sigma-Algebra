/**
 * compare.js — tabla comparativa Argentina vs. EE.UU.
 * Cada fila define qué serie usar en cada país. Para agregar una fila, sumar un objeto a ROWS.
 */
import { el } from './dom.js';
import { resolve } from '../data/loader.js';
import { fmtNum, fmtDate } from '../lib/format.js';

const ROWS = [
  { label: 'Inflación interanual', ar: { id: 'ipc', t: 'yoy' }, us: { id: 'cpi', t: 'yoy' }, suffix: '%', decimals: 1 },
  { label: 'Inflación mensual', ar: { id: 'ipc', t: 'pct1' }, us: { id: 'cpi', t: 'pct1' }, suffix: '%', decimals: 1 },
  { label: 'Desempleo', ar: { id: 'unemp' }, us: { id: 'unemp' }, suffix: '%', decimals: 1 },
  { label: 'Crecimiento del PBI (último año)', ar: { id: 'gdp' }, us: { id: 'gdp' }, suffix: '%', decimals: 1 },
];

function cell(data, ref, row) {
  const s = resolve(data, ref);
  if (!s) return el('td', {}, '—');
  const [d, v] = s.points[s.points.length - 1];
  return el('td', { class: 'num' }, [`${fmtNum(v, row.decimals)}${row.suffix}`, el('small', {}, fmtDate(d, s.freq))]);
}

export function renderCompare(arData, usData) {
  const body = ROWS.map((r) => el('tr', {}, [el('td', {}, r.label), cell(arData, r.ar, r), cell(usData, r.us, r)]));
  return el('div', { class: 'table-scroll' }, [
    el('table', {}, [
      el('thead', {}, el('tr', {}, [el('th', {}, 'Indicador'), el('th', { class: 'ar' }, 'Argentina'), el('th', { class: 'us' }, 'Estados Unidos')])),
      el('tbody', {}, body),
    ]),
  ]);
}
