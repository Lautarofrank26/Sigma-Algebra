/**
 * usa.js — configuración de la sección Estados Unidos.
 * Misma estructura que argentina.js; ver comentarios allí.
 */
import { fmtNum, fmtDate } from '../lib/format.js';

export const usa = {
  key: 'us',
  name: 'Estados Unidos',
  tagline: 'Precios, mercado laboral, tasas y crecimiento',
  dataUrl: 'data/usa.json',

  kpis: [
    { label: 'Inflación CPI i.a.', ref: { id: 'cpi', t: 'yoy' }, decimals: 1, suffix: '%', polarity: 'down' },
    { label: 'Inflación subyacente i.a.', ref: { id: 'corecpi', t: 'yoy' }, decimals: 1, suffix: '%', polarity: 'down' },
    { label: 'Desempleo', ref: { id: 'unemp' }, decimals: 1, suffix: '%', polarity: 'down' },
    { label: 'Fed funds (efectiva)', ref: { id: 'fedfunds' }, decimals: 2, suffix: '%', polarity: 'none' },
    { label: 'Bono del Tesoro 10 años', ref: { id: 'y10' }, decimals: 2, suffix: '%', polarity: 'none' },
  ],

  /** Tabla resumen: indicadores mensuales, últimos 6 meses (ver ui/summary.js) */
  summary: [
    { label: 'Inflación mensual (CPI)', note: 'BLS · var. %', ref: { id: 'cpi', t: 'pct1' }, decimals: 1, kind: 'change', trend: true, polarity: 'down' },
    { label: 'Inflación interanual', note: 'BLS · var. %', ref: { id: 'cpi', t: 'yoy' }, decimals: 1, kind: 'change', trend: true, polarity: 'down' },
    { label: 'Inflación subyacente i.a.', note: 'BLS · var. %', ref: { id: 'corecpi', t: 'yoy' }, decimals: 1, kind: 'change', trend: true, polarity: 'down' },
    { label: 'Desempleo', note: 'BLS · nivel', ref: { id: 'unemp' }, decimals: 1, suffix: '%', kind: 'level', polarity: 'down' },
    { label: 'Empleo no agrícola', note: 'BLS · cambio mensual, miles', ref: { id: 'payrolls', t: 'diff' }, decimals: 0, kind: 'level', polarity: 'up' },
    { label: 'Salario horario i.a.', note: 'BLS · var. %', ref: { id: 'ahe', t: 'yoy' }, decimals: 1, kind: 'change', polarity: 'none' },
    { label: 'Bono del Tesoro 10 años', note: 'Treasury · nivel', ref: { id: 'y10' }, decimals: 2, suffix: '%', kind: 'level', polarity: 'none' },
  ],

  panels: [
    {
      id: 'us-inflacion',
      title: 'Inflación',
      unit: 'Variación % interanual · CPI-U',
      polarity: 'down',
      headline: { ref: { id: 'cpi', t: 'yoy' }, decimals: 1, suffix: '%' },
      datasets: [
        { ref: { id: 'cpi', t: 'yoy' }, label: 'General', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'corecpi', t: 'yoy' }, label: 'Subyacente', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'El CPI mide el precio de una canasta de consumo. La subyacente excluye alimentos y energía, que son volátiles, y es la que mira la Reserva Federal. La meta de la Fed es 2% anual.',
      source: 'BLS · CPI-U, ajustado estacionalmente',
    },
    {
      id: 'us-desempleo',
      title: 'Desempleo y participación',
      unit: '% · mensual',
      polarity: 'down',
      headline: { ref: { id: 'unemp' }, decimals: 1, suffix: '%' },
      datasets: [
        { ref: { id: 'unemp' }, label: 'Desempleo', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'participation' }, label: 'Participación laboral (eje der.)', type: 'line', color: 'series2', decimals: 1, axis: 'right' },
      ],
      read: 'El desempleo es el % de personas activas sin trabajo. La participación es el % de la población adulta que trabaja o busca trabajo; si cae, el desempleo puede bajar por razones que no son buenas.',
      source: 'BLS · Current Population Survey',
    },
    {
      id: 'us-empleo',
      title: 'Creación de empleo',
      unit: 'Miles de puestos por mes · no agrícola · valor actual: promedio 3 meses',
      polarity: 'up',
      headline: { ref: { id: 'payrolls', t: 'diff3avg' }, decimals: 0, suffix: ' mil' },
      datasets: [
        { ref: { id: 'payrolls', t: 'diff' }, label: 'Cambio mensual', type: 'bar', color: 'accent', decimals: 0, signColors: true },
        { ref: { id: 'payrolls', t: 'diff3avg' }, label: 'Promedio 3 meses', type: 'line', color: 'series2', decimals: 0 },
      ],
      read: 'Puestos de trabajo que se suman o se pierden cada mes. El promedio de tres meses filtra el ruido y muestra el ritmo de fondo del mercado laboral.',
      source: 'BLS · Current Employment Statistics',
    },
    {
      id: 'us-salarios',
      title: 'Salarios',
      unit: 'Variación % interanual · salario horario promedio',
      polarity: 'none',
      headline: { ref: { id: 'ahe', t: 'yoy' }, decimals: 1, suffix: '%' },
      datasets: [
        { ref: { id: 'ahe', t: 'yoy' }, label: 'Salario horario', type: 'line', color: 'accent', fill: true, decimals: 1 },
        { ref: { id: 'cpi', t: 'yoy' }, label: 'Inflación CPI', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'Cuando la línea de salarios está por encima de la de inflación, el poder de compra crece. Si los salarios suben mucho más que la inflación, la Fed puede ver presión sobre los precios.',
      source: 'BLS · Average hourly earnings, sector privado',
    },
    {
      id: 'us-tasas',
      title: 'Tasas de interés',
      unit: '% anual · promedio mensual',
      polarity: 'none',
      headline: { ref: { id: 'fedfunds' }, decimals: 2, suffix: '%' },
      datasets: [
        { ref: { id: 'fedfunds' }, label: 'Fondos federales (efectiva)', type: 'line', color: 'accent', decimals: 2 },
        { ref: { id: 'y10' }, label: 'Bono 10 años', type: 'line', color: 'series2', decimals: 2 },
      ],
      read: 'La tasa de fondos federales es la que fija la Fed y condiciona el crédito. El rendimiento a 10 años refleja lo que el mercado espera de inflación y crecimiento; cuando está debajo de la tasa corta, la curva está invertida.',
      source: 'NY Fed (EFFR) · U.S. Treasury (par yield curve)',
    },
    {
      id: 'us-pbi',
      title: 'Crecimiento del PBI',
      unit: 'Variación % anual del PBI real',
      polarity: 'up',
      headline: { ref: { id: 'gdp' }, decimals: 1, suffix: '%' },
      datasets: [{ ref: { id: 'gdp' }, label: 'PBI real', type: 'bar', color: 'accent', decimals: 1, signColors: true }],
      read: 'Cuánto creció el valor de la producción del año, a precios constantes. Las barras rojas son años de contracción.',
      source: 'Banco Mundial · NY.GDP.MKTP.KD.ZG',
    },
  ],

  analyze(g) {
    const cpi = g({ id: 'cpi', t: 'yoy' });
    const core = g({ id: 'corecpi', t: 'yoy' });
    const cpiM = g({ id: 'cpi', t: 'pct1' });
    const un = g({ id: 'unemp' });
    const pay = g({ id: 'payrolls', t: 'diff3avg' });
    const ahe = g({ id: 'ahe', t: 'yoy' });
    const ff = g({ id: 'fedfunds' });
    const y10 = g({ id: 'y10' });
    const gdp = g({ id: 'gdp' });

    const items = [];
    let lead = '';

    if (cpi && core) {
      const gap = core.last - 2;
      lead = `La inflación está ${fmtNum(Math.abs(cpi.last - 2))} puntos ${cpi.last >= 2 ? 'por encima' : 'por debajo'} de la meta de la Fed: ${fmtNum(cpi.last)}% interanual en ${fmtDate(cpi.date)}.`;
      items.push({
        title: 'Precios',
        text: `El CPI general marca ${fmtNum(cpi.last)}% interanual y la subyacente ${fmtNum(core.last)}% (${fmtNum(Math.abs(gap))} pp ${gap >= 0 ? 'sobre' : 'bajo'} la meta de 2%). ${cpiM ? `En el mes subió ${fmtNum(cpiM.last, 2)}%.` : ''} ${cpi.back !== null ? `Tres meses antes el interanual era ${fmtNum(cpi.back)}%.` : ''}`,
      });
    }
    if (un && pay) {
      const t = un.back === null ? '' : un.last > un.back + 0.1 ? 'subió' : un.last < un.back - 0.1 ? 'bajó' : 'se mantuvo estable';
      items.push({
        title: 'Mercado laboral',
        text: `El desempleo es ${fmtNum(un.last)}% en ${fmtDate(un.date)}${t ? ` y ${t} frente a tres meses atrás (${fmtNum(un.back)}%)` : ''}. La economía crea en promedio ${fmtNum(pay.last, 0)} mil puestos por mes (promedio de 3 meses).`,
      });
    }
    if (ahe && cpi) {
      const real = ahe.last - cpi.last;
      items.push({
        title: 'Salarios reales',
        text: `El salario horario sube ${fmtNum(ahe.last)}% interanual contra una inflación de ${fmtNum(cpi.last)}%: el poder de compra ${real >= 0 ? 'crece' : 'cae'} ${fmtNum(Math.abs(real))} pp.`,
      });
    }
    if (ff && y10) {
      const spread = y10.last - ff.last;
      items.push({
        title: 'Tasas',
        text: `La tasa efectiva de fondos federales está en ${fmtNum(ff.last, 2)}% y el bono a 10 años rinde ${fmtNum(y10.last, 2)}%. La curva ${spread >= 0 ? 'tiene pendiente positiva' : 'está invertida'} (${spread >= 0 ? '+' : '−'}${fmtNum(Math.abs(spread), 2)} pp).`,
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

