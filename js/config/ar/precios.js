/** precios.js — Argentina · Precios: IPC general, núcleo, regulados y canastas. */
import { fmtNum, fmtDate } from '../../lib/format.js';

export const precios = {
  key: 'ar',
  name: 'Precios',
  tagline: 'IPC general, núcleo, regulados y canastas',
  dataUrl: 'data/argentina.json',

  kpis: [
    { label: 'Inflación mensual', ref: { id: 'ipc', t: 'pct1' }, decimals: 1, suffix: '%', polarity: 'down' },
    { label: 'Inflación interanual', ref: { id: 'ipc', t: 'yoy' }, decimals: 1, suffix: '%', polarity: 'down' },
    { label: 'Núcleo mensual', ref: { id: 'core', t: 'pct1' }, decimals: 1, suffix: '%', polarity: 'down' },
    { label: 'Núcleo interanual', ref: { id: 'core', t: 'yoy' }, decimals: 1, suffix: '%', polarity: 'down' },
    { label: 'Regulados interanual', ref: { id: 'regulated', t: 'yoy' }, decimals: 1, suffix: '%', polarity: 'down' },
  ],

  summary: [
    { label: 'IPC general', note: 'INDEC · var. mensual', ref: { id: 'ipc', t: 'pct1' }, decimals: 1, kind: 'change', trend: true, polarity: 'down' },
    { label: 'IPC núcleo', note: 'INDEC · var. mensual', ref: { id: 'core', t: 'pct1' }, decimals: 1, kind: 'change', trend: true, polarity: 'down' },
    { label: 'IPC regulados', note: 'INDEC · var. mensual', ref: { id: 'regulated', t: 'pct1' }, decimals: 1, kind: 'change', trend: true, polarity: 'down' },
    { label: 'IPC general interanual', note: 'INDEC · var. %', ref: { id: 'ipc', t: 'yoy' }, decimals: 1, kind: 'change', trend: true, polarity: 'down' },
    { label: 'IPC núcleo interanual', note: 'INDEC · var. %', ref: { id: 'core', t: 'yoy' }, decimals: 1, kind: 'change', trend: true, polarity: 'down' },
    { label: 'Canasta básica total i.a.', note: 'INDEC · línea de pobreza', ref: { id: 'poverty_line', t: 'yoy' }, decimals: 1, kind: 'change', trend: true, polarity: 'down' },
  ],

  panels: [
    {
      id: 'pre-mensual', title: 'Inflación mensual', unit: 'Variación % mensual', polarity: 'down',
      headline: { ref: { id: 'ipc', t: 'pct1' }, decimals: 1, suffix: '%' },
      datasets: [
        { ref: { id: 'ipc', t: 'pct1' }, label: 'General', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'core', t: 'pct1' }, label: 'Núcleo', type: 'line', color: 'series2', decimals: 1 },
        { ref: { id: 'regulated', t: 'pct1' }, label: 'Regulados', type: 'line', color: '--fx-blue', decimals: 1 },
      ],
      read: 'El núcleo excluye precios estacionales y regulados, y muestra la tendencia de fondo de la inflación. Los regulados (tarifas, transporte, combustibles) dependen de decisiones de política.',
      source: 'INDEC · IPC nacional, base dic 2016 (datos.gob.ar)',
    },
    {
      id: 'pre-interanual', title: 'Inflación interanual', unit: 'Variación % contra el mismo mes del año anterior', polarity: 'down',
      headline: { ref: { id: 'ipc', t: 'yoy' }, decimals: 1, suffix: '%' },
      datasets: [
        { ref: { id: 'ipc', t: 'yoy' }, label: 'General', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'core', t: 'yoy' }, label: 'Núcleo', type: 'line', color: 'series2', decimals: 1 },
        { ref: { id: 'regulated', t: 'yoy' }, label: 'Regulados', type: 'line', color: '--fx-blue', decimals: 1 },
      ],
      read: 'Si el núcleo está por debajo del general, los aumentos vienen más de regulados y estacionales que de la inflación de fondo; si está por encima, la presión es más persistente.',
      source: 'Cálculo propio sobre INDEC · IPC nacional',
    },
    {
      id: 'pre-canastas', title: 'Canastas básicas', unit: 'Variación % interanual · comparadas con el IPC', polarity: 'down',
      headline: { ref: { id: 'poverty_line', t: 'yoy' }, decimals: 1, suffix: '% total' },
      datasets: [
        { ref: { id: 'poverty_line', t: 'yoy' }, label: 'Canasta total (pobreza)', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'indigence_line', t: 'yoy' }, label: 'Canasta alimentaria (indigencia)', type: 'line', color: '--fx-mep', decimals: 1 },
        { ref: { id: 'ipc', t: 'yoy' }, label: 'IPC general', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'La canasta alimentaria define la línea de indigencia y la total, la de pobreza. Si suben más que el IPC, los alimentos y servicios básicos se encarecen más que el promedio.',
      source: 'INDEC · Canastas básicas (datos.gob.ar)',
    },
    {
      id: 'pre-nivel', title: 'Nivel de precios', unit: 'Índice dic 2016 = 100', polarity: 'none',
      headline: { ref: { id: 'ipc' }, decimals: 0, suffix: ' pts' },
      datasets: [
        { ref: { id: 'ipc' }, label: 'General', type: 'line', color: 'accent', decimals: 0 },
        { ref: { id: 'core' }, label: 'Núcleo', type: 'line', color: 'series2', decimals: 0 },
        { ref: { id: 'regulated' }, label: 'Regulados', type: 'line', color: '--fx-blue', decimals: 0 },
      ],
      read: 'Cuánto se acumuló el aumento de precios desde diciembre de 2016, cuando el índice valía 100. Si una línea se separa de las otras, ese grupo subió más que el resto.',
      source: 'INDEC · IPC nacional, base dic 2016 (datos.gob.ar)',
    },
  ],

  analyze(g) {
    const yoy = g({ id: 'ipc', t: 'yoy' });
    const mom = g({ id: 'ipc', t: 'pct1' });
    const coreM = g({ id: 'core', t: 'pct1' });
    const coreY = g({ id: 'core', t: 'yoy' });
    const regY = g({ id: 'regulated', t: 'yoy' });
    const cba = g({ id: 'indigence_line', t: 'yoy' });
    const cbt = g({ id: 'poverty_line', t: 'yoy' });
    const items = [];
    let lead = '';
    if (yoy && mom) {
      lead = `Los precios subieron ${fmtNum(mom.last)}% en ${fmtDate(mom.date)} y ${fmtNum(yoy.last)}% en doce meses.`;
      items.push({ title: 'General', text: `La inflación mensual fue ${fmtNum(mom.last)}% (${fmtNum(mom.back)}% tres meses antes). La interanual pasó de ${fmtNum(yoy.back)}% a ${fmtNum(yoy.last)}%.` });
    }
    if (coreM && coreY && yoy) {
      const gap = coreY.last - yoy.last;
      items.push({ title: 'Núcleo', text: `El núcleo subió ${fmtNum(coreM.last)}% en el mes y ${fmtNum(coreY.last)}% interanual, ${fmtNum(Math.abs(gap))} pp ${gap >= 0 ? 'por encima' : 'por debajo'} del índice general.` });
    }
    if (regY && yoy) {
      items.push({ title: 'Regulados', text: `Los precios regulados suben ${fmtNum(regY.last)}% interanual, ${regY.last >= yoy.last ? 'más' : 'menos'} que el promedio (${fmtNum(yoy.last)}%).` });
    }
    if (cba && cbt && yoy) {
      items.push({ title: 'Canastas', text: `La canasta total subió ${fmtNum(cbt.last)}% interanual y la alimentaria ${fmtNum(cba.last)}%, frente a ${fmtNum(yoy.last)}% del IPC.` });
    }
    return { lead, items };
  },
};
