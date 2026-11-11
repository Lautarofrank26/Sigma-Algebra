/**
 * heatmap.js — portada: mapa de calor del mundo.
 *
 * - Cada país se pinta de rojo (peor) a amarillo (intermedio) y verde (mejor) según el indicador elegido:
 *   crecimiento del PBI, inflación, desempleo o cuenta corriente. Los datos salen de data/mundo.json
 *   (tools/fetch-mundo.ps1) y las formas de data/paises.json (tools/build-paises.ps1).
 * - Al pasar el mouse (o tocar) aparece una tarjeta con el valor, el año y el puesto entre los países con dato.
 * - Argentina y EE.UU. quedan remarcadas, con su valor y puesto debajo del mapa.
 * - Los colores se animan al entrar y al cambiar de indicador. Con "reducir movimiento" el cambio es directo.
 * Para sumar un indicador: agregarlo en fetch-mundo.ps1 y una entrada en METRICS.
 */
import { el } from './dom.js';
import { fmtNum, fmtSigned } from '../lib/format.js';
import { downloadCsv } from '../lib/csv.js';

const LAT_TOP = 84;
const LAT_BOTTOM = -58;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const HIGHLIGHT = { ARG: 'Argentina', USA: 'EE.UU.' };

/**
 * Indicadores. `score(v)` devuelve 0 (peor) … 1 (mejor) con tramos lineales entre los puntos de `stops`
 * ([valor, puntaje]); `rank(v)` ordena de mejor a peor sin recortar los extremos.
 */
const interp = (stops, x) => {
  if (x <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i += 1) {
    if (x <= stops[i][0]) {
      const [x0, y0] = stops[i - 1];
      const [x1, y1] = stops[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return stops[stops.length - 1][1];
};
/** Distancia a la zona de inflación "sana" (1–3 %): por debajo cuenta 1,5 veces porque la deflación también preocupa */
const inflDist = (v) => Math.max(0, (v >= 2 ? v - 2 : (2 - v) * 1.5) - 1);

const METRICS = [
  {
    key: 'gdp', tab: 'PBI', title: 'Crecimiento del PBI', unit: 'variación anual real',
    fmt: (v) => `${fmtSigned(v, 1)}%`,
    score: (v) => interp([[-2, 0], [2.5, 0.5], [6, 1]], v), rank: (v) => v,
    worst: '−2% o menos', mid: '2,5%', best: '6% o más',
    how: 'Más crecimiento, mejor.',
  },
  {
    key: 'infl', tab: 'Inflación', title: 'Inflación', unit: 'promedio anual de precios al consumidor',
    fmt: (v) => `${fmtNum(v, 1)}%`,
    score: (v) => interp([[0, 1], [5, 0.5], [25, 0]], inflDist(v)), rank: (v) => -inflDist(v) - v / 1e4,
    worst: '25% o más', mid: '8%', best: 'entre 1% y 3%',
    how: 'Lo mejor es una inflación baja y estable; la deflación también cuenta como señal débil.',
  },
  {
    key: 'unemp', tab: 'Desempleo', title: 'Desempleo', unit: '% de la fuerza laboral',
    fmt: (v) => `${fmtNum(v, 1)}%`,
    score: (v) => interp([[3, 1], [7, 0.5], [14, 0]], v), rank: (v) => -v,
    worst: '14% o más', mid: '7%', best: '3% o menos',
    how: 'Menos desempleo, mejor.',
  },
  {
    key: 'cab', tab: 'Cuenta corriente', title: 'Cuenta corriente', unit: '% del PBI',
    fmt: (v) => `${fmtSigned(v, 1)}%`,
    score: (v) => interp([[-8, 0], [-1, 0.5], [4, 1]], v), rank: (v) => v,
    worst: '−8% o menos', mid: '−1%', best: '4% o más',
    how: 'Superávit (positivo) es mejor que déficit.',
  },
];

/* ---------- colores ---------- */

const hex = (s) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(s.trim());
  const n = m ? parseInt(m[1], 16) : 0xdde3ec;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const ease = (t) => 1 - (1 - t) ** 3;

/* ---------- geometría ---------- */

const projX = (lon) => (lon + 180) / 360;
const projY = (lat) => (LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM);

/** Punto dentro de un anillo (regla par-impar; sirve también para agujeros) */
function inRings(rings, lon, lat) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const xi = ring[i];
      const yi = ring[i + 1];
      const xj = ring[j];
      const yj = ring[j + 1];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/**
 * @param {HTMLElement} root contenedor de la portada
 * @param {{shapes:object, world:object}} data formas por país (ISO3) y datos de data/mundo.json
 */
export function mountHeatmap(root, { shapes, world }) {
  const countries = Object.keys(shapes).map((iso) => {
    const rings = shapes[iso];
    let x0 = 180; let x1 = -180; let y0 = 90; let y1 = -90;
    for (const r of rings) for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]); }
    return { iso, rings, box: [x0, y0, x1, y1], lon: (x0 + x1) / 2, path: null };
  });
  const byIso = new Map(countries.map((c) => [c.iso, c]));
  const names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['es'], { type: 'region' }) : null;
  const nameOf = (iso) => {
    const code = world.countries[iso]?.n;
    try { return (code && names?.of(code)) || HIGHLIGHT[iso] || iso; } catch { return HIGHLIGHT[iso] || iso; }
  };

  let metric = METRICS[0];
  let hover = null;
  let ranking = new Map(); // iso -> { value, year, rank, total }
  let colors = { bad: hex('#B3372F'), mid: hex('#E0B33A'), good: hex('#1E7F5C'), none: hex('#DDE3EC'), line: '#FFFFFF', ink: '#0E1E33' };

  /* --- DOM --- */
  const canvas = el('canvas', { class: 'heat-canvas', role: 'img' });
  const tip = el('div', { class: 'heat-tip', hidden: true, 'aria-hidden': 'true' });
  const map = el('div', { class: 'heat-map' }, [canvas, tip]);
  const tabs = METRICS.map((m) => {
    const b = el('button', { class: 'pill', type: 'button', 'aria-pressed': m === metric ? 'true' : 'false' }, m.tab);
    b.addEventListener('click', () => setMetric(m));
    return b;
  });
  const refs = el('div', { class: 'heat-refs', 'aria-live': 'polite' });
  const how = el('p', { class: 'heat-how' });
  const csvBtn = el('button', { class: 'csv-btn', type: 'button' }, 'Descargar CSV');
  csvBtn.addEventListener('click', downloadActive);

  const legendBar = el('div', { class: 'heat-bar', 'aria-hidden': 'true' });
  const legendWorst = el('span', { class: 'num' });
  const legendMid = el('span', { class: 'num' });
  const legendBest = el('span', { class: 'num' });

  root.replaceChildren(
    el('div', { class: 'heat-head' }, [
      el('div', {}, [
        el('span', { class: 'label' }, 'Mapa macro mundial'),
        el('h1', {}, 'Cómo está cada economía'),
        el('p', {}, 'Elegí un indicador: cada país se pinta de rojo (peor) a verde (mejor), con amarillo en el medio. Pasá el mouse por un país para ver el dato y su puesto.'),
      ]),
      el('div', { class: 'heat-tabs', role: 'group', 'aria-label': 'Indicador' }, tabs),
    ]),
    el('div', { class: 'heat-scroll' }, [map]),
    el('div', { class: 'heat-legend' }, [
      el('div', { class: 'heat-scale' }, [
        el('span', { class: 'label' }, 'Peor'), legendBar, el('span', { class: 'label' }, 'Mejor'),
      ]),
      el('div', { class: 'heat-ends' }, [legendWorst, legendMid, legendBest]),
    ]),
    refs,
    el('div', { class: 'heat-foot' }, [
      how,
      el('span', { class: 'src-line' }, [`Fuente: Banco Mundial, último dato anual de cada país (actualizado ${world.updated}). Inflación de Argentina y EE.UU. completada con series propias cuando falta el año reciente. `, csvBtn]),
    ]),
  );

  /* --- cálculo de puestos --- */
  function computeRanking() {
    const list = [];
    for (const c of countries) {
      const d = world.countries[c.iso]?.[metric.key];
      if (d) list.push({ iso: c.iso, value: d[0], year: d[1], k: metric.rank(d[0]) });
    }
    list.sort((a, b) => b.k - a.k);
    ranking = new Map(list.map((r, i) => [r.iso, { ...r, rank: i + 1, total: list.length }]));
  }

  /* --- colores animados --- */
  const state = new Map(countries.map((c) => [c.iso, { cur: colors.none, from: colors.none, to: colors.none, t0: 0, delay: 0 }]));
  let animating = false;
  const targetColor = (iso) => {
    const r = ranking.get(iso);
    if (!r) return colors.none;
    const s = metric.score(r.value);
    return s < 0.5 ? mix(colors.bad, colors.mid, s * 2) : mix(colors.mid, colors.good, (s - 0.5) * 2);
  };

  function retarget(spread) {
    const now = performance.now();
    for (const c of countries) {
      const s = state.get(c.iso);
      s.from = s.cur;
      s.to = targetColor(c.iso);
      s.t0 = now;
      s.delay = REDUCED ? 0 : ((c.lon + 180) / 360) * spread;
    }
    if (REDUCED) { for (const s of state.values()) s.cur = s.to; draw(); return; }
    kick();
  }

  function kick() {
    if (animating) return;
    animating = true;
    requestAnimationFrame(step);
  }
  function step(now) {
    let busy = false;
    for (const s of state.values()) {
      const t = Math.min(1, Math.max(0, (now - s.t0 - s.delay) / 520));
      s.cur = t >= 1 ? s.to : mix(s.from, s.to, ease(t));
      if (t < 1) busy = true;
    }
    draw();
    if (busy && !document.hidden) requestAnimationFrame(step);
    else { animating = false; if (busy) retargetNow(); }
  }
  function retargetNow() { for (const s of state.values()) s.cur = s.to; draw(); }

  /* --- dibujo --- */
  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let dpr = 1;

  function buildPaths() {
    for (const c of countries) {
      const p = new Path2D();
      for (const r of c.rings) {
        for (let i = 0; i < r.length; i += 2) {
          const x = projX(r[i]) * w;
          const y = projY(r[i + 1]) * h;
          if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
        }
        p.closePath();
      }
      c.path = p;
    }
  }

  function readColors() {
    const cs = getComputedStyle(canvas);
    const v = (n, d) => cs.getPropertyValue(n).trim() || d;
    colors = {
      bad: hex(v('--bad', '#B3372F')), mid: hex(v('--heat-mid', '#E0B33A')), good: hex(v('--good', '#1E7F5C')),
      none: hex(v('--heat-none', '#DDE3EC')), line: v('--surface', '#FFFFFF'), ink: v('--ink', '#0E1E33'),
    };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = map.clientWidth;
    h = Math.round((w * (LAT_TOP - LAT_BOTTOM)) / 360);
    map.style.height = `${h}px`;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    buildPaths();
    draw();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = colors.line;
    for (const c of countries) {
      ctx.fillStyle = rgb(state.get(c.iso).cur);
      ctx.fill(c.path, 'evenodd');
      ctx.stroke(c.path);
    }
    // Argentina y EE.UU. remarcadas; el país bajo el cursor, un poco más
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1.4;
    for (const iso of Object.keys(HIGHLIGHT)) { const c = byIso.get(iso); if (c) ctx.stroke(c.path); }
    if (hover && !HIGHLIGHT[hover]) { ctx.lineWidth = 1.8; ctx.stroke(byIso.get(hover).path); }
  }

  /* --- interacción --- */
  function hitTest(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const lon = (px / rect.width) * 360 - 180;
    const lat = LAT_TOP - (py / rect.height) * (LAT_TOP - LAT_BOTTOM);
    for (const c of countries) {
      const [x0, y0, x1, y1] = c.box;
      if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue;
      if (inRings(c.rings, lon, lat)) return { iso: c.iso, px, py, width: rect.width };
    }
    return { iso: null, px, py, width: rect.width };
  }

  function showTip(hit) {
    if (!hit.iso) { tip.hidden = true; return; }
    const r = ranking.get(hit.iso);
    tip.replaceChildren(
      el('span', { class: 'label' }, nameOf(hit.iso)),
      r
        ? el('div', { class: 'heat-tip-main' }, [
          el('span', { class: 'num heat-tip-value' }, metric.fmt(r.value)),
          el('span', { class: 'heat-tip-dot', style: `background:${rgb(targetColor(hit.iso))}` }),
        ])
        : el('span', { class: 'heat-tip-none' }, 'Sin dato disponible'),
      r ? el('span', { class: 'num heat-tip-line' }, `Puesto ${r.rank} de ${r.total} · dato ${r.year}`) : null,
      el('span', { class: 'heat-tip-line' }, metric.title),
    );
    tip.hidden = false;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let x = hit.px + 16;
    let y = hit.py + 16;
    if (x + tw > hit.width - 6) x = hit.px - tw - 16;
    if (y + th > map.clientHeight - 6) y = hit.py - th - 12;
    tip.style.transform = `translate(${Math.max(6, x)}px, ${Math.max(6, y)}px)`;
  }

  let lastHit = null;
  function onMove(e) {
    const hit = hitTest(e.clientX, e.clientY);
    lastHit = hit;
    if (hit.iso !== hover) { hover = hit.iso; draw(); }
    showTip(hit);
  }
  map.addEventListener('pointermove', onMove);
  map.addEventListener('pointerdown', onMove);
  map.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return; // en celular la tarjeta queda hasta tocar otra vez
    hover = null; tip.hidden = true; draw();
  });

  /* --- indicador activo --- */
  function renderRefs() {
    refs.replaceChildren(...Object.entries(HIGHLIGHT).map(([iso, label]) => {
      const r = ranking.get(iso);
      return el('div', { class: 'heat-ref' }, [
        el('span', { class: 'heat-swatch', style: `background:${rgb(targetColor(iso))}` }),
        el('b', {}, label),
        r
          ? el('span', { class: 'num' }, `${metric.fmt(r.value)} · puesto ${r.rank} de ${r.total} (${r.year})`)
          : el('span', {}, 'sin dato'),
      ]);
    }));
  }

  function renderLegend() {
    const grad = `linear-gradient(90deg, ${rgb(colors.bad)}, ${rgb(colors.mid)}, ${rgb(colors.good)})`;
    legendBar.style.background = grad;
    legendWorst.textContent = metric.worst;
    legendMid.textContent = metric.mid;
    legendBest.textContent = metric.best;
    how.textContent = `${metric.title} (${metric.unit}). ${metric.how}`;
    canvas.setAttribute('aria-label', `Mapa de calor mundial: ${metric.title}. Rojo es peor, verde es mejor. Los datos están en el CSV descargable.`);
  }

  function setMetric(m) {
    metric = m;
    tabs.forEach((b, i) => b.setAttribute('aria-pressed', METRICS[i] === m ? 'true' : 'false'));
    computeRanking();
    renderLegend();
    renderRefs();
    retarget(260);
    if (hover && lastHit) showTip(lastHit); // la tarjeta abierta se actualiza con el nuevo indicador
  }

  function downloadActive() {
    const cell = (v) => String(Number(v.toFixed(4))).replace('.', ',');
    const rows = [...ranking.values()].map((r) => `${nameOf(r.iso).replace(/;/g, ',')};${r.iso};${cell(r.value)};${r.year};${r.rank}`);
    downloadCsv(`mapa-${metric.key}.csv`, ['País;Código;Valor;Año;Puesto', ...rows].join('\r\n'));
  }

  /* --- arranque --- */
  readColors();
  computeRanking();
  renderLegend();
  renderRefs();
  new ResizeObserver(() => { if (map.clientWidth !== w) resize(); }).observe(map);
  resize();
  retarget(900); // entrada: los colores aparecen de oeste a este
}
