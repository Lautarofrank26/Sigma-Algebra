/** fiscal.js — Argentina · Frente fiscal: resultados, ingresos y gastos, recaudación, riesgo país y deuda. */
import { fmtNum, fmtDate } from '../../lib/format.js';

/**
 * Real / Nominal de una serie de nivel (ids `<base>_real` y `<base>_nom` de tools/fetch-ar.py → fiscal()).
 * `per`: 'trimestre' (series trimestrales del esquema ahorro-inversión-financiamiento) o 'mes' (recaudación mensual).
 */
const nivel = (per, series, { freq, freqs, desc, range = 0 }) => ({
  variants: [
    { key: 'real', label: 'Real', unit: `Miles de millones de pesos del último ${per} con IPC (deflactado)`, datasets: series.map(([id, label, color]) => ({ ref: { id: `${id}_real` }, label, type: 'line', color, decimals: 0 })) },
    { key: 'nominal', label: 'Nominal', unit: 'Miles de millones de pesos corrientes', datasets: series.map(([id, label, color]) => ({ ref: { id: `${id}_nom` }, label, type: 'line', color, decimals: 0 })) },
  ],
  datasets: series.map(([id, label, color]) => ({ ref: { id: `${id}_real` }, label, type: 'line', color, decimals: 0 })),
  timeline: { kind: 'flow', freq, range, freqs, desc },
});
const Q = { freq: 'Q', freqs: ['Q', 'A'], desc: { base: 'suma del trimestre', agg: 'suma del período' } };

export const fiscal = {
  key: 'ar',
  name: 'Frente fiscal',
  tagline: 'Resultado primario y financiero, ingresos y gastos, recaudación, riesgo país y deuda',
  extraUrl: 'data/ar-extra.json', // series de tools/fetch-ar.py (ingresos y gastos por rubro, % del PBI, recaudación, riesgo país, deuda)
  dataUrl: 'data/argentina.json',

  panels: [
    {
      id: 'fis-primario', title: 'Resultado primario', unit: 'Miles de millones de pesos por mes', polarity: 'up',
      headline: { ref: { id: 'primary_balance', t: 'k' }, decimals: 0, prefix: '$', suffix: ' mil M' },
      datasets: [{ ref: { id: 'primary_balance', t: 'k' }, label: 'Primario', type: 'bar', color: 'accent', decimals: 0, signColors: true }],
      read: 'Ingresos menos gastos del Estado, sin contar los intereses de la deuda. Positivo es superávit: el Estado gasta menos de lo que recauda antes de pagar intereses.',
      source: 'Secretaría de Hacienda · Esquema ahorro-inversión-financiamiento (datos.gob.ar)',
    },
    {
      id: 'fis-financiero', title: 'Resultado financiero', unit: 'Miles de millones de pesos por mes', polarity: 'up',
      headline: { ref: { id: 'financial_balance', t: 'k' }, decimals: 0, prefix: '$', suffix: ' mil M' },
      datasets: [{ ref: { id: 'financial_balance', t: 'k' }, label: 'Financiero', type: 'bar', color: 'accent', decimals: 0, signColors: true }],
      read: 'Es el resultado después de pagar los intereses de la deuda. Positivo significa que el Estado no necesita financiarse ese mes; negativo, que debe endeudarse o emitir.',
      source: 'Secretaría de Hacienda · Sector Público Nacional, base caja (datos.gob.ar)',
    },
    {
      id: 'fis-pbi', title: 'Resultados en % del PBI', unit: '% del PBI · acumulado de 4 trimestres', polarity: 'up',
      headline: { ref: { id: 'fis_primario_pbi' }, decimals: 1, suffix: '% primario' },
      datasets: [
        { ref: { id: 'fis_primario_pbi' }, label: 'Primario', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'fis_financiero_pbi' }, label: 'Financiero', type: 'line', color: 'series2', decimals: 1 },
      ],
      timeline: { kind: 'stock', freq: 'Q', range: 0, freqs: ['Q', 'A'], desc: { base: 'acumulado de 4 trimestres', agg: 'a fin de período' } },
      read: 'La suma de los últimos cuatro trimestres del resultado sobre el PBI de ese año. Quita la estacionalidad (aguinaldo, vencimientos de impuestos) y permite comparar años con inflación muy distinta. Positivo es superávit. El PBI de cada año es el promedio de sus cuatro trimestres a precios corrientes (el INDEC los publica anualizados).',
      source: 'Cálculo propio: Secretaría de Hacienda (resultado primario y financiero, base caja) sobre PIB a precios corrientes del INDEC',
    },
    {
      id: 'fis-ing-gas', title: 'Ingresos y gastos primarios en términos reales', unit: 'Variación % interanual real · trimestral', polarity: 'none',
      headline: { ref: { id: 'fis_gas_real', t: 'yoy' }, decimals: 1, suffix: '% gasto real' },
      datasets: [
        { ref: { id: 'fis_ing_real', t: 'yoy' }, label: 'Ingresos totales', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'fis_gas_real', t: 'yoy' }, label: 'Gastos primarios', type: 'line', color: 'series2', decimals: 1 },
      ],
      timeline: { kind: 'flow', freq: 'Q', range: 0, freqs: ['Q', 'A'], desc: { base: 'var. % real i.a.', agg: 'var. % real i.a.' } },
      read: 'Cuánto crecieron (o cayeron) los ingresos y los gastos primarios respecto del mismo trimestre del año anterior, una vez descontada la inflación (IPC empalmado). Los gastos primarios son los gastos sin intereses de la deuda, y se calculan como ingresos totales menos resultado primario.',
      source: 'Cálculo propio: Secretaría de Hacienda (ingresos totales y resultado primario, base caja, trimestral) deflactado por el IPC empalmado',
    },
    {
      id: 'fis-ing-gas-nivel', title: 'Ingresos y gastos primarios', unit: 'Miles de millones de pesos del último trimestre con IPC (deflactado)', polarity: 'none',
      headline: { ref: { id: 'fis_gas_nom' }, decimals: 0, prefix: '$', suffix: ' mil M gastos (trim.)' },
      ...nivel('trimestre', [['fis_ing', 'Ingresos totales', 'accent'], ['fis_gas', 'Gastos primarios', 'series2']], Q),
      read: 'Ingresos totales y gastos primarios del Sector Público Nacional (base caja) por trimestre, en pesos corrientes o en pesos del último trimestre con IPC. La diferencia entre ambos es el resultado primario.',
      source: 'Secretaría de Hacienda · Esquema ahorro-inversión-financiamiento, trimestral; real: cálculo propio con el IPC empalmado',
    },
    {
      id: 'fis-gasto-rubros', title: 'Gasto primario por rubro: principales', unit: 'Miles de millones de pesos del último trimestre con IPC (deflactado)', polarity: 'none',
      headline: { ref: { id: 'fis_g_jub_nom' }, decimals: 0, prefix: '$', suffix: ' mil M jubilaciones (trim.)' },
      ...nivel('trimestre', [
        ['fis_g_jub', 'Jubilaciones y pensiones contributivas', 'accent'], ['fis_g_subs', 'Subsidios económicos', 'series2'],
        ['fis_g_prov', 'Transferencias corrientes a provincias', 'series2'], ['fis_g_cap', 'Gastos de capital (obra pública y transferencias de capital)', 'series2'],
      ], Q),
      read: 'Los rubros más grandes del gasto primario: jubilaciones y pensiones contributivas, subsidios económicos (energía, transporte y otros), transferencias corrientes a provincias y gastos de capital, que incluyen la obra pública. En pesos corrientes o del último trimestre con IPC.',
      source: 'Secretaría de Hacienda · Esquema ahorro-inversión-financiamiento, trimestral; real: cálculo propio con el IPC empalmado',
    },
    {
      id: 'fis-gasto-otros', title: 'Gasto primario por rubro: otros', unit: 'Miles de millones de pesos del último trimestre con IPC (deflactado)', polarity: 'none',
      headline: { ref: { id: 'fis_g_prest_nom' }, decimals: 0, prefix: '$', suffix: ' mil M otras prestaciones (trim.)' },
      ...nivel('trimestre', [
        ['fis_g_prest', 'Otras prestaciones sociales (PAMI, pensiones no contributivas, asignaciones y otros programas)', 'accent'],
        ['fis_g_func', 'Salarios y gastos de funcionamiento', 'series2'], ['fis_g_otros', 'Otros gastos primarios', 'series2'],
      ], Q),
      read: 'El resto del gasto primario: prestaciones sociales distintas de las jubilaciones (PAMI, pensiones no contributivas, asignaciones y otros programas), salarios y gastos de funcionamiento, y otros gastos. "Otros gastos primarios" es la diferencia entre el gasto total y los rubros publicados: incluye universidades, empresas públicas y los gastos de capital que el esquema no abre.',
      source: 'Secretaría de Hacienda · Esquema ahorro-inversión-financiamiento, trimestral; real: cálculo propio con el IPC empalmado',
    },
    {
      id: 'fis-recaudacion', title: 'Recaudación tributaria', unit: 'Miles de millones de pesos del último mes con IPC (deflactado) · desde 1997', polarity: 'up',
      headline: { ref: { id: 'rec_total_nom' }, decimals: 0, prefix: '$', suffix: ' mil M' },
      ...nivel('mes', [['rec_total', 'Recaudación total', 'accent'], ['rec_dgi', 'DGI (impuestos nacionales)', 'series2'], ['rec_dga', 'DGA (comercio exterior)', 'series2']],
        { freq: 'M', freqs: ['M', 'Q', 'S', 'A'], desc: { base: 'suma del mes', agg: 'suma del período' } }),
      read: 'Recaudación tributaria nacional mensual (Secretaría de Hacienda / ARCA), en pesos corrientes o del último mes con IPC. El total incluye los aportes a la seguridad social; la DGI reúne los impuestos nacionales (IVA, ganancias, internos y otros) y la DGA, los derechos de comercio exterior.',
      source: 'Secretaría de Hacienda / ARCA · Recaudación tributaria (datos.gob.ar); real: cálculo propio con el IPC empalmado',
    },
    {
      id: 'fis-riesgo', title: 'Riesgo país', unit: 'Puntos básicos · promedio mensual', polarity: 'down',
      headline: { ref: { id: 'riesgo_pais' }, decimals: 0, suffix: ' pb' },
      datasets: [{ ref: { id: 'riesgo_pais' }, label: 'EMBI Argentina', type: 'line', color: 'accent', fill: true, decimals: 0 }],
      timeline: { kind: 'price', freq: 'M', range: 10, freqs: ['M', 'Q', 'S', 'A'], desc: { base: 'puntos básicos', agg: 'promedio del período' } },
      read: 'Diferencia entre el rendimiento de los bonos soberanos argentinos en dólares y el de los bonos del Tesoro de EE.UU. (índice EMBI de JP Morgan). Cuanto más alto, más caro le sale financiarse al país y más riesgo ven los inversores. Cada punto es el promedio de los datos diarios del mes.',
      source: 'JP Morgan · EMBI Argentina, vía ArgentinaDatos',
    },
    {
      id: 'fis-deuda', title: 'Deuda bruta del gobierno general', unit: '% del PBI · anual', polarity: 'down',
      headline: { ref: { id: 'debt_gdp' }, decimals: 1, suffix: '% del PBI' },
      datasets: [{ ref: { id: 'debt_gdp' }, label: 'Deuda bruta', type: 'line', color: 'accent', fill: true, decimals: 1 }],
      timeline: { kind: 'index', freq: 'A', range: 10, freqs: ['A'], desc: { base: '% del PBI', agg: '% del PBI' } },
      read: 'Deuda bruta del gobierno general (Nación, provincias y municipios) sobre el PBI del año. Los picos de 2002 y 2023 reflejan sobre todo la devaluación: la deuda en dólares pesa más cuando el peso pierde valor. No se muestra por moneda: no hay una serie pública de periodicidad regular con esa apertura.',
      source: 'FMI · World Economic Outlook (deuda bruta del gobierno general, % del PBI)',
    },
  ],

  analyze(g) {
    const p = g({ id: 'primary_balance', t: 'k' });
    const f = g({ id: 'financial_balance', t: 'k' });
    const p12 = g({ id: 'primary_balance', t: 'sum12k' });
    const f12 = g({ id: 'financial_balance', t: 'sum12k' });
    const pp = g({ id: 'fis_primario_pbi' });
    const rp = g({ id: 'riesgo_pais' });
    const items = [];
    let lead = '';
    if (p) {
      lead = `El Estado tuvo un ${p.last >= 0 ? 'superávit' : 'déficit'} primario de $${fmtNum(Math.abs(p.last), 0)} mil millones en ${fmtDate(p.date)}.`;
    }
    if (f) {
      items.push({ title: 'Financiero', text: `Después de intereses, el resultado fue ${f.last >= 0 ? 'positivo' : 'negativo'} en $${fmtNum(Math.abs(f.last), 0)} mil millones.` });
    }
    if (p12 && f12) {
      items.push({ title: 'Doce meses', text: `En el último año el resultado primario acumula $${fmtNum(p12.last, 0)} mil millones y el financiero $${fmtNum(f12.last, 0)} mil millones (pesos corrientes).` });
    }
    if (pp) {
      items.push({ title: 'En % del PBI', text: `El resultado primario acumulado de cuatro trimestres es ${fmtNum(pp.last, 1)}% del PBI (${fmtDate(pp.date, 'Q')}).` });
    }
    if (rp) {
      items.push({ title: 'Riesgo país', text: `El riesgo país promedió ${fmtNum(rp.last, 0)} puntos básicos en ${fmtDate(rp.date)}, contra ${fmtNum(rp.back, 0)} tres meses antes.` });
    }
    items.push({ title: 'Nota', text: 'Las cifras en pesos corrientes no son comparables entre años lejanos: para eso están las series en términos reales y en % del PBI.' });
    return { lead, items };
  },
};
