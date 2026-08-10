# generate_catalogo_bot.ps1 — generado desde ACTUALIZAR_TODO.bat (PASO 5)
param(
    [string]$DatosJson   = "E:\ferreteria-oviedo\CATALOGO PRODUCTOS\Datos.json",
    [string]$CatalogoBot = "E:\ferreteria-oviedo\catalogo-bot.json"
)
$d = Get-Content $DatosJson -Raw | ConvertFrom-Json
$c = $d | ForEach-Object { [PSCustomObject]@{
    c  = $_.codigo
    d  = $_.descripcion
    m  = ($_.marca -replace '^\s+|\s+$', '')
    f  = $_.familia
    sf = $_.subfamilia
    hf = $_.hiperfamilia
    p  = $_.precioiva
    pe = $_.pem
    se = $_.sem
} }
[System.IO.File]::WriteAllText($CatalogoBot, ($c | ConvertTo-Json -Compress), [System.Text.Encoding]::UTF8)
Write-Host ("[OK] catalogo-bot.json generado: " + $d.Count + " productos")