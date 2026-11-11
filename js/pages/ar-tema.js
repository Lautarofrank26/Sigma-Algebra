/** Páginas temáticas de Argentina (actividad, precios, empleo, externo, monetario, fiscal): elige la config con <body data-tema="..."> */
import { TEMAS, NEWS_MATCH } from '../config/ar/index.js';
import { loadCountry } from '../data/loader.js';
import { initPage, mountCountry, showError } from '../app.js';
import { createMiniNews } from '../ui/news.js';

const tema = document.body.dataset.tema;
const config = TEMAS[tema];
const root = document.querySelector('#root');
const page = initPage('argentina', tema);

if (!config) {
  showError(root, new Error(`Tema desconocido: ${tema}`));
} else {
  // Al final de la sección: hasta 3 noticias de alto impacto de este rubro (si no hay, no se muestra) y las fuentes
  const tail = NEWS_MATCH[tema] ? createMiniNews({ url: 'data/noticias-ar.json', match: NEWS_MATCH[tema] }).node : null;
  loadCountry(config)
    .then((data) => mountCountry(page, config, data, root, 'ar', { tail, sourcesFoot: true }))
    .catch((err) => showError(root, err));
}
