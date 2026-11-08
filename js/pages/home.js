/**
 * Página de inicio: panorama de las tres secciones (cada bloque lleva a su página)
 * y comparativo Argentina vs. EE.UU.
 */
import { argentina } from '../config/argentina.js';
import { usa } from '../config/usa.js';
import { loadCountry } from '../data/loader.js';
import { initPage, setUpdated, showError } from '../app.js';
import { el } from '../ui/dom.js';
import { renderKpi } from '../ui/kpi.js';
import { renderQuotes } from '../ui/quotes.js';
import { renderCompare } from '../ui/compare.js';
import { renderSubnav } from '../ui/shell.js';
import { loadCalendar, renderCalendar } from '../ui/calendar.js';
import { mountWorld } from '../ui/worldhero.js';

const dolar = { dataUrl: 'data/dolar.json' };
initPage('inicio');
const root = document.querySelector('#root');

/** Bloque con título, descripción, enlace a la página completa y contenido */
function block({ key, title, sub, href, content }) {
  return el('section', { class: 'country country--block', 'data-country': key }, [
    el('div', { class: 'country-head' }, [
      el('h2', {}, el('a', { href }, title)),
      el('a', { class: 'pill', href }, 'Ver sección completa →'),
    ]),
    el('p', { class: 'sub block-sub' }, sub),
    content,
  ]);
}

async function init() {
  try {
    const [ar, us, fx] = await Promise.all([loadCountry(argentina), loadCountry(usa), loadCountry(dolar)]);
    mountWorld(document.querySelector('#world-root'), fx); // portada: mapa del mundo con datos del día
    const calendar = await loadCalendar().then((cal) => renderCalendar(cal)).catch(() => null); // sin calendario, la página sigue igual
    root.replaceChildren(
      calendar,
      block({
        key: 'ar', title: 'Argentina', href: 'argentina.html', sub: argentina.tagline,
        content: el('div', {}, [
          el('div', { class: 'kpi-strip' }, argentina.kpis.map((k) => renderKpi(ar, k))),
          renderSubnav('argentina'),
        ]),
      }),
      block({
        key: 'fx', title: 'Tipo de cambio', href: 'dolar.html', sub: 'Oficial, blue, MEP, contado con liqui y más',
        content: renderQuotes(fx),
      }),
      block({
        key: 'us', title: 'Estados Unidos', href: 'eeuu.html', sub: usa.tagline,
        content: el('div', {}, [
          el('div', { class: 'kpi-strip' }, usa.kpis.map((k) => renderKpi(us, k))),
          renderSubnav('eeuu'),
        ]),
      }),
      el('section', { class: 'compare' }, [el('h2', {}, 'Comparativo'), renderCompare(ar, us)]),
    );
    setUpdated(ar.updated < us.updated ? ar.updated : us.updated);
  } catch (err) {
    showError(root, err);
  }
}

init();


