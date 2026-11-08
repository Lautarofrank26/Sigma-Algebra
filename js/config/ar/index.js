/**
 * index.js — registro de las páginas temáticas de Argentina.
 * Para sumar una: crear js/config/ar/<tema>.js, agregarla a TEMAS y a SUBNAVS (js/config/navigation.js), y crear <tema>.html.
 */
import { actividad } from './actividad.js';
import { precios } from './precios.js';
import { empleo } from './empleo.js';
import { externo } from './externo.js';
import { monetario } from './monetario.js';
import { fiscal } from './fiscal.js';

export const TEMAS = { actividad, precios, empleo, externo, monetario, fiscal };


