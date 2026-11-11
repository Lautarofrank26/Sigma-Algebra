/**
 * heattable.js — mapa de calor de una sección: categorías (filas) × períodos (columnas), coloreado por la variación.
 * Hoy lo usa Precios (IPC por división). Tiene la misma temporalidad propia que los demás gráficos: frecuencia
 * (solo hacia frecuencias más bajas, con la regla de agregación de la serie) y rango (1A | 3A | 5A | 10A | Máx).
 *
 * spec: { id, type: 'heatmap', title, unit, rows: [{ ref: { id }, label }], rowLabel, kind, views: [['pct1', 'Var. del período'], ['yoy', 'Interanual']],
 *         freqs, freq, range, diverging (verde/rojo según el signo), read, source }
 * Una fila sin datos se muestra como "s/d" (nunca se inventa ni interpola). Devuelve { node, update(), destroy() }.
 */
import { el } from './dom.js';
import { resolve } from '../data/loader.js';
import { applyTransform } from '../lib/transform.js';
import { aggregate, derivable, FREQ_LABEL } from '../lib/aggregate.js';
import { fmtNum, fmtDate } from '../lib/format.js';
import { seriesToCsv, downloadCsv } from '../lib/csv.js';

const RANGES = [[1, '1A'], [3, '3A'], [5, '5A'], [10, '10A'], [0, 'Máx']];
const PER_YEAR = { M: 12, Q: 4, S: 2, A: 1 };

const hex = (s, d) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(s).trim());
  const n = m ? parseInt(m[1], 16) : d;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

export function createHeatTable(data, spec) {
  const st = { freq: spec.freq ?? 'M', years: spec.range ?? 1, view: spec.views?.[0]?.[0] ?? 'pct1' };
  const rows = spec.rows.map((r) => ({ ...r, base: resolve(data, r.ref) })); // índices en su frecuencia original
  const original = rows.find((r) => r.base)?.base.freq ?? 'M';
  const ok = new Set(derivable(original));

  const title = el('h3', {}, spec.title);
  const unit = el('div', { class: 'unit' }, spec.unit);
  const btn = (label, pressed, disabled, tip, on) => {
    const b = el('button', { class: 'tl-btn', type: 'button', 'aria-pressed': String(pressed), disabled, title: tip }, label);
    b.addEventListener('click', on);
    return b;
  };
  const controls = el('div', { class: 'tl' });
  const tableBox = el('div', { class: 'heat-table-scroll', tabindex: '0', role: 'region', 'aria-label': spec.title });
  const meta = el('p', { class: 'tl-meta' });
  const csv = el('button', { class: 'csv-btn', type: 'button' }, 'Descargar CSV');

  /** Valores por fila en la frecuencia y la vista elegidas */
  function series() {
    return rows.map((r) => {
      if (!r.base) return { ...r, pts: null };
      const idx = st.freq === r.base.freq ? r.base.points : aggregate(r.base.points, r.base.freq, st.freq, spec.kind ?? 'inflation');
      return { ...r, pts: applyTransform(st.view, idx, st.freq) };
    });
  }

  function render() {
    controls.replaceChildren(
      el('div', { class: 'tl-group', role: 'group', 'aria-label': 'Frecuencia' }, (spec.freqs ?? ['M', 'Q', 'A']).map((f) => btn(FREQ_LABEL[f], f === st.freq, !ok.has(f), ok.has(f) ? FREQ_LABEL[f] : `${FREQ_LABEL[f]}: no disponible`, () => { st.freq = f; render(); }))),
      spec.views ? el('div', { class: 'tl-group', role: 'group', 'aria-label': 'Variación' }, spec.views.map(([v, label]) => btn(label, v === st.view, false, label, () => { st.view = v; render(); }))) : null,
      el('div', { class: 'tl-group', role: 'group', 'aria-label': 'Rango' }, RANGES.map(([y, label]) => btn(label, y === st.years, false, y ? `Últimos ${y} años` : 'Toda la historia', () => { st.years = y; render(); }))),
    );
    const s = series();
    // Columnas: los últimos N períodos con dato en alguna fila
    const all = [...new Set(s.flatMap((r) => (r.pts ?? []).map((p) => p[0])))].sort();
    const cols = st.years ? all.slice(-st.years * PER_YEAR[st.freq]) : all;
    const vals = s.flatMap((r) => (r.pts ?? []).filter((p) => cols.includes(p[0])).map((p) => p[1]));
    // Escala robusta: el percentil 90 de los valores absolutos, para que un valor extremo (p. ej. pesca) no deje todo pálido
    const abs = vals.map(Math.abs).sort((a, b) => a - b);
    const p90 = abs.length ? abs[Math.floor((abs.length - 1) * 0.9)] : 1;
    const hi = Math.max(0.0001, Math.min(Math.max(0, ...vals), p90));
    const lo = Math.max(Math.min(0, ...vals), -p90);
    const cs = getComputedStyle(tableBox);
    const cLo = hex(cs.getPropertyValue('--surface'), 0xffffff);
    const cHi = hex(cs.getPropertyValue('--bad'), 0xb3372f);
    const cNeg = hex(cs.getPropertyValue('--heat-seq-hi'), 0x0f3a6b);
    const cGood = hex(cs.getPropertyValue('--good'), 0x1e7f5c);
    const maxAbs = Math.max(hi, -lo, 0.0001);
    // Divergente (spec.diverging): verde si crece, rojo si cae; si no, más intenso cuanto más sube
    const color = spec.diverging
      ? (v) => (v >= 0 ? mix(cLo, cGood, Math.min(1, v / maxAbs)) : mix(cLo, cHi, Math.min(1, -v / maxAbs)))
      : (v) => (v >= 0 ? mix(cLo, cHi, Math.min(1, v / hi)) : mix(cLo, cNeg, Math.min(1, v / (lo || -1)) * 0.6));
    const fmtCol = (d) => fmtDate(d, st.freq, 'short');
    const table = el('table', { class: 'heat-table' }, [
      el('thead', {}, el('tr', {}, [el('th', { scope: 'col' }, spec.rowLabel ?? 'División'), ...cols.map((d) => el('th', { scope: 'col', class: 'num' }, fmtCol(d)))])),
      el('tbody', {}, s.map((r) => {
        const m = new Map(r.pts ?? []);
        return el('tr', {}, [
          el('th', { scope: 'row' }, r.label),
          ...cols.map((d) => {
            if (!r.pts) return el('td', { class: 'num sd' }, 's/d');
            if (!m.has(d)) return el('td', { class: 'num sd' }, '');
            const v = Math.round(m.get(d) * 10) / 10 || 0; // a un decimal, sin "-0,0"
            const c = color(v);
            const dark = (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 < 140;
            return el('td', { class: 'num', style: `background:rgb(${c.join(',')});color:${dark ? '#fff' : 'inherit'}`, title: `${r.label}, ${fmtDate(d, st.freq)}: ${fmtNum(v, 1)}%` }, fmtNum(v, 1));
          }),
        ]);
      })),
    ]);
    tableBox.replaceChildren(table);
    tableBox.scrollLeft = tableBox.scrollWidth; // el período más reciente a la vista
    title.textContent = `${spec.title} – ${FREQ_LABEL[st.freq].toLowerCase()}, ${spec.views?.find((v) => v[0] === st.view)?.[1].toLowerCase() ?? ''}`;
    const missing = s.filter((r) => !r.pts).map((r) => r.label);
    const last = cols[cols.length - 1];
    meta.textContent = [
      `Fuente: ${spec.source}`,
      spec.diverging ? 'Color: verde, crecimiento; rojo, caída (los valores extremos se ven con el color máximo)' : 'Color: más intenso, mayor variación (los valores extremos se ven con el color máximo)',
      last ? `Último dato: ${fmtDate(last, st.freq)}` : null,
      missing.length ? `s/d: ${missing.join(', ')} (la serie oficial no está disponible en la API de datos.gob.ar)` : null,
    ].filter(Boolean).join(' · ');
  }

  csv.addEventListener('click', () => {
    const cols = series().filter((r) => r.pts).map((r) => ({ label: r.label, points: r.pts }));
    downloadCsv(`macroeconomics-${spec.id}-${st.freq}-${new Date().toISOString().slice(0, 10)}.csv`, seriesToCsv(cols));
  });

  const node = el('article', { class: 'panel panel--wide', id: spec.id }, [
    el('div', { class: 'panel-head' }, [el('div', {}, [title, unit])]),
    controls,
    tableBox,
    el('details', {}, [el('summary', {}, 'Cómo leerlo'), el('p', {}, spec.read)]),
    meta,
    el('div', { class: 'src' }, [el('span', {}, ''), el('span', { class: 'panel-actions' }, [csv])]),
  ]);

  return { node, update() { render(); }, destroy() {} };
}
