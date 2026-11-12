/** monetario.js — Argentina · Dinero y tasas: tasas, base monetaria, M2, crédito y depósitos. */
import { fmtNum, fmtDate } from '../../lib/format.js';

/** Real / Nominal de una serie de nivel (ids `<base>_real` y `<base>_nom` de tools/fetch-ar.py → monetary()) */
const nivel = (unit, series) => ({
  variants: [
    { key: 'real', label: 'Real', unit: `${unit} del último mes con IPC (deflactado)`, datasets: series.map(([id, label, color]) => ({ ref: { id: `${id}_real` }, label, type: 'line', color, decimals: 0 })) },
    { key: 'nominal', label: 'Nominal', unit: `${unit} corrientes`, datasets: series.map(([id, label, color]) => ({ ref: { id: `${id}_nom` }, label, type: 'line', color, decimals: 0 })) },
  ],
  datasets: series.map(([id, label, color]) => ({ ref: { id: `${id}_real` }, label, type: 'line', color, decimals: 0 })),
  timeline: { kind: 'stock', freq: 'M', range: 0, freqs: ['M', 'Q', 'A'], desc: { base: 'promedio de datos diarios', agg: 'fin de período' } },
});

export const monetario = {
  key: 'ar',
  name: 'Dinero y tasas',
  tagline: 'Tasas de interés, base monetaria, M2, crédito y depósitos',
  extraUrl: 'data/ar-extra.json', // series de tools/fetch-ar.py (tasas, base, M2 privado, préstamos por tipo y depósitos)
  dataUrl: 'data/argentina.json',

  panels: [
    {
      id: 'mon-tasas', title: 'Tasas de interés en pesos', unit: '% anual (TNA) · promedio mensual', polarity: 'none',
      headline: { ref: { id: 'rate_pf30' }, decimals: 1, suffix: '% plazo fijo' },
      datasets: [
        { ref: { id: 'rate_pf30' }, label: 'Plazo fijo a 30 días (desde 1991)', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'rate_caucion' }, label: 'Caución a 1 día (desde 2008)', type: 'line', color: 'series2', decimals: 1 },
        { ref: { id: 'rate_policy' }, label: 'Tasa de política monetaria (dic-2015 a jun-2025)', type: 'line', color: 'series2', decimals: 1 },
      ],
      timeline: { kind: 'price', freq: 'M', range: 10, freqs: ['M', 'Q', 'A'], desc: { base: '% anual (TNA)', agg: 'promedio del período' } },
      read: 'Tasas nominales anuales. La de política monetaria es la que fijaba el BCRA y su serie oficial termina el 10 de julio de 2025; el plazo fijo a 30 días es lo que pagan los bancos a los ahorristas y la caución, el costo del dinero a un día entre inversores. Cada punto es el promedio de los datos diarios del mes.',
      source: 'BCRA · Estadísticas monetarias (tasa de política monetaria, depósitos a 30 días y pases entre terceros a 1 día)',
    },
    {
      id: 'mon-badlar', title: 'BADLAR y TAMAR vs. inflación', unit: '% anual', polarity: 'none',
      headline: { ref: { id: 'rate_badlar' }, decimals: 1, suffix: '% BADLAR' },
      datasets: [
        { ref: { id: 'rate_badlar' }, label: 'BADLAR bancos privados (TNA)', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'rate_tamar' }, label: 'TAMAR bancos privados (TNA, desde oct-2024)', type: 'line', color: 'series2', decimals: 1 },
        { ref: { id: 'ipc_long', t: 'yoy' }, label: 'Inflación interanual', type: 'line', color: 'series2', decimals: 1 },
      ],
      bands: [{ from: '2007-01-01', to: '2016-04-30', label: 'Intervención del INDEC: inflación con el IPC de San Luis (ene-2007 a abr-2016)' }],
      timeline: { kind: 'price', kinds: { ipc_long: 'inflation' }, freq: 'M', range: 10, freqs: ['M', 'Q', 'A'], desc: { base: '% anual / i.a.', agg: 'promedio y fin de período' } },
      read: 'BADLAR y TAMAR son las tasas que pagan los bancos por plazos fijos grandes (TAMAR, de más de $1.000 millones; BADLAR, de más de $1 millón) y sirven de referencia para el costo del dinero. Si están por encima de la inflación de los últimos doce meses, ahorrar en pesos rinde en términos reales. La inflación sale del IPC empalmado, así que la serie larga incluye el tramo 2007-2016 con el IPC de San Luis.',
      source: 'BCRA · BADLAR y TAMAR bancos privados; inflación: IPC empalmado (BCRA / INDEC, con IPC San Luis 2007-2016)',
    },
    {
      id: 'mon-real-exante', title: 'Tasa real ex ante', unit: '% anual, efectiva · BADLAR vs. inflación esperada a 12 meses (REM)', polarity: 'none',
      headline: { ref: { id: 'rate_real_exante' }, decimals: 1, suffix: '% real' },
      datasets: [
        { ref: { id: 'rate_real_exante' }, label: 'Tasa real ex ante', type: 'line', color: 'accent', fill: true, decimals: 1 },
      ],
      timeline: { kind: 'rate', freq: 'M', range: 10, freqs: ['M', 'Q', 'A'], desc: { base: '% real anual', agg: 'promedio del período' } },
      read: 'Lo que rinde un plazo fijo en pesos después de descontar la inflación que los analistas esperan para los próximos 12 meses. Se calcula con la BADLAR convertida a tasa efectiva anual (capitalización a 30 días) sobre la mediana del Relevamiento de Expectativas de Mercado (REM) del BCRA: (1 + tasa efectiva) / (1 + inflación esperada) − 1. Por encima de cero, ahorrar en pesos rinde más que la inflación esperada; por debajo, rinde menos. Es un dato ex ante: no mira la inflación que ocurrió después.',
      source: 'Cálculo propio: BCRA · BADLAR bancos privados y Relevamiento de Expectativas de Mercado (mediana, 12 meses)',
    },
    {
      id: 'mon-base', title: 'Base monetaria', unit: 'Miles de millones de pesos del último mes con IPC (deflactado)', polarity: 'none',
      headline: { ref: { id: 'base_nom' }, decimals: 0, prefix: '$', suffix: ' mil millones' },
      ...nivel('Miles de millones de pesos', [['base', 'Base monetaria', 'accent']]),
      read: 'Base monetaria: billetes y monedas en circulación más los depósitos de los bancos en el BCRA. En términos reales (deflactada por el IPC empalmado), muestra cuánto poder de compra representa el dinero que emitió el BCRA. Cada punto es el promedio de los datos diarios del mes.',
      source: 'BCRA · Base monetaria (promedio mensual); real: cálculo propio con el IPC empalmado',
    },
    {
      id: 'mon-m2', title: 'Dinero (M2 privado)', unit: 'Variación % interanual', polarity: 'none',
      headline: { ref: { id: 'm2_real', t: 'yoy' }, decimals: 1, suffix: '% real' },
      datasets: [
        { ref: { id: 'm2', t: 'yoy' }, label: 'Nominal', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'm2_real', t: 'yoy' }, label: 'Real (descontando IPC)', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'M2 incluye billetes, cuentas corrientes y cajas de ahorro. El dato real descuenta la inflación: muestra si hay más o menos dinero en términos de poder de compra.',
      source: 'BCRA · Agregados monetarios; cálculo propio con IPC',
    },
    {
      id: 'mon-m2-nivel', title: 'M2 privado en pesos', unit: 'Miles de millones de pesos del último mes con IPC (deflactado) · desde 2010', polarity: 'none',
      headline: { ref: { id: 'm2p_nom' }, decimals: 0, prefix: '$', suffix: ' mil millones' },
      ...nivel('Miles de millones de pesos', [['m2p', 'M2 privado', 'accent']]),
      read: 'Nivel de M2 privado (billetes y monedas en poder del público más depósitos a la vista del sector privado) en pesos del último mes con IPC. Muestra la cantidad de dinero en términos de poder de compra, no su variación.',
      source: 'BCRA · M2 privado, promedio mensual (datos.gob.ar); real: cálculo propio con el IPC empalmado',
    },
    {
      id: 'mon-prestamos', title: 'Préstamos al sector privado', unit: 'Variación % interanual · pesos', polarity: 'up',
      headline: { ref: { id: 'loans_real', t: 'yoy' }, decimals: 1, suffix: '% real' },
      datasets: [
        { ref: { id: 'loans', t: 'yoy' }, label: 'Nominal', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'loans_real', t: 'yoy' }, label: 'Real (descontando IPC)', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'Crédito en pesos de los bancos a familias y empresas. Si crece en términos reales, el crédito acompaña (o impulsa) la actividad.',
      source: 'BCRA · Préstamos al sector privado; cálculo propio con IPC',
    },
    {
      id: 'mon-prest-total', title: 'Préstamos en pesos al sector privado', unit: 'Miles de millones de pesos del último mes con IPC (deflactado) · desde 2002', polarity: 'up',
      headline: { ref: { id: 'loans_total_nom' }, decimals: 0, prefix: '$', suffix: ' mil millones' },
      ...nivel('Miles de millones de pesos', [['loans_total', 'Total de préstamos', 'accent']]),
      read: 'Stock de préstamos en pesos de los bancos a familias y empresas, en pesos del último mes con IPC. Complementa al gráfico de variación interanual: acá se ve el nivel de crédito en términos de poder de compra.',
      source: 'BCRA · Préstamos al sector privado, promedio mensual; real: cálculo propio con el IPC empalmado',
    },
    {
      id: 'mon-prest-consumo', title: 'Préstamos por tipo: consumo y garantizados', unit: 'Miles de millones de pesos del último mes con IPC (deflactado) · desde 2002', polarity: 'none',
      headline: { ref: { id: 'loans_personal_nom' }, decimals: 0, prefix: '$', suffix: ' mil millones personales' },
      ...nivel('Miles de millones de pesos', [
        ['loans_personal', 'Personales', 'accent'], ['loans_tarjeta', 'Tarjetas de crédito', 'series2'],
        ['loans_hipot', 'Hipotecarios', 'series2'], ['loans_prend', 'Prendarios', 'series2'],
      ]),
      read: 'Préstamos en pesos a las familias (personales y tarjetas) y los que tienen una garantía (hipotecarios sobre la vivienda y prendarios sobre un vehículo). En pesos del último mes con IPC.',
      source: 'BCRA · Préstamos al sector privado por tipo, promedio mensual; real: cálculo propio con el IPC empalmado',
    },
    {
      id: 'mon-prest-comercial', title: 'Préstamos por tipo: comerciales y otros', unit: 'Miles de millones de pesos del último mes con IPC (deflactado) · desde 2002', polarity: 'none',
      headline: { ref: { id: 'loans_doc_nom' }, decimals: 0, prefix: '$', suffix: ' mil millones documentos' },
      ...nivel('Miles de millones de pesos', [
        ['loans_doc', 'Documentos', 'accent'], ['loans_adel', 'Adelantos en cuenta corriente', 'series2'], ['loans_otros', 'Otros', 'series2'],
      ]),
      read: 'Préstamos en pesos mediante documentos (descuento de cheques y pagarés) y adelantos en cuenta corriente, que usan sobre todo las empresas para financiar su capital de trabajo, más otros préstamos. En pesos del último mes con IPC.',
      source: 'BCRA · Préstamos al sector privado por tipo, promedio mensual; real: cálculo propio con el IPC empalmado',
    },
    {
      id: 'mon-depositos', title: 'Plazos fijos en pesos', unit: 'Variación % interanual · nominal', polarity: 'none',
      headline: { ref: { id: 'time_deposits', t: 'yoy' }, decimals: 1, suffix: '%' },
      datasets: [
        { ref: { id: 'time_deposits', t: 'yoy' }, label: 'Plazos fijos', type: 'line', color: 'accent', fill: true, decimals: 1 },
        { ref: { id: 'ipc', t: 'yoy' }, label: 'Inflación', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'Cuánto crecieron los depósitos a plazo fijo en pesos. Si crecen más que la inflación, el público está ahorrando más en pesos en términos reales.',
      source: 'BCRA · Depósitos del sector privado (datos.gob.ar)',
    },
    {
      id: 'mon-dep-pesos', title: 'Depósitos en pesos del sector privado', unit: 'Miles de millones de pesos del último mes con IPC (deflactado) · desde 2002', polarity: 'up',
      headline: { ref: { id: 'dep_pesos_nom' }, decimals: 0, prefix: '$', suffix: ' mil millones' },
      ...nivel('Miles de millones de pesos', [['dep_pesos', 'Depósitos en pesos', 'accent']]),
      read: 'Depósitos en pesos del sector privado no financiero (cuentas corrientes, cajas de ahorro, plazos fijos y otros), en pesos del último mes con IPC. Muestra cuánto ahorro y liquidez en pesos mantiene el público en los bancos.',
      source: 'BCRA · Depósitos del sector privado no financiero en pesos, promedio mensual; real: cálculo propio con el IPC empalmado',
    },
    {
      id: 'mon-dep-usd', title: 'Depósitos en dólares del sector privado', unit: 'Millones de USD · desde 2002', polarity: 'none',
      headline: { ref: { id: 'dep_usd_nom' }, decimals: 0, prefix: 'USD ', suffix: ' millones' },
      datasets: [{ ref: { id: 'dep_usd_nom' }, label: 'Depósitos en dólares', type: 'line', color: 'accent', fill: true, decimals: 0 }],
      timeline: { kind: 'stock', freq: 'M', range: 0, freqs: ['M', 'Q', 'A'], desc: { base: 'promedio de datos diarios', agg: 'fin de período' } },
      read: 'Depósitos en dólares del sector privado no financiero en los bancos argentinos, en millones de dólares. Es una serie en moneda extranjera: no se deflacta por el IPC argentino.',
      source: 'BCRA · Depósitos del sector privado no financiero en dólares, promedio mensual',
    },
  ],

  analyze(g) {
    const bad = g({ id: 'rate_badlar' });
    const ipc = g({ id: 'ipc', t: 'yoy' });
    const m2r = g({ id: 'm2_real', t: 'yoy' });
    const lr = g({ id: 'loans_real', t: 'yoy' });
    const pf = g({ id: 'time_deposits', t: 'yoy' });
    const items = [];
    let lead = '';
    if (bad && ipc) {
      lead = `La tasa BADLAR es ${fmtNum(bad.last)}% anual en ${fmtDate(bad.date)}, contra una inflación interanual de ${fmtNum(ipc.last)}%.`;
      items.push({ title: 'Tasas', text: `BADLAR estaba en ${fmtNum(bad.back)}% tres meses antes. La tasa ${bad.last >= ipc.last ? 'supera' : 'queda por debajo de'} la inflación de los últimos doce meses.` });
    }
    if (m2r) {
      items.push({ title: 'Dinero', text: `El M2 privado ${m2r.last >= 0 ? 'crece' : 'cae'} ${fmtNum(Math.abs(m2r.last))}% interanual en términos reales.` });
    }
    if (lr) {
      items.push({ title: 'Crédito', text: `Los préstamos en pesos ${lr.last >= 0 ? 'crecen' : 'caen'} ${fmtNum(Math.abs(lr.last))}% interanual en términos reales.` });
    }
    if (pf && ipc) {
      items.push({ title: 'Depósitos', text: `Los plazos fijos en pesos crecen ${fmtNum(pf.last)}% interanual, ${pf.last >= ipc.last ? 'más' : 'menos'} que la inflación.` });
    }
    return { lead, items };
  },
};
