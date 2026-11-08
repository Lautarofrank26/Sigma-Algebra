/** fiscal.js — Argentina · Frente fiscal: resultado primario y financiero. Cifras en miles de millones de pesos. */
import { fmtNum, fmtDate } from '../../lib/format.js';

export const fiscal = {
  key: 'ar',
  name: 'Frente fiscal',
  tagline: 'Resultado primario y financiero del sector público',
  dataUrl: 'data/argentina.json',

  kpis: [
    { label: 'Resultado primario (mes)', ref: { id: 'primary_balance', t: 'k' }, decimals: 0, prefix: '$', suffix: ' mil M', polarity: 'up' },
    { label: 'Primario, 12 meses', ref: { id: 'primary_balance', t: 'sum12k' }, decimals: 0, prefix: '$', suffix: ' mil M', polarity: 'up' },
    { label: 'Resultado financiero (mes)', ref: { id: 'financial_balance', t: 'k' }, decimals: 0, prefix: '$', suffix: ' mil M', polarity: 'up' },
    { label: 'Financiero, 12 meses', ref: { id: 'financial_balance', t: 'sum12k' }, decimals: 0, prefix: '$', suffix: ' mil M', polarity: 'up' },
  ],

  summary: [
    { label: 'Resultado primario', note: 'Hacienda · miles de millones de $', ref: { id: 'primary_balance', t: 'k' }, decimals: 0, suffix: '', kind: 'change', polarity: 'up' },
    { label: 'Resultado financiero', note: 'Hacienda · miles de millones de $', ref: { id: 'financial_balance', t: 'k' }, decimals: 0, suffix: '', kind: 'change', polarity: 'up' },
    { label: 'Primario, 12 meses', note: 'Hacienda · acumulado', ref: { id: 'primary_balance', t: 'sum12k' }, decimals: 0, suffix: '', kind: 'change', polarity: 'up' },
    { label: 'Financiero, 12 meses', note: 'Hacienda · acumulado', ref: { id: 'financial_balance', t: 'sum12k' }, decimals: 0, suffix: '', kind: 'change', polarity: 'up' },
  ],

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
      id: 'fis-acum', title: 'Resultados acumulados, 12 meses', unit: 'Miles de millones de pesos · suma móvil', polarity: 'up',
      headline: { ref: { id: 'primary_balance', t: 'sum12k' }, decimals: 0, prefix: 'Primario $', suffix: ' mil M' },
      datasets: [
        { ref: { id: 'primary_balance', t: 'sum12k' }, label: 'Primario', type: 'line', color: 'accent', decimals: 0 },
        { ref: { id: 'financial_balance', t: 'sum12k' }, label: 'Financiero', type: 'line', color: 'series2', decimals: 0 },
      ],
      read: 'La suma de doce meses elimina los picos estacionales (aguinaldo, vencimientos de impuestos) y muestra la tendencia fiscal de fondo. Se expresa en pesos corrientes.',
      source: 'Cálculo propio sobre Secretaría de Hacienda',
    },
  ],

  analyze(g) {
    const p = g({ id: 'primary_balance', t: 'k' });
    const f = g({ id: 'financial_balance', t: 'k' });
    const p12 = g({ id: 'primary_balance', t: 'sum12k' });
    const f12 = g({ id: 'financial_balance', t: 'sum12k' });
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
    items.push({ title: 'Nota', text: 'Las cifras están en pesos corrientes, sin ajustar por inflación; no son comparables entre años lejanos.' });
    return { lead, items };
  },
};
