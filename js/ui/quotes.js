/**
 * quotes.js — tarjetas con la cotización del día de cada tipo de dólar y su brecha contra el oficial.
 */
import { el } from './dom.js';
import { fmtNum } from '../lib/format.js';
import { QUOTE_ORDER } from '../config/dolar.js';

/** @param {Date|null} liveAt hora de la última consulta en vivo; null = datos del snapshot */
export function renderQuotes(data, liveAt = null) {
  const byCasa = Object.fromEntries((data.quotes ?? []).map((q) => [q.casa, q]));
  const oficial = byCasa.oficial?.venta;

  const cards = QUOTE_ORDER.filter((o) => byCasa[o.casa]).map((o) => {
    const q = byCasa[o.casa];
    const gap = oficial && o.casa !== 'oficial' ? (q.venta / oficial - 1) * 100 : null;
    return el('div', { class: 'kpi quote' }, [
      el('span', { class: 'label' }, o.name),
      el('div', { class: 'kpi-value' }, [`$${fmtNum(q.venta, 0)}`, el('small', {}, 'venta')]),
      el('div', { class: 'kpi-foot' }, [
        el('span', { class: 'num' }, `compra $${fmtNum(q.compra, 0)}`),
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
      ' · DolarAPI. La brecha usa el precio de venta de cada tipo contra el oficial.',
    ]),
  ]);
}
