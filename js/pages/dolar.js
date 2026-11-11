/** Página Tipo de cambio */
import { dolar } from '../config/dolar.js';
import { NEWS_MATCH_FX } from '../config/ar/index.js';
import { loadCountry } from '../data/loader.js';
import { initPage, mountFx, showError } from '../app.js';
import { createMiniNews } from '../ui/news.js';

const page = initPage('dolar');
const root = document.querySelector('#root');
// Al final: hasta 3 noticias de alto impacto del mercado cambiario (si no hay, no se muestra) y las fuentes
const tail = createMiniNews({ url: 'data/noticias-ar.json', match: NEWS_MATCH_FX }).node;

loadCountry(dolar)
  .then((data) => mountFx(page, dolar, data, root, { tail, sourcesFoot: true }))
  .catch((err) => showError(root, err));
