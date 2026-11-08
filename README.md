# Macroeconomics

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

## Clave de BLS (opcional)
La actualización diaria de EE.UU. usa la API pública de BLS, que sin clave permite pocas consultas por día. Con una clave gratuita el límite sube a 500.
1. Pedirla en https://data.bls.gov/registrationEngine/ (llega por correo).
2. En GitHub: Settings → Secrets and variables → Actions → New repository secret. Nombre: `BLS_API_KEY`. Valor: la clave.
3. Correr el workflow "Actualizar datos" a mano para probarla.
La clave nunca va en el código de la página ni en archivos del repositorio: solo la usa el workflow.

## Portada: mapa del mundo
- `js/ui/worldhero.js` dibuja un mapa de puntos (`js/data/world-mask.js`, generado con Natural Earth) con ocho plazas: Buenos Aires, Nueva York, Ciudad de México, São Paulo, Londres, Eurozona, Shanghái y Tokio. El foco rota cada 5 s o al pasar el mouse. Con "reducir movimiento" activado no hay animación.
- Los datos (`js/data/world.js`) se renuevan cada minuto: dólares (DolarAPI), riesgo país (ArgentinaDatos), bonos y tasa de la Fed (Tesoro y NY Fed), monedas (Frankfurter, cierre del BCE, un dato por día hábil) y bitcoin (CoinGecko).
- No hay petróleo, oro ni bolsas porque no encontré fuentes gratuitas que permitan consultas desde el navegador.

## Diseño
Paleta y tipografía en `css/tokens.css`: gris frío, superficies blancas con filete, azul marino, serif editorial (Source Serif 4) para títulos y mono tabular (IBM Plex Mono) para cifras. Acentos por país solo en filetes y series de gráficos.

## Calendario de próximos datos
- Se genera solo: el workflow diario corre `tools/update-calendar.ps1`, que lee el PDF oficial del calendario de difusión del INDEC (`calendario_<semestre>sem<año>.pdf`) y la página de reuniones de la Fed, y escribe `data/calendario.json`. Cuando el INDEC publica el calendario del próximo semestre, entra solo.
- Qué publicaciones del INDEC se muestran: la lista `$indecMap` del script (IPC, salarios, ICA, EMAE, IPI, PBI, mercado de trabajo, balanza de pagos, SIPM y servicios públicos).
- Eventos que no se pueden leer automáticamente (los del BLS y las actas de la Fed, cuyo sitio bloquea la lectura) se cargan a mano en `data/calendario-manual.json` y se mezclan en cada corrida. Las fechas de noviembre de 2026 a enero de 2027 se tomaron de Forex Factory y se verificaron contra el horario oficial del BLS (8:30 hora del Este). Hay que repasarlas cada tanto: Forex Factory solo muestra unas semanas por delante.
- Cada evento puede traer `previo`, que indica qué dato anterior mostrar tomándolo de nuestras propias series (por ejemplo "Anterior (m/m): +0,6% (sep 2026)"). Es el último valor que tenemos, que puede estar unos días detrás de la publicación oficial: por eso se muestra con su mes.
- `consenso` es un texto opcional que se muestra tal cual ("Consenso: ..."). Se deja vacío a propósito: los pronósticos de Forex Factory no se copian porque sus condiciones de uso no permiten republicarlos.
- Si el INDEC o la Fed no responden, se conserva el calendario anterior. El horario de las publicaciones del INDEC (16:00 h) es el habitual: su calendario no lo indica.
- Se corre a mano con `powershell -File tools\update-calendar.ps1`.

## Descarga de datos
Cada gráfico tiene un botón "Descargar CSV" (`js/lib/csv.js`): baja todo el historial disponible de las series del gráfico, con separador `;`, coma decimal y UTF-8 con BOM, listo para abrir en Excel en español.
## Barra superior
`js/ui/ticker.js`: dólares con variación del día, brecha CCL y tasas de EE.UU. Se actualiza cada 60 s. La variación del día y de 30 días sale de los últimos 70 días de `data/dolar.json` (campo `daily`).

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
- **Límite de BLS:** su API pública permite unas 25 consultas por día por IP, por eso esas series se guardan 6 horas en el navegador. Si el límite se agota, la página usa el historial; y si el descargador recibe series vacías, conserva las anteriores (`Restore-Empty`).
- **Qué es "tiempo real":** casi todos los indicadores se publican una vez al mes o al trimestre; en vivo cambian el dólar, las tasas y los datos nuevos apenas la fuente los publica.

## Probar en local
`powershell -File tools\serve.ps1` y abrir http://localhost:8765


