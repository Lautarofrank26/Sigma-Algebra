/**
 * quotes.js — tarjetas con la cotización del día de cada tipo de dólar:
 * venta, compra, variación del día y de 30 días, y brecha contra el oficial.
 * Las variaciones usan el historial diario de data/dolar.json (campo `daily`).
 */
import { el } from './dom.js';
import { fmtNum, fmtSigned } from '../lib/format.js';
import { QUOTE_ORDER } from '../config/dolar.js';

const AR = 'America/Argentina/Buenos_Aires';
const todayAR = () => new Intl.DateTimeFormat('en-CA', { timeZone: AR }).format(new Date()); // YYYY-MM-DD

/** Último valor del historial con fecha <= `limit` (YYYY-MM-DD) */
function valueOnOrBefore(points, limit) {
  for (let i = points.length - 1; i >= 0; i -= 1) if (points[i][0] <= limit) return points[i][1];
  return null;
}
const shiftDays = (iso, days) => new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

/** Variación % del precio actual contra el cierre anterior y contra hace 30 días */
export function changes(current, daily) {
  if (!daily?.length || !current) return { day: null, d30: null };
  const today = todayAR();
  const prev = valueOnOrBefore(daily, shiftDays(today, -1)); // cierre anterior a hoy
  const old = valueOnOrBefore(daily, shiftDays(today, -30));
  const pct = (base) => (base ? (current / base - 1) * 100 : null);
  return { day: pct(prev), d30: pct(old) };
}

function chip(label, value) {
  if (value === null) return null;
  const rounded = Number(value.toFixed(1));
  const tone = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
  return el('span', { class: 'delta chg', 'data-tone': 'flat', 'data-dir': tone }, `${label} ${fmtSigned(rounded, 1)}%`);
}

/** @param {Date|null} liveAt hora de la última consulta en vivo; null = datos del snapshot */
export function renderQuotes(data, liveAt = null) {
  const byCasa = Object.fromEntries((data.quotes ?? []).map((q) => [q.casa, q]));
  const oficial = byCasa.oficial?.venta;

  const cards = QUOTE_ORDER.filter((o) => byCasa[o.casa]).map((o) => {
    const q = byCasa[o.casa];
    const gap = oficial && o.casa !== 'oficial' ? (q.venta / oficial - 1) * 100 : null;
    const ch = changes(q.venta, data.daily?.[o.id]);
    return el('div', { class: 'kpi quote' }, [
      el('span', { class: 'label' }, o.name),
      el('div', { class: 'kpi-value' }, [`$${fmtNum(q.venta, 2)}`, el('small', {}, 'venta')]),
      el('span', { class: 'num quote-buy' }, `compra $${fmtNum(q.compra, 2)}`),
      el('div', { class: 'kpi-foot' }, [chip('día', ch.day), chip('30d', ch.d30)]),
      el('div', { class: 'kpi-foot' }, [
        gap !== null ? el('span', { class: 'delta' }, `${gap >= 0 ? '+' : '−'}${fmtNum(Math.abs(gap), 1)}% vs oficial`) : el('span', {}, 'referencia'),
      ]),
      el('span', { class: 'quote-note' }, o.note),
    ]);
  });

  return el('div', {}, [
    el('div', { class: 'kpi-strip' }, cards),
    el('p', { class: 'quote-foot' }, [
      liveAt
        ? el('span', { class: 'live' }, `● En vivo · ${liveAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`)
        : `Cotizaciones al ${data.updated.split('-').reverse().join('/')}`,
      ' · DolarAPI. Variación del día contra el cierre anterior; la de 30 días, contra el precio de hace un mes (ArgentinaDatos). La brecha usa el precio de venta contra el oficial.',
    ]),
  ]);
}
