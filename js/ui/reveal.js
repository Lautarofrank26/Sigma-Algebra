/**
 * reveal.js — movimiento al aparecer: las tarjetas suben y se desvanecen al entrar en pantalla
 * y las cifras grandes cuentan desde cero hasta su valor.
 *
 * - Solo se oculta algo si hay JavaScript (la clase js-reveal se agrega acá), así sin JS todo se ve.
 * - Con "reducir movimiento" activado, o al redibujar por una actualización en vivo,
 *   los elementos aparecen de una vez, sin animación.
 */
import { fmtNum } from '../lib/format.js';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SELECTORS = ['.analysis', '.kpi', '.panel', '.calendar', '.country--block', '.compare', '.world-stage'];
let observer = null;

/** Cuenta desde 0 hasta el valor de data-count, escribiendo en el primer texto del elemento */
function countUp(valueEl) {
  const to = Number(valueEl.dataset.count);
  const node = valueEl.firstChild;
  if (!Number.isFinite(to) || !node || node.nodeType !== Node.TEXT_NODE) return;
  const dec = Number(valueEl.dataset.dec ?? 1);
  const prefix = valueEl.dataset.prefix ?? '';
  const suffix = valueEl.dataset.suffix ?? '';
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / 900);
    const eased = 1 - (1 - p) ** 3;
    node.nodeValue = `${prefix}${fmtNum(to * eased, dec)}${suffix}`;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function onIntersect(entries) {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const node = entry.target;
    node.classList.add('in');
    observer.unobserve(node);
    node.querySelectorAll('[data-count]').forEach(countUp);
    if (node.matches('[data-count]')) countUp(node);
  }
}

/**
 * Marca los bloques de `root` para que aparezcan al entrar en pantalla.
 * @param {{animate?: boolean}} opts animate=false: mostrar todo de una vez (redibujos en vivo)
 */
export function revealIn(root, { animate = true } = {}) {
  const targets = [...root.querySelectorAll(SELECTORS.join(','))].filter((n) => !n.hasAttribute('data-reveal'));
  if (!animate || REDUCED || !('IntersectionObserver' in window)) {
    targets.forEach((n) => { n.setAttribute('data-reveal', ''); n.classList.add('in', 'no-anim'); });
    return;
  }
  document.documentElement.classList.add('js-reveal');
  observer ??= new IntersectionObserver(onIntersect, { threshold: 0.1, rootMargin: '0px 0px -4% 0px' });
  const seen = new Map(); // escalonado: cada hermano entra un poco después del anterior
  targets.forEach((n) => {
    const idx = seen.get(n.parentElement) ?? 0;
    seen.set(n.parentElement, idx + 1);
    n.setAttribute('data-reveal', '');
    n.style.setProperty('--d', `${Math.min(idx, 6) * 70}ms`);
    observer.observe(n);
  });
}
