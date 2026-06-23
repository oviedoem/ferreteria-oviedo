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
  ACTUALIZAR_GITHUB.bat ACTUALIZAR_TODO.bat ACTUALIZAR_TODO_AUTO.bat PUBLICAR.bat ^
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

:: Limpiar credenciales viejas de GitHub
(echo protocol=https& echo host=github.com) | "%GIT_EXE%" credential reject >nul 2>&1

:: Abrir navegador para login GitHub y guardar credenciales nuevas
echo [INFO] Abriendo navegador para login GitHub...
echo [INFO] Inicia sesion con: ferreteriaoviedo.elmanzano@gmail.com
"E:\git-portable\mingw64\bin\git-credential-manager.exe" github login

:: Verificar que la cuenta autenticada sea 'oviedoem' (ferreteriaoviedo.elmanzano)
:: Evita pushear con una sesion de navegador equivocada (ej. alejandrog45)
cmdkey /list | findstr /i "oviedoem" >nul
if errorlevel 1 (
    echo.
    echo BLOQUEADO: no se detecto la cuenta 'oviedoem' en las credenciales de GitHub.
    echo Verifica con: cmdkey /list  ^(target git:https://github.com^)
    echo Vuelve a iniciar sesion con ferreteriaoviedo.elmanzano antes de pushear.
    pause
    exit /b 1
)

"%GIT_EXE%" push

echo.
echo [OK] Commit subido: V37 %FECHA% %HORA%
echo      Ver en: https://github.com/oviedoem/ferreteria-oviedo/commits
echo.