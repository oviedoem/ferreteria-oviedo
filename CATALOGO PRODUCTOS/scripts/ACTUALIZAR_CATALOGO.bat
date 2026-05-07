@echo off
title FERRETERIA OVIEDO - Actualizar Catalogo
color 0A & cls

echo ============================================================
echo  FERRETERIA OVIEDO - Actualizador de Catalogo
echo  Convierte productos.sql → Datos.csv → Firestore
echo ============================================================
echo.

cd /d "%~dp0"

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no instalado. Descargalo en python.org
    pause & exit /b 1
)

echo  [1] Solo ver cambios (sin modificar archivos)
echo  [2] Actualizar CSV
echo  [3] Salir
echo.
set /p OPC="Opcion (1-3): "

if "%OPC%"=="1" python sql_a_csv.py productos.sql --preview
if "%OPC%"=="2" python sql_a_csv.py productos.sql
if "%OPC%"=="3" exit /b 0

echo.
if "%OPC%"=="2" (
    echo [OK] CSV actualizado en CATALOGO PRODUCTOS/Datos.csv
    echo      Importa a Firestore y recarga el catalogo desde el panel admin.
)
echo.
pause
