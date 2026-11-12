/** externo.js — Argentina · Sector externo: comercio exterior, reservas y tipo de cambio. */
import { fmtNum, fmtDate } from '../../lib/format.js';

export const externo = {
  key: 'ar',
  name: 'Sector externo',
  tagline: 'Comercio exterior, rubros, energía, cuenta corriente, términos del intercambio, reservas y dólar',
  dataUrl: 'data/argentina.json',
  extraUrl: 'data/ar-extra.json', // series de tools/fetch-ar.py (comercio desde 1992, rubros, energía, cuenta corriente, términos del intercambio)

  panels: [
    {
      id: 'ext-comercio', title: 'Exportaciones e importaciones', unit: 'USD millones por mes', polarity: 'none',
      headline: { ref: { id: 'exports' }, decimals: 0, prefix: 'Expo USD ', suffix: ' M' },
      datasets: [
        { ref: { id: 'expo_long' }, label: 'Exportaciones', type: 'line', color: 'accent', decimals: 0 },
        { ref: { id: 'impo_long' }, label: 'Importaciones', type: 'line', color: 'series2', decimals: 0 },
      ],
      read: 'Valor en dólares de lo que el país vende y compra al exterior. Las exportaciones tienen picos en los meses de cosecha. Las importaciones suben con la actividad y la inversión.',
      source: 'INDEC · Intercambio comercial argentino (datos.gob.ar)',
    },
    {
      id: 'ext-saldo', title: 'Saldo comercial', unit: 'USD millones por mes', polarity: 'up',
      headline: { ref: { id: 'trade_balance' }, decimals: 0, prefix: 'USD ', suffix: ' M' },
      datasets: [{ ref: { id: 'saldo_long' }, label: 'Saldo', type: 'bar', color: 'accent', decimals: 0, signColors: true }],
      read: 'Exportaciones menos importaciones. Un saldo positivo aporta dólares a la economía; uno negativo los consume.',
      source: 'INDEC · Intercambio comercial argentino (datos.gob.ar)',
    },
    {
      id: 'ext-saldo-12m', title: 'Saldo comercial, acumulado 12 meses', unit: 'USD millones · suma móvil de 12 meses', polarity: 'up',
      headline: { ref: { id: 'trade_balance', t: 'sum12' }, decimals: 0, prefix: 'USD ', suffix: ' M' },
      datasets: [{ ref: { id: 'saldo_long', t: 'sum12' }, label: 'Acumulado 12 meses', type: 'line', color: 'accent', fill: true, decimals: 0 }],
      read: 'Suma de los últimos doce meses. Elimina la estacionalidad de la cosecha y muestra cuántos dólares dejó el comercio en el año.',
      source: 'Cálculo propio sobre INDEC · Intercambio comercial argentino',
    },
    {
      id: 'ext-rubros', title: 'Exportaciones por grandes rubros', unit: 'USD millones · trimestral', polarity: 'none',
      headline: { ref: { id: 'expo_moa' }, decimals: 0, prefix: 'MOA USD ', suffix: ' M' },
      datasets: [
        { ref: { id: 'expo_pp' }, label: 'Productos primarios', type: 'line', color: 'accent', decimals: 0 },
        { ref: { id: 'expo_moa' }, label: 'Manufacturas agropecuarias (MOA)', type: 'line', color: 'series2', decimals: 0 },
        { ref: { id: 'expo_moi' }, label: 'Manufacturas industriales (MOI)', type: 'line', color: 'series2', decimals: 0 },
        { ref: { id: 'expo_cye' }, label: 'Combustibles y energía', type: 'line', color: 'series2', decimals: 0 },
      ],
      timeline: { kind: 'flow', freq: 'A', range: 0, freqs: ['M', 'Q', 'A'], desc: { base: 'USD millones por trimestre', agg: 'suma del período' } },
      read: 'Las exportaciones se dividen en cuatro rubros: productos primarios (granos, carnes frescas, minerales), manufacturas de origen agropecuario (harinas y aceites de soja, alimentos elaborados), manufacturas de origen industrial (vehículos, químicos, metales) y combustibles y energía. Los cuatro suman el total exportado.',
      source: 'INDEC · Intercambio comercial argentino, exportaciones por grandes rubros (datos.gob.ar)',
    },
    {
      id: 'ext-energia', title: 'Balanza energética', unit: 'USD millones · trimestral', polarity: 'up',
      headline: { ref: { id: 'energy_balance' }, decimals: 0, prefix: 'USD ', suffix: ' M' },
      datasets: [
        { ref: { id: 'energy_balance' }, label: 'Saldo energético', type: 'bar', color: 'accent', decimals: 0, signColors: true },
        { ref: { id: 'expo_cye' }, label: 'Exportaciones de combustibles y energía', type: 'line', color: 'series2', decimals: 0 },
        { ref: { id: 'impo_comb' }, label: 'Importaciones de combustibles y lubricantes', type: 'line', color: 'series2', decimals: 0 },
      ],
      timeline: { kind: 'flow', freq: 'A', range: 0, freqs: ['M', 'Q', 'A'], desc: { base: 'USD millones por trimestre', agg: 'suma del período' } },
      read: 'Diferencia entre lo que el país exporta y lo que importa en energía. Argentina tuvo déficit energético casi todos los años entre 2011 y 2023 (con 2020, año de pandemia, como excepción) y volvió a un superávit amplio desde 2024, junto con el aumento de la producción de petróleo y gas no convencional (Vaca Muerta). Es un cálculo propio: exportaciones de combustibles y energía menos importaciones de combustibles y lubricantes.',
      source: 'Cálculo propio sobre INDEC · Intercambio comercial argentino (datos.gob.ar)',
    },
    {
      id: 'ext-cc', title: 'Cuenta corriente', unit: '% del PBI · anual, desde 1980', polarity: 'up',
      headline: { ref: { id: 'ca_gdp' }, decimals: 1, suffix: '% del PBI' },
      datasets: [{ ref: { id: 'ca_gdp' }, label: 'Cuenta corriente', type: 'bar', color: 'accent', decimals: 1, signColors: true }],
      timeline: { kind: 'rate', freq: 'A', range: 0, freqs: ['M', 'Q', 'A'], desc: { base: '% del PBI', agg: '% del PBI' } },
      read: 'Saldo de todas las transacciones corrientes con el resto del mundo: bienes, servicios, rentas (intereses y utilidades) y transferencias. Un déficit significa que el país necesita financiamiento externo o perder reservas. Sin proyecciones del FMI: solo años con datos efectivos.',
      source: 'FMI · World Economic Outlook (BCA_NGDPD)',
    },
    {
      id: 'ext-tot', title: 'Términos del intercambio', unit: 'Índice 2004 = 100 · trimestral, desde 1990', polarity: 'up',
      headline: { ref: { id: 'tot' }, decimals: 1, suffix: ' pts' },
      datasets: [{ ref: { id: 'tot' }, label: 'Términos del intercambio', type: 'line', color: 'accent', fill: true, decimals: 1 }],
      timeline: { kind: 'index', freq: 'Q', range: 0, freqs: ['M', 'Q', 'A'], desc: { base: 'índice', agg: 'promedio del índice' } },
      read: 'Relación entre los precios de lo que el país exporta y los de lo que importa. Si sube, con la misma cantidad de exportaciones se pueden comprar más importaciones: mejora el ingreso del país sin producir más. Depende sobre todo del precio de la soja y de la energía.',
      source: 'INDEC · Índice de términos del intercambio, base 2004 (datos.gob.ar)',
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
