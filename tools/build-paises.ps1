# ---------------------------------------------------------------------------
# build-paises.ps1  (se corre una sola vez; el resultado queda en data/paises.json)
# Convierte un GeoJSON de paises (Natural Earth, id = codigo ISO3) en un archivo liviano:
# { "ARG": [ [lon,lat,lon,lat,...], ... ] }  con un decimal de precision (~11 km).
# Uso:  powershell -File tools\build-paises.ps1 -Origen ruta\countries.geo.json
# Fuente usada: https://github.com/johan/world.geo.json (dominio publico, Natural Earth)
# ---------------------------------------------------------------------------
param([Parameter(Mandatory = $true)][string]$Origen)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$g = Get-Content $Origen -Raw -Encoding UTF8 | ConvertFrom-Json
$res = [ordered]@{}
foreach ($ft in $g.features) {
  $id = [string]$ft.id
  if ($id -notmatch '^[A-Z]{3}$' -or $id -eq 'ATA') { continue }   # sin Antartida ni territorios sin codigo
  # un Polygon es una lista de anillos; un MultiPolygon, una lista de Polygon (se normaliza a lista de Polygon)
  $polys = New-Object System.Collections.ArrayList
  if ($ft.geometry.type -eq 'Polygon') { [void]$polys.Add($ft.geometry.coordinates) }
  else { foreach ($p in $ft.geometry.coordinates) { [void]$polys.Add($p) } }
  $rings = New-Object System.Collections.ArrayList
  foreach ($poly in $polys) {
    foreach ($ring in $poly) {
      $flat = New-Object System.Collections.ArrayList
      $lx = $null; $ly = $null
      foreach ($pt in $ring) {
        $x = [math]::Round([double]$pt[0], 1); $y = [math]::Round([double]$pt[1], 1)
        if ($x -eq $lx -and $y -eq $ly) { continue }
        [void]$flat.Add($x); [void]$flat.Add($y); $lx = $x; $ly = $y
      }
      if ($flat.Count -ge 6) { [void]$rings.Add($flat) }
    }
  }
  if ($rings.Count -gt 0) { $res[$id] = $rings }
}
$json = $res | ConvertTo-Json -Depth 4 -Compress
[System.IO.File]::WriteAllText((Join-Path $root 'data\paises.json'), $json, (New-Object System.Text.UTF8Encoding($false)))
"{0} paises, {1} KB" -f $res.Count, [math]::Round($json.Length / 1KB)
