/**
 * heatmap.js — portada: mapa de calor del mundo + comparador de países.
 *
 * - Cada país se pinta según el indicador elegido. PBI, inflación y desempleo van de rojo (peor) a amarillo
 *   (intermedio) y verde (mejor). "Peso en el PBI mundial" no tiene mejor ni peor: usa una escala azul
 *   (más oscuro = más peso, en escala logarítmica porque EE.UU. y China concentran casi la mitad).
 * - Datos: data/mundo.json (último dato de cada país), data/mundo-series.json (serie anual desde 2000) y
 *   data/paises.json (formas). Se generan con tools/fetch-mundo.ps1 y tools/build-paises.ps1.
 * - Al pasar el mouse (o tocar) un país aparece una tarjeta con el valor, el puesto y cómo evolucionó el indicador.
 * - Clic en un país: se abre su ficha de análisis (los cuatro indicadores, puestos y series).
 * - Botón "Comparar países": abre un diálogo para comparar dos países y un indicador (PBI, inflación o desempleo).
 * - Argentina y EE.UU. quedan remarcadas, con su valor y puesto debajo del mapa.
 * Para sumar un indicador: agregarlo en fetch-mundo.ps1 y una entrada en METRICS.
 */
import { el } from './dom.js';
import { fmtNum, fmtSigned } from '../lib/format.js';
import { downloadCsv } from '../lib/csv.js';
import { drawChart } from './chart.js';

const LAT_TOP = 84;
const LAT_BOTTOM = -58;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const HIGHLIGHT = { ARG: 'Argentina', USA: 'EE.UU.' };
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Indicadores. `score(v)` devuelve 0 … 1 con tramos lineales entre los puntos de `stops`
 * ([valor, puntaje]); `rank(v)` ordena de mejor a peor (o de mayor a menor) sin recortar los extremos.
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
    key: 'gdp', tab: 'PBI', title: 'Crecimiento del PBI', unit: 'variación anual real', short: '% anual', decimals: 1,
    fmt: (v) => `${fmtSigned(v, 1)}%`,
    score: (v) => interp([[-2, 0], [2.5, 0.5], [6, 1]], v), rank: (v) => v,
    ends: ['Peor', 'Mejor'], worst: '−2% o menos', mid: '2,5%', best: '6% o más',
    how: 'Más crecimiento, mejor.',
  },
  {
    key: 'infl', tab: 'Inflación', title: 'Inflación', unit: 'promedio anual de precios al consumidor', short: '% anual', decimals: 1,
    fmt: (v) => `${fmtNum(v, 1)}%`,
    score: (v) => interp([[0, 1], [5, 0.5], [25, 0]], inflDist(v)), rank: (v) => -inflDist(v) - v / 1e4,
    ends: ['Peor', 'Mejor'], worst: '25% o más', mid: '8%', best: 'entre 1% y 3%',
    how: 'Lo mejor es una inflación baja y estable; la deflación también cuenta como señal débil.',
  },
  {
    key: 'unemp', tab: 'Desempleo', title: 'Desempleo', unit: '% de la fuerza laboral', short: '% de la fuerza laboral', decimals: 1,
    fmt: (v) => `${fmtNum(v, 1)}%`,
    score: (v) => interp([[3, 1], [7, 0.5], [14, 0]], v), rank: (v) => -v,
    ends: ['Peor', 'Mejor'], worst: '14% o más', mid: '7%', best: '3% o menos',
    how: 'Menos desempleo, mejor.',
  },
  {
    key: 'share', tab: 'Peso en el PBI mundial', title: 'Peso en el PBI mundial', unit: 'PBI en US$ corrientes del país sobre el PBI mundial', short: '% del PBI mundial', decimals: 2,
    seq: true,
    fmt: (v) => `${fmtNum(v, v >= 10 ? 1 : 2)}%`,
    // escala logarítmica: 0,01 % → 0 y 25 % → 1
    score: (v) => Math.min(1, Math.max(0, (Math.log10(Math.max(v, 0.001)) + 2) / (Math.log10(25) + 2))), rank: (v) => v,
    ends: ['Menos peso', 'Más peso'], worst: '0,01% o menos', mid: '0,5%', best: '25% o más',
    how: 'No indica mejor ni peor: cuanto más oscuro, mayor participación en la producción mundial.',
  },
];
const COMPARABLE = ['gdp', 'infl', 'unemp'];

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

/** Punto dentro de un conjunto de anillos (regla par-impar; sirve también para agujeros) */
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
 * @param {{shapes:object, world:object, series:object|null}} data formas por país (ISO3), último dato y series anuales
 */
export function mountHeatmap(root, { shapes, world, series }) {
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
  const serieOf = (iso, key) => series?.countries?.[iso]?.[key] ?? null;

  let metric = METRICS[0];
  let hover = null;
  let ranking = new Map(); // iso -> { value, year, rank, total }
  let colors = {
    bad: hex('#B3372F'), mid: hex('#E0B33A'), good: hex('#1E7F5C'), none: hex('#DDE3EC'),
    seqLo: hex('#DCE6F2'), seqHi: hex('#0F3A6B'), line: '#FFFFFF', ink: '#0E1E33',
  };

  /* --- DOM del mapa --- */
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
  const legendLo = el('span', { class: 'label' });
  const legendHi = el('span', { class: 'label' });
  const legendWorst = el('span', { class: 'num' });
  const legendMid = el('span', { class: 'num' });
  const legendBest = el('span', { class: 'num' });

  /* --- comparador y ficha de país: se abren en un diálogo, a pedido --- */
  const cmp = buildCompare();
  const compareBtn = el('button', { class: 'heat-compare', type: 'button' }, 'Comparar países');
  compareBtn.addEventListener('click', () => openCompare());

  root.replaceChildren(
    el('div', { class: 'heat-head' }, [
      el('div', {}, [
        el('span', { class: 'label' }, 'Mapa macro mundial'),
        el('h1', {}, 'Cómo está cada economía'),
        el('p', {}, 'Elegí un indicador y mirá cómo se pinta cada país. Pasá el mouse por uno para ver el dato, su puesto y cómo evolucionó; abajo podés comparar dos países.'),
      ]),
      el('div', { class: 'heat-controls' }, [
        el('div', { class: 'heat-tabs', role: 'group', 'aria-label': 'Indicador' }, tabs),
        compareBtn,
      ]),
    ]),
    el('div', { class: 'heat-scroll' }, [map]),
    el('div', { class: 'heat-lower' }, [
      el('div', { class: 'heat-info' }, [
        el('div', { class: 'heat-legend' }, [
          el('div', { class: 'heat-scale' }, [legendLo, legendBar, legendHi]),
          el('div', { class: 'heat-ends' }, [legendWorst, legendMid, legendBest]),
        ]),
        refs,
        el('div', { class: 'heat-foot' }, [
          how,
          el('span', { class: 'src-line' }, [`Fuente: Banco Mundial, último dato anual de cada país (actualizado ${world.updated}). Inflación de Argentina y EE.UU. completada con series propias cuando falta el año reciente. `, csvBtn]),
        ]),
      ]),
    ]),
  );

  /* --- cálculo de puestos --- */
  function buildRanking(m) {
    const list = [];
    for (const c of countries) {
      const d = world.countries[c.iso]?.[m.key];
      if (d) list.push({ iso: c.iso, value: d[0], year: d[1], k: m.rank(d[0]) });
    }
    list.sort((a, b) => b.k - a.k);
    return new Map(list.map((r, i) => [r.iso, { ...r, rank: i + 1, total: list.length }]));
  }

  /* --- colores animados --- */
  const state = new Map(countries.map((c) => [c.iso, { cur: colors.none, from: colors.none, to: colors.none, t0: 0, delay: 0 }]));
  let animating = false;
  const colorFor = (s) => {
    if (metric.seq) return mix(colors.seqLo, colors.seqHi, s);
    return s < 0.5 ? mix(colors.bad, colors.mid, s * 2) : mix(colors.mid, colors.good, (s - 0.5) * 2);
  };
  const targetColor = (iso) => {
    const r = ranking.get(iso);
    return r ? colorFor(metric.score(r.value)) : colors.none;
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
    else { animating = false; if (busy) finishNow(); }
  }
  function finishNow() { for (const s of state.values()) s.cur = s.to; draw(); }

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
      none: hex(v('--heat-none', '#DDE3EC')), seqLo: hex(v('--heat-seq-lo', '#DCE6F2')), seqHi: hex(v('--heat-seq-hi', '#0F3A6B')),
      line: v('--surface', '#FFFFFF'), ink: v('--ink', '#0E1E33'),
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

  /* --- evolución en el tiempo (dentro de la tarjeta del cursor) --- */
  function sparkline(iso) {
    const arr = serieOf(iso, metric.key);
    if (!arr) return null;
    const pts = [];
    arr.forEach((v, i) => { if (v !== null && v !== undefined) pts.push([series.from + i, v]); });
    if (pts.length < 3) return null;
    const W = 216;
    const H = 58;
    const pad = 4;
    const [y0, y1] = [pts[0][0], pts[pts.length - 1][0]];
    let lo = Math.min(...pts.map((p) => p[1]));
    let hi = Math.max(...pts.map((p) => p[1]));
    if (lo === hi) { lo -= 1; hi += 1; }
    const sx = (yr) => pad + ((yr - y0) / Math.max(1, y1 - y0)) * (W - pad * 2);
    const sy = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - pad * 2);
    let d = '';
    let prev = null;
    for (const [yr, v] of pts) {
      d += `${prev !== null && yr - prev === 1 ? 'L' : 'M'}${sx(yr).toFixed(1)} ${sy(v).toFixed(1)}`;
      prev = yr;
    }
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'heat-spark');
    svg.setAttribute('aria-hidden', 'true');
    const add = (tag, attrs) => { const n = document.createElementNS(SVG_NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); svg.append(n); return n; };
    if (lo < 0 && hi > 0) add('line', { x1: pad, x2: W - pad, y1: sy(0).toFixed(1), y2: sy(0).toFixed(1), class: 'zero' });
    add('path', { d, class: 'line' });
    const [lx, lv] = [pts[pts.length - 1][0], pts[pts.length - 1][1]];
    add('circle', { cx: sx(lx).toFixed(1), cy: sy(lv).toFixed(1), r: 3, class: 'last' });
    return el('div', { class: 'heat-spark-wrap' }, [
      svg,
      el('div', { class: 'heat-spark-axis num' }, [el('span', {}, String(y0)), el('span', {}, `${metric.fmt(lo)} a ${metric.fmt(hi)}`), el('span', {}, String(y1))]),
    ]);
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

  let shownIso = null;
  function showTip(hit) {
    if (!hit.iso) { tip.hidden = true; shownIso = null; return; }
    const r = ranking.get(hit.iso);
    if (shownIso !== `${hit.iso}:${metric.key}`) { // el contenido solo se reconstruye al cambiar de país o indicador
      shownIso = `${hit.iso}:${metric.key}`;
      tip.replaceChildren(
        el('span', { class: 'label' }, nameOf(hit.iso)),
        r
          ? el('div', { class: 'heat-tip-main' }, [
            el('span', { class: 'num heat-tip-value' }, metric.fmt(r.value)),
            el('span', { class: 'heat-tip-dot', style: `background:${rgb(targetColor(hit.iso))}` }),
          ])
          : el('span', { class: 'heat-tip-none' }, 'Sin dato disponible'),
        r ? el('span', { class: 'num heat-tip-line' }, `Puesto ${r.rank} de ${r.total} · dato ${r.year}`) : null,
        el('span', { class: 'heat-tip-line' }, `${metric.title}: evolución anual`),
        sparkline(hit.iso),
      );
    }
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
  // Clic (o toque) en un país: se abre su ficha de análisis
  map.addEventListener('click', (e) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (hit.iso) openCountry(hit.iso);
  });
  map.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return; // en celular la tarjeta queda hasta tocar otra vez
    hover = null; tip.hidden = true; shownIso = null; draw();
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
    const stops = metric.seq ? [colors.seqLo, colors.seqHi] : [colors.bad, colors.mid, colors.good];
    legendBar.style.background = `linear-gradient(90deg, ${stops.map(rgb).join(', ')})`;
    [legendLo.textContent, legendHi.textContent] = metric.ends;
    legendWorst.textContent = metric.worst;
    legendMid.textContent = metric.mid;
    legendBest.textContent = metric.best;
    how.textContent = `${metric.title} (${metric.unit}). ${metric.how}`;
    canvas.setAttribute('aria-label', `Mapa de calor mundial: ${metric.title}. ${metric.seq ? 'Más oscuro es más peso.' : 'Rojo es peor, verde es mejor.'} Los datos están en el CSV descargable.`);
  }

  function setMetric(m) {
    metric = m;
    tabs.forEach((b, i) => b.setAttribute('aria-pressed', METRICS[i] === m ? 'true' : 'false'));
    ranking = buildRanking(metric);
    renderLegend();
    renderRefs();
    retarget(260);
    shownIso = null;
    if (hover && lastHit) showTip(lastHit); // la tarjeta abierta se actualiza con el nuevo indicador
  }

  function downloadActive() {
    const cell = (v) => String(Number(v.toFixed(4))).replace('.', ',');
    const rows = [...ranking.values()].map((r) => `${nameOf(r.iso).replace(/;/g, ',')};${r.iso};${cell(r.value)};${r.year};${r.rank}`);
    downloadCsv(`mapa-${metric.key}.csv`, ['País;Código;Valor;Año;Puesto', ...rows].join('\r\n'));
  }

  /* ---------- comparador de países ---------- */

  function buildCompare() {
    const cm = METRICS.filter((m) => COMPARABLE.includes(m.key));
    let cmetric = cm[0];
    let isoA = 'ARG';
    let isoB = 'USA';
    let chart = null;
    const available = Object.keys(world.countries)
      .filter((iso) => byIso.has(iso) && COMPARABLE.some((k) => serieOf(iso, k)))
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'es'));
    if (!available.includes(isoA)) isoA = available[0];
    if (!available.includes(isoB)) isoB = available[1] ?? available[0];

    const select = (label, value, onChange) => {
      const s = el('select', { class: 'cmp-select', 'aria-label': label }, available.map((iso) => el('option', { value: iso }, nameOf(iso))));
      s.value = value;
      s.addEventListener('change', () => onChange(s.value));
      return s;
    };
    const selA = select('País 1', isoA, (v) => { isoA = v; update(); });
    const selB = select('País 2', isoB, (v) => { isoB = v; update(); });
    const pills = cm.map((m) => {
      const b = el('button', { class: 'pill', type: 'button', 'aria-pressed': m === cmetric ? 'true' : 'false' }, m.tab);
      b.addEventListener('click', () => { cmetric = m; pills.forEach((p, i) => p.setAttribute('aria-pressed', cm[i] === m ? 'true' : 'false')); update(); });
      return b;
    });
    const canvasC = el('canvas', { 'aria-label': 'Gráfico comparativo de dos países', role: 'img' });
    const box = el('div', { class: 'chart-box cmp-chart' }, canvasC);
    const empty = el('p', { class: 'cmp-empty', hidden: true });
    const summary = el('div', { class: 'cmp-summary' });

    const node = el('section', { class: 'cmp', 'aria-label': 'Comparar países' }, [
      el('div', { class: 'cmp-head' }, [el('h2', {}, 'Comparar países'), el('span', { class: 'label' }, 'Elegí dos y un indicador')]),
      el('div', { class: 'cmp-controls' }, [
        el('label', {}, [el('span', { class: 'cmp-dot a' }), selA]),
        el('label', {}, [el('span', { class: 'cmp-dot b' }), selB]),
      ]),
      el('div', { class: 'heat-tabs cmp-tabs', role: 'group', 'aria-label': 'Indicador a comparar' }, pills),
      box,
      empty,
      summary,
    ]);

    const pointsOf = (iso) => {
      const arr = serieOf(iso, cmetric.key);
      if (!arr) return [];
      const out = [];
      arr.forEach((v, i) => { if (v !== null && v !== undefined) out.push([`${series.from + i}-01-01`, v]); });
      return out;
    };

    function update() {
      const rk = buildRanking(cmetric);
      const sel = [[isoA, '--ar'], [isoB, '--us']];
      const data = { byId: {} };
      const datasets = [];
      sel.forEach(([iso, color], i) => {
        const pts = pointsOf(iso);
        if (pts.length) {
          data.byId[`c${i}`] = { id: `c${i}`, freq: 'A', points: pts };
          datasets.push({ ref: { id: `c${i}` }, label: nameOf(iso), color, type: 'line', decimals: cmetric.decimals });
        }
      });
      summary.replaceChildren(...sel.map(([iso], i) => {
        const r = rk.get(iso);
        return el('div', { class: 'cmp-card' }, [
          el('span', { class: `cmp-dot ${i ? 'b' : 'a'}` }),
          el('b', {}, nameOf(iso)),
          el('span', { class: 'num' }, r ? `${cmetric.fmt(r.value)} (${r.year}) · puesto ${r.rank} de ${r.total}` : 'sin dato'),
        ]);
      }));
      if (!datasets.length || !series) {
        if (chart) { chart.destroy(); chart = null; }
        box.hidden = true;
        empty.hidden = false;
        empty.textContent = `No hay datos de ${cmetric.title.toLowerCase()} para estos países.`;
        return;
      }
      box.hidden = false;
      empty.hidden = true;
      const missing = sel.filter(([iso]) => !data.byId[`c${sel.findIndex((s) => s[0] === iso)}`]).map(([iso]) => nameOf(iso));
      empty.hidden = !missing.length;
      if (missing.length) empty.textContent = `Sin serie de ${cmetric.title.toLowerCase()} para ${missing.join(' y ')}.`;
      chart = drawChart(canvasC, data, { unit: cmetric.short, datasets }, 0, chart);
    }
    /** Elige los dos países (si no se pasan, se conservan) y redibuja */
    function set(a, b) {
      if (a && available.includes(a)) { isoA = a; selA.value = a; }
      if (b && available.includes(b)) { isoB = b; selB.value = b; }
      update();
    }
    return { node, update, set };
  }

  /* ---------- diálogos: comparador y ficha de país ---------- */

  /** Crea un diálogo modal con el mismo estilo que la vista ampliada de los gráficos */
  function makeDialog(label, content, onClose) {
    const close = el('button', { class: 'pill dlg-close', type: 'button' }, 'Cerrar');
    const dialog = el('dialog', { class: 'focus heat-dialog', 'aria-label': label }, el('div', { class: 'focus-body' }, [close, content]));
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => { onClose?.(); });
    document.body.append(dialog);
    return dialog;
  }

  let compareDialog = null;
  function openCompare(a, b) {
    if (!compareDialog) compareDialog = makeDialog('Comparar países', cmp.node);
    if (!compareDialog.open) compareDialog.showModal();
    // con el diálogo ya visible el gráfico toma su tamaño; si se abre desde un país, ese país queda como primero
    const other = a === 'ARG' ? 'USA' : 'ARG';
    cmp.set(a, a ? (b ?? other) : undefined);
  }

  function openCountry(iso) {
    const info = world.countries[iso];
    if (!info || !METRICS.some((m) => info[m.key])) return;
    const charts = [];
    const name = nameOf(iso);
    const stats = METRICS.map((m) => {
      const r = buildRanking(m).get(iso);
      return el('div', { class: 'cd-row' }, [
        el('span', { class: 'cd-name' }, m.title),
        r ? el('b', { class: 'num cd-val' }, m.fmt(r.value)) : el('b', { class: 'cd-val' }, 's/d'),
        el('span', { class: 'num cd-rank' }, r ? `puesto ${r.rank} de ${r.total} · dato ${r.year}` : 'sin dato'),
      ]);
    });
    const boxes = METRICS.filter((m) => serieOf(iso, m.key)).map((m) => {
      const canvasC = el('canvas', { role: 'img', 'aria-label': `${m.title} de ${name}, serie anual` });
      return { m, canvasC, node: el('figure', { class: 'cd-fig' }, [el('figcaption', {}, [el('b', {}, m.title), el('span', {}, m.unit)]), el('div', { class: 'chart-box cd-chart' }, canvasC)]) };
    });
    const compare = el('button', { class: 'heat-compare', type: 'button' }, 'Comparar con otro país');
    const content = el('div', { class: 'cd' }, [
      el('div', { class: 'focus-head' }, [el('div', {}, [el('span', { class: 'label' }, 'Análisis por país'), el('h2', {}, name), el('p', { class: 'unit' }, `Último dato anual disponible de cada indicador y su evolución desde ${series?.from ?? 2000}. Fuente: Banco Mundial.`)])]),
      el('div', { class: 'cd-stats' }, stats),
      el('div', { class: 'cd-grid' }, boxes.map((b) => b.node)),
      el('div', { class: 'cd-actions' }, [compare]),
    ]);
    const dialog = makeDialog(`Análisis de ${name}`, content, () => { charts.forEach((c) => c?.destroy()); dialog.remove(); });
    compare.addEventListener('click', () => { dialog.close(); openCompare(iso); });
    dialog.showModal();
    boxes.forEach(({ m, canvasC }) => {
      const pts = [];
      serieOf(iso, m.key).forEach((v, i) => { if (v !== null && v !== undefined) pts.push([`${series.from + i}-01-01`, v]); });
      const data = { byId: { s: { id: 's', freq: 'A', points: pts } } };
      const spec = { unit: m.short, datasets: [{ ref: { id: 's' }, label: name, color: '--ar', type: m.key === 'gdp' ? 'bar' : 'line', fill: m.key !== 'gdp', signColors: m.key === 'gdp', decimals: m.decimals }] };
      try { charts.push(drawChart(canvasC, data, spec, 0, null)); } catch (err) { console.warn('Gráfico no disponible', err); }
    });
  }

  /* --- arranque --- */
  readColors();
  ranking = buildRanking(metric);
  renderLegend();
  renderRefs();
  new ResizeObserver(() => { if (map.clientWidth !== w) resize(); }).observe(map);
  resize();
  retarget(900); // entrada: los colores aparecen de oeste a este
}
