/**
 * argentina.js — configuración de la sección Argentina.
 *
 * Para agregar un indicador:
 *   1. sumarlo en tools/fetch-data.ps1 (genera data/argentina.json)
 *   2. agregar un objeto a `panels` (gráfico) y/o `kpis` (tarjeta de resumen)
 *
 * Referencias de serie: { id, t } donde `t` es una transformación de lib/transform.js
 * polarity: 'down' = que baje es bueno · 'up' = que suba es bueno · 'none' = neutro
 */
import { fmtNum, fmtDate } from '../lib/format.js';

export const argentina = {
  key: 'ar',
  name: 'Argentina',
  tagline: 'Precios, actividad, empleo y sector externo',
  dataUrl: 'data/argentina.json',

  /** Tarjetas de resumen (arriba de los gráficos) */
  kpis: [
    { label: 'Inflación interanual', ref: { id: 'ipc', t: 'yoy' }, decimals: 1, suffix: '%', polarity: 'down' },
    { label: 'Inflación mensual', ref: { id: 'ipc', t: 'pct1' }, decimals: 1, suffix: '%', polarity: 'down' },
    { label: 'Actividad (EMAE) i.a.', ref: { id: 'emae', t: 'yoy' }, decimals: 1, suffix: '%', polarity: 'up', extra: { label: 'Mensual desest.', ref: { id: 'emae', t: 'pct1' }, decimals: 1, suffix: '%', signed: true } },
    { label: 'Desempleo', ref: { id: 'unemp' }, decimals: 1, suffix: '%', polarity: 'down' },
    { label: 'Dólar mayorista', ref: { id: 'fx' }, decimals: 0, prefix: '$', polarity: 'none' },
    { label: 'Reservas brutas', ref: { id: 'reserves' }, decimals: 0, prefix: 'USD ', suffix: ' M', polarity: 'up' },
  ],

  /** Paneles de gráfico */
  panels: [
    {
      id: 'ar-inflacion',
      title: 'Inflación',
      unit: 'Variación % · IPC nacional',
      polarity: 'down',
      headline: { ref: { id: 'ipc', t: 'yoy' }, decimals: 1, suffix: '% i.a.' },
      datasets: [
        { ref: { id: 'ipc', t: 'pct1' }, label: 'Variación del período (eje der.)', type: 'bar', color: 'series2', decimals: 1, axis: 'right' },
        { ref: { id: 'ipc', t: 'yoy' }, label: 'Interanual', type: 'line', color: 'accent', decimals: 1 },
      ],
      // Temporalidad propia del gráfico: inflación compuesta del período (no la suma de las tasas mensuales)
      timeline: { kind: 'inflation', freq: 'M', range: 3, freqs: ['M', 'Q', 'A'], desc: { base: 'var. % m/m', agg: 'var. % compuesta' } },
      read: 'Las barras muestran cuánto subieron los precios en cada mes; la línea, cuánto subieron respecto del mismo mes del año anterior. Si las barras bajan de forma sostenida, la línea interanual termina cediendo.',
      source: 'INDEC · IPC nivel general nacional (datos.gob.ar)',
    },
    {
      id: 'ar-actividad',
      title: 'Nivel de actividad',
      unit: 'EMAE desestacionalizado · índice 2004 = 100',
      polarity: 'up',
      headline: { ref: { id: 'emae' }, decimals: 1, suffix: ' pts' },
      datasets: [{ ref: { id: 'emae' }, label: 'EMAE', type: 'line', color: 'accent', fill: true, decimals: 1 }],
      timeline: { kind: 'index', freq: 'M', range: 3, freqs: ['M', 'Q', 'A'], desc: { base: 'índice desestacionalizado', agg: 'promedio del índice' } },
      read: 'El EMAE es el estimador mensual de actividad económica y anticipa el PBI. Al estar desestacionalizado, una pendiente positiva indica crecimiento real frente al mes anterior.',
      source: 'INDEC · EMAE base 2004 (datos.gob.ar)',
    },
    {
      id: 'ar-desempleo',
      title: 'Desempleo',
      unit: '% de la población económicamente activa · trimestral',
      polarity: 'down',
      headline: { ref: { id: 'unemp' }, decimals: 1, suffix: '%' },
      datasets: [{ ref: { id: 'unemp' }, label: 'Desocupación', type: 'line', color: 'accent', fill: true, decimals: 1 }],
      timeline: { kind: 'rate', freq: 'Q', range: 5, freqs: ['Q', 'A'], desc: { base: '% de la PEA', agg: 'promedio de los trimestres' } },
      read: 'Porcentaje de personas que buscan trabajo y no lo consiguen, medido en 31 aglomerados urbanos. Tiene fuerte estacionalidad: conviene comparar el mismo trimestre entre años.',
      source: 'INDEC · EPH continua, total aglomerados (datos.gob.ar)',
    },
    {
      id: 'ar-pbi',
      title: 'Crecimiento del PBI',
      unit: 'Variación % interanual del PBI real',
      polarity: 'up',
      headline: { ref: { id: 'gdp' }, decimals: 1, suffix: '%' },
      // Trimestral: serie del INDEC (variación interanual del nivel). Anual: serie oficial del Banco Mundial, no una suma de trimestres
      datasets: [{ ref: { id: 'gdp_level', t: 'yoy' }, label: 'PBI, var. i.a.', type: 'bar', color: 'accent', decimals: 1, signColors: true }],
      timeline: {
        kind: 'index', freq: 'Q', range: 5, freqs: ['Q', 'A'], desc: { base: 'var. % i.a.', agg: 'var. % i.a.' },
        byFreq: { A: { datasets: [{ ref: { id: 'gdp' }, label: 'PBI real, var. anual', type: 'bar', color: 'accent', decimals: 1, signColors: true }] } },
      },
      read: 'Cuánto creció (o cayó) el valor de todo lo producido, a precios constantes, frente al mismo período del año anterior. Las barras rojas son períodos de caída. La vista anual usa la serie anual del Banco Mundial.',
      source: 'INDEC (trimestral) · Banco Mundial NY.GDP.MKTP.KD.ZG (anual)',
    },
    {
      id: 'ar-fx',
      title: 'Tipo de cambio',
      unit: 'Pesos por dólar · mayorista, promedio mensual',
      polarity: 'none',
      headline: { ref: { id: 'fx' }, decimals: 0, prefix: '$' },
      datasets: [{ ref: { id: 'fx' }, label: 'Mayorista (A3500)', type: 'line', color: 'accent', fill: true, decimals: 0 }],
      timeline: { kind: 'price', freq: 'M', range: 3, freqs: ['M', 'Q', 'S', 'A'], desc: { base: 'pesos por dólar', agg: 'promedio del período' } },
      read: 'Precio del dólar en el mercado mayorista. Es una referencia clave para precios, costos y expectativas. Compararlo con la inflación indica si el peso se aprecia o se deprecia en términos reales.',
      source: 'BCRA · Com. A 3500 (datos.gob.ar)',
    },
    {
      id: 'ar-reservas',
      title: 'Reservas internacionales',
      unit: 'USD millones · fin de mes',
      polarity: 'up',
      headline: { ref: { id: 'reserves' }, decimals: 0, prefix: 'USD ', suffix: ' M' },
      datasets: [{ ref: { id: 'reserves' }, label: 'Reservas brutas', type: 'line', color: 'accent', fill: true, decimals: 0 }],
      timeline: { kind: 'stock', freq: 'M', range: 3, freqs: ['M', 'Q', 'S', 'A'], desc: { base: 'USD millones', agg: 'fin de período' } },
      read: 'Dólares que tiene el Banco Central. Son el respaldo para pagar deuda, intervenir en el mercado cambiario y sostener la confianza. Son reservas brutas: incluyen encajes y swaps.',
      source: 'BCRA · Reservas internacionales (datos.gob.ar)',
    },
  ],

  /** Genera la lectura macro a partir de los datos. `g(ref)` → {date,last,prev,back} */
  analyze(g) {
    const yoy = g({ id: 'ipc', t: 'yoy' });
    const mom = g({ id: 'ipc', t: 'pct1' });
    const emae = g({ id: 'emae', t: 'yoy' });
    const emaeLvl = g({ id: 'emae' });
    const un = g({ id: 'unemp' });
    const fx = g({ id: 'fx' });
    const fxY = g({ id: 'fx', t: 'yoy' });
    const res = g({ id: 'reserves' });
    const gdp = g({ id: 'gdp' });

    const items = [];
    let lead = '';

    if (yoy && mom) {
      const dir = yoy.last < yoy.back - 1 ? 'se desacelera' : yoy.last > yoy.back + 1 ? 'se acelera' : 'se mantiene estable';
      lead = `La inflación ${dir}: ${fmtNum(yoy.last)}% interanual en ${fmtDate(yoy.date)}.`;
      items.push({
        title: 'Precios',
        text: `Los precios subieron ${fmtNum(mom.last)}% en el mes (${fmtNum(mom.back)}% tres meses antes). La variación interanual ${yoy.back !== null ? `pasó de ${fmtNum(yoy.back)}% a ${fmtNum(yoy.last)}%` : `es ${fmtNum(yoy.last)}%`} en ese lapso.`,
      });
    }
    if (emae && emaeLvl) {
      const m = emaeLvl.prev ? (emaeLvl.last / emaeLvl.prev - 1) * 100 : null;
      items.push({
        title: 'Actividad',
        text: `El EMAE ${emae.last >= 0 ? 'crece' : 'cae'} ${fmtNum(Math.abs(emae.last))}% interanual en ${fmtDate(emae.date)}${m !== null ? ` y ${m >= 0 ? 'avanzó' : 'retrocedió'} ${fmtNum(Math.abs(m))}% contra el mes previo (sin estacionalidad)` : ''}.`,
      });
    }
    if (un) {
      const t = un.prev === null ? '' : un.last > un.prev ? 'subió' : un.last < un.prev ? 'bajó' : 'no cambió';
      items.push({
        title: 'Empleo',
        text: `La desocupación fue de ${fmtNum(un.last)}% en ${fmtDate(un.date, 'Q')}${t ? ` y ${t} frente al trimestre anterior (${fmtNum(un.prev)}%)` : ''}. Es una serie con estacionalidad: mirar el mismo trimestre del año previo.`,
      });
    }
    if (fx && yoy && fxY) {
      const real = fxY.last - yoy.last;
      items.push({
        title: 'Dólar y reservas',
        text: `El dólar mayorista promedió $${fmtNum(fx.last, 0)}, ${fmtNum(Math.abs(fxY.last))}% ${fxY.last >= 0 ? 'más' : 'menos'} que un año atrás, mientras los precios subieron ${fmtNum(yoy.last)}%: el peso se ${real < 0 ? 'apreció' : 'depreció'} en términos reales frente al dólar. ${res ? `Las reservas brutas cerraron ${fmtDate(res.date)} en USD ${fmtNum(res.last, 0)} M.` : ''}`,
      });
    }
    if (gdp) {
      items.push({
        title: 'Crecimiento anual',
        text: `El PBI real ${gdp.last >= 0 ? 'creció' : 'cayó'} ${fmtNum(Math.abs(gdp.last))}% en ${fmtDate(gdp.date, 'A')}, tras ${gdp.prev >= 0 ? 'crecer' : 'caer'} ${fmtNum(Math.abs(gdp.prev))}% el año anterior.`,
      });
    }
    return { lead, items };
  },
};

