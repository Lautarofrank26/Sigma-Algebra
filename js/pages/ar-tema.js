/** Páginas temáticas de Argentina (actividad, precios, empleo, externo, monetario, fiscal): elige la config con <body data-tema="..."> */
import { TEMAS } from '../config/ar/index.js';
import { loadCountry } from '../data/loader.js';
import { initPage, mountCountry, showError } from '../app.js';

const tema = document.body.dataset.tema;
const config = TEMAS[tema];
const root = document.querySelector('#root');
const page = initPage('argentina', tema);

if (!config) {
  showError(root, new Error(`Tema desconocido: ${tema}`));
} else {
  loadCountry(config)
    .then((data) => mountCountry(page, config, data, root, 'ar'))
    .catch((err) => showError(root, err));
}

