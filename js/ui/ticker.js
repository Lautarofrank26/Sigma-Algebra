/**
 * ticker.js — barra de cotizaciones globales del Inicio (solo se monta ahí; ver shell.js).
 * Diez variables en cuatro grupos: renta variable, tasas y riesgo, monedas, commodities y cripto.
 * Cada una muestra el último valor, la variación del día (en puntos básicos para el bono a 10 años),
 * un minigráfico de 5 días, la hora de la última actualización (hora de Argentina) y "cerrado" si el mercado no opera.
 *
 * Datos: data/mercados.json (lo genera tools/fetch-mercados.ps1 desde Yahoo Finance, que el navegador no puede
 * consultar directamente) y Bitcoin en vivo desde CoinGecko. Si una fuente falla se conserva el último dato
 * con su hora; si no hay ninguno, la variable se omite (nunca se inventa un valor).
 * La barra anterior, con los dólares de Argentina, sigue disponible en ticker-ar.js para la sección Argentina.
 */
import { el } from './dom.js';
import { fmtNum, fmtSigned } from '../lib/format.js';
import { renderSpark } from './spark.js';

const REFRESH_MS = 5 * 60 * 1000;
const BTC_MS = 60 * 1000;
const AR_TIME = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' });
const STALE_MIN = 45; // sin cotización nueva en este tiempo = mercado cerrado (los futuros y el bitcoin casi no cierran)

function direction(chg, dec) {
  if (chg === null || chg === undefined) return 'flat';
  const v = Number(chg.toFixed(dec));
  return v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
}

/** Variación del día: en % (o en puntos básicos para el rendimiento del Treasury) */
function change(item) {
  if (item.price == null || !item.prev) return null;
  return item.chg === 'pb' ? (item.price - item.prev) * 100 : (item.price / item.prev - 1) * 100;
}

function itemNode(item, now) {
  const chg = change(item);
  const isPb = item.chg === 'pb';
  const dir = direction(chg, isPb ? 0 : 1);
  const arrow = { up: '▲', down: '▼', flat: '■' }[dir];
  const text = chg === null ? null : isPb ? `${fmtSigned(chg, 0)} pb` : `${fmtSigned(chg, 1)}%`;
  const ageMin = item.time ? (now / 1000 - item.time) / 60 : Infinity;
  const closed = item.id !== 'btc' && ageMin > STALE_MIN;
  const when = item.time ? AR_TIME.format(new Date(item.time * 1000)) : null;
  const tip = [item.note, when ? `Actualizado ${when} h (hora de Argentina)${closed ? ' · mercado cerrado' : ''}` : null].filter(Boolean).join('. ');

  const spark = item.spark?.length > 1 ? renderSpark(item.spark.map((v) => ['', v]), item.spark.length) : null;
  return el('span', { class: `tk-item${closed ? ' is-closed' : ''}`, title: tip || null, 'data-dir': dir }, [
    el('span', { class: 'tk-label' }, item.label),
    el('span', { class: 'num tk-value' }, fmtNum(item.price, item.dec ?? 2)),
    text ? el('span', { class: 'num tk-chg', 'data-dir': dir }, `${arrow} ${text}`) : null,
    spark ? el('span', { class: 'tk-spark', 'data-dir': dir }, spark) : null,
    closed ? el('span', { class: 'tk-closed' }, 'cerrado') : null,
    when ? el('span', { class: 'num tk-time' }, when) : null,
  ]);
}

/** Cartel de grupo entre variables */
const groupNode = (name) => el('span', { class: 'tk-group' }, name);

function buildNodes(items, now) {
  const nodes = [];
  let last = null;
  for (const it of items) {
    if (it.group !== last) { nodes.push(groupNode(it.group)); last = it.group; }
    nodes.push(itemNode(it, now));
  }
  return nodes;
}

async function loadBase() {
  const res = await fetch('data/mercados.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/** Bitcoin en vivo (CoinGecko): precio, variación de 24 h y hora de la cotización */
async function fetchBtc() {
  const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true');
  if (!r.ok) throw new Error(String(r.status));
  const j = (await r.json()).bitcoin;
  if (!j || typeof j.usd !== 'number') throw new Error('sin dato');
  return { price: j.usd, prev: j.usd / (1 + (j.usd_24h_change ?? 0) / 100), time: j.last_updated_at };
}

/** @param {HTMLElement} box contenedor de la barra */
export async function startTicker(box) {
  let items = [];
  try {
    items = (await loadBase()).items ?? [];
  } catch {
    return; // sin base de datos: la barra no se muestra
  }

  const render = () => {
    const nodes = buildNodes(items, Date.now());
    if (!nodes.length) return;
    // El contenido se duplica para que el desplazamiento sea continuo
    box.replaceChildren(el('div', { class: 'tk-track' }, [...nodes, ...nodes.map((n) => n.cloneNode(true))]));
    box.hidden = false;
  };
  render();

  const refreshBase = async () => {
    if (document.hidden) return;
    try {
      const fresh = (await loadBase()).items ?? [];
      const btc = items.find((i) => i.id === 'btc');
      items = fresh.map((i) => (i.id === 'btc' && btc?.live ? { ...i, ...btc } : i)); // no pisar el bitcoin en vivo con el dato guardado
      render();
    } catch { /* se mantiene lo que ya se muestra */ }
  };
  const refreshBtc = async () => {
    if (document.hidden) return;
    try {
      const live = await fetchBtc();
      items = items.map((i) => (i.id === 'btc' ? { ...i, ...live, live: true } : i));
      render();
    } catch { /* se mantiene el último dato con su hora */ }
  };
  refreshBtc();
  setInterval(refreshBase, REFRESH_MS);
  setInterval(refreshBtc, BTC_MS);
}
