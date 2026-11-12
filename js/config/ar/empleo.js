/** empleo.js — Argentina · Empleo e ingresos: mercado laboral, salarios y canastas. */
import { fmtNum, fmtDate } from '../../lib/format.js';

export const empleo = {
  key: 'ar',
  name: 'Empleo e ingresos',
  tagline: 'Desempleo, empleo registrado, salarios, jubilación mínima, pobreza y desigualdad',
  extraUrl: 'data/ar-extra.json', // series de tools/fetch-ar.py (EPH desde 1982, SIPA, salarios reales, haber mínimo, pobreza, Gini)
  dataUrl: 'data/argentina.json',

  panels: [
    {
      id: 'emp-desempleo', title: 'Desempleo', unit: '% de la población económicamente activa · trimestral, desde 2003', polarity: 'down',
      headline: { ref: { id: 'unemp' }, decimals: 1, suffix: '%' },
      datasets: [{ ref: { id: 'unemp_long' }, label: 'Desocupación', type: 'line', color: 'accent', fill: true, decimals: 1 }],
      read: 'Porcentaje de personas que buscan trabajo y no lo consiguen, sobre la población activa (ocupados más desocupados). Sale de la Encuesta Permanente de Hogares (EPH continua, desde 2003), que releva los principales aglomerados urbanos.',
      source: 'INDEC · EPH continua, total aglomerados (datos.gob.ar)',
    },
    {
      id: 'emp-actividad', title: 'Actividad y empleo', unit: '% de la población total · trimestral, desde 2003', polarity: 'up',
      headline: { ref: { id: 'employment_rate' }, decimals: 1, suffix: '% empleo' },
      datasets: [
        { ref: { id: 'activity_long' }, label: 'Tasa de actividad', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'employment_long' }, label: 'Tasa de empleo', type: 'line', color: 'series2', decimals: 1 },
      ],
      read: 'La tasa de actividad mide cuántas personas trabajan o buscan trabajo; la de empleo, cuántas trabajan, ambas sobre la población total. Si la actividad cae, el desempleo puede bajar aunque no se cree empleo (menos gente busca).',
      source: 'INDEC · EPH continua, total aglomerados (datos.gob.ar)',
    },
    {
      id: 'emp-largo-plazo', title: 'Mercado laboral desde 1982', unit: '% · promedio anual', polarity: 'none',
      headline: { ref: { id: 'unemp_annual' }, decimals: 1, suffix: '% desempleo' },
      datasets: [
        { ref: { id: 'unemp_annual' }, label: 'Desocupación', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'activity_annual' }, label: 'Actividad', type: 'line', color: 'series2', decimals: 1 },
        { ref: { id: 'employment_annual' }, label: 'Empleo', type: 'line', color: 'series2', decimals: 1 },
      ],
      timeline: { kind: 'rate', freq: 'A', range: 0, freqs: ['M', 'Q', 'A'], desc: { base: 'promedio anual', agg: 'promedio anual' } },
      read: 'Serie anual del INDEC: hasta 2002, EPH puntual (mayo y octubre); desde 2003, EPH continua. Los dos métodos no son idénticos, pero el INDEC publica la serie completa. Muestra el salto del desempleo en los noventa y en la crisis de 2001-2002.',
      source: 'INDEC · EPH puntual (1982-2002) y continua (desde 2003), total aglomerados (datos.gob.ar)',
    },
    {
      id: 'emp-sipa', title: 'Empleo asalariado registrado', unit: 'Miles de asalariados con aportes (SIPA)', polarity: 'up',
      headline: { ref: { id: 'sipa_priv' }, decimals: 0, suffix: ' mil privados' },
      datasets: [
        { ref: { id: 'sipa_priv' }, label: 'Sector privado (sin estacionalidad)', type: 'line', color: 'accent', decimals: 0 },
        { ref: { id: 'sipa_pub' }, label: 'Sector público (con estacionalidad)', type: 'line', color: 'series2', decimals: 0 },
      ],
      timeline: { kind: 'stock', freq: 'M', range: 10, freqs: ['M', 'Q', 'A'], desc: { base: 'miles de personas', agg: 'fin de período' } },
      read: 'Asalariados con aportes al Sistema Integrado Previsional Argentino (SIPA). A diferencia de la EPH, es un registro administrativo: cubre todo el país pero solo el empleo formal. El dato del sector público se publica solo con estacionalidad.',
      source: 'SIPA · Trabajadores registrados (datos.gob.ar)',
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
      id: 'emp-salario-real', title: 'Salarios por sector', unit: 'Índice oct 2016 = 100 · deflactado por el IPC empalmado', polarity: 'up',
      headline: { ref: { id: 'w_priv_real', t: 'yoy' }, decimals: 1, suffix: '% real privado' },
      datasets: [
        { ref: { id: 'w_priv_real' }, label: 'Privado registrado', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'w_pub_real' }, label: 'Público', type: 'line', color: 'series2', decimals: 1 },
        { ref: { id: 'w_noreg_real' }, label: 'Privado no registrado', type: 'line', color: 'series2', decimals: 1 },
      ],
      variants: [
        { key: 'real', label: 'Real', unit: 'Índice oct 2016 = 100 · deflactado por el IPC empalmado', datasets: [
          { ref: { id: 'w_priv_real' }, label: 'Privado registrado', type: 'line', color: 'accent', decimals: 1 },
          { ref: { id: 'w_pub_real' }, label: 'Público', type: 'line', color: 'series2', decimals: 1 },
          { ref: { id: 'w_noreg_real' }, label: 'Privado no registrado', type: 'line', color: 'series2', decimals: 1 },
        ] },
        { key: 'nominal', label: 'Nominal', unit: 'Índice oct 2016 = 100 · pesos corrientes', datasets: [
          { ref: { id: 'w_priv_nom' }, label: 'Privado registrado', type: 'line', color: 'accent', decimals: 0 },
          { ref: { id: 'w_pub_nom' }, label: 'Público', type: 'line', color: 'series2', decimals: 0 },
          { ref: { id: 'w_noreg_nom' }, label: 'Privado no registrado', type: 'line', color: 'series2', decimals: 0 },
        ] },
      ],
      timeline: { kind: 'index', freq: 'M', range: 0, freqs: ['M', 'Q', 'A'], desc: { base: 'índice', agg: 'promedio del índice' } },
      read: 'Índice de salarios del INDEC. En términos reales (deflactado por el IPC), un valor por debajo de 100 indica menos poder de compra que en octubre de 2016. El salario no registrado se publica con unos cinco meses de rezago y es más volátil.',
      source: 'INDEC · Índice de salarios base oct 2016; deflactado con el IPC empalmado (cálculo propio)',
    },
    {
      id: 'emp-haber', title: 'Haber mínimo jubilatorio', unit: 'Pesos del último mes con IPC · desde 1992', polarity: 'up',
      headline: { ref: { id: 'haber_min_nom' }, decimals: 0, prefix: '$' },
      datasets: [{ ref: { id: 'haber_min_real' }, label: 'Haber mínimo (real)', type: 'line', color: 'accent', fill: true, decimals: 0 }],
      variants: [
        { key: 'real', label: 'Real', unit: 'Pesos del último mes con IPC (deflactado) · desde 1992', datasets: [{ ref: { id: 'haber_min_real' }, label: 'Haber mínimo (real)', type: 'line', color: 'accent', fill: true, decimals: 0 }] },
        { key: 'nominal', label: 'Nominal', unit: 'Pesos corrientes · desde 1992', datasets: [{ ref: { id: 'haber_min_nom' }, label: 'Haber mínimo (nominal)', type: 'line', color: 'accent', fill: true, decimals: 0 }] },
      ],
      timeline: { kind: 'price', freq: 'M', range: 0, freqs: ['M', 'Q', 'A'], desc: { base: 'pesos por mes', agg: 'promedio del período' } },
      read: 'Jubilación mínima mensual (sin bonos). En términos reales está expresada en pesos de hoy: muestra cuánto poder de compra tenía en cada momento. Arranca en 1992 porque antes la serie cambia de moneda (pesos ley, pesos argentinos, australes).',
      source: 'ANSES / Secretaría de Seguridad Social (datos.gob.ar); deflactado con el IPC empalmado (cálculo propio)',
    },
    {
      id: 'emp-pobreza', title: 'Pobreza e indigencia', unit: '% de las personas', polarity: 'down',
      headline: { ref: { id: 'poverty_wb' }, decimals: 1, suffix: '% pobreza' },
      datasets: [
        { ref: { id: 'poverty_puntual' }, label: 'Pobreza, GBA (EPH puntual, semestral)', type: 'line', color: 'accent', decimals: 1 },
        { ref: { id: 'indigence_puntual' }, label: 'Indigencia, GBA (EPH puntual, semestral)', type: 'line', color: 'series2', decimals: 1 },
        { ref: { id: 'poverty_wb' }, label: 'Pobreza, total urbano (anual)', type: 'line', color: 'series2', decimals: 1 },
      ],
      // Por defecto anual: el dato del Banco Mundial es anual y no se puede pasar a semestral; en semestral se ve solo la EPH puntual
      timeline: { kind: 'stock', freq: 'A', range: 0, freqs: ['M', 'Q', 'S', 'A'], desc: { base: '% de las personas', agg: 'último dato del año (octubre en la EPH puntual)' }, note: 'último dato del año' },
      read: 'Porcentaje de personas en hogares cuyo ingreso no alcanza la canasta básica total (pobreza) o la alimentaria (indigencia). 1988-2003: EPH puntual en el Gran Buenos Aires (mayo y octubre). Desde 2016: dato anual del total urbano, según el Banco Mundial a partir del INDEC. Entre 2003 y 2015 no hay una serie oficial disponible en estas fuentes: la del INDEC de esos años fue discontinuada y no es comparable.',
      source: 'INDEC · EPH puntual (datos.gob.ar); Banco Mundial (SI.POV.NAHC) a partir del INDEC',
    },
    {
      id: 'emp-gini', title: 'Desigualdad del ingreso (Gini)', unit: 'Coeficiente de Gini del ingreso per cápita familiar · 0 = igualdad total', polarity: 'down',
      headline: { ref: { id: 'gini' }, decimals: 3 },
      datasets: [{ ref: { id: 'gini' }, label: 'Gini', type: 'line', color: 'accent', decimals: 3 }],
      timeline: { kind: 'rate', freq: 'Q', range: 0, freqs: ['M', 'Q', 'A'], desc: { base: 'coeficiente', agg: 'promedio del período' } },
      read: 'Mide cuán desigual es la distribución del ingreso entre los hogares: 0 sería que todos ganan lo mismo y 1, que uno solo concentra todo. Sale de la EPH (aglomerados urbanos). Los datos de 2007-2015 provienen del período de intervención del INDEC.',
      source: 'INDEC · EPH, distribución del ingreso (datos.gob.ar)',
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
