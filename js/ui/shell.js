/**
 * shell.js — estructura común de la plataforma:
 *   - barra lateral con toda la navegación (en celular es un panel que se abre con el botón de menú)
 *   - barra superior con la ubicación, la fecha, el buscador y la cinta de indicadores
 *   - pie con fuentes y método
 * Para agregar una página al menú, sumarla a SUBNAVS (js/config/navigation.js).
 */
import { el } from './dom.js';
import { SUBNAVS } from '../config/navigation.js';
import { startTicker } from './ticker.js';
import { mountPalette, openPalette } from './palette.js';

/** Grupos de la barra lateral */
const GROUPS = [
  { key: 'home', label: null, items: [{ href: 'index.html', label: 'Inicio' }] },
  { key: 'ar', label: 'Argentina', items: [...SUBNAVS.argentina, { href: 'dolar.html', label: 'Tipo de cambio' }] },
  { key: 'us', label: 'Estados Unidos', items: SUBNAVS.eeuu },
];

const ICONS = {
  menu: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M3 5.5h14M3 10h14M3 14.5h14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  search: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13.2 13.2 17 17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};
/** Ícono SVG a partir de un texto fijo del propio código (nunca de datos externos) */
function icon(name) {
  const span = el('span', { class: 'icon' });
  span.innerHTML = ICONS[name];
  return span;
}

const currentFile = () => location.pathname.split('/').pop() || 'index.html';
const clock = (timeZone) => new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(new Date());

/** Pills de subsecciones de un grupo ("argentina" o "eeuu"); se usan como accesos desde el inicio */
export function renderSubnav(group, active = null) {
  return el('nav', { class: 'subnav', 'aria-label': 'Indicadores' }, (SUBNAVS[group] ?? []).map((n) =>
    el('a', { class: 'pill', href: n.href, 'aria-current': n.id === active ? 'page' : false }, n.label)));
}

function buildSidebar(file) {
  const ba = el('b', {}, clock('America/Argentina/Buenos_Aires'));
  const ny = el('b', {}, clock('America/New_York'));
  setInterval(() => {
    ba.textContent = clock('America/Argentina/Buenos_Aires');
    ny.textContent = clock('America/New_York');
  }, 20_000);

  return el('aside', { class: 'side', id: 'side', 'aria-label': 'Navegación principal' }, [
    el('a', { class: 'side-brand', href: 'index.html' }, [el('strong', {}, 'Sigma Algebra')]),
    el('nav', { class: 'side-nav' }, GROUPS.map((g) =>
      el('div', { class: 'side-group', 'data-g': g.key }, [
        g.label ? el('span', { class: 'side-label' }, g.label) : null,
        ...g.items.map((i) => el('a', { class: 'side-link', href: i.href, 'aria-current': i.href === file ? 'page' : false }, i.label)),
      ]))),
    el('p', { class: 'side-credits' }, 'Lautaro Frank ; Santino Hurvitz'),
    el('div', { class: 'side-foot' }, [
      el('div', { class: 'side-clock' }, [el('span', {}, 'Buenos Aires'), ba]),
      el('div', { class: 'side-clock' }, [el('span', {}, 'Nueva York'), ny]),
    ]),
  ]);
}

/** Arma la estructura común. Los parámetros se conservan por compatibilidad: la página activa se deduce de la dirección. */
export function mountShell() {
  const file = currentFile();
  const group = GROUPS.find((g) => g.items.some((i) => i.href === file));
  const item = group?.items.find((i) => i.href === file);

  // Barra lateral y fondo para cerrarla en celular
  const side = buildSidebar(file);
  const backdrop = el('div', { class: 'side-backdrop' });
  document.body.prepend(side, backdrop);

  const menuBtn = el('button', { class: 'menu-btn', type: 'button', 'aria-label': 'Abrir el menú', 'aria-controls': 'side', 'aria-expanded': 'false' }, icon('menu'));
  const setOpen = (open) => {
    document.body.classList.toggle('side-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) side.querySelector('[aria-current="page"], .side-link')?.focus();
  };
  menuBtn.addEventListener('click', () => setOpen(!document.body.classList.contains('side-open')));
  backdrop.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('side-open')) { setOpen(false); menuBtn.focus(); }
  });

  // Barra superior
  const searchBtn = el('button', { class: 'search-btn', type: 'button', 'aria-label': 'Buscar un indicador' }, [
    icon('search'), el('span', { class: 'search-text' }, 'Buscar indicador'), el('kbd', {}, 'Ctrl K'),
  ]);
  searchBtn.addEventListener('click', openPalette);
  const today = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  document.querySelector('#site-header').replaceChildren(
    el('div', { class: 'bar' }, [
      menuBtn,
      el('a', { class: 'brand brand-mini', href: 'index.html' }, 'Sigma Algebra'),
      el('p', { class: 'crumbs' }, [group?.label ? el('span', {}, `${group.label} /`) : null, el('b', {}, item?.label ?? 'Inicio')]),
      el('span', { class: 'bar-date' }, today),
      searchBtn,
    ]),
    // La barra de cotizaciones globales solo se muestra en el Inicio; el resto de las páginas no la monta
    ...(file === 'index.html' ? [el('div', { class: 'ticker', id: 'ticker', hidden: true, 'aria-label': 'Cotizaciones globales' })] : []),
  );
  if (file === 'index.html') startTicker(document.querySelector('#ticker'));
  mountPalette();

  document.querySelector('#site-footer').replaceChildren(
    el('strong', {}, 'Fuentes y método'),
    el('ul', {}, [
      el('li', {}, 'Argentina: INDEC, BCRA y Secretaría de Hacienda, vía la API de series de tiempo de datos.gob.ar.'),
      el('li', {}, 'Series reales (salarios, crédito, dinero): nivel nominal dividido por el IPC nacional, calculado por Sigma Algebra.'),
      el('li', {}, 'Tipos de dólar: ArgentinaDatos (historia) y DolarAPI (cotización del día).'),
      el('li', {}, 'Noticias: titulares y enlaces de medios (Ámbito, El Cronista, Infobae, La Nación, Clarín, iProfesional, CNBC, Financial Times y agencias vía Google Noticias) y de la Reserva Federal y el BCE. Selección automática por reglas de impacto, con texto propio y el enlace al original.'),
      el('li', {}, 'Cotizaciones globales del Inicio: Yahoo Finance (guardadas cada 30 minutos en horario de mercado) y Bitcoin en vivo desde CoinGecko. El emergente se muestra con el ETF EEM como referencia del MSCI Emerging Markets.'),
      el('li', {}, 'Estados Unidos: BLS (precios, empleo y vacantes), NY Fed (tasa efectiva y SOFR), U.S. Treasury (rendimientos y deuda).'),
      el('li', {}, 'Actualización: el historial se renueva cuatro veces por día, después de las publicaciones, y la página pide los datos más recientes a las fuentes mientras está abierta (el dólar cada minuto, el resto cada 5 minutos).'),
      el('li', {}, 'PBI anual de ambos países: Banco Mundial (crecimiento real).'),
      el('li', {}, 'Las variaciones interanuales y mensuales se calculan a partir de los niveles originales de cada serie.'),
    ]),
    el('p', { class: 'credits' }, 'Lautaro Frank ; Santino Hurvitz'),
  );
}
