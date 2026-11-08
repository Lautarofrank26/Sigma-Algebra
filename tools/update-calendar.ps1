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
  @{ p = '^Sistema de .ndices de precios mayoristas';            title = 'Precios mayoristas (SIPM)';     href = 'precios.html' },
  @{ p = '^.ndice de salarios';                                  title = 'Índice de salarios';            href = 'empleo.html'; previo = @{ file='ar'; id='wages'; t='pct1'; decimals=1; suffix='%'; label='Anterior (m/m)' } },
  @{ p = '^Mercado de trabajo';                                  title = 'Mercado de trabajo';            href = 'empleo.html'; detailPrefix = 'Desempleo del '; previo = @{ file='ar'; id='unemp'; t='level'; decimals=1; suffix='%'; label='Anterior' } },
  @{ p = '^Intercambio comercial argentino';                     title = 'Comercio exterior (ICA)';       href = 'externo.html'; previo = @{ file='ar'; id='trade_balance'; t='level'; decimals=0; prefix='USD '; suffix=' M'; label='Saldo anterior' } },
  @{ p = '^Balanza de pagos';                                    title = 'Balanza de pagos';              href = 'externo.html' },
  @{ p = '^Estimador mensual de actividad econ.mica';            title = 'Actividad económica (EMAE)';    href = 'actividad.html'; previo = @{ file='ar'; id='emae'; t='pct1'; decimals=1; suffix='%'; signed=$true; label='Anterior (m/m)' } },
  @{ p = '^Informe de avance del nivel de actividad';            title = 'Nivel de actividad (PBI)';      href = 'actividad.html'; detailPrefix = 'Informe de avance del '; previo = @{ file='ar'; id='gdp_level'; t='yoy'; decimals=1; suffix='%'; signed=$true; label='Anterior (i.a.)' } },
  @{ p = '^.ndice de producci.n industrial manufacturero';       title = 'Industria (IPI manufacturero)'; href = 'actividad.html'; previo = @{ file='ar'; id='ipi'; t='pct1'; decimals=1; suffix='%'; signed=$true; label='Anterior (m/m)' } },
  @{ p = '^Indicador sint.tico de servicios p.blicos';           title = 'Servicios públicos (ISSP)';     href = 'actividad.html' }
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

# ---------- eventos manuales ----------
if (Test-Path $manualFile) {
  try {
    $manual = Get-Content $manualFile -Raw -Encoding utf8 | ConvertFrom-Json
    foreach ($e in @($manual.eventos)) {
      [void]$events.Add([ordered]@{ date = $e.date; time = $e.time; tz = $e.tz; country = $e.country; source = $e.source; title = $e.title; detail = $e.detail; href = $e.href; previo = $e.previo; consenso = $e.consenso })
    }
    Write-Host "Manuales: $(@($manual.eventos).Count) eventos"
  } catch { Write-Host "Manuales: archivo invalido ($($_.Exception.Message))" }
}

# ---------- salida ----------
if (-not $indecOk -and -not $fedOk) {
  Write-Host 'Sin datos nuevos de ninguna fuente: se conserva el calendario anterior.'
  exit 0
}
$limit = $today.AddDays(-14).ToString('yyyy-MM-dd')   # no hace falta guardar eventos viejos
$sorted = @($events | Where-Object { $_.date -ge $limit } | Sort-Object { $_.date + $_.time })
$result = [ordered]@{
  nota    = 'Fechas del calendario de difusión del INDEC y del calendario de reuniones de la Reserva Federal, más los eventos de data/calendario-manual.json. El INDEC publica en general a las 16:00 h; su calendario oficial no indica la hora.'
  fuentes = @('https://www.indec.gob.ar/indec/web/Calendario-Fecha-0', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm')
  actualizado = (Get-Date).ToString('yyyy-MM-dd')
  eventos = $sorted
}
($result | ConvertTo-Json -Depth 5) | Set-Content $outFile -Encoding utf8
Write-Host "Listo: $($sorted.Count) eventos en $outFile"
