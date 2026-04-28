$nodePath = "C:\Program Files\nodejs"
$npmPath = "D:\npm-global"

$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")

if ($machinePath -notlike "*$nodePath*") {
    $machinePath = "$machinePath;$nodePath"
    [Environment]::SetEnvironmentVariable("Path", $machinePath, "Machine")
}

$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")

if ($machinePath -notlike "*$npmPath*") {
    $machinePath = "$machinePath;$npmPath"
    [Environment]::SetEnvironmentVariable("Path", $machinePath, "Machine")
}

$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")

Write-Host "PATH configurado."
Write-Host "Node version: $(node --version)"
Write-Host "NPM version: $(npm --version)"
Write-Host "Firebase version: $(firebase --version)"
