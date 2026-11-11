# ---------------------------------------------------------------------------
# fetch-mercados.ps1
# Barra de cotizaciones globales del Inicio: 10 variables, ultimo valor, cierre anterior y 5 dias de historia
# (para el minigrafico). Fuente: Yahoo Finance (API publica de graficos). El navegador no puede consultarla
# directamente (no permite CORS), por eso esta descarga corre en GitHub Actions y deja data/mercados.json.
# Bitcoin y el rendimiento a 10 anios se completan en vivo en el navegador (CoinGecko y U.S. Treasury).
# Si una fuente falla, se conserva el dato anterior de esa variable (con su hora): nunca se inventa un valor.
# Uso:  powershell -File tools\fetch-mercados.ps1
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path $root 'data\mercados.json'
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
$inv = [Globalization.CultureInfo]::InvariantCulture

# id, etiqueta, ticker de Yahoo, grupo, unidad ('pct' o 'pb' para la variacion), decimales, nota
$defs = @(
  @{ id = 'spx';    label = 'S&P 500';             sym = '^GSPC';    group = 'Renta variable';        dec = 2; chg = 'pct'; note = '' },
  @{ id = 'ndx';    label = 'Nasdaq Composite';    sym = '^IXIC';    group = 'Renta variable';        dec = 2; chg = 'pct'; note = '' },
  @{ id = 'eem';    label = 'Emergentes (EEM)';    sym = 'EEM';      group = 'Renta variable';        dec = 2; chg = 'pct'; note = 'ETF EEM (iShares MSCI Emerging Markets) como referencia del indice MSCI Emerging Markets' },
  @{ id = 'us10y';  label = 'Treasury 10 a'+[char]0xF1+'os'; sym = '^TNX'; group = 'Tasas y riesgo';  dec = 2; chg = 'pb';  note = 'Rendimiento en %. Una suba indica condiciones financieras mas restrictivas.' },
  @{ id = 'vix';    label = 'VIX';                 sym = '^VIX';     group = 'Tasas y riesgo';        dec = 2; chg = 'pct'; note = 'Indice de volatilidad. Una suba indica mas aversion al riesgo.' },
  @{ id = 'dxy';    label = 'DXY';                 sym = 'DX-Y.NYB'; group = 'Monedas';               dec = 2; chg = 'pct'; note = 'Indice del dolar contra una canasta de monedas. Una suba indica un dolar mas fuerte y condiciones financieras mas restrictivas.' },
  @{ id = 'usdcny'; label = 'USD/CNY';             sym = 'CNY=X';    group = 'Monedas';               dec = 4; chg = 'pct'; note = 'Yuanes por dolar' },
  @{ id = 'gold';   label = 'Oro';                 sym = 'GC=F';     group = 'Commodities y cripto';  dec = 1; chg = 'pct'; note = 'USD por onza (futuro mas cercano)' },
  @{ id = 'brent';  label = 'Petr'+[char]0xF3+'leo Brent'; sym = 'BZ=F'; group = 'Commodities y cripto'; dec = 2; chg = 'pct'; note = 'USD por barril (futuro mas cercano)' },
  @{ id = 'btc';    label = 'Bitcoin';             sym = 'BTC-USD';  group = 'Commodities y cripto';  dec = 0; chg = 'pct'; note = 'USD' }
)

# datos anteriores, para conservarlos si una consulta falla
$old = @{}
if (Test-Path $outFile) {
  try { foreach ($i in @((Get-Content $outFile -Raw -Encoding UTF8 | ConvertFrom-Json).items)) { $old[$i.id] = $i } } catch { }
}

function Get-Chart($sym, $range, $interval) {
  $u = "https://query1.finance.yahoo.com/v8/finance/chart/$([uri]::EscapeDataString($sym))?range=$range&interval=$interval"
  for ($try = 1; $try -le 3; $try++) {
    try { return (Invoke-RestMethod $u -UserAgent $ua -TimeoutSec 30).chart.result[0] } catch { Start-Sleep -Seconds (2 * $try) }
  }
  return $null
}

$items = New-Object System.Collections.ArrayList
$ok = 0
foreach ($d in $defs) {
  $item = $null
  try {
    $day = Get-Chart $d.sym '1d' '1d'
    $five = Get-Chart $d.sym '5d' '60m'
    if ($day -and $five -and $null -ne $day.meta.regularMarketPrice -and $null -ne $day.meta.chartPreviousClose) {
      $scale = 1.0
      # ^TNX a veces llega multiplicado por 10: un rendimiento a 10 anios no puede pasar de 20 %
      if ($d.id -eq 'us10y' -and [double]$day.meta.regularMarketPrice -gt 20) { $scale = 0.1 }
      $closes = @($five.indicators.quote[0].close | Where-Object { $null -ne $_ })
      $stride = [math]::Max(1, [math]::Ceiling($closes.Count / 40))
      $spark = New-Object System.Collections.ArrayList
      for ($k = 0; $k -lt $closes.Count; $k += $stride) { [void]$spark.Add([math]::Round([double]$closes[$k] * $scale, 4)) }
      if ($closes.Count -gt 0) { [void]$spark.Add([math]::Round([double]$closes[$closes.Count - 1] * $scale, 4)) }
      $item = [ordered]@{
        id = $d.id; label = $d.label; group = $d.group; dec = $d.dec; chg = $d.chg; note = $d.note
        price = [math]::Round([double]$day.meta.regularMarketPrice * $scale, 4)
        prev  = [math]::Round([double]$day.meta.chartPreviousClose * $scale, 4)
        time  = [long]$day.meta.regularMarketTime
        spark = $spark
      }
      $ok++
    }
  } catch { Write-Warning "$($d.sym): $($_.Exception.Message)" }
  if (-not $item -and $old.ContainsKey($d.id)) { $item = $old[$d.id]; Write-Warning "$($d.sym): se conserva el dato anterior" }
  if ($item) { [void]$items.Add($item) }
}
Write-Host "Mercados: $ok de $($defs.Count) actualizados, $($items.Count) en el archivo"
if ($ok -eq 0) { Write-Host 'Sin datos nuevos: se conserva el archivo anterior.'; exit 0 }

$json = [ordered]@{ updated = [DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'); source = 'Yahoo Finance'; items = $items } | ConvertTo-Json -Depth 6 -Compress
[System.IO.File]::WriteAllText($outFile, $json, (New-Object System.Text.UTF8Encoding($false)))
"mercados.json: {0} bytes" -f $json.Length
