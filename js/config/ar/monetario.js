/** monetario.js — Argentina · Dinero y tasas: BADLAR, M2, crédito y depósitos. */
import { fmtNum, fmtDate } from '../../lib/format.js';

export const monetario = {
  key: 'ar',
  name: 'Dinero y tasas',
  tagline: 'Tasa BADLAR, dinero, crédito y depósitos',
  dataUrl: 'data/argentina.json',

  kpis: [
    { label: 'Tasa BADLAR', ref: { id: 'badlar' }, decimals: 1, suffix: '% TNA', polarity: 'none' },
    { label: 'M2 privado real i.a.', ref: { id: 'm2_real', t: 'yoy' }, decimals: 1, suffix: '%', polarity: 'up' },
    { label: 'Préstamos reales i.a.', ref: { id: 'loans_real', t: 'yoy' }, decimals: 1, suffix: '%', polarity: 'up' },
    { label: 'Plazos fijos i.a.', ref: { id: 'time_deposits', t: 'yoy' }, decimals: 1, suffix: '%', polarity: 'none' },
    { label: 'Inflación interanual', ref: { id: 'ipc', t: 'yoy' }, decimals: 1, suffix: '%', polarity: 'down' },
  ],

  summary: [
    { label: 'Tasa BADLAR', note: 'BCRA · % TNA', ref: { id: 'badlar' }, decimals: 1, suffix: '%', kind: 'level', polarity: 'none' },
    { label: 'M2 privado i.a.', note: 'BCRA · nominal', ref: { id: 'm2', t: 'yoy' }, decimals: 1, kind: 'change', polarity: 'none' },
    { label: 'M2 privado real i.a.', note: 'Calculado · M2 / IPC', ref: { id: 'm2_real', t: 'yoy' }, decimals: 1, kind: 'change', polarity: 'up' },
    { label: 'Préstamos reales i.a.', note: 'Calculado · pesos / IPC', ref: { id: 'loans_real', t: 'yoy' }, decimals: 1, kind: 'change', polarity: 'up' },
    { label: 'Préstamos, var. mensual', note: 'BCRA · nominal', ref: { id: 'loans', t: 'pct1' }, decimals: 1, kind: 'change', polarity: 'none' },
    { label: 'Plazos fijos i.a.', note: 'BCRA · nominal', ref: { id: 'time_deposits', t: 'yoy' }, decimals: 1, kind: 'change', polarity: 'none' },
  ],

  panels: [
    {
      id: 'mon-badlar', title: 'Tasa BADLAR vs. inflación', unit: '% anual', polarity: 'none',
      headline: { ref: { id: 'badlar' }, decimals: 1, suffix: '% TNA' },
      datasets: [
        { ref: { id: 'badlar' }, label: 'BADLAR (TNA)', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'ipc', t: 'yoy' }, label: 'Inflación interanual', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'BADLAR es la tasa que pagan los bancos por plazos fijos grandes y sirve de referencia para el costo del dinero. Si está por encima de la inflación, ahorrar en pesos rinde en términos reales.',
      source: 'BCRA · Tasa BADLAR bancos privados (datos.gob.ar)',
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
      id: 'mon-depositos', title: 'Plazos fijos en pesos', unit: 'Variación % interanual · nominal', polarity: 'none',
      headline: { ref: { id: 'time_deposits', t: 'yoy' }, decimals: 1, suffix: '%' },
      datasets: [
        { ref: { id: 'time_deposits', t: 'yoy' }, label: 'Plazos fijos', type: 'line', color: 'accent', fill: true, decimals: 1 },
        { ref: { id: 'ipc', t: 'yoy' }, label: 'Inflación', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'Cuánto crecieron los depósitos a plazo fijo en pesos. Si crecen más que la inflación, el público está ahorrando más en pesos en términos reales.',
      source: 'BCRA · Depósitos del sector privado (datos.gob.ar)',
    },
  ],

  analyze(g) {
    const bad = g({ id: 'badlar' });
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
