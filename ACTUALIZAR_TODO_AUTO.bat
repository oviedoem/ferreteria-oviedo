@echo off
chcp 1252 >nul
setlocal enabledelayedexpansion
title FERRETERIA OVIEDO - Auto 18:00

:: ============================================================
:: ACTUALIZAR_TODO_AUTO.bat
:: Version no interactiva de ACTUALIZAR_TODO.bat
:: Para uso en Tarea Programada Windows (18:00 diario)
:: Sin pause, sin choice — todo automatico
:: Precios: OCULTOS por defecto (seguro)
:: Log: logs\auto_YYYYMMDD_HH.log
:: ============================================================

:: ============================================================
:: VERIFICACION VPN (FortiClient)
:: Detecta si el adaptador VPN esta activo.
:: Si no: importa perfil desde E: si falta, abre FortiClient
:: y espera hasta 90s. Si no conecta: detiene el pipeline.
:: No usa contrasenas en texto plano — solo el perfil encriptado.
:: ============================================================
echo.
echo  Verificando VPN FortiClient...

powershell -Command "if (Get-NetAdapter | Where-Object {$_.InterfaceDescription -like '*Fortinet*' -and $_.Status -eq 'Up'}) { exit 0 } else { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    echo  [OK] VPN conectada.
    goto :vpn_ok
)

echo  [AVISO] VPN no detectada.

:: Verificar si el perfil Oviedo existe en el registro
reg query "HKCU\Software\Fortinet\FortiClient\Sslvpn\Tunnels\Oviedo" >nul 2>&1
if %errorlevel% neq 0 (
    echo  [INFO] Perfil VPN no encontrado en este equipo.
    if exist "E:\Alejandro\VPN-FortiClient\RESTAURAR-VPN.ps1" (
        echo  [INFO] Importando perfil desde E:\Alejandro\VPN-FortiClient\...
        powershell -ExecutionPolicy Bypass -File "E:\Alejandro\VPN-FortiClient\RESTAURAR-VPN.ps1"
    ) else (
        echo  [ERROR] No se encuentra E:\Alejandro\VPN-FortiClient\
        echo          Conecta el disco USB E: y vuelve a intentarlo.
        pause
        exit /b 1
    )
) else (
    echo  [INFO] Perfil VPN encontrado. Abriendo FortiClient...
    if exist "C:\Program Files\Fortinet\FortiClient\FortiClient.exe" (
        start "" "C:\Program Files\Fortinet\FortiClient\FortiClient.exe"
    ) else (
        echo  [AVISO] FortiClient no encontrado. Conecta la VPN manualmente.
    )
)

:: Modo no interactivo: sin VPN activa el pipeline se cancela con log de error
set _VPNLOG=%~dp0logs\vpn_error_%date:~6,4%%date:~3,2%%date:~0,2%.log
echo [ERROR] VPN no detectada. Pipeline cancelado sin interaccion. >> "%_VPNLOG%"
echo [ERROR] VPN no activa - %date% %time% >> "%_VPNLOG%"
exit /b 1

:: Verificar que la VPN quedo conectada
powershell -Command "if (Get-NetAdapter | Where-Object {$_.InterfaceDescription -like '*Fortinet*' -and $_.Status -eq 'Up'}) { exit 0 } else { exit 1 }" >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] VPN no detectada. Pipeline cancelado sin interaccion. >> "%_VPNLOG%"
    exit /b 1
)
echo  [OK] VPN confirmada.

:vpn_ok
echo.

cd /d "E:\ferreteria-oviedo"

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

:: Construir nombre del log con fecha y hora
set ANIO=%date:~6,4%
set MES=%date:~3,2%
set DIA=%date:~0,2%
set HORA=%time:~0,2%
set HORA=%HORA: =0%
set LOGFILE=E:\ferreteria-oviedo\logs\auto_%ANIO%%MES%%DIA%_%HORA%00.log

echo. > "%LOGFILE%"
echo ============================================================ >> "%LOGFILE%"
echo  FERRETERIA OVIEDO - Actualizacion Auto >> "%LOGFILE%"
echo  %date% %time% >> "%LOGFILE%"
echo ============================================================ >> "%LOGFILE%"
echo. >> "%LOGFILE%"
echo  PYTHON_EXE=%PYTHON_EXE% >> "%LOGFILE%"
echo  NODE_EXE=%NODE_EXE% >> "%LOGFILE%"
echo  FIREBASE_CMD=%FIREBASE_CMD% >> "%LOGFILE%"
echo. >> "%LOGFILE%"

:: -- PASO 1A: Descarga ERP (SSRS Bloque 1 + Bloque 2) --------------------
echo [%time%] PASO 1A - Descarga ERP SSRS 8 bodegas... >> "%LOGFILE%"
"%PYTHON_EXE%" "CATALOGO PRODUCTOS\scripts\descargar_erp.py" >> "%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] descargar_erp.py fallo - continuando con catalogo anterior >> "%LOGFILE%"
) else (
    echo [OK] descargar_erp.py >> "%LOGFILE%"
)

:: -- PASO 1B: Procesar actualizar.xlsx -> Datos.json ----------------------
echo [%time%] PASO 1B - Procesar actualizar.xlsx -^> Datos.json... >> "%LOGFILE%"
"%PYTHON_EXE%" "CATALOGO PRODUCTOS\scripts\procesar-actualizacion.py" >> "%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] procesar-actualizacion.py fallo >> "%LOGFILE%"
    goto :ventas
)
echo [OK] procesar-actualizacion.py >> "%LOGFILE%"

"%PYTHON_EXE%" "CATALOGO PRODUCTOS\scripts\xlsx_a_csv.py" >> "%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] xlsx_a_csv.py fallo >> "%LOGFILE%"
    goto :ventas
)
echo [OK] xlsx_a_csv.py >> "%LOGFILE%"

"%PYTHON_EXE%" "CATALOGO PRODUCTOS\scripts\csv_a_json.py" >> "%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] csv_a_json.py fallo >> "%LOGFILE%"
    goto :ventas
)
echo [OK] csv_a_json.py >> "%LOGFILE%"

:: -- PASO 1C: XLSM -------------------------------------------------------
echo. >> "%LOGFILE%"
echo [%time%] PASO 1C - XLSM... >> "%LOGFILE%"
if exist "VENTAS EL MANZANO\VENTAS.xlsm" (
    "%PYTHON_EXE%" "VENTAS EL MANZANO\leer_xlsm.py" >> "%LOGFILE%" 2>&1
    if %errorlevel% neq 0 (
        echo [AVISO] leer_xlsm.py fallo - continuando sin XLSM >> "%LOGFILE%"
    ) else (
        echo [OK] leer_xlsm.py >> "%LOGFILE%"
    )
) else (
    echo [AVISO] VENTAS.xlsm no encontrado - saltando >> "%LOGFILE%"
)

:: -- PASO 1D: Bodegas SQL Server -----------------------------------------
echo. >> "%LOGFILE%"
echo [%time%] PASO 1D - Bodegas IEM/RCE/CEM SQL Server... >> "%LOGFILE%"
if exist "BODEGAS\descargar_bod.py" (
    "%PYTHON_EXE%" "BODEGAS\descargar_bod.py" >> "%LOGFILE%" 2>&1
    if %errorlevel% neq 0 (
        echo [AVISO] descargar_bod.py fallo - bodegas usan JSON anterior >> "%LOGFILE%"
    ) else (
        echo [OK] descargar_bod.py >> "%LOGFILE%"
    )
)

:: -- PASO 1E: Pedidos comprometidos desde SQL Server -----------------------
echo. >> "%LOGFILE%"
echo [%time%] PASO 1E - Pedidos comprometidos SQL Server... >> "%LOGFILE%"
if exist "BODEGAS\descargar_pedidos.py" (
    "%PYTHON_EXE%" "BODEGAS\descargar_pedidos.py" >> "%LOGFILE%" 2>&1
    if %errorlevel% neq 0 (
        echo [AVISO] descargar_pedidos.py fallo - panel mostrara Ped=0 >> "%LOGFILE%"
    ) else (
        echo [OK] descargar_pedidos.py >> "%LOGFILE%"
    )
) else (
    echo [AVISO] descargar_pedidos.py no encontrado - saltando >> "%LOGFILE%"
)

:: -- PASO 1F: Despachos pendientes desde SQL Server ------------------------
echo. >> "%LOGFILE%"
echo [%time%] PASO 1F - Despachos pendientes SQL Server... >> "%LOGFILE%"
if exist "BODEGAS\descargar_despachos.py" (
    "%PYTHON_EXE%" "BODEGAS\descargar_despachos.py" >> "%LOGFILE%" 2>&1
    if %errorlevel% neq 0 (
        echo [AVISO] descargar_despachos.py fallo - panel mostrara Dif sin drill-down >> "%LOGFILE%"
    ) else (
        echo [OK] descargar_despachos.py >> "%LOGFILE%"
    )
) else (
    echo [AVISO] descargar_despachos.py no encontrado - saltando >> "%LOGFILE%"
)

:: -- PASO 1G: Informe Stock desde CSVs SSRS ----------------------------------
echo. >> "%LOGFILE%"
echo [%time%] PASO 1G - Informe Stock SSRS (fisico + comprometido)... >> "%LOGFILE%"
if exist "BODEGAS\generar_informe_stock.py" (
    "%PYTHON_EXE%" "BODEGAS\generar_informe_stock.py" >> "%LOGFILE%" 2>&1
    if %errorlevel% neq 0 (
        echo [AVISO] generar_informe_stock.py fallo - informe-stock.json no actualizado >> "%LOGFILE%"
    ) else (
        echo [OK] generar_informe_stock.py >> "%LOGFILE%"
    )
) else (
    echo [AVISO] generar_informe_stock.py no encontrado - saltando >> "%LOGFILE%"
)

:: -- PASO 1L: Stock critico ERP (ST_MIN/MAX/REPOSICION desde SQL) ------------
echo. >> "%LOGFILE%"
echo [%time%] PASO 1L - Stock critico ERP (min/max/reposicion) SQL... >> "%LOGFILE%"
if exist "BODEGAS\descargar_stock_critico.py" (
    "%PYTHON_EXE%" "BODEGAS\descargar_stock_critico.py" >> "%LOGFILE%" 2>&1
    if %errorlevel% neq 0 (
        echo [AVISO] descargar_stock_critico.py fallo - Solicitud Semanal usara stock-critico.json anterior >> "%LOGFILE%"
    ) else (
        echo [OK] descargar_stock_critico.py >> "%LOGFILE%"
    )
) else (
    echo [AVISO] descargar_stock_critico.py no encontrado - saltando >> "%LOGFILE%"
)

:: -- PASO 1M: Tiempo de transito proveedor (OC -> GRC/GRT/GIB desde SQL) -----
echo. >> "%LOGFILE%"
echo [%time%] PASO 1M - Tiempo transito proveedor (OC->recepcion) SQL... >> "%LOGFILE%"
if exist "BODEGAS\descargar_oc_leadtime.py" (
    "%PYTHON_EXE%" "BODEGAS\descargar_oc_leadtime.py" >> "%LOGFILE%" 2>&1
    if %errorlevel% neq 0 (
        echo [AVISO] descargar_oc_leadtime.py fallo - Consulta de Stock usara oc-leadtime.json anterior >> "%LOGFILE%"
    ) else (
        echo [OK] descargar_oc_leadtime.py >> "%LOGFILE%"
    )
) else (
    echo [AVISO] descargar_oc_leadtime.py no encontrado - saltando >> "%LOGFILE%"
)

:: -- PASO 1H: Recepciones pendientes + Despachos ERP (Blazor Intranet) ------
echo. >> "%LOGFILE%"
echo [%time%] PASO 1H - Recepciones y Despachos ERP (Blazor)... >> "%LOGFILE%"
if exist "BODEGAS\descargar_blazor_bodegas.py" (
    "%PYTHON_EXE%" "BODEGAS\descargar_blazor_bodegas.py" >> "%LOGFILE%" 2>&1
    if %errorlevel% neq 0 (
        echo [AVISO] descargar_blazor_bodegas.py fallo - tabs Por Recepcionar/Despachar usan datos anteriores >> "%LOGFILE%"
    ) else (
        echo [OK] descargar_blazor_bodegas.py >> "%LOGFILE%"
    )
) else (
    echo [AVISO] descargar_blazor_bodegas.py no encontrado - saltando >> "%LOGFILE%"
)
timeout /t 3 /nobreak > nul

:: -- PASO 1I: Fusionar despachos SQL + ERP -> despachos-panel.json ----------
echo. >> "%LOGFILE%"
echo [%time%] PASO 1I - Fusionar despachos (SQL + ERP)... >> "%LOGFILE%"
if exist "BODEGAS\fusionar_despachos.py" (
    "%PYTHON_EXE%" "BODEGAS\fusionar_despachos.py" >> "%LOGFILE%" 2>&1
    if %errorlevel% neq 0 (
        echo [AVISO] fusionar_despachos.py fallo - panel usara despachos-detalle.json anterior >> "%LOGFILE%"
    ) else (
        echo [OK] fusionar_despachos.py >> "%LOGFILE%"
    )
) else (
    echo [AVISO] fusionar_despachos.py no encontrado - saltando >> "%LOGFILE%"
)

:: -- PASO 1J: Enriquecimiento ventas (rut/sector/razon) desde SQL Server ----
echo. >> "%LOGFILE%"
echo [%time%] PASO 1J - Enriquecimiento ventas (rut/sector) SQL... >> "%LOGFILE%"
if exist "BODEGAS\descargar_ventas_enrich.py" (
    if exist "data\xlsm-enrich.json" (
        copy /Y "data\xlsm-enrich.json" "data\xlsm-enrich.json.bak" >nul
    )
    "%PYTHON_EXE%" "BODEGAS\descargar_ventas_enrich.py" >> "%LOGFILE%" 2>&1
    if %errorlevel% neq 0 (
        echo [AVISO] descargar_ventas_enrich.py fallo - restaurando backup para preservar sectores >> "%LOGFILE%"
        if exist "data\xlsm-enrich.json.bak" (
            copy /Y "data\xlsm-enrich.json.bak" "data\xlsm-enrich.json" >nul
            echo [OK] xlsm-enrich.json restaurado desde backup >> "%LOGFILE%"
        ) else (
            echo [WARN] Sin backup disponible - sector quedara vacio >> "%LOGFILE%"
        )
    ) else (
        echo [OK] descargar_ventas_enrich.py >> "%LOGFILE%"
        copy /Y "data\xlsm-enrich.json" "data\xlsm-enrich.json.bak" >nul
    )
) else (
    echo [AVISO] descargar_ventas_enrich.py no encontrado - saltando >> "%LOGFILE%"
)

:: -- PASO 2: Ventas -------------------------------------------------------
:ventas
echo. >> "%LOGFILE%"
echo [%time%] PASO 2 - Ventas ERP... >> "%LOGFILE%"
"%PYTHON_EXE%" "VENTAS EL MANZANO\main.py" --sin-deploy >> "%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] main.py fallo - panel usara JSON anterior >> "%LOGFILE%"
) else (
    echo [OK] main.py >> "%LOGFILE%"
)

:: -- PASO 3: Precios ocultos (default seguro) ----------------------------
echo. >> "%LOGFILE%"
echo [%time%] PASO 3 - Precios: OCULTOS (auto default)... >> "%LOGFILE%"
"%PYTHON_EXE%" "CATALOGO PRODUCTOS\scripts\actualizar_config_precios.py" false >> "%LOGFILE%" 2>&1

:: -- PASO 3.5: Rotar token de acceso a data/ sensible (seguridad V37.28) --
echo. >> "%LOGFILE%"
echo [%time%] PASO 3.5 - Rotando proteccion de datos sensibles... >> "%LOGFILE%"
"%PYTHON_EXE%" "_utilidades\rotar_token_data.py" >> "%LOGFILE%" 2>&1

:: -- PASO 4: Deploy Firebase ---------------------------------------------
echo. >> "%LOGFILE%"
echo [%time%] PASO 4 - Firebase deploy... >> "%LOGFILE%"
"%NODE_EXE%" update-sw-version.js >> "%LOGFILE%" 2>&1
if exist "E:\nodejs-portable" set PATH=E:\nodejs-portable;%PATH%
call "%FIREBASE_CMD%" deploy --only hosting >> "%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] firebase deploy fallo - revisar autenticacion >> "%LOGFILE%"
) else (
    echo [OK] deploy completo >> "%LOGFILE%"
)

echo. >> "%LOGFILE%"
echo ============================================================ >> "%LOGFILE%"
echo  FINALIZADO: %date% %time% >> "%LOGFILE%"
echo ============================================================ >> "%LOGFILE%"

:: -- Limpiar logs >30 dias ------------------------------------------------
forfiles /p "%~dp0logs" /s /m *.log /d -30 /c "cmd /c del @path" >nul 2>&1
