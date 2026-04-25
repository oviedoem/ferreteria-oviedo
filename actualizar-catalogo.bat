@echo off
REM Script para actualizar el catálogo de productos
REM Convierte CSV a JSON automáticamente

echo Actualizando catálogo de productos...
powershell -Command "& { $csv = Import-Csv 'CATALOGO PRODUCTOS\Datos.csv'; $json = $csv | ConvertTo-Json; $json | Out-File 'CATALOGO PRODUCTOS\Datos.json' -Encoding UTF8 -Force }"
echo Catálogo actualizado correctamente.
echo.
echo Recuerda subir los cambios a GitHub para que estén disponibles en línea.
pause