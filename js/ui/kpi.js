/**
 * kpi.js — tarjeta de resumen: valor actual, variación y fecha del dato.
 */
import { el } from './dom.js';
import { resolve } from '../data/loader.js';
import { fmtNum, fmtSigned, fmtDate } from '../lib/format.js';

/** Determina el tono (bueno/malo/neutro) del cambio según la polaridad del indicador */
export function toneOf(delta, polarity) {
  if (delta === null || Math.abs(delta) < 1e-9 || polarity === 'none') return 'flat';
  const improving = polarity === 'down' ? delta < 0 : delta > 0;
  return improving ? 'good' : 'bad';
}

/**
 * Cambio contra el período anterior. Para series en % se expresa en puntos
 * porcentuales (pp); para niveles, en variación porcentual.
 */
export function changeInfo(points, isPercent, decimals) {
  if (points.length < 2) return null;
  const last = points[points.length - 1][1];
  const prev = points[points.length - 2][1];
  if (isPercent) {
    const d = last - prev;
    return { raw: d, text: `${fmtSigned(d, decimals === 0 ? 1 : decimals)} pp` };
  }
  const d = (last / prev - 1) * 100;
  return { raw: d, text: `${fmtSigned(d, 1)}%` };
}

export function renderKpi(data, spec) {
  const s = resolve(data, spec.ref);
  if (!s) return el('div', { class: 'kpi' }, [el('span', { class: 'label' }, spec.label), el('span', { class: 'state' }, 'Sin datos')]);

  const last = s.points[s.points.length - 1];
  const isPercent = spec.suffix === '%';
  const change = changeInfo(s.points, isPercent, spec.decimals);

  return el('div', { class: 'kpi' }, [
    el('span', { class: 'label' }, spec.label),
    el('div', { class: 'kpi-value' }, [
      `${spec.prefix ?? ''}${fmtNum(last[1], spec.decimals)}`,
      spec.suffix ? el('small', {}, spec.suffix) : null,
    ]),
    el('div', { class: 'kpi-foot' }, [
      change ? el('span', { class: 'delta', 'data-tone': toneOf(change.raw, spec.polarity) }, change.text) : null,
      el('span', {}, `${fmtDate(last[0], s.freq)}`),
    ]),
  ]);
}
