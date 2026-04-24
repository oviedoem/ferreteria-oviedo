@echo off
REM Script de validación del sistema Ferretería Oviedo
echo.
echo ===========================================
echo   VALIDACIÓN SISTEMA FERRETERÍA OVIEDO
echo ===========================================
echo.

echo ✅ Verificando estructura de archivos...
if exist "index.html" echo   ✓ index.html presente
if exist "panel-admin.html" echo   ✓ panel-admin.html presente
if exist "panel-cliente.html" echo   ✓ panel-cliente.html presente
if exist "CATALOGO PRODUCTOS\Datos.csv" echo   ✓ Catálogo CSV presente
if exist "CATALOGO PRODUCTOS\Datos.json" echo   ✓ Catálogo JSON presente
echo.

echo ✅ Verificando configuración GitHub...
powershell -Command "& { $files = Get-ChildItem -Recurse -Include *.html; $hasGithub = $false; foreach ($file in $files) { $content = Get-Content $file.FullName -Raw; if ($content -match 'raw\.githubusercontent\.com') { $hasGithub = $true; break } } if ($hasGithub) { Write-Host '  ✓ URLs de GitHub configuradas' } else { Write-Host '  ⚠️  URLs de GitHub no encontradas' -ForegroundColor Yellow } }"
echo.

echo ✅ Verificando configuración Firebase...
if exist "firebase-config.js" echo   ✓ Archivo de configuración Firebase presente
if exist "firebase-config-ejemplo.js" echo   ✓ Archivo de ejemplo Firebase presente
echo.

echo ✅ Verificando scripts de automatización...
if exist "actualizar-catalogo.bat" echo   ✓ Script de actualización de catálogo presente
if exist "convert-csv-to-json.js" echo   ✓ Script de conversión CSV-JSON presente
echo.

echo 📋 PRÓXIMOS PASOS:
echo 1. Crea un repositorio público en GitHub
echo 2. Sube todos los archivos del proyecto
echo 3. Configura Firebase (ver firebase-config-ejemplo.js)
echo 4. Actualiza las URLs en los archivos HTML con tu usuario/repo de GitHub
echo 5. Prueba las aplicaciones en diferentes navegadores
echo.

echo 🔗 URLs importantes:
echo - Repositorio GitHub: https://github.com/TU_USUARIO/TU_REPO
echo - Firebase Console: https://console.firebase.google.com/
echo - Documentación: Lee el README.md para instrucciones detalladas
echo.

pause