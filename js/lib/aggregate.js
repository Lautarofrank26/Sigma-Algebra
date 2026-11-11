/**
 * aggregate.js — cambio de frecuencia de series (solo hacia frecuencias MÁS BAJAS: nunca se desagrega ni interpola).
 * Una serie es un array de puntos [fechaISO, valor] ordenado ascendente.
 *
 * Reglas de agregación según el tipo de variable (`kind`):
 *   flow       flujos (balanza, resultado fiscal)          → SUMA del período
 *   stock      saldos (reservas, base monetaria, depósitos) → valor de FIN de período
 *   price      precios y tasas (tipo de cambio, interés)    → PROMEDIO del período
 *   index      índices de actividad (EMAE)                  → PROMEDIO del período (las variaciones se calculan sobre ese promedio)
 *   rate       tasas del mercado laboral                    → PROMEDIO de los trimestres del período
 *   inflation  índice de precios                            → valor de fin de período; la variación entre fines de período
 *                                                             es la inflación COMPUESTA, ((1+m1)·(1+m2)·…) − 1, no la suma simple
 * Las transformaciones (variación, interanual, etc.) se aplican DESPUÉS de agregar (ver ui/panel.js).
 */

export const FREQ_LABEL = { D: 'Diaria', M: 'Mensual', Q: 'Trimestral', S: 'Semestral', A: 'Anual' };
const PER_YEAR = { M: 12, Q: 4, S: 2, A: 1 };
export const ORDER = ['D', 'M', 'Q', 'S', 'A'];

/** Frecuencias a las que se puede llegar desde la original (solo agregando) */
export function derivable(original) {
  switch (original) {
    case 'D': return ['D', 'M', 'Q', 'S', 'A'];
    case 'M': return ['M', 'Q', 'S', 'A'];
    case 'Q': return ['Q', 'A'];
    case 'S': return ['S', 'A'];
    default: return ['A'];
  }
}

/** Clave del período al que pertenece una fecha ("2026-05-01" → "2026-Q2" en trimestral) */
function keyOf(date, freq) {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) || 1;
  if (freq === 'M') return `${y}-${String(m).padStart(2, '0')}`;
  if (freq === 'Q') return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  if (freq === 'S') return `${y}-S${m <= 6 ? 1 : 2}`;
  return String(y);
}
/** Fecha representativa del período (primer mes), con el mismo formato que usan las series */
function dateOf(key, freq) {
  const y = key.slice(0, 4);
  if (freq === 'A') return `${y}-01-01`;
  if (freq === 'S') return `${y}-${key.endsWith('S1') ? '01' : '07'}-01`;
  if (freq === 'Q') return `${y}-${String((Number(key.slice(-1)) - 1) * 3 + 1).padStart(2, '0')}-01`;
  return `${key}-01`;
}
const lastMonthOf = (key, freq) => (freq === 'A' ? 12 : freq === 'S' ? (key.endsWith('S1') ? 6 : 12) : freq === 'Q' ? Number(key.slice(-1)) * 3 : Number(key.slice(5)));

/**
 * @param {Array<[string, number]>} points serie en su frecuencia original
 * @param {'M'|'Q'|'S'|'A'} from frecuencia original
 * @param {'M'|'Q'|'S'|'A'} to frecuencia pedida (igual o más baja)
 * @param {'flow'|'stock'|'price'|'index'|'rate'|'inflation'} kind
 */
export function aggregate(points, from, to, kind) {
  if (from === to) return points;
  if (!derivable(from).includes(to)) return [];
  const need = PER_YEAR[from] / PER_YEAR[to]; // puntos originales que componen un período
  const groups = new Map();
  for (const [d, v] of points) {
    const k = keyOf(d, to);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push([d, v]);
  }
  const endBased = kind === 'stock' || kind === 'inflation';
  const out = [];
  for (const [k, pts] of groups) {
    // Un período entra solo si está completo; los saldos y los índices de precios solo necesitan su último mes
    const complete = endBased
      ? pts.some(([d]) => Number(d.slice(5, 7)) === lastMonthOf(k, to) || from === 'A')
      : pts.length === need;
    if (!complete) continue;
    let value;
    if (kind === 'flow') value = pts.reduce((a, p) => a + p[1], 0);
    else if (endBased) value = pts[pts.length - 1][1];
    else value = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    out.push([dateOf(k, to), value]);
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** Meses que abarca una serie (de la primera a la última fecha); sirve para habilitar solo los rangos que caben */
export function spanMonths(points) {
  if (points.length < 2) return 0;
  const a = points[0][0];
  const b = points[points.length - 1][0];
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) || 1) - (Number(a.slice(5, 7)) || 1);
}
