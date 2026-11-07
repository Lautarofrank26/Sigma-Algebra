/**
 * main.js — punto de entrada. Carga datos, arma las secciones y conecta el selector de período.
 * Flujo: config (qué mostrar) → loader (datos) → ui (cómo mostrarlo).
 */
import { argentina } from './config/argentina.js';
import { usa } from './config/usa.js';
import { dolar } from './config/dolar.js';
import { renderQuotes } from './ui/quotes.js';
import { fetchLiveQuotes, REFRESH_MS } from './data/live.js';
import { loadCountry } from './data/loader.js';
import { el } from './ui/dom.js';
import { renderKpi } from './ui/kpi.js';
import { createPanel } from './ui/panel.js';
import { renderAnalysis } from './ui/analysis.js';
import { renderCompare } from './ui/compare.js';
import { fmtDate } from './lib/format.js';

const RANGES = [
  { label: '1 año', months: 12 },
  { label: '3 años', months: 36 },
  { label: '5 años', months: 60 },
  { label: 'Todo', months: 0 },
];

const state = { months: 36 };
const panels = []; // todos los paneles montados, para redibujar al cambiar el rango

/** Monta una sección de país dentro de su contenedor */
function mountCountry(country, data) {
  const root = document.querySelector(`#${country.key}-root`);
  root.replaceChildren(
    el('div', { class: 'analysis-grid' }, renderAnalysis(country, data)),
    el('div', { class: 'kpi-strip' }, country.kpis.map((k) => renderKpi(data, k))),
    el('div', { class: 'chart-grid' }, country.panels.map((p) => {
      const panel = createPanel(data, p);
      panels.push(panel);
      return panel.node;
    })),
  );
}

/** Sección Tipo de cambio: lectura + cotizaciones del día + gráficos */
function mountFx(data) {
  document.querySelector('#fx-root').replaceChildren(
    el('div', { class: 'analysis-grid' }, renderAnalysis(dolar, data)),
    el('div', { id: 'fx-quotes' }, renderQuotes(data)),
    el('div', { class: 'chart-grid' }, dolar.panels.map((p) => {
      const panel = createPanel(data, p);
      panels.push(panel);
      return panel.node;
    })),
  );
  startLiveQuotes(data);
}

/** Refresca las cotizaciones del día cada minuto; si falla, queda el snapshot */
function startLiveQuotes(data) {
  const box = document.querySelector('#fx-quotes');
  const tick = async () => {
    if (document.hidden) return; // no consultar con la pestaña en segundo plano
    const quotes = await fetchLiveQuotes();
    if (!quotes) return;
    data.quotes = quotes;
    box.replaceChildren(renderQuotes(data, new Date()));
  };
  tick();
  setInterval(tick, REFRESH_MS);
}

function mountRange() {
  const box = document.querySelector('#range');
  const buttons = RANGES.map((r) => {
    const b = el('button', { class: 'pill', type: 'button', 'aria-pressed': String(r.months === state.months) }, r.label);
    b.addEventListener('click', () => {
      state.months = r.months;
      buttons.forEach((x, i) => x.setAttribute('aria-pressed', String(RANGES[i].months === r.months)));
      panels.forEach((p) => p.update(state.months));
    });
    return b;
  });
  box.append(el('span', { class: 'label' }, 'Período'), ...buttons);
}

async function init() {
  mountRange();
  try {
    const [ar, us, fx] = await Promise.all([loadCountry(argentina), loadCountry(usa), loadCountry(dolar)]);
    mountCountry(argentina, ar);
    mountFx(fx);
    mountCountry(usa, us);
    document.querySelector('#compare-root').replaceChildren(renderCompare(ar, us));
    panels.forEach((p) => p.update(state.months));
    const upd = ar.updated < us.updated ? ar.updated : us.updated;
    document.querySelector('#updated').textContent = `Datos actualizados al ${fmtDate(upd, 'M')} (${upd.split('-').reverse().join('/')})`;
  } catch (err) {
    console.error(err);
    for (const id of ['#ar-root', '#fx-root', '#us-root', '#compare-root']) {
      document.querySelector(id).replaceChildren(el('div', { class: 'state' }, 'No se pudieron cargar los datos. Volvé a abrir la página en unos minutos.'));
    }
  }
}

init();
