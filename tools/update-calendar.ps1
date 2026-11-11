# ---------------------------------------------------------------------------
# update-calendar.ps1
# Arma data/calendario.json a partir de:
#   - el calendario de difusion del INDEC (PDF semestral oficial)
#   - el calendario de reuniones de la Reserva Federal (FOMC)
#   - data/calendario-manual.json (eventos que se cargan a mano, p. ej. los del BLS)
# Si el INDEC o la Fed no responden, se conserva el calendario anterior.
# Uso:  powershell -File tools\update-calendar.ps1
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root   = Split-Path $PSScriptRoot -Parent
$dataDir = Join-Path $root 'data'
$outFile = Join-Path $dataDir 'calendario.json'
$manualFile = Join-Path $dataDir 'calendario-manual.json'
$latin1 = [Text.Encoding]::GetEncoding('latin1')
$today = (Get-Date).Date

$mesesIndec = @{ Enero=1; Febrero=2; Marzo=3; Abril=4; Mayo=5; Junio=6; Julio=7; Agosto=8; Septiembre=9; Octubre=10; Noviembre=11; Diciembre=12 }
$mesesEn    = @{ January=1; February=2; March=3; April=4; May=5; June=6; July=7; August=8; September=9; October=10; November=11; December=12 }
$mesesEs    = @('enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre')

# Publicaciones del INDEC que se muestran (el resto del calendario se ignora)
# Patron sobre el texto del PDF (la I con tilde se reemplaza por "." para no depender de la codificacion)
$indecMap = @(
  @{ p = '^.ndice de precios al consumidor';                     title = 'Inflación (IPC)';               href = 'precios.html'; previo = @{ file='ar'; id='ipc'; t='pct1'; decimals=1; suffix='%'; label='Anterior (m/m)' } },
  @{ p = '^.ndice de salarios';                                  title = 'Índice de salarios';            impact = 'medio'; href = 'empleo.html'; previo = @{ file='ar'; id='wages'; t='pct1'; decimals=1; suffix='%'; label='Anterior (m/m)' } },
  @{ p = '^Mercado de trabajo';                                  title = 'Mercado de trabajo';            href = 'empleo.html'; detailPrefix = 'Desempleo del '; previo = @{ file='ar'; id='unemp'; t='level'; decimals=1; suffix='%'; label='Anterior' } },
  @{ p = '^Intercambio comercial argentino';                     title = 'Comercio exterior (ICA)';       href = 'externo.html'; previo = @{ file='ar'; id='trade_balance'; t='level'; decimals=0; prefix='USD '; suffix=' M'; label='Saldo anterior' } },
  @{ p = '^Balanza de pagos';                                    title = 'Balanza de pagos';              href = 'externo.html' },
  @{ p = '^Estimador mensual de actividad econ.mica';            title = 'Actividad económica (EMAE)';    href = 'actividad.html'; previo = @{ file='ar'; id='emae'; t='pct1'; decimals=1; suffix='%'; signed=$true; label='Anterior (m/m)' } },
  @{ p = '^Informe de avance del nivel de actividad';            title = 'Nivel de actividad (PBI)';      href = 'actividad.html'; detailPrefix = 'Informe de avance del '; previo = @{ file='ar'; id='gdp_level'; t='yoy'; decimals=1; suffix='%'; signed=$true; label='Anterior (i.a.)' } },
  @{ p = '^.ndice de producci.n industrial manufacturero';       title = 'Industria (IPI manufacturero)'; href = 'actividad.html'; previo = @{ file='ar'; id='ipi'; t='pct1'; decimals=1; suffix='%'; signed=$true; label='Anterior (m/m)' } },
  # Solo lo que mueve al mercado (ver docs en el README): se dejaron afuera precios mayoristas, servicios publicos y las encuestas menores
  @{ p = '^Indicadores de coyuntura de la actividad de la construcci.n'; title = 'Construcción (ISAC)';   impact = 'medio'; href = 'actividad.html' },
  @{ p = '^Utilizaci.n de la capacidad instalada en la industria';       title = 'Capacidad instalada (UCII)'; impact = 'medio'; href = 'actividad.html' },
  @{ p = '^Indicadores de condiciones de vida de los hogares';           title = 'Pobreza e indigencia (EPH)'; impact = 'alto'; href = 'empleo.html' }
)

# ---------- utilidades de lectura de PDF ----------
function ConvertFrom-PdfEscapes($x) {
  $x = [regex]::Replace($x, '\\([0-7]{3})', { param($m) [string][char][Convert]::ToInt32($m.Groups[1].Value, 8) })
  return $x.Replace('\(', '(').Replace('\)', ')').Replace('\\', '\')
}

# Devuelve los textos del PDF en orden, como objetos { tipo = 'TJ'|'Tj'; texto }
function Get-PdfTokens([byte[]]$bytes) {
  $s = $latin1.GetString($bytes)
  $content = New-Object Text.StringBuilder
  foreach ($m in [regex]::Matches($s, 'stream\r?\n')) {
    $st = $m.Index + $m.Length
    $en = $s.IndexOf('endstream', $st)
    if ($en -lt 0) { continue }
    try {
      $ms = New-Object IO.MemoryStream (, $bytes[($st + 2)..($en - 1)])      # se omite el encabezado zlib
      $ds = New-Object IO.Compression.DeflateStream ($ms, [IO.Compression.CompressionMode]::Decompress)
      $t = (New-Object IO.StreamReader ($ds, $latin1)).ReadToEnd()
      if ($t -match 'BT') { [void]$content.AppendLine($t) }
    } catch { }
  }
  $tokens = New-Object System.Collections.ArrayList
  $re = '\[((?:[^\]\\]|\\.)*)\]\s*TJ|\(((?:[^)\\]|\\.)*)\)\s*Tj'
  foreach ($m in [regex]::Matches($content.ToString(), $re)) {
    if ($m.Groups[1].Success) {
      $parts = [regex]::Matches($m.Groups[1].Value, '\(((?:[^)\\]|\\.)*)\)') | ForEach-Object { ConvertFrom-PdfEscapes $_.Groups[1].Value }
      [void]$tokens.Add([pscustomobject]@{ tipo = 'TJ'; texto = ($parts -join '') })
    } else {
      [void]$tokens.Add([pscustomobject]@{ tipo = 'Tj'; texto = (ConvertFrom-PdfEscapes $m.Groups[2].Value) })
    }
  }
  return $tokens
}

# Lee el PDF del INDEC y devuelve filas { fecha; texto }
function Get-IndecRows($bytes, [int]$year) {
  $tokens = Get-PdfTokens $bytes
  $rows = @(); $mes = 0; $dia = 0
  for ($i = 0; $i -lt $tokens.Count; $i++) {
    $v = $tokens[$i].texto.Trim()
    if ($tokens[$i].tipo -eq 'Tj' -and $mesesIndec.ContainsKey($v)) { $mes = $mesesIndec[$v]; continue }
    if ($tokens[$i].tipo -eq 'Tj' -and $v -match '^\d{1,2}$' -and ($i + 1) -lt $tokens.Count -and $tokens[$i + 1].texto.Trim() -match '^(LU|MA|MI|JU|VI)$') {
      $dia = [int]$v; $i++; continue
    }
    if ($mes -gt 0 -and $dia -gt 0 -and ($tokens[$i].tipo -eq 'TJ' -or $v.Length -gt 6)) {
      $rows += [pscustomobject]@{ fecha = ('{0:0000}-{1:00}-{2:00}' -f $year, $mes, $dia); texto = $v }
    }
  }
  return $rows
}

# ---------- INDEC ----------
$events = New-Object System.Collections.ArrayList
$indecOk = $false
$years = @($today.Year, ($today.Year + 1))
foreach ($y in $years) {
  foreach ($sem in 1, 2) {
    $url = "https://www.indec.gob.ar/ftp/cuadros/publicaciones/calendario_${sem}sem${y}.pdf"
    try {
      $tmp = Join-Path ([IO.Path]::GetTempPath()) "indec_$sem$y.pdf"
      Invoke-WebRequest $url -OutFile $tmp -UseBasicParsing -TimeoutSec 90
      $bytes = [IO.File]::ReadAllBytes($tmp)
      Remove-Item $tmp -ErrorAction SilentlyContinue
      $rows = Get-IndecRows $bytes $y
      $found = 0
      foreach ($r in $rows) {
        foreach ($map in $indecMap) {
          if ($r.texto -notmatch $map.p) { continue }
          # El detalle es la ultima oracion del texto ("Octubre de 2026", "Tercer trimestre de 2026")
          $detail = ($r.texto -split '\.\s+' | Where-Object { $_.Trim() } | Select-Object -Last 1).Trim().TrimEnd('.')
          if ($map.detailPrefix) { $detail = $map.detailPrefix + $detail.Substring(0, 1).ToLower() + $detail.Substring(1) }
          if ($map.title -eq 'Inflación (IPC)' -and ($rows | Where-Object { $_.fecha -eq $r.fecha -and $_.texto -match 'canasta b.sica alimentaria' })) { $detail += ' · también canastas básicas' }
          [void]$events.Add([ordered]@{ date = $r.fecha; time = '16:00'; tz = '-03:00'; country = 'ar'; source = 'INDEC'; title = $map.title; detail = $detail; href = $map.href; previo = $map.previo })
          $found++
          break
        }
      }
      Write-Host "INDEC ${sem}.o semestre ${y}: $found eventos"
      if ($found -gt 0) { $indecOk = $true }
    } catch { Write-Host "INDEC ${sem}.o semestre ${y}: no disponible ($($_.Exception.Message))" }
  }
}

# ---------- Reserva Federal (FOMC) ----------
function Test-UsDst([datetime]$d) {
  # horario de verano de EE.UU.: del 2.o domingo de marzo al 1.er domingo de noviembre
  $mar = Get-Date -Year $d.Year -Month 3 -Day 1; while ($mar.DayOfWeek -ne 'Sunday') { $mar = $mar.AddDays(1) }; $mar = $mar.AddDays(7)
  $nov = Get-Date -Year $d.Year -Month 11 -Day 1; while ($nov.DayOfWeek -ne 'Sunday') { $nov = $nov.AddDays(1) }
  return ($d.Date -ge $mar.Date -and $d.Date -lt $nov.Date)
}
$fedOk = $false
try {
  $page = Invoke-WebRequest 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm' -UseBasicParsing -TimeoutSec 60 -UserAgent 'Mozilla/5.0'
  $txt = ($page.Content -replace '<[^>]+>', '|' -replace '\s+', ' ' -replace '(\|\s*)+', '|')
  foreach ($y in $years) {
    $i = $txt.IndexOf("$y FOMC Meetings")
    if ($i -lt 0) { continue }
    $j = $txt.IndexOf(' FOMC Meetings', $i + 20); if ($j -lt 0) { $j = $txt.Length }
    $seg = $txt.Substring($i, $j - $i)
    foreach ($m in [regex]::Matches($seg, '(January|February|March|April|May|June|July|August|September|October|November|December)\|(\d{1,2})(?:-(\d{1,2}))?\*?\|')) {
      $mes = $mesesEn[$m.Groups[1].Value]
      $d1 = [int]$m.Groups[2].Value
      $d2 = if ($m.Groups[3].Success) { [int]$m.Groups[3].Value } else { $d1 }
      $date = Get-Date -Year $y -Month $mes -Day $d2
      $tz = if (Test-UsDst $date) { '-04:00' } else { '-05:00' }
      $detail = if ($d1 -ne $d2) { "Reunión del FOMC del $d1 y $d2 de $($mesesEs[$mes - 1])" } else { "Reunión del FOMC del $d1 de $($mesesEs[$mes - 1])" }
      [void]$events.Add([ordered]@{ date = ('{0:0000}-{1:00}-{2:00}' -f $y, $mes, $d2); time = '14:00'; tz = $tz; country = 'us'; source = 'Reserva Federal'; title = 'Decisión de tasas de la Fed'; detail = $detail; href = 'eeuu-tasas.html'; previo = @{ file='us'; id='fedfunds'; t='level'; decimals=2; suffix='%'; label='Tasa actual' } })
      $fedOk = $true
    }
  }
  Write-Host "Fed: $(($events | Where-Object { $_.country -eq 'us' }).Count) reuniones"
} catch { Write-Host "Fed: no disponible ($($_.Exception.Message))" }

# ---------- BEA (PBI y PCE de EE.UU.): cronograma oficial de publicaciones ----------
function Test-EuDst([datetime]$d) {
  # horario de verano europeo: del ultimo domingo de marzo al ultimo domingo de octubre
  $mar = Get-Date -Year $d.Year -Month 3 -Day 31; while ($mar.DayOfWeek -ne 'Sunday') { $mar = $mar.AddDays(-1) }
  $oct = Get-Date -Year $d.Year -Month 10 -Day 31; while ($oct.DayOfWeek -ne 'Sunday') { $oct = $oct.AddDays(-1) }
  return ($d.Date -ge $mar.Date -and $d.Date -lt $oct.Date)
}
try {
  $bea = Invoke-WebRequest 'https://www.bea.gov/news/schedule' -UseBasicParsing -TimeoutSec 60 -UserAgent 'Mozilla/5.0'
  $bt = ($bea.Content -replace '<script[\s\S]*?</script>', '' -replace '<[^>]+>', '|' -replace '&amp;', '&' -replace '&#039;', "'" -replace '\s+', ' ' -replace '(\|\s*)+', '|')
  $by = if ($bt -match 'Year (\d{4})') { [int]$Matches[1] } else { $today.Year }
  $nBea = 0
  foreach ($m in [regex]::Matches($bt, '\|(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2})\|(\d{1,2}):(\d{2}) (AM|PM)\|[^|]*\|[^|]*\|([^|]+)\|')) {
    $mes = $mesesEn[$m.Groups[1].Value]; $dia = [int]$m.Groups[2].Value
    $hh = [int]$m.Groups[3].Value % 12; if ($m.Groups[5].Value -eq 'PM') { $hh += 12 }
    $txt = $m.Groups[6].Value.Trim()
    $date = Get-Date -Year $by -Month $mes -Day $dia
    $tz = if (Test-UsDst $date) { '-04:00' } else { '-05:00' }
    $title = $null; $detail = $null
    if ($txt -match '^GDP \((Advance|Second|Third) Estimate\)[^,]*, (\d)(?:st|nd|rd|th) Quarter (\d{4})') {
      $est = @{ Advance = 'primera'; Second = 'segunda'; Third = 'tercera' }[$Matches[1]]
      $title = 'PBI de EE.UU.'; $detail = "Trimestre $($Matches[2]) de $($Matches[3]), $est estimación"
    } elseif ($txt -match '^Personal Income and Outlays, (\w+) (\d{4})') {
      $title = 'Consumo personal (PCE)'; $detail = "$($mesesEs[$mesesEn[$Matches[1]] - 1].Substring(0,1).ToUpper() + $mesesEs[$mesesEn[$Matches[1]] - 1].Substring(1)) de $($Matches[2])"
    }
    if (-not $title) { continue }
    [void]$events.Add([ordered]@{ date = ('{0:0000}-{1:00}-{2:00}' -f $by, $mes, $dia); time = ('{0:00}:{1}' -f $hh, $m.Groups[4].Value); tz = $tz; country = 'us'; source = 'BEA'; title = $title; detail = $detail; href = 'eeuu.html' })
    $nBea++
  }
  Write-Host "BEA: $nBea eventos"
} catch { Write-Host "BEA: no disponible ($($_.Exception.Message))" }

# ---------- BCE (decision de tasas): calendario oficial de reuniones de politica monetaria ----------
try {
  $ecb = Invoke-WebRequest 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html' -UseBasicParsing -TimeoutSec 60 -UserAgent 'Mozilla/5.0'
  $et = ($ecb.Content -replace '<script[\s\S]*?</script>', '' -replace '<[^>]+>', '|' -replace '&amp;', '&' -replace '&nbsp;', ' ' -replace '\s+', ' ' -replace '(\|\s*)+', '|')
  $nEcb = 0
  foreach ($m in [regex]::Matches($et, '(\d{2})/(\d{2})/(\d{4}) \|Governing Council of the ECB: monetary policy meeting[^|]*\(Day 2\)')) {
    $date = Get-Date -Year ([int]$m.Groups[3].Value) -Month ([int]$m.Groups[2].Value) -Day ([int]$m.Groups[1].Value)
    $tz = if (Test-EuDst $date) { '+02:00' } else { '+01:00' }
    [void]$events.Add([ordered]@{ date = $date.ToString('yyyy-MM-dd'); time = '14:15'; tz = $tz; country = 'eu'; source = 'BCE'; title = 'Decisión de tasas del BCE'; detail = "Reunión de política monetaria del $($date.Day) de $($mesesEs[$date.Month - 1])"; href = 'index.html' })
    $nEcb++
  }
  Write-Host "BCE: $nEcb reuniones"
} catch { Write-Host "BCE: no disponible ($($_.Exception.Message))" }

# ---------- eventos manuales ----------
if (Test-Path $manualFile) {
  try {
    $manual = Get-Content $manualFile -Raw -Encoding utf8 | ConvertFrom-Json
    foreach ($e in @($manual.eventos)) {
      [void]$events.Add([ordered]@{ date = $e.date; time = $e.time; tz = $e.tz; country = $e.country; source = $e.source; title = $e.title; detail = $e.detail; href = $e.href; previo = $e.previo; consenso = $e.consenso; impact = $e.impact })
    }
    Write-Host "Manuales: $(@($manual.eventos).Count) eventos"
  } catch { Write-Host "Manuales: archivo invalido ($($_.Exception.Message))" }
}

# ---------- salida ----------
if (-not $indecOk -and -not $fedOk) {
  Write-Host 'Sin datos nuevos de ninguna fuente: se conserva el calendario anterior.'
  exit 0
}
# Filtro de contenido: solo entran los eventos que mueven al mercado. Cada uno lleva impacto ('alto' o 'medio') y region
# (ar, us o global). Un evento sin impacto conocido se descarta: ante la duda, afuera. Los manuales pueden traer su propio "impact".
$impactByTitle = @{
  'Inflación (IPC)' = 'alto'; 'Mercado de trabajo' = 'alto'; 'Comercio exterior (ICA)' = 'alto'; 'Balanza de pagos' = 'medio'
  'Actividad económica (EMAE)' = 'alto'; 'Nivel de actividad (PBI)' = 'alto'; 'Industria (IPI manufacturero)' = 'medio'
  'Índice de salarios' = 'medio'; 'Construcción (ISAC)' = 'medio'; 'Capacidad instalada (UCII)' = 'medio'; 'Pobreza e indigencia (EPH)' = 'alto'
  'Decisión de tasas de la Fed' = 'alto'; 'Actas de la Fed' = 'medio'
  'Inflación (CPI)' = 'alto'; 'Precios al productor (PPI)' = 'medio'; 'Informe de empleo' = 'alto'; 'Vacantes de empleo (JOLTS)' = 'medio'
  'PBI de EE.UU.' = 'alto'; 'Consumo personal (PCE)' = 'alto'; 'Decisión de tasas del BCE' = 'alto'
}
$regionOf = @{ ar = 'ar'; us = 'us' }
foreach ($e in $events) {
  if (-not $e.impact) { $e['impact'] = $impactByTitle[$e.title] }
  $e['region'] = if ($regionOf.ContainsKey([string]$e.country)) { $regionOf[[string]$e.country] } else { 'global' }
}
$limit = $today.AddDays(-14).ToString('yyyy-MM-dd')   # no hace falta guardar eventos viejos
$sorted = @($events | Where-Object { $_.date -ge $limit -and $_.impact } | Sort-Object { $_.date + $_.time })
$result = [ordered]@{
  nota    = 'Solo datos que mueven al mercado. Fechas del calendario del INDEC, de la Reserva Federal, del BEA y del BCE, más los eventos de data/calendario-manual.json; horarios en hora de Argentina. El INDEC publica en general a las 16:00 h; su calendario oficial no indica la hora. "s/d": sin dato disponible.'
  fuentes = @('https://www.indec.gob.ar/indec/web/Calendario-Fecha-0', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', 'https://www.bea.gov/news/schedule', 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html')
  actualizado = (Get-Date).ToString('yyyy-MM-dd')
  eventos = $sorted
}
($result | ConvertTo-Json -Depth 5) | Set-Content $outFile -Encoding utf8
Write-Host "Listo: $($sorted.Count) eventos en $outFile"
