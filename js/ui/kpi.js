/**
 * kpi.js — tarjeta de resumen: valor actual, variación y fecha del dato.
 */
import { el } from './dom.js';
import { resolve } from '../data/loader.js';
import { fmtNum, fmtSigned, fmtDate, fmtAge } from '../lib/format.js';
import { renderSpark } from './spark.js';

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
    const dec = decimals === 0 ? 1 : decimals;
    const d = Number((last - prev).toFixed(dec)); // redondeado como se muestra: +0,0 cuenta como sin cambio
    return { raw: d, text: `${fmtSigned(d, dec)} pp` };
  }
  if (prev === 0) return null;
  // Con base negativa se usa el valor absoluto, así el signo siempre indica la dirección del cambio
  const d = Number((((last - prev) / Math.abs(prev)) * 100).toFixed(1));
  return { raw: d, text: `${fmtSigned(d, 1)}%` };
}

export function renderKpi(data, spec) {
  const s = resolve(data, spec.ref);
  if (!s) return el('div', { class: 'kpi' }, [el('span', { class: 'label' }, spec.label), el('span', { class: 'state' }, 'Sin datos')]);

  const last = s.points[s.points.length - 1];
  const isPercent = spec.suffix === '%';
  const change = changeInfo(s.points, isPercent, spec.decimals);

  const tone = change ? toneOf(change.raw, spec.polarity) : 'flat';
  const verdict = { good: 'Mejor', bad: 'Peor' }[tone]; // solo si el indicador tiene polaridad

  return el('div', { class: 'kpi' }, [
    el('span', { class: 'label' }, spec.label),
    el('div', { class: 'kpi-value', 'data-count': last[1], 'data-dec': spec.decimals, 'data-prefix': spec.prefix ?? '' }, [
      `${spec.prefix ?? ''}${fmtNum(last[1], spec.decimals)}`,
      spec.suffix ? el('small', {}, spec.suffix) : null,
    ]),
    renderSpark(s.points),
    el('div', { class: 'kpi-foot' }, [
      change ? el('span', { class: 'delta', 'data-tone': tone }, verdict ? `${verdict} · ${change.text}` : change.text) : null,
      el('span', {}, `${fmtDate(last[0], s.freq)} · ${fmtAge(last[0], s.freq)}`),
    ]),
  ]);
}

