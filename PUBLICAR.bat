@echo off
chcp 1252 >nul
title FERRETERIA OVIEDO - Publicar sitio web
cd /d "%~dp0"
color 0A
cls

:: ============================================================
:: RESOLVER HERRAMIENTAS PORTABLES (E: con fallback a PATH/C:)
:: ============================================================
if exist "E:\nodejs-portable\node.exe" (
    set NODE_EXE=E:\nodejs-portable\node.exe
) else (
    set NODE_EXE=node
)
if exist "E:\npm-global\firebase.cmd" (
    set FIREBASE_CMD=E:\npm-global\firebase.cmd
) else (
    set FIREBASE_CMD=firebase
)
if exist "E:\python-portable\python.exe" (
    set PYTHON_EXE=E:\python-portable\python.exe
) else (
    set PYTHON_EXE=python
)

echo.
echo  ============================================================
echo   FERRETERIA OVIEDO - Publicar sitio web
echo  ============================================================
echo.
echo  Presiona cualquier tecla para iniciar el deploy...
echo  (auto-inicio en 10 segundos)
echo.
timeout /t 10 /nobreak >nul

:: -- PASO 1: Firebase CLI -----------------------------------------------------
echo  [1/3] Verificando Firebase CLI...
call "%FIREBASE_CMD%" --version
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [ERROR] Firebase CLI no encontrado.
    echo  Ejecuta: npm install -g firebase-tools
    echo.
    pause
    exit /b 1
)

:: -- PASO 2: Visibilidad precios -----------------------------------------------
echo.
echo  [2/3] Visibilidad de precios en catalogo...
echo  ============================================================
echo   S  =  Precios VISIBLES   (clientes ven el precio)
echo   N  =  Precios OCULTOS    (clientes consultan por WhatsApp)
echo   E  =  NO VISIBLE         (sin cambios - default seguro)
echo   Auto: NO VISIBLE (E) en 10 segundos si no respondes.
echo  ============================================================
echo.
choice /c SNE /t 10 /d E /m "Tu eleccion [S/N/E]"
if errorlevel 3 set PRECIO_OPT=E
if errorlevel 2 set PRECIO_OPT=N
if errorlevel 1 set PRECIO_OPT=S

if /i "%PRECIO_OPT%"=="S" (
    echo  Precio: VISIBLE
    "%PYTHON_EXE%" "%~dp0CATALOGO PRODUCTOS\scripts\actualizar_config_precios.py" --precio visible 2>nul
)
if /i "%PRECIO_OPT%"=="N" (
    echo  Precio: OCULTO
    "%PYTHON_EXE%" "%~dp0CATALOGO PRODUCTOS\scripts\actualizar_config_precios.py" --precio oculto 2>nul
)
if /i "%PRECIO_OPT%"=="E" (
    echo  Precio: NO VISIBLE (sin cambios)
)

:: -- PASO 3: Deploy ------------------------------------------------------------
echo.
echo  [3/3] Ejecutando deploy...
echo  ============================================================

"%NODE_EXE%" "%~dp0update-sw-version.js" 2>nul

call "%FIREBASE_CMD%" deploy --only hosting
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [ERROR] Firebase deploy fallo.
    echo  Ejecuta: firebase login --reauth
    echo.
    pause
    exit /b 1
)

color 0A
echo.
echo  ============================================================
echo   DEPLOY COMPLETADO
echo   URL: https://ferreteria-oviedo.web.app
echo  ============================================================
echo.
pause
