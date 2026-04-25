# Configurar PATH para Node.js y Firebase CLI
$nodePath = "C:\Program Files\nodejs"
$npmPath = "D:\npm-global"

# Agregar al PATH del sistema (requiere permisos de admin)
$envPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if ($envPath -notlike "*$nodePath*") {
    [Environment]::SetEnvironmentVariable("Path", "$envPath;$nodePath", "Machine")
}
if ($envPath -notlike "*$npmPath*") {
    [Environment]::SetEnvironmentVariable("Path", "$envPath;$npmPath", "Machine")
}

# Agregar al PATH de la sesión actual
$env:Path += ";$nodePath;$npmPath"

Write-Host "PATH configurado. Node.js y Firebase CLI ahora están disponibles."
Write-Host "Node version: $(node --version)"
Write-Host "NPM version: $(npm --version)"
Write-Host "Firebase version: $(firebase --version)"
