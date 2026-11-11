/**
 * events.js — marcadores de eventos en los gráficos (estilo TradingView) y su tarjeta / lista.
 *
 * Datos: data/eventos.json (un solo archivo, esquema en su campo "nota"). Cada evento dice en qué gráficos aparece
 * (`graficos`, por id de panel) y trae una explicación distinta para cada uno (`explicacion_por_grafico`).
 *
 * En el gráfico:
 *   - rombo violeta chico sobre el eje X, en el período del evento;
 *   - al pasar el mouse: línea vertical punteada y el título del evento;
 *   - clic: tarjeta debajo del gráfico (fecha, título, tipo, explicación para ESE gráfico y fuente).
 * Densidad: con rango Máx o 10 años solo se muestran los de prioridad 1 (históricos); con 5 años o menos, también
 * los de prioridad 2. Nunca más de MAX_VISIBLE a la vez (primero los de mayor prioridad, luego los más recientes).
 */
import { el } from './dom.js';

const MAX_VISIBLE = 6;
const SIZE = 5; // medio lado del rombo, en px
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

let cache = null;
/** Carga data/eventos.json una sola vez; si falla, sin eventos (los gráficos funcionan igual) */
export function loadEvents() {
  if (!cache) {
    cache = fetch('data/eventos.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : { eventos: [] }))
      .then((d) => (d.eventos ?? []).filter((e) => e.pais === 'AR'))
      .catch(() => []);
  }
  return cache;
}

/** "2023-12-12" -> "12 de diciembre de 2023" ("2007-01-01" con título "(enero de 2007)" se muestra igual) */
export function fmtEventDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

/** Fecha de fin (exclusiva) del período que empieza en `label`, según la frecuencia del gráfico */
function periodEnd(label, freq) {
  const y = Number(label.slice(0, 4));
  const m = Number(label.slice(5, 7)) || 1;
  const add = freq === 'A' ? 12 : freq === 'S' ? 6 : freq === 'Q' ? 3 : 1;
  const t = y * 12 + (m - 1) + add;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;
}

/**
 * Eventos que se dibujan con el rango elegido: dentro de las fechas del gráfico, filtrados por prioridad y con tope.
 * @param {Array} events eventos de este gráfico · @param {string[]} labels fechas del eje X · @param {number} months 0 = máximo
 */
export function visibleEvents(events, labels, months, freq) {
  if (!events?.length || !labels?.length) return [];
  const first = labels[0];
  const end = periodEnd(labels[labels.length - 1], freq);
  const maxPrio = months === 0 || months >= 120 ? 1 : 2;
  return events
    .filter((e) => e.fecha >= first && e.fecha < end && e.prioridad <= maxPrio)
    .sort((a, b) => a.prioridad - b.prioridad || (a.fecha < b.fecha ? 1 : -1))
    .slice(0, MAX_VISIBLE);
}

/**
 * Plugin de Chart.js que dibuja los marcadores y maneja hover y clic.
 * @param {Array} events eventos del gráfico · @param {number} months rango visible · @param {string} freq frecuencia del eje
 * @param {(ev:object)=>void} onPick se llama al hacer clic en un rombo
 */
export function eventPlugin(events, months, freq, onPick) {
  return {
    id: 'eventMarkers',
    afterDatasetsDraw(chart) {
      const labels = chart.data.labels;
      const list = visibleEvents(events, labels, months, freq);
      const { ctx, chartArea, scales } = chart;
      const color = getComputedStyle(chart.canvas).getPropertyValue('--event').trim() || '#7B4FC9';
      const ink = getComputedStyle(chart.canvas).getPropertyValue('--ink').trim() || '#0E1E33';
      const font = getComputedStyle(chart.canvas).getPropertyValue('--font-body').trim() || 'sans-serif';
      chart.$events = [];
      for (const ev of list) {
        // Período que contiene la fecha del evento: el último rótulo del eje que no la supera
        let i = -1;
        for (let k = 0; k < labels.length && labels[k] <= ev.fecha; k += 1) i = k;
        if (i < 0) continue;
        const x = scales.x.getPixelForValue(i);
        const y = chartArea.bottom - SIZE - 2;
        chart.$events.push({ ev, x, y });
      }
      const hovered = chart.$events.find((m) => m.ev.id === chart.$evHover);
      ctx.save();
      if (hovered) {
        // Línea vertical punteada y título del evento
        ctx.beginPath();
        ctx.moveTo(hovered.x, chartArea.top);
        ctx.lineTo(hovered.x, chartArea.bottom);
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `600 11px ${font}`;
        // Título del evento, recortado con "…" si no entra en el ancho del gráfico
        let text = hovered.ev.titulo;
        const maxW = chartArea.right - chartArea.left - 12;
        if (ctx.measureText(text).width > maxW) {
          while (text.length > 4 && ctx.measureText(`${text}…`).width > maxW) text = text.slice(0, -1);
          text = `${text.trimEnd()}…`;
        }
        const w = ctx.measureText(text).width + 12;
        const bx = Math.min(Math.max(hovered.x - w / 2, chartArea.left), chartArea.right - w);
        ctx.fillStyle = ink;
        ctx.fillRect(bx, chartArea.top, w, 18);
        ctx.fillStyle = '#fff';
        ctx.fillText(text, bx + 6, chartArea.top + 13);
      }
      for (const m of chart.$events) {
        const s = m.ev.id === chart.$evHover ? SIZE + 1.5 : SIZE;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y - s);
        ctx.lineTo(m.x + s, m.y);
        ctx.lineTo(m.x, m.y + s);
        ctx.lineTo(m.x - s, m.y);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
      ctx.restore();
    },
    afterEvent(chart, args) {
      const e = args.event;
      const hit = (chart.$events ?? []).find((m) => Math.abs(e.x - m.x) <= SIZE + 4 && Math.abs(e.y - m.y) <= SIZE + 8);
      const id = hit ? hit.ev.id : null;
      if (id !== (chart.$evHover ?? null)) {
        chart.$evHover = id;
        chart.canvas.style.cursor = id ? 'pointer' : '';
        args.changed = true;
      }
      if (hit && e.type === 'click') onPick?.(hit.ev);
    },
  };
}

/**
 * Tarjeta del evento elegido y desplegable "Eventos en este gráfico" para un panel.
 * @param {string} chartId id del panel · @param {Array} events eventos del panel (ya filtrados por gráfico)
 */
export function eventBlocks(chartId, events) {
  const card = el('div', { class: 'ev-card', hidden: true, 'aria-live': 'polite' });
  const show = (ev) => {
    let host = '';
    try { host = new URL(ev.fuente_url).hostname.replace(/^www\./, ''); } catch { host = 'fuente'; }
    const close = el('button', { class: 'ev-close', type: 'button', 'aria-label': 'Cerrar' }, '×');
    close.addEventListener('click', () => { card.hidden = true; });
    card.replaceChildren(
      el('div', { class: 'ev-card-head' }, [
        el('span', { class: 'ev-diamond', 'aria-hidden': 'true' }),
        el('span', { class: 'label' }, `${fmtEventDate(ev.fecha)} · ${ev.tipo}`),
        close,
      ]),
      el('h4', {}, ev.titulo),
      el('p', {}, ev.explicacion_por_grafico?.[chartId] ?? ''),
      el('p', { class: 'ev-src' }, ['Fuente: ', el('a', { href: ev.fuente_url, target: '_blank', rel: 'noopener noreferrer' }, host)]),
    );
    card.hidden = false;
  };
  const sorted = [...events].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const list = sorted.length
    ? el('details', { class: 'ev-list' }, [
      el('summary', {}, `Eventos en este gráfico (${sorted.length})`),
      el('ul', {}, sorted.map((ev) => {
        const b = el('button', { type: 'button', class: 'ev-item' }, [
          el('span', { class: 'ev-diamond', 'aria-hidden': 'true' }),
          el('span', { class: 'num' }, ev.fecha.slice(0, 7).split('-').reverse().join('/')),
          ` ${ev.titulo}`,
          ev.prioridad === 1 ? el('span', { class: 'ev-tag' }, 'histórico') : null,
        ]);
        b.addEventListener('click', () => show(ev));
        return el('li', {}, b);
      })),
    ])
    : null;
  return { card, list, show };
}
