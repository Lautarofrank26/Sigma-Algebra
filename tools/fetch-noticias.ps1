# ---------------------------------------------------------------------------
# fetch-noticias.ps1
# Arma los modulos de noticias (Argentina en Resumen y global en Inicio):
#   data/noticias-ar.json  y  data/noticias-global.json
# Proceso:
#   1. Lee los RSS de medios y fuentes oficiales (solo titulares, fecha, enlace y un fragmento).
#   2. Descarta lo que no es noticia economica o politica de peso (opinion, deportes, color, etc.).
#   3. Puntua cada nota con reglas de palabras clave de alto impacto, fuente oficial y cantidad de medios que
#      cubren el mismo hecho (cobertura). Un hecho cubierto por varios medios es UNA sola noticia.
#   4. Asigna un nivel de importancia: 3 Critico, 2 Alto, 1 Relevante. Si no supera el umbral, no entra: nunca se rellena.
#   5. Guarda un archivo con 35 dias de notas elegidas y arma Diario / Semanal / Mensual con maximo 3 / 5 / 7 por categoria.
#   6. Titulo, resumen y "por que importa": se redactan en espaniol con palabras propias. Si hay clave ANTHROPIC_API_KEY
#      (secreto del workflow) las redacta un modelo de IA; si no, se usan los textos ya redactados en
#      data/noticias-textos.json y, en ultimo caso, un texto generico por tema (nunca se copia el texto del medio).
# NO inventa noticias: toda nota sale de un RSS real y lleva su enlace original.
# Uso:  powershell -File tools\fetch-noticias.ps1
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $root 'data'
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
$now = [DateTimeOffset]::UtcNow
$LIMITS = @{ daily = 3; weekly = 5; monthly = 7 }
$WINDOW = @{ daily = 1.5; weekly = 7; monthly = 31 }     # dias hacia atras
$KEEP_DAYS = 35

# ---------- fuentes ----------
$scopes = @{
  ar = @{
    cats = @('eco', 'pol')
    feeds = @(
      @{ n = 'Ámbito';        u = 'https://www.ambito.com/rss/pages/economia.xml' },
      @{ n = 'Ámbito';        u = 'https://www.ambito.com/rss/pages/home.xml' },
      @{ n = 'El Cronista';   u = 'https://www.cronista.com/files/rss/economia-politica.xml' },
      @{ n = 'Infobae';       u = 'https://www.infobae.com/arc/outboundfeeds/rss/category/economia/' },
      @{ n = 'Infobae';       u = 'https://www.infobae.com/arc/outboundfeeds/rss/category/politica/' },
      @{ n = 'La Nación';     u = 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/economia/?outputType=xml' },
      @{ n = 'La Nación';     u = 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/politica/?outputType=xml' },
      @{ n = 'Clarín';        u = 'https://www.clarin.com/rss/economia/' },
      @{ n = 'Clarín';        u = 'https://www.clarin.com/rss/politica/' },
      @{ n = 'iProfesional';  u = 'https://www.iprofesional.com/rss/economia' },
      @{ n = 'Google Noticias (medios de Argentina)'; u = 'https://news.google.com/rss/search?q=argentina+economia+OR+BCRA+OR+FMI+when:7d&hl=es-419&gl=AR&ceid=AR:es-419'; viaGoogle = $true }
    )
  }
  global = @{
    cats = @('eco', 'geo')
    feeds = @(
      @{ n = 'CNBC';           u = 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114' },
      @{ n = 'CNBC';           u = 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258' },
      @{ n = 'Financial Times'; u = 'https://www.ft.com/world?format=rss' },
      @{ n = 'Reserva Federal'; u = 'https://www.federalreserve.gov/feeds/press_all.xml'; official = $true },
      @{ n = 'BCE';            u = 'https://www.ecb.europa.eu/rss/press.html'; official = $true },
      @{ n = 'Google Noticias (Reuters, Bloomberg, WSJ y otros)'; u = 'https://news.google.com/rss/search?q=federal+reserve+OR+tariffs+OR+oil+OR+ECB+OR+inflation+when:7d&hl=en-US&gl=US&ceid=US:en'; viaGoogle = $true },
      @{ n = 'Google Noticias (Reuters, Bloomberg, WSJ y otros)'; u = 'https://news.google.com/rss/search?q=sanctions+OR+war+OR+OPEC+OR+election+OR+trade+deal+when:7d&hl=en-US&gl=US&ceid=US:en'; viaGoogle = $true }
    )
  }
}

# ---------- reglas: [patron sobre titulo+fragmento sin tildes, peso, categoria] ----------
# eco / pol (Argentina) y eco / geo (global). El peso mide cuanto mueve precios, expectativas o el escenario.
$rules = @{
  ar = @(
    @('inflacion|ipc\b|indice de precios', 4, 'eco'), @('bcra|banco central', 3, 'eco'), @('tasas? de interes|encajes|cepo|restriccion(es)? cambiari|regimen cambiario|bandas cambiarias|esquema cambiario|crawling', 4, 'eco'),
    @('fmi\b|fondo monetario', 4, 'eco'), @('desembolso|revision del programa|acuerdo con el fmi|staff report', 3, 'eco'),
    @('reservas (brutas|netas|del bcra)|compras de dolares', 3, 'eco'), @('riesgo pais', 4, 'eco'), @('bonos soberanos|globales|bonares|canje|reestructuracion|default', 3, 'eco'),
    @('licitacion|lecap|letras del tesoro|bonos del tesoro|vencimientos? de deuda|rollover', 3, 'eco'), @('deficit|superavit|resultado fiscal|recaudacion', 3, 'eco'),
    @('retenciones|impuesto|aranceles|reforma tributaria|baja de impuestos|blanqueo', 3, 'eco'), @('calificadora|moody|fitch|calificacion crediticia', 3, 'eco'),
    @('dolar (se )?(dispara|salta|record|se desploma|cae fuerte|sube fuerte)|corrida cambiaria|brecha cambiaria', 3, 'eco'), @('emae|pbi|actividad economica|desempleo|pobreza|salarios', 2, 'eco'),
    @('paro general|reforma laboral|reforma previsional|presupuesto', 3, 'pol'), @('veto|dnu\b|decreto de necesidad', 4, 'pol'),
    @('ley (bases|de presupuesto|ómnibus|omnibus)|aprobo la ley|rechazo la ley|media sancion|sancion definitiva', 4, 'pol'), @('senado|diputados|congreso', 2, 'pol'),
    @('elecciones|balotaje|paso\b|escrutinio|resultado electoral', 4, 'pol'), @('gabinete|renuncio|renuncia del|nuevo ministro|jefe de gabinete|ministro de economia|secretario de (hacienda|finanzas)', 4, 'pol'),
    @('gobernadores|coparticipacion|fondos provinciales', 3, 'pol'), @('corte suprema|fallo de la corte|cautelar|sentencia', 3, 'pol'), @('milei', 1, 'pol')
  )
  global = @(
    @('federal reserve|\bfed\b|fomc|powell|rate (cut|hike|decision)|interest rates? (cut|hike|decision)', 4, 'eco'), @('\becb\b|lagarde|bank of japan|\bboj\b|\bpboc\b|bank of england|\bboe\b|ueda|bailey', 4, 'eco'),
    @('\bcpi\b|consumer price|inflation (report|data|rate)|\bpce\b|nonfarm|payrolls|jobs report|unemployment rate|\bgdp\b|retail sales', 3, 'eco'),
    @('treasury yields?|bond (rout|selloff|sell-off|rally)|10-year yield|dollar index|dollar (surges|slumps|falls|jumps)|gold (hits|record|surges)|oil (prices )?(surge|plunge|jump|tumble|fall)|brent', 3, 'eco'),
    @('bank run|bank collapse|bankruptcy|bankrupt|default|credit crisis|financial crisis|contagion|bailout', 4, 'eco'),
    @('(apple|microsoft|nvidia|alphabet|google|amazon|meta|tesla)[^|]{0,40}(earnings|results|quarter)|(earnings|results)[^|]{0,40}(apple|microsoft|nvidia|alphabet|amazon|meta|tesla)', 3, 'eco'),
    @('china[^|]{0,30}(economy|exports|stimulus|data|property)|eurozone|euro zone', 2, 'eco'),
    @('war|invasion|missile|ceasefire|escalat|airstrike|military strike|nuclear', 4, 'geo'), @('sanctions?|embargo|export controls?|chip ban', 3, 'geo'), @('tariffs?|trade war|trade deal|trade talks', 4, 'geo'),
    @('opec|oil output|production cut|supply shock|shortage', 3, 'geo'), @('election|referendum|snap vote|coup', 3, 'geo'), @('summit|treaty|accord|agreement', 1, 'geo'),
    @('g7|g20|imf|world bank|wto', 2, 'geo')
  )
}
# Exclusiones: opinion, color, deportes, espectaculos, consejos
$exclude = 'horoscopo|futbol|messi|river|boca|mundial de|tenis|show|farandula|reality|receta|clima |pronostico del tiempo|como (ahorrar|invertir|saber)|trucos|\bopinion\b|/opinion/|editorial|columna|entrevista exclusiva|rumor|se filtro|polemica por|blog|quiz|podcast|opinion:|analysis:|op-ed|review:|best (stocks|etfs?) to|enforcement action|approval of application|termination of enforcement|consolidated banking|survey of professional forecasters|interview with|decisions taken by the governing council|bank holding|world in brief|instagram|commentary|colts|nfl\b|nba\b|mlb\b|nhl\b|touchdown|quarterback|playoff|super bowl|premier league|fifa|cricket|manta corta'
# Fuentes que no son medios (redes, agregadores de contenido de marca)
$excludeSource = 'instagram|facebook|tiktok|youtube|twitter|tradingview|authority|reddit|linkedin'
# Para el global: se excluye lo argentino (ya esta en Resumen)
$onlyGlobalExclude = 'argentin|milei|bcra\b|buenos aires|peso argentino'

# ---------- utilidades ----------
function Remove-Accents([string]$s) {
  $n = $s.Normalize([Text.NormalizationForm]::FormD)
  return (($n.ToCharArray() | Where-Object { [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne 'NonSpacingMark' }) -join '').ToLower()
}
function Clean-Text([string]$s) {
  if (-not $s) { return '' }
  $s = [regex]::Replace($s, '<!\[CDATA\[|\]\]>', '')
  $s = [regex]::Replace($s, '<[^>]+>', ' ')
  $s = [Net.WebUtility]::HtmlDecode($s)
  return ([regex]::Replace($s, '\s+', ' ')).Trim()
}
function Get-Tag([string]$block, [string[]]$tags) {
  foreach ($t in $tags) {
    $m = [regex]::Match($block, "<$t(?:\s[^>]*)?>([\s\S]*?)</$t>", 'IgnoreCase')
    if ($m.Success) { return $m.Groups[1].Value }
  }
  return $null
}
function Get-Items([string]$url, [string]$name, $feed) {
  $items = @()
  try {
    $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 40 -UserAgent $ua
    $s = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
  } catch { Write-Host "  sin respuesta: $name ($($_.Exception.Message.Split("`n")[0]))"; return $items }
  foreach ($m in [regex]::Matches($s, '<(item|entry)[ >][\s\S]*?</\1>')) {
    $b = $m.Value
    $title = Clean-Text (Get-Tag $b @('title'))
    $link = Clean-Text (Get-Tag $b @('link'))
    if (-not $link) { $lm = [regex]::Match($b, '<link[^>]*href="([^"]+)"'); if ($lm.Success) { $link = $lm.Groups[1].Value } }
    $desc = Clean-Text (Get-Tag $b @('description', 'summary', 'content'))
    $dateRaw = Clean-Text (Get-Tag $b @('pubDate', 'published', 'updated', 'dc:date'))
    $source = $name
    if ($feed.viaGoogle) {
      $src = Clean-Text (Get-Tag $b @('source'))
      if ($src) { $source = $src }
      $title = [regex]::Replace($title, '\s+-\s+[^-]+$', '')      # Google agrega " - Medio" al titulo
      $desc = ''
    }
    if (-not $title -or -not $link) { continue }
    $when = $null
    try { $when = [DateTimeOffset]::Parse($dateRaw, [Globalization.CultureInfo]::InvariantCulture) } catch { $when = $null }
    if (-not $when) { continue }
    if ($desc.Length -gt 320) { $desc = $desc.Substring(0, 320) }
    $items += [pscustomobject]@{ title = $title; link = $link; desc = $desc; source = $source; when = $when; official = [bool]$feed.official }
  }
  return $items
}
function Get-Tokens([string]$title) {
  $stop = 'para|como|este|esta|estos|sobre|entre|desde|hasta|tras|segun|contra|ante|cuando|donde|that|with|from|have|will|would|about|after|their|says|said|over|into|more|than'
  return @((Remove-Accents $title) -split '[^a-z0-9]+' | Where-Object { $_.Length -ge 4 -and $_ -notmatch "^($stop)$" } | Select-Object -Unique)
}
function Get-Jaccard($a, $b) {
  if (-not $a.Count -or -not $b.Count) { return 0 }
  $inter = @($a | Where-Object { $b -contains $_ }).Count
  return $inter / ($a.Count + $b.Count - $inter)
}
function New-Id([string]$s) {
  $h = [Security.Cryptography.SHA1]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($s))
  return ([BitConverter]::ToString($h).Replace('-', '').Substring(0, 12)).ToLower()
}

# ---------- textos de respaldo por tema (en palabras propias, sin copiar al medio) ----------
$topics = @{
  ar = @(
    @('inflacion|ipc\b|indice de precios', 'Inflación', 'Hay novedades sobre la inflación y los precios.', 'Marca el rumbo de la tasa de interés, del dólar y de las expectativas de precios.'),
    @('bcra|banco central|tasas? de interes|encajes|cepo|restriccion|regimen cambiario|bandas', 'BCRA y régimen cambiario', 'El Banco Central tomó o anticipó una decisión sobre tasas o reglas cambiarias.', 'Puede mover el dólar, las tasas en pesos y la demanda de moneda.'),
    @('fmi\b|fondo monetario|desembolso', 'FMI', 'Hay novedades en la relación con el Fondo Monetario.', 'Condiciona el acceso a divisas y la credibilidad del programa económico.'),
    @('riesgo pais|bonos|globales|bonares|default|reestructuracion|canje', 'Bonos y riesgo país', 'Se movió el mercado de deuda soberana.', 'Define el costo de financiarse y el acceso al crédito externo.'),
    @('licitacion|lecap|letras|tesoro|vencimientos|rollover', 'Licitación del Tesoro', 'El Tesoro informó una licitación o un vencimiento de deuda en pesos.', 'Mide la confianza en el peso y el perfil de vencimientos.'),
    @('reservas', 'Reservas del BCRA', 'Hubo cambios en las reservas del Banco Central.', 'Afecta la capacidad de sostener el esquema cambiario.'),
    @('deficit|superavit|resultado fiscal|recaudacion|retenciones|impuesto|aranceles|presupuesto', 'Política fiscal', 'Se conocieron medidas o datos fiscales.', 'Cambia el ingreso del Estado, el financiamiento y las reglas para empresas.'),
    @('calificadora|moody|fitch|calificacion', 'Calificación de riesgo', 'Una calificadora se pronunció sobre la deuda argentina.', 'Influye en el acceso a los mercados internacionales.'),
    @('dnu\b|veto|ley|senado|diputados|congreso|media sancion', 'Congreso y decretos', 'Hubo novedades legislativas o un decreto relevante.', 'Cambia las reglas de juego y la gobernabilidad del programa económico.'),
    @('elecciones|balotaje|paso\b|escrutinio', 'Elecciones', 'Se conocieron novedades electorales.', 'Redefine el escenario político y las expectativas del mercado.'),
    @('gabinete|renuncio|ministro|jefe de gabinete|secretario', 'Cambios en el Gabinete', 'Hubo un cambio en áreas clave del Gobierno.', 'Puede alterar la conducción de la política económica.'),
    @('gobernadores|coparticipacion|fondos provinciales', 'Gobernadores', 'Hay novedades en la relación con las provincias.', 'Afecta el equilibrio fiscal y la gobernabilidad.'),
    @('corte suprema|fallo|cautelar|sentencia', 'Justicia', 'Hubo un fallo judicial con efectos económicos.', 'Puede cambiar reglas, costos o riesgos para el sector privado y el Estado.'),
    @('emae|pbi|actividad|desempleo|pobreza|salarios', 'Actividad y empleo', 'Se publicó un dato de actividad, empleo o ingresos.', 'Muestra el ritmo de la economía real y la demanda interna.')
  )
  global = @(
    @('federal reserve|\bfed\b|fomc|powell|rate', 'Reserva Federal', 'La Fed comunicó una decisión o señal sobre tasas.', 'Mueve los bonos, el dólar y las condiciones financieras del mundo.'),
    @('\becb\b|lagarde|bank of japan|\bboj\b|\bpboc\b|bank of england|\bboe\b', 'Bancos centrales', 'Un banco central importante comunicó una decisión o señal.', 'Influye en monedas, tasas y flujos de capital globales.'),
    @('\bcpi\b|inflation|\bpce\b|nonfarm|payrolls|jobs|unemployment|\bgdp\b|retail sales', 'Datos económicos', 'Se publicó un dato clave de actividad, empleo o precios.', 'Reordena las expectativas de tasas y el apetito por riesgo.'),
    @('treasury|bond|yield|dollar|gold|oil|brent', 'Mercados', 'Hubo un movimiento fuerte en bonos, dólar o materias primas.', 'Cambia el costo del dinero y los precios de los activos globales.'),
    @('bank|bankrupt|default|crisis|contagion|bailout', 'Riesgo financiero', 'Apareció una señal de tensión en el sistema financiero.', 'Puede contagiar a otros mercados y endurecer el crédito.'),
    @('apple|microsoft|nvidia|alphabet|google|amazon|meta|tesla|earnings|results', 'Resultados empresariales', 'Una gran empresa presentó resultados.', 'Mueve los índices bursátiles que ponderan a las grandes compañías.'),
    @('war|invasion|missile|ceasefire|escalat|strike|nuclear', 'Conflicto armado', 'Hubo una escalada o un avance en un conflicto.', 'Afecta la energía, la aversión al riesgo y las rutas comerciales.'),
    @('sanction|embargo|export control|chip', 'Sanciones y restricciones', 'Se anunciaron sanciones o restricciones comerciales.', 'Altera cadenas de suministro y precios de insumos clave.'),
    @('tariff|trade war|trade deal|trade talks', 'Comercio y aranceles', 'Hubo novedades sobre aranceles o negociaciones comerciales.', 'Cambia costos, flujos de comercio y expectativas de crecimiento.'),
    @('opec|oil output|production cut|supply', 'Energía y materias primas', 'Se anunciaron cambios de oferta de energía o materias primas.', 'Mueve el precio del petróleo y la inflación global.'),
    @('election|referendum|vote|coup', 'Elecciones', 'Se conocieron novedades electorales en una economía relevante.', 'Puede cambiar la política económica y comercial.'),
    @('g7|g20|imf|world bank|wto|summit|treaty|agreement|accord', 'Acuerdos internacionales', 'Hubo un acuerdo o una cumbre internacional.', 'Puede redefinir reglas de comercio, financiamiento o cooperación.')
  )
}

# ---------- archivo previo y textos ya redactados ----------
$textFile = Join-Path $dataDir 'noticias-textos.json'
$texts = @{}
if (Test-Path $textFile) {
  try { $tj = Get-Content $textFile -Raw -Encoding UTF8 | ConvertFrom-Json; foreach ($p in $tj.PSObject.Properties) { $texts[$p.Name] = $p.Value } } catch { }
}
$apiKey = $env:ANTHROPIC_API_KEY

function Get-AiText($it, $scope) {
  # Redaccion con IA (opcional): resumen propio en espaniol a partir del titular y el fragmento del RSS
  if (-not $apiKey) { return $null }
  try {
    $alcance = if ($scope -eq 'ar') { 'noticias de Argentina' } else { 'noticias globales' }
    $prompt = "Sos editor de un sitio de macroeconomia para economistas. A partir del titular y el fragmento (de $alcance) redacta en espanol rioplatense, con palabras propias (no copies frases del original): un titulo corto (maximo 90 caracteres), un resumen de 1 o 2 lineas (maximo 220 caracteres) y 'por que importa' en 1 linea con el impacto concreto (maximo 130 caracteres). No agregues datos que no esten en el titular o el fragmento. Responde SOLO un JSON: {`"title`":`"`",`"summary`":`"`",`"why`":`"`"}.`nFuente: $($it.source)`nTitular: $($it.title)`nFragmento: $($it.desc)"
    $body = @{ model = 'claude-haiku-5-5'; max_tokens = 400; messages = @(@{ role = 'user'; content = $prompt }) } | ConvertTo-Json -Depth 5
    $r = Invoke-RestMethod 'https://api.anthropic.com/v1/messages' -Method Post -TimeoutSec 60 -Headers @{ 'x-api-key' = $apiKey; 'anthropic-version' = '2023-06-01' } -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))
    $txt = $r.content[0].text
    $j = [regex]::Match($txt, '\{[\s\S]*\}').Value | ConvertFrom-Json
    if ($j.title -and $j.summary -and $j.why) { return @{ title = [string]$j.title; summary = [string]$j.summary; why = [string]$j.why } }
  } catch { Write-Host "  IA no disponible: $($_.Exception.Message.Split("`n")[0])" }
  return $null
}

$newTexts = 0
foreach ($scope in 'ar', 'global') {
  $cfg = $scopes[$scope]
  Write-Host "== $scope"
  # 1. leer feeds
  $all = New-Object System.Collections.ArrayList
  foreach ($f in $cfg.feeds) {
    $its = Get-Items $f.u $f.n $f
    Write-Host ("  {0}: {1}" -f $f.n, $its.Count)
    foreach ($i in $its) { [void]$all.Add($i) }
  }
  # 2-3. filtrar y puntuar
  $cands = New-Object System.Collections.ArrayList
  foreach ($it in $all) {
    if (($now - $it.when).TotalDays -gt $KEEP_DAYS) { continue }
    $hay = Remove-Accents ("$($it.title) $($it.desc) $($it.link)")
    if ($hay -match $exclude -or (Remove-Accents $it.source) -match $excludeSource) { continue }
    if ($scope -eq 'global' -and $hay -match $onlyGlobalExclude) { continue }
    $titleN = Remove-Accents $it.title
    $score = @{}; foreach ($c in $cfg.cats) { $score[$c] = 0.0 }
    foreach ($r in $rules[$scope]) {
      $inTitle = $titleN -match $r[0]
      $inDesc = (-not $inTitle) -and ($hay -match $r[0])
      if ($inTitle) { $score[$r[2]] += $r[1] } elseif ($inDesc) { $score[$r[2]] += $r[1] * 0.4 }
    }
    $cat = ($cfg.cats | Sort-Object { -$score[$_] } | Select-Object -First 1)
    $total = $score[$cat]
    if ($it.official) { $total += 2 }
    if ($total -lt 3) { continue }
    [void]$cands.Add([pscustomobject]@{ item = $it; cat = $cat; score = $total; tokens = (Get-Tokens $it.title) })
  }
  # deduplicar: un hecho cubierto por varios medios = una sola noticia
  $clusters = New-Object System.Collections.ArrayList
  foreach ($c in ($cands | Sort-Object { -$_.score }, { $_.item.when })) {
    $placed = $false
    foreach ($cl in $clusters) {
      if ($cl.cat -ne $c.cat) { continue }
      if ([math]::Abs(($cl.rep.item.when - $c.item.when).TotalHours) -gt 72) { continue }
      if ((Get-Jaccard $cl.rep.tokens $c.tokens) -ge 0.25 -and @($cl.rep.tokens | Where-Object { $c.tokens -contains $_ }).Count -ge 2) { [void]$cl.members.Add($c); $placed = $true; break }
    }
    if (-not $placed) { $mem = New-Object System.Collections.ArrayList; [void]$mem.Add($c); [void]$clusters.Add([pscustomobject]@{ cat = $c.cat; rep = $c; members = $mem }) }
  }
  Write-Host ("  candidatas: {0}, hechos distintos: {1}" -f $cands.Count, $clusters.Count)

  # nivel de importancia: reglas + cobertura (medios distintos) + fuente oficial
  $picked = New-Object System.Collections.ArrayList
  foreach ($cl in $clusters) {
    $outlets = @($cl.members | ForEach-Object { $_.item.source } | Select-Object -Unique).Count
    $top = $cl.members | Sort-Object { -$_.score } | Select-Object -First 1
    $best = $cl.members | Sort-Object { -[int]$_.item.official }, { -$_.score }, { $_.item.when } | Select-Object -First 1
    $total = $top.score + $(if ($outlets -ge 4) { 4 } elseif ($outlets -eq 3) { 3 } elseif ($outlets -eq 2) { 1.5 } else { 0 })
    $level = if ($total -ge 11) { 3 } elseif ($total -ge 8) { 2 } elseif ($total -ge 6) { 1 } else { 0 }
    # Critico solo si lo cubren al menos tres medios o es una fuente oficial: una sola nota no alcanza
    if ($level -eq 3 -and $outlets -lt 3 -and -not $best.item.official) { $level = 2 }
    if ($level -eq 0) { continue }
    $latest = ($cl.members | ForEach-Object { $_.item.when } | Sort-Object -Descending | Select-Object -First 1)
    [void]$picked.Add([pscustomobject]@{ id = (New-Id $best.item.link); level = $level; cat = $cl.cat; score = [math]::Round($total, 1); outlets = $outlets; source = $best.item.source; url = $best.item.link; time = $best.item.when.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'); head = $best.item.title; desc = $best.item.desc })
  }

  # 4. archivo de 35 dias (para semanal y mensual): se une lo anterior con lo nuevo
  $archFile = Join-Path $dataDir "noticias-$scope-archivo.json"
  $arch = @{}
  if (Test-Path $archFile) {
    try { foreach ($a in @((Get-Content $archFile -Raw -Encoding UTF8 | ConvertFrom-Json).items)) { $arch[$a.id] = $a } } catch { }
  }
  foreach ($p in $picked) {
    $prev = $arch[$p.id]
    if ($prev -and $prev.level -gt $p.level) { $p.level = $prev.level }   # una nota no pierde importancia por salir del RSS
    $arch[$p.id] = $p
  }
  $cut = $now.AddDays(-$KEEP_DAYS)
  $keep = @($arch.Values | Where-Object { [DateTimeOffset]::Parse($_.time) -ge $cut })

  # 5. textos propios: cache -> IA -> respaldo por tema
  $aiCalls = 0
  foreach ($a in $keep) {
    $t = $texts[$a.url]
    $mode = 'cache'
    if (-not $t) {
      if ($aiCalls -lt 20) { $t = Get-AiText $a $scope; if ($t) { $aiCalls++; $mode = 'ia'; $texts[$a.url] = $t; $newTexts++ } }
    }
    if (-not $t) {
      $hay = Remove-Accents "$($a.head) $($a.desc)"
      $tp = $topics[$scope] | Where-Object { $hay -match $_[0] } | Select-Object -First 1
      if (-not $tp) { $tp = $topics[$scope][0] }
      $n = [int]$a.outlets
      $cob = if ($n -ge 2) { " Lo cubren $n medios." } else { '' }
      $t = @{ title = $tp[1]; summary = ($tp[2] + $cob); why = $tp[3] }
      $mode = 'generico'
    }
    $a | Add-Member -NotePropertyName title -NotePropertyValue $t.title -Force
    $a | Add-Member -NotePropertyName summary -NotePropertyValue $t.summary -Force
    $a | Add-Member -NotePropertyName why -NotePropertyValue $t.why -Force
    $a | Add-Member -NotePropertyName texto -NotePropertyValue $mode -Force
  }

  # Diario / Semanal / Mensual por categoria: lo MAS importante del periodo (nivel, cobertura y luego fecha), nunca relleno
  $periods = [ordered]@{}
  foreach ($cat in $cfg.cats) {
    $byPeriod = [ordered]@{}
    foreach ($per in 'daily', 'weekly', 'monthly') {
      $since = $now.AddDays(-$WINDOW[$per])
      $sel = @($keep | Where-Object { $_.cat -eq $cat -and [DateTimeOffset]::Parse($_.time) -ge $since } |
        Sort-Object { -$_.level }, { -$_.score }, { -([DateTimeOffset]::Parse($_.time)).UtcTicks } |
        Select-Object -First $LIMITS[$per])
      $byPeriod[$per] = @($sel | ForEach-Object { [ordered]@{ id = $_.id; level = $_.level; title = $_.title; summary = $_.summary; why = $_.why; source = $_.source; url = $_.url; time = $_.time; texto = $_.texto } })
    }
    $periods[$cat] = $byPeriod
  }

  # archivo y salida
  $archJson = [ordered]@{ updated = $now.ToString('yyyy-MM-ddTHH:mm:ssZ'); items = @($keep | ForEach-Object { [ordered]@{ id = $_.id; level = $_.level; cat = $_.cat; score = $_.score; outlets = $_.outlets; source = $_.source; url = $_.url; time = $_.time; head = $_.head; desc = $_.desc } }) } | ConvertTo-Json -Depth 6 -Compress
  [IO.File]::WriteAllText($archFile, $archJson, (New-Object Text.UTF8Encoding($false)))
  $out = [ordered]@{ updated = $now.ToString('yyyy-MM-ddTHH:mm:ssZ'); scope = $scope; limits = $LIMITS; categories = $periods } | ConvertTo-Json -Depth 8 -Compress
  [IO.File]::WriteAllText((Join-Path $dataDir "noticias-$scope.json"), $out, (New-Object Text.UTF8Encoding($false)))
  $counts = ($cfg.cats | ForEach-Object { $c = $_; "$c d=$(@($periods[$c].daily).Count) s=$(@($periods[$c].weekly).Count) m=$(@($periods[$c].monthly).Count)" }) -join ' | '
  Write-Host "  salida: $counts (textos IA nuevos: $aiCalls)"
}

# guardar textos redactados (solo los de notas vigentes)
$validUrls = @{}
foreach ($scope in 'ar', 'global') {
  try { foreach ($a in @((Get-Content (Join-Path $dataDir "noticias-$scope-archivo.json") -Raw -Encoding UTF8 | ConvertFrom-Json).items)) { $validUrls[$a.url] = $true } } catch { }
}
$tout = [ordered]@{}
foreach ($k in ($texts.Keys | Sort-Object)) { if ($validUrls.ContainsKey($k)) { $tout[$k] = $texts[$k] } }
[IO.File]::WriteAllText($textFile, ($tout | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding($false)))
Write-Host "Listo."
