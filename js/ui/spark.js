/**
 * spark.js — mini línea de tendencia (SVG) para las tarjetas de resumen.
 * Usa `currentColor`: el color lo define el CSS (.spark { color: var(--accent) }).
 */
const NS = 'http://www.w3.org/2000/svg';

/** @param {Array<[string, number]>} points serie ya transformada; se usan los últimos `n` */
export function renderSpark(points, n = 24) {
  const vals = points.slice(-n).map((p) => p[1]);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'spark');
  svg.setAttribute('viewBox', '0 0 120 32');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  if (vals.length < 2) return svg;

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i) => (i / (vals.length - 1)) * 116 + 2;
  const y = (v) => 28 - ((v - min) / span) * 24;
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  const area = document.createElementNS(NS, 'path');
  area.setAttribute('d', `${d} L${x(vals.length - 1).toFixed(1)} 32 L${x(0).toFixed(1)} 32 Z`);
  area.setAttribute('fill', 'currentColor');
  area.setAttribute('opacity', '0.12');

  const line = document.createElementNS(NS, 'path');
  line.setAttribute('d', d);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'currentColor');
  line.setAttribute('stroke-width', '1.75');
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  line.setAttribute('stroke-linejoin', 'round');

  svg.append(area, line);
  return svg;
}
