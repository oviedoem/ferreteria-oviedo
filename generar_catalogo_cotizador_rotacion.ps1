# generar_catalogo_cotizador_rotacion.ps1
# Lee rotacion v3m/v6m desde SQL Server (Foviedo), merge con Datos.json,
# genera catalogo-cotizador.json con campos v3m/v6m por SKU.
# Creado 2026-08-11 basado en estructura real de M_DOCUMENTOS_DETALLE.
param(
    [string]$DatosJson  = "E:\ferreteria-oviedo\CATALOGO PRODUCTOS\Datos.json",
    [string]$SalidaJson = "E:\ferreteria-oviedo\catalogo-cotizador.json",
    [string]$CredsIni   = "E:\ferreteria-oviedo\credenciales_db.ini",
    [switch]$Deploy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-Ini([string]$path) {
    $h = @{}; $section = ""
    Get-Content $path -Encoding Default | ForEach-Object {
        if ($_ -match '^\[(.+)\]') { $section = $Matches[1].ToLower() }
        elseif ($_ -match '^\s*([^=;#]+?)\s*=\s*(.+?)\s*$') {
            $h["$section.$($Matches[1].ToLower())"] = $Matches[2]
        }
    }
    $h
}

# 1. Credenciales
$ini      = Read-Ini $CredsIni
$seccion  = @("db","database","sql") | Where-Object { $ini.ContainsKey("$_.server") } | Select-Object -First 1
if (-not $seccion) { throw "credenciales_db.ini sin seccion [DB]/[database] con campo 'server'" }
$server   = $ini["$seccion.server"]
$port     = if ($ini["$seccion.port"])     { $ini["$seccion.port"] }     else { "1433" }
$database = if ($ini["$seccion.database"]) { $ini["$seccion.database"] } else { "Foviedo" }
$username = if ($ini["$seccion.user"])     { $ini["$seccion.user"] }     else { $ini["$seccion.username"] }
$password = if ($ini["$seccion.password"]) { $ini["$seccion.password"] } else { $ini["$seccion.pass"] }

# 2. SQL rotacion - sucursal 04 (El Manzano), ventas BVE/FVE/NCE/BVP/FVP
$sql = @"
SELECT
    d.CODIGO_TECNICO                                                               AS codigo,
    SUM(CASE WHEN d.FECHA_EMISION >= DATEADD(month,-3,CAST(GETDATE() AS date))
             THEN CAST(ISNULL(d.CANTIDAD,0) AS INT) ELSE 0 END)                   AS v3m,
    SUM(CAST(ISNULL(d.CANTIDAD,0) AS INT))                                         AS v6m
FROM Foviedo.dbo.M_DOCUMENTOS_DETALLE d
INNER JOIN Foviedo.dbo.M_DOCUMENTOS_ENCABEZADO e
    ON  e.NUMERO     = d.NUMERO
    AND e.IDSUCURSAL = d.IDSUCURSAL
INNER JOIN Foviedo.dbo.M_DOCUMENTOS MD
    ON  MD.IDDOCUMENTO = e.IDDOCUMENTO
WHERE e.IDSUCURSAL = '04'
  AND d.FECHA_EMISION >= DATEADD(month,-6,CAST(GETDATE() AS date))
  AND ISNULL(d.CANTIDAD,0) > 0
  AND MD.DOC IN ('BVE','FVE','NCE','BVP','FVP')
  AND ISNULL(d.CODIGO_TECNICO,'') <> ''
GROUP BY d.CODIGO_TECNICO
HAVING SUM(CAST(ISNULL(d.CANTIDAD,0) AS INT)) > 0
"@

Write-Host "[1/4] Conectando $server,$port -> $database ..."
$connStr = "Server=$server,$port;Database=$database;User Id=$username;Password=$password;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = $sql
$cmd.CommandTimeout = 120
$reader = $cmd.ExecuteReader()

$rotacion = @{}
while ($reader.Read()) {
    $cod = $reader["codigo"].ToString().Trim().ToUpper()
    $rotacion[$cod] = @{ v3m = [int]$reader["v3m"]; v6m = [int]$reader["v6m"] }
}
$reader.Close(); $conn.Close()
Write-Host "    -> $($rotacion.Count) SKUs con ventas en ultimos 6 meses"

# 3. Datos.json
Write-Host "[2/4] Leyendo $DatosJson ..."
$datos = Get-Content $DatosJson -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Host "    -> $($datos.Count) productos"

# 4. Generar catalogo-cotizador.json
Write-Host "[3/4] Generando JSON ..."
$cotizador = $datos | ForEach-Object {
    $cod = $_.codigo.ToString().Trim().ToUpper()
    $rot = $rotacion[$cod]
    $obj = [ordered]@{
        codigo        = $_.codigo
        descripcion   = $_.descripcion
        marca         = ($_.marca -replace '^\s+|\s+$', '')
        familia       = $_.familia
        subfamilia    = $_.subfamilia
        precioiva     = [int]($_.precioiva)
        socioiva      = [int]($_.socioiva)
        costopromedio = [int]($_.costopromedio)
        sem           = [int]($_.sem)
        pem           = [int]($_.pem)
        cd            = [int]($_.cd)
    }
    if ($rot) { $obj["v3m"] = $rot.v3m; $obj["v6m"] = $rot.v6m }
    [PSCustomObject]$obj
}

[System.IO.File]::WriteAllText(
    $SalidaJson,
    ($cotizador | ConvertTo-Json -Compress -Depth 3),
    [System.Text.Encoding]::UTF8
)
$kb     = [math]::Round((Get-Item $SalidaJson).Length / 1KB, 0)
$conRot = ($cotizador | Where-Object { $_.PSObject.Properties.Name -contains 'v3m' }).Count
Write-Host "    -> $($cotizador.Count) prods | $conRot con rotacion | $kb KB"
Write-Host "    -> $SalidaJson"

# 5. Deploy opcional
if ($Deploy) {
    Write-Host "[4/4] firebase deploy --only hosting ..."
    Push-Location "E:\ferreteria-oviedo"
    & "E:\npm-global\firebase.cmd" deploy --only hosting --project ferreteria-oviedo
    Pop-Location
} else {
    Write-Host "[4/4] Omitido. Pasar -Deploy para publicar."
}

Write-Host "[OK] Listo"
