# generate_catalogo_bot.ps1 - generado desde ACTUALIZAR_TODO.bat (PASO 5)
# 2026-10-13: archivo SOLO ASCII a proposito (Windows PowerShell 5.1 lee .ps1 sin BOM como ANSI). No pegar acentos ni caracteres especiales aqui.
param(
    [string]$DatosJson   = "E:\ferreteria-oviedo\CATALOGO PRODUCTOS\Datos.json",
    [string]$CatalogoBot = "E:\ferreteria-oviedo\catalogo-bot.json"
)
function Limpiar($valor) {
    # El ERP trae ~1.100 textos con espacios dobles/duros/tabs/saltos y 319 marcas con espacio final.
    # Solo se limpian textos; codigo, precio y stock NO se tocan. Las secuencias \uXXXX las interpreta la regex.
    return (([string]$valor) -replace "[\u00A0\u2007\u202F\u200B\uFEFF\t\r\n]", ' ' -replace '\s{2,}', ' ').Trim()
}
# Sin -Encoding UTF8, PowerShell 5.1 lee ANSI y rompia ~764 productos (acentos y enies convertidos en basura).
$d = Get-Content -LiteralPath $DatosJson -Raw -Encoding UTF8 | ConvertFrom-Json
$c = $d | ForEach-Object { [PSCustomObject]@{
    c  = $_.codigo
    d  = Limpiar $_.descripcion
    m  = Limpiar $_.marca
    f  = Limpiar $_.familia
    sf = Limpiar $_.subfamilia
    hf = Limpiar $_.hiperfamilia
    p  = $_.precioiva
    pe = $_.pem
    se = $_.sem
} }
# Guardia: no publicar un catalogo incompleto o con acentos rotos (el BAT omite la publicacion si este script falla).
if ($d.Count -lt 6000) { throw "Catalogo rechazado: solo contiene $($d.Count) productos; se esperaba el catalogo completo." }
$mojibake = @($c | Where-Object { ([string]$_.d + [string]$_.m + [string]$_.f + [string]$_.sf + [string]$_.hf) -match '[\u00C3\u00C2\u00E2]' }).Count
if ($mojibake -gt 0) { throw "Catalogo rechazado: $mojibake registros con texto mal codificado (acentos rotos)." }
[System.IO.File]::WriteAllText($CatalogoBot, ($c | ConvertTo-Json -Compress), [System.Text.UTF8Encoding]::new($false))
Write-Host ("[OK] catalogo-bot.json generado: " + $d.Count + " productos")
