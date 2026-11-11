/**
 * calendar.js — próximos datos que mueven al mercado, con cuenta regresiva.
 * Los eventos salen de data/calendario.json (lo arma tools/update-calendar.ps1 a partir de los calendarios
 * oficiales del INDEC, la Fed, el BEA y el BCE). Cada evento trae impacto ("alto" o "medio") y región
 * ("ar", "us" o "global"); el calendario se puede filtrar por región.
 */
import { el } from './dom.js';
import { resolve } from '../data/loader.js';
import { fmtNum, fmtSigned, fmtDate } from '../lib/format.js';

const AR = 'America/Argentina/Buenos_Aires';
const fmtDay = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: AR });
const fmtHour = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: AR });

/** Instante exacto del evento (la hora está dada en el huso del organismo); se muestra siempre en hora de Argentina */
const timestamp = (e) => Date.parse(`${e.date}T${e.time}:00${e.tz}`);
const when = (e) => `${fmtDay.format(timestamp(e))}, ${fmtHour.format(timestamp(e))} h (hora de Argentina${e.aprox ? ', horario aproximado: el organismo no lo publica' : ''})`;
const pad = (n) => String(n).padStart(2, '0');

const FLAGS = { ar: 'AR', us: 'EE.UU.', eu: 'Eurozona', uk: 'Reino Unido', jp: 'Japón', cn: 'China' };
const IMPACT = { alto: 'Alto', medio: 'Medio' };
const FILTERS = [['all', 'Todos'], ['ar', 'Argentina'], ['us', 'EE.UU.'], ['global', 'Global']];
const regionOf = (e) => e.region ?? (e.country === 'ar' || e.country === 'us' ? e.country : 'global');

export async function loadCalendar() {
  const res = await fetch('data/calendario.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`No se pudo cargar el calendario (${res.status})`);
  return res.json();
}

/**
 * Texto del dato anterior de un evento, tomado de nuestras propias series.
 * `e.previo` es un objeto (o una lista) { file: 'ar'|'us', id, t, decimals, prefix, suffix, signed, label }.
 * @param {{ar?:object, us?:object}} datasets datos ya cargados por país
 * @returns {string[]} frases como "Anterior (m/m): +0,6% (sep 2026)"; vacío si falta el dato
 */
export function previousTexts(e, datasets) {
  const specs = [].concat(e.previo ?? []);
  const out = [];
  for (const spec of specs) {
    const data = datasets?.[spec.file];
    const s = data ? resolve(data, { id: spec.id, t: spec.t }) : null;
    if (!s) continue;
    const [date, value] = s.points[s.points.length - 1];
    const num = spec.signed ? fmtSigned(value, spec.decimals ?? 1) : fmtNum(value, spec.decimals ?? 1);
    out.push(`${spec.label ?? 'Anterior'}: ${spec.prefix ?? ''}${num}${spec.suffix ?? ''} (${fmtDate(date, s.freq)})`);
  }
  return out;
}

/** Anterior, consenso y real de un evento; lo que no está disponible se muestra como "s/d" (nunca se inventa) */
function dataLine(e, datasets) {
  const prev = previousTexts(e, datasets);
  if (!prev.length && e.previoTexto) prev.push(e.previoTexto); // dato anterior que trae el propio calendario (p. ej. tasa vigente del BoE)
  return [
    ...(prev.length ? prev : ['Anterior: s/d']),
    `Consenso: ${e.consenso ?? 's/d'}`,
    'Real: s/d',
  ].join(' · ');
}

/** Etiqueta de impacto: alto en rojo, medio en amarillo (el color también va en texto para no depender solo de él) */
const impactTag = (e) => (IMPACT[e.impact]
  ? el('span', { class: `cal-impact ${e.impact}`, title: `Impacto ${IMPACT[e.impact].toLowerCase()} en el mercado` }, `Impacto ${IMPACT[e.impact].toLowerCase()}`)
  : null);

/**
 * @param {object} cal contenido de data/calendario.json
 * @param {{ar?:object, us?:object}} [datasets] series por país, para mostrar el dato anterior
 * @returns {HTMLElement|null} sección con el próximo dato y la lista de los siguientes
 */
export function renderCalendar(cal, datasets = {}, now = Date.now()) {
  const all = cal.eventos.map((e) => ({ ...e, ts: timestamp(e) })).filter((e) => e.ts > now).sort((a, b) => a.ts - b.ts);
  if (!all.length) return null;

  let filter = 'all';
  let timer = 0;
  const nextBox = el('div', { class: 'cal-next' });
  const listBox = el('div', { class: 'cal-list' });
  const section = el('section', { class: 'calendar', 'aria-label': 'Próximos datos oficiales' }, [nextBox, listBox]);

  const filterButtons = FILTERS.map(([key, label]) => {
    const b = el('button', { class: 'pill', type: 'button', 'aria-pressed': key === filter ? 'true' : 'false' }, label);
    b.addEventListener('click', () => {
      filter = key;
      filterButtons.forEach((x, i) => x.setAttribute('aria-pressed', FILTERS[i][0] === key ? 'true' : 'false'));
      paint();
    });
    return b;
  });
  const filterBar = el('div', { class: 'cal-filters', role: 'group', 'aria-label': 'Filtrar por región' }, filterButtons);

  const item = (e) => el('li', {}, [
    el('a', { href: e.href }, [
      el('span', { class: 'cal-date num' }, fmtDay.format(e.ts)),
      el('span', { class: 'cal-title' }, [e.title, el('small', {}, e.detail), el('small', { class: 'cal-prev num' }, dataLine(e, datasets))]),
      el('span', { class: 'cal-tags' }, [impactTag(e), el('span', { class: `cal-flag cal-${e.country}` }, FLAGS[e.country] ?? e.country.toUpperCase())]),
    ]),
  ]);

  function paint() {
    clearInterval(timer);
    const upcoming = all.filter((e) => filter === 'all' || regionOf(e) === filter);
    if (!upcoming.length) {
      nextBox.replaceChildren(el('span', { class: 'label' }, 'Próximo dato oficial'), el('p', {}, 'No hay datos próximos para este filtro.'));
      listBox.replaceChildren(filterBar, el('p', { class: 'cal-note' }, cal.nota));
      return;
    }
    const [next, ...rest] = upcoming;

    const box = (label) => {
      const value = el('span', { class: 'num cd-value' }, '00');
      return { value, node: el('div', { class: 'cd-box' }, [value, el('span', { class: 'cd-label' }, label)]) };
    };
    const d = box('días'); const h = box('horas'); const m = box('min'); const s = box('seg');
    const tick = () => {
      const left = Math.max(0, next.ts - Date.now());
      d.value.textContent = pad(Math.floor(left / 86400000));
      h.value.textContent = pad(Math.floor(left / 3600000) % 24);
      m.value.textContent = pad(Math.floor(left / 60000) % 60);
      s.value.textContent = pad(Math.floor(left / 1000) % 60);
    };
    tick();
    timer = setInterval(() => (document.body.contains(d.value) ? tick() : clearInterval(timer)), 1000);

    nextBox.replaceChildren(
      el('span', { class: 'label' }, 'Próximo dato oficial'),
      el('h2', {}, el('a', { href: next.href }, next.title)),
      el('p', {}, `${next.detail}`),
      el('p', { class: 'cal-when' }, `${when(next)} · ${next.source}`),
      el('p', { class: 'cal-tags' }, [impactTag(next), el('span', { class: `cal-flag cal-${next.country}` }, FLAGS[next.country] ?? next.country.toUpperCase())]),
      el('p', { class: 'cal-prev num' }, dataLine(next, datasets)),
      el('div', { class: 'cd' }, [d.node, h.node, m.node, s.node]),
    );
    listBox.replaceChildren(
      el('div', { class: 'cal-list-head' }, [el('span', { class: 'label' }, 'Después'), filterBar]),
      el('ul', {}, rest.slice(0, 6).map(item)),
      el('p', { class: 'cal-note' }, cal.nota),
    );
  }

  paint();
  return section;
}
