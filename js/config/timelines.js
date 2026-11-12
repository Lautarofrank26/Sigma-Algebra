/**
 * timelines.js — temporalidad propia de cada gráfico (selectores de frecuencia y de rango).
 * Se indexa por el id del panel; app.js lo suma a la especificación del panel (un panel también puede traer su propio
 * `timeline`, como los del Resumen de Argentina en config/argentina.js). Cómo se interpreta: ver ui/panel.js.
 *
 *   kind    cómo se agrega la serie a una frecuencia más baja (ver lib/aggregate.js):
 *           flow = suma · stock = fin de período · price = promedio · index = promedio · rate = promedio ·
 *           inflation = índice a fin de período (la variación entre fines de período es la inflación compuesta)
 *   kinds   { idDeSerie: kind } cuando un mismo gráfico mezcla series de distinto tipo
 *   freq    frecuencia inicial · range: rango inicial en años (0 = máximo)
 *   freqs   frecuencias que se ofrecen; las que no se pueden derivar de la original quedan deshabilitadas (nunca se desagrega)
 *   desc    { base, agg } para el título: cuando se muestra la frecuencia original / cuando se agregó
 *   note    aclaración de la agregación en la leyenda (si no, se usa la regla del `kind`)
 *   byFreq  { A: { datasets } } serie oficial alternativa para una frecuencia, en vez de agregar a mano
 *
 * Todas las series que se publican hoy son mensuales, trimestrales o anuales: no hay serie diaria, así que
 * el tipo de cambio, las tasas y las reservas arrancan en mensual (no se puede ofrecer "diaria" sin inventar datos).
 */
const MQA = ['M', 'Q', 'A'];
const MQSA = ['M', 'Q', 'S', 'A'];
const QA = ['Q', 'A'];

const infl = (freq = 'M') => ({ kind: 'inflation', freq, range: 3, freqs: MQA, desc: { base: 'var. % m/m', agg: 'var. % compuesta' } });
const inflYoy = { kind: 'inflation', freq: 'M', range: 3, freqs: MQA, desc: { base: 'var. % i.a.', agg: 'var. % i.a. a fin de período' } };
const level = (kind, base, agg, extra = {}) => ({ kind, freq: 'M', range: 3, freqs: MQSA, desc: { base, agg }, ...extra });
const flow = (base = 'USD millones') => level('flow', base, 'suma del período');
const stock = (base) => level('stock', base, 'fin de período');
const rate = (base, extra = {}) => ({ kind: 'rate', freq: 'M', range: 3, freqs: MQA, desc: { base, agg: 'promedio del período' }, ...extra });

export const TIMELINES = {
  /* ---------- Argentina ---------- */
  'act-emae-nivel': { kind: 'index', freq: 'M', range: 3, freqs: MQA, desc: { base: 'índice desestacionalizado', agg: 'promedio del índice' } },
  'act-emae-var': { kind: 'index', freq: 'M', range: 3, freqs: MQA, desc: { base: 'var. % m/m', agg: 'var. % sobre el promedio' } },
  'act-ipi': { kind: 'index', freq: 'M', range: 3, freqs: MQA, desc: { base: 'índice', agg: 'promedio del índice' } },
  'act-pbi': {
    kind: 'index', freq: 'Q', range: 5, freqs: QA, desc: { base: 'var. % i.a.', agg: 'var. % i.a.' },
    byFreq: { A: { datasets: [{ ref: { id: 'gdp' }, label: 'PBI real, var. anual', type: 'bar', color: 'accent', decimals: 1, signColors: true }] } },
  },

  'pre-mensual': infl(),
  'pre-interanual': inflYoy,
  'pre-canastas': inflYoy,
  'pre-nivel': { kind: 'inflation', freq: 'M', range: 3, freqs: MQA, desc: { base: 'índice', agg: 'índice a fin de período' } },

  'emp-desempleo': { kind: 'rate', freq: 'Q', range: 5, freqs: QA, desc: { base: '% de la PEA', agg: 'promedio de los trimestres' } },
  'emp-actividad': { kind: 'rate', freq: 'Q', range: 5, freqs: QA, desc: { base: '% de la población', agg: 'promedio de los trimestres' } },
  'emp-salarios': inflYoy,
  'emp-salario-real': inflYoy,
  'emp-canastas': level('price', 'pesos por mes', 'promedio del período', { freqs: MQA }),

  'ext-comercio': flow(),
  'ext-saldo': flow(),
  'ext-saldo-12m': flow('acumulado de 12 meses'),

  'mon-badlar': { kind: 'price', kinds: { ipc: 'inflation' }, freq: 'M', range: 3, freqs: MQSA, desc: { base: '% anual / i.a.', agg: 'promedio y fin de período' } },
  'mon-m2': { kind: 'stock', freq: 'M', range: 3, freqs: MQSA, desc: { base: 'var. % i.a.', agg: 'var. % i.a. a fin de período' } },
  'mon-prestamos': { kind: 'stock', freq: 'M', range: 3, freqs: MQSA, desc: { base: 'var. % i.a.', agg: 'var. % i.a. a fin de período' } },
  'mon-depositos': { kind: 'stock', kinds: { ipc: 'inflation' }, freq: 'M', range: 3, freqs: MQSA, desc: { base: 'var. % i.a.', agg: 'var. % i.a. a fin de período' } },

  'fis-primario': flow('miles de millones de pesos'),
  'fis-financiero': flow('miles de millones de pesos'),
  'fis-acum': flow('acumulado de 12 meses'),

  'fx-tipos': level('price', 'pesos por dólar', 'promedio del período'),
  'fx-brecha': level('price', 'brecha %', 'promedio del período'),

  /* ---------- Estados Unidos ---------- */
  'uspre-comp': inflYoy,
  'uspre-vivienda': inflYoy,
  'uspre-mensual': infl(),
  'uspre-ppi': inflYoy,

  'usemp-desempleo': rate('% de la fuerza laboral'),
  'usemp-participacion': rate('%'),
  // El empleo es un nivel: la creación de puestos es la diferencia entre fines de período (= suma de las variaciones mensuales)
  'usemp-puestos': { kind: 'stock', freq: 'M', range: 3, freqs: MQA, desc: { base: 'miles de puestos por mes', agg: 'variación del período' }, note: 'variación entre fines de período' },
  'usemp-vacantes': { kind: 'stock', freq: 'M', range: 3, freqs: MQA, desc: { base: 'miles', agg: 'fin de período' } },
  'usemp-salarios': inflYoy,
  'usemp-horas': rate('horas por semana'),

  'ustas-fed': level('price', '% anual', 'promedio del período'),
  'ustas-curva': level('price', '% anual', 'promedio del período'),
  'ustas-pendiente': level('price', 'puntos porcentuales', 'promedio del período'),
  'ustas-deuda': stock('USD'),
  'ustas-deuda-var': { kind: 'stock', freq: 'M', range: 3, freqs: MQSA, desc: { base: 'var. % i.a.', agg: 'var. % i.a. a fin de período' } },

  // Resumen de EE.UU. (config/usa.js)
  'us-inflacion': inflYoy,
  'us-desempleo': rate('% de la fuerza laboral'),
  'us-empleo': { kind: 'stock', freq: 'M', range: 3, freqs: MQA, desc: { base: 'miles de puestos por mes', agg: 'variación del período' }, note: 'variación entre fines de período' },
  'us-salarios': inflYoy,
  'us-tasas': level('price', '% anual', 'promedio del período'),
  'us-pbi': { kind: 'index', freq: 'A', range: 10, freqs: ['A'], desc: { base: 'var. % anual', agg: 'var. % anual' } },
};
