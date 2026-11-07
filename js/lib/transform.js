/**
 * transform.js — transformaciones de series temporales.
 * Una serie es un array de puntos [fechaISO, valor] ordenado ascendente.
 * Para agregar una transformación nueva, sumarla al objeto TRANSFORMS.
 */

/** Períodos por año según frecuencia: mensual, trimestral, anual */
const PER_YEAR = { M: 12, Q: 4, A: 1 };

/** Variación porcentual contra `lag` períodos atrás */
function pctChange(points, lag) {
  return points.slice(lag).map(([d, v], i) => [d, (v / points[i][1] - 1) * 100]);
}

export const TRANSFORMS = {
  /** Nivel original */
  level: (points) => points,

  /** Variación interanual en % */
  yoy: (points, freq) => pctChange(points, PER_YEAR[freq] ?? 12),

  /** Variación contra el período anterior en % */
  pct1: (points) => pctChange(points, 1),

  /** Diferencia absoluta contra el período anterior */
  diff: (points) => points.slice(1).map(([d, v], i) => [d, v - points[i][1]]),

  /** Promedio móvil de 3 períodos de la diferencia absoluta */
  diff3avg: (points) => {
    const diffs = points.slice(1).map(([d, v], i) => [d, v - points[i][1]]);
    return diffs.slice(2).map(([d], i) => [d, (diffs[i][1] + diffs[i + 1][1] + diffs[i + 2][1]) / 3]);
  },
};

/** Aplica una transformación por nombre */
export function applyTransform(name, points, freq) {
  const fn = TRANSFORMS[name];
  if (!fn) throw new Error(`Transformación desconocida: ${name}`);
  return fn(points, freq);
}

/**
 * Recorta la serie a una ventana en meses terminando en el último dato.
 * `months = 0` devuelve todo. Garantiza `minPoints` para series lentas (trim./anual).
 */
export function sliceRange(points, months, minPoints = 0) {
  if (!points.length) return points;
  let out = points;
  if (months > 0) {
    const [y, m] = points[points.length - 1][0].split('-').map(Number);
    const cut = new Date(Date.UTC(y, m - 1 - months, 1)).toISOString().slice(0, 10);
    out = points.filter(([d]) => d >= cut);
  }
  if (out.length < minPoints) out = points.slice(-minPoints);
  return out;
}

/** Último valor, el anterior y el de hace n períodos (para tendencias) */
export function lastAndPrev(points, back = 3) {
  const n = points.length;
  if (!n) return null;
  return {
    date: points[n - 1][0],
    last: points[n - 1][1],
    prev: n > 1 ? points[n - 2][1] : null,
    back: n > back ? points[n - 1 - back][1] : null,
  };
}
