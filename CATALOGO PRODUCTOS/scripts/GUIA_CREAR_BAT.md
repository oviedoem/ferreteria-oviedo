# Guía: Cómo crear un .bat visible en pantalla

Referencia interna — Ferretería Oviedo  
Basada en los archivos `PUBLICAR.bat` y `ACTUALIZAR_Y_PUBLICAR.bat` que funcionan correctamente.

---

## Reglas obligatorias

### 1. Siempre empezar con esto
```bat
@echo off
title NOMBRE DEL BAT
cd /d "%~dp0"
color 0A
```
- `@echo off` — oculta los comandos, solo muestra el output
- `title` — nombre que aparece en la barra de la ventana
- `cd /d "%~dp0"` — cambia al directorio donde está el .bat (SIEMPRE va aquí arriba)
- `color 0A` — texto verde sobre negro (0C = rojo para errores)

### 2. NUNCA usar `mode con cols=X lines=Y`
Ese comando cierra la ventana en algunos contextos de Windows. No usarlo.

### 3. Escapar `|` y `->` dentro de echo
CMD interpreta `|` como pipe y `>` como redirección.
Dentro de un `echo` siempre escapar con `^`:

```bat
echo  ^|  Texto con barras  ^|        ← muestra:  |  Texto con barras  |
echo  archivo.xlsx  -^>  archivo.csv  ← muestra:  archivo.xlsx  ->  archivo.csv
```

### 4. Guardar el archivo en codificación ANSI (Windows-1252)
Si se edita con VS Code u otro editor que guarde en UTF-8, el .bat se cierra sin mostrar nada.

**Para convertir desde PowerShell:**
```powershell
$contenido = [System.IO.File]::ReadAllText("ruta\archivo.bat", [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText("ruta\archivo.bat", $contenido, [System.Text.Encoding]::GetEncoding(1252))
```

**Para verificar que no tiene BOM:**
```powershell
$bytes = [System.IO.File]::ReadAllBytes("ruta\archivo.bat")
Write-Host ("0x{0:X2} 0x{1:X2} 0x{2:X2}" -f $bytes[0], $bytes[1], $bytes[2])
# Debe mostrar: 0x40 0x65 0x63  (@ec = inicio de @echo off)
# Si muestra:   0xEF 0xBB 0xBF  → tiene BOM, hay que reconvertir
```

---

## Modelo completo de .bat

```bat
@echo off
title FERRETERIA OVIEDO - Nombre del proceso
cd /d "%~dp0"
color 0A
cls

echo.
echo  ============================================================
echo   FERRETERIA OVIEDO - Nombre del proceso
echo  ============================================================
echo.
echo  Descripcion de lo que hace este proceso.
echo.
echo  Presiona cualquier tecla para comenzar o cierra para cancelar.
echo.
pause > nul


echo.
echo  +----------------------------------------------------------+
echo  ^|  VERIFICACIONES PREVIAS                                 ^|
echo  +----------------------------------------------------------+
echo.

echo  [CHECK] Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [ERROR] Python no esta instalado.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo         %%v instalado.

echo  [CHECK] Archivo requerido...
if not exist "%~dp0carpeta\archivo.xlsx" (
    color 0C
    echo.
    echo  [ERROR] No se encontro: carpeta\archivo.xlsx
    echo.
    pause
    exit /b 1
)
echo         Encontrado.

echo.
echo  Verificaciones correctas.
echo.
timeout /t 2 /nobreak > nul


echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 1 de 2 - Descripcion del paso                    ^|
echo  +----------------------------------------------------------+
echo.

python "%~dp0carpeta\scripts\mi_script.py"
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [ERROR] PASO 1 fallido.
    echo.
    pause
    exit /b 1
)
echo.
echo  PASO 1 completado.
echo.
timeout /t 2 /nobreak > nul


echo.
echo  +----------------------------------------------------------+
echo  ^|  PASO 2 de 2 - Descripcion del paso                    ^|
echo  +----------------------------------------------------------+
echo.

python "%~dp0carpeta\scripts\otro_script.py"
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  [ERROR] PASO 2 fallido.
    echo.
    pause
    exit /b 1
)
echo.
echo  PASO 2 completado.
echo.


echo.
echo  ============================================================
echo   PROCESO COMPLETADO
echo  ============================================================
echo.
echo   [OK] PASO 1 - Hecho
echo   [OK] PASO 2 - Hecho
echo.
echo  Presiona cualquier tecla para cerrar esta ventana.
pause > nul
```

---

## Patrones de uso frecuente

### Pausa silenciosa (espera sin mensaje)
```bat
pause > nul
```

### Pausa con mensaje del sistema
```bat
pause
```
Muestra: *"Presione una tecla para continuar..."*

### Espera automática N segundos sin interrumpir
```bat
timeout /t 2 /nobreak > nul
```

### Cambiar color a rojo (error) y volver a verde
```bat
color 0C    ← rojo
color 0A    ← verde
```

### Ejecutar Python con ruta relativa al .bat
```bat
python "%~dp0carpeta\scripts\mi_script.py"
```

### Llamar Firebase CLI
```bat
call firebase deploy --only hosting
set EXITCODE=%errorlevel%
if %EXITCODE% neq 0 ( ... )
```
Usar siempre `call` antes de `firebase` porque es un script de Node.js.

### Leer output de un comando en una variable
```bat
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo %%v
```

### Input del usuario
```bat
set /p MI_VAR="  Tu eleccion [S / N / Enter]: "
if /i "%MI_VAR%"=="S" ( ... )
if /i "%MI_VAR%"=="N" ( ... )
```

---

## Resumen de errores comunes

| Error | Causa | Solucion |
|---|---|---|
| Ventana se cierra sin mostrar nada | Codificacion UTF-8 con BOM | Guardar como ANSI (Windows-1252) |
| Ventana se cierra en verificaciones | `^|` sin escapar en echo | Cambiar `\|` por `^\|` en todas las lineas echo con barras |
| Redireccion inesperada a archivo | `->` sin escapar en echo | Cambiar `->` por `-^>` |
| `mode con` cierra la ventana | Incompatibilidad CMD | No usar `mode con` |
| Firebase no reconocido | Falta `call` antes del comando | Usar `call firebase ...` siempre |
