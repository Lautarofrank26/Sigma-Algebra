/** Página Tipo de cambio */
import { dolar } from '../config/dolar.js';
import { loadCountry } from '../data/loader.js';
import { initPage, mountRange, mountFx, showError } from '../app.js';

const page = initPage('dolar');
mountRange(page);
const root = document.querySelector('#root');

loadCountry(dolar)
  .then((data) => mountFx(page, dolar, data, root))
  .catch((err) => showError(root, err));
