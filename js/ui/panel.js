/**
 * panel.js — panel de un indicador: título, valor actual, gráfico y "cómo leerlo".
 * Devuelve { node, update(months) } para redibujar al cambiar el rango.
 */
import { el } from './dom.js';
import { drawChart } from './chart.js';
import { resolve } from '../data/loader.js';
import { fmtNum, fmtDate } from '../lib/format.js';

export function createPanel(data, panel) {
  const head = resolve(data, panel.headline.ref);
  const canvas = el('canvas', { role: 'img', 'aria-label': `Gráfico de ${panel.title}` });
  let chart = null;

  const now = head
    ? el('div', { class: 'panel-now' }, [
        el('div', { class: 'kpi-value' }, `${panel.headline.prefix ?? ''}${fmtNum(head.points[head.points.length - 1][1], panel.headline.decimals)}${panel.headline.suffix ?? ''}`),
        el('div', { class: 'unit' }, fmtDate(head.points[head.points.length - 1][0], head.freq)),
      ])
    : null;

  const node = el('article', { class: 'panel' }, [
    el('div', { class: 'panel-head' }, [
      el('div', {}, [el('h3', {}, panel.title), el('div', { class: 'unit' }, panel.unit)]),
      now,
    ]),
    el('div', { class: 'chart-box' }, canvas),
    el('details', {}, [el('summary', {}, 'Cómo leerlo'), el('p', {}, panel.read)]),
    el('div', { class: 'src' }, `Fuente: ${panel.source}`),
  ]);

  return {
    node,
    update(months) {
      chart = drawChart(canvas, data, panel, months, chart);
    },
  };
}
