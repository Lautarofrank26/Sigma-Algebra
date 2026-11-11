# Macroeconomics

Sitio estático multipágina (HTML, CSS y JS sin build) con indicadores macro de Argentina y EE.UU.

## Páginas
- `index.html`: inicio, con el mapa mundial por variable y año, y el calendario de próximos datos
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
- `.github/workflows/update-data.yml`: actualiza los datos cuatro veces por día

## Clave de BLS (opcional)
La actualización diaria de EE.UU. usa la API pública de BLS, que sin clave permite pocas consultas por día. Con una clave gratuita el límite sube a 500.
1. Pedirla en https://data.bls.gov/registrationEngine/ (llega por correo).
2. En GitHub: Settings → Secrets and variables → Actions → New repository secret. Nombre: `BLS_API_KEY`. Valor: la clave.
3. Correr el workflow "Actualizar datos" a mano para probarla.
La clave nunca va en el código de la página ni en archivos del repositorio: solo la usa el workflow.

## Portada: mapa mundial
- `js/ui/heatmap.js` (estilos en `css/mapa.css`) pinta cada país según la variable elegida, agrupadas por categoría: **Actividad** (crecimiento real, peso en el PBI mundial, PBI per cápita PPA), **Precios y monetario** (inflación, tasa de política), **Fiscal** (deuda/PBI, resultado fiscal/PBI), **Externo** (cuenta corriente/PBI, apertura comercial) y **Social** (desempleo, población, Gini, IDH).
- Escalas fijas para todos los años: divergente centrada en 0 para las variables con signo, secuencial de un tono para las de nivel, logarítmica o por intervalos para las muy asimétricas (población, PBI per cápita, peso en el PBI, inflación, tasa).
- Slider de años con "Reproducir" (pausa y velocidad). Por defecto, el último año con buena cobertura. Sin proyecciones del FMI. País sin dato en ese año: gris.
- Clic en un país: panel con el gráfico de la variable activa (frecuencia mensual o trimestral donde existe, rango 10A / 30A / Máx, línea en el año del slider y "Comparar con…" otro país o el agregado mundial de la fuente).
- Datos en `data/mapa/` (cada variable en su archivo, que se carga recién cuando se elige), generados por `tools/fetch-mapa.py` (Python 3, sin dependencias) desde FMI (WEO, Historical Public Debt, CPI, Labor Statistics, Quarterly National Accounts), Banco Mundial, BIS, Maddison Project Database 2023 y PNUD. El workflow *Actualizar mapa mundial* lo corre los lunes. Si una fuente falla, se conserva el archivo anterior de esa variable.
- PBI per cápita: Maddison hasta su último año; después, ese valor movido con el crecimiento del PBI per cápita PPA del Banco Mundial (indicado en la fuente de cada dato).
- `data/mundo.json`, `data/mundo-series.json` y `tools/fetch-mundo.ps1` eran del mapa anterior: la página ya no los usa.

## Diseño
Paleta y tipografía en `css/tokens.css`: gris frío, superficies blancas, azul marino, serif editorial (Source Serif 4) para títulos y mono tabular (IBM Plex Mono) para cifras. Acentos por país solo en filetes y series de gráficos. Tarjetas con esquinas redondeadas (`--radius-lg`), botones y etiquetas en píldora (`--radius-pill`) y sombra suave.

### Estructura de plataforma (`css/platform.css`, `js/ui/shell.js`)
- **Barra lateral** azul marino con toda la navegación (Inicio, Argentina y sus temas, Tipo de cambio, Estados Unidos y sus temas) y la hora de Buenos Aires y Nueva York. En pantallas de menos de 1100 px es un panel que se abre con el botón de menú. Las páginas salen de `SUBNAVS` (`js/config/navigation.js`).
- **Barra superior** con la ubicación, la fecha y el buscador. En el Inicio se suma la cinta de cotizaciones globales.
- **Buscador** (`js/ui/palette.js`): se abre con Ctrl+K, con "/" o con el botón. Indexa todas las páginas y todos los gráficos a partir de las configuraciones, así un indicador nuevo aparece solo. Cada resultado lleva a `pagina.html#id-del-grafico`, que se resalta al llegar.
- **Vista ampliada** (`js/ui/focus.js`): el botón "Ampliar" de cada gráfico abre un diálogo con el gráfico grande, su propio selector de período, las últimas 12 observaciones, la explicación y la descarga.
- **Sin tarjetas de cifras**: las páginas muestran lectura (o noticias) y gráficos grandes; cada gráfico trae su cifra actual en el encabezado. No hay minigráficos ni tablas resumen. Solo la página de Tipo de cambio conserva las tarjetas de cotizaciones del día.

### Movimiento (`js/ui/reveal.js` y `css/components.css`, sección "Forma y movimiento")
- Las tarjetas suben y aparecen al entrar en pantalla, de a una; las cifras grandes cuentan desde cero.
- La línea de tendencia de cada tarjeta se dibuja sola; los gráficos tienen una cruz vertical al pasar el mouse.
- Las tarjetas se elevan al pasar el mouse y el cambio entre páginas es una transición suave.
- Con "reducir movimiento" activado en el sistema no hay animaciones, y sin JavaScript todo se ve de una vez.

### Compartir, accesibilidad e impresión
- Cada página trae etiquetas Open Graph y una imagen de vista previa (`og-image.png`, 1200×630). Las direcciones absolutas apuntan a `https://lautarofrank26.github.io/pulso-macro/`: si se renombra el repositorio o se usa un dominio propio, hay que actualizarlas en los `.html` y en la imagen.
- Hay un enlace "Saltar al contenido" para teclado, un aviso `<noscript>` y descripciones de los gráficos para lectores de pantalla.
- Al imprimir (o guardar como PDF) se ocultan menús, cinta de cotizaciones, mapa, calendario y botones.
- En celular los menús se desplazan de costado y la primera columna de las tablas queda fija.

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
## Cinta de cotizaciones del Inicio
`js/ui/ticker.js`: diez variables globales (S&P 500, Nasdaq, EEM como referencia de emergentes, bono a 10 años, VIX, DXY, USD/CNY, oro, Brent y Bitcoin) con variación del día, minigráfico de 5 días, hora de Argentina y aviso de mercado cerrado. Solo se monta en `index.html`. Los datos salen de `data/mercados.json` (`tools/fetch-mercados.ps1`, Yahoo Finance; el workflow *Actualizar mercados* corre cada 30 minutos en horario de mercado) y Bitcoin se renueva cada minuto desde CoinGecko. La cinta anterior, con los dólares de Argentina, se conserva en `js/ui/ticker-ar.js` para la sección Argentina.

## Agregar un indicador
1. Sumar la serie a `tools/fetch-data.ps1` (lista `$extra` para Argentina) y correr el script.
2. Agregar un panel (y, si corresponde, una tarjeta o fila de la tabla) en el config del tema, por ejemplo `js/config/ar/precios.js`.
3. Transformaciones disponibles (`js/lib/transform.js`): `level`, `yoy`, `pct1`, `diff`, `diff3avg`, `k`, `sum12`, `sum12k`.

## Agregar una página nueva
1. Copiar `argentina.html` y cambiar título, texto y el `<script>` de la página.
2. Crear su script en `js/pages/`.
3. Sumarla a `NAV` en `js/ui/shell.js`.

## Cómo se actualizan los datos
- **Cuatro veces por día:** GitHub Actions corre `tools/fetch-data.ps1` y sube los JSON (historial) a las 8:30, 11:15, 13:00 y 16:30 de Argentina, elegidas para caer después de las publicaciones de EE.UU. (8:30 y 10:00 hora del Este) y del INDEC (16:00). También se puede correr a mano en la pestaña Actions. GitHub puede demorar unos minutos las corridas programadas.
- **Copia en el navegador:** las series de BLS que pide la página se guardan 6 horas, pero esa copia se descarta cuando `data/calendario.json` registra una publicación del BLS posterior a ella (con 10 minutos de margen). Por eso las fechas del BLS en el calendario también sirven para refrescar el dato el día de la publicación.
- **En vivo:** mientras la página está abierta, `js/data/live.js` pide los últimos datos a las fuentes y los combina con el historial: cada 5 minutos las series macro y cada 60 s las cotizaciones del dólar. Si algo falla, la página sigue con el historial. El catálogo de series en vivo está en `js/data/live-sources.js` y debe coincidir con `tools/fetch-data.ps1`.
- **Límite de BLS:** su API pública permite unas 25 consultas por día por IP, por eso esas series se guardan 6 horas en el navegador. Si el límite se agota, la página usa el historial; y si el descargador recibe series vacías, conserva las anteriores (`Restore-Empty`).
- **Qué es "tiempo real":** casi todos los indicadores se publican una vez al mes o al trimestre; en vivo cambian el dólar, las tasas y los datos nuevos apenas la fuente los publica.

## Probar en local
`powershell -File tools\serve.ps1` y abrir http://localhost:8765

## Noticias de alto impacto
`js/ui/news.js` es un solo componente con dos configuraciones: Argentina (arriba del Resumen, `data/noticias-ar.json`) y global (Inicio, `data/noticias-global.json`). Pestañas de categoría, Diario / Semanal / Mensual (hasta 3, 5 y 7 notas), indicador de importancia de tres niveles y fuente con enlace. `tools/fetch-noticias.ps1` lee RSS de medios y fuentes oficiales, deduplica los hechos que cubren varios medios, puntúa por impacto y nunca rellena; guarda 35 días de archivo para armar el semanal y el mensual. Los textos (título, resumen y "por qué importa") salen de `data/noticias-textos.json`; si existe el secreto `ANTHROPIC_API_KEY` en GitHub los redacta un modelo de IA, y si no, se usa un texto genérico por tema. El workflow `Actualizar noticias` corre cada 2 horas.

## Temporalidad propia de cada gráfico
Todos los gráficos de Argentina y de EE.UU. tienen sus propios selectores de frecuencia y de rango, independientes entre sí; ya no hay un selector de período general. La configuración vive en `js/config/timelines.js` (por id de panel; los del Resumen de Argentina la traen en `js/config/argentina.js`) y la interpreta `js/ui/panel.js`. Solo se agrega hacia frecuencias más bajas (las imposibles quedan en gris, nunca se desagrega ni se interpola). Reglas de `js/lib/aggregate.js`: flujos se suman, saldos toman el fin de período, precios y tasas el promedio, la inflación se compone, los índices de actividad y las tasas laborales se promedian; las variaciones se calculan después de agregar. Los acumulados de 12 meses pasan a ser acumulados de un año de períodos (4 trimestres, 2 semestres). Todas las series publicadas son mensuales, trimestrales o anuales: no hay frecuencia diaria. El PBI anual usa la serie oficial del Banco Mundial.

## Colores de las series
Con dos o más líneas, cada serie toma un color distinto por posición (`js/ui/chart.js`): acento, naranja (azul en EE.UU., cuyo acento es bronce), verde y violeta (`--series-2/3/4` en `css/tokens.css`); desde la tercera línea también cambia el trazo (punteado). Los gráficos de dólares conservan el color propio de cada cotización.
## Series adicionales de Argentina (`data/ar-extra.json`)
`tools/fetch-ar.py` (Python 3, sin dependencias; workflow *Actualizar series de Argentina*, una vez por día) baja series que no están en `fetch-data.ps1`. Una sección las usa si su config tiene `extraUrl: 'data/ar-extra.json'` (`js/data/loader.js` las suma sin pisar ids). Hoy: IPC empalmado desde 1943 (`ipc_long`: inflación mensual del BCRA; entre ene-2007 y abr-2016, IPC de San Luis por la intervención del INDEC; desde dic-2016, IPC nacional del INDEC), IPC estacionales y por división, IPIM interanual y expectativas del REM. Los gráficos de precios sombrean 2007-2015 (`bands` en el panel). Los mapas de calor de una sección son paneles con `type: 'heatmap'` (`js/ui/heattable.js`).

## Eventos en los gráficos (`data/eventos.json`)
Rombos violetas en los gráficos de las secciones de Argentina (`js/ui/events.js`). Cada evento indica en qué gráficos aparece y trae una explicación por gráfico, prioridad (1 histórico, 2 relevante) y fuente verificada. Con rango Máx o 10A se muestran solo los de prioridad 1; con 5A o menos, también los de prioridad 2; como máximo 6 a la vez.
