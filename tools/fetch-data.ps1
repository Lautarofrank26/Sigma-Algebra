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

# Si una fuente falla y la serie llega vacia, se conserva la version anterior del archivo
# (asi una caida de BLS o de otra API nunca borra datos ya publicados).
function Restore-Empty($list, $file) {
  if (-not (Test-Path $file)) { return }
  $old = Get-Content $file -Raw -Encoding utf8 | ConvertFrom-Json
  foreach ($ind in $list) {
    if ($ind.points -and $ind.points.Count -gt 0) { continue }
    $prev = $old.indicators | Where-Object { $_.id -eq $ind.id } | Select-Object -First 1
    if ($prev -and $prev.points) { $ind.points = $prev.points; Write-Warning "Serie $($ind.id): sin datos nuevos, se conserva la anterior" }
  }
}
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
# ---------- ARGENTINA: indicadores adicionales (precios, actividad, empleo, externo, dinero, fiscal) ----------
# Cada fila: id, etiqueta, unidad, frecuencia, fuente, id de serie en datos.gob.ar, factor opcional
$extra = @(
  @('core',      'IPC núcleo',                        'indice dic-16=100', 'M', 'INDEC', '148.3_INUCLEONAL_DICI_M_19'),
  @('regulated', 'IPC regulados',                     'indice dic-16=100', 'M', 'INDEC', '148.3_IREGULANAL_DICI_M_22'),
  @('ipi',       'Industria (IPI) desestacionalizado','indice base 2004',  'M', 'INDEC', '453.1_SERIE_DESEADA_0_0_24_58'),
  @('gdp_level', 'PBI a precios constantes de 2004',  'millones de ARS',   'Q', 'INDEC', '9.2_PP2_2004_T_16'),
  @('activity_rate', 'Tasa de actividad',             '%',                 'Q', 'INDEC (EPH)', '43.2_ECTAT_0_T_33', 100),
  @('employment_rate','Tasa de empleo',               '%',                 'Q', 'INDEC (EPH)', '42.3_EPH_PUNTUATAL_0_M_24', 100),
  @('wages',     'Índice de salarios',                'indice oct-16=100', 'M', 'INDEC', '149.1_TL_INDIIOS_OCTU_0_21'),
  @('wages_priv','Salarios registrados, sector privado','indice oct-16=100','M','INDEC', '149.1_SOR_PRIADO_OCTU_0_25'),
  @('wages_pub', 'Salarios registrados, sector público','indice oct-16=100','M','INDEC', '149.1_SOR_PUBICO_OCTU_0_14'),
  @('poverty_line','Canasta básica total (línea de pobreza)','ARS por adulto equivalente','M','INDEC','150.1_LA_POBREZA_0_D_13'),
  @('indigence_line','Canasta básica alimentaria (línea de indigencia)','ARS por adulto equivalente','M','INDEC','150.1_LA_INDICIA_0_D_16'),
  @('exports',   'Exportaciones',                     'USD millones',      'M', 'INDEC', '74.3_IET_0_M_16'),
  @('imports',   'Importaciones',                     'USD millones',      'M', 'INDEC', '74.3_IIT_0_M_25'),
  @('trade_balance','Saldo comercial',                'USD millones',      'M', 'INDEC', '74.3_ISC_0_M_19'),
  @('m2',        'M2 privado',                        'ARS millones',      'M', 'BCRA', '90.1_AMTMA_0_0_39'),
  @('loans',     'Préstamos al sector privado en pesos','ARS millones',    'M', 'BCRA', '91.1_DETALLE_PRPOT_0_0_25'),
  @('time_deposits','Plazos fijos en pesos',          'ARS',               'M', 'BCRA', '90.1_DET_DESAGRTAL_0_0_44'),
  @('badlar',    'Tasa BADLAR',                       '% TNA',             'M', 'BCRA', '89.1_TIB_0_0_20'),
  @('primary_balance','Resultado primario SPNF',      'ARS millones',      'M', 'Secretaría de Hacienda', '452.3_RESULTADO_RIO_0_M_18_54'),
  @('financial_balance','Resultado financiero SPN',   'ARS millones',      'M', 'Secretaría de Hacienda', '379.9_RESULTADO_017__18_38')
)
$arById = @{}
foreach ($e in $extra) {
  $scale = 1; if ($e.Count -gt 6) { $scale = $e[6] }
  $pts = Get-Ar $e[5] '' $scale
  $arById[$e[0]] = $pts
  $ar += @{ id=$e[0]; label=$e[1]; unit=$e[2]; freq=$e[3]; source=$e[4]; points=$pts }
}

# Series reales: nivel nominal / IPC (se usan en variación interanual)
function Get-Real($nominal, $deflator, $label, $id) {
  $d = @{}; foreach ($q in $deflator) { $d[$q[0]] = $q[1] }
  $pts = New-Pts
  foreach ($q in $nominal) { if ($d.ContainsKey($q[0]) -and $d[$q[0]] -gt 0) { Add-Pt $pts $q[0] ($q[1] / $d[$q[0]] * 100) } }
  return @{ id=$id; label=$label; unit='indice real (nominal / IPC)'; freq='M'; source='calculado (INDEC, BCRA)'; points=$pts }
}
$ipcPts = ($ar | Where-Object { $_.id -eq 'ipc' }).points
$ar += Get-Real $arById['wages']      $ipcPts 'Salarios reales'                  'wages_real'
$ar += Get-Real $arById['wages_priv'] $ipcPts 'Salarios reales, sector privado'  'wages_priv_real'
$ar += Get-Real $arById['wages_pub']  $ipcPts 'Salarios reales, sector público'  'wages_pub_real'
$ar += Get-Real $arById['loans']      $ipcPts 'Préstamos reales en pesos'        'loans_real'
$ar += Get-Real $arById['m2']         $ipcPts 'M2 privado real'                  'm2_real'

Restore-Empty $ar (Join-Path $out 'argentina.json')
@{ country='AR'; updated=$today; indicators=$ar } | ConvertTo-Json -Depth 6 -Compress | Set-Content (Join-Path $out 'argentina.json') -Encoding utf8

# ---------- EE.UU.: BLS ----------
$blsIds = @{
  'CUSR0000SA0'='cpi'; 'CUSR0000SA0L1E'='corecpi'; 'LNS14000000'='unemp'; 'CES0000000001'='payrolls'; 'LNS11300000'='participation'; 'CES0500000003'='ahe'
  # adicionales (mismos ids que js/data/live-sources.js)
  'CUSR0000SA0E'='cpi_energy'; 'CUSR0000SAF1'='cpi_food'; 'CUSR0000SAH1'='cpi_shelter'; 'CUSR0000SASLE'='cpi_services'
  'WPSFD4'='ppi'; 'LNS13327709'='u6'; 'LNS12300000'='epop'; 'CES0500000002'='hours'; 'JTS000000000000000JOL'='jolts_openings'
}
# Sin clave se usa la API v1 (10 anios de historia, ~25 consultas por dia por IP).
# Con la variable de entorno BLS_API_KEY (secreto de GitHub Actions) se usa la v2 (hasta 500 consultas por dia).
$blsKey = $env:BLS_API_KEY
$blsBody = @{ seriesid=@($blsIds.Keys); startyear=((Get-Date).Year - 9).ToString(); endyear=(Get-Date).Year.ToString() }
$blsUrl = 'https://api.bls.gov/publicAPI/v1/timeseries/data/'
if ($blsKey) { $blsBody.registrationkey = $blsKey; $blsUrl = 'https://api.bls.gov/publicAPI/v2/timeseries/data/' }
$body = $blsBody | ConvertTo-Json
$bls = @{}
try {
  $r = Invoke-RestMethod $blsUrl -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 60
  if ($r.status -ne 'REQUEST_SUCCEEDED') { Write-Warning "BLS: $($r.message -join ' ')" }
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
$us += @{ id='cpi_energy';    label='CPI energía (s.e.)';           unit='indice 1982-84=100'; freq='M'; source='BLS'; points=$bls['cpi_energy'] }
$us += @{ id='cpi_food';      label='CPI alimentos (s.e.)';         unit='indice 1982-84=100'; freq='M'; source='BLS'; points=$bls['cpi_food'] }
$us += @{ id='cpi_shelter';   label='CPI vivienda (s.e.)';          unit='indice 1982-84=100'; freq='M'; source='BLS'; points=$bls['cpi_shelter'] }
$us += @{ id='cpi_services';  label='CPI servicios sin energía (s.e.)'; unit='indice 1982-84=100'; freq='M'; source='BLS'; points=$bls['cpi_services'] }
$us += @{ id='ppi';           label='PPI demanda final (s.e.)';     unit='indice';             freq='M'; source='BLS'; points=$bls['ppi'] }
$us += @{ id='u6';            label='Desempleo ampliado (U-6)';     unit='%';                  freq='M'; source='BLS'; points=$bls['u6'] }
$us += @{ id='epop';          label='Empleo / población';           unit='%';                  freq='M'; source='BLS'; points=$bls['epop'] }
$us += @{ id='hours';         label='Horas semanales promedio';     unit='horas';              freq='M'; source='BLS'; points=$bls['hours'] }
$us += @{ id='jolts_openings';label='Vacantes (JOLTS)';             unit='miles';              freq='M'; source='BLS'; points=$bls['jolts_openings'] }

# ---------- EE.UU.: Tesoro (rendimiento 10 anios, promedio mensual) ----------
# Una consulta por mes trae toda la curva; se guardan 3 meses, 2, 10 y 30 anios
$tsy = @{ y3m = New-Pts; y2 = New-Pts; y10 = New-Pts; y30 = New-Pts }
$tsyField = @{ y3m = 'BC_3MONTH'; y2 = 'BC_2YEAR'; y10 = 'BC_10YEAR'; y30 = 'BC_30YEAR' }
for ($i = 59; $i -ge 0; $i--) {
  $m = (Get-Date -Day 1).AddMonths(-$i).ToString('yyyyMM')
  try {
    $x = [xml](Invoke-WebRequest "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=$m" -UseBasicParsing -TimeoutSec 40).Content
    foreach ($k in $tsy.Keys) {
      $vals = @(); foreach ($e in $x.feed.entry) { $v = $e.content.properties.($tsyField[$k]).'#text'; if ($v) { $vals += [double]::Parse($v, $inv) } }
      if ($vals.Count) { Add-Pt $tsy[$k] ("{0}-{1}-01" -f $m.Substring(0,4), $m.Substring(4,2)) (($vals | Measure-Object -Average).Average) }
    }
  } catch { Write-Warning "UST $m : $($_.Exception.Message)" }
}
$us += @{ id='y10'; label='Rendimiento Tesoro 10 anios'; unit='%'; freq='M'; source='US Treasury'; points=$tsy['y10'] }
$us += @{ id='y2';  label='Rendimiento Tesoro 2 anios';  unit='%'; freq='M'; source='US Treasury'; points=$tsy['y2'] }
$us += @{ id='y3m'; label='Rendimiento Tesoro 3 meses';  unit='%'; freq='M'; source='US Treasury'; points=$tsy['y3m'] }
$us += @{ id='y30'; label='Rendimiento Tesoro 30 anios'; unit='%'; freq='M'; source='US Treasury'; points=$tsy['y30'] }
# Pendiente de la curva: 10 anios menos 2 anios (pp)
$y2map = @{}; foreach ($q in $tsy['y2']) { $y2map[$q[0]] = $q[1] }
$curve = New-Pts; foreach ($q in $tsy['y10']) { if ($y2map.ContainsKey($q[0])) { Add-Pt $curve $q[0] ($q[1] - $y2map[$q[0]]) } }
$us += @{ id='curve'; label='Pendiente 10a - 2a'; unit='pp'; freq='M'; source='calculado (US Treasury)'; points=$curve }

# ---------- EE.UU.: deuda publica total (Tesoro, fin de mes) ----------
try {
  $r = Invoke-RestMethod ("https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?fields=record_date,tot_pub_debt_out_amt&filter=record_date:gte:2016-01-01&sort=record_date&page[size]=5000") -TimeoutSec 90
  $g = $r.data | Group-Object { $_.record_date.Substring(0,7) } | Sort-Object Name
  $debt = New-Pts
  foreach ($grp in $g) { $last = $grp.Group | Select-Object -Last 1; Add-Pt $debt ($grp.Name + '-01') ([double]::Parse($last.tot_pub_debt_out_amt, $inv) / 1e9) }
  $us += @{ id='debt'; label='Deuda pública total'; unit='miles de millones de USD'; freq='M'; source='US Treasury (Debt to the Penny)'; points=$debt }
} catch { Write-Warning "DEBT: $($_.Exception.Message)" }

# ---------- EE.UU.: SOFR (NY Fed, promedio mensual) ----------
try {
  $r = Invoke-RestMethod ("https://markets.newyorkfed.org/api/rates/secured/sofr/search.json?startDate=2021-01-01&endDate=$today") -TimeoutSec 60
  $g = $r.refRates | Group-Object { $_.effectiveDate.Substring(0,7) } | Sort-Object Name
  $sofr = New-Pts
  foreach ($grp in $g) { Add-Pt $sofr ($grp.Name + '-01') (($grp.Group | Measure-Object percentRate -Average).Average) }
  $us += @{ id='sofr'; label='SOFR'; unit='%'; freq='M'; source='NY Fed'; points=$sofr }
} catch { Write-Warning "SOFR: $($_.Exception.Message)" }

# ---------- EE.UU.: NY Fed (EFFR, promedio mensual) ----------
try {
  $r = Invoke-RestMethod ("https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json?startDate=2021-01-01&endDate=$today") -TimeoutSec 60
  $g = $r.refRates | Group-Object { $_.effectiveDate.Substring(0,7) } | Sort-Object Name
  $ff = New-Pts
  foreach ($grp in $g) { Add-Pt $ff ($grp.Name + '-01') (($grp.Group | Measure-Object percentRate -Average).Average) }
  $us += @{ id='fedfunds'; label='Tasa efectiva de fondos federales'; unit='%'; freq='M'; source='NY Fed'; points=$ff }
} catch { Write-Warning "NYFED: $($_.Exception.Message)" }

$us += @{ id='gdp'; label='PBI real, var. anual'; unit='%'; freq='A'; source='Banco Mundial'; points=(Get-WB 'USA' 'NY.GDP.MKTP.KD.ZG') }

Restore-Empty $us (Join-Path $out 'usa.json')
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
$dol = @(); $monthly = @{}; $daily = @{}
foreach ($k in $casas.Keys) {
  $pts = New-Pts; $map = [ordered]@{}
  try {
    $r = Invoke-RestMethod "https://api.argentinadatos.com/v1/cotizaciones/dolares/$($casas[$k][1])" -TimeoutSec 60
    # Ultimos 70 dias con dato diario: sirven para la variacion del dia y de 30 dias en las tarjetas
    $dl = New-Pts
    foreach ($row in ($r | Where-Object { $_.venta } | Select-Object -Last 70)) { Add-Pt $dl $row.fecha $row.venta }
    $daily[$k] = $dl
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
Restore-Empty $dol (Join-Path $out 'dolar.json')
@{ country='AR-FX'; updated=$today; quotes=$quotes; daily=$daily; indicators=$dol } | ConvertTo-Json -Depth 6 -Compress | Set-Content (Join-Path $out 'dolar.json') -Encoding utf8
Write-Host "Listo: $out"



