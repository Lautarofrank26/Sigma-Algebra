/** empleo.js — EE.UU. · Empleo: desempleo, creación de puestos, vacantes y salarios. */
import { fmtNum, fmtDate } from '../../lib/format.js';

export const empleo = {
  key: 'us',
  name: 'Empleo',
  tagline: 'Desempleo, puestos de trabajo, vacantes y salarios',
  dataUrl: 'data/usa.json',

  panels: [
    {
      id: 'usemp-desempleo', title: 'Desempleo', unit: '% de la fuerza laboral', polarity: 'down',
      headline: { ref: { id: 'unemp' }, decimals: 1, suffix: '%' },
      datasets: [
        { ref: { id: 'unemp' }, label: 'Desempleo (U-3)', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'u6' }, label: 'Ampliado (U-6)', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'El U-3 es la tasa oficial. El U-6 suma a los desalentados y a quienes trabajan menos horas de las que quieren; la distancia entre ambos mide la holgura oculta del mercado.',
      source: 'BLS · Current Population Survey',
    },
    {
      id: 'usemp-participacion', title: 'Participación y empleo', unit: '% de la población adulta', polarity: 'up',
      headline: { ref: { id: 'epop' }, decimals: 1, suffix: '% empleo' },
      datasets: [
        { ref: { id: 'participation' }, label: 'Participación laboral', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'epop' }, label: 'Empleo / población', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'La participación es el % de adultos que trabaja o busca trabajo. Empleo/población es el % que efectivamente trabaja. Si ambas caen, el desempleo puede bajar por razones no deseables.',
      source: 'BLS · Current Population Survey',
    },
    {
      id: 'usemp-puestos', title: 'Creación de empleo', unit: 'Miles de puestos por mes · no agrícola', polarity: 'up',
      headline: { ref: { id: 'payrolls', t: 'diff3avg' }, decimals: 0, suffix: ' mil' },
      datasets: [
        { ref: { id: 'payrolls', t: 'diff' }, label: 'Cambio mensual', type: 'bar', color: 'accent', decimals: 0, signColors: true },
        { ref: { id: 'payrolls', t: 'diff3avg' }, label: 'Promedio 3 meses', type: 'line', color: 'series2', decimals: 0 },
      ],
      read: 'Puestos que se suman o se pierden cada mes. El promedio de tres meses filtra el ruido y muestra el ritmo de fondo. El valor grande de arriba es ese promedio.',
      source: 'BLS · Current Employment Statistics',
    },
    {
      id: 'usemp-vacantes', title: 'Vacantes (JOLTS)', unit: 'Miles de puestos abiertos', polarity: 'none',
      headline: { ref: { id: 'jolts_openings' }, decimals: 0, suffix: ' mil' },
      datasets: [{ ref: { id: 'jolts_openings' }, label: 'Vacantes', type: 'line', color: 'accent', fill: true, decimals: 0 }],
      read: 'Cuántos puestos están abiertos. Más vacantes indican demanda de trabajadores y presión salarial; una caída sostenida anticipa un mercado laboral más flojo.',
      source: 'BLS · JOLTS (Job Openings and Labor Turnover Survey)',
    },
    {
      id: 'usemp-salarios', title: 'Salarios', unit: 'Variación % interanual', polarity: 'none',
      headline: { ref: { id: 'ahe', t: 'yoy' }, decimals: 1, suffix: '%' },
      datasets: [
        { ref: { id: 'ahe', t: 'yoy' }, label: 'Salario horario', type: 'line', color: 'accent', fill: true, decimals: 1 },
        { ref: { id: 'cpi', t: 'yoy' }, label: 'Inflación CPI', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'Si los salarios suben más que la inflación, el poder de compra crece. Salarios que suben mucho más que los precios pueden presionar la inflación futura.',
      source: 'BLS · Average hourly earnings y CPI-U',
    },
    {
      id: 'usemp-horas', title: 'Horas semanales', unit: 'Horas promedio por semana · sector privado', polarity: 'none',
      headline: { ref: { id: 'hours' }, decimals: 1, suffix: ' h' },
      datasets: [{ ref: { id: 'hours' }, label: 'Horas semanales', type: 'line', color: 'accent', decimals: 1 }],
      read: 'Las empresas ajustan primero las horas y después el personal. Una baja sostenida de horas suele anticipar un debilitamiento del empleo.',
      source: 'BLS · Current Employment Statistics',
    },
  ],

  analyze(g) {
    const un = g({ id: 'unemp' });
    const u6 = g({ id: 'u6' });
    const part = g({ id: 'participation' });
    const pay = g({ id: 'payrolls', t: 'diff3avg' });
    const jolts = g({ id: 'jolts_openings' });
    const ahe = g({ id: 'ahe', t: 'yoy' });
    const cpi = g({ id: 'cpi', t: 'yoy' });
    const items = [];
    let lead = '';
    if (un) {
      const t = un.back === null ? '' : un.last > un.back + 0.1 ? 'subió' : un.last < un.back - 0.1 ? 'bajó' : 'se mantuvo';
      lead = `El desempleo es ${fmtNum(un.last)}% en ${fmtDate(un.date)}${t ? ` y ${t} frente a tres meses atrás (${fmtNum(un.back)}%)` : ''}.`;
    }
    if (u6 && un) {
      items.push({ title: 'Holgura', text: `El desempleo ampliado (U-6) es ${fmtNum(u6.last)}%, ${fmtNum(u6.last - un.last)} pp por encima de la tasa oficial.` });
    }
    if (pay) {
      items.push({ title: 'Puestos', text: `La economía crea en promedio ${fmtNum(pay.last, 0)} mil puestos por mes (promedio de 3 meses), contra ${fmtNum(pay.back, 0)} mil tres meses antes.` });
    }
    if (part) {
      items.push({ title: 'Participación', text: `La participación laboral es ${fmtNum(part.last)}% (${fmtNum(part.back)}% tres meses atrás).` });
    }
    if (jolts) {
      items.push({ title: 'Vacantes', text: `Hay ${fmtNum(jolts.last, 0)} mil vacantes abiertas en ${fmtDate(jolts.date)}.` });
    }
    if (ahe && cpi) {
      const real = ahe.last - cpi.last;
      items.push({ title: 'Salarios', text: `El salario horario sube ${fmtNum(ahe.last)}% contra una inflación de ${fmtNum(cpi.last)}%: el poder de compra ${real >= 0 ? 'crece' : 'cae'} ${fmtNum(Math.abs(real))} pp.` });
    }
    return { lead, items };
  },
};
