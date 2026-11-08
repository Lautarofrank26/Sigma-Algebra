/**
 * shell.js — elementos comunes a todas las páginas: barra superior y pie.
 * Para agregar una página al menú, sumarla a NAV.
 */
import { el } from './dom.js';
import { SUBNAVS } from '../config/navigation.js';
import { startTicker } from './ticker.js';

const NAV = [
  { id: 'inicio', href: 'index.html', label: 'Inicio' },
  { id: 'argentina', href: 'argentina.html', label: 'Argentina' },
  { id: 'dolar', href: 'dolar.html', label: 'Dólar' },
  { id: 'eeuu', href: 'eeuu.html', label: 'EE.UU.' },
];

/** Pills de subsecciones de un grupo ("argentina" o "eeuu"). "active" marca la página actual (o null). */
export function renderSubnav(group, active = null) {
  return el('nav', { class: 'subnav', 'aria-label': 'Indicadores' }, (SUBNAVS[group] ?? []).map((n) =>
    el('a', { class: 'pill', href: n.href, 'aria-current': n.id === active ? 'page' : false }, n.label)));
}

/**
 * @param {string} active id de la página actual (ver NAV)
 * @param {string} [sub] id de la subsección de Argentina (ver SUBNAVS); muestra el submenú en #subnav
 */
export function mountShell(active, sub) {
  document.querySelector('#site-header').replaceChildren(
    el('div', { class: 'wrap' }, [
      el('a', { class: 'brand', href: 'index.html' }, 'Macroeconomics'),
      el('nav', { 'aria-label': 'Secciones' }, NAV.map((n) =>
        el('a', { class: 'pill', href: n.href, 'aria-current': n.id === active ? 'page' : false }, n.label))),
    ]),
    el('div', { class: 'ticker', id: 'ticker', hidden: true, 'aria-label': 'Indicadores del día' }),
  );
  startTicker(document.querySelector('#ticker'));

  const subnav = document.querySelector('#subnav');
  if (subnav && sub) subnav.replaceChildren(...renderSubnav(active, sub).childNodes);

  document.querySelector('#site-footer').replaceChildren(
    el('strong', {}, 'Fuentes y método'),
    el('ul', {}, [
      el('li', {}, 'Argentina: INDEC, BCRA y Secretaría de Hacienda, vía la API de series de tiempo de datos.gob.ar.'),
      el('li', {}, 'Series reales (salarios, crédito, dinero): nivel nominal dividido por el IPC nacional, calculado por Macroeconomics.'),
      el('li', {}, 'Tipos de dólar: ArgentinaDatos (historia) y DolarAPI (cotización del día).'),
      el('li', {}, 'Estados Unidos: BLS (precios, empleo y vacantes), NY Fed (tasa efectiva y SOFR), U.S. Treasury (rendimientos y deuda).'),
      el('li', {}, 'Actualización: el historial se renueva todos los días y la página pide los datos más recientes a las fuentes mientras está abierta (el dólar cada minuto, el resto cada 5 minutos).'),
      el('li', {}, 'PBI anual de ambos países: Banco Mundial (crecimiento real).'),
      el('li', {}, 'Las variaciones interanuales y mensuales se calculan a partir de los niveles originales de cada serie.'),
    ]),
  );
}





