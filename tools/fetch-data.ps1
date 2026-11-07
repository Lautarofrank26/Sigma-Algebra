# ---------------------------------------------------------------------------
# fetch-data.ps1
# Descarga series macro desde APIs publicas y las guarda como JSON en /data.
# Uso:  powershell -File tools\fetch-data.ps1
# Para agregar un indicador: sumar una entrada en $arSeries / bls / etc.
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$inv  = [Globalization.CultureInfo]::InvariantCulture
$root = Split-Path $PSScriptRoot -Parent
$out  = Join-Path $root 'data'
New-Item -ItemType Directory -Force $out | Out-Null
$today = (Get-Date).ToString('yyyy-MM-dd')

# Lista de puntos [fecha, valor]; ArrayList evita que PowerShell aplane los arrays anidados
function New-Pts { New-Object System.Collections.ArrayList }
function Add-Pt($list, $d, $v) { [void]$list.Add(@($d, [math]::Round([double]$v, 4))) }

# ---------- ARGENTINA: datos.gob.ar (INDEC / BCRA / MECON) ----------
function Get-Ar($id, $extra = '', $scale = 1) {
  $u = "https://apis.datos.gob.ar/series/api/series/?ids=$id&limit=1000&sort=asc&start_date=2010-01-01&format=json$extra"
  $pts = New-Pts
  try {
    $r = Invoke-RestMethod $u -TimeoutSec 60
    foreach ($row in $r.data) { if ($null -ne $row[1]) { Add-Pt $pts $row[0] ($row[1] * $scale) } }
  } catch { Write-Warning "AR $id : $($_.Exception.Message)" }
  return ,$pts
}

$ar = @()
$ar += @{ id='ipc';      label='IPC nivel general';        unit='indice dic-16=100'; freq='M'; source='INDEC'; points=(Get-Ar '148.3_INIVELNAL_DICI_M_26') }
$ar += @{ id='emae';     label='EMAE desestacionalizado';  unit='indice 2004=100';   freq='M'; source='INDEC'; points=(Get-Ar '143.3_NO_PR_2004_A_31') }
$ar += @{ id='unemp';    label='Tasa de desempleo';        unit='%';                 freq='Q'; source='INDEC (EPH)'; points=(Get-Ar '45.2_ECTDT_0_T_33' '' 100) }
$ar += @{ id='fx';       label='Tipo de cambio mayorista'; unit='ARS por USD';       freq='M'; source='BCRA'; points=(Get-Ar '168.1_T_CAMBIOR_D_0_0_26' '&collapse=month&collapse_aggregation=avg') }
$ar += @{ id='reserves'; label='Reservas internacionales'; unit='USD millones';      freq='M'; source='BCRA'; points=(Get-Ar '174.1_RRVAS_IDOS_0_0_36' '&collapse=month&collapse_aggregation=end_of_period') }

# ---------- Banco Mundial: crecimiento anual del PBI real ----------
function Get-WB($iso, $ind) {
  try {
    $r = Invoke-RestMethod "https://api.worldbank.org/v2/country/$iso/indicator/${ind}?format=json&per_page=60&date=2005:2026" -TimeoutSec 60
    $pts = New-Pts
    foreach ($x in ($r[1] | Sort-Object date)) { if ($null -ne $x.value) { Add-Pt $pts $x.date $x.value } }
    return ,$pts
  } catch { Write-Warning "WB $iso : $($_.Exception.Message)"; return ,(New-Pts) }
}
$ar += @{ id='gdp'; label='PBI real, var. anual'; unit='%'; freq='A'; source='Banco Mundial'; points=(Get-WB 'ARG' 'NY.GDP.MKTP.KD.ZG') }

@{ country='AR'; updated=$today; indicators=$ar } | ConvertTo-Json -Depth 6 -Compress | Set-Content (Join-Path $out 'argentina.json') -Encoding utf8

# ---------- EE.UU.: BLS ----------
$blsIds = @{ 'CUSR0000SA0'='cpi'; 'CUSR0000SA0L1E'='corecpi'; 'LNS14000000'='unemp'; 'CES0000000001'='payrolls'; 'LNS11300000'='participation'; 'CES0500000003'='ahe' }
# la API v1 de BLS permite 10 anios de historia
$body = @{ seriesid=@($blsIds.Keys); startyear=((Get-Date).Year - 9).ToString(); endyear=(Get-Date).Year.ToString() } | ConvertTo-Json
$bls = @{}
try {
  $r = Invoke-RestMethod 'https://api.bls.gov/publicAPI/v1/timeseries/data/' -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 60
  foreach ($s in $r.Results.series) {
    $pts = New-Pts
    foreach ($d in ($s.data | Sort-Object { "$($_.year)$($_.period)" })) {
      $num = 0.0
      # BLS publica "-" cuando falta un dato (p. ej. oct-2025); se omite
      if ($d.period -match '^M(\d\d)$' -and $d.period -ne 'M13' -and [double]::TryParse($d.value, 'Float', $inv, [ref]$num)) {
        Add-Pt $pts ("{0}-{1}-01" -f $d.year, $Matches[1]) $num
      }
    }
    $bls[$blsIds[$s.seriesID]] = $pts
  }
} catch { Write-Warning "BLS: $($_.Exception.Message)" }

$us = @()
$us += @{ id='cpi';           label='CPI-U general (s.e.)';         unit='indice 1982-84=100'; freq='M'; source='BLS'; points=$bls['cpi'] }
$us += @{ id='corecpi';       label='CPI subyacente (s.e.)';        unit='indice 1982-84=100'; freq='M'; source='BLS'; points=$bls['corecpi'] }
$us += @{ id='unemp';         label='Tasa de desempleo';            unit='%';                  freq='M'; source='BLS'; points=$bls['unemp'] }
$us += @{ id='payrolls';      label='Empleo no agricola';           unit='miles de personas';  freq='M'; source='BLS'; points=$bls['payrolls'] }
$us += @{ id='participation'; label='Participacion laboral';        unit='%';                  freq='M'; source='BLS'; points=$bls['participation'] }
$us += @{ id='ahe';           label='Salario horario promedio';     unit='USD por hora';       freq='M'; source='BLS'; points=$bls['ahe'] }

# ---------- EE.UU.: Tesoro (rendimiento 10 anios, promedio mensual) ----------
$y10 = New-Pts
for ($i = 59; $i -ge 0; $i--) {
  $m = (Get-Date -Day 1).AddMonths(-$i).ToString('yyyyMM')
  try {
    $x = [xml](Invoke-WebRequest "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=$m" -UseBasicParsing -TimeoutSec 40).Content
    $vals = @(); foreach ($e in $x.feed.entry) { $v = $e.content.properties.BC_10YEAR.'#text'; if ($v) { $vals += [double]::Parse($v, $inv) } }
    if ($vals.Count) { Add-Pt $y10 ("{0}-{1}-01" -f $m.Substring(0,4), $m.Substring(4,2)) (($vals | Measure-Object -Average).Average) }
  } catch { Write-Warning "UST $m : $($_.Exception.Message)" }
}
$us += @{ id='y10'; label='Rendimiento Tesoro 10 anios'; unit='%'; freq='M'; source='US Treasury'; points=$y10 }

# ---------- EE.UU.: NY Fed (EFFR, promedio mensual) ----------
try {
  $r = Invoke-RestMethod ("https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json?startDate=2021-01-01&endDate=$today") -TimeoutSec 60
  $g = $r.refRates | Group-Object { $_.effectiveDate.Substring(0,7) } | Sort-Object Name
  $ff = New-Pts
  foreach ($grp in $g) { Add-Pt $ff ($grp.Name + '-01') (($grp.Group | Measure-Object percentRate -Average).Average) }
  $us += @{ id='fedfunds'; label='Tasa efectiva de fondos federales'; unit='%'; freq='M'; source='NY Fed'; points=$ff }
} catch { Write-Warning "NYFED: $($_.Exception.Message)" }

$us += @{ id='gdp'; label='PBI real, var. anual'; unit='%'; freq='A'; source='Banco Mundial'; points=(Get-WB 'USA' 'NY.GDP.MKTP.KD.ZG') }

@{ country='US'; updated=$today; indicators=$us } | ConvertTo-Json -Depth 6 -Compress | Set-Content (Join-Path $out 'usa.json') -Encoding utf8

# ---------- ARGENTINA: tipos de dolar (ArgentinaDatos + DolarAPI) ----------
# Historia diaria -> promedio mensual de la cotizacion de venta desde 2019.
$casas = [ordered]@{
  oficial   = @('Oficial', 'oficial')
  mayorista = @('Mayorista', 'mayorista')
  blue      = @('Blue', 'blue')
  mep       = @('MEP (bolsa)', 'bolsa')
  ccl       = @('Contado con liqui', 'contadoconliqui')
  cripto    = @('Cripto', 'cripto')
  tarjeta   = @('Tarjeta', 'tarjeta')
}
$dol = @(); $monthly = @{}
foreach ($k in $casas.Keys) {
  $pts = New-Pts; $map = [ordered]@{}
  try {
    $r = Invoke-RestMethod "https://api.argentinadatos.com/v1/cotizaciones/dolares/$($casas[$k][1])" -TimeoutSec 60
    $g = $r | Where-Object { $_.fecha -ge '2019-01-01' -and $_.venta } | Group-Object { $_.fecha.Substring(0,7) } | Sort-Object Name
    foreach ($grp in $g) { $v = ($grp.Group | Measure-Object venta -Average).Average; Add-Pt $pts ($grp.Name + '-01') $v; $map[$grp.Name] = $v }
  } catch { Write-Warning "Dolar $k : $($_.Exception.Message)" }
  $monthly[$k] = $map
  $dol += @{ id=$k; label=$casas[$k][0]; unit='ARS por USD (venta, prom. mensual)'; freq='M'; source='ArgentinaDatos'; points=$pts }
}
# Brecha contra el oficial (%)
foreach ($k in 'blue','mep','ccl') {
  $pts = New-Pts
  foreach ($m in $monthly[$k].Keys) { if ($monthly['oficial'][$m]) { Add-Pt $pts ($m + '-01') (($monthly[$k][$m] / $monthly['oficial'][$m] - 1) * 100) } }
  $dol += @{ id="brecha_$k"; label="Brecha $k"; unit='% sobre oficial'; freq='M'; source='calculado'; points=$pts }
}
# Cotizaciones de hoy
$quotes = @()
try {
  foreach ($q in (Invoke-RestMethod 'https://dolarapi.com/v1/dolares' -TimeoutSec 40)) {
    $quotes += @{ casa=$q.casa; nombre=$q.nombre; compra=$q.compra; venta=$q.venta; fecha=$q.fechaActualizacion }
  }
} catch { Write-Warning "DolarAPI: $($_.Exception.Message)" }
@{ country='AR-FX'; updated=$today; quotes=$quotes; indicators=$dol } | ConvertTo-Json -Depth 6 -Compress | Set-Content (Join-Path $out 'dolar.json') -Encoding utf8
Write-Host "Listo: $out"

