/**
 * calendar.js — próximos datos oficiales con cuenta regresiva.
 * Los eventos salen de data/calendario.json (calendario de difusión del INDEC y de la Fed).
 * Para actualizarlo: agregar eventos al JSON con fecha, hora y huso horario.
 */
import { el } from './dom.js';
import { resolve } from '../data/loader.js';
import { fmtNum, fmtSigned, fmtDate } from '../lib/format.js';

const AR = 'America/Argentina/Buenos_Aires';
const fmtDay = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: AR });
const fmtHour = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: AR });

/** Instante exacto del evento (la hora está dada en el huso del organismo) */
const timestamp = (e) => Date.parse(`${e.date}T${e.time}:00${e.tz}`);
const when = (e) => `${fmtDay.format(timestamp(e))}, ${fmtHour.format(timestamp(e))} h`;
const pad = (n) => String(n).padStart(2, '0');

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
  if (e.consenso) out.push(`Consenso: ${e.consenso}`);
  return out;
}

/**
 * @param {object} cal contenido de data/calendario.json
 * @param {{ar?:object, us?:object}} [datasets] series por país, para mostrar el dato anterior
 * @returns {HTMLElement|null} sección con el próximo dato y la lista de los siguientes
 */
export function renderCalendar(cal, datasets = {}, now = Date.now()) {
  const upcoming = cal.eventos.map((e) => ({ ...e, ts: timestamp(e) })).filter((e) => e.ts > now).sort((a, b) => a.ts - b.ts);
  if (!upcoming.length) return null;
  const [next, ...rest] = upcoming;

  const box = (label) => {
    const value = el('span', { class: 'num cd-value' }, '00');
    return { value, node: el('div', { class: 'cd-box' }, [value, el('span', { class: 'cd-label' }, label)]) };
  };
  const d = box('días'), h = box('horas'), m = box('min'), s = box('seg');

  const tick = () => {
    const left = Math.max(0, next.ts - Date.now());
    d.value.textContent = pad(Math.floor(left / 86400000));
    h.value.textContent = pad(Math.floor(left / 3600000) % 24);
    m.value.textContent = pad(Math.floor(left / 60000) % 60);
    s.value.textContent = pad(Math.floor(left / 1000) % 60);
  };
  tick();
  const timer = setInterval(() => (document.body.contains(d.value) ? tick() : clearInterval(timer)), 1000);

  const item = (e) => el('li', {}, [
    el('a', { href: e.href }, [
      el('span', { class: 'cal-date num' }, fmtDay.format(e.ts)),
      el('span', { class: 'cal-title' }, [e.title, el('small', {}, e.detail), ...previousTexts(e, datasets).map((t) => el('small', { class: 'cal-prev num' }, t))]),
      el('span', { class: `cal-flag cal-${e.country}` }, e.country === 'ar' ? 'AR' : 'EE.UU.'),
    ]),
  ]);

  return el('section', { class: 'calendar', 'aria-label': 'Próximos datos oficiales' }, [
    el('div', { class: 'cal-next' }, [
      el('span', { class: 'label' }, 'Próximo dato oficial'),
      el('h2', {}, el('a', { href: next.href }, next.title)),
      el('p', {}, `${next.detail}`),
      el('p', { class: 'cal-when' }, `${when(next)} · ${next.source}`),
      ...previousTexts(next, datasets).map((t) => el('p', { class: 'cal-prev num' }, t)),
      el('div', { class: 'cd' }, [d.node, h.node, m.node, s.node]),
    ]),
    el('div', { class: 'cal-list' }, [
      el('span', { class: 'label' }, 'Después'),
      el('ul', {}, rest.slice(0, 6).map(item)),
      el('p', { class: 'cal-note' }, cal.nota),
    ]),
  ]);
}
