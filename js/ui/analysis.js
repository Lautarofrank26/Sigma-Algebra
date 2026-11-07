/**
 * analysis.js — tarjeta "Lectura macro", generada con reglas a partir de los datos.
 * Cada país define su función `analyze(g)` en js/config/<pais>.js.
 */
import { el } from './dom.js';
import { resolve } from '../data/loader.js';
import { lastAndPrev } from '../lib/transform.js';

/** Acceso rápido: g(ref) → { date, last, prev, back } o null */
export function makeGetter(data) {
  return (ref) => {
    const s = resolve(data, ref);
    return s ? lastAndPrev(s.points, 3) : null;
  };
}

export function renderAnalysis(country, data) {
  const { lead, items } = country.analyze(makeGetter(data));
  return el('section', { class: 'analysis', 'aria-label': `Lectura macro de ${country.name}` }, [
    el('h3', {}, 'Lectura macro'),
    lead ? el('p', { class: 'lead' }, lead) : null,
    el('ul', {}, items.map((i) => el('li', {}, [el('strong', {}, i.title), i.text]))),
    el('p', { class: 'note' }, 'Texto generado automáticamente con reglas simples sobre los últimos datos. Es una lectura descriptiva, no una proyección.'),
  ]);
}
