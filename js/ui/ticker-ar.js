/**
 * ticker-ar.js — barra con los dólares de Argentina (versión anterior de la barra del Inicio).
 * Hoy no se muestra en ninguna página: se conserva la lógica y las fuentes para reutilizarlas en la sección Argentina.
 * Indicadores que se mueven todos los días:
 * dólares (con variación del día), brecha CCL y tasas de EE.UU.
 * Usa data/dolar.json como base y se actualiza en vivo; si una fuente falla, omite ese dato.
 */
import { el } from './dom.js';
import { fmtNum, fmtSigned } from '../lib/format.js';
import { fetchLiveQuotes, fetchTickerRates, REFRESH_MS } from '../data/live.js';
import { changes } from './quotes.js';
import { QUOTE_ORDER } from '../config/dolar.js';

/** Dólares que se muestran en la barra */
const DOLLARS = ['oficial', 'blue', 'bolsa', 'contadoconliqui', 'cripto'];

function item(label, value, chg, unit = '') {
  const dir = chg === null || chg === undefined ? 'flat' : Number(chg.toFixed(unit === 'pb' ? 0 : 1)) > 0 ? 'up' : Number(chg.toFixed(unit === 'pb' ? 0 : 1)) < 0 ? 'down' : 'flat';
  const arrow = { up: '▲', down: '▼', flat: '■' }[dir];
  const text = chg === null || chg === undefined ? null : unit === 'pb' ? `${fmtSigned(chg, 0)} pb` : `${fmtSigned(chg, 1)}%`;
  return el('span', { class: 'tk-item' }, [
    el('span', { class: 'tk-label' }, label),
    el('span', { class: 'num tk-value' }, value),
    text ? el('span', { class: 'num tk-chg', 'data-dir': dir }, `${arrow} ${text}`) : null,
  ]);
}

function buildItems(data, quotes, rates) {
  const by = Object.fromEntries(quotes.map((q) => [q.casa, q]));
  const items = [];
  for (const casa of DOLLARS) {
    const q = by[casa];
    const meta = QUOTE_ORDER.find((o) => o.casa === casa);
    if (!q || !meta) continue;
    items.push(item(`Dólar ${meta.name.toLowerCase().replace('contado con liqui', 'CCL').replace('mep', 'MEP')}`, `$${fmtNum(q.venta, 2)}`, changes(q.venta, data.daily?.[meta.id]).day));
  }
  if (by.contadoconliqui && by.oficial) items.push(item('Brecha CCL', `${fmtNum((by.contadoconliqui.venta / by.oficial.venta - 1) * 100, 1)}%`));
  if (rates.y10) items.push(item('Bono EE.UU. 10 años', `${fmtNum(rates.y10.value, 2)}%`, rates.y10.chg, 'pb'));
  if (rates.y2) items.push(item('Bono EE.UU. 2 años', `${fmtNum(rates.y2.value, 2)}%`, rates.y2.chg, 'pb'));
  if (rates.effr) items.push(item('Tasa Fed (efectiva)', `${fmtNum(rates.effr.value, 2)}%`, rates.effr.chg, 'pb'));
  return items;
}

/** @param {HTMLElement} box contenedor de la barra */
export async function startArTicker(box) {
  let data;
  try {
    data = await (await fetch('data/dolar.json', { cache: 'no-cache' })).json();
  } catch {
    return; // sin base de datos: no se muestra la barra
  }
  let quotes = data.quotes ?? [];
  let rates = {};

  const render = () => {
    const items = buildItems(data, quotes, rates);
    if (!items.length) return;
    // El contenido se duplica para que el desplazamiento sea continuo
    box.replaceChildren(el('div', { class: 'tk-track' }, [...items, ...items.map((i) => i.cloneNode(true))]));
    box.hidden = false;
  };

  render();
  const refresh = async () => {
    if (document.hidden) return;
    const live = await fetchLiveQuotes();
    if (live) quotes = live;
    render();
  };
  fetchTickerRates().then((r) => { rates = r; render(); });
  refresh();
  setInterval(refresh, REFRESH_MS);
}
