/**
 * app.js — piezas compartidas por las páginas: selector de período, montaje de
 * secciones de país / dólar y manejo de errores de carga.
 * Cada página (js/pages/*.js) compone estas funciones.
 */
import { el } from './ui/dom.js';
import { renderKpi } from './ui/kpi.js';
import { createPanel } from './ui/panel.js';
import { renderAnalysis } from './ui/analysis.js';
import { renderSummary } from './ui/summary.js';
import { renderQuotes } from './ui/quotes.js';
import { fetchLiveQuotes, refreshData, usedIds, REFRESH_MS, DATA_REFRESH_MS } from './data/live.js';
import { mountShell } from './ui/shell.js';
import { fmtDate } from './lib/format.js';

const RANGES = [
  { label: '1 año', months: 12 },
  { label: '3 años', months: 36 },
  { label: '5 años', months: 60 },
  { label: 'Todo', months: 0 },
];
const STORAGE_KEY = 'pulso-macro:range';

/** El período elegido se recuerda entre páginas (comodidad; si falla el storage, se usa el default) */
function readRange() {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    if (RANGES.some((r) => r.months === v) && localStorage.getItem(STORAGE_KEY) !== null) return v;
  } catch { /* storage bloqueado */ }
  return 36;
}
function saveRange(months) {
  try { localStorage.setItem(STORAGE_KEY, String(months)); } catch { /* storage bloqueado */ }
}

/** Arranque común: menú y pie. Devuelve el estado de la página. */
export function initPage(activeId, subId) {
  mountShell(activeId, subId);
  return { months: readRange(), panels: [] };
}

/** Dibuja el selector de período en #range y redibuja los paneles al cambiar */
export function mountRange(page) {
  const box = document.querySelector('#range');
  if (!box) return;
  const buttons = RANGES.map((r) => {
    const b = el('button', { class: 'pill', type: 'button', 'aria-pressed': String(r.months === page.months) }, r.label);
    b.addEventListener('click', () => {
      page.months = r.months;
      saveRange(r.months);
      buttons.forEach((x, i) => x.setAttribute('aria-pressed', String(RANGES[i].months === r.months)));
      page.panels.forEach((p) => p.update(page.months));
    });
    return b;
  });
  box.replaceChildren(el('span', { class: 'label' }, 'Período'), ...buttons);
}

/** Crea los paneles de gráfico y los registra en la página */
function buildPanels(page, data, specs) {
  return el('div', { class: 'chart-grid' }, specs.map((spec) => {
    const panel = createPanel(data, spec);
    page.panels.push(panel);
    return panel.node;
  }));
}

/**
 * Sección de país: lectura macro, tarjetas, tabla resumen y gráficos.
 * @param {'ar'|'us'} [group] si se indica, la página se actualiza en vivo (ver data/live.js)
 */
export function mountCountry(page, country, data, root, group) {
  const render = () => {
    page.panels.forEach((p) => p.destroy());
    page.panels.length = 0;
    root.replaceChildren(
      el('div', { class: 'analysis-grid' }, renderAnalysis(country, data)),
      el('div', { class: 'kpi-strip' }, country.kpis.map((k) => renderKpi(data, k))),
      renderSummary(data, country.summary ?? []),
      buildPanels(page, data, country.panels),
    );
    finish(page, data);
  };
  render();
  if (group) startLiveData(country, data, group, render);
}

/** Pide los datos más recientes cada 5 minutos y redibuja la página si cambió algo */
function startLiveData(country, data, group, render) {
  const ids = usedIds(country);
  const run = async () => {
    if (document.hidden) return; // no consultar con la pestaña en segundo plano
    const result = await refreshData(data, group, ids);
    if (result.ok === 0) return; // sin conexión o fuentes bloqueadas: queda el historial guardado
    liveAt = new Date();
    if (result.changed) render();
    else setUpdated(data.updated);
  };
  setTimeout(run, 800);
  setInterval(run, DATA_REFRESH_MS);
}
/** Sección Tipo de cambio: lectura + cotizaciones (en vivo si se puede) + gráficos */
export function mountFx(page, dolar, data, root) {
  const quotesBox = el('div', {}, renderQuotes(data));
  root.replaceChildren(
    el('div', { class: 'analysis-grid' }, renderAnalysis(dolar, data)),
    quotesBox,
    buildPanels(page, data, dolar.panels),
  );
  startLiveQuotes(data, quotesBox);
  finish(page, data);
}

/** Refresca las cotizaciones del día cada minuto; si falla, queda el snapshot */
function startLiveQuotes(data, box) {
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

/** Dibuja los gráficos y muestra la fecha de actualización */
export function finish(page, data) {
  page.panels.forEach((p) => p.update(page.months));
  setUpdated(data.updated);
}

let liveAt = null; // hora de la última actualización en vivo exitosa

export function setUpdated(iso) {
  const node = document.querySelector('#updated');
  if (!node) return;
  node.textContent = `Historial al ${fmtDate(iso, 'M')} (${iso.split('-').reverse().join('/')})`;
  if (liveAt) {
    node.append(' · ', el('span', { class: 'live' }, `● En vivo ${liveAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`));
  }
}

/** Mensaje de error en un contenedor (falló la carga de datos) */
export function showError(root, err) {
  console.error(err);
  root.replaceChildren(el('div', { class: 'state' }, 'No se pudieron cargar los datos. Volvé a abrir la página en unos minutos.'));
}


