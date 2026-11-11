/** precios.js — EE.UU. · Precios: CPI por componente y precios al productor. */
import { fmtNum, fmtDate } from '../../lib/format.js';

export const precios = {
  key: 'us',
  name: 'Precios',
  tagline: 'CPI por componente y precios al productor',
  dataUrl: 'data/usa.json',

  panels: [
    {
      id: 'uspre-comp', title: 'Inflación por componente', unit: 'Variación % interanual', polarity: 'down',
      headline: { ref: { id: 'cpi', t: 'yoy' }, decimals: 1, suffix: '% general' },
      datasets: [
        { ref: { id: 'cpi', t: 'yoy' }, label: 'General', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'cpi_energy', t: 'yoy' }, label: 'Energía', type: 'line', color: '--fx-blue', decimals: 1 },
        { ref: { id: 'cpi_food', t: 'yoy' }, label: 'Alimentos', type: 'line', color: '--fx-mep', decimals: 1 },
      ],
      read: 'Energía y alimentos son los componentes más volátiles y explican buena parte de los saltos del índice general. Por eso la Fed mira más la inflación subyacente.',
      source: 'BLS · CPI-U, ajustado estacionalmente',
    },
    {
      id: 'uspre-vivienda', title: 'Vivienda y servicios', unit: 'Variación % interanual', polarity: 'down',
      headline: { ref: { id: 'cpi_shelter', t: 'yoy' }, decimals: 1, suffix: '% vivienda' },
      datasets: [
        { ref: { id: 'cpi_shelter', t: 'yoy' }, label: 'Vivienda', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'cpi_services', t: 'yoy' }, label: 'Servicios sin energía', type: 'line', color: '--fx-ccl', decimals: 1 },
        { ref: { id: 'corecpi', t: 'yoy' }, label: 'Subyacente', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'La vivienda pesa cerca de un tercio del CPI y se mueve despacio. Los servicios sin energía reflejan los salarios y suelen ser lo último que baja cuando cede la inflación.',
      source: 'BLS · CPI-U, ajustado estacionalmente',
    },
    {
      id: 'uspre-mensual', title: 'Inflación mensual', unit: 'Variación % contra el mes anterior', polarity: 'down',
      headline: { ref: { id: 'cpi', t: 'pct1' }, decimals: 2, suffix: '%' },
      datasets: [
        { ref: { id: 'cpi', t: 'pct1' }, label: 'General', type: 'bar', color: 'accent', decimals: 2 },
        { ref: { id: 'corecpi', t: 'pct1' }, label: 'Subyacente', type: 'line', color: 'series2', decimals: 2 },
      ],
      read: 'Cuánto subieron los precios en el mes. Un 0,2% mensual equivale a cerca de 2,4% anual, que es compatible con la meta de la Fed.',
      source: 'Cálculo propio sobre BLS · CPI-U',
    },
    {
      id: 'uspre-ppi', title: 'Precios al productor vs. consumidor', unit: 'Variación % interanual', polarity: 'down',
      headline: { ref: { id: 'ppi', t: 'yoy' }, decimals: 1, suffix: '% PPI' },
      datasets: [
        { ref: { id: 'ppi', t: 'yoy' }, label: 'PPI demanda final', type: 'line', color: 'accent', fill: true, decimals: 1 },
        { ref: { id: 'cpi', t: 'yoy' }, label: 'CPI general', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'El PPI mide los precios que reciben los productores. Suele adelantar al CPI: si sube más que el CPI, hay presión de costos que puede trasladarse a los consumidores.',
      source: 'BLS · PPI demanda final y CPI-U',
    },
  ],

  analyze(g) {
    const cpi = g({ id: 'cpi', t: 'yoy' });
    const cpiM = g({ id: 'cpi', t: 'pct1' });
    const core = g({ id: 'corecpi', t: 'yoy' });
    const en = g({ id: 'cpi_energy', t: 'yoy' });
    const fd = g({ id: 'cpi_food', t: 'yoy' });
    const sh = g({ id: 'cpi_shelter', t: 'yoy' });
    const ppi = g({ id: 'ppi', t: 'yoy' });
    const items = [];
    let lead = '';
    if (cpi && cpiM) {
      lead = `Los precios al consumidor suben ${fmtNum(cpi.last)}% interanual en ${fmtDate(cpi.date)} (${fmtNum(cpiM.last, 2)}% en el mes).`;
      items.push({ title: 'General', text: `El CPI pasó de ${fmtNum(cpi.back)}% a ${fmtNum(cpi.last)}% en tres meses. La subyacente está en ${core ? fmtNum(core.last) : '—'}%, contra una meta de 2%.` });
    }
    if (en && fd) {
      items.push({ title: 'Energía y alimentos', text: `La energía ${en.last >= 0 ? 'sube' : 'baja'} ${fmtNum(Math.abs(en.last))}% interanual y los alimentos ${fd.last >= 0 ? 'suben' : 'bajan'} ${fmtNum(Math.abs(fd.last))}%.` });
    }
    if (sh) {
      items.push({ title: 'Vivienda', text: `El costo de vivienda sube ${fmtNum(sh.last)}% interanual, ${sh.last > (core?.last ?? 0) ? 'por encima' : 'por debajo'} de la inflación subyacente.` });
    }
    if (ppi && cpi) {
      items.push({ title: 'Productor', text: `Los precios al productor suben ${fmtNum(ppi.last)}% interanual, ${ppi.last > cpi.last ? 'por encima' : 'por debajo'} del CPI general.` });
    }
    return { lead, items };
  },
};
