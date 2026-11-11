/**
 * actividad.js — Argentina · Actividad económica.
 * Misma estructura que js/config/argentina.js (panels, analyze).
 */
import { fmtNum, fmtDate } from '../../lib/format.js';

export const actividad = {
  key: 'ar',
  name: 'Actividad',
  tagline: 'EMAE, sectores, PBI, industria, construcción y capacidad instalada',
  extraUrl: 'data/ar-extra.json', // series de tools/fetch-ar.py (EMAE y PBI desde 1993, sectores, ISAC, UCII)
  dataUrl: 'data/argentina.json',

  panels: [
    {
      id: 'act-emae-nivel', title: 'EMAE', unit: 'Índice 2004 = 100 · desestacionalizado · desde 1993', polarity: 'up',
      headline: { ref: { id: 'emae' }, decimals: 1, suffix: ' pts' },
      datasets: [{ ref: { id: 'emae_long' }, label: 'EMAE', type: 'line', color: 'accent', fill: true, decimals: 1 }],
      read: 'Estimador mensual de la actividad económica: anticipa el PBI. Una pendiente positiva indica que la economía crece frente al mes anterior, sin efecto estacional. Antes de 2004 se usa el EMAE base 1993, empalmado con la base 2004 actual (mismo crecimiento, distinta escala).',
      source: 'INDEC · EMAE base 1993 empalmado con base 2004 (datos.gob.ar)',
    },
    {
      id: 'act-emae-ia', title: 'EMAE, variación interanual', unit: 'Variación % contra el mismo mes del año anterior · serie original', polarity: 'up',
      headline: { ref: { id: 'emae_orig_long', t: 'yoy' }, decimals: 1, suffix: '%' },
      datasets: [{ ref: { id: 'emae_orig_long', t: 'yoy' }, label: 'EMAE', type: 'bar', color: 'accent', decimals: 1, signColors: true }],
      timeline: { kind: 'index', freq: 'M', range: 5, freqs: ['M', 'Q', 'A'], desc: { base: 'var. % i.a.', agg: 'var. % i.a. del promedio' } },
      read: 'Compara cada mes con el mismo mes del año anterior sobre la serie sin desestacionalizar: es la forma más directa de ver el ciclo, sin depender del ajuste estacional. Las barras rojas son caídas.',
      source: 'Cálculo propio sobre INDEC · EMAE original, base 1993 empalmado con base 2004',
    },
    {
      id: 'act-emae-var', title: 'EMAE, variación mensual', unit: 'Variación % contra el mes anterior · desestacionalizado', polarity: 'up',
      headline: { ref: { id: 'emae', t: 'pct1' }, decimals: 1, suffix: '%' },
      datasets: [{ ref: { id: 'emae_long', t: 'pct1' }, label: 'Var. mensual', type: 'bar', color: 'accent', decimals: 1, signColors: true }],
      read: 'Cuánto subió o bajó la actividad cada mes. Las barras rojas son meses de caída. Es una serie volátil: conviene mirar varios meses seguidos.',
      source: 'Cálculo propio sobre INDEC · EMAE desestacionalizado',
    },
    {
      id: 'act-sectores', type: 'heatmap', title: 'EMAE por sector', unit: 'Variación % interanual · cada celda es un sector en un período',
      rows: [
        ['emae_s_agro', 'Agro'], ['emae_s_pesca', 'Pesca'], ['emae_s_minas', 'Minas y canteras'], ['emae_s_industria', 'Industria manufacturera'],
        ['emae_s_electricidad', 'Electricidad, gas y agua'], ['emae_s_construccion', 'Construcción'], ['emae_s_comercio', 'Comercio'],
        ['emae_s_hoteles', 'Hoteles y restaurantes'], ['emae_s_transporte', 'Transporte y comunicaciones'], ['emae_s_financiero', 'Intermediación financiera'],
        ['emae_s_inmobiliario', 'Inmobiliarias y empresariales'], ['emae_s_admin', 'Administración pública'], ['emae_s_ensenanza', 'Enseñanza'], ['emae_s_salud', 'Salud'],
      ].map(([id, label]) => ({ ref: { id }, label })),
      kind: 'index', freqs: ['M', 'Q', 'A'], freq: 'M', range: 1, views: [['yoy', 'Interanual']], diverging: true, rowLabel: 'Sector',
      read: 'Cada fila es un sector del EMAE y cada columna, un período; el color muestra cuánto creció (verde) o cayó (rojo) contra el mismo período del año anterior. Sirve para ver qué sectores explican el ciclo. Con frecuencia trimestral o anual se compara el promedio del período.',
      source: 'INDEC · EMAE por sector de actividad, serie original base 2004 (datos.gob.ar)',
    },
    {
      id: 'act-pbi', title: 'PBI, variación interanual', unit: 'Variación % contra el mismo trimestre del año anterior · desde 1993', polarity: 'up',
      headline: { ref: { id: 'gdp_level', t: 'yoy' }, decimals: 1, suffix: '%' },
      datasets: [{ ref: { id: 'gdp_long', t: 'yoy' }, label: 'PBI', type: 'bar', color: 'accent', decimals: 1, signColors: true }],
      read: 'Crecimiento del PBI real comparado con el mismo trimestre de un año antes. Elimina la estacionalidad y muestra el ciclo de fondo. Antes de 2004, PBI base 1993 empalmado con la base 2004.',
      source: 'Cálculo propio sobre INDEC · PBI base 1993 empalmado con base 2004',
    },
    {
      id: 'act-pbi-sa', title: 'PBI desestacionalizado', unit: 'Variación % contra el trimestre anterior', polarity: 'up',
      headline: { ref: { id: 'gdp_sa', t: 'pct1' }, decimals: 1, suffix: '% t/t' },
      datasets: [{ ref: { id: 'gdp_sa', t: 'pct1' }, label: 'PBI desestacionalizado', type: 'bar', color: 'accent', decimals: 1, signColors: true }],
      timeline: { kind: 'index', freq: 'Q', range: 10, freqs: ['M', 'Q', 'A'], desc: { base: 'var. % t/t', agg: 'var. % del promedio' } },
      read: 'Cuánto creció la economía contra el trimestre inmediatamente anterior, sin efecto estacional. Es la medida más rápida para detectar cambios de tendencia: dos trimestres seguidos de caída suelen llamarse recesión técnica.',
      source: 'Cálculo propio sobre INDEC · PBI desestacionalizado, base 2004',
    },
    {
      id: 'act-ipi', title: 'Industria manufacturera (IPI)', unit: 'Índice base 2004 · desestacionalizado', polarity: 'up',
      headline: { ref: { id: 'ipi' }, decimals: 1, suffix: ' pts' },
      datasets: [{ ref: { id: 'ipi' }, label: 'IPI', type: 'line', color: 'accent', fill: true, decimals: 1 }],
      read: 'Mide el volumen físico de producción de la industria. Es más sensible al ciclo que el resto de la actividad y suele reflejar el consumo y la inversión.',
      source: 'INDEC · IPI manufacturero, serie desestacionalizada (datos.gob.ar)',
    },
    {
      id: 'act-isac', title: 'Construcción (ISAC)', unit: 'Índice sin estacionalidad · desde 1993', polarity: 'up',
      headline: { ref: { id: 'isac_long', t: 'yoy' }, decimals: 1, suffix: '% i.a.' },
      datasets: [{ ref: { id: 'isac_long' }, label: 'ISAC', type: 'line', color: 'accent', fill: true, decimals: 1 }],
      timeline: { kind: 'index', freq: 'M', range: 10, freqs: ['M', 'Q', 'A'], desc: { base: 'índice', agg: 'promedio del índice' } },
      bands: [{ from: '2007-01-01', to: '2011-12-31', label: 'Serie anterior, período de intervención del INDEC' }],
      read: 'Indicador sintético de la actividad de la construcción, a partir del consumo de insumos (cemento, hierro, ladrillos, etc.). Es de las actividades más volátiles: reacciona fuerte a la obra pública y al crédito. Hasta 2011, serie anterior empalmada con la actual; los datos de 2007-2011 corresponden al período de intervención del INDEC.',
      source: 'INDEC · ISAC serie anterior (hasta 2011) empalmada con la serie actual (datos.gob.ar)',
    },
    {
      id: 'act-ucii', title: 'Uso de la capacidad instalada', unit: '% de la capacidad de la industria en uso', polarity: 'up',
      headline: { ref: { id: 'ucii' }, decimals: 1, suffix: '%' },
      datasets: [
        // La serie anterior va primero: el gráfico toma la ventana de fechas de la primera serie
        { ref: { id: 'ucii_old' }, label: 'Metodología anterior (2002-2015)', type: 'line', color: 'series2', decimals: 1 },
        { ref: { id: 'ucii' }, label: 'Metodología actual (desde 2016)', type: 'line', color: 'accent', decimals: 1 },
      ],
      timeline: { kind: 'rate', freq: 'M', range: 0, freqs: ['M', 'Q', 'A'], desc: { base: '% de la capacidad', agg: 'promedio del período' } },
      read: 'Qué porcentaje de su capacidad de producción usa la industria. Un uso alto anticipa inversión; uno bajo indica capacidad ociosa. Las dos metodologías del INDEC no tienen un mes en común, así que se muestran como dos líneas sin unir.',
      source: 'INDEC · Utilización de la capacidad instalada en la industria (datos.gob.ar)',
    },
  ],

  analyze(g) {
    const emae = g({ id: 'emae', t: 'yoy' });
    const emaeM = g({ id: 'emae', t: 'pct1' });
    const ipi = g({ id: 'ipi', t: 'yoy' });
    const ipiM = g({ id: 'ipi', t: 'pct1' });
    const pbi = g({ id: 'gdp_level', t: 'yoy' });
    const items = [];
    let lead = '';
    if (emae && emaeM) {
      lead = `La actividad ${emae.last >= 0 ? 'crece' : 'cae'} ${fmtNum(Math.abs(emae.last))}% interanual en ${fmtDate(emae.date)}.`;
      items.push({ title: 'EMAE', text: `En el mes ${emaeM.last >= 0 ? 'subió' : 'bajó'} ${fmtNum(Math.abs(emaeM.last))}% sin estacionalidad (${fmtNum(emaeM.prev)}% el mes anterior).` });
    }
    if (ipi && ipiM) {
      items.push({ title: 'Industria', text: `El IPI ${ipi.last >= 0 ? 'crece' : 'cae'} ${fmtNum(Math.abs(ipi.last))}% interanual en ${fmtDate(ipi.date)}; en el mes, ${fmtNum(ipiM.last)}% (desestacionalizado).` });
    }
    if (pbi) {
      items.push({ title: 'PBI', text: `El PBI del ${fmtDate(pbi.date, 'Q')} ${pbi.last >= 0 ? 'creció' : 'cayó'} ${fmtNum(Math.abs(pbi.last))}% contra el mismo trimestre del año anterior.` });
    }
    return { lead, items };
  },
};
