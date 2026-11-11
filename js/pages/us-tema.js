/** Páginas temáticas de EE.UU. (precios, empleo, tasas): elige la config con <body data-tema="..."> */
import { TEMAS } from '../config/us/index.js';
import { loadCountry } from '../data/loader.js';
import { initPage, mountCountry, showError } from '../app.js';

const tema = document.body.dataset.tema;
const config = TEMAS[tema];
const root = document.querySelector('#root');
const page = initPage('eeuu', tema);

if (!config) {
  showError(root, new Error(`Tema desconocido: ${tema}`));
} else {
  loadCountry(config)
    .then((data) => mountCountry(page, config, data, root, 'us'))
    .catch((err) => showError(root, err));
}
