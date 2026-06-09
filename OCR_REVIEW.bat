@echo off
chcp 1252 >nul
title OCR Review -- Ferreteria Oviedo

:: ============================================================
:: OCR_REVIEW.bat -- Revision de codigo con open-code-review
:: Uso: Ejecutar antes de cada deploy para auditar los cambios
:: Equivalente Claude Code: /open-code-review
::
:: Flujo:
::   1. Sincroniza E:\ferreteria-oviedo -> E:\git-sync (sin commit)
::   2. OCR revisa cambios no commiteados en E:\git-sync
::   3. Si OK: firebase deploy + ACTUALIZAR_GITHUB.bat (commit+push)
:: ============================================================

set OCR_EXE=ocr
set OCR_NO_UPDATE=1

if exist "E:\nodejs-portable\node.exe" (
    set "PATH=E:\nodejs-portable;E:\npm-global;%PATH%"
)

:: -- Verificar config OCR -----------------------------------------------
if not exist "E:\config\opencodereview\config.json" (
    echo.
    echo [ERROR] No se encontro E:\config\opencodereview\config.json
    echo Verificar junction C:\Users\..\.opencodereview -^> E:\config\opencodereview
    echo.
    pause
    exit /b 1
)

:: -- Verificar que ocr este disponible ----------------------------------
where ocr >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Comando 'ocr' no encontrado en PATH.
    echo Verificar que E:\npm-global este en el PATH.
    echo Instalar con: npm install -g @alibaba-group/open-code-review
    echo.
    pause
    exit /b 1
)

:: ============================================================
:: PASO 1 -- Sincronizar archivos a git-sync (sin commit)
:: ============================================================
echo.
echo [1/3] Sincronizando E:\ferreteria-oviedo -^> E:\git-sync...
echo.

robocopy "E:\ferreteria-oviedo" "E:\git-sync" ^
  panel-admin.html panel-cliente.html index.html ^
  firebase.json firestore.rules firestore.indexes.json storage.rules ^
  sw.js update-sw-version.js firebase-config.js manifest.json ^
  manifest-admin.json manifest-cliente.json ^
  AGENTS.md MEMORY.md ESTADO_PROYECTO.md CLAUDE.md ^
  .gitignore OCR_REVIEW.bat ^
  /NP /NJH /NFL

robocopy "E:\ferreteria-oviedo\.opencodereview" "E:\git-sync\.opencodereview" ^
  rule.json ^
  /NP /NJH /NFL

:: ============================================================
:: PASO 2 -- Ejecutar revision de codigo
:: ============================================================
echo.
echo ============================================================
echo  OPEN CODE REVIEW -- Ferreteria Oviedo El Manzano
echo ============================================================
echo  Revisando cambios no commiteados en E:\git-sync...
echo  Idioma: Spanish  /  Modelo: claude-sonnet-4-6
echo ============================================================
echo.

cd /d E:\git-sync
ocr review --audience human

:: ============================================================
:: PASO 3 -- Decision de deploy
:: ============================================================
echo.
echo ============================================================
echo  REVISION COMPLETADA
echo ============================================================
echo.
echo Errores FO-001/002/003: BLOQUEAN el deploy (seguridad critica)
echo Warnings FO-004+: revisar caso a caso
echo.

set /p DEPLOY="Continuar con deploy + commit? (S=Si, N=Abortar) [N]: "
if /i "%DEPLOY%"=="S" goto :ejecutar_deploy
if /i "%DEPLOY%"=="s" goto :ejecutar_deploy

echo.
echo [ABORTADO] Deploy cancelado. Corrige los hallazgos y vuelve a ejecutar.
echo.
pause
exit /b 0

:ejecutar_deploy
echo.
echo [OK] Ejecutando firebase deploy...
cd /d E:\ferreteria-oviedo
call "E:\npm-global\firebase.cmd" deploy --only hosting
if %errorlevel% neq 0 (
    echo [ERROR] firebase deploy fallo. Revisar autenticacion.
    pause
    exit /b 1
)

echo.
echo [OK] Commiteando y pusheando a GitHub...
call "E:\ferreteria-oviedo\ACTUALIZAR_GITHUB.bat"
exit /b %errorlevel%
