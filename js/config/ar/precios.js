/** precios.js — Argentina · Precios: IPC empalmado, categorías, divisiones, mayoristas, expectativas y canastas. */
import { fmtNum, fmtDate } from '../../lib/format.js';

/** Período de intervención del INDEC: en los gráficos de precios se sombrea y el IPC se reemplaza por el de San Luis */
const INDEC_BAND = { from: '2007-01-01', to: '2015-12-31', label: 'Intervención del INDEC: IPC San Luis' };

export const precios = {
  key: 'ar',
  name: 'Precios',
  tagline: 'IPC empalmado, categorías, divisiones, mayoristas, expectativas y canastas',
  dataUrl: 'data/argentina.json',
  extraUrl: 'data/ar-extra.json', // series de tools/fetch-ar.py (IPC empalmado, divisiones, IPIM, REM)

  panels: [
    {
      id: 'pre-mensual', title: 'Inflación mensual', unit: 'Variación % mensual · IPC empalmado desde 1943', polarity: 'down',
      headline: { ref: { id: 'ipc', t: 'pct1' }, decimals: 1, suffix: '%' },
      datasets: [
        { ref: { id: 'ipc_long', t: 'pct1' }, label: 'IPC nivel general', type: 'line', color: 'accent', decimals: 1 },
      ],
      bands: [INDEC_BAND],
      read: 'Variación de precios contra el mes anterior. Serie empalmada: inflación mensual oficial del BCRA (IPC del INDEC) desde 1943; entre enero de 2007 y abril de 2016, IPC de la Provincia de San Luis, porque el IPC del INDEC de esos años no es confiable (zona sombreada); desde diciembre de 2016, IPC nacional del INDEC. Con rango Máx se ven las hiperinflaciones de 1989-1990.',
      source: 'BCRA (inflación mensual, IPC INDEC) · IPC San Luis (ene-2007 a abr-2016) · INDEC, IPC nacional base dic 2016',
    },
    {
      id: 'pre-interanual', title: 'Inflación interanual', unit: 'Variación % contra el mismo mes del año anterior · IPC empalmado', polarity: 'down',
      headline: { ref: { id: 'ipc', t: 'yoy' }, decimals: 1, suffix: '%' },
      datasets: [
        { ref: { id: 'ipc_long', t: 'yoy' }, label: 'IPC nivel general', type: 'line', color: 'accent', decimals: 1 },
      ],
      bands: [INDEC_BAND],
      read: 'Inflación acumulada en doce meses. Misma serie empalmada que el gráfico mensual: en la zona sombreada (2007-2015) se usa el IPC de San Luis en lugar del IPC del INDEC intervenido.',
      source: 'Cálculo propio sobre BCRA, IPC San Luis e INDEC (IPC empalmado)',
    },
    {
      id: 'pre-categorias', title: 'Núcleo, regulados y estacionales', unit: 'Variación % mensual por categoría del IPC', polarity: 'down',
      headline: { ref: { id: 'core', t: 'pct1' }, decimals: 1, suffix: '% núcleo' },
      datasets: [
        { ref: { id: 'core', t: 'pct1' }, label: 'Núcleo', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'regulated', t: 'pct1' }, label: 'Regulados', type: 'line', color: 'series2', decimals: 1 },
        { ref: { id: 'seasonal', t: 'pct1' }, label: 'Estacionales', type: 'line', color: 'series2', decimals: 1 },
      ],
      timeline: { kind: 'inflation', freq: 'M', range: 3, freqs: ['M', 'Q', 'A'], desc: { base: 'var. % m/m', agg: 'var. % compuesta' } },
      read: 'El núcleo excluye regulados y estacionales y muestra la tendencia de fondo. Los regulados (tarifas, combustibles, transporte, prepagas) dependen de decisiones de política; los estacionales (frutas, verduras, ropa, turismo) cambian con la época del año y son muy volátiles.',
      source: 'INDEC · IPC nacional por categorías, base dic 2016 (datos.gob.ar)',
    },
    {
      id: 'pre-divisiones', type: 'heatmap', title: 'IPC por división', unit: 'Variación %, nacional · cada celda es una división en un período',
      rows: [
        ['div_alimentos', 'Alimentos y bebidas no alcohólicas'], ['div_bebidas', 'Bebidas alcohólicas y tabaco'],
        ['div_prendas', 'Prendas de vestir y calzado'], ['div_vivienda', 'Vivienda, agua, electricidad y combustibles'],
        ['div_equipamiento', 'Equipamiento y mantenimiento del hogar'], ['div_salud', 'Salud'], ['div_transporte', 'Transporte'],
        ['div_comunicacion', 'Comunicación'], ['div_recreacion', 'Recreación y cultura'], ['div_educacion', 'Educación'],
        ['div_restaurantes', 'Restaurantes y hoteles'], ['div_varios', 'Bienes y servicios varios'],
      ].map(([id, label]) => ({ ref: { id }, label })),
      kind: 'inflation', freqs: ['M', 'Q', 'A'], freq: 'M', range: 1,
      views: [['pct1', 'Var. del período'], ['yoy', 'Interanual']],
      read: 'Cada fila es una de las 12 divisiones del IPC y cada columna, un período. Cuanto más intenso el color, más subieron esos precios: así se ve qué rubros empujaron la inflación de cada mes. Con frecuencia trimestral o anual, la variación es compuesta.',
      source: 'INDEC · IPC nacional por división, base dic 2016 (datos.gob.ar)',
    },
    {
      id: 'pre-mayorista', title: 'Mayoristas vs. minoristas', unit: 'Variación % interanual · IPIM y IPC', polarity: 'down',
      headline: { ref: { id: 'ipim_yoy' }, decimals: 1, suffix: '% IPIM' },
      datasets: [
        { ref: { id: 'ipim_yoy' }, label: 'Mayoristas (IPIM)', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'ipc_long', t: 'yoy' }, label: 'Minoristas (IPC)', type: 'line', color: 'series2', decimals: 1 },
      ],
      timeline: { kind: 'inflation', kinds: { ipim_yoy: 'stock' }, freq: 'M', range: 10, freqs: ['M', 'Q', 'A'], desc: { base: 'var. % i.a.', agg: 'var. % i.a. a fin de período' }, note: 'variación interanual a fin de período' },
      bands: [{ ...INDEC_BAND, label: 'Intervención del INDEC (IPIM oficial)' }],
      read: 'Los precios mayoristas (IPIM, lo que pagan comercios e industrias) suelen anticipar a los minoristas: si el IPIM sube más rápido, es posible que esa suba llegue después al consumidor. Entre nov-2015 y nov-2016 no hay dato del IPIM: cambió la base y las dos series no se pueden empalmar. El IPIM de 2007-2015 es el oficial del INDEC y debe leerse con cautela.',
      source: 'INDEC · IPIM base 1993 y base dic 2015; IPC empalmado (BCRA, San Luis, INDEC)',
    },
    {
      id: 'pre-expectativas', title: 'Inflación observada vs. esperada', unit: 'Variación % interanual · expectativa del REM hecha 12 meses antes', polarity: 'down',
      headline: { ref: { id: 'rem_12m' }, decimals: 1, suffix: '% esperada' },
      datasets: [
        { ref: { id: 'ipc_long', t: 'yoy' }, label: 'Inflación observada', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'rem_12m_target' }, label: 'Esperada 12 meses antes (REM, mediana)', type: 'line', color: 'series2', decimals: 1 },
      ],
      timeline: { kind: 'inflation', kinds: { rem_12m_target: 'stock' }, freq: 'M', range: 5, freqs: ['M', 'Q', 'A'], desc: { base: 'var. % i.a.', agg: 'var. % i.a. a fin de período' }, note: 'variación interanual a fin de período' },
      bands: [INDEC_BAND],
      read: 'Compara la inflación de los últimos doce meses con lo que esperaban los analistas del Relevamiento de Expectativas de Mercado (REM) del BCRA un año antes. Si la observada queda por encima, la inflación sorprendió al alza. La cifra grande es la expectativa más reciente para los próximos 12 meses.',
      source: 'BCRA · REM, mediana de la inflación esperada a 12 meses; IPC empalmado (BCRA, San Luis, INDEC)',
    },
    {
      id: 'pre-canastas', title: 'Canastas básicas', unit: 'Variación % interanual · comparadas con el IPC', polarity: 'down',
      headline: { ref: { id: 'poverty_line', t: 'yoy' }, decimals: 1, suffix: '% total' },
      datasets: [
        { ref: { id: 'poverty_line', t: 'yoy' }, label: 'Canasta total (pobreza)', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'indigence_line', t: 'yoy' }, label: 'Canasta alimentaria (indigencia)', type: 'line', color: '--fx-mep', decimals: 1 },
        { ref: { id: 'ipc', t: 'yoy' }, label: 'IPC general', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'La canasta alimentaria define la línea de indigencia y la total, la de pobreza. Si suben más que el IPC, los alimentos y servicios básicos se encarecen más que el promedio.',
      source: 'INDEC · Canastas básicas (datos.gob.ar)',
    },
    {
      id: 'pre-nivel', title: 'Nivel de precios', unit: 'Índice dic 2016 = 100', polarity: 'none',
      headline: { ref: { id: 'ipc' }, decimals: 0, suffix: ' pts' },
      datasets: [
        { ref: { id: 'ipc' }, label: 'General', type: 'line', color: 'accent', decimals: 0 },
        { ref: { id: 'core' }, label: 'Núcleo', type: 'line', color: 'series2', decimals: 0 },
        { ref: { id: 'regulated' }, label: 'Regulados', type: 'line', color: '--fx-blue', decimals: 0 },
      ],
      read: 'Cuánto se acumuló el aumento de precios desde diciembre de 2016, cuando el índice valía 100. Si una línea se separa de las otras, ese grupo subió más que el resto.',
      source: 'INDEC · IPC nacional, base dic 2016 (datos.gob.ar)',
    },
  ],

  analyze(g) {
    const yoy = g({ id: 'ipc', t: 'yoy' });
    const mom = g({ id: 'ipc', t: 'pct1' });
    const coreM = g({ id: 'core', t: 'pct1' });
    const coreY = g({ id: 'core', t: 'yoy' });
    const regY = g({ id: 'regulated', t: 'yoy' });
    const cba = g({ id: 'indigence_line', t: 'yoy' });
    const cbt = g({ id: 'poverty_line', t: 'yoy' });
    const items = [];
    let lead = '';
    if (yoy && mom) {
      lead = `Los precios subieron ${fmtNum(mom.last)}% en ${fmtDate(mom.date)} y ${fmtNum(yoy.last)}% en doce meses.`;
      items.push({ title: 'General', text: `La inflación mensual fue ${fmtNum(mom.last)}% (${fmtNum(mom.back)}% tres meses antes). La interanual pasó de ${fmtNum(yoy.back)}% a ${fmtNum(yoy.last)}%.` });
    }
    if (coreM && coreY && yoy) {
      const gap = coreY.last - yoy.last;
      items.push({ title: 'Núcleo', text: `El núcleo subió ${fmtNum(coreM.last)}% en el mes y ${fmtNum(coreY.last)}% interanual, ${fmtNum(Math.abs(gap))} pp ${gap >= 0 ? 'por encima' : 'por debajo'} del índice general.` });
    }
    if (regY && yoy) {
      items.push({ title: 'Regulados', text: `Los precios regulados suben ${fmtNum(regY.last)}% interanual, ${regY.last >= yoy.last ? 'más' : 'menos'} que el promedio (${fmtNum(yoy.last)}%).` });
    }
    if (cba && cbt && yoy) {
      items.push({ title: 'Canastas', text: `La canasta total subió ${fmtNum(cbt.last)}% interanual y la alimentaria ${fmtNum(cba.last)}%, frente a ${fmtNum(yoy.last)}% del IPC.` });
    }
    return { lead, items };
  },
};
