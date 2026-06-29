@echo off
chcp 1252 >nul
title FERRETERIA OVIEDO - Actualizacion completa
cd /d "%~dp0"
color 0A
cls

:: ============================================================
:: RESOLVER HERRAMIENTAS PORTABLES (E: con fallback a PATH/C:)
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

echo.
echo  ============================================================
echo   FERRETERIA OVIEDO - Actualizacion completa
echo   Precio + Stock + Ventas + Deploy
echo  ============================================================
echo.
echo  Presiona cualquier tecla para iniciar...
echo  (auto-inicio en 10 segundos)
echo.
timeout /t 10 /nobreak >nul

echo.
echo  +----------------------------------------------------------+
echo  ^|  VERIFICACIONES PREVIAS                                 ^|
echo  +----------------------------------------------------------+
echo.

echo  [CHECK] Python...
"%PYTHON_EXE%" --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [ERROR] Python no esta instalado o no esta en el PATH.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('"%PYTHON_EXE%" --version 2^>^&1') do echo         %%v

echo  [CHECK] Firebase CLI...
call "%FIREBASE_CMD%" --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [ERROR] Firebase CLI no encontrado. Ejecuta: npm install -g firebase-tools
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('call "%FIREBASE_CMD%" --version 2^>^&1') do echo         Firebase %%v

echo  [CHECK] Script descargar_erp.py...
if not exist "%~dp0CATALOGO PRODUCTOS\scripts\descargar_erp.py" (
    color 0C
    echo  [ERROR] No se encontro descargar_erp.py
    pause
    exit /b 1
)
echo         OK

echo  [CHECK] Script descargar_ventas_erp.py...
if not exist "%~dp0VENTAS EL MANZANO\descargar_ventas_erp.py" (
    color 0C
    echo  [ERROR] No se encontro descargar_ventas_erp.py
    pause
    exit /b 1
)
echo         OK

echo.
timeout /t 2 /nobreak >nul

:: -- PASO 1A: Descarga ERP (SSRS Bloque 1 + Bloque 2) -------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1A - Descarga ERP: Stock SSRS Bloque1+Bloque2   ^|
echo  +----------------------------------------------------------+
echo.

echo  Descargando desde ERP Justime (8 bodegas, 2 bloques SSRS)...
"%PYTHON_EXE%" "%~dp0CATALOGO PRODUCTOS\scripts\descargar_erp.py"
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [ERROR] descargar_erp.py fallo. Verifica conexion ERP y xToken.
    echo  Continuando con el catalogo anterior si existe...
    color 0A
    timeout /t 3 /nobreak >nul
)

:: -- PASO 1B: Procesar actualizar.xlsx -> Datos.json -------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1B - Procesar: actualizar.xlsx -^> Datos.json    ^|
echo  +----------------------------------------------------------+
echo.
echo  Procesando actualizar.xlsx -^> Datos.xlsx...
"%PYTHON_EXE%" "%~dp0CATALOGO PRODUCTOS\scripts\procesar-actualizacion.py"
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] procesar-actualizacion.py fallo.
    pause
    goto :ventas
)

echo  Convirtiendo Datos.xlsx -^> Datos.csv...
"%PYTHON_EXE%" "%~dp0CATALOGO PRODUCTOS\scripts\xlsx_a_csv.py"
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] xlsx_a_csv.py fallo.
    pause
    goto :ventas
)

echo  Convirtiendo Datos.csv -^> Datos.json...
"%PYTHON_EXE%" "%~dp0CATALOGO PRODUCTOS\scripts\csv_a_json.py"
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] csv_a_json.py fallo.
    pause
    goto :ventas
)

color 0A
echo.
echo  [OK] Precio y stock actualizados.
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 1C: XLSM Servidor 2 --------------------------------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1C - Ventas + Ranking + Precios desde XLSM      ^|
echo  +----------------------------------------------------------+
echo.
echo  Leyendo VENTAS.xlsm, RANKING.xlsm, PRECIOS.xlsm...
echo  (genera ventas-xlsm-YYYY.json, ranking-unidades.json, precios-diff.json)
echo.
if exist "%~dp0VENTAS EL MANZANO\VENTAS.xlsm" (
    "%PYTHON_EXE%" "%~dp0VENTAS EL MANZANO\leer_xlsm.py"
    if %errorlevel% neq 0 (
        color 0C
        echo  [AVISO] leer_xlsm.py fallo. Continuando sin datos XLSM.
        color 0A
    ) else (
        echo  [OK] JSONs XLSM generados.
    )
) else (
    echo  [AVISO] VENTAS.xlsm no encontrado en VENTAS EL MANZANO\ -- saltando paso.
)
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 1D: Bodegas IEM/RCE/CEM desde SQL Server ----------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1D - Bodegas IEM, RCE y CEM desde SQL Server    ^|
echo  +----------------------------------------------------------+
echo.
echo  Descargando registros IEM, RCE y CEM...
echo  (genera bod-iem-registros.json, bod-rce-registros.json, bod-cem-registros.json)
echo.
if exist "%~dp0BODEGAS\descargar_bod.py" (
    "%PYTHON_EXE%" "%~dp0BODEGAS\descargar_bod.py"
    if %errorlevel% neq 0 (
        color 0C
        echo  [AVISO] descargar_bod.py fallo. Bodegas usaran JSON anterior si existe.
        color 0A
    ) else (
        echo  [OK] Bodegas IEM, RCE y CEM actualizadas.
    )
) else (
    echo  [AVISO] descargar_bod.py no encontrado -- saltando paso.
)
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 1E: Pedidos comprometidos desde SQL Server ---------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1E - Pedidos comprometidos (ST_PEDIDO + detalle) ^|
echo  +----------------------------------------------------------+
echo.
echo  Descargando pedidos por producto y bodega...
echo  (genera pedidos-comprometidos.json, pedidos-detalle.json)
echo.
if exist "%~dp0BODEGAS\descargar_pedidos.py" (
    "%PYTHON_EXE%" "%~dp0BODEGAS\descargar_pedidos.py"
    if %errorlevel% neq 0 (
        color 0C
        echo  [AVISO] descargar_pedidos.py fallo. Panel mostrara Ped=0 hasta proximo intento.
        color 0A
    ) else (
        echo  [OK] Pedidos comprometidos actualizados.
    )
) else (
    echo  [AVISO] descargar_pedidos.py no encontrado -- saltando paso.
)
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 1F: Despachos pendientes desde SQL Server ----------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1F - Despachos pendientes (BVE/FVE + detalle)   ^|
echo  +----------------------------------------------------------+
echo.
echo  Descargando despachos pendientes por producto y bodega...
echo  (genera despachos-comprometidos.json, despachos-detalle.json)
echo.
if exist "%~dp0BODEGAS\descargar_despachos.py" (
    "%PYTHON_EXE%" "%~dp0BODEGAS\descargar_despachos.py"
    if %errorlevel% neq 0 (
        color 0C
        echo  [AVISO] descargar_despachos.py fallo. Panel mostrara Dif sin drill-down hasta proximo intento.
        color 0A
    ) else (
        echo  [OK] Despachos pendientes actualizados.
    )
) else (
    echo  [AVISO] descargar_despachos.py no encontrado -- saltando paso.
)
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 1G: Informe Stock desde CSVs SSRS (St_Bod + St_Ped todas sucursales) --
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1G - Informe Stock SSRS (fisico + comprometido)  ^|
echo  +----------------------------------------------------------+
echo.
echo  Generando informe-stock.json desde raw_bloque1/2...
echo  (St_Bod=fisico real, St_DVen+St_Ped=comprometido todas las sucursales)
echo.
if exist "%~dp0BODEGAS\generar_informe_stock.py" (
    "%PYTHON_EXE%" "%~dp0BODEGAS\generar_informe_stock.py"
    if %errorlevel% neq 0 (
        color 0C
        echo  [AVISO] generar_informe_stock.py fallo. Informe Stock mostrara Fis=0 hasta proximo intento.
        color 0A
    ) else (
        echo  [OK] informe-stock.json generado.
    )
) else (
    echo  [AVISO] generar_informe_stock.py no encontrado -- saltando paso.
)
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 1L: Stock critico ERP (ST_MIN/MAX/REPOSICION desde SQL) ---------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1L - Stock critico ERP (min/max/reposicion) SQL  ^|
echo  +----------------------------------------------------------+
echo.
echo  Generando stock-critico.json desde R_STOCK_PRODUCTOS...
echo  (parametros de Adquisiciones para tab Solicitud Semanal de Stock)
echo.
if exist "%~dp0BODEGAS\descargar_stock_critico.py" (
    "%PYTHON_EXE%" "%~dp0BODEGAS\descargar_stock_critico.py"
    if %errorlevel% neq 0 (
        color 0C
        echo  [AVISO] descargar_stock_critico.py fallo. Solicitud Semanal usara stock-critico.json anterior.
        color 0A
    ) else (
        echo  [OK] stock-critico.json generado.
    )
) else (
    echo  [AVISO] descargar_stock_critico.py no encontrado -- saltando paso.
)
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 1M: Tiempo de transito proveedor (OC -> GRC/GRT/GIB desde SQL) ---------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1M - Tiempo transito proveedor (OC->recepcion) SQL ^|
echo  +----------------------------------------------------------+
echo.
echo  Generando oc-leadtime.json (dias OC -> GRC/GRT/GIB por codigo/proveedor)...
echo  (usado en tab Consulta de Stock)
echo.
if exist "%~dp0BODEGAS\descargar_oc_leadtime.py" (
    "%PYTHON_EXE%" "%~dp0BODEGAS\descargar_oc_leadtime.py"
    if %errorlevel% neq 0 (
        color 0C
        echo  [AVISO] descargar_oc_leadtime.py fallo. Consulta de Stock usara oc-leadtime.json anterior.
        color 0A
    ) else (
        echo  [OK] oc-leadtime.json generado.
    )
) else (
    echo  [AVISO] descargar_oc_leadtime.py no encontrado -- saltando paso.
)
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 1H+1I: Blazor Bodegas -- Por Recepcionar + Por Despachar (1 sesion) ---
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1H+1I - Blazor Bodegas (1 sesion Playwright)    ^|
echo  ^|  Por Recepcionar (GRT/GIB) + Por Despachar (tiempo real)^|
echo  +----------------------------------------------------------+
echo.
echo  Descargando ambos tabs en una sola sesion Playwright...
echo  (genera recepciones-pendientes.json + despachos-pendientes-erp.json)
echo.
if exist "%~dp0BODEGAS\descargar_blazor_bodegas.py" (
    "%PYTHON_EXE%" "%~dp0BODEGAS\descargar_blazor_bodegas.py"
    if %errorlevel% neq 0 (
        color 0C
        echo  [AVISO] descargar_blazor_bodegas.py fallo. Tabs Por Recepcionar y Por Despachar usaran datos anteriores.
        color 0A
    ) else (
        echo  [OK] recepciones-pendientes.json + despachos-pendientes-erp.json actualizados.
    )
) else (
    echo  [AVISO] descargar_blazor_bodegas.py no encontrado -- saltando paso.
)
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 1J: Fusion Despachos ERP + SQL -> despachos-panel.json ---------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1J - Fusion Despachos (ERP tiempo real + SQL)   ^|
echo  +----------------------------------------------------------+
echo.
echo  Combinando ERP (tiempo real) + SQL (cliente/RUT/vendedor)...
echo  (genera despachos-panel.json para panel-admin)
echo.
if exist "%~dp0BODEGAS\fusionar_despachos.py" (
    "%PYTHON_EXE%" "%~dp0BODEGAS\fusionar_despachos.py"
    if %errorlevel% neq 0 (
        color 0C
        echo  [AVISO] fusionar_despachos.py fallo. Panel admin usara despachos-detalle.json anterior.
        color 0A
    ) else (
        echo  [OK] despachos-panel.json generado.
    )
) else (
    echo  [AVISO] fusionar_despachos.py no encontrado -- saltando paso.
)
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 1K: Enriquecimiento ventas (rut/sector/razon) desde SQL Server -------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1K - Enriquecimiento ventas (rut/sector) SQL     ^|
echo  +----------------------------------------------------------+
echo.
echo  Generando xlsm-enrich.json desde SQL (reemplaza VENTAS.xlsm manual)...
echo  (rut + razonSocial + sector para ventas-manzano; lo consume main.py)
echo.
if exist "%~dp0BODEGAS\descargar_ventas_enrich.py" (
    REM Guardar backup antes de intentar actualizar
    if exist "%~dp0data\xlsm-enrich.json" (
        copy /Y "%~dp0data\xlsm-enrich.json" "%~dp0data\xlsm-enrich.json.bak" >nul
    )
    "%PYTHON_EXE%" "%~dp0BODEGAS\descargar_ventas_enrich.py"
    if %errorlevel% neq 0 (
        color 0C
        echo  [AVISO] descargar_ventas_enrich.py fallo (SQL no disponible o E: offline).
        echo  Restaurando xlsm-enrich.json desde backup para preservar sectores...
        if exist "%~dp0data\xlsm-enrich.json.bak" (
            copy /Y "%~dp0data\xlsm-enrich.json.bak" "%~dp0data\xlsm-enrich.json" >nul
            echo  [OK] xlsm-enrich.json restaurado -- sectores del ultimo pipeline OK.
        ) else (
            echo  [WARN] Sin backup disponible. El sector quedara vacio en ventas.
        )
        color 0A
    ) else (
        echo  [OK] xlsm-enrich.json actualizado desde SQL.
        REM Mantener backup actualizado tras exito
        copy /Y "%~dp0data\xlsm-enrich.json" "%~dp0data\xlsm-enrich.json.bak" >nul
    )
) else (
    echo  [AVISO] descargar_ventas_enrich.py no encontrado -- saltando paso.
)
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 2: Ventas ------------------------------------------------------------
:ventas
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 2/4 - Ventas desde ERP + JOIN bodegas           ^|
echo  +----------------------------------------------------------+
echo.
echo  Descargando bodegas + ventas y generando JSON (puede tardar 5-8 min)...
echo  (incluye JOIN bodegas-ventas: marca, familia, stock, bodegaCorta)
echo.
"%PYTHON_EXE%" "%~dp0VENTAS EL MANZANO\main.py" --sin-deploy
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [AVISO] main.py fallo. El panel usara el JSON de ventas anterior.
    echo.
    color 0A
    timeout /t 3 /nobreak >nul
) else (
    echo.
    echo  [OK] Ventas actualizadas con enriquecimiento de bodegas.
)
echo.
timeout /t 2 /nobreak >nul

:: -- VALIDACION: JSONs de salida antes de rotar token y deploy -----------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  VALIDACION - Verificando integridad de JSONs generados ^|
echo  +----------------------------------------------------------+
echo.
"%PYTHON_EXE%" "%~dp0validar_jsons.py" || goto :error
echo.
timeout /t 2 /nobreak >nul

:: -- PASO 3: Visibilidad precios -----------------------------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 3/4 - Visibilidad de precios en catalogo         ^|
echo  +----------------------------------------------------------+
echo.
echo   S  =  Precios VISIBLES   (clientes ven el precio)
echo   N  =  Precios OCULTOS    (clientes consultan por WhatsApp)
echo   E  =  NO VISIBLE         (sin cambios - default seguro)
echo.
echo   Auto: Precios OCULTOS (N) en 10 segundos si no respondes.
echo.
choice /c SNE /t 10 /d N /m "Tu eleccion"
if errorlevel 3 set PRECIO_OPT=E
if errorlevel 2 set PRECIO_OPT=N
if errorlevel 1 set PRECIO_OPT=S

if /i "%PRECIO_OPT%"=="S" (
    echo  Precio: VISIBLE para clientes
    "%PYTHON_EXE%" "%~dp0CATALOGO PRODUCTOS\scripts\actualizar_config_precios.py" true 2>nul
)
if /i "%PRECIO_OPT%"=="N" (
    echo  Precio: OCULTO para clientes
    "%PYTHON_EXE%" "%~dp0CATALOGO PRODUCTOS\scripts\actualizar_config_precios.py" false 2>nul
)
if /i "%PRECIO_OPT%"=="E" (
    echo  Precio: NO VISIBLE (sin cambios)
)

echo.
timeout /t 2 /nobreak >nul

:: -- PASO 3.5: Rotar token de acceso a data/ sensible (seguridad V37.28) --------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 3.5 - Rotando proteccion de datos sensibles      ^|
echo  +----------------------------------------------------------+
echo.
"%PYTHON_EXE%" "%~dp0_utilidades\rotar_token_data.py"
if %errorlevel% neq 0 (
    echo  [AVISO] rotar_token_data.py fallo - revisar E:\config\ y Firestore.
)

:: -- PASO 4: Deploy Firebase ---------------------------------------------------
echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 4/4 - Publicando en Firebase Hosting             ^|
echo  +----------------------------------------------------------+
echo.

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
echo   ACTUALIZACION COMPLETA
echo   [OK] Precio y Stock
echo   [OK] Ventas
echo   [OK] Deploy Firebase
echo  ============================================================
echo.
pause
exit /b 0

:error
color 0C
echo.
echo  ============================================================
echo   [ERROR] VALIDACION DE JSONs FALLO -- DEPLOY BLOQUEADO
echo   Revisa el detalle de validar_jsons.py arriba.
echo   El deploy NO se ejecuto. Los JSONs anteriores siguen activos.
echo  ============================================================
echo.
pause
exit /b 1
