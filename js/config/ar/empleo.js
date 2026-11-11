/** empleo.js — Argentina · Empleo e ingresos: mercado laboral, salarios y canastas. */
import { fmtNum, fmtDate } from '../../lib/format.js';

export const empleo = {
  key: 'ar',
  name: 'Empleo e ingresos',
  tagline: 'Mercado laboral y salarios',
  dataUrl: 'data/argentina.json',

  kpis: [
    { label: 'Desempleo', ref: { id: 'unemp' }, decimals: 1, suffix: '%', polarity: 'down' },
    { label: 'Tasa de actividad', ref: { id: 'activity_rate' }, decimals: 1, suffix: '%', polarity: 'up' },
    { label: 'Tasa de empleo', ref: { id: 'employment_rate' }, decimals: 1, suffix: '%', polarity: 'up' },
    { label: 'Salarios i.a.', ref: { id: 'wages', t: 'yoy' }, decimals: 1, suffix: '%', polarity: 'none', extra: { label: 'Mensual', ref: { id: 'wages', t: 'pct1' }, decimals: 1, suffix: '%', signed: true } },
    { label: 'Salario real i.a.', ref: { id: 'wages_real', t: 'yoy' }, decimals: 1, suffix: '%', polarity: 'up' },
  ],

  panels: [
    {
      id: 'emp-desempleo', title: 'Desempleo', unit: '% de la población económicamente activa · trimestral', polarity: 'down',
      headline: { ref: { id: 'unemp' }, decimals: 1, suffix: '%' },
      datasets: [{ ref: { id: 'unemp' }, label: 'Desocupación', type: 'line', color: 'accent', fill: true, decimals: 1 }],
      read: 'Personas que buscan trabajo y no lo consiguen, en 31 aglomerados urbanos. Tiene estacionalidad: conviene comparar el mismo trimestre entre años.',
      source: 'INDEC · EPH continua, total aglomerados (datos.gob.ar)',
    },
    {
      id: 'emp-actividad', title: 'Actividad y empleo', unit: '% de la población total · trimestral', polarity: 'up',
      headline: { ref: { id: 'employment_rate' }, decimals: 1, suffix: '% empleo' },
      datasets: [
        { ref: { id: 'activity_rate' }, label: 'Tasa de actividad', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'employment_rate' }, label: 'Tasa de empleo', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'La tasa de actividad es el % de la población que trabaja o busca trabajo; la de empleo, el % que efectivamente trabaja. La brecha entre ambas es el desempleo.',
      source: 'INDEC · EPH continua, total aglomerados (datos.gob.ar)',
    },
    {
      id: 'emp-salarios', title: 'Salarios vs. inflación', unit: 'Variación % interanual', polarity: 'none',
      headline: { ref: { id: 'wages', t: 'yoy' }, decimals: 1, suffix: '%' },
      datasets: [
        { ref: { id: 'wages', t: 'yoy' }, label: 'Salarios', type: 'line', color: 'accent', fill: true, decimals: 1 },
        { ref: { id: 'ipc', t: 'yoy' }, label: 'Inflación', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'Si la línea de salarios está por encima de la inflación, el poder de compra mejora; si está por debajo, se deteriora.',
      source: 'INDEC · Índice de salarios e IPC (datos.gob.ar)',
    },
    {
      id: 'emp-salario-real', title: 'Salarios reales por sector', unit: 'Variación % interanual · salario nominal deflactado por IPC', polarity: 'up',
      headline: { ref: { id: 'wages_real', t: 'yoy' }, decimals: 1, suffix: '% total' },
      datasets: [
        { ref: { id: 'wages_priv_real', t: 'yoy' }, label: 'Sector privado registrado', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'wages_pub_real', t: 'yoy' }, label: 'Sector público', type: 'line', color: '--fx-blue', decimals: 1 },
        { ref: { id: 'wages_real', t: 'yoy' }, label: 'Total', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'Cuánto cambió el poder de compra del salario contra el año anterior. Sobre cero, el salario le gana a la inflación; bajo cero, la inflación le gana al salario.',
      source: 'Cálculo propio sobre INDEC · Índice de salarios e IPC',
    },
    {
      id: 'emp-canastas', title: 'Canastas básicas', unit: 'Pesos por adulto equivalente por mes', polarity: 'none',
      headline: { ref: { id: 'poverty_line' }, decimals: 0, prefix: '$' },
      datasets: [
        { ref: { id: 'poverty_line' }, label: 'Canasta total (línea de pobreza)', type: 'line', color: 'accent', decimals: 0 },
        { ref: { id: 'indigence_line' }, label: 'Canasta alimentaria (línea de indigencia)', type: 'line', color: '--fx-mep', decimals: 0 },
      ],
      read: 'Ingreso mensual mínimo para no ser pobre (canasta total) o indigente (canasta alimentaria) para un adulto equivalente. Sirve de referencia para comparar con los salarios.',
      source: 'INDEC · Canastas básicas (datos.gob.ar)',
    },
  ],

  analyze(g) {
    const un = g({ id: 'unemp' });
    const act = g({ id: 'activity_rate' });
    const emp = g({ id: 'employment_rate' });
    const w = g({ id: 'wages', t: 'yoy' });
    const wr = g({ id: 'wages_real', t: 'yoy' });
    const wrp = g({ id: 'wages_priv_real', t: 'yoy' });
    const wru = g({ id: 'wages_pub_real', t: 'yoy' });
    const ipc = g({ id: 'ipc', t: 'yoy' });
    const items = [];
    let lead = '';
    if (wr && w && ipc) {
      lead = `Los salarios ${wr.last >= 0 ? 'ganan' : 'pierden'} ${fmtNum(Math.abs(wr.last))}% contra la inflación en ${fmtDate(wr.date)}.`;
      items.push({ title: 'Salarios', text: `Los salarios nominales suben ${fmtNum(w.last)}% interanual y los precios ${fmtNum(ipc.last)}%. El salario real ${wr.last >= 0 ? 'crece' : 'cae'} ${fmtNum(Math.abs(wr.last))}%.` });
    }
    if (wrp && wru) {
      items.push({ title: 'Por sector', text: `El salario real del sector privado registrado ${wrp.last >= 0 ? 'sube' : 'baja'} ${fmtNum(Math.abs(wrp.last))}% y el del sector público ${wru.last >= 0 ? 'sube' : 'baja'} ${fmtNum(Math.abs(wru.last))}% interanual.` });
    }
    if (un) {
      items.push({ title: 'Desempleo', text: `La desocupación fue ${fmtNum(un.last)}% en ${fmtDate(un.date, 'Q')}${un.prev !== null ? ` (${fmtNum(un.prev)}% el trimestre anterior)` : ''}.` });
    }
    if (act && emp) {
      items.push({ title: 'Participación', text: `La tasa de actividad es ${fmtNum(act.last)}% y la de empleo ${fmtNum(emp.last)}% de la población total.` });
    }
    return { lead, items };
  },
};
