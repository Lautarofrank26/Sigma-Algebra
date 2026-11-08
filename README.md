# Pulso Macro

Sitio estático multipágina (HTML, CSS y JS sin build) con indicadores macro de Argentina y EE.UU.

## Páginas
- `index.html`: panorama de las tres secciones y comparativo
- `argentina.html`, `dolar.html`, `eeuu.html`: una página por sección
- EE.UU. por tema: `eeuu-precios.html`, `eeuu-empleo.html`, `eeuu-tasas.html` (configs en `js/config/us/`)
- Argentina por tema: `actividad.html`, `precios.html`, `empleo.html`, `externo.html`, `monetario.html`, `fiscal.html` (configs en `js/config/ar/`, registro en `js/config/ar/index.js`)
- `favicon.svg`: ícono del sitio

## Estructura
- `css/`: tokens (paleta y tipografía), base, layout, componentes
- `js/pages/`: un script de entrada por página
- `js/app.js`: piezas compartidas (selector de período, montaje de secciones)
- `js/config/`: qué indicadores se muestran por sección (`argentina.js`, `usa.js`, `dolar.js`)
- `js/data/`: carga de datos (`loader.js` snapshots, `live.js` dólar en vivo)
- `js/lib/`, `js/ui/`: utilidades y componentes (`shell.js` es el menú y el pie comunes)
- `data/*.json`: snapshots generados por `tools/fetch-data.ps1`
- `.github/workflows/update-data.yml`: actualiza los datos todos los días

## Agregar un indicador
1. Sumar la serie a `tools/fetch-data.ps1` (lista `$extra` para Argentina) y correr el script.
2. Agregar un panel (y, si corresponde, una tarjeta o fila de la tabla) en el config del tema, por ejemplo `js/config/ar/precios.js`.
3. Transformaciones disponibles (`js/lib/transform.js`): `level`, `yoy`, `pct1`, `diff`, `diff3avg`, `k`, `sum12`, `sum12k`.

## Agregar una página nueva
1. Copiar `argentina.html` y cambiar título, texto y el `<script>` de la página.
2. Crear su script en `js/pages/`.
3. Sumarla a `NAV` en `js/ui/shell.js`.

## Cómo se actualizan los datos
- **Diario:** GitHub Actions corre `tools/fetch-data.ps1` y sube los JSON (historial). También se puede correr a mano en la pestaña Actions.
- **En vivo:** mientras la página está abierta, `js/data/live.js` pide los últimos datos a las fuentes y los combina con el historial: cada 5 minutos las series macro y cada 60 s las cotizaciones del dólar. Si algo falla, la página sigue con el historial. El catálogo de series en vivo está en `js/data/live-sources.js` y debe coincidir con `tools/fetch-data.ps1`.
- **Límite de BLS:** su API pública permite unas 25 consultas por día por IP, por eso esas series se guardan 6 horas en el navegador.
- **Qué es "tiempo real":** casi todos los indicadores se publican una vez al mes o al trimestre; en vivo cambian el dólar, las tasas y los datos nuevos apenas la fuente los publica.

## Probar en local
`powershell -File tools\serve.ps1` y abrir http://localhost:8765
