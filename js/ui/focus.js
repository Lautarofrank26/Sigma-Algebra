/**
 * focus.js — vista ampliada de un gráfico: gráfico grande con su propio selector de período,
 * tabla con las últimas observaciones, explicación y descarga.
 */
import { el } from './dom.js';
import { drawChart } from './chart.js';
import { resolve } from '../data/loader.js';
import { fmtNum, fmtDate } from '../lib/format.js';

const RANGES = [
  { label: '1 año', months: 12 },
  { label: '3 años', months: 36 },
  { label: '5 años', months: 60 },
  { label: 'Todo', months: 0 },
];
const ROWS = 12;

/** Tabla con las últimas observaciones de cada serie del gráfico (más reciente arriba) */
function lastObservations(data, panel) {
  const cols = panel.datasets.map((d) => ({ spec: d, s: resolve(data, d.ref) })).filter((c) => c.s);
  if (!cols.length) return null;
  const freq = cols[0].s.freq;
  const dates = [...new Set(cols.flatMap((c) => c.s.points.map((p) => p[0])))].sort().slice(-ROWS).reverse();
  const maps = cols.map((c) => new Map(c.s.points));
  return el('div', { class: 'table-scroll' }, el('table', {}, [
    el('thead', {}, el('tr', {}, [el('th', {}, 'Período'), ...cols.map((c) => el('th', {}, c.spec.label))])),
    el('tbody', {}, dates.map((d) => el('tr', {}, [
      el('td', {}, fmtDate(d, freq)),
      ...maps.map((m, i) => el('td', { class: 'num' }, m.has(d) ? fmtNum(m.get(d), cols[i].spec.decimals ?? 1) : '·')),
    ]))),
  ]));
}

/**
 * @param {HTMLElement} origin panel de origen: de ahí se toma el color de acento del país
 * @param {() => void} onCsv acción del botón de descarga
 */
export function openFocus(data, panel, months, origin, onCsv) {
  const canvas = el('canvas', { role: 'img', 'aria-label': `Gráfico ampliado de ${panel.title}` });
  let chart = null;
  let current = months;

  const buttons = RANGES.map((r) => {
    const b = el('button', { class: 'pill', type: 'button', 'aria-pressed': String(r.months === current) }, r.label);
    b.addEventListener('click', () => {
      current = r.months;
      buttons.forEach((x, i) => x.setAttribute('aria-pressed', String(RANGES[i].months === current)));
      chart = drawChart(canvas, data, panel, current, chart);
    });
    return b;
  });
  const close = el('button', { class: 'pill', type: 'button' }, 'Cerrar');
  const csv = el('button', { class: 'csv-btn', type: 'button' }, 'Descargar CSV');
  csv.addEventListener('click', onCsv);

  const dialog = el('dialog', { class: 'focus', 'aria-label': panel.title }, el('div', { class: 'focus-body' }, [
    el('div', { class: 'focus-head' }, [
      el('div', {}, [el('h2', {}, panel.title), el('p', { class: 'unit' }, panel.unit)]),
      close,
    ]),
    el('div', { class: 'range' }, [el('span', { class: 'label' }, 'Período'), ...buttons]),
    el('div', { class: 'chart-box' }, canvas),
    el('div', { class: 'focus-cols' }, [
      el('div', {}, [el('h3', {}, 'Últimas observaciones'), lastObservations(data, panel)]),
      el('div', {}, [
        el('h3', {}, 'Cómo leerlo'),
        el('p', {}, panel.read),
        el('p', { class: 'focus-src' }, `Fuente: ${panel.source}`),
        csv,
      ]),
    ]),
  ]));

  // El diálogo vive fuera de la sección del país: hereda sus colores de acento del panel de origen
  const cs = getComputedStyle(origin);
  for (const v of ['--accent', '--accent-soft', '--accent-ink']) dialog.style.setProperty(v, cs.getPropertyValue(v));

  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { chart?.destroy(); dialog.remove(); });

  document.body.append(dialog);
  dialog.showModal();
  chart = drawChart(canvas, data, panel, current, null);
}
