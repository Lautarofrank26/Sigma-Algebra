/** tasas.js — EE.UU. · Tasas y deuda: política monetaria, curva de rendimientos y deuda pública. */
import { fmtNum, fmtDate } from '../../lib/format.js';

export const tasas = {
  key: 'us',
  name: 'Tasas y deuda',
  tagline: 'Fed, curva de rendimientos y deuda pública',
  dataUrl: 'data/usa.json',

  panels: [
    {
      id: 'ustas-fed', title: 'Tasas de corto plazo', unit: '% anual · promedio mensual', polarity: 'none',
      headline: { ref: { id: 'fedfunds' }, decimals: 2, suffix: '%' },
      datasets: [
        { ref: { id: 'fedfunds' }, label: 'Fondos federales (efectiva)', type: 'line', color: 'accent', decimals: 2 },
        { ref: { id: 'sofr' }, label: 'SOFR', type: 'line', color: 'series2', decimals: 2 },
        { ref: { id: 'y3m' }, label: 'Bono 3 meses', type: 'line', color: '--fx-mep', decimals: 2 },
      ],
      read: 'La tasa de fondos federales es la que fija la Reserva Federal. SOFR es la tasa de los préstamos garantizados a un día y el bono a 3 meses refleja lo que el mercado espera de la Fed en el corto plazo.',
      source: 'NY Fed (EFFR y SOFR) · U.S. Treasury',
    },
    {
      id: 'ustas-curva', title: 'Rendimientos del Tesoro', unit: '% anual · promedio mensual', polarity: 'none',
      headline: { ref: { id: 'y10' }, decimals: 2, suffix: '% a 10 años' },
      datasets: [
        { ref: { id: 'y2' }, label: '2 años', type: 'line', color: 'accent', decimals: 2 },
        { ref: { id: 'y10' }, label: '10 años', type: 'line', color: 'series2', decimals: 2 },
        { ref: { id: 'y30' }, label: '30 años', type: 'line', color: '--fx-ccl', decimals: 2 },
      ],
      read: 'Lo que rinde prestarle al gobierno de EE.UU. a distintos plazos. El rendimiento a 10 años es la referencia para hipotecas y para el costo del capital en todo el mundo.',
      source: 'U.S. Treasury · Daily par yield curve',
    },
    {
      id: 'ustas-pendiente', title: 'Pendiente de la curva (10 años − 2 años)', unit: 'Puntos porcentuales', polarity: 'none',
      headline: { ref: { id: 'curve' }, decimals: 2, suffix: ' pp' },
      datasets: [{ ref: { id: 'curve' }, label: '10a − 2a', type: 'bar', color: 'accent', decimals: 2, signColors: true }],
      read: 'Cuando es negativa (barras rojas), la curva está invertida: el mercado paga más por plazos cortos que largos. Históricamente una inversión sostenida anticipó recesiones.',
      source: 'Cálculo propio sobre U.S. Treasury',
    },
    {
      id: 'ustas-deuda', title: 'Deuda pública total', unit: 'Miles de millones de USD · fin de mes', polarity: 'none',
      headline: { ref: { id: 'debt' }, decimals: 0, prefix: 'USD ', suffix: ' mil M' },
      datasets: [{ ref: { id: 'debt' }, label: 'Deuda total', type: 'line', color: 'accent', fill: true, decimals: 0 }],
      read: 'Deuda bruta del gobierno federal, incluida la que tienen otras agencias del propio Estado. Un valor de 40.000 miles de millones equivale a 40 billones de dólares.',
      source: 'U.S. Treasury · Debt to the Penny',
    },
    {
      id: 'ustas-deuda-var', title: 'Deuda pública, variación interanual', unit: '% contra el mismo mes del año anterior', polarity: 'none',
      headline: { ref: { id: 'debt', t: 'yoy' }, decimals: 1, suffix: '%' },
      datasets: [{ ref: { id: 'debt', t: 'yoy' }, label: 'Var. interanual', type: 'line', color: 'accent', decimals: 1 }],
      read: 'Ritmo al que crece la deuda. Si crece más que la economía en términos nominales, la deuda pesa cada vez más en relación con el PBI.',
      source: 'Cálculo propio sobre U.S. Treasury',
    },
  ],

  analyze(g) {
    const ff = g({ id: 'fedfunds' });
    const sofr = g({ id: 'sofr' });
    const y2 = g({ id: 'y2' });
    const y10 = g({ id: 'y10' });
    const curve = g({ id: 'curve' });
    const debt = g({ id: 'debt' });
    const debtY = g({ id: 'debt', t: 'yoy' });
    const items = [];
    let lead = '';
    if (ff) {
      lead = `La tasa efectiva de fondos federales es ${fmtNum(ff.last, 2)}% (${fmtDate(ff.date)}).`;
      items.push({ title: 'Fed', text: `Tres meses antes era ${fmtNum(ff.back, 2)}%.${sofr ? ` SOFR promedia ${fmtNum(sofr.last, 2)}%.` : ''}` });
    }
    if (y2 && y10) {
      items.push({ title: 'Curva', text: `El bono a 2 años rinde ${fmtNum(y2.last, 2)}% y el de 10 años ${fmtNum(y10.last, 2)}%. La curva ${curve && curve.last >= 0 ? 'tiene pendiente positiva' : 'está invertida'} (${curve ? `${curve.last >= 0 ? '+' : '−'}${fmtNum(Math.abs(curve.last), 2)} pp` : '—'}).` });
    }
    if (y10 && ff) {
      items.push({ title: 'Largo vs. corto', text: `El rendimiento a 10 años está ${fmtNum(Math.abs(y10.last - ff.last), 2)} pp ${y10.last >= ff.last ? 'por encima' : 'por debajo'} de la tasa de la Fed.` });
    }
    if (debt && debtY) {
      items.push({ title: 'Deuda', text: `La deuda pública total es USD ${fmtNum(debt.last / 1000, 1)} billones y crece ${fmtNum(debtY.last)}% interanual.` });
    }
    return { lead, items };
  },
};
