# Pulso Macro

Página estática (HTML, CSS y JS sin build) con indicadores macro de Argentina y EE.UU.

## Estructura
- `index.html`: página única
- `css/`: tokens, base, layout, componentes
- `js/config/`: qué indicadores se muestran por sección (`argentina.js`, `usa.js`, `dolar.js`)
- `js/data/`: carga de datos (`loader.js` snapshots, `live.js` dólar en vivo)
- `js/lib/`, `js/ui/`: utilidades y componentes
- `data/*.json`: snapshots generados por `tools/fetch-data.ps1`
- `.github/workflows/update-data.yml`: actualiza los datos todos los días

## Cómo se actualizan los datos
- **Diario:** GitHub Actions corre `tools/fetch-data.ps1` y sube los JSON. También se puede correr a mano en la pestaña Actions.
- **En vivo:** las cotizaciones del día del dólar se piden desde el navegador cada 60 s (DolarAPI).

## Probar en local
`powershell -File tools\serve.ps1` y abrir http://localhost:8765
