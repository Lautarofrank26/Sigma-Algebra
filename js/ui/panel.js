/**
 * panel.js — panel de un indicador: título, valor actual, gráfico y "cómo leerlo".
 * Devuelve { node, update(months), destroy() } para redibujar al cambiar el rango.
 *
 * Panel con temporalidad propia (`panel.timeline`, hoy solo el Resumen de Argentina): trae sus propios selectores de
 * frecuencia y de rango, independientes de los demás gráficos, y no usa el período general de la página.
 *   timeline: {
 *     kind:   'flow' | 'stock' | 'price' | 'index' | 'rate' | 'inflation'   (regla de agregación, ver lib/aggregate.js)
 *     kinds:  { idDeSerie: kind } si el gráfico mezcla series de distinto tipo;  note: aclaración de la agregación en la leyenda
 *     freq:   frecuencia inicial ('M', 'Q', 'S', 'A'),   range: rango inicial en años (1, 3, 5, 10; 0 = máximo)
 *     freqs:  frecuencias que se ofrecen (las que no se pueden derivar de la original quedan deshabilitadas, no ocultas)
 *     desc:   { base, agg } texto del título según sea la frecuencia original o una agregada (p. ej. 'var. % m/m' / 'var. % compuesta')
 *     byFreq: { A: { datasets: [...] } }  series oficiales alternativas para una frecuencia (en vez de agregar a mano)
 *   }
 * Variantes (`panel.variants`, p. ej. Nominal / Real): [{ key, label, datasets, unit? }]; agregan un selector propio.
 */
import { el } from './dom.js';
import { drawChart } from './chart.js';
import { resolve } from '../data/loader.js';
import { fmtNum, fmtDate, fmtAge } from '../lib/format.js';
import { seriesToCsv, downloadCsv } from '../lib/csv.js';
import { aggregate, derivable, spanMonths, FREQ_LABEL } from '../lib/aggregate.js';
import { openFocus } from './focus.js';
import { eventBlocks } from './events.js';

const RANGES = [[1, '1A'], [3, '3A'], [5, '5A'], [10, '10A'], [0, 'Máx']];
const KIND_NOTE = { flow: 'suma del período', stock: 'valor de fin de período', price: 'promedio del período', index: 'promedio del período', rate: 'promedio del período', inflation: 'compuesta del período' };

/** Panel y datos para una frecuencia: series agregadas (o la serie oficial alternativa) y título actualizado */
function buildView(data, panel, freq) {
  const tl = panel.timeline;
  const alt = tl.byFreq?.[freq];
  const datasets = (alt?.datasets ?? panel.datasets).map((d) => ({ ...d }));
  const byId = { ...data.byId };
  let aggregated = false;
  if (!alt) {
    for (const id of new Set(datasets.map((d) => d.ref.id))) {
      const ind = data.byId[id];
      if (!ind || ind.freq === freq) continue;
      byId[id] = { ...ind, points: aggregate(ind.points, ind.freq, freq, tl.kinds?.[id] ?? tl.kind), freq };
      aggregated = true;
    }
  }
  const original = data.byId[datasets[0].ref.id]?.freq;
  const note = aggregated ? (tl.note ?? KIND_NOTE[tl.kind]) : null;
  // La variación interanual no es "compuesta" ni "promedio" del período: la nota va solo en las series que sí se agregan
  if (note) datasets.forEach((d) => { if (d.ref.t !== 'yoy') d.label = `${d.label} · ${note}`; });
  const desc = tl.desc ? (aggregated ? tl.desc.agg : tl.desc.base) : null;
  const title = `${panel.title} – ${FREQ_LABEL[freq].toLowerCase()}${desc ? `, ${desc}` : ''}`;
  return { view: { ...data, byId }, spec: { ...panel, title, datasets }, original, note };
}

export function createPanel(data, original) {
  // Eventos del gráfico (rombos, tarjeta y lista): solo los que caen dentro de la historia de la serie
  const firstDate = resolve(data, original.datasets[0].ref)?.points?.[0]?.[0] ?? '0000';
  const evs = (original.events ?? []).filter((e) => e.fecha >= firstDate);
  const ev = evs.length ? eventBlocks(original.id, evs) : null;
  const panel = ev ? { ...original, events: evs, _onEvent: ev.show } : original;
  const tl = panel.timeline ?? null;
  const head = resolve(data, panel.headline.ref);
  const lastValue = head ? `${panel.headline.prefix ?? ''}${fmtNum(head.points[head.points.length - 1][1], panel.headline.decimals)}${panel.headline.suffix ?? ''}` : null;
  const canvas = el('canvas', { role: 'img', 'aria-label': `Gráfico de ${panel.title}. ${panel.unit}.${lastValue ? ` Último dato: ${lastValue}.` : ''} Los datos completos se pueden descargar en CSV.` });
  let chart = null;
  const state = { freq: tl?.freq, years: tl?.range ?? 0, variant: panel.variants?.[0]?.key };
  // Variantes del mismo gráfico (p. ej. Nominal / Real): cada una trae sus propios datasets y, si hace falta, su unidad
  const active = () => (panel.variants ? { ...panel, ...panel.variants.find((v) => v.key === state.variant) } : panel);

  const now = head
    ? el('div', { class: 'panel-now' }, [
        el('div', { class: 'kpi-value', 'data-count': head.points[head.points.length - 1][1], 'data-dec': panel.headline.decimals, 'data-prefix': panel.headline.prefix ?? '', 'data-suffix': panel.headline.suffix ?? '' }, `${panel.headline.prefix ?? ''}${fmtNum(head.points[head.points.length - 1][1], panel.headline.decimals)}${panel.headline.suffix ?? ''}`),
        el('div', { class: 'unit' }, `${fmtDate(head.points[head.points.length - 1][0], head.freq)} · ${fmtAge(head.points[head.points.length - 1][0], head.freq)}`),
      ])
    : null;

  const current = () => (tl ? buildView(data, active(), state.freq) : { view: data, spec: active() });

  // Descarga lo que muestra el gráfico (con temporalidad propia: la serie en la frecuencia elegida; si no, todo el historial)
  const csvButton = el('button', { class: 'csv-btn', type: 'button', title: 'Descargar los datos del gráfico en CSV' }, 'Descargar CSV');
  csvButton.addEventListener('click', () => {
    const { view, spec } = current();
    const columns = spec.datasets.map((d) => ({ label: d.label, points: resolve(view, d.ref)?.points ?? [] })).filter((c) => c.points.length);
    if (columns.length) downloadCsv(`sigma-algebra-${panel.id}${tl ? `-${state.freq}` : ''}-${new Date().toISOString().slice(0, 10)}.csv`, seriesToCsv(columns));
  });

  const exportCsv = () => csvButton.click();
  let lastMonths = 36;
  const focusButton = el('button', { class: 'csv-btn', type: 'button', title: 'Ver el gráfico en grande, con sus últimos datos' }, 'Ampliar');
  focusButton.addEventListener('click', () => {
    const { view, spec } = current();
    openFocus(view, spec, tl ? (state.years ? state.years * 12 : 0) : lastMonths, node, exportCsv);
  });

  /* --- temporalidad propia del gráfico --- */
  let titleNode = el('h3', {}, panel.title);
  let controls = null;
  let metaNode = null;
  let freqBtns = [];
  let rangeBtns = [];
  let variantBtns = [];
  const unitNode = el('div', { class: 'unit' }, panel.unit);
  if (tl) {
    const originalFreq = data.byId[panel.datasets[0].ref.id]?.freq ?? 'M';
    const ok = new Set(derivable(originalFreq));
    // Si hay una serie oficial alternativa para esa frecuencia (p. ej. PBI anual), esa frecuencia también se ofrece
    for (const f of Object.keys(tl.byFreq ?? {})) ok.add(f);
    const offered = tl.freqs;
    freqBtns = offered.map((f) => {
      const b = el('button', { class: 'tl-btn', type: 'button', 'aria-pressed': String(f === state.freq), disabled: !ok.has(f), title: ok.has(f) ? FREQ_LABEL[f] : `${FREQ_LABEL[f]}: no disponible (el dato original es ${FREQ_LABEL[originalFreq].toLowerCase()} y no se puede desagregar)` }, FREQ_LABEL[f]);
      b.addEventListener('click', () => { state.freq = f; sync(); redraw(); });
      return b;
    });
    rangeBtns = RANGES.map(([y, label]) => {
      const b = el('button', { class: 'tl-btn', type: 'button', 'aria-pressed': String(y === state.years), title: y ? `Últimos ${y} años` : 'Toda la historia disponible' }, label);
      b.addEventListener('click', () => { state.years = y; sync(); redraw(); });
      return b;
    });
    variantBtns = (panel.variants ?? []).map((v) => {
      const b = el('button', { class: 'tl-btn', type: 'button', 'aria-pressed': String(v.key === state.variant), title: v.title ?? v.label }, v.label);
      b.addEventListener('click', () => { state.variant = v.key; sync(); redraw(); });
      return b;
    });
    controls = el('div', { class: 'tl' }, [
      variantBtns.length ? el('div', { class: 'tl-group', role: 'group', 'aria-label': 'Nominal o real' }, variantBtns) : null,
      el('div', { class: 'tl-group', role: 'group', 'aria-label': 'Frecuencia' }, freqBtns),
      el('div', { class: 'tl-group', role: 'group', 'aria-label': 'Rango' }, rangeBtns),
    ]);
    metaNode = el('p', { class: 'tl-meta' });
  }

  /** Habilita solo los rangos que caben en la historia de la serie y marca los botones activos */
  function sync() {
    if (!tl) return;
    const { view, spec, original, note } = current();
    const first = resolve(view, spec.datasets[0].ref);
    const span = first ? spanMonths(first.points) : 0;
    rangeBtns.forEach((b, i) => {
      const y = RANGES[i][0];
      b.disabled = y !== 0 && span < y * 12;
    });
    if (state.years && span < state.years * 12) state.years = [...RANGES].reverse().find(([y]) => y === 0 || span >= y * 12)?.[0] ?? 0;
    freqBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(tl.freqs[i] === state.freq)));
    rangeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(RANGES[i][0] === state.years)));
    variantBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(panel.variants[i].key === state.variant)));
    unitNode.textContent = spec.unit;
    titleNode.textContent = spec.title;
    // Fuente, frecuencia original del dato y fecha del último dato
    const baseSeries = resolve(data, spec.datasets[0].ref);
    const lastPoint = baseSeries?.points[baseSeries.points.length - 1];
    metaNode.textContent = [
      `Fuente: ${panel.source}`,
      `Frecuencia original: ${FREQ_LABEL[original ?? baseSeries?.freq ?? 'M'].toLowerCase()}`,
      note ? `Agregación: ${note}` : null,
      lastPoint ? `Último dato: ${fmtDate(lastPoint[0], baseSeries.freq)}` : null,
    ].filter(Boolean).join(' · ');
  }

  function redraw() {
    const { view, spec } = current();
    chart = drawChart(canvas, view, spec, state.years ? state.years * 12 : 0, chart);
  }

  // El id permite llegar al gráfico desde el buscador (pagina.html#id)
  const node = el('article', { class: 'panel', id: panel.id }, [
    el('div', { class: 'panel-head' }, [
      el('div', {}, [titleNode, unitNode]),
      now,
    ]),
    controls,
    el('div', { class: 'chart-box' }, canvas),
    ev?.card ?? null,
    ev?.list ?? null,
    el('details', {}, [el('summary', {}, 'Cómo leerlo'), el('p', {}, panel.read)]),
    metaNode,
    el('div', { class: 'src' }, [el('span', {}, tl ? '' : `Fuente: ${panel.source}`), el('span', { class: 'panel-actions' }, [focusButton, csvButton])]),
  ].filter(Boolean));

  if (tl) sync();

  return {
    node,
    update(months) {
      if (tl) { redraw(); return; } // con temporalidad propia no se usa el período general
      lastMonths = months;
      chart = drawChart(canvas, data, panel, months, chart);
    },
    destroy() {
      if (chart) chart.destroy();
      chart = null;
    },
  };
}
