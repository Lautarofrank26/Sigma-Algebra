/** Página Argentina */
import { argentina } from '../config/argentina.js';
import { loadCountry } from '../data/loader.js';
import { initPage, mountRange, mountCountry, showError } from '../app.js';

const page = initPage('argentina', 'resumen');
mountRange(page);
const root = document.querySelector('#root');

loadCountry(argentina)
  .then((data) => mountCountry(page, argentina, data, root, 'ar'))
  .catch((err) => showError(root, err));


