/**
 * palette.js — buscador de indicadores (Ctrl+K, o la tecla "/").
 * Indexa todas las páginas y todos los gráficos a partir de las configuraciones,
 * así un indicador nuevo aparece en el buscador sin tocar este archivo.
 */
import { el } from './dom.js';
import { argentina } from '../config/argentina.js';
import { usa } from '../config/usa.js';
import { dolar } from '../config/dolar.js';
import { TEMAS as AR } from '../config/ar/index.js';
import { TEMAS as US } from '../config/us/index.js';

const MAX_RESULTS = 12;
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const PAGES = [
  { cfg: argentina, href: 'argentina.html', section: 'Argentina', page: 'Resumen' },
  ...Object.entries(AR).map(([k, cfg]) => ({ cfg, href: `${k}.html`, section: 'Argentina', page: cfg.name })),
  { cfg: dolar, href: 'dolar.html', section: 'Argentina', page: 'Tipo de cambio' },
  { cfg: usa, href: 'eeuu.html', section: 'Estados Unidos', page: 'Resumen' },
  ...Object.entries(US).map(([k, cfg]) => ({ cfg, href: `eeuu-${k}.html`, section: 'Estados Unidos', page: cfg.name })),
];

/** Entradas del buscador: primero las páginas, después cada gráfico */
function buildIndex() {
  const entry = (kind, title, sub, href) => ({ kind, title, sub, href, text: norm(`${title} ${sub}`) });
  const pages = [entry('Página', 'Panorama', 'Mercados del día, calendario y resumen', 'index.html')];
  const charts = [];
  for (const p of PAGES) {
    pages.push(entry('Página', `${p.section} · ${p.page}`, p.cfg.tagline ?? '', p.href));
    for (const panel of p.cfg.panels ?? []) {
      charts.push(entry('Gráfico', panel.title, `${p.section} · ${p.page} · ${panel.unit}`, `${p.href}#${panel.id}`));
    }
  }
  return [...pages, ...charts];
}

let dialog = null;
let input = null;
let list = null;
let index = null;
let results = [];
let active = 0;

function render() {
  const words = norm(input.value).split(/\s+/).filter(Boolean);
  results = (words.length ? index.filter((e) => words.every((w) => e.text.includes(w))) : index.filter((e) => e.kind === 'Página')).slice(0, MAX_RESULTS);
  active = Math.min(active, Math.max(0, results.length - 1));
  list.replaceChildren(...(results.length
    ? results.map((r, i) => el('li', { role: 'option', 'aria-selected': String(i === active) }, el('a', { href: r.href, tabindex: '-1' }, [
        el('span', { class: 'pal-kind' }, r.kind),
        el('span', { class: 'pal-title' }, [r.title, el('small', {}, r.sub)]),
      ])))
    : [el('li', { class: 'pal-empty' }, 'Sin resultados. Probá con otra palabra, por ejemplo "inflación" o "empleo".')]));
  list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
}

function go(r) {
  if (!r) return;
  dialog.close();
  location.href = r.href;
}

export function openPalette() {
  if (!dialog || dialog.open) return;
  index ??= buildIndex();
  input.value = '';
  active = 0;
  render();
  dialog.showModal();
  input.focus();
}

/** Crea el diálogo (una vez por página) y registra los atajos de teclado */
export function mountPalette() {
  if (dialog) return;
  input = el('input', { id: 'pal-input', type: 'search', placeholder: 'Buscar un indicador o una página…', autocomplete: 'off', 'aria-label': 'Buscar un indicador o una página', 'aria-controls': 'pal-list' });
  list = el('ul', { id: 'pal-list', role: 'listbox', 'aria-label': 'Resultados' });
  dialog = el('dialog', { class: 'palette', 'aria-label': 'Buscador' }, [
    el('div', { class: 'pal-head' }, input),
    list,
    el('p', { class: 'pal-foot' }, '↑ ↓ para moverse · Enter para abrir · Esc para cerrar'),
  ]);
  document.body.append(dialog);

  input.addEventListener('input', () => { active = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length) active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    }
  });
  list.addEventListener('click', (e) => {
    const li = e.target.closest('li[role="option"]');
    if (!li) return;
    e.preventDefault();
    go(results[[...list.children].indexOf(li)]);
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // clic fuera del cuadro

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '');
    if ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
      e.preventDefault();
      openPalette();
    }
  });
}
