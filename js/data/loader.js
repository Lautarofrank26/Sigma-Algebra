/**
 * loader.js — capa de datos.
 *
 * Hoy lee snapshots JSON publicados junto con la página (carpeta /data),
 * generados por tools/fetch-data.ps1 desde APIs oficiales.
 *
 * Para escalar a datos en vivo: agregar otro "provider" a PROVIDERS que
 * devuelva el mismo formato { country, updated, indicators[] } y usarlo en
 * config (campo `provider`). El resto de la app no cambia.
 */
import { applyTransform } from '../lib/transform.js';

const PROVIDERS = {
  /** Snapshot estático servido con la página */
  snapshot: async (url) => {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
    return res.json();
  },
};

/** Carga y normaliza un país: indexa los indicadores por id */
export async function loadCountry(config) {
  const provider = PROVIDERS[config.provider ?? 'snapshot'];
  const raw = await provider(config.dataUrl);
  // Series adicionales (config.extraUrl, p. ej. data/ar-extra.json de tools/fetch-ar.py): se suman sin pisar ids existentes.
  // Si el archivo extra falla, la sección se muestra igual con sus series de siempre.
  if (config.extraUrl) {
    try {
      const extra = await provider(config.extraUrl);
      const have = new Set(raw.indicators.map((i) => i.id));
      raw.indicators.push(...(extra.indicators ?? []).filter((i) => !have.has(i.id)));
    } catch (err) {
      console.warn('Series adicionales no disponibles', err);
    }
  }
  // Normaliza fechas anuales ("2025") a ISO ("2025-01-01") para que todas las series compartan formato
  for (const ind of raw.indicators) {
    ind.points = (ind.points ?? []).map(([d, v]) => [String(d).length === 4 ? `${d}-01-01` : String(d), v]);
  }
  const byId = Object.fromEntries(raw.indicators.map((i) => [i.id, i]));
  return { updated: raw.updated, byId, quotes: raw.quotes ?? [], daily: raw.daily ?? {} };
}

/**
 * Resuelve una referencia { id, t } a una serie transformada.
 * @returns {{points:Array, freq:string, meta:object}|null}
 */
export function resolve(data, ref) {
  const ind = data.byId[ref.id];
  if (!ind || !ind.points || !ind.points.length) return null;
  const points = applyTransform(ref.t ?? 'level', ind.points, ind.freq);
  return { points, freq: ind.freq, meta: ind };
}


