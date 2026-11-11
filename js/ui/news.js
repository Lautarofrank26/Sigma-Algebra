/**
 * news.js — módulo de noticias de alto impacto. Un solo componente con dos configuraciones:
 *   - Argentina (Resumen):  data/noticias-ar.json,     pestañas "Mercados y Economía" y "Política"
 *   - Global (Inicio):      data/noticias-global.json, pestañas "Mercados y Economía" y "Geopolítica y Política"
 * Muestra solo lo más importante de cada período (Diario hasta 3, Semanal hasta 5, Mensual hasta 7), ordenado por
 * importancia y nunca relleno: si no hay nada que supere el umbral, lo dice. Los archivos los arma
 * tools/fetch-noticias.ps1 (RSS reales, reglas de impacto, deduplicación); cada nota lleva su fuente y su enlace.
 * La página vuelve a pedirlos cada 10 minutos mientras está abierta.
 */
import { el } from './dom.js';

const REFRESH_MS = 10 * 60 * 1000;
const PERIODS = [['daily', 'Diario'], ['weekly', 'Semanal'], ['monthly', 'Mensual']];
const LEVELS = { 3: 'Crítico', 2: 'Alto', 1: 'Relevante' };
const fmtWhen = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' });

/** Indicador de importancia: tres barras tipo señal + color sobrio (rótulo en texto: no depende solo del color) */
function importance(level) {
  const label = LEVELS[level] ?? LEVELS[1];
  return el('span', { class: `imp imp-${level}`, role: 'img', 'aria-label': `Importancia: ${label.toLowerCase()}` }, [
    el('span', { class: 'imp-bars', 'aria-hidden': 'true' }, [1, 2, 3].map((n) => el('i', { class: n <= level ? 'on' : '' }))),
    el('span', { class: 'imp-label' }, label),
  ]);
}

function article(n) {
  const when = fmtWhen.format(new Date(n.time));
  return el('li', { class: 'news-item' }, [
    importance(n.level),
    el('h3', {}, n.title),
    el('p', { class: 'news-sum' }, n.summary),
    el('p', { class: 'news-why' }, [el('b', {}, 'Por qué importa: '), n.why]),
    el('p', { class: 'news-src' }, [
      'Fuente: ',
      el('a', { href: n.url, target: '_blank', rel: 'noopener noreferrer' }, n.source),
      ` · ${when} h (hora de Argentina)`,
    ]),
  ]);
}

/**
 * @param {{ url:string, title:string, sub:string, tabs:Array<[string,string]> }} cfg tabs = [clave, rótulo] según el archivo
 * @returns {{ node: HTMLElement }}
 */
export function createNews(cfg) {
  let data = null;
  let cat = cfg.tabs[0][0];
  let period = 'daily';

  const list = el('ol', { class: 'news-list' });
  const stamp = el('span', { class: 'news-stamp' });
  const tabBtns = cfg.tabs.map(([key, label]) => {
    const b = el('button', { class: 'pill', type: 'button', role: 'tab', 'aria-selected': String(key === cat) }, label);
    b.addEventListener('click', () => { cat = key; paint(); });
    return b;
  });
  const perBtns = PERIODS.map(([key, label]) => {
    const b = el('button', { class: 'pill', type: 'button', 'aria-pressed': String(key === period) }, label);
    b.addEventListener('click', () => { period = key; paint(); });
    return b;
  });

  const node = el('section', { class: 'news', 'aria-label': cfg.title }, [
    el('div', { class: 'news-head' }, [
      el('div', {}, [el('span', { class: 'label' }, 'Noticias de alto impacto'), el('h2', {}, cfg.title), el('p', { class: 'news-sub' }, cfg.sub)]),
    ]),
    el('div', { class: 'news-bar' }, [
      el('div', { class: 'news-tabs', role: 'tablist', 'aria-label': 'Categoría' }, tabBtns),
      el('div', { class: 'news-periods', role: 'group', 'aria-label': 'Período' }, perBtns),
    ]),
    list,
    el('p', { class: 'news-note' }, [
      'Selección automática de medios y fuentes oficiales: solo lo que mueve precios, expectativas o el escenario, deduplicado y ordenado por importancia. ',
      stamp,
    ]),
  ]);

  function paint() {
    tabBtns.forEach((b, i) => b.setAttribute('aria-selected', String(cfg.tabs[i][0] === cat)));
    perBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(PERIODS[i][0] === period)));
    if (!data) { list.replaceChildren(el('li', { class: 'state' }, 'Cargando noticias…')); return; }
    const items = data.categories?.[cat]?.[period] ?? [];
    list.replaceChildren(...(items.length ? items.map(article) : [el('li', { class: 'news-empty' }, 'Sin novedades de alto impacto')]));
    stamp.textContent = `Actualizado ${fmtWhen.format(new Date(data.updated))} h.`;
  }

  async function load() {
    try {
      const res = await fetch(cfg.url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(String(res.status));
      data = await res.json();
      paint();
    } catch {
      if (!data) list.replaceChildren(el('li', { class: 'state' }, 'Las noticias no están disponibles por ahora. Volvé a intentar en unos minutos.'));
    }
  }
  paint();
  load();
  setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
  return { node };
}

/**
 * "Últimas de este rubro": hasta 3 noticias del mismo archivo, filtradas por la temática de una sección
 * (palabras clave en el título), de la más reciente a la más vieja.
 * Mismo formato de nota e indicador de importancia que el módulo completo. Si no hay ninguna, el bloque no se muestra.
 * @param {{ url:string, match:RegExp, max?:number }} cfg
 */
export function createMiniNews(cfg) {
  const list = el('ol', { class: 'news-list' });
  const node = el('section', { class: 'news news--mini', 'aria-label': 'Últimas de este rubro', hidden: true }, [
    el('div', { class: 'news-head' }, [el('div', {}, [el('span', { class: 'label' }, 'Noticias de alto impacto'), el('h2', {}, 'Últimas de este rubro')])]),
    list,
  ]);
  async function load() {
    try {
      const res = await fetch(cfg.url, { cache: 'no-cache' });
      if (!res.ok) return;
      const data = await res.json();
      const seen = new Set();
      const items = [];
      for (const cat of Object.values(data.categories ?? {})) {
        for (const period of ['daily', 'weekly', 'monthly']) {
          for (const n of cat[period] ?? []) {
            if (seen.has(n.url)) continue;
            seen.add(n.url);
            if (cfg.match.test(n.title)) items.push(n); // solo el título: el resumen suele mencionar otros temas
          }
        }
      }
      items.sort((a, b) => (a.time < b.time ? 1 : -1));
      const top = items.slice(0, cfg.max ?? 3);
      list.replaceChildren(...top.map(article));
      node.hidden = !top.length;
    } catch {
      // sin noticias el bloque queda oculto
    }
  }
  load();
  setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
  return { node };
}
