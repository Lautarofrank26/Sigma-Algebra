/**
 * Inicio: mapa de calor del mundo (PBI, inflación, desempleo) y calendario
 * de los próximos datos. El detalle de cada país está en sus propias secciones (barra lateral).
 */
import { argentina } from '../config/argentina.js';
import { usa } from '../config/usa.js';
import { loadCountry } from '../data/loader.js';
import { initPage, setUpdated, showError } from '../app.js';
import { loadCalendar, renderCalendar } from '../ui/calendar.js';
import { mountHeatmap } from '../ui/heatmap.js';
import { createNews } from '../ui/news.js';
import { revealIn } from '../ui/reveal.js';

initPage('inicio');
const mapRoot = document.querySelector('#map-root');
const root = document.querySelector('#root');

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return res.json();
}

async function init() {
  // El mapa y el calendario son independientes: si uno falla, el otro se muestra igual
  const mapTask = Promise.all([getJson('data/paises.json'), getJson('data/mundo.json'), getJson('data/mundo-series.json').catch(() => null)])
    .then(([shapes, world, series]) => mountHeatmap(mapRoot, { shapes, world, series })) // sin series, el mapa funciona igual pero sin evolución ni comparador
    .catch((err) => showError(mapRoot, err));

  try {
    const [ar, us] = await Promise.all([loadCountry(argentina), loadCountry(usa)]); // el calendario muestra el dato anterior de cada serie
    const calendar = await loadCalendar().then((cal) => renderCalendar(cal, { ar, us })).catch(() => null);
    // Noticias globales: el mismo componente que usa el Resumen de Argentina, con otra configuración
    const news = createNews({
      url: 'data/noticias-global.json',
      title: 'Lo que mueve a los mercados del mundo',
      sub: 'Lo más importante de cada período en bancos centrales, datos, geopolítica y comercio, con su fuente.',
      tabs: [['eco', 'Mercados y Economía'], ['geo', 'Geopolítica y Política']],
    });
    root.replaceChildren(...[calendar, news.node].filter(Boolean));
    revealIn(root);
    setUpdated(ar.updated < us.updated ? ar.updated : us.updated);
  } catch (err) {
    showError(root, err);
  }
  await mapTask;
}

init();
