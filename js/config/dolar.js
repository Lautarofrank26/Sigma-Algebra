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
  extraUrl: 'data/ar-extra.json', // series de tools/fetch-ar.py (mayorista largo, ITCRM, reservas, compras del BCRA y bandas)

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
    {
      id: 'fx-bandas',
      title: 'Dólar mayorista dentro de las bandas',
      unit: 'Pesos por dólar · promedio mensual · desde abr-2025',
      polarity: 'none',
      headline: { ref: { id: 'band_mayorista' }, decimals: 0, prefix: 'Mayorista $' },
      datasets: [
        { ref: { id: 'band_mayorista' }, label: 'Mayorista de referencia', type: 'line', color: 'accent', decimals: 0 },
        { ref: { id: 'band_floor' }, label: 'Piso de la banda', type: 'line', color: 'series2', decimals: 0 },
        { ref: { id: 'band_ceiling' }, label: 'Techo de la banda', type: 'line', color: 'series2', decimals: 0 },
      ],
      timeline: { kind: 'price', freq: 'M', range: 0, freqs: ['M', 'Q'], desc: { base: 'pesos por dólar', agg: 'promedio del período' } },
      read: 'Desde el 14 de abril de 2025 el dólar mayorista flota entre un piso y un techo que fija el BCRA: si toca el techo, el BCRA vende dólares; si toca el piso, los compra. Hasta diciembre de 2025 las bandas se ensanchaban 1% por mes; desde el 1 de enero de 2026 se ajustan según la inflación mensual del INDEC. Cada punto es el promedio de los datos diarios del mes.',
      source: 'BCRA · Régimen de bandas cambiarias y dólar mayorista de referencia',
    },
    {
      id: 'fx-mayorista-largo',
      title: 'Dólar mayorista desde 2002',
      unit: 'Pesos por dólar · promedio mensual',
      polarity: 'none',
      headline: { ref: { id: 'fx_mayorista' }, decimals: 0, prefix: '$' },
      datasets: [{ ref: { id: 'fx_mayorista' }, label: 'Mayorista de referencia', type: 'line', color: 'accent', fill: true, decimals: 1 }],
      timeline: { kind: 'price', freq: 'M', range: 0, freqs: ['M', 'Q', 'S', 'A'], desc: { base: 'pesos por dólar', agg: 'promedio del período' } },
      read: 'Dólar mayorista de referencia (Comunicación A 3500 del BCRA), el precio al que operan los bancos y las empresas, desde marzo de 2002. Es la serie larga y oficial: el blue, el MEP y el contado con liquidación solo tienen historia desde 2019 en el gráfico de arriba.',
      source: 'BCRA · Tipo de cambio mayorista de referencia (promedio mensual de datos diarios)',
    },
    {
      id: 'fx-itcrm',
      title: 'Tipo de cambio real multilateral',
      unit: 'Índice 17-dic-2015 = 100 · promedio mensual · desde 1997',
      polarity: 'none',
      headline: { ref: { id: 'itcrm' }, decimals: 1 },
      datasets: [{ ref: { id: 'itcrm' }, label: 'ITCRM', type: 'line', color: 'accent', decimals: 1 }],
      timeline: { kind: 'index', freq: 'M', range: 0, freqs: ['M', 'Q', 'S', 'A'], desc: { base: 'índice', agg: 'promedio del índice' } },
      read: 'Precio del dólar ajustado por la inflación de Argentina y la de sus principales socios comerciales. Si sube, el peso se abarata en términos reales (más competitividad de las exportaciones); si baja, el peso se aprecia. Es la medida del BCRA (ITCRM, base 17-12-2015 = 100) y los últimos meses son provisorios porque usan expectativas del REM.',
      source: 'BCRA · Índice de tipo de cambio real multilateral (ITCRM)',
    },
    {
      id: 'fx-reservas',
      title: 'Reservas internacionales brutas',
      unit: 'Millones de USD · fin de mes · desde 1996',
      polarity: 'up',
      headline: { ref: { id: 'reserves_bcra' }, decimals: 0, prefix: 'USD ', suffix: ' M' },
      datasets: [{ ref: { id: 'reserves_bcra' }, label: 'Reservas brutas', type: 'line', color: 'accent', fill: true, decimals: 0 }],
      timeline: { kind: 'stock', freq: 'M', range: 0, freqs: ['M', 'Q', 'S', 'A'], desc: { base: 'fin de mes', agg: 'fin de período' } },
      read: 'Dólares y otros activos externos que tiene el BCRA, sin descontar sus obligaciones. El BCRA no publica una serie oficial de reservas netas: las estimaciones privadas restan los encajes de los depósitos en dólares, el swap con China y otros pasivos, con criterios que cambian según quién las calcula. Por eso acá solo se muestran las brutas.',
      source: 'BCRA · Reservas internacionales (valor del último día de cada mes)',
    },
    {
      id: 'fx-compras',
      title: 'Compras y ventas de divisas del BCRA',
      unit: 'Millones de USD por mes · variación de reservas por compra de divisas',
      polarity: 'none',
      headline: { ref: { id: 'bcra_compras' }, decimals: 0, prefix: 'USD ', suffix: ' M' },
      datasets: [{ ref: { id: 'bcra_compras' }, label: 'Compras netas', type: 'bar', color: 'accent', decimals: 0, signColors: true }],
      timeline: { kind: 'flow', freq: 'M', range: 5, freqs: ['M', 'Q', 'S', 'A'], desc: { base: 'USD millones', agg: 'suma del período' } },
      read: 'Cuánto cambió el nivel de reservas del BCRA por sus compras (positivo) o ventas (negativo) de divisas en el mercado, sumando los datos diarios del mes. Es la variable que publica el BCRA con ese nombre: no incluye otros movimientos de reservas, como pagos de deuda o variaciones de valuación.',
      source: 'BCRA · Variación de reservas internacionales por compra de divisas (suma mensual)',
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

