/**
 * app.js — piezas compartidas por las páginas: montaje de
 * secciones de país / dólar y manejo de errores de carga.
 * Cada página (js/pages/*.js) compone estas funciones.
 */
import { el } from './ui/dom.js';
import { createPanel } from './ui/panel.js';
import { createHeatTable } from './ui/heattable.js';
import { renderAnalysis } from './ui/analysis.js';
import { renderQuotes } from './ui/quotes.js';
import { fetchLiveQuotes, refreshData, usedIds, REFRESH_MS, DATA_REFRESH_MS } from './data/live.js';
import { mountShell } from './ui/shell.js';
import { revealIn } from './ui/reveal.js';
import { fmtDate } from './lib/format.js';
import { TIMELINES } from './config/timelines.js';

/** Arranque común: menú y pie. Devuelve el estado de la página (cada gráfico lleva su propia temporalidad). */
export function initPage(activeId, subId) {
  mountShell(activeId, subId);
  return { months: 36, panels: [] };
}
/** Crea los paneles de gráfico y los registra en la página */
function buildPanels(page, data, specs, events = []) {
  return el('div', { class: 'chart-grid' }, specs.map((original) => {
    // Temporalidad propia: la del propio panel o la de config/timelines.js
    let spec = original.timeline || !TIMELINES[original.id] ? original : { ...original, timeline: TIMELINES[original.id] };
    // Eventos marcados en este gráfico (data/eventos.json, campo `graficos`)
    const mine = events.filter((e) => e.graficos?.includes(original.id));
    if (mine.length) spec = { ...spec, events: mine };
    // Mapa de calor (categorías × períodos) o gráfico común
    const panel = spec.type === 'heatmap' ? createHeatTable(data, spec) : createPanel(data, spec);
    page.panels.push(panel);
    return panel.node;
  }));
}

/**
 * Sección de país: lectura macro (o el bloque que la reemplaza) y gráficos.
 * @param {'ar'|'us'} [group] si se indica, la página se actualiza en vivo (ver data/live.js)
 */
export function mountCountry(page, country, data, root, group, opts = {}) {
  let firstRender = true; // la animación de entrada solo se hace una vez; los redibujos en vivo no animan
  const render = () => {
    page.panels.forEach((p) => p.destroy());
    page.panels.length = 0;
    root.replaceChildren(...[
      // opts.lead: bloque que reemplaza a la lectura macro (p. ej. las noticias del Resumen de Argentina); se crea una sola vez
      opts.lead ?? el('div', { class: 'analysis-grid' }, renderAnalysis(country, data)),
      buildPanels(page, data, country.panels, opts.events),
      // opts.tail: bloque al final (p. ej. "Últimas de este rubro"); opts.sourcesFoot: pie con fuentes y fecha
      opts.tail ?? null,
      opts.sourcesFoot ? sourcesFoot(country, data) : null,
    ].filter(Boolean));
    revealIn(root, { animate: firstRender });
    firstRender = false;
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
/**
 * Pie de una sección: todas las fuentes de sus gráficos (sin repetir) y la fecha de la última actualización.
 */
function sourcesFoot(country, data) {
  const list = [];
  for (const p of country.panels) {
    const s = String(p.source ?? '').trim();
    if (s && !list.includes(s)) list.push(s);
  }
  const iso = String(data.updated ?? '');
  const day = iso ? iso.slice(0, 10).split('-').reverse().join('/') : 's/d';
  return el('footer', { class: 'sources-foot' }, [
    el('h2', { class: 'label' }, 'Fuentes'),
    el('ul', {}, list.map((s) => el('li', {}, s))),
    el('p', {}, `Última actualización de los datos: ${day}. Los datos se actualizan automáticamente varias veces por día; cada gráfico indica la fecha de su último dato.`),
  ]);
}

/** Sección Tipo de cambio: lectura + cotizaciones (en vivo si se puede) + gráficos */
export function mountFx(page, dolar, data, root, opts = {}) {
  const quotesBox = el('div', {}, renderQuotes(data));
  root.replaceChildren(...[
    el('div', { class: 'analysis-grid' }, renderAnalysis(dolar, data)),
    quotesBox,
    buildPanels(page, data, dolar.panels, opts.events),
    opts.tail ?? null,
    opts.sourcesFoot ? sourcesFoot(dolar, data) : null,
  ].filter(Boolean));
  revealIn(root);
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
  if (!page.hashDone) { page.hashDone = true; focusHashPanel(); }
}

/** Si la dirección trae #id de un gráfico (p. ej. desde el buscador), lo lleva a la vista y lo resalta */
function focusHashPanel() {
  const id = decodeURIComponent(location.hash.slice(1));
  const node = id ? document.getElementById(id) : null;
  if (!node?.classList.contains('panel')) return;
  node.setAttribute('data-reveal', '');
  node.classList.add('in', 'is-target');
  // Se espera un instante a que la página termine de acomodarse (tipografías, gráficos) antes de saltar
  setTimeout(() => node.scrollIntoView({ block: 'center', behavior: 'instant' }), 350);
  setTimeout(() => node.classList.remove('is-target'), 3200);
}
window.addEventListener('hashchange', focusHashPanel);

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


