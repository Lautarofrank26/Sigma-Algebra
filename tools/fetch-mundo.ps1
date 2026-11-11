# ---------------------------------------------------------------------------
# fetch-mundo.ps1
# Datos del mapa de calor de la portada (Banco Mundial), por pais:
#   - crecimiento del PBI, inflacion y desempleo
#   - peso en el PBI mundial (PBI en US$ corrientes del pais / PBI mundial)
# Resultados:
#   data/mundo.json         ultimo dato anual de cada pais (para pintar el mapa)
#   data/mundo-series.json  serie anual desde 2000 (para los graficos del cursor y para comparar paises)
# Si la descarga falla o llega incompleta, se conservan los archivos anteriores.
# Inflacion de Argentina y EE.UU.: si el Banco Mundial todavia no publico el ultimo anio, se calcula
# con la misma definicion (promedio anual del indice de precios) a partir de data/argentina.json y data/usa.json.
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path $root 'data\mundo.json'
$seriesFile = Join-Path $root 'data\mundo-series.json'
$geo = Get-Content (Join-Path $root 'data\paises.json') -Raw | ConvertFrom-Json
$valid = @($geo.PSObject.Properties.Name)

function Get-Json($url) { Invoke-RestMethod $url -TimeoutSec 120 }

# codigo ISO2 (para los nombres en espaniol en el navegador)
$cl = Get-Json 'https://api.worldbank.org/v2/country?format=json&per_page=400'
$iso2 = @{}
foreach ($c in $cl[1]) { $iso2[[string]$c.id] = [string]$c.iso2Code }

$defs = @(
  @{ k = 'gdp';   ind = 'NY.GDP.MKTP.KD.ZG'; label = 'Crecimiento del PBI';     unit = '% anual' },
  @{ k = 'infl';  ind = 'FP.CPI.TOTL.ZG';    label = 'Inflacion';                unit = '% anual (promedio)' },
  @{ k = 'unemp'; ind = 'SL.UEM.TOTL.ZS';    label = 'Desempleo';                unit = '% de la fuerza laboral' },
  @{ k = 'share'; ind = 'NY.GDP.MKTP.CD';    label = 'Peso en el PBI mundial';   unit = '% del PBI mundial (US$ corrientes)' }
)
$thisYear = (Get-Date).Year
$from = 2000
$n = $thisYear - $from + 1          # una posicion por anio, de 2000 al anio en curso
$countries = @{}
$hist = @{}
foreach ($iso in $valid) { $countries[$iso] = [ordered]@{ n = $iso2[$iso] }; $hist[$iso] = @{} }
$indicators = [ordered]@{}

foreach ($d in $defs) {
  $r = Get-Json "https://api.worldbank.org/v2/country/all/indicator/$($d.ind)?format=json&per_page=20000&date=${from}:$thisYear"
  $world = @{}
  if ($d.k -eq 'share') { foreach ($x in $r[1]) { if ($x.countryiso3code -eq 'WLD' -and $null -ne $x.value) { $world[[int]$x.date] = [double]$x.value } } }
  $count = 0
  foreach ($x in $r[1]) {
    $iso = [string]$x.countryiso3code
    if ($valid -notcontains $iso -or $null -eq $x.value) { continue }
    $yy = [int]$x.date
    $idx = $yy - $from
    if ($idx -lt 0 -or $idx -ge $n) { continue }
    if ($d.k -eq 'share') {
      if (-not $world.ContainsKey($yy)) { continue }
      $val = [math]::Round([double]$x.value / $world[$yy] * 100, 3)
    } else { $val = [math]::Round([double]$x.value, 2) }
    if (-not $hist[$iso].ContainsKey($d.k)) { $hist[$iso][$d.k] = New-Object 'object[]' $n }
    $hist[$iso][$d.k][$idx] = $val
  }
  foreach ($iso in $valid) { if ($hist[$iso].ContainsKey($d.k)) { $count++ } }
  if ($count -lt 100) { throw "Banco Mundial devolvio pocos paises para $($d.k): $count" }
  $indicators[$d.k] = [ordered]@{ label = $d.label; unit = $d.unit }
}

# Inflacion: promedio anual del indice propio, si es mas reciente que el dato del Banco Mundial
function Get-AvgInflation($points) {
  # anio -> (mes -> indice). Se compara solo con los meses que existen en ambos anios (BLS no publico octubre de 2025)
  $by = @{}
  foreach ($p in $points) {
    $s = [string]$p[0]; $y = [int]$s.Substring(0, 4); $mo = [int]$s.Substring(5, 2)
    if (-not $by.ContainsKey($y)) { $by[$y] = @{} }
    $by[$y][$mo] = [double]$p[1]
  }
  foreach ($y in @($by.Keys | Sort-Object -Descending)) {
    if ($y -ge (Get-Date).Year -or -not $by.ContainsKey($y - 1)) { continue }   # solo anios cerrados
    $common = @($by[$y].Keys | Where-Object { $by[$y - 1].ContainsKey($_) })
    if ($common.Count -lt 10) { continue }
    $a = ($common | ForEach-Object { $by[$y][$_] } | Measure-Object -Average).Average
    $b = ($common | ForEach-Object { $by[$y - 1][$_] } | Measure-Object -Average).Average
    return @([math]::Round(($a / $b - 1) * 100, 2), $y)
  }
  return $null
}
# ultimo dato [valor, anio] de una serie anual con huecos (o $null)
function Get-Last($arr) {
  if (-not $arr) { return $null }
  for ($i = $arr.Length - 1; $i -ge 0; $i--) { if ($null -ne $arr[$i]) { return @($arr[$i], ($from + $i)) } }
  return $null
}

foreach ($pair in @(@('ARG', 'argentina', 'ipc'), @('USA', 'usa', 'cpi'))) {
  try {
    $j = Get-Content (Join-Path $root "data\$($pair[1]).json") -Raw -Encoding UTF8 | ConvertFrom-Json
    $ind = $j.indicators | Where-Object { $_.id -eq $pair[2] } | Select-Object -First 1
    $own = Get-AvgInflation $ind.points
    $iso = $pair[0]
    $cur = Get-Last $hist[$iso]['infl']
    if ($own -and ((-not $cur) -or $own[1] -gt $cur[1])) {
      if (-not $hist[$iso].ContainsKey('infl')) { $hist[$iso]['infl'] = New-Object 'object[]' $n }
      $hist[$iso]['infl'][$own[1] - $from] = $own[0]
    }
  } catch { Write-Warning "Inflacion propia $($pair[0]): $($_.Exception.Message)" }
}

# ultimo dato de cada pais e indicador, y series completas
$seriesOut = [ordered]@{}
foreach ($iso in $valid) {
  $entry = [ordered]@{}
  foreach ($d in $defs) {
    $arr = $hist[$iso][$d.k]
    $last = Get-Last $arr
    if ($last) { $countries[$iso][$d.k] = $last; $entry[$d.k] = $arr }
  }
  if ($entry.Count -gt 0) { $seriesOut[$iso] = $entry }
}

$data = [ordered]@{ updated = (Get-Date).ToString('yyyy-MM-dd'); source = 'Banco Mundial'; indicators = $indicators; countries = $countries }
$json = $data | ConvertTo-Json -Depth 5 -Compress
[System.IO.File]::WriteAllText($outFile, $json, (New-Object System.Text.UTF8Encoding($false)))
# Las series se escriben a mano: ConvertTo-Json (PowerShell 5.1) no serializa bien los arreglos con huecos (null)
$inv = [Globalization.CultureInfo]::InvariantCulture
$lastIdx = 0
foreach ($iso in $seriesOut.Keys) { foreach ($k in $seriesOut[$iso].Keys) { $a = $seriesOut[$iso][$k]; for ($i = $n - 1; $i -gt $lastIdx; $i--) { if ($null -ne $a[$i]) { $lastIdx = $i; break } } } }
$parts = foreach ($iso in $seriesOut.Keys) {
  $inner = foreach ($k in $seriesOut[$iso].Keys) {
    $a = $seriesOut[$iso][$k]
    $vals = for ($i = 0; $i -le $lastIdx; $i++) { if ($null -eq $a[$i]) { 'null' } else { ([double]$a[$i]).ToString('0.###', $inv) } }
    '"{0}":[{1}]' -f $k, ($vals -join ',')
  }
  '"{0}":{{{1}}}' -f $iso, ($inner -join ',')
}
$sj = '{{"from":{0},"to":{1},"countries":{{{2}}}}}' -f $from, ($from + $lastIdx), ($parts -join ',')
[System.IO.File]::WriteAllText($seriesFile, $sj, (New-Object System.Text.UTF8Encoding($false)))
"mundo.json: {0} paises, {1} KB; mundo-series.json: {2} KB" -f $valid.Count, [math]::Round($json.Length / 1KB), [math]::Round($sj.Length / 1KB)
