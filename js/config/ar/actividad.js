/**
 * actividad.js — Argentina · Actividad económica.
 * Misma estructura que js/config/argentina.js (kpis, panels, analyze).
 */
import { fmtNum, fmtDate } from '../../lib/format.js';

export const actividad = {
  key: 'ar',
  name: 'Actividad',
  tagline: 'EMAE, producción industrial y PBI',
  dataUrl: 'data/argentina.json',

  kpis: [
    { label: 'EMAE var. mensual', ref: { id: 'emae', t: 'pct1' }, decimals: 1, suffix: '%', polarity: 'up' },
    { label: 'EMAE var. interanual', ref: { id: 'emae', t: 'yoy' }, decimals: 1, suffix: '%', polarity: 'up' },
    { label: 'Industria var. mensual', ref: { id: 'ipi', t: 'pct1' }, decimals: 1, suffix: '%', polarity: 'up' },
    { label: 'Industria var. interanual', ref: { id: 'ipi', t: 'yoy' }, decimals: 1, suffix: '%', polarity: 'up' },
    { label: 'PBI var. interanual', ref: { id: 'gdp_level', t: 'yoy' }, decimals: 1, suffix: '%', polarity: 'up' },
  ],

  panels: [
    {
      id: 'act-emae-nivel', title: 'EMAE', unit: 'Índice 2004 = 100 · desestacionalizado', polarity: 'up',
      headline: { ref: { id: 'emae' }, decimals: 1, suffix: ' pts' },
      datasets: [{ ref: { id: 'emae' }, label: 'EMAE', type: 'line', color: 'accent', fill: true, decimals: 1 }],
      read: 'Estimador mensual de la actividad económica. Anticipa el PBI. Una pendiente positiva indica que la economía crece frente al mes anterior, sin efecto estacional.',
      source: 'INDEC · EMAE base 2004 (datos.gob.ar)',
    },
    {
      id: 'act-emae-var', title: 'EMAE, variación mensual', unit: 'Variación % contra el mes anterior', polarity: 'up',
      headline: { ref: { id: 'emae', t: 'pct1' }, decimals: 1, suffix: '%' },
      datasets: [{ ref: { id: 'emae', t: 'pct1' }, label: 'Var. mensual', type: 'bar', color: 'accent', decimals: 1, signColors: true }],
      read: 'Cuánto subió o bajó la actividad cada mes. Las barras rojas son meses de caída. Es una serie volátil: conviene mirar varios meses seguidos.',
      source: 'Cálculo propio sobre INDEC · EMAE desestacionalizado',
    },
    {
      id: 'act-ipi', title: 'Industria manufacturera (IPI)', unit: 'Índice base 2004 · desestacionalizado', polarity: 'up',
      headline: { ref: { id: 'ipi' }, decimals: 1, suffix: ' pts' },
      datasets: [{ ref: { id: 'ipi' }, label: 'IPI', type: 'line', color: 'accent', fill: true, decimals: 1 }],
      read: 'Mide el volumen físico de producción de la industria. Es más sensible al ciclo que el resto de la actividad y suele reflejar el consumo y la inversión.',
      source: 'INDEC · IPI manufacturero, serie desestacionalizada (datos.gob.ar)',
    },
    {
      id: 'act-pbi', title: 'PBI, variación interanual', unit: 'Variación % contra el mismo trimestre del año anterior', polarity: 'up',
      headline: { ref: { id: 'gdp_level', t: 'yoy' }, decimals: 1, suffix: '%' },
      datasets: [{ ref: { id: 'gdp_level', t: 'yoy' }, label: 'PBI', type: 'bar', color: 'accent', decimals: 1, signColors: true }],
      read: 'Crecimiento del PBI real comparado con el mismo trimestre de un año antes. Elimina la estacionalidad y muestra el ciclo de fondo.',
      source: 'Cálculo propio sobre INDEC · PBI a precios de 2004',
    },
  ],

  analyze(g) {
    const emae = g({ id: 'emae', t: 'yoy' });
    const emaeM = g({ id: 'emae', t: 'pct1' });
    const ipi = g({ id: 'ipi', t: 'yoy' });
    const ipiM = g({ id: 'ipi', t: 'pct1' });
    const pbi = g({ id: 'gdp_level', t: 'yoy' });
    const items = [];
    let lead = '';
    if (emae && emaeM) {
      lead = `La actividad ${emae.last >= 0 ? 'crece' : 'cae'} ${fmtNum(Math.abs(emae.last))}% interanual en ${fmtDate(emae.date)}.`;
      items.push({ title: 'EMAE', text: `En el mes ${emaeM.last >= 0 ? 'subió' : 'bajó'} ${fmtNum(Math.abs(emaeM.last))}% sin estacionalidad (${fmtNum(emaeM.prev)}% el mes anterior).` });
    }
    if (ipi && ipiM) {
      items.push({ title: 'Industria', text: `El IPI ${ipi.last >= 0 ? 'crece' : 'cae'} ${fmtNum(Math.abs(ipi.last))}% interanual en ${fmtDate(ipi.date)}; en el mes, ${fmtNum(ipiM.last)}% (desestacionalizado).` });
    }
    if (pbi) {
      items.push({ title: 'PBI', text: `El PBI del ${fmtDate(pbi.date, 'Q')} ${pbi.last >= 0 ? 'creció' : 'cayó'} ${fmtNum(Math.abs(pbi.last))}% contra el mismo trimestre del año anterior.` });
    }
    return { lead, items };
  },
};
