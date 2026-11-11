/**
 * heatmap.js — portada: mapa mundial con capas por variable, slider de años y gráfico por país.
 *
 * - Variables agrupadas por categoría (Actividad, Precios y monetario, Fiscal, Externo, Social). Cada una tiene su
 *   escala FIJA para todos los años (así los colores se comparan en el tiempo):
 *     · con signo (crecimiento, resultado fiscal, cuenta corriente): divergente centrada en 0 (rojo < 0 < verde)
 *     · de nivel: secuencial de un solo tono (azul), lineal; las muy asimétricas, logarítmica o por intervalos
 * - Datos: data/mapa/index.json (variables, años y frecuencias disponibles) y data/mapa/<variable>.json (serie anual
 *   de cada país), que se cargan recién cuando se elige la variable y quedan en memoria. Las series mensuales o
 *   trimestrales de un país (data/mapa/pais/<ISO3>.json) se cargan al abrir su gráfico. Los genera
 *   tools/fetch-mapa.py. Sin proyecciones: solo años con datos efectivos.
 * - Slider de años con "Reproducir" (pausa y velocidad). Un país sin dato en ese año queda gris.
 * - Al pasar el mouse: valor, año, puesto y evolución. Clic en un país: panel con el gráfico de ESA variable
 *   (frecuencia y rango propios, línea en el año del slider, "Comparar con…"). Si se cambia de variable con el panel
 *   abierto, el gráfico se actualiza.
 * - Argentina y EE.UU. quedan remarcadas, con su valor y puesto debajo del mapa.
 * Para sumar una variable: agregarla en tools/fetch-mapa.py y una entrada en METRICS.
 */
import { el } from './dom.js';
import { fmtNum, fmtSigned, fmtDate } from '../lib/format.js';
import { downloadCsv } from '../lib/csv.js';

const LAT_TOP = 84;
const LAT_BOTTOM = -58;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const HIGHLIGHT = { ARG: 'Argentina', USA: 'EE.UU.' };
const SVG_NS = 'http://www.w3.org/2000/svg';
const FREQ_LABEL = { M: 'Mensual', Q: 'Trimestral', A: 'Anual' };
const RANGES = [[10, '10A'], [30, '30A'], [0, 'Máx']];

/* ---------- variables ---------- */

/** Distancia a la zona de inflación "sana" (1–3 %): por debajo cuenta 1,5 veces porque la deflación también preocupa */
const inflDist = (v) => Math.max(0, (v >= 2 ? v - 2 : (2 - v) * 1.5) - 1);
const pct = (d) => (v) => `${fmtNum(v, d)}%`;
const spct = (d) => (v) => `${fmtSigned(v, d)}%`;

const GROUPS = ['Actividad', 'Precios y monetario', 'Fiscal', 'Externo', 'Social'];

/**
 * scale: { type: 'div', max }            divergente centrada en 0, satura en ±max
 *        { type: 'lin', min, max }       secuencial lineal
 *        { type: 'log', min, max }       secuencial logarítmica
 *        { type: 'bins', edges, labels } secuencial por intervalos (edges: límites inferiores, ascendentes)
 * rank: orden del puesto (mayor primero); rankText aclara qué significa el puesto 1.
 * freqs: frecuencias del gráfico del país (el mapa siempre es anual).
 */
const METRICS = [
  {
    key: 'gdp', group: 'Actividad', tab: 'Crecimiento real', title: 'Crecimiento real del PBI', short: '% anual', decimals: 1,
    fmt: spct(1), scale: { type: 'div', max: 8 }, ends: ['Cae', 'Crece'],
    rank: (v) => v, rankText: 'de mayor a menor crecimiento', freqs: ['Q', 'A'], chart: 'bar',
    how: 'Variación anual del PBI a precios constantes. Rojo: la economía se achicó; verde: creció.',
  },
  {
    key: 'share', group: 'Actividad', tab: 'Peso en el PBI mundial', title: 'Peso en el PBI mundial', short: '% del PBI mundial', decimals: 2,
    fmt: (v) => `${fmtNum(v, v >= 10 ? 1 : 2)}%`, scale: { type: 'log', min: 0.01, max: 25 }, ends: ['Menos peso', 'Más peso'],
    rank: (v) => v, rankText: 'de mayor a menor peso', freqs: ['A'],
    how: 'PBI en dólares corrientes del país sobre el PBI mundial. No indica mejor ni peor: más oscuro, más participación.',
  },
  {
    key: 'gdppc', group: 'Actividad', tab: 'PBI per cápita', title: 'PBI per cápita (PPA)', short: 'US$ int. de 2011', decimals: 0,
    fmt: (v) => `US$ ${fmtNum(v, 0)}`, scale: { type: 'log', min: 500, max: 80000 }, ends: ['Menor', 'Mayor'],
    rank: (v) => v, rankText: 'de mayor a menor ingreso por habitante', freqs: ['A'],
    how: 'Producción por habitante en dólares internacionales de 2011, a paridad de poder de compra: compara niveles de vida entre países y épocas.',
  },
  {
    key: 'infl', group: 'Precios y monetario', tab: 'Inflación', title: 'Inflación', short: '% anual', decimals: 1,
    fmt: pct(1),
    scale: { type: 'bins', edges: [-Infinity, 0, 2, 5, 10, 20, 50, 100, 1000], labels: ['< 0', '0–2', '2–5', '5–10', '10–20', '20–50', '50–100', '100–1.000', '> 1.000'] },
    ends: ['Baja', 'Alta'],
    rank: (v) => -inflDist(v) - v / 1e4, rankText: 'de mejor a peor (lo mejor es entre 1% y 3%)', freqs: ['M', 'A'],
    how: 'Promedio anual de precios al consumidor. Por intervalos, porque va de la deflación a la hiperinflación.',
  },
  {
    key: 'rate', group: 'Precios y monetario', tab: 'Tasa de política', title: 'Tasa de política monetaria', short: '% anual', decimals: 2,
    fmt: pct(2),
    scale: { type: 'bins', edges: [-Infinity, 0.5, 2, 4, 6, 10, 20, 40], labels: ['< 0,5', '0,5–2', '2–4', '4–6', '6–10', '10–20', '20–40', '> 40'] },
    ends: ['Baja', 'Alta'],
    rank: (v) => v, rankText: 'de mayor a menor tasa', freqs: ['M', 'A'],
    how: 'Tasa que fija el banco central. Dato anual: fin de período (diciembre). Zona euro: tasa del BCE desde el ingreso de cada país.',
  },
  {
    key: 'debt', group: 'Fiscal', tab: 'Deuda / PBI', title: 'Deuda pública', short: '% del PBI', decimals: 1,
    fmt: pct(1), scale: { type: 'lin', min: 0, max: 150 }, ends: ['Menos deuda', 'Más deuda'],
    rank: (v) => v, rankText: 'de mayor a menor deuda', freqs: ['A'],
    how: 'Deuda bruta del gobierno sobre el PBI. La escala satura en 150%.',
  },
  {
    key: 'fiscal', group: 'Fiscal', tab: 'Resultado fiscal / PBI', title: 'Resultado fiscal', short: '% del PBI', decimals: 1,
    fmt: spct(1), scale: { type: 'div', max: 8 }, ends: ['Déficit', 'Superávit'],
    rank: (v) => v, rankText: 'de mayor superávit a mayor déficit', freqs: ['A'],
    how: 'Préstamo neto (+) o endeudamiento neto (−) del gobierno general, sobre el PBI. Incluye intereses.',
  },
  {
    key: 'ca', group: 'Externo', tab: 'Cuenta corriente / PBI', title: 'Cuenta corriente', short: '% del PBI', decimals: 1,
    fmt: spct(1), scale: { type: 'div', max: 10 }, ends: ['Déficit', 'Superávit'],
    rank: (v) => v, rankText: 'de mayor superávit a mayor déficit', freqs: ['A'],
    how: 'Saldo de comercio, rentas y transferencias con el resto del mundo, sobre el PBI. Déficit: el país necesita financiamiento externo.',
  },
  {
    key: 'open', group: 'Externo', tab: 'Apertura comercial', title: 'Apertura comercial', short: '(X+M) / PBI', decimals: 1,
    fmt: pct(1), scale: { type: 'lin', min: 0, max: 150 }, ends: ['Más cerrada', 'Más abierta'],
    rank: (v) => v, rankText: 'de más a menos abierta', freqs: ['A'],
    how: 'Exportaciones más importaciones sobre el PBI. La escala satura en 150% (algunos centros comerciales superan el 300%).',
  },
  {
    key: 'unemp', group: 'Social', tab: 'Desempleo', title: 'Desempleo', short: '% de la fuerza laboral', decimals: 1,
    fmt: pct(1), scale: { type: 'lin', min: 0, max: 25 }, ends: ['Menos', 'Más'],
    rank: (v) => -v, rankText: 'de menor a mayor desempleo', freqs: ['Q', 'A'],
    how: 'Personas que buscan trabajo y no consiguen, sobre la fuerza laboral. La escala satura en 25%.',
  },
  {
    key: 'pop', group: 'Social', tab: 'Población', title: 'Población', short: 'millones', decimals: 1,
    fmt: (v) => `${fmtNum(v, v >= 100 ? 0 : v >= 1 ? 1 : 2)} M`, scale: { type: 'log', min: 0.1, max: 1500 }, ends: ['Menos', 'Más'],
    rank: (v) => v, rankText: 'de más a menos habitantes', freqs: ['A'],
    how: 'Habitantes, en millones. Escala logarítmica: China e India tienen más de mil veces la población de los países chicos.',
  },
  {
    key: 'gini', group: 'Social', tab: 'Gini', title: 'Desigualdad (Gini)', short: 'índice 0–100', decimals: 1,
    fmt: (v) => fmtNum(v, 1), scale: { type: 'lin', min: 25, max: 60 }, ends: ['Más igual', 'Más desigual'],
    rank: (v) => -v, rankText: 'de menos a más desigual', freqs: ['A'],
    how: '0 es igualdad total de ingresos (o consumo) y 100, desigualdad máxima. Muchos países no lo miden todos los años: esos años quedan grises.',
  },
  {
    key: 'hdi', group: 'Social', tab: 'IDH', title: 'Índice de Desarrollo Humano', short: 'índice 0–1', decimals: 3,
    fmt: (v) => fmtNum(v, 3), scale: { type: 'lin', min: 0.35, max: 0.95 }, ends: ['Bajo', 'Alto'],
    rank: (v) => v, rankText: 'de mayor a menor desarrollo', freqs: ['A'],
    how: 'Combina esperanza de vida, educación e ingreso por habitante (PNUD).',
  },
];

/** Fuente de cada serie de alta frecuencia del gráfico del país */
const HF_SOURCE = {
  infl: 'FMI, Consumer Price Index (IPC total; variaciones calculadas por el FMI)',
  rate: 'BIS, tasas de política (WS_CBPOL), fin de mes',
  unemp: 'FMI, Labor Statistics (tasa de desocupación)',
  gdp: 'Cálculo propio sobre FMI, Quarterly National Accounts (PBI real, var. % interanual)',
};

/* ---------- colores ---------- */

const hex = (s) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(s).trim());
  const n = m ? parseInt(m[1], 16) : 0xdde3ec;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const ease = (t) => 1 - (1 - t) ** 3;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Posición del valor en la escala: −1…1 (divergente) o 0…1 (secuencial) */
function position(scale, v) {
  switch (scale.type) {
    case 'div': return Math.max(-1, Math.min(1, v / scale.max));
    case 'log': return clamp01((Math.log10(Math.max(v, scale.min / 10)) - Math.log10(scale.min)) / (Math.log10(scale.max) - Math.log10(scale.min)));
    case 'bins': {
      let i = 0;
      while (i + 1 < scale.edges.length && v >= scale.edges[i + 1]) i += 1;
      return i / (scale.edges.length - 1);
    }
    default: return clamp01((v - scale.min) / (scale.max - scale.min));
  }
}

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

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return res.json();
}

/**
 * @param {HTMLElement} root contenedor de la portada
 * @param {{shapes:object, index:object}} data formas por país (ISO3) e índice de data/mapa
 */
export function mountHeatmap(root, { shapes, index }) {
  const metrics = METRICS.filter((m) => index.vars?.[m.key]);
  const countries = Object.keys(shapes).map((iso) => {
    const rings = shapes[iso];
    let x0 = 180; let x1 = -180; let y0 = 90; let y1 = -90;
    for (const r of rings) for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]); }
    return { iso, rings, box: [x0, y0, x1, y1], lon: (x0 + x1) / 2, path: null };
  });
  const byIso = new Map(countries.map((c) => [c.iso, c]));
  const names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['es'], { type: 'region' }) : null;
  const nameOf = (iso) => {
    if (iso === 'WLD') return 'Mundo';
    const code = index.iso2?.[iso];
    try { return (code && names?.of(code)) || HIGHLIGHT[iso] || iso; } catch { return HIGHLIGHT[iso] || iso; }
  };

  /* --- datos: una variable por archivo, cargada a pedido y guardada en memoria --- */
  const cache = new Map();
  const loadVar = (key) => {
    if (!cache.has(key)) cache.set(key, getJson(`data/mapa/${key}.json`).catch((err) => { cache.delete(key); throw err; }));
    return cache.get(key);
  };
  const hfCache = new Map();
  const loadHf = (iso) => {
    if (!hfCache.has(iso)) hfCache.set(iso, getJson(`data/mapa/pais/${iso}.json`).catch(() => null));
    return hfCache.get(iso);
  };
  const valueAt = (vd, iso, y) => {
    const a = vd?.c?.[iso];
    if (!a || y < vd.from || y > vd.to) return null;
    const v = a[y - vd.from];
    return v === undefined ? null : v;
  };
  const sourceAt = (vd, iso, y) => {
    const seg = vd?.seg?.[iso];
    if (!seg) return Object.values(vd?.sources ?? {})[0] ?? '';
    let code = seg[0][1];
    for (const [from, c] of seg) if (y >= from) code = c;
    return vd.sources[code] ?? '';
  };

  let metric = metrics[0];
  let vdata = null; // datos de la variable activa
  let year = null;
  let hover = null;
  let ranking = new Map(); // iso -> { value, rank, total }
  let colors = {
    bad: hex('#B3372F'), neutral: hex('#F3EFE6'), good: hex('#1E7F5C'), none: hex('#DDE3EC'),
    seqLo: hex('#DCE6F2'), seqHi: hex('#0F3A6B'), line: '#FFFFFF', ink: '#0E1E33',
  };

  /* --- DOM: selector agrupado --- */
  let group = metric.group;
  const groupBtns = GROUPS.filter((g) => metrics.some((m) => m.group === g)).map((g) => {
    const b = el('button', { class: 'pill', type: 'button', 'aria-pressed': String(g === group) }, g);
    b.addEventListener('click', () => {
      if (group === g) return;
      group = g;
      renderGroups();
      setMetric(metrics.find((m) => m.group === g));
    });
    return { g, b };
  });
  const varRow = el('div', { class: 'heat-tabs mapa-vars', role: 'group', 'aria-label': 'Variable' });
  function renderGroups() {
    groupBtns.forEach(({ g, b }) => b.setAttribute('aria-pressed', String(g === group)));
    varRow.replaceChildren(...metrics.filter((m) => m.group === group).map((m) => {
      const b = el('button', { class: 'pill', type: 'button', 'aria-pressed': String(m === metric) }, m.tab);
      b.addEventListener('click', () => setMetric(m));
      return b;
    }));
  }

  /* --- DOM: slider de años --- */
  const yearBig = el('span', { class: 'mapa-year num', 'aria-live': 'polite' }, '');
  const slider = el('input', { type: 'range', class: 'mapa-slider', min: 0, max: 0, step: 1, 'aria-label': 'Año' });
  const yearMin = el('span', { class: 'num mapa-yr-edge' });
  const yearMax = el('span', { class: 'num mapa-yr-edge' });
  const playBtn = el('button', { class: 'pill mapa-play', type: 'button', 'aria-pressed': 'false', title: 'Reproducir año por año' }, '▶ Reproducir');
  const speedSel = el('select', { class: 'cmp-select mapa-speed', 'aria-label': 'Velocidad' }, [
    el('option', { value: '1400' }, 'Lento'), el('option', { value: '700', selected: true }, 'Normal'), el('option', { value: '300' }, 'Rápido'),
  ]);
  slider.addEventListener('input', () => { stopPlay(); setYear(Number(slider.value)); });
  playBtn.addEventListener('click', () => (timer ? stopPlay() : startPlay()));
  speedSel.addEventListener('change', () => { if (timer) { stopPlay(); startPlay(); } });

  /* --- DOM: mapa y pie --- */
  const canvas = el('canvas', { class: 'heat-canvas', role: 'img' });
  const tip = el('div', { class: 'heat-tip', hidden: true, 'aria-hidden': 'true' });
  const loading = el('div', { class: 'mapa-loading', hidden: true }, 'Cargando datos…');
  const map = el('div', { class: 'heat-map' }, [canvas, tip, loading]);
  const refs = el('div', { class: 'heat-refs', 'aria-live': 'polite' });
  const how = el('p', { class: 'heat-how' });
  const srcLine = el('span', { class: 'src-line' });
  const csvBtn = el('button', { class: 'csv-btn', type: 'button' }, 'Descargar CSV');
  csvBtn.addEventListener('click', downloadActive);
  const legendTitle = el('span', { class: 'label mapa-legend-title' });
  const legendBody = el('div', { class: 'mapa-legend-body' });
  const compareBtn = el('button', { class: 'heat-compare', type: 'button' }, 'Comparar países');
  compareBtn.addEventListener('click', () => openPanel(panel.iso ?? 'ARG', panel.iso ? undefined : 'USA'));
  const panelBox = el('aside', { class: 'mapa-panel', hidden: true, 'aria-label': 'Gráfico del país' });

  root.replaceChildren(
    el('div', { class: 'heat-head' }, [
      el('div', {}, [
        el('span', { class: 'label' }, 'Mapa macro mundial'),
        el('h1', {}, 'Cómo está cada economía'),
        el('p', {}, 'Elegí una variable y un año, o tocá Reproducir para ver cómo cambió el mundo. Pasá el mouse por un país para ver el dato y su puesto; hacé clic para ver su evolución.'),
      ]),
      el('div', { class: 'heat-controls mapa-controls' }, [
        el('div', { class: 'heat-tabs mapa-groups', role: 'group', 'aria-label': 'Categoría' }, groupBtns.map((x) => x.b)),
        varRow,
        compareBtn,
      ]),
    ]),
    el('div', { class: 'mapa-time' }, [yearBig, el('div', { class: 'mapa-track' }, [yearMin, slider, yearMax]), el('div', { class: 'mapa-play-box' }, [playBtn, speedSel])]),
    el('div', { class: 'mapa-body' }, [el('div', { class: 'heat-scroll' }, [map]), panelBox]),
    el('div', { class: 'heat-lower' }, [
      el('div', { class: 'heat-info' }, [
        el('div', { class: 'heat-legend mapa-legend' }, [legendTitle, legendBody]),
        refs,
        el('div', { class: 'heat-foot' }, [
          how,
          el('span', { class: 'src-line' }, [srcLine, ' ', csvBtn]),
          el('span', {}, 'Sin proyecciones: solo años con datos efectivos. Gris: sin datos para ese año. El mapa usa las fronteras actuales; para países que no existían (ex URSS, ex Yugoslavia, Sudán del Sur, etc.) solo hay dato si la fuente lo reconstruye.'),
        ]),
      ]),
    ]),
  );
  renderGroups();

  /* --- puestos del año elegido --- */
  function buildRanking() {
    const list = [];
    if (vdata) {
      for (const c of countries) {
        const v = valueAt(vdata, c.iso, year);
        if (v !== null) list.push({ iso: c.iso, value: v, k: metric.rank(v) });
      }
    }
    list.sort((a, b) => b.k - a.k);
    return new Map(list.map((r, i) => [r.iso, { ...r, rank: i + 1, total: list.length }]));
  }

  /* --- colores animados --- */
  const state = new Map(countries.map((c) => [c.iso, { cur: colors.none, from: colors.none, to: colors.none, t0: 0, delay: 0, dur: 520 }]));
  let animating = false;
  const colorFor = (v) => {
    const p = position(metric.scale, v);
    if (metric.scale.type === 'div') return p < 0 ? mix(colors.neutral, colors.bad, -p) : mix(colors.neutral, colors.good, p);
    return mix(colors.seqLo, colors.seqHi, p);
  };
  const targetColor = (iso) => {
    const r = ranking.get(iso);
    return r ? colorFor(r.value) : colors.none;
  };

  function retarget(spread, dur = 520) {
    const now = performance.now();
    for (const c of countries) {
      const s = state.get(c.iso);
      s.from = s.cur;
      s.to = targetColor(c.iso);
      s.t0 = now;
      s.dur = dur;
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
      const t = Math.min(1, Math.max(0, (now - s.t0 - s.delay) / s.dur));
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
      bad: hex(v('--bad', '#B3372F')), neutral: hex(v('--heat-neutral', '#F3EFE6')), good: hex(v('--good', '#1E7F5C')),
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
    // Argentina y EE.UU. remarcadas; el país bajo el cursor y el del panel, un poco más
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1.4;
    for (const iso of Object.keys(HIGHLIGHT)) { const c = byIso.get(iso); if (c) ctx.stroke(c.path); }
    ctx.lineWidth = 1.8;
    for (const iso of new Set([hover, panel.iso])) if (iso && !HIGHLIGHT[iso] && byIso.has(iso)) ctx.stroke(byIso.get(iso).path);
  }

  /* --- evolución en el tiempo (dentro de la tarjeta del cursor) --- */
  function sparkline(iso) {
    const arr = vdata?.c?.[iso];
    if (!arr) return null;
    const pts = [];
    arr.forEach((v, i) => { if (v !== null && v !== undefined) pts.push([vdata.from + i, v]); });
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
    if (year >= y0 && year <= y1) add('line', { x1: sx(year).toFixed(1), x2: sx(year).toFixed(1), y1: pad, y2: H - pad, class: 'zero' });
    add('path', { d, class: 'line' });
    const cur = valueAt(vdata, iso, year);
    const [lx, lv] = cur !== null ? [year, cur] : pts[pts.length - 1];
    add('circle', { cx: sx(lx).toFixed(1), cy: sy(lv).toFixed(1), r: 3, class: 'last' });
    return el('div', { class: 'heat-spark-wrap' }, [
      svg,
      el('div', { class: 'heat-spark-axis num' }, [el('span', {}, String(y0)), el('span', {}, `${metric.fmt(lo)} a ${metric.fmt(hi)}`), el('span', {}, String(y1))]),
    ]);
  }

  /* --- interacción con el mapa --- */
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
    const sig = `${hit.iso}:${metric.key}:${year}`;
    if (shownIso !== sig) { // el contenido solo se reconstruye al cambiar de país, variable o año
      shownIso = sig;
      tip.replaceChildren(
        el('span', { class: 'label' }, nameOf(hit.iso)),
        r
          ? el('div', { class: 'heat-tip-main' }, [
            el('span', { class: 'num heat-tip-value' }, metric.fmt(r.value)),
            el('span', { class: 'heat-tip-dot', style: `background:${rgb(targetColor(hit.iso))}` }),
          ])
          : el('span', { class: 'heat-tip-none' }, `Sin datos en ${year}`),
        r ? el('span', { class: 'num heat-tip-line' }, `${year} · puesto ${r.rank} de ${r.total}`) : null,
        el('span', { class: 'heat-tip-line' }, `${metric.title}: evolución anual · clic para ver el gráfico`),
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
  map.addEventListener('click', (e) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (hit.iso) openPanel(hit.iso);
  });
  map.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return; // en celular la tarjeta queda hasta tocar otra vez
    hover = null; tip.hidden = true; shownIso = null; draw();
  });

  /* --- leyenda, referencias y pie --- */
  function renderLegend() {
    const sc = metric.scale;
    legendTitle.textContent = `${metric.title} · ${metric.short} · ${year ?? ''}`;
    if (sc.type === 'bins') {
      const n = sc.edges.length;
      legendBody.replaceChildren(el('div', { class: 'mapa-bins' }, sc.labels.map((label, i) => el('span', { class: 'mapa-bin' }, [
        el('i', { style: `background:${rgb(mix(colors.seqLo, colors.seqHi, i / (n - 1)))}` }),
        el('span', { class: 'num' }, label),
      ]))));
    } else {
      const stops = sc.type === 'div' ? [colors.bad, colors.neutral, colors.good] : [colors.seqLo, colors.seqHi];
      const bar = el('div', { class: 'heat-bar', 'aria-hidden': 'true', style: `background:linear-gradient(90deg, ${stops.map(rgb).join(', ')})` });
      let ticks;
      if (sc.type === 'div') ticks = [`${metric.fmt(-sc.max)} o menos`, '0', `${metric.fmt(sc.max)} o más`];
      else if (sc.type === 'log') ticks = [`${metric.fmt(sc.min)} o menos`, `${metric.fmt(Math.sqrt(sc.min * sc.max))} (escala log.)`, `${metric.fmt(sc.max)} o más`];
      else ticks = [metric.fmt(sc.min), metric.fmt((sc.min + sc.max) / 2), `${metric.fmt(sc.max)} o más`];
      legendBody.replaceChildren(
        el('div', { class: 'heat-scale' }, [el('span', { class: 'label' }, metric.ends[0]), bar, el('span', { class: 'label' }, metric.ends[1])]),
        el('div', { class: 'heat-ends' }, ticks.map((t) => el('span', { class: 'num' }, t))),
      );
    }
    how.textContent = `${metric.title} (${metric.short}). ${metric.how} Puesto: ${metric.rankText}.`;
    const srcs = vdata ? Object.values(vdata.sources).join(' · ') : '';
    srcLine.textContent = vdata ? `Fuente: ${srcs}. Dato de ${year}. Actualizado ${vdata.updated}.` : '';
    canvas.setAttribute('aria-label', `Mapa mundial: ${metric.title}, ${year}. Los datos están en el CSV descargable.`);
  }

  function renderRefs() {
    refs.replaceChildren(...Object.entries(HIGHLIGHT).map(([iso, label]) => {
      const r = ranking.get(iso);
      return el('div', { class: 'heat-ref' }, [
        el('span', { class: 'heat-swatch', style: `background:${rgb(targetColor(iso))}` }),
        el('b', {}, label),
        r ? el('span', { class: 'num' }, `${metric.fmt(r.value)} · puesto ${r.rank} de ${r.total} (${year})`) : el('span', {}, `sin datos en ${year}`),
      ]);
    }));
  }

  function downloadActive() {
    if (!vdata) return;
    const cell = (v) => String(Number(v.toFixed(4))).replace('.', ',');
    const rows = [...ranking.values()].map((r) => `${nameOf(r.iso).replace(/;/g, ',')};${r.iso};${cell(r.value)};${year};${r.rank};${sourceAt(vdata, r.iso, year).replace(/;/g, ',')}`);
    downloadCsv(`mapa-${metric.key}-${year}.csv`, ['País;Código;Valor;Año;Puesto;Fuente', ...rows].join('\r\n'));
  }

  /* --- año y variable --- */
  function syncSlider() {
    slider.min = vdata.from;
    slider.max = vdata.to;
    slider.value = year;
    yearMin.textContent = vdata.from;
    yearMax.textContent = vdata.to;
    yearBig.textContent = year;
  }

  function setYear(y, dur) {
    if (!vdata) return;
    year = Math.min(vdata.to, Math.max(vdata.from, y));
    syncSlider();
    ranking = buildRanking();
    renderLegend();
    renderRefs();
    retarget(0, dur ?? 260);
    shownIso = null;
    if (hover && lastHit) showTip(lastHit);
    panel.onYear();
  }

  let token = 0;
  async function setMetric(m) {
    metric = m;
    group = m.group;
    renderGroups();
    const my = ++token;
    loading.hidden = false;
    let vd;
    try {
      vd = await loadVar(m.key);
    } catch (err) {
      if (my !== token) return;
      loading.textContent = `No se pudieron cargar los datos de ${m.title.toLowerCase()}.`;
      return;
    }
    if (my !== token) return;
    loading.hidden = true;
    loading.textContent = 'Cargando datos…';
    vdata = vd;
    // Se conserva el año elegido si existe para la nueva variable; si no, el más cercano. La primera vez, el último con datos.
    year = year === null ? vd.last : Math.min(vd.to, Math.max(vd.from, year));
    syncSlider();
    ranking = buildRanking();
    renderLegend();
    renderRefs();
    retarget(year === vd.last && !panel.iso ? 260 : 120);
    shownIso = null;
    if (hover && lastHit) showTip(lastHit);
    panel.onMetric();
  }

  /* --- reproducir --- */
  let timer = null;
  function startPlay() {
    if (!vdata) return;
    if (year >= vdata.to) setYear(vdata.from, 0);
    playBtn.textContent = '❚❚ Pausa';
    playBtn.setAttribute('aria-pressed', 'true');
    const ms = Number(speedSel.value);
    timer = setInterval(() => {
      if (!vdata || year >= vdata.to) { stopPlay(); return; }
      setYear(year + 1, Math.min(ms * 0.8, 500));
    }, ms);
  }
  function stopPlay() {
    if (timer) clearInterval(timer);
    timer = null;
    playBtn.textContent = '▶ Reproducir';
    playBtn.setAttribute('aria-pressed', 'false');
  }

  /* ---------- panel del país: gráfico de la variable activa ---------- */
  const panel = buildPanel();

  function openPanel(iso, compareWith) {
    panel.open(iso, compareWith);
  }

  function buildPanel() {
    const st = { iso: null, freq: 'A', view: 'yoy', range: 0, cmp: '' };
    let chart = null;
    const title = el('h2', {});
    const sub = el('p', { class: 'unit' });
    const close = el('button', { class: 'pill dlg-close', type: 'button' }, 'Cerrar');
    const freqBox = el('div', { class: 'tl-group', role: 'group', 'aria-label': 'Frecuencia' });
    const viewBox = el('div', { class: 'tl-group', role: 'group', 'aria-label': 'Variación' });
    const rangeBox = el('div', { class: 'tl-group', role: 'group', 'aria-label': 'Rango' });
    const cmpSel = el('select', { class: 'cmp-select', 'aria-label': 'Comparar con' });
    const canvasC = el('canvas', { role: 'img' });
    const box = el('div', { class: 'chart-box mapa-chart' }, canvasC);
    const empty = el('p', { class: 'cmp-empty', hidden: true });
    const meta = el('p', { class: 'tl-meta' });
    panelBox.append(
      el('div', { class: 'focus-head' }, [el('div', {}, [el('span', { class: 'label' }, 'Evolución por país'), title, sub]), close]),
      el('div', { class: 'tl' }, [freqBox, viewBox, rangeBox]),
      el('label', { class: 'mapa-cmp' }, [el('span', {}, 'Comparar con…'), cmpSel]),
      box, empty, meta,
    );
    close.addEventListener('click', () => {
      st.iso = null;
      panelBox.hidden = true;
      root.classList.remove('mapa-open');
      if (chart) { chart.destroy(); chart = null; }
      draw();
    });
    cmpSel.addEventListener('change', () => { st.cmp = cmpSel.value; render(); });

    const btn = (label, pressed, disabled, title, on) => {
      const b = el('button', { class: 'tl-btn', type: 'button', 'aria-pressed': String(pressed), disabled, title }, label);
      b.addEventListener('click', on);
      return b;
    };

    /** Frecuencias que tiene el país para la variable activa (las demás se muestran deshabilitadas) */
    const hasFreq = (iso, f) => (f === 'A' ? !!vdata?.c?.[iso] : !!index.hf?.[iso]?.[metric.key]?.includes(f));

    /** Puntos [fechaISO, valor] de un país en la frecuencia elegida */
    async function pointsOf(iso, freq) {
      if (iso === 'WLD') {
        if (freq !== 'A' || !vdata.world) return [];
        return vdata.world.map((v, i) => [`${vdata.from + i}-01-01`, v]).filter((p) => p[1] !== null);
      }
      if (freq === 'A') {
        const a = vdata.c[iso];
        return a ? a.map((v, i) => [`${vdata.from + i}-01-01`, v]).filter((p) => p[1] !== null) : [];
      }
      const hf = await loadHf(iso);
      const s = hf?.[metric.key]?.[freq];
      if (!s) return [];
      const arr = metric.key === 'infl' ? s[st.view] : s.v;
      const y0 = Number(s.from.slice(0, 4));
      const p0 = freq === 'M' ? Number(s.from.slice(5, 7)) - 1 : Number(s.from.slice(-1)) - 1;
      const step = freq === 'M' ? 1 : 3;
      const out = [];
      (arr ?? []).forEach((v, i) => {
        if (v === null) return;
        const m = (p0 * step) + i * step; // meses desde enero de y0
        out.push([`${y0 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}-01`, v]);
      });
      return out;
    }

    function controls() {
      freqBox.replaceChildren(...metric.freqs.map((f) => {
        const ok = hasFreq(st.iso, f);
        return btn(FREQ_LABEL[f], f === st.freq, !ok, ok ? FREQ_LABEL[f] : `${FREQ_LABEL[f]}: no hay datos de esta frecuencia para ${nameOf(st.iso)}`, () => { st.freq = f; render(); });
      }));
      // Las frecuencias que la variable no tiene se muestran deshabilitadas, para que se vea que no existen
      for (const f of ['M', 'Q', 'A']) {
        if (!metric.freqs.includes(f)) freqBox.append(btn(FREQ_LABEL[f], false, true, `${FREQ_LABEL[f]}: esta variable se publica solo con frecuencia ${metric.freqs.map((x) => FREQ_LABEL[x].toLowerCase()).join(' y ')}`, () => {}));
      }
      viewBox.hidden = !(metric.key === 'infl' && st.freq === 'M');
      viewBox.replaceChildren(
        btn('Interanual', st.view === 'yoy', false, 'Variación % contra el mismo mes del año anterior', () => { st.view = 'yoy'; render(); }),
        btn('Mensual', st.view === 'mom', false, 'Variación % contra el mes anterior', () => { st.view = 'mom'; render(); }),
      );
      rangeBox.replaceChildren(...RANGES.map(([y, label]) => btn(label, y === st.range, false, y ? `Últimos ${y} años` : 'Toda la historia', () => { st.range = y; render(); })));
      // Comparar: cualquier país con datos de la variable, o el mundo si la fuente publica el agregado
      const opts = [el('option', { value: '' }, 'Nadie')];
      if (vdata.world) opts.push(el('option', { value: 'WLD', disabled: st.freq !== 'A' }, `Mundo (agregado de la fuente)${st.freq !== 'A' ? ' — solo anual' : ''}`));
      Object.keys(vdata.c).filter((iso) => iso !== st.iso && byIso.has(iso)).sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'es'))
        .forEach((iso) => opts.push(el('option', { value: iso, disabled: !hasFreq(iso, st.freq) }, nameOf(iso))));
      cmpSel.replaceChildren(...opts);
      if (st.cmp && !opts.some((o) => o.value === st.cmp && !o.disabled)) st.cmp = '';
      cmpSel.value = st.cmp;
    }

    let renderToken = 0;
    async function render() {
      if (!st.iso || !vdata) return;
      if (!hasFreq(st.iso, st.freq)) st.freq = hasFreq(st.iso, 'A') ? 'A' : metric.freqs.find((f) => hasFreq(st.iso, f)) ?? 'A';
      controls();
      const name = nameOf(st.iso);
      title.textContent = name;
      const viewTxt = metric.key === 'infl' && st.freq === 'M' ? (st.view === 'yoy' ? ', var. % interanual' : ', var. % mensual') : '';
      const freqNote = st.freq === 'A' && metric.key === 'rate' ? ' (fin de período: diciembre)' : st.freq === 'A' && metric.key === 'infl' ? ' (promedio anual)' : st.freq === 'Q' && metric.key === 'gdp' ? ' (var. % interanual)' : '';
      sub.textContent = `${metric.title} · ${FREQ_LABEL[st.freq].toLowerCase()}${viewTxt}${freqNote}${viewTxt || freqNote ? '' : ` · ${metric.short}`}`;
      const my = ++renderToken;
      const [base, other] = await Promise.all([pointsOf(st.iso, st.freq), st.cmp ? pointsOf(st.cmp, st.freq) : Promise.resolve([])]);
      if (my !== renderToken) return;
      if (chart) { chart.destroy(); chart = null; }
      if (!base.length) {
        box.hidden = true;
        empty.hidden = false;
        empty.textContent = `No hay datos de ${metric.title.toLowerCase()} para ${name}.`;
        meta.textContent = '';
        return;
      }
      box.hidden = false;
      empty.hidden = true;
      // Rango: últimos N años de la serie del país
      let start = base[0][0];
      if (st.range) {
        const lastY = Number(base[base.length - 1][0].slice(0, 4));
        const cut = `${lastY - st.range + 1}-01-01`;
        if (cut > start) start = cut;
      }
      const series = [{ iso: st.iso, pts: base.filter((p) => p[0] >= start) }];
      if (other.length) series.push({ iso: st.cmp, pts: other.filter((p) => p[0] >= start && p[0] <= base[base.length - 1][0]) });
      chart = drawCountryChart(canvasC, series, st.freq);
      canvasC.setAttribute('aria-label', `${metric.title} de ${name}, ${FREQ_LABEL[st.freq].toLowerCase()}${st.cmp ? `, comparado con ${nameOf(st.cmp)}` : ''}.`);
      const last = base[base.length - 1];
      meta.textContent = [
        `Último dato: ${metric.fmt(last[1])} (${fmtDate(last[0], st.freq)})`,
        `Fuente: ${st.freq === 'A' ? [...new Set(series[0].pts.map((p) => sourceAt(vdata, st.iso, Number(p[0].slice(0, 4)))))].join(' · ') : HF_SOURCE[metric.key]}`,
        st.cmp === 'WLD' ? `Mundo: ${vdata.worldSrc}` : null,
        st.freq !== 'A' ? 'Sin interpolar: los huecos son meses o trimestres sin dato publicado' : null,
      ].filter(Boolean).join(' · ');
    }

    /** Gráfico de línea (o barras) con la línea vertical del año del slider */
    function drawCountryChart(cv, series, freq) {
      const css = (n, d) => getComputedStyle(cv).getPropertyValue(n).trim() || d;
      const c = { a: css('--ar', '#1F5FA8'), b: css('--us', '#B0702A'), bad: css('--bad', '#B3372F'), ink: css('--ink', '#0E1E33'), ink3: css('--ink-3', '#76839A'), grid: css('--grid', '#E6EAF0'), font: css('--font-body', 'sans-serif') };
      const dates = [...new Set(series.flatMap((s) => s.pts.map((p) => p[0])))].sort();
      const asBar = metric.chart === 'bar' && series.length === 1 && dates.length <= 80;
      const sources = series.map((s) => (s.iso === 'WLD' ? vdata.worldSrc : null));
      const datasets = series.map((s, i) => {
        const m = new Map(s.pts);
        const color = i ? c.b : c.a;
        return {
          type: asBar ? 'bar' : 'line',
          label: nameOf(s.iso),
          data: dates.map((d) => (m.has(d) ? m.get(d) : null)),
          borderColor: color,
          backgroundColor: asBar ? (ctx2) => (ctx2.raw < 0 ? c.bad : color) : color,
          borderWidth: asBar ? 0 : 2.25,
          borderDash: i ? [6, 4] : undefined,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.2,
          spanGaps: false, // nunca se unen huecos: un año o mes sin dato queda vacío
          _iso: s.iso,
        };
      });
      const yearLine = {
        id: 'yearLine',
        afterDatasetsDraw(ch) {
          const target = `${year}-01-01`;
          const i = ch.data.labels.findIndex((d) => d >= target);
          if (i < 0 || ch.data.labels[i].slice(0, 4) !== String(year)) return;
          const x = ch.scales.x.getPixelForValue(i);
          const { ctx: g, chartArea } = ch;
          g.save();
          g.beginPath();
          g.moveTo(x, chartArea.top);
          g.lineTo(x, chartArea.bottom);
          g.lineWidth = 1.5;
          g.strokeStyle = c.ink;
          g.setLineDash([2, 3]);
          g.stroke();
          g.fillStyle = c.ink;
          g.font = `600 11px ${c.font}`;
          g.fillText(String(year), Math.min(x + 4, chartArea.right - 30), chartArea.top + 11);
          g.restore();
        },
      };
      return new Chart(cv, {
        plugins: [yearLine],
        data: { labels: dates, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: REDUCED ? false : { duration: 500 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: datasets.length > 1, position: 'top', align: 'start', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, color: c.ink, font: { family: c.font, size: 12 } } },
            tooltip: {
              backgroundColor: c.ink,
              titleFont: { family: c.font },
              bodyFont: { family: c.font },
              footerFont: { family: c.font, weight: 'normal', size: 11 },
              callbacks: {
                title: (items) => fmtDate(items[0].label, freq),
                label: (ctx2) => `${ctx2.dataset.label}: ${metric.fmt(ctx2.parsed.y)} (${metric.short})`,
                footer: (items) => {
                  const y = Number(items[0].label.slice(0, 4));
                  return items.map((it) => {
                    const iso = it.dataset._iso;
                    if (iso === 'WLD') return `Fuente: ${sources[it.datasetIndex]}`;
                    return `Fuente: ${freq === 'A' ? sourceAt(vdata, iso, y) : HF_SOURCE[metric.key]}`;
                  }).filter((t, i, a) => a.indexOf(t) === i);
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false }, border: { color: c.grid }, ticks: { color: c.ink3, font: { family: c.font, size: 11 }, maxTicksLimit: 7, maxRotation: 0, callback(v) { return fmtDate(this.getLabelForValue(v), freq, 'short'); } } },
            y: {
              type: ['gdppc', 'pop'].includes(metric.key) && series.some((s) => s.pts.length > 40) ? 'logarithmic' : 'linear',
              grid: { color: c.grid },
              border: { display: false },
              ticks: { color: c.ink3, font: { family: c.font, size: 11 }, maxTicksLimit: 6, callback: (v) => fmtNum(v, Math.abs(v) >= 10 ? 0 : Math.abs(v) >= 1 ? 1 : 2) },
            },
          },
        },
      });
    }

    return {
      get iso() { return st.iso; },
      open(iso, compareWith) {
        if (!vdata) return;
        st.iso = iso;
        if (compareWith !== undefined) st.cmp = compareWith;
        else if (st.cmp === iso) st.cmp = '';
        panelBox.hidden = false;
        root.classList.add('mapa-open');
        draw();
        render();
        if (window.matchMedia('(max-width: 1099px)').matches) panelBox.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'nearest' });
      },
      onMetric() { if (st.iso) render(); },
      onYear() { if (chart) chart.update('none'); },
    };
  }

  /* --- arranque --- */
  readColors();
  new ResizeObserver(() => { if (map.clientWidth !== w) resize(); }).observe(map);
  resize();
  if (metric) setMetric(metric);
  return { setMetric, setYear };
}
