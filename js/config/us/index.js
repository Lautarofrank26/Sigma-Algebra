/**
 * index.js — registro de las páginas temáticas de EE.UU.
 * Para sumar una: crear js/config/us/<tema>.js, agregarla a TEMAS y a SUBNAVS, y crear eeuu-<tema>.html.
 */
import { precios } from './precios.js';
import { empleo } from './empleo.js';
import { tasas } from './tasas.js';

export const TEMAS = { precios, empleo, tasas };
