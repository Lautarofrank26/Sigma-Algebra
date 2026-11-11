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

/**
 * Palabras clave para "Últimas de este rubro" (al pie de cada sección): se buscan en el título de las noticias de
 * data/noticias-ar.json. Una noticia puede aparecer en más de una sección.
 */
export const NEWS_MATCH = {
  actividad: /\b(actividad|emae|pbi|industria|industrial|construcci[oó]n|producci[oó]n|recesi[oó]n|crecimiento econ|consumo|ventas minoristas|miner[ií]a|cosecha)/i,
  precios: /\b(inflaci[oó]n|ipc|precios|tarifa|canasta|desinflaci[oó]n|rem\b)/i,
  empleo: /\b(empleo|desempleo|desocupaci[oó]n|salari|trabajador|laboral|jubilaci|jubilad|pobreza|indigencia|paritari)/i,
  externo: /\b(exportaci|importaci|balanza comercial|comercio exterior|saldo comercial|cuenta corriente|aranceles?|retenciones)/i,
  monetario: /\b(tasas? de inter[eé]s|bcra|banco central|monetari|dep[oó]sitos|pr[eé]stamos|cr[eé]dito|base monetaria|cauci[oó]n|badlar|tamar|encajes|tasas|liquidez)/i,
  fiscal: /\b(fiscal|d[eé]ficit|super[aá]vit primario|gasto p[uú]blico|recaudaci[oó]n|arca|afip|presupuesto|deuda p[uú]blica|licitaci[oó]n|riesgo pa[ií]s|tesoro|fmi)/i,
};

/** Lo mismo para la sección Tipo de cambio (página dolar.html) */
export const NEWS_MATCH_FX = /\b(d[oó]lar|cambiari|cepo|bandas? cambiari|reservas|devaluaci|tipo de cambio|mep\b|ccl\b|contado con liqui|blue\b)/i;


