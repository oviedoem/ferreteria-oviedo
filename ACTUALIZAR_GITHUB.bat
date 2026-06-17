@echo off
chcp 1252 >nul
title Commit GitHub -- Ferreteria Oviedo

:: ============================================================
:: HERRAMIENTAS PORTABLES (E: tiene prioridad sobre C:)
:: ============================================================
set PYTHON_EXE=python
set NODE_EXE=node
set GIT_EXE=git
set FIREBASE_EXE=firebase

if exist "E:\python-portable\python.exe" (
    set PYTHON_EXE=E:\python-portable\python.exe
)
if exist "E:\nodejs-portable\node.exe" (
    set NODE_EXE=E:\nodejs-portable\node.exe
    set PATH=E:\nodejs-portable;E:\npm-global\bin;%PATH%
)
if exist "E:\git-portable\mingw64\bin\git.exe" (
    set GIT_EXE=E:\git-portable\mingw64\bin\git.exe
    set PATH=E:\git-portable\mingw64\bin;E:\git-portable\usr\bin;%PATH%
)
if exist "E:\npm-global\firebase.cmd" (
    set FIREBASE_EXE=E:\npm-global\firebase.cmd
) else if exist "E:\npm-global\bin\firebase" (
    set FIREBASE_EXE=E:\npm-global\bin\firebase
)

:: ============================================================
:: BLOQUE 1 - VERIFICACION DE SEGURIDAD (bloquea si hay riesgo)
:: ============================================================
set BLOQUEO=0

if exist "E:\git-sync\*.ini" (
    echo BLOQUEADO: archivo .ini detectado en repo
    set BLOQUEO=1
)
if exist "E:\git-sync\*.env" (
    echo BLOQUEADO: archivo .env detectado en repo
    set BLOQUEO=1
)
if exist "E:\git-sync\credenciales*" (
    echo BLOQUEADO: archivo credenciales detectado en repo
    set BLOQUEO=1
)
if exist "E:\git-sync\users_export.json" (
    echo BLOQUEADO: users_export.json detectado en repo
    set BLOQUEO=1
)
if exist "E:\git-sync\*.xlsm" (
    echo BLOQUEADO: archivo .xlsm detectado en repo
    set BLOQUEO=1
)
if exist "E:\git-sync\*.py" (
    echo BLOQUEADO: archivo .py detectado en repo
    set BLOQUEO=1
)

if %BLOQUEO%==1 (
    echo.
    echo PUSH CANCELADO. Elimina los archivos listados antes de continuar.
    pause
    exit /b 1
)

:: ============================================================
:: BLOQUE 2 - SINCRONIZAR SOLO ARCHIVOS PERMITIDOS
:: ============================================================
robocopy "E:\ferreteria-oviedo" "E:\git-sync" ^
  panel-admin.html panel-cliente.html index.html ^
  firebase.json firestore.rules firestore.indexes.json storage.rules ^
  sw.js update-sw-version.js firebase-config.js manifest.json ^
  manifest-admin.json manifest-cliente.json ^
  AGENTS.md MEMORY.md ESTADO_PROYECTO.md CLAUDE.md ^
  RESUMEN_TECNICO_MIGRACION_E.md MAPA_FLUJO_PROYECTOS.md ^
  .gitignore OCR_REVIEW.bat ^
  /XO /NP /NJH /NFL

robocopy "E:\ferreteria-oviedo\.opencodereview" "E:\git-sync\.opencodereview" ^
  rule.json ^
  /XO /NP /NJH /NFL

:: ============================================================
:: BLOQUE 3 - COMMIT CON TRAZABILIDAD
:: ============================================================
cd /d E:\git-sync

echo.
echo Archivos a commitear:
"%GIT_EXE%" status --short
echo.

set HORA=%time:~0,2%:%time:~3,2%
set FECHA=%date:~6,4%-%date:~3,2%-%date:~0,2%

"%GIT_EXE%" add .
"%GIT_EXE%" commit -m "V37 %FECHA% %HORA% -- actualizacion automatica"
"%GIT_EXE%" pull --rebase

:: Limpiar credenciales viejas y abrir navegador para login fresco
echo url=https://github.com > "%TEMP%\gh_cred.txt"
"%GIT_EXE%" credential reject < "%TEMP%\gh_cred.txt"
del "%TEMP%\gh_cred.txt" >nul 2>&1
echo [INFO] Si abre el navegador, inicia sesion con ferreteriaoviedo.elmanzano@gmail.com

"%GIT_EXE%" push

echo.
echo [OK] Commit subido: V37 %FECHA% %HORA%
echo      Ver en: https://github.com/oviedoem/ferreteria-oviedo/commits
echo.