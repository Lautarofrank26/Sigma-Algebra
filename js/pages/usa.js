/** Página Estados Unidos */
import { usa } from '../config/usa.js';
import { loadCountry } from '../data/loader.js';
import { initPage, mountCountry, showError } from '../app.js';

const page = initPage('eeuu', 'resumen');
const root = document.querySelector('#root');

loadCountry(usa)
  .then((data) => mountCountry(page, usa, data, root, 'us'))
  .catch((err) => showError(root, err));


