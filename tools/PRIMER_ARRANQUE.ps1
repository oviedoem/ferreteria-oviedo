# PRIMER_ARRANQUE.ps1 - Admin - primer boot desde F:
$me = $MyInvocation.MyCommand.Path
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole('Administrator')) {
    Start-Process powershell ('-ExecutionPolicy Bypass -File "' + $me + '"') -Verb RunAs
    exit
}
Write-Host '=== CONFIGURACION INICIAL F: ===' -ForegroundColor Cyan
$root = Split-Path $me -Parent

# 0. USB Selective Suspend OFF -- PRIMERO, antes de todo, evita que el disco se duerma
Write-Host '[0/10] USB Suspend OFF...' -ForegroundColor Yellow
powercfg /setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
powercfg /setdcvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
powercfg /setactive SCHEME_CURRENT

# 1. High Performance + Hibernacion OFF (libera hiberfil.sys ~3GB)
Write-Host '[1/10] Performance...' -ForegroundColor Yellow
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
powercfg /h off

# Pre. Fijar letras USB (E/W/L/M por etiqueta) - WindowStyle Hidden evita ventanas extra
Write-Host '[Pre] Fijando letras USB E/W/L/M...' -ForegroundColor Yellow
$letras = Join-Path $root 'Installers\ASIGNAR_LETRAS.ps1'
if (Test-Path $letras) {
    & powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File $letras
    schtasks /create /tn "AsignarLetrasUSB" /tr "powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$letras`"" /sc onstart /ru SYSTEM /rl HIGHEST /f | Out-Null
}

# Pre2. Reproducir dependencias de perfil para Claude - WindowStyle Hidden
$perfil = Join-Path $root 'Installers\REPRODUCIR_PERFIL.ps1'
if (Test-Path $perfil) {
    & powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File $perfil
}

# 2. KMS
Write-Host '[2/10] KMS...' -ForegroundColor Yellow
cscript //nologo $env:SystemRoot\system32\slmgr.vbs /ipk W269N-WFGWX-YVC9B-4J6C9-T83GX | Out-Null
cscript //nologo $env:SystemRoot\system32\slmgr.vbs /skms kms.srv.crsoo.com:1688 | Out-Null
cscript //nologo $env:SystemRoot\system32\slmgr.vbs /ato

# 3. Startup bloat OFF
Write-Host '[3/10] Startup bloat...' -ForegroundColor Yellow
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "Teams" /f 2>nul
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "com.todesktop.25020447d4kq915" /f 2>nul
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "Microsoft.Lists" /f 2>nul
Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -ErrorAction SilentlyContinue |
    Get-Member -MemberType NoteProperty |
    Where-Object { $_.Name -match 'Edge|Copilot|Comet|todesktop' } |
    ForEach-Object { Remove-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name $_.Name -ErrorAction SilentlyContinue }

# 4. Telemetria OFF
Write-Host '[4/10] Telemetria...' -ForegroundColor Yellow
Stop-Service DiagTrack -Force -ErrorAction SilentlyContinue
Set-Service DiagTrack -StartupType Disabled -ErrorAction SilentlyContinue

# 5. Cuenta local Ferreteria (admin) + deshabilitar cruiz
Write-Host '[5/10] Cuenta...' -ForegroundColor Yellow
if (-not (Get-LocalUser 'Ferreteria' -ErrorAction SilentlyContinue)) {
    New-LocalUser 'Ferreteria' -Password (ConvertTo-SecureString 'Ferreteria2026!' -AsPlainText -Force) -PasswordNeverExpires
    Add-LocalGroupMember -Group 'Administradores' -Member 'Ferreteria' -ErrorAction SilentlyContinue
    Add-LocalGroupMember -Group 'Administrators' -Member 'Ferreteria' -ErrorAction SilentlyContinue
}
Get-LocalUser 'cruiz' -ErrorAction SilentlyContinue | Disable-LocalUser

# 6. Politicas ejecucion + WU auto ON
Write-Host '[6/10] Politicas...' -ForegroundColor Yellow
Set-ExecutionPolicy RemoteSigned -Scope LocalMachine -Force
New-Item 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' -Force | Set-ItemProperty -Name NoAutoUpdate -Value 0

# 7. Bloatware apps OFF
Write-Host '[7/10] Bloatware...' -ForegroundColor Yellow
foreach ($app in @('*Netflix*','*LOLHeadshot*','*CandyCrush*','*king.com*','*Clipchamp*','*BingWeather*','*BingNews*','*ZuneMusic*','*ZuneVideo*','*WindowsMaps*','*Solitaire*','*XboxApp*','*XboxIdentityProvider*','*MicrosoftSolitaireCollection*','*WindowsFeedbackHub*','*SkypeApp*','*3DViewer*')) {
    Get-AppxPackage $app -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue
    Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue |
        Where-Object { $_.PackageName -like $app } |
        Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue
}

# 8. Navegadores - WindowStyle Hidden, sin ventana extra
Write-Host '[8/10] Navegadores...' -ForegroundColor Yellow
$navScript = Join-Path $root 'Installers\INSTALAR_NAVEGADORES.ps1'
if (Test-Path $navScript) {
    & powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File $navScript
}

# 9. VPN FortiClient - WindowStyle Hidden
Write-Host '[9/10] VPN FortiClient VPN-only...' -ForegroundColor Yellow
$vpnScript = Join-Path $root 'Installers\INSTALAR_VPN.ps1'
if (Test-Path $vpnScript) {
    & powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File $vpnScript
}

# 10. Windows Update - SIN AutoReboot para no reiniciar a mitad del setup
# UsoClient eliminado (era redundante y causaba conflicto con PSWindowsUpdate)
Write-Host '[10/10] Actualizaciones (sin reinicio automatico)...' -ForegroundColor Yellow
Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -ErrorAction SilentlyContinue | Out-Null
Install-Module PSWindowsUpdate -Force -ErrorAction SilentlyContinue | Out-Null
Import-Module PSWindowsUpdate -ErrorAction SilentlyContinue
Get-WindowsUpdate -Install -AcceptAll -ErrorAction SilentlyContinue

Write-Host '=== LISTO - reiniciando en 60s ===' -ForegroundColor Green
Write-Host '    Puedes cancelar con: shutdown /a' -ForegroundColor Gray
shutdown /r /t 60 /c "Ferreteria setup completo"
