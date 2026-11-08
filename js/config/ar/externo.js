/** externo.js — Argentina · Sector externo: comercio exterior, reservas y tipo de cambio. */
import { fmtNum, fmtDate } from '../../lib/format.js';

export const externo = {
  key: 'ar',
  name: 'Sector externo',
  tagline: 'Comercio exterior, reservas y dólar',
  dataUrl: 'data/argentina.json',

  kpis: [
    { label: 'Exportaciones', ref: { id: 'exports' }, decimals: 0, prefix: 'USD ', suffix: ' M', polarity: 'up' },
    { label: 'Importaciones', ref: { id: 'imports' }, decimals: 0, prefix: 'USD ', suffix: ' M', polarity: 'none' },
    { label: 'Saldo comercial', ref: { id: 'trade_balance' }, decimals: 0, prefix: 'USD ', suffix: ' M', polarity: 'up' },
    { label: 'Reservas brutas', ref: { id: 'reserves' }, decimals: 0, prefix: 'USD ', suffix: ' M', polarity: 'up' },
    { label: 'Dólar mayorista', ref: { id: 'fx' }, decimals: 0, prefix: '$', polarity: 'none' },
  ],

  summary: [
    { label: 'Exportaciones i.a.', note: 'INDEC · var. %', ref: { id: 'exports', t: 'yoy' }, decimals: 1, kind: 'change', polarity: 'up' },
    { label: 'Importaciones i.a.', note: 'INDEC · var. %', ref: { id: 'imports', t: 'yoy' }, decimals: 1, kind: 'change', polarity: 'none' },
    { label: 'Saldo comercial', note: 'INDEC · USD millones', ref: { id: 'trade_balance' }, decimals: 0, kind: 'level', polarity: 'up' },
    { label: 'Reservas', note: 'BCRA · var. mensual', ref: { id: 'reserves', t: 'pct1' }, decimals: 1, kind: 'change', polarity: 'up' },
    { label: 'Dólar mayorista', note: 'BCRA · var. mensual', ref: { id: 'fx', t: 'pct1' }, decimals: 1, kind: 'change', polarity: 'none' },
  ],

  panels: [
    {
      id: 'ext-comercio', title: 'Exportaciones e importaciones', unit: 'USD millones por mes', polarity: 'none',
      headline: { ref: { id: 'exports' }, decimals: 0, prefix: 'Expo USD ', suffix: ' M' },
      datasets: [
        { ref: { id: 'exports' }, label: 'Exportaciones', type: 'line', color: 'accent', decimals: 0 },
        { ref: { id: 'imports' }, label: 'Importaciones', type: 'line', color: 'series2', decimals: 0 },
      ],
      read: 'Valor en dólares de lo que el país vende y compra al exterior. Las exportaciones tienen picos en los meses de cosecha. Las importaciones suben con la actividad y la inversión.',
      source: 'INDEC · Intercambio comercial argentino (datos.gob.ar)',
    },
    {
      id: 'ext-saldo', title: 'Saldo comercial', unit: 'USD millones por mes', polarity: 'up',
      headline: { ref: { id: 'trade_balance' }, decimals: 0, prefix: 'USD ', suffix: ' M' },
      datasets: [{ ref: { id: 'trade_balance' }, label: 'Saldo', type: 'bar', color: 'accent', decimals: 0, signColors: true }],
      read: 'Exportaciones menos importaciones. Un saldo positivo aporta dólares a la economía; uno negativo los consume.',
      source: 'INDEC · Intercambio comercial argentino (datos.gob.ar)',
    },
    {
      id: 'ext-saldo-12m', title: 'Saldo comercial, acumulado 12 meses', unit: 'USD millones · suma móvil de 12 meses', polarity: 'up',
      headline: { ref: { id: 'trade_balance', t: 'sum12' }, decimals: 0, prefix: 'USD ', suffix: ' M' },
      datasets: [{ ref: { id: 'trade_balance', t: 'sum12' }, label: 'Acumulado 12 meses', type: 'line', color: 'accent', fill: true, decimals: 0 }],
      read: 'Suma de los últimos doce meses. Elimina la estacionalidad de la cosecha y muestra cuántos dólares dejó el comercio en el año.',
      source: 'Cálculo propio sobre INDEC · Intercambio comercial argentino',
    },
    {
      id: 'ext-reservas', title: 'Reservas internacionales', unit: 'USD millones · fin de mes', polarity: 'up',
      headline: { ref: { id: 'reserves' }, decimals: 0, prefix: 'USD ', suffix: ' M' },
      datasets: [{ ref: { id: 'reserves' }, label: 'Reservas brutas', type: 'line', color: 'accent', fill: true, decimals: 0 }],
      read: 'Dólares del Banco Central. Respaldan el pago de deuda y la intervención en el mercado cambiario. Son reservas brutas: incluyen encajes y swaps.',
      source: 'BCRA · Reservas internacionales (datos.gob.ar)',
    },
    {
      id: 'ext-fx', title: 'Dólar mayorista', unit: 'Pesos por dólar · promedio mensual', polarity: 'none',
      headline: { ref: { id: 'fx' }, decimals: 0, prefix: '$' },
      datasets: [{ ref: { id: 'fx' }, label: 'Mayorista (A3500)', type: 'line', color: 'accent', fill: true, decimals: 0 }],
      read: 'Referencia del tipo de cambio para el comercio exterior. En la sección Dólar están el oficial, el blue, el MEP y el contado con liqui.',
      source: 'BCRA · Com. A 3500 (datos.gob.ar)',
    },
  ],

  analyze(g) {
    const ex = g({ id: 'exports', t: 'yoy' });
    const im = g({ id: 'imports', t: 'yoy' });
    const sb = g({ id: 'trade_balance' });
    const sb12 = g({ id: 'trade_balance', t: 'sum12' });
    const res = g({ id: 'reserves' });
    const items = [];
    let lead = '';
    if (sb) {
      lead = `El comercio dejó un saldo ${sb.last >= 0 ? 'positivo' : 'negativo'} de USD ${fmtNum(Math.abs(sb.last), 0)} millones en ${fmtDate(sb.date)}.`;
    }
    if (ex && im) {
      items.push({ title: 'Comercio', text: `Las exportaciones ${ex.last >= 0 ? 'crecen' : 'caen'} ${fmtNum(Math.abs(ex.last))}% interanual y las importaciones ${im.last >= 0 ? 'crecen' : 'caen'} ${fmtNum(Math.abs(im.last))}%.` });
    }
    if (sb12) {
      items.push({ title: 'Acumulado', text: `En los últimos 12 meses el saldo comercial suma USD ${fmtNum(sb12.last, 0)} millones (${fmtNum(sb12.back, 0)} tres meses antes).` });
    }
    if (res) {
      items.push({ title: 'Reservas', text: `Las reservas brutas cerraron ${fmtDate(res.date)} en USD ${fmtNum(res.last, 0)} millones${res.prev !== null ? ` (${res.last >= res.prev ? '+' : '−'}${fmtNum(Math.abs(res.last - res.prev), 0)} millones contra el mes previo)` : ''}.` });
    }
    return { lead, items };
  },
};
