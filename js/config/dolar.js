/**
 * dolar.js — sección "Tipo de cambio": los distintos tipos de dólar en Argentina.
 * Datos: data/dolar.json (generado por tools/fetch-data.ps1).
 *   - indicators: historia mensual (promedio de la cotización de venta) y brechas
 *   - quotes: cotizaciones del día de la descarga
 * Para sumar un tipo de dólar: agregarlo en $casas del script y en QUOTE_ORDER / panels.
 */
import { fmtNum, fmtDate } from '../lib/format.js';

/** Orden y nombre con que se muestran las cotizaciones del día */
export const QUOTE_ORDER = [
  { casa: 'oficial', id: 'oficial', name: 'Oficial', note: 'Minorista, bancos' },
  { casa: 'mayorista', id: 'mayorista', name: 'Mayorista', note: 'Referencia del mercado' },
  { casa: 'blue', id: 'blue', name: 'Blue', note: 'Mercado informal' },
  { casa: 'bolsa', id: 'mep', name: 'MEP', note: 'Dólar bolsa' },
  { casa: 'contadoconliqui', id: 'ccl', name: 'Contado con liqui', note: 'CCL' },
  { casa: 'cripto', id: 'cripto', name: 'Cripto', note: 'Vía stablecoins' },
  { casa: 'tarjeta', id: 'tarjeta', name: 'Tarjeta', note: 'Incluye impuestos' },
];

export const dolar = {
  key: 'fx',
  name: 'Tipo de cambio',
  dataUrl: 'data/dolar.json',

  panels: [
    {
      id: 'fx-tipos',
      title: 'Cotización por tipo de dólar',
      unit: 'Pesos por dólar · venta, promedio mensual',
      polarity: 'none',
      headline: { ref: { id: 'blue' }, decimals: 0, prefix: 'Blue $' },
      datasets: [
        { ref: { id: 'oficial' }, label: 'Oficial', type: 'line', color: '--fx-oficial', decimals: 0 },
        { ref: { id: 'blue' }, label: 'Blue', type: 'line', color: '--fx-blue', decimals: 0 },
        { ref: { id: 'mep' }, label: 'MEP', type: 'line', color: '--fx-mep', decimals: 0 },
        { ref: { id: 'ccl' }, label: 'Contado con liqui', type: 'line', color: '--fx-ccl', decimals: 0 },
      ],
      read: 'Cada línea es un precio distinto del mismo dólar. Cuando las líneas se separan, hay restricciones o desconfianza en el mercado oficial; cuando se juntan, los mercados convergen.',
      source: 'ArgentinaDatos · cotizaciones históricas (promedio mensual de venta)',
    },
    {
      id: 'fx-brecha',
      title: 'Brecha cambiaria',
      unit: '% sobre el dólar oficial',
      polarity: 'down',
      headline: { ref: { id: 'brecha_ccl' }, decimals: 1, suffix: '% CCL' },
      datasets: [
        { ref: { id: 'brecha_blue' }, label: 'Blue', type: 'line', color: '--fx-blue', decimals: 1 },
        { ref: { id: 'brecha_mep' }, label: 'MEP', type: 'line', color: '--fx-mep', decimals: 1 },
        { ref: { id: 'brecha_ccl' }, label: 'Contado con liqui', type: 'line', color: '--fx-ccl', decimals: 1 },
      ],
      read: 'Cuánto más caro es cada dólar libre respecto del oficial. Una brecha alta suele indicar presión sobre el tipo de cambio oficial y expectativas de devaluación; cerca de cero, el mercado cree en el valor oficial.',
      source: 'Cálculo propio sobre ArgentinaDatos',
    },
  ],

  analyze(g) {
    const of = g({ id: 'oficial' });
    const blue = g({ id: 'blue' });
    const ccl = g({ id: 'ccl' });
    const bb = g({ id: 'brecha_blue' });
    const bc = g({ id: 'brecha_ccl' });
    const ofY = g({ id: 'oficial', t: 'yoy' });
    const items = [];
    let lead = '';
    if (bc && bb) {
      const dir = bc.last > bc.back + 2 ? 'se amplía' : bc.last < bc.back - 2 ? 'se achica' : 'se mantiene estable';
      lead = `La brecha ${dir}: ${fmtNum(bc.last, 1)}% con el contado con liqui y ${fmtNum(bb.last, 1)}% con el blue (${fmtDate(bc.date)}).`;
      items.push({
        title: 'Brecha',
        text: `Tres meses antes era ${fmtNum(bc.back, 1)}% (CCL) y ${fmtNum(bb.back, 1)}% (blue). Se calcula sobre el promedio mensual de venta contra el oficial.`,
      });
    }
    if (of && ofY) {
      items.push({
        title: 'Oficial',
        text: `El dólar oficial promedió $${fmtNum(of.last, 0)} en ${fmtDate(of.date)}, ${fmtNum(Math.abs(ofY.last), 1)}% ${ofY.last >= 0 ? 'más' : 'menos'} que un año atrás.`,
      });
    }
    if (blue && ccl) {
      items.push({
        title: 'Dólares libres',
        text: `El blue promedió $${fmtNum(blue.last, 0)} y el contado con liqui $${fmtNum(ccl.last, 0)}: el CCL cotiza ${fmtNum(Math.abs(ccl.last / blue.last - 1) * 100, 1)}% ${ccl.last >= blue.last ? 'por encima' : 'por debajo'} del blue.`,
      });
    }
    return { lead, items };
  },
};

