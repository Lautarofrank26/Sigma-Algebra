/**
 * worldhero.js — portada: mapa del mundo de puntos con los mercados del día.
 *
 * - Un canvas dibuja la tierra como una grilla de puntos, un barrido de luz lento y pulsos en
 *   ocho plazas financieras. El foco pasa de una plaza a otra cada pocos segundos (o al pasar el mouse).
 * - Sobre el mapa se superponen botones HTML (accesibles) y una tarjeta con el dato de la plaza activa.
 * - Debajo, una tira con los datos clave del día. Todo se renueva cada minuto (ver data/world.js).
 * - Con "reducir movimiento" activado no hay animación continua ni rotación automática.
 */
import { el } from './dom.js';
import { fmtNum, fmtSigned } from '../lib/format.js';
import { landCells, project, WORLD } from '../data/world-mask.js';
import { loadWorld } from '../data/world.js';

const REFRESH_MS = 60_000;
const ROTATE_MS = 5000;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Plazas del mapa. dx/dy desplazan la etiqueta para que no se superpongan (Londres y Fráncfort están muy cerca) */
const HUBS = [
  { id: 'bue', city: 'Buenos Aires', lon: -58.4, lat: -34.6, home: true },
  { id: 'nyc', city: 'Nueva York', lon: -74.0, lat: 40.7 },
  { id: 'mex', city: 'Ciudad de México', lon: -99.1, lat: 19.4 },
  { id: 'sao', city: 'São Paulo', lon: -46.6, lat: -23.5 },
  { id: 'lon', city: 'Londres', lon: -0.1, lat: 51.5, side: 'left' },
  { id: 'fra', city: 'Eurozona', lon: 8.7, lat: 50.1, side: 'right' },
  { id: 'sha', city: 'Shanghái', lon: 121.5, lat: 31.2 },
  { id: 'tok', city: 'Tokio', lon: 139.7, lat: 35.7 },
];

/* ---------- formato ---------- */

const arrow = (chg, dec = 1) => (chg === null || chg === undefined || Number(chg.toFixed(dec)) === 0 ? '■' : chg > 0 ? '▲' : '▼');
const pct = (chg) => (chg === null || chg === undefined ? '' : `${arrow(chg)} ${fmtSigned(chg, 1)}%`);
const pb = (chg) => (chg === null || chg === undefined ? '' : `${arrow(chg, 0)} ${fmtSigned(chg, 0)} pb`);

/** Datos que muestra la tarjeta de cada plaza: { label, value, chg (texto), lines[] } o null si falta el dato */
function hubInfo(id, d) {
  const fx = d.fx;
  switch (id) {
    case 'bue': {
      const o = d.dollars.oficial;
      if (!o) return null;
      return {
        label: 'Dólar oficial', value: `$${fmtNum(o.value, 2)}`, chg: pct(o.chg),
        lines: [
          d.gap !== null ? `Brecha CCL ${fmtNum(d.gap, 1)}%` : null,
          d.riesgo ? `Riesgo país ${fmtNum(d.riesgo.value, 0)} pb ${pb(d.riesgo.chg)}`.trim() : null,
          d.dollars.blue ? `Blue $${fmtNum(d.dollars.blue.value, 0)}` : null,
        ],
      };
    }
    case 'nyc': {
      const r = d.rates;
      if (!r.y10) return null;
      return {
        label: 'Bono del Tesoro a 10 años', value: `${fmtNum(r.y10.value, 2)}%`, chg: pb(r.y10.chg),
        lines: [r.y2 ? `2 años ${fmtNum(r.y2.value, 2)}%` : null, r.effr ? `Tasa de la Fed ${fmtNum(r.effr.value, 2)}%` : null],
      };
    }
    case 'lon': return fx.GBP ? { label: 'Libra, US$ por £', value: fmtNum(fx.GBP.value, 4), chg: pct(fx.GBP.chg), lines: ['Cierre de referencia del BCE'] } : null;
    case 'fra': return fx.EUR ? { label: 'Euro, US$ por €', value: fmtNum(fx.EUR.value, 4), chg: pct(fx.EUR.chg), lines: ['Cierre de referencia del BCE'] } : null;
    case 'tok': return fx.JPY ? { label: 'Yenes por US$', value: fmtNum(fx.JPY.value, 2), chg: pct(fx.JPY.chg), lines: ['Cierre de referencia del BCE'] } : null;
    case 'sha': return fx.CNY ? { label: 'Yuanes por US$', value: fmtNum(fx.CNY.value, 4), chg: pct(fx.CNY.chg), lines: ['Cierre de referencia del BCE'] } : null;
    case 'sao': return fx.BRL ? { label: 'Reales por US$', value: fmtNum(fx.BRL.value, 4), chg: pct(fx.BRL.chg), lines: ['Cierre de referencia del BCE'] } : null;
    case 'mex': return fx.MXN ? { label: 'Pesos mexicanos por US$', value: fmtNum(fx.MXN.value, 3), chg: pct(fx.MXN.chg), lines: ['Cierre de referencia del BCE'] } : null;
    default: return null;
  }
}

/** Tira de datos clave del día */
function statItems(d) {
  const items = [];
  const push = (label, value, chg) => value && items.push({ label, value, chg });
  if (d.dollars.oficial) push('Dólar oficial', `$${fmtNum(d.dollars.oficial.value, 2)}`, pct(d.dollars.oficial.chg));
  if (d.gap !== null) push('Brecha CCL', `${fmtNum(d.gap, 1)}%`, '');
  if (d.riesgo) push('Riesgo país', `${fmtNum(d.riesgo.value, 0)} pb`, pb(d.riesgo.chg));
  if (d.rates.y10) push('Bono EE.UU. 10 años', `${fmtNum(d.rates.y10.value, 2)}%`, pb(d.rates.y10.chg));
  if (d.fx.EUR) push('Euro', `US$ ${fmtNum(d.fx.EUR.value, 4)}`, pct(d.fx.EUR.chg));
  if (d.btc) push('Bitcoin', `US$ ${fmtNum(d.btc.value, 0)}`, pct(d.btc.chg));
  return items;
}

/* ---------- componente ---------- */

/** @param {HTMLElement} root contenedor (#world-root) */
export function mountWorld(root, base) {
  const canvas = el('canvas', { class: 'world-canvas', 'aria-hidden': 'true' });
  const card = el('div', { class: 'hub-card', 'aria-live': 'polite' });
  const status = el('span', { class: 'world-status' }, 'Cargando datos…');
  const stats = el('ul', { class: 'world-stats' });
  const hubButtons = HUBS.map((h) => {
    const [x, y] = project(h.lon, h.lat);
    const b = el('button', { class: `hub${h.side ? ` hub-${h.side}` : ''}`, type: 'button', style: `left:${(x * 100).toFixed(2)}%;top:${(y * 100).toFixed(2)}%`, 'aria-label': h.city }, [
      el('span', { class: 'hub-dot' }),
      el('span', { class: 'hub-name' }, h.city),
    ]);
    b.addEventListener('mouseenter', () => select(h.id, true));
    b.addEventListener('focus', () => select(h.id, true));
    b.addEventListener('click', () => select(h.id, true));
    return b;
  });
  const map = el('div', { class: 'world-map' }, [canvas, ...hubButtons]);
  const stage = el('div', { class: 'world-stage' }, [map, card]); // la tarjeta va fuera del mapa para poder apilarse en pantallas chicas

  root.replaceChildren(
    el('div', { class: 'world-head' }, [
      el('div', {}, [
        el('span', { class: 'label' }, 'Mercados hoy'),
        el('h1', {}, 'Argentina y el mundo'),
        el('p', {}, 'Dólar, riesgo país, tasas de EE.UU., monedas y bitcoin. Los datos se renuevan mientras la página está abierta.'),
      ]),
      el('div', { class: 'world-meta' }, [status, el('span', { class: 'label', id: 'updated' }, 'Cargando datos…')]),
    ]),
    stage,
    stats,
  );

  /* --- estado --- */
  let data = null;
  let activeId = 'bue';
  let pausedUntil = 0;
  let lastValues = {};

  function select(id, byUser = false) {
    activeId = id;
    if (byUser) pausedUntil = Date.now() + 9000;
    hubButtons.forEach((b, i) => b.classList.toggle('is-active', HUBS[i].id === id));
    renderCard();
    if (REDUCED) draw(0);
  }

  function renderCard() {
    const hub = HUBS.find((h) => h.id === activeId);
    const info = data ? hubInfo(activeId, data) : null;
    const [x, y] = project(hub.lon, hub.lat);
    card.className = `hub-card${x > 0.55 ? ' flip' : ''}${y > 0.6 ? ' up' : ''}`;
    card.style.setProperty('--x', `${(x * 100).toFixed(2)}%`);
    card.style.setProperty('--y', `${(y * 100).toFixed(2)}%`);
    const key = `${activeId}:${info?.value}`;
    const changed = lastValues[activeId] !== undefined && lastValues[activeId] !== key;
    lastValues[activeId] = key;
    card.replaceChildren(
      el('span', { class: 'label' }, hub.city),
      info
        ? el('div', { class: 'hub-main' }, [el('span', { class: 'hub-label' }, info.label), el('span', { class: `num hub-value${changed ? ' flash' : ''}` }, info.value), info.chg ? el('span', { class: 'num hub-chg' }, info.chg) : null])
        : el('span', { class: 'hub-label' }, data ? 'Sin dato disponible' : 'Cargando…'),
      ...(info?.lines ?? []).filter(Boolean).map((l) => el('span', { class: 'num hub-line' }, l)),
    );
  }

  function renderStats() {
    if (!data) return;
    stats.replaceChildren(...statItems(data).map((s) => el('li', {}, [
      el('span', { class: 'label' }, s.label),
      el('span', { class: 'num stat-value' }, s.value),
      s.chg ? el('span', { class: 'num stat-chg' }, s.chg) : null,
    ])));
  }

  async function refresh() {
    if (document.hidden && data) return;
    try {
      data = await loadWorld(base);
    } catch {
      return;
    }
    renderStats();
    renderCard();
    status.textContent = data.live ? `● En vivo ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : 'Datos guardados';
    status.classList.toggle('is-live', data.live);
  }

  /* --- dibujo --- */
  const cells = landCells();
  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let dpr = 1;
  let colors = {};
  const css = (n) => getComputedStyle(canvas).getPropertyValue(n).trim();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = map.clientWidth;
    h = Math.round((w * (WORLD.latTop - WORLD.latBottom)) / 360);
    map.style.height = `${h}px`;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    colors = { dot: css('--map-dot'), hi: css('--map-dot-hi'), ar: css('--ar'), ink: css('--ink-2') };
    draw(0);
  }

  function pos(hub) {
    const [x, y] = project(hub.lon, hub.lat);
    return [x * w, y * h];
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cw = w / WORLD.cols;
    const ch = h / WORLD.rows;
    const r = Math.min(cw, ch) * 0.3;
    const sweep = ((t * 0.045) % 1.3 - 0.15) * w;

    for (const [c, rr] of cells) {
      const x = (c + 0.5) * cw;
      const y = (rr + 0.5) * ch;
      const alpha = 0.55 + 0.15 * Math.sin(t * 0.5 + c * 0.37 + rr * 0.91);
      ctx.globalAlpha = REDUCED ? 0.6 : alpha;
      ctx.fillStyle = colors.dot;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.2832);
      ctx.fill();
      const boost = REDUCED ? 0 : Math.max(0, 1 - Math.abs(x - sweep) / (w * 0.07));
      if (boost > 0.04) {
        ctx.globalAlpha = boost * 0.8;
        ctx.fillStyle = colors.hi;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.2, 0, 6.2832);
        ctx.fill();
      }
    }

    // arco desde Buenos Aires hasta la plaza activa
    const home = HUBS[0];
    const [hx, hy] = pos(home);
    const active = HUBS.find((hb) => hb.id === activeId);
    if (active && active.id !== home.id) {
      const [ax, ay] = pos(active);
      const mx = (hx + ax) / 2;
      const my = Math.min(hy, ay) - Math.abs(ax - hx) * 0.22 - 20;
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = colors.ar;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -t * 18;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.quadraticCurveTo(mx, my, ax, ay);
      ctx.stroke();
      ctx.setLineDash([]);
      const p = REDUCED ? 1 : (t * 0.35) % 1;
      const bx = (1 - p) * (1 - p) * hx + 2 * (1 - p) * p * mx + p * p * ax;
      const by = (1 - p) * (1 - p) * hy + 2 * (1 - p) * p * my + p * p * ay;
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.ar;
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, 6.2832);
      ctx.fill();
    }

    // pulsos en cada plaza
    HUBS.forEach((hb, i) => {
      const [x, y] = pos(hb);
      const isActive = hb.id === activeId;
      const color = hb.home ? colors.ar : colors.ink;
      const phase = REDUCED ? 0.4 : (t * (isActive ? 0.7 : 0.35) + i * 0.37) % 1;
      const maxR = isActive ? 26 : 15;
      ctx.globalAlpha = (1 - phase) * (isActive ? 0.7 : 0.35);
      ctx.strokeStyle = color;
      ctx.lineWidth = isActive ? 2 : 1.2;
      ctx.beginPath();
      ctx.arc(x, y, 4 + phase * maxR, 0, 6.2832);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, isActive ? 5 : 3.5, 0, 6.2832);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  /* --- animación: solo mientras el mapa está a la vista y la pestaña activa --- */
  let raf = 0;
  let visible = true;
  const start = performance.now();
  let lastRotate = start;
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    draw((now - start) / 1000);
    if (now - lastRotate > ROTATE_MS && Date.now() > pausedUntil) {
      lastRotate = now;
      select(HUBS[(HUBS.findIndex((x) => x.id === activeId) + 1) % HUBS.length].id);
    }
    raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!REDUCED && !raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };

  new ResizeObserver(resize).observe(map);
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; kick(); }).observe(map);
  document.addEventListener('visibilitychange', kick);

  resize();
  select('bue');
  kick();
  refresh();
  setInterval(refresh, REFRESH_MS);
}

