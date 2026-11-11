# ---------------------------------------------------------------------------
# fetch-mundo.ps1
# Datos del mapa de calor de la portada: ultimo dato anual disponible de cada pais
# (Banco Mundial) para crecimiento del PBI, inflacion, desempleo y cuenta corriente.
# Resultado: data/mundo.json. Si la descarga falla o llega incompleta, se conserva el archivo anterior.
# Inflacion de Argentina y EE.UU.: si el Banco Mundial todavia no publico el ultimo anio, se calcula
# con la misma definicion (promedio anual del indice de precios) a partir de data/argentina.json y data/usa.json.
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path $root 'data\mundo.json'
$geo = Get-Content (Join-Path $root 'data\paises.json') -Raw | ConvertFrom-Json
$valid = @($geo.PSObject.Properties.Name)

function Get-Json($url) { Invoke-RestMethod $url -TimeoutSec 120 }

# codigo ISO2 (para los nombres en espaniol en el navegador)
$cl = Get-Json 'https://api.worldbank.org/v2/country?format=json&per_page=400'
$iso2 = @{}
foreach ($c in $cl[1]) { $iso2[[string]$c.id] = [string]$c.iso2Code }

$defs = @(
  @{ k = 'gdp';   ind = 'NY.GDP.MKTP.KD.ZG'; label = 'Crecimiento del PBI';  unit = '% anual' },
  @{ k = 'infl';  ind = 'FP.CPI.TOTL.ZG';    label = 'Inflacion';             unit = '% anual (promedio)' },
  @{ k = 'unemp'; ind = 'SL.UEM.TOTL.ZS';    label = 'Desempleo';             unit = '% de la fuerza laboral' },
  @{ k = 'cab';   ind = 'BN.CAB.XOKA.GD.ZS'; label = 'Cuenta corriente';     unit = '% del PBI' }
)
$year = (Get-Date).Year
$countries = @{}
foreach ($iso in $valid) { $countries[$iso] = [ordered]@{ n = $iso2[$iso] } }
$indicators = [ordered]@{}

foreach ($d in $defs) {
  $r = Get-Json "https://api.worldbank.org/v2/country/all/indicator/$($d.ind)?format=json&per_page=20000&date=$($year - 4):$year"
  $best = @{}
  foreach ($x in $r[1]) {
    $iso = [string]$x.countryiso3code
    if ($valid -notcontains $iso -or $null -eq $x.value) { continue }
    $yy = [int]$x.date
    if (-not $best.ContainsKey($iso) -or $yy -gt $best[$iso][1]) { $best[$iso] = @([math]::Round([double]$x.value, 2), $yy) }
  }
  if ($best.Count -lt 100) { throw "Banco Mundial devolvio pocos paises para $($d.k): $($best.Count)" }
  foreach ($iso in $best.Keys) { $countries[$iso][$d.k] = $best[$iso] }
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
foreach ($pair in @(@('ARG', 'argentina', 'ipc'), @('USA', 'usa', 'cpi'))) {
  try {
    $j = Get-Content (Join-Path $root "data\$($pair[1]).json") -Raw -Encoding UTF8 | ConvertFrom-Json
    $ind = $j.indicators | Where-Object { $_.id -eq $pair[2] } | Select-Object -First 1
    $own = Get-AvgInflation $ind.points
    $cur = $countries[$pair[0]]['infl']
    if ($own -and ((-not $cur) -or $own[1] -gt $cur[1])) { $countries[$pair[0]]['infl'] = $own }
  } catch { Write-Warning "Inflacion propia $($pair[0]): $($_.Exception.Message)" }
}

$data = [ordered]@{ updated = (Get-Date).ToString('yyyy-MM-dd'); source = 'Banco Mundial'; indicators = $indicators; countries = $countries }
$json = $data | ConvertTo-Json -Depth 5 -Compress
[System.IO.File]::WriteAllText($outFile, $json, (New-Object System.Text.UTF8Encoding($false)))
"mundo.json: {0} paises, {1} KB" -f $valid.Count, [math]::Round($json.Length / 1KB)
