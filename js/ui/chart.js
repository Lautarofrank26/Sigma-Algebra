/**
 * chart.js — envoltorio sobre Chart.js (cargado por CDN como global `Chart`).
 * Construye un gráfico a partir de la especificación de un panel.
 */
import { resolve } from '../data/loader.js';
import { sliceRange } from '../lib/transform.js';
import { fmtNum, fmtDate } from '../lib/format.js';

/** Mínimo de puntos visibles para series lentas, así el rango corto no deja un gráfico vacío */
const MIN_POINTS = { M: 6, Q: 8, A: 10 };

const css = (node, name) => getComputedStyle(node).getPropertyValue(name).trim();

/** Lee los colores del tema desde las variables CSS (una sola fuente de verdad) */
function palette(node) {
  return {
    accent: css(node, '--accent'),
    // Segunda serie: naranja; en las páginas de EE.UU. (acento bronce) pasa a ser el azul, para no parecerse al acento
    series2: css(node, '--accent').toLowerCase() === css(node, '--us').toLowerCase() ? css(node, '--ar') : css(node, '--series-2'),
    series3: css(node, '--series-3'),
    series4: css(node, '--series-4'),
    bad: css(node, '--bad'),
    ink3: css(node, '--ink-3'),
    ink: css(node, '--ink'),
    grid: css(node, '--grid'),
    surface: css(node, '--surface'),
    font: css(node, '--font-body'),
  };
}

/** Prepara las series del panel recortadas al rango elegido, alineadas por fecha */
function buildSeries(data, panel, months) {
  const resolved = panel.datasets.map((d) => ({ spec: d, s: resolve(data, d.ref) })).filter((d) => d.s);
  if (!resolved.length) return null;

  const freq = resolved[0].s.freq;
  const sliced = resolved.map((d) => ({ ...d, pts: sliceRange(d.s.points, months, MIN_POINTS[freq] ?? 6) }));
  // Fechas: unión ordenada, limitada a la ventana de la serie principal
  const start = sliced[0].pts[0][0];
  const dates = [...new Set(sliced.flatMap((d) => d.pts.map((p) => p[0])))].filter((d) => d >= start).sort();
  return { freq, dates, sliced };
}

/** Cruz vertical que acompaña al mouse sobre el gráfico */
const crosshair = {
  id: 'crosshair',
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements?.() ?? [];
    if (!active.length) return;
    const { ctx, chartArea } = chart;
    const x = active[0].element.x;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = getComputedStyle(chart.canvas).getPropertyValue('--ink-3').trim() || '#76839A';
    ctx.stroke();
    ctx.restore();
  },
};

export function drawChart(canvas, data, panel, months, previous) {
  if (previous) previous.destroy();
  const built = buildSeries(data, panel, months);
  if (!built) return null;
  const c = palette(canvas);
  const { freq, dates, sliced } = built;

  const percentUnit = panel.unit.includes('%');

  // Colores de las series: con 2 o más líneas, cada una toma un color bien distinto (acento, naranja/azul, verde, violeta)
  // por posición, en lugar del gris azulado que se confundía con el acento. Los gráficos de dólares (fx-*) conservan
  // los colores propios de cada cotización.
  const autoColors = !String(panel.id ?? '').startsWith('fx-');
  const sequence = [c.series2, c.series3, c.series4];
  let lineIndex = 0;

  const datasets = sliced.map(({ spec, pts }) => {
    const map = new Map(pts);
    const values = dates.map((d) => (map.has(d) ? map.get(d) : null));
    const isBar = spec.type === 'bar';
    // color: nombre de la paleta base, o una variable CSS directa ("--fx-blue")
    let color = (spec.color?.startsWith('--') ? css(canvas, spec.color) : c[spec.color]) || c.accent;
    const position = isBar ? -1 : lineIndex++;
    const reassignable = spec.color === 'series2' || spec.color?.startsWith('--fx-');
    if (autoColors && reassignable) color = position > 0 ? sequence[Math.min(position - 1, sequence.length - 1)] : c.series2;
    const dash = !isBar && position >= 2 ? [6, 4] : undefined; // desde la tercera línea, también se diferencia por el trazo
    return {
      type: spec.type,
      yAxisID: spec.axis === 'right' ? 'y1' : 'y', // eje derecho para series de otra escala
      label: spec.label,
      data: values,
      order: isBar ? 1 : 0, // las líneas se dibujan sobre las barras
      borderColor: color,
      backgroundColor: isBar
        ? (ctx) => (spec.signColors && ctx.raw < 0 ? c.bad : color)
        : spec.fill
          ? `${color}22`
          : color,
      borderWidth: isBar ? 0 : 2.25,
      borderDash: dash,
      borderRadius: isBar ? 2 : 0,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.25,
      fill: !isBar && !!spec.fill,
      spanGaps: true,
      _decimals: spec.decimals ?? 1,
      _suffix: ['yoy', 'pct1'].includes(spec.ref.t) || percentUnit ? '%' : '',
    };
  });

  return new Chart(canvas, {
    plugins: [crosshair],
    data: { labels: dates, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: datasets.length > 1,
          position: 'top',
          align: 'start',
          labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, color: c.ink, font: { family: c.font, size: 12 } },
        },
        tooltip: {
          backgroundColor: c.ink,
          titleFont: { family: c.font },
          bodyFont: { family: c.font },
          callbacks: {
            title: (items) => fmtDate(items[0].label, freq),
            label: (ctx) => `${ctx.dataset.label}: ${fmtNum(ctx.parsed.y, ctx.dataset._decimals)}${ctx.dataset._suffix}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: c.grid },
          ticks: {
            color: c.ink3,
            font: { family: c.font, size: 11 },
            maxTicksLimit: 7,
            maxRotation: 0,
            callback(value) {
              return fmtDate(this.getLabelForValue(value), freq, 'short');
            },
          },
        },
        y: {
          grid: { color: c.grid },
          border: { display: false },
          ticks: {
            color: c.ink3,
            font: { family: c.font, size: 11 },
            maxTicksLimit: 5,
            callback: (v) => fmtNum(v, Math.abs(v) >= 10 ? 0 : 1),
          },
        },
        ...(panel.datasets.some((d) => d.axis === 'right')
          ? {
              y1: {
                position: 'right',
                grid: { display: false },
                border: { display: false },
                ticks: { color: c.ink3, font: { family: c.font, size: 11 }, maxTicksLimit: 5, callback: (v) => fmtNum(v, 1) },
              },
            }
          : {}),
      },
    },
  });
}

