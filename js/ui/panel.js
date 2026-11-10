/**
 * panel.js — panel de un indicador: título, valor actual, gráfico y "cómo leerlo".
 * Devuelve { node, update(months) } para redibujar al cambiar el rango.
 */
import { el } from './dom.js';
import { drawChart } from './chart.js';
import { resolve } from '../data/loader.js';
import { fmtNum, fmtDate, fmtAge } from '../lib/format.js';
import { seriesToCsv, downloadCsv } from '../lib/csv.js';
import { openFocus } from './focus.js';

export function createPanel(data, panel) {
  const head = resolve(data, panel.headline.ref);
  const lastValue = head ? `${panel.headline.prefix ?? ''}${fmtNum(head.points[head.points.length - 1][1], panel.headline.decimals)}${panel.headline.suffix ?? ''}` : null;
  const canvas = el('canvas', { role: 'img', 'aria-label': `Gráfico de ${panel.title}. ${panel.unit}.${lastValue ? ` Último dato: ${lastValue}.` : ''} Los datos completos se pueden descargar en CSV.` });
  let chart = null;

  const now = head
    ? el('div', { class: 'panel-now' }, [
        el('div', { class: 'kpi-value', 'data-count': head.points[head.points.length - 1][1], 'data-dec': panel.headline.decimals, 'data-prefix': panel.headline.prefix ?? '', 'data-suffix': panel.headline.suffix ?? '' }, `${panel.headline.prefix ?? ''}${fmtNum(head.points[head.points.length - 1][1], panel.headline.decimals)}${panel.headline.suffix ?? ''}`),
        el('div', { class: 'unit' }, `${fmtDate(head.points[head.points.length - 1][0], head.freq)} · ${fmtAge(head.points[head.points.length - 1][0], head.freq)}`),
      ])
    : null;

  // Descarga todo el historial disponible de las series del gráfico (no solo el período elegido)
  const csvButton = el('button', { class: 'csv-btn', type: 'button', title: 'Descargar los datos del gráfico en CSV' }, 'Descargar CSV');
  csvButton.addEventListener('click', () => {
    const columns = panel.datasets.map((d) => ({ label: d.label, points: resolve(data, d.ref)?.points ?? [] })).filter((c) => c.points.length);
    if (columns.length) downloadCsv(`macroeconomics-${panel.id}-${new Date().toISOString().slice(0, 10)}.csv`, seriesToCsv(columns));
  });

  const exportCsv = () => csvButton.click();
  let lastMonths = 36;
  const focusButton = el('button', { class: 'csv-btn', type: 'button', title: 'Ver el gráfico en grande, con sus últimos datos' }, 'Ampliar');
  focusButton.addEventListener('click', () => openFocus(data, panel, lastMonths, node, exportCsv));

  // El id permite llegar al gráfico desde el buscador (pagina.html#id)
  const node = el('article', { class: 'panel', id: panel.id }, [
    el('div', { class: 'panel-head' }, [
      el('div', {}, [el('h3', {}, panel.title), el('div', { class: 'unit' }, panel.unit)]),
      now,
    ]),
    el('div', { class: 'chart-box' }, canvas),
    el('details', {}, [el('summary', {}, 'Cómo leerlo'), el('p', {}, panel.read)]),
    el('div', { class: 'src' }, [el('span', {}, `Fuente: ${panel.source}`), el('span', { class: 'panel-actions' }, [focusButton, csvButton])]),
  ]);

  return {
    node,
    update(months) {
      lastMonths = months;
      chart = drawChart(canvas, data, panel, months, chart);
    },
    destroy() {
      if (chart) chart.destroy();
      chart = null;
    },
  };
}



