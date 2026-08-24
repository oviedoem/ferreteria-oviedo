@echo off
chcp 1252 >nul
title FERRETERIA OVIEDO - Actualizacion XLSM + ERP
cd /d "%~dp0"
color 0A
cls

:: ============================================================
:: RESOLVER HERRAMIENTAS PORTABLES (E: con fallback a PATH)
:: ============================================================
if exist "E:\python-portable\python.exe" (
    set PYTHON_EXE=E:\python-portable\python.exe
) else (
    set PYTHON_EXE=python
)
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
if exist "E:\nodejs-portable\node.exe" set PATH=E:\nodejs-portable;%PATH%

:: Log
set LOG_DIR=%~dp0logs
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
for /f "tokens=1-3 delims=/" %%a in ("%DATE%") do set HOY=%%c%%a%%b
for /f "tokens=1-2 delims=:" %%a in ("%TIME: =0%") do set HORA=%%a%%b
set LOGFILE=%LOG_DIR%\pipeline2_%HOY%_%HORA%.log

echo.
echo  ============================================================
echo   FERRETERIA OVIEDO - ACTUALIZAR TODO 2
echo   XLSM SQL + ERP + Ventas + Deploy
echo  ============================================================
echo.
echo  Log: %LOGFILE%
echo.
echo  Presiona cualquier tecla para iniciar...
echo  (auto-inicio en 10 segundos)
echo.
timeout /t 10 /nobreak >nul

(
echo ============================================================
echo  INICIO: %DATE% %TIME%
echo ============================================================
) >> "%LOGFILE%"

:: ============================================================
:: PASO 0: Cerrar Excel + Descargar datos-app.xlsm via VBScript
:: ============================================================
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 0 - Descarga XLSM: datos-app.xlsm (SQL directo)  ^|
echo  +----------------------------------------------------------+
echo.

tasklist /fi "imagename eq EXCEL.EXE" 2>nul | find /i "EXCEL.EXE" >nul
if not errorlevel 1 (
    echo  Excel abierto - cerrando...
    taskkill /f /im EXCEL.EXE >nul 2>&1
    timeout /t 3 /nobreak >nul
)

if not exist "%~dp0BODEGAS\datos-app.xlsm" (
    color 0C
    echo  [ERROR] datos-app.xlsm no encontrado en BODEGAS\
    echo  [ERROR] datos-app.xlsm no encontrado >> "%LOGFILE%"
    pause
    exit /b 1
)

echo  Ejecutando BajarTodo en datos-app.xlsm (headless)...

set VBS_XLSM=%TEMP%\fo_bajartodobat.vbs
(
echo Dim xl, wb
echo Set xl = CreateObject("Excel.Application"^)
echo xl.Visible = False
echo xl.DisplayAlerts = False
echo Set wb = xl.Workbooks.Open("%~dp0BODEGAS\datos-app.xlsm"^)
echo xl.Run "modFO.BajarTodo"
echo wb.Save
echo wb.Close False
echo xl.Quit
echo WScript.Echo "BajarTodo completado."
) > "%VBS_XLSM%"

cscript //NoLogo "%VBS_XLSM%"
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [ERROR] BajarTodo fallo. Ver datos-app.xlsm manualmente.
    echo  [ERROR] BajarTodo VBS fallo >> "%LOGFILE%"
    choice /c CN /t 30 /d C /m "Continuar de todas formas (C) o cancelar (N)?"
    if errorlevel 2 exit /b 1
    color 0A
) else (
    echo  [OK] datos-app.xlsm descargado y guardado.
    echo  [OK] PASO 0: BajarTodo OK >> "%LOGFILE%"
)
del "%VBS_XLSM%" >nul 2>&1

echo.
timeout /t 5 /nobreak >nul

:: ============================================================
:: PASO 0B: xlsm_a_json.py - Genera JSONs desde datos-app.xlsm
:: Reemplaza: 1D (bod), 1L (stock-critico), 1M (oc-leadtime),
::            1N (oc-pendientes), 1K (xlsm-enrich)
:: ============================================================
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 0B - xlsm_a_json.py (bod/stock-crit/oc/enrich)  ^|
echo  +----------------------------------------------------------+
echo.
echo  Generando JSONs desde datos-app.xlsm...
echo.

if exist "%~dp0BODEGAS\xlsm_a_json.py" (
    "%PYTHON_EXE%" "%~dp0BODEGAS\xlsm_a_json.py"
    if %errorlevel% neq 0 (
        color 0C
        echo  [AVISO] xlsm_a_json.py fallo. Los JSONs anteriores se mantienen.
        echo  [AVISO] PASO 0B: xlsm_a_json.py fallo >> "%LOGFILE%"
        color 0A
    ) else (
        echo  [OK] JSONs generados desde XLSM.
        echo  [OK] PASO 0B: xlsm_a_json.py OK >> "%LOGFILE%"
    )
) else (
    echo  [AVISO] xlsm_a_json.py no encontrado en BODEGAS\
    echo  [AVISO] PASO 0B: xlsm_a_json.py no encontrado >> "%LOGFILE%"
)
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 1A: Descarga ERP (SSRS) -----------------------------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1A - Descarga ERP: Stock SSRS Bloque1+Bloque2   ^|
echo  +----------------------------------------------------------+
echo.
"%PYTHON_EXE%" "%~dp0CATALOGO PRODUCTOS\scripts\descargar_erp.py"
if %errorlevel% neq 0 (
    color 0C
    echo  [AVISO] descargar_erp.py fallo. Continuando con el catalogo anterior...
    echo  [AVISO] PASO 1A: descargar_erp.py fallo >> "%LOGFILE%"
    color 0A
    timeout /t 3 /nobreak >nul
) else (
    echo  [OK] ERP SSRS descargado.
    echo  [OK] PASO 1A OK >> "%LOGFILE%"
)

:: -- PASO 1B: Procesar actualizar.xlsx -> Datos.json ----------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1B - Procesar: actualizar.xlsx -^> Datos.json    ^|
echo  +----------------------------------------------------------+
echo.
"%PYTHON_EXE%" "%~dp0CATALOGO PRODUCTOS\scripts\procesar-actualizacion.py"
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] procesar-actualizacion.py fallo.
    echo  [ERROR] PASO 1B fallo >> "%LOGFILE%"
    pause
    goto :ventas
)
"%PYTHON_EXE%" "%~dp0CATALOGO PRODUCTOS\scripts\xlsx_a_csv.py"
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] xlsx_a_csv.py fallo.
    echo  [ERROR] PASO 1B xlsx_a_csv fallo >> "%LOGFILE%"
    pause
    goto :ventas
)
"%PYTHON_EXE%" "%~dp0CATALOGO PRODUCTOS\scripts\csv_a_json.py"
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] csv_a_json.py fallo.
    echo  [ERROR] PASO 1B csv_a_json fallo >> "%LOGFILE%"
    pause
    goto :ventas
)
color 0A
echo  [OK] Catalogo actualizado.
echo  [OK] PASO 1B OK >> "%LOGFILE%"
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 1C: XLSM Ventas/Ranking/Precios (VENTAS.xlsm) -------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1C - Ventas + Ranking + Precios desde XLSM      ^|
echo  +----------------------------------------------------------+
echo.
if exist "%~dp0VENTAS EL MANZANO\VENTAS.xlsm" (
    "%PYTHON_EXE%" "%~dp0VENTAS EL MANZANO\leer_xlsm.py"
    if %errorlevel% neq 0 (
        color 0C
        echo  [AVISO] leer_xlsm.py fallo. Continuando sin datos XLSM ventas.
        echo  [AVISO] PASO 1C: leer_xlsm.py fallo >> "%LOGFILE%"
        color 0A
    ) else (
        echo  [OK] JSONs XLSM ventas generados.
        echo  [OK] PASO 1C OK >> "%LOGFILE%"
    )
) else (
    echo  [AVISO] VENTAS.xlsm no encontrado -- saltando paso.
)
echo.
timeout /t 8 /nobreak >nul


:: -- PASO 1E: Pedidos comprometidos ---------------------------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1E - Pedidos comprometidos (ST_PEDIDO + detalle) ^|
echo  +----------------------------------------------------------+
echo.
if exist "%~dp0BODEGAS\descargar_pedidos.py" (
    "%PYTHON_EXE%" "%~dp0BODEGAS\descargar_pedidos.py"
    if %errorlevel% neq 0 (
        color 0C
        echo  [AVISO] descargar_pedidos.py fallo.
        echo  [AVISO] PASO 1E fallo >> "%LOGFILE%"
        color 0A
    ) else (
        echo  [OK] Pedidos actualizados.
        echo  [OK] PASO 1E OK >> "%LOGFILE%"
    )
)
echo.
timeout /t 8 /nobreak >nul

:: -- PASO 1F: Despachos pendientes ----------------------------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1F - Despachos pendientes (BVE/FVE + detalle)   ^|
echo  +----------------------------------------------------------+
echo.
if exist "%~dp0BODEGAS\descargar_despachos.py" (
    "%PYTHON_EXE%" "%~dp0BODEGAS\descargar_despachos.py"
    if %errorlevel% neq 0 (
        color 0C
        echo  [AVISO] descargar_despachos.py fallo.
        echo  [AVISO] PASO 1F fallo >> "%LOGFILE%"
        color 0A
    ) else (
        echo  [OK] Despachos actualizados.
        echo  [OK] PASO 1F OK >> "%LOGFILE%"
    )
)
echo.
timeout /t 8 /nobreak >nul

:: -- PASO 1G: Informe Stock SSRS -------------------------------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1G - Informe Stock SSRS (fisico + comprometido)  ^|
echo  +----------------------------------------------------------+
echo.
if exist "%~dp0BODEGAS\generar_informe_stock.py" (
    "%PYTHON_EXE%" "%~dp0BODEGAS\generar_informe_stock.py"
    if %errorlevel% neq 0 (
        color 0C
        echo  [AVISO] generar_informe_stock.py fallo.
        echo  [AVISO] PASO 1G fallo >> "%LOGFILE%"
        color 0A
    ) else (
        echo  [OK] informe-stock.json generado.
        echo  [OK] PASO 1G OK >> "%LOGFILE%"
    )
)
echo.
timeout /t 2 /nobreak >nul


:: -- PASO 1H+1I: incluido en descargar_despachos.py (PASO 1F) -------------------
:: recepciones-pendientes.json y despachos-pendientes-erp.json se generan via SQL
echo  [OK] PASO 1H+1I incluido en PASO 1F (descargar_despachos.py)
echo  [OK] PASO 1H+1I incluido en PASO 1F >> "%LOGFILE%"
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 1J: ELIMINADO 2026-08-20 -----------------------------------------------
:: fusionar_despachos.py archivado. Panel usa despachos-detalle.json (SQL directo).
echo  [OK] PASO 1J omitido
echo.
timeout /t 2 /nobreak >nul


:: -- PASO 2: Ventas (main.py) --------------------------------------------------
:ventas
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 2 - Ventas desde ERP + JOIN bodegas             ^|
echo  +----------------------------------------------------------+
echo.
"%PYTHON_EXE%" "%~dp0VENTAS EL MANZANO\main.py" --sin-deploy
if %errorlevel% neq 0 (
    color 0C
    echo  [AVISO] main.py fallo. El panel usara el JSON de ventas anterior.
    echo  [AVISO] PASO 2: main.py fallo >> "%LOGFILE%"
    color 0A
    timeout /t 3 /nobreak >nul
) else (
    echo  [OK] Ventas actualizadas.
    echo  [OK] PASO 2 OK >> "%LOGFILE%"
)
echo.
timeout /t 2 /nobreak >nul

:: -- VALIDACION -----------------------------------------------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  VALIDACION - Verificando integridad de JSONs          ^|
echo  +----------------------------------------------------------+
echo.
"%PYTHON_EXE%" "%~dp0validar_jsons.py" || goto :error
echo  [OK] Validacion OK >> "%LOGFILE%"
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 3: Visibilidad precios -----------------------------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 3 - Visibilidad de precios en catalogo           ^|
echo  +----------------------------------------------------------+
echo.
echo   S = Precios VISIBLES   N = Precios OCULTOS   E = Sin cambios
echo   Auto: Precios OCULTOS (N) en 10 segundos.
echo.
choice /c SNE /t 10 /d N /m "Tu eleccion"
if errorlevel 3 set PRECIO_OPT=E
if errorlevel 2 set PRECIO_OPT=N
if errorlevel 1 set PRECIO_OPT=S

if /i "%PRECIO_OPT%"=="S" "%PYTHON_EXE%" "%~dp0CATALOGO PRODUCTOS\scripts\actualizar_config_precios.py" true 2>nul
if /i "%PRECIO_OPT%"=="N" "%PYTHON_EXE%" "%~dp0CATALOGO PRODUCTOS\scripts\actualizar_config_precios.py" false 2>nul
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 3.5: Rotar token -----------------------------------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 3.5 - Rotando proteccion de datos sensibles      ^|
echo  +----------------------------------------------------------+
echo.
"%PYTHON_EXE%" "%~dp0_utilidades\rotar_token_data.py"
if %errorlevel% neq 0 (
    echo  [AVISO] rotar_token_data.py fallo - revisar E:\config\
    echo  [AVISO] PASO 3.5 fallo >> "%LOGFILE%"
) else (
    echo  [OK] PASO 3.5 OK >> "%LOGFILE%"
)

:: -- PASO 3.6: Catalogo cotizador -----------------------------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 3.6 - Catalogo cotizador con rotacion v3m/v6m   ^|
echo  +----------------------------------------------------------+
echo.
if exist "%~dp0generar_catalogo_cotizador_rotacion.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0generar_catalogo_cotizador_rotacion.ps1"
    if %errorlevel% neq 0 (
        color 0E
        echo  [AVISO] catalogo-cotizador fallo - se usara el JSON anterior.
        echo  [AVISO] PASO 3.6 fallo >> "%LOGFILE%"
        color 0A
    ) else (
        echo  [OK] catalogo-cotizador.json generado.
        echo  [OK] PASO 3.6 OK >> "%LOGFILE%"
    )
)
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 4: Deploy Firebase ---------------------------------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 4 - Publicando en Firebase Hosting               ^|
echo  +----------------------------------------------------------+
echo.

:: Copiar Datos.json antes del deploy (no esta en git-sync)
if exist "E:\ferreteria-oviedo\CATALOGO PRODUCTOS\Datos.json" (
    echo  Copiando Datos.json a git-sync antes del deploy...
    copy /Y "E:\ferreteria-oviedo\CATALOGO PRODUCTOS\Datos.json" "E:\git-sync\CATALOGO PRODUCTOS\Datos.json" >nul 2>&1
    if %errorlevel% neq 0 (
        color 0E
        echo  [AVISO] No se pudo copiar Datos.json a git-sync.
        color 0A
    )
)

"%NODE_EXE%" "%~dp0update-sw-version.js" 2>nul

call "%FIREBASE_CMD%" deploy --only hosting
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [ERROR] Firebase deploy fallo.
    echo  [ERROR] PASO 4: firebase deploy fallo >> "%LOGFILE%"
    pause
    exit /b 1
)
echo  [OK] PASO 4: deploy OK >> "%LOGFILE%"

:: -- PASO 5: Catalogo Bot -------------------------------------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 5 - Catalogo Bot -^> Firebase Hosting            ^|
echo  +----------------------------------------------------------+
echo.
if not exist "E:\ferreteria-oviedo\CATALOGO PRODUCTOS\Datos.json" goto :paso5_fin

powershell -NoProfile -ExecutionPolicy Bypass -File "E:\ferreteria-oviedo\generate_catalogo_bot.ps1"
if %errorlevel% neq 0 (
    color 0E
    echo  [AVISO] Error generando catalogo-bot.json - paso omitido.
    echo  [AVISO] PASO 5 fallo >> "%LOGFILE%"
    goto :paso5_fin
)

call "%FIREBASE_CMD%" deploy --only hosting --project ferreteria-oviedo
if %errorlevel% neq 0 (
    color 0E
    echo  [AVISO] Firebase deploy catalogo-bot fallo.
    echo  [AVISO] PASO 5 deploy fallo >> "%LOGFILE%"
) else (
    echo  [OK] catalogo-bot.json publicado.
    echo  [OK] PASO 5 OK >> "%LOGFILE%"
)

:paso5_fin

color 0A
echo.
echo  ============================================================
echo   ACTUALIZACION TODO 2 - COMPLETADA
echo   [OK] XLSM SQL (datos-app.xlsm + xlsm_a_json.py)
echo   [OK] ERP SSRS + Catalogo
echo   [OK] Ventas
echo   [OK] Deploy Firebase
echo   [OK] Catalogo Bot
echo  ============================================================
echo.
(
echo ============================================================
echo  FIN: %DATE% %TIME%
echo  RESULTADO: OK
echo ============================================================
) >> "%LOGFILE%"
echo  Log guardado en: %LOGFILE%
echo.
pause
exit /b 0

:error
color 0C
echo.
echo  ============================================================
echo   [ERROR] VALIDACION DE JSONs FALLO -- DEPLOY BLOQUEADO
echo  ============================================================
(
echo [ERROR] VALIDACION fallo - deploy bloqueado
echo  FIN: %DATE% %TIME%
) >> "%LOGFILE%"
echo.
pause
exit /b 1
