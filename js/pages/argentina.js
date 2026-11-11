/** Página Argentina (Resumen): noticias de alto impacto arriba, luego cifras clave y gráficos */
import { argentina } from '../config/argentina.js';
import { loadCountry } from '../data/loader.js';
import { initPage, mountRange, mountCountry, showError } from '../app.js';
import { createNews } from '../ui/news.js';

const page = initPage('argentina', 'resumen');
mountRange(page);
const root = document.querySelector('#root');

// Mismo componente que las noticias globales del Inicio, con otra configuración (solo Argentina)
const news = createNews({
  url: 'data/noticias-ar.json',
  title: 'Lo que mueve a la Argentina',
  sub: 'Lo más importante de cada período en mercados, economía y política, con su fuente.',
  tabs: [['eco', 'Mercados y Economía'], ['pol', 'Política']],
});

loadCountry(argentina)
  .then((data) => mountCountry(page, argentina, data, root, 'ar', { lead: news.node })) // la lectura macro se reemplaza por las noticias
  .catch((err) => showError(root, err));
