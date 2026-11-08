/**
 * navigation.js — submenús por grupo (Argentina y EE.UU.).
 * Para sumar una página temática: agregar una entrada acá, su config en js/config/<grupo>/ y su .html.
 */
export const SUBNAVS = {
  argentina: [
    { id: 'resumen', href: 'argentina.html', label: 'Resumen' },
    { id: 'actividad', href: 'actividad.html', label: 'Actividad' },
    { id: 'precios', href: 'precios.html', label: 'Precios' },
    { id: 'empleo', href: 'empleo.html', label: 'Empleo e ingresos' },
    { id: 'externo', href: 'externo.html', label: 'Sector externo' },
    { id: 'monetario', href: 'monetario.html', label: 'Dinero y tasas' },
    { id: 'fiscal', href: 'fiscal.html', label: 'Frente fiscal' },
  ],
  eeuu: [
    { id: 'resumen', href: 'eeuu.html', label: 'Resumen' },
    { id: 'precios', href: 'eeuu-precios.html', label: 'Precios' },
    { id: 'empleo', href: 'eeuu-empleo.html', label: 'Empleo' },
    { id: 'tasas', href: 'eeuu-tasas.html', label: 'Tasas y deuda' },
  ],
};
