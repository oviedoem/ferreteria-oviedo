# PROMPT PARA CLAUDE CODE — SISTEMA 100% PORTABLE EN E:
# Objetivo: eliminar dependencia de C: para ejecutar el proyecto en cualquier equipo
# Fecha: 2026-06-02
# Proyecto: Ferreteria Oviedo — E:\ferreteria-oviedo\
# Reglas: AGENTS.md + MEMORY.md + Safe Change Protocol

---

## CONTEXTO PARA EL AGENTE

Eres Claude Code trabajando en el proyecto Ferreteria Oviedo (E:\ferreteria-oviedo\).
Lee AGENTS.md y MEMORY.md completos antes de cualquier accion.
Respeta Safe Change Protocol: un prompt = una funcion/archivo tocado.
No tocar firebase-config.js, credenciales_db.ini, credenciales_db.enc, venAdmParseFecha, venAdmFmt.
Deploy: firebase deploy desde E:\ferreteria-oviedo\ (NUNCA GitHub Pages).
Commit al final: ACTUALIZAR_GITHUB.bat con descripcion del cambio.

---

## OBJETIVO PRINCIPAL

Hacer que el sistema completo (pipeline Python, Firebase deploy, Claude Code,
navegadores web) funcione enchufando solo el disco E: a cualquier computador
Windows, sin depender de nada instalado en C:.

Estado actual segun RESUMEN_TECNICO_MIGRACION_E.md:
- Python 3.14: en C:\Python314\ (CRITICO — hace caer todo el pipeline)
- Node.js: en C:\Program Files\nodejs\ (CRITICO — hace caer firebase deploy)
- Git for Windows: en C:\Program Files\Git\ (hace caer ACTUALIZAR_GITHUB.bat)
- Claude Code (.claude\): en C:\Users\Ferreteria Oviedo\.claude\ (no movible directamente)
- Firebase CLI (npm global): ya en E:\npm-global\ (OK)
- Credenciales git (gcm-store): ya en E:\config\gcm-store\ (OK)
- Omnara IDE: ya en E:\omnara\ (OK)
- Tarea Auto18: en Task Scheduler de Windows (C:) — DESACTIVAR en este paso

---

## PASO 0 — Desactivar tarea Auto18 del Task Scheduler

### Objetivo
La tarea FerreteriOviedo-Auto18 esta registrada en el Task Scheduler de Windows
(C:, registro del OS). Si el equipo cambia, la tarea no existe y el pipeline
no se ejecuta automaticamente sin aviso.

La solucion portable es reemplazarla por un BAT que el usuario ejecuta
manualmente o que se lanza desde el propio sistema E: sin depender del
registro de Windows.

### Instrucciones

1. Eliminar la tarea del Task Scheduler:
   ```powershell
   # Verificar que existe primero
   Get-ScheduledTask | Where-Object { $_.TaskName -like "*Ferreteria*" -or $_.TaskName -like "*Oviedo*" } | Select-Object TaskName, State, TaskPath

   # Eliminar la tarea Auto18
   Unregister-ScheduledTask -TaskName "FerreteriOviedo-Auto18" -Confirm:$false
   Write-Host "[OK] Tarea Auto18 eliminada del Task Scheduler"
   ```

2. Tambien eliminar las dos tareas obsoletas que apuntan a D: (si aun existen):
   ```powershell
   Unregister-ScheduledTask -TaskName "Ferreteria Oviedo - Backup Diario" -Confirm:$false -ErrorAction SilentlyContinue
   Unregister-ScheduledTask -TaskName "Ferreteria Oviedo Ventas 7PM" -Confirm:$false -ErrorAction SilentlyContinue
   Write-Host "[OK] Tareas obsoletas D: eliminadas"
   ```

3. Crear E:\EJECUTAR_AUTO.bat como reemplazo portable del scheduler:
   ```bat
   @echo off
   chcp 1252 >nul
   title FERRETERIA OVIEDO - Ejecucion automatica
   cd /d E:\ferreteria-oviedo
   call E:\ferreteria-oviedo\ACTUALIZAR_TODO_AUTO.bat
   ```
   Este bat puede ejecutarse manualmente o registrarse en el Task Scheduler
   del equipo destino usando el script ACTIVAR_EN_ESTE_EQUIPO.bat (PASO 7).

4. Actualizar AGENTS.md: cambiar estado de FerreteriOviedo-Auto18 a ELIMINADO
   y documentar que la ejecucion automatica es ahora responsabilidad de
   ACTIVAR_EN_ESTE_EQUIPO.bat al configurar un equipo nuevo.

### Safe Change Protocol
```
TOCO:    Task Scheduler Windows (eliminar tarea) + crear E:\EJECUTAR_AUTO.bat + AGENTS.md
RAZON:   Eliminar dependencia del registro de Windows (C:) para ejecucion automatica
NO TOCO: ACTUALIZAR_TODO_AUTO.bat (logica interna sin cambios)
         ACTUALIZAR_TODO.bat (sin cambios)
         panel-admin.html (sin cambios)
CHECKLIST:
[ ] Tarea eliminada del Task Scheduler (Get-ScheduledTask no la devuelve)
[ ] E:\EJECUTAR_AUTO.bat creado y llama correctamente a ACTUALIZAR_TODO_AUTO.bat
[ ] AGENTS.md actualizado con estado ELIMINADO para Auto18
[ ] ACTUALIZAR_TODO_AUTO.bat funciona igual que antes (sin modificacion)
```

---

## PASO 1 — Python portable en E:\python-portable\

### Objetivo
Instalar Python embebido (portable) en E:\python-portable\ con todos los paquetes
que usa el pipeline. Ninguna escritura en C:. Ninguna modificacion al PATH del sistema.

### Paquetes requeridos
- pyodbc (SQL Server — descargar_bod.py, descargar_pedidos.py, descargar_despachos.py)
- openpyxl (XLSX — descargar_erp.py, procesar-actualizacion.py, xlsx_a_csv.py)
- requests (HTTP ERP — descargar_erp.py, descargar_ventas_erp.py)
- playwright (navegador headless — descargar_erp.py usa Playwright)
- pandas (procesamiento CSV/Excel — procesar-actualizacion.py)

### Instrucciones para Claude Code

1. Verificar si E:\python-portable\ ya existe con python.exe funcional:
   ```powershell
   if (Test-Path "E:\python-portable\python.exe") {
       & "E:\python-portable\python.exe" --version
   }
   ```

2. Si NO existe, descargar Python embeddable package (3.11 — mas compatible con pyodbc):
   URL: https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip
   Destino: E:\python-portable\
   IMPORTANTE: Pedir confirmacion al usuario antes de descargar (~10MB).

3. Descomprimir en E:\python-portable\

4. Editar python311._pth para habilitar site-packages e importlib:
   - Descomentar la linea: #import site  ->  import site
   - Agregar linea: E:\python-portable\Lib\site-packages

5. Instalar pip en el Python portable:
   ```powershell
   $ProgressPreference = 'SilentlyContinue'
   Invoke-WebRequest https://bootstrap.pypa.io/get-pip.py -OutFile E:\python-portable\get-pip.py
   & "E:\python-portable\python.exe" E:\python-portable\get-pip.py --no-warn-script-location
   ```

6. Instalar paquetes del pipeline:
   ```powershell
   & "E:\python-portable\python.exe" -m pip install pyodbc openpyxl requests pandas --target "E:\python-portable\Lib\site-packages" --no-warn-script-location
   ```

7. Instalar playwright y sus navegadores en E: (no en AppData de C:):
   ```powershell
   $env:PLAYWRIGHT_BROWSERS_PATH = "E:\playwright-browsers"
   & "E:\python-portable\python.exe" -m pip install playwright --target "E:\python-portable\Lib\site-packages"
   & "E:\python-portable\python.exe" -m playwright install chromium
   ```

8. Verificar pyodbc:
   ```powershell
   & "E:\python-portable\python.exe" -c "import pyodbc; print('pyodbc OK:', pyodbc.version)"
   ```

   NOTA ODBC: pyodbc necesita el driver ODBC de SQL Server. Ver PASO WINDOWS-TO-GO
   para la solucion definitiva. En equipo actual, el driver ya esta instalado.

9. Crear E:\python-portable\VERIFICAR_PAQUETES.bat:
   ```bat
   @echo off
   chcp 1252 >nul
   echo Verificando paquetes Python portable...
   E:\python-portable\python.exe -c "import pyodbc; print('[OK] pyodbc', pyodbc.version)"
   E:\python-portable\python.exe -c "import openpyxl; print('[OK] openpyxl', openpyxl.__version__)"
   E:\python-portable\python.exe -c "import requests; print('[OK] requests', requests.__version__)"
   E:\python-portable\python.exe -c "import pandas; print('[OK] pandas', pandas.__version__)"
   E:\python-portable\python.exe -c "import playwright; print('[OK] playwright OK')"
   pause
   ```

---

## PASO 2 — Node.js portable en E:\nodejs-portable\

### Objetivo
Node.js portable (zip, sin instalador) en E:\nodejs-portable\.
Firebase CLI ya esta en E:\npm-global\ — solo necesita apuntar al node.exe correcto.

### Instrucciones para Claude Code

1. Verificar si E:\nodejs-portable\node.exe ya existe:
   ```powershell
   if (Test-Path "E:\nodejs-portable\node.exe") {
       & "E:\nodejs-portable\node.exe" --version
   }
   ```

2. Si NO existe, descargar Node.js portable (LTS, zip, 64-bit):
   URL: https://nodejs.org/dist/v22.16.0/node-v22.16.0-win-x64.zip
   Destino: E:\nodejs-portable\
   IMPORTANTE: Pedir confirmacion al usuario antes de descargar (~30MB).

3. Descomprimir en E:\nodejs-portable\
   El zip tiene una carpeta interna (node-v22.x.x-win-x64\) — mover su contenido
   directamente a E:\nodejs-portable\ para que node.exe quede en la raiz.

4. Verificar firebase CLI con el nuevo node:
   ```powershell
   $env:PATH = "E:\nodejs-portable;E:\npm-global\bin;" + $env:PATH
   & "E:\nodejs-portable\node.exe" "E:\npm-global\bin\firebase" --version
   ```

5. Si firebase falla, verificar npm global prefix:
   ```powershell
   & "E:\nodejs-portable\npm.cmd" config get prefix
   # Debe mostrar E:\npm-global
   # Si no: & "E:\nodejs-portable\npm.cmd" config set prefix "E:\npm-global"
   ```

---

## PASO 3 — Git portable en E:\git-portable\

### Objetivo
Git portable en E:\git-portable\ para que ACTUALIZAR_GITHUB.bat no dependa
de C:\Program Files\Git\.

### Instrucciones para Claude Code

1. Verificar si E:\git-portable\bin\git.exe existe:
   ```powershell
   if (Test-Path "E:\git-portable\bin\git.exe") {
       & "E:\git-portable\bin\git.exe" --version
   }
   ```

2. Si NO existe, descargar Git portable (PortableGit, 64-bit):
   URL: https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/PortableGit-2.47.1-64-bit.7z.exe
   Destino descarga: E:\git-portable-setup.exe
   IMPORTANTE: Pedir confirmacion al usuario antes de descargar (~50MB).

3. Ejecutar autoextractor silencioso:
   ```powershell
   Start-Process "E:\git-portable-setup.exe" -ArgumentList "-o`"E:\git-portable`" -y" -Wait
   ```

4. Verificar y configurar credenciales:
   ```powershell
   & "E:\git-portable\bin\git.exe" --version
   & "E:\git-portable\bin\git.exe" -C "E:\git-sync" log --oneline -3
   & "E:\git-portable\bin\git.exe" config --global credential.helper manager
   ```

---

## PASO 4 — Actualizar BATs para usar herramientas portables de E:

### Objetivo
Los BATs del proyecto deben preferir las herramientas de E: si existen,
y caer en las de C: solo si no hay alternativa portable.

### Bloque de deteccion a agregar al inicio de cada BAT

Agregar ANTES de los checks existentes en:
- ACTUALIZAR_TODO.bat
- ACTUALIZAR_TODO_AUTO.bat
- PUBLICAR.bat
- ACTUALIZAR_GITHUB.bat

```bat
:: ============================================================
:: HERRAMIENTAS PORTABLES (E: tiene prioridad sobre C:)
:: ============================================================
set PYTHON_EXE=python
set NODE_EXE=node
set GIT_EXE=git
set FIREBASE_EXE=firebase

if exist "E:\python-portable\python.exe" (
    set PYTHON_EXE=E:\python-portable\python.exe
    echo  [PORTABLE] Python desde E:\python-portable\
)
if exist "E:\nodejs-portable\node.exe" (
    set NODE_EXE=E:\nodejs-portable\node.exe
    set PATH=E:\nodejs-portable;E:\npm-global\bin;%PATH%
    echo  [PORTABLE] Node.js desde E:\nodejs-portable\
)
if exist "E:\git-portable\bin\git.exe" (
    set GIT_EXE=E:\git-portable\bin\git.exe
    set PATH=E:\git-portable\bin;E:\git-portable\usr\bin;%PATH%
    echo  [PORTABLE] Git desde E:\git-portable\
)
if exist "E:\npm-global\bin\firebase" (
    set FIREBASE_EXE=%NODE_EXE% E:\npm-global\bin\firebase
    echo  [PORTABLE] Firebase CLI desde E:\npm-global\bin\
)
echo.
```

Reemplazar en cada BAT: `python` → `%PYTHON_EXE%`, `firebase` → `%FIREBASE_EXE%`,
`node` → `%NODE_EXE%`, `git` → `%GIT_EXE%`.

### Safe Change Protocol
```
TOCO:    ACTUALIZAR_TODO.bat, ACTUALIZAR_TODO_AUTO.bat, PUBLICAR.bat, ACTUALIZAR_GITHUB.bat
         (un prompt por archivo — cuatro prompts separados)
RAZON:   Permitir ejecucion sin Python/Node/Git en C:
NO TOCO: logica de pasos 1A-1G, PASO 2, PASO 3, PASO 4 (solo el ejecutor cambia)
CHECKLIST por BAT:
[ ] Bloque HERRAMIENTAS PORTABLES al inicio
[ ] Todas las llamadas a python reemplazadas por %PYTHON_EXE%
[ ] Todas las llamadas a firebase reemplazadas por %FIREBASE_EXE%
[ ] Si E:\python-portable no existe, sigue usando python de C: como fallback
```

---

## PASO 5 — Navegadores portables en E:\navegadores-portables\

### Objetivo
Tener Chrome y Firefox portables en E: para abrir el panel sin depender
del navegador instalado en C:.

### Chrome portable (Chromium interactivo)
1. Descargar Chromium portable desde: https://chromium.woolyss.com/
   Version: latest stable, Win64, portable ZIP
   Destino: E:\navegadores-portables\chromium\
2. Perfil en E: (no en C:\Users\...):
   Lanzar siempre con: chrome.exe --user-data-dir="E:\navegadores-portables\chromium-perfil"

### Firefox portable
1. Descargar desde: https://portableapps.com/apps/internet/firefox_portable
   Destino: E:\navegadores-portables\firefox\
2. El perfil queda dentro de la carpeta portable (no toca C:).

### Crear accesos directos portables
Crear E:\ABRIR_PANEL_ADMIN.bat:
```bat
@echo off
chcp 1252 >nul
set PANEL_URL=https://ferreteria-oviedo.web.app/panel-admin
if exist "E:\navegadores-portables\chromium\chrome.exe" (
    start "" "E:\navegadores-portables\chromium\chrome.exe" --user-data-dir="E:\navegadores-portables\chromium-perfil" "%PANEL_URL%"
    exit /b
)
if exist "E:\navegadores-portables\firefox\FirefoxPortable.exe" (
    start "" "E:\navegadores-portables\firefox\FirefoxPortable.exe" "%PANEL_URL%"
    exit /b
)
start "" "%PANEL_URL%"
```
Crear E:\ABRIR_PANEL_CLIENTE.bat con /panel-cliente.
Crear E:\ABRIR_PANEL_VENDEDOR.bat con la URL base.

---

## PASO 6 — Claude Code portable (junction .claude -> E:\claude-config\)

### Objetivo
Que la configuracion de Claude Code viva en E: via NTFS junction.
Claude Code crea siempre C:\Users\<usuario>\.claude\ pero con el junction
lee y escribe en E:\claude-config\ sin saberlo.

### Instrucciones

```powershell
$src = "C:\Users\$env:USERNAME\.claude"
$dst = "E:\claude-config"

# Copiar contenido actual a E: si existe
if (Test-Path $src) {
    if (-not (Get-Item $src -Force).Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)) {
        Copy-Item -Path $src -Destination $dst -Recurse -Force
        Rename-Item -Path $src -NewName ".claude_backup_$(Get-Date -Format 'yyyyMMdd')"
        Write-Host "Backup creado, copiando a E:\claude-config"
    } else {
        Write-Host ".claude ya es junction — OK"
    }
}
if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst | Out-Null }

# Crear junction
cmd /c "mklink /J `"$src`" `"$dst`""
Write-Host "[OK] Junction: $src -> $dst"
```

En equipo nuevo: ejecutar este mismo bloque. Claude Code funciona con la misma
configuracion sin copiar nada adicional.

---

## PASO 7 — Windows To Go en particion del disco E: (solucion ODBC + .NET)

### Contexto — por que Windows To Go resuelve ODBC y .NET

Los dos componentes que no se pueden portar como archivos simples son:
- ODBC Driver 17 for SQL Server: DLL del sistema registrada en el registro de Windows
- .NET Framework: componente del OS, registro de Windows

La solucion definitiva es tener un Windows completo arrancable desde el mismo disco E:.
Al bootear desde E:, ese Windows tiene su propio registro y se puede instalar
el ODBC Driver y cualquier otro componente del sistema directamente en E:.

### Herramienta recomendada: Rufus (Windows To Go mode)
- Gratis, open source, sin instalador
- URL: https://rufus.ie/
- Tamanio: ~1.5MB
- Modo: Windows To Go (escribe Windows directamente en particion del disco)

### Prerequisitos
- ISO de Windows 11 o Windows 10 (descargar con Media Creation Tool de Microsoft)
- Disco E: debe tener al menos 64GB libres para la particion Windows To Go
- Recomendado: SSD NVMe en enclosure USB 3.2 Gen2 (10Gbps) o Thunderbolt
  para velocidad aceptable (lectura 800+ MB/s). Un disco HDD o USB 2.0 es demasiado lento.

### Esquema de particiones propuesto para el disco E:

```
DISCO E: (ej. 1TB SSD externo)
┌─────────────────────────────────────────────────────────────┐
│  Particion 1: EFI System Partition (ESP) — 100MB            │
│  (necesaria para bootear Windows To Go)                     │
├─────────────────────────────────────────────────────────────┤
│  Particion 2: Windows To Go — 128GB                         │
│  Windows 11/10 completo arrancable                          │
│  Aqui se instala: ODBC Driver 17, .NET, Task Scheduler,     │
│  Python (si se quiere instalar "normal"), Node.js, etc.     │
├─────────────────────────────────────────────────────────────┤
│  Particion 3: Datos del proyecto — resto del disco          │
│  Letra E: cuando se usa en modo "disco de datos"            │
│  E:\ferreteria-oviedo\, E:\APP-INVENTARIO\, E:\omnara\, ... │
└─────────────────────────────────────────────────────────────┘
```

IMPORTANTE: Rufus puede crear la particion Windows To Go sin destruir la particion
de datos existente si hay espacio libre no asignado. Si el disco no tiene espacio
libre, hay que reducir la particion de datos primero desde Administracion de discos.

### Instrucciones — Claude Code ejecuta esto como guia interactiva

1. Verificar espacio libre en el disco E:
   ```powershell
   Get-PSDrive E | Select-Object Used, Free
   # Free debe ser >= 137438953472 (128GB) para la particion WTG
   ```

2. Descargar Rufus a E: (no a C:):
   URL directa ultima version: https://github.com/pbatard/rufus/releases/latest
   Buscar: rufus-X.XX.exe (sin "p" — version normal, no portable en este caso son identicas)
   Destino: E:\herramientas\rufus.exe
   IMPORTANTE: Pedir confirmacion al usuario antes de descargar.

3. Descargar ISO Windows 11:
   Opcion A (oficial Microsoft): https://www.microsoft.com/software-download/windows11
   Opcion B: Media Creation Tool genera la ISO automaticamente
   Destino: E:\herramientas\windows11.iso (~5.5GB)
   IMPORTANTE: Pedir confirmacion al usuario antes de descargar.

4. Claude Code NO puede ejecutar Rufus (es GUI). Dar instrucciones al usuario:
   ```
   INSTRUCCIONES MANUALES PARA EL USUARIO:
   a) Abrir E:\herramientas\rufus.exe (no requiere instalacion)
   b) En "Dispositivo": seleccionar el disco E: (CUIDADO: seleccionar el disco correcto)
   c) En "Tipo de arranque": seleccionar "Imagen de disco o ISO" -> elegir windows11.iso
   d) En "Opcion de imagen": seleccionar "Windows To Go"
   e) En "Esquema de particion": GPT
   f) Hacer clic en "EMPEZAR"
   g) Rufus creara una particion nueva en el espacio libre sin borrar la existente
   ```

5. Tras completar Rufus, bootear desde el disco E: (cambiar boot order en BIOS/UEFI)
   y completar el setup de Windows normalmente.

6. Dentro del Windows To Go, instalar los componentes del sistema:
   ```
   DENTRO DEL WINDOWS TO GO (al bootear desde E:):
   a) ODBC Driver 17: descargar e instalar desde
      https://go.microsoft.com/fwlink/?linkid=2187214
      Tamanio: ~6MB — queda registrado en el Windows To Go, no en el host
   b) .NET Framework: ya incluido en Windows 11 — no requiere instalacion adicional
   c) Task Scheduler: nativo del OS — crear la tarea Auto18 con ACTIVAR_EN_ESTE_EQUIPO.bat
   d) Python "normal" (opcional): instalar en C: del Windows To Go
      Esa "C:" solo existe cuando se bootea desde E: — no interfiere con el host
   ```

### Limitaciones conocidas de Windows To Go a documentar en AGENTS.md
- Activacion: Windows To Go puede requerir re-activacion al cambiar de equipo fisico
  (licencia OEM vinculada al hardware). Solucion: usar licencia Retail o cuenta Microsoft.
- Drivers: al conectar en un equipo diferente, Windows To Go descarga drivers nuevos
  la primera vez (~5 min). Los drivers quedan guardados en la particion WTG.
- Velocidad: requiere SSD en enclosure USB 3.2 Gen2 o Thunderbolt para ser usable.
  Con USB 2.0 o HDD la experiencia es muy lenta (no recomendado).
- Secure Boot: algunos equipos con Secure Boot activado pueden rechazar el boot
  desde disco externo. Solucion: deshabilitar Secure Boot en BIOS antes de bootear.
- Fast Startup de Windows: deshabilitar en el host antes de bootear desde E:
  (Panel de control -> Opciones de energia -> Elegir el comportamiento de los botones
  de inicio/apagado -> desactivar Inicio rapido).

---

## PASO 8 — Script maestro ACTIVAR_EN_ESTE_EQUIPO.bat

### Objetivo
Un solo bat que, al enchufar el disco E: en un equipo nuevo, configure
el entorno minimo para que todo funcione sin bootear desde el Windows To Go.

### Archivo: E:\ACTIVAR_EN_ESTE_EQUIPO.bat

```bat
@echo off
chcp 1252 >nul
title ACTIVAR FERRETERIA OVIEDO EN ESTE EQUIPO
color 0B
cls

echo.
echo  ================================================================
echo   ACTIVACION FERRETERIA OVIEDO -- DISCO E: PORTABLE
echo   Ejecutar UNA VEZ por equipo. Requiere derechos de administrador.
echo  ================================================================
echo.
pause

:: 1. Junction .claude
echo [1/7] Configurando Claude Code (.claude -> E:\claude-config)...
if not exist "E:\claude-config" mkdir "E:\claude-config"
set CLAUDE_PATH=C:\Users\%USERNAME%\.claude
if exist "%CLAUDE_PATH%" (
    powershell -command "if(-not (Get-Item '%CLAUDE_PATH%' -Force).Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)){ Rename-Item '%CLAUDE_PATH%' '.claude_backup' }"
)
if not exist "%CLAUDE_PATH%" (
    cmd /c "mklink /J "%CLAUDE_PATH%" "E:\claude-config""
    echo      [OK] Junction creado.
) else (
    echo      [OK] Junction ya existe.
)

:: 2. OMNARA_HOME
echo [2/7] OMNARA_HOME = E:\omnara\home...
powershell -command "[System.Environment]::SetEnvironmentVariable('OMNARA_HOME','E:\omnara\home','User')"
echo      [OK]

:: 3. XDG_CONFIG_HOME
echo [3/7] XDG_CONFIG_HOME = E:\config...
powershell -command "[System.Environment]::SetEnvironmentVariable('XDG_CONFIG_HOME','E:\config','User')"
echo      [OK]

:: 4. PLAYWRIGHT_BROWSERS_PATH
echo [4/7] PLAYWRIGHT_BROWSERS_PATH = E:\playwright-browsers...
powershell -command "[System.Environment]::SetEnvironmentVariable('PLAYWRIGHT_BROWSERS_PATH','E:\playwright-browsers','User')"
echo      [OK]

:: 5. npm prefix
echo [5/7] npm prefix -> E:\npm-global...
if exist "E:\nodejs-portable\npm.cmd" (
    call "E:\nodejs-portable\npm.cmd" config set prefix "E:\npm-global" 2>nul
    echo      [OK]
) else (
    echo      [AVISO] Node portable no encontrado. Instalar en PASO 2.
)

:: 6. Tarea Auto18 (re-registrar en este equipo)
echo [6/7] Re-registrando tarea Auto18 en Task Scheduler de este equipo...
schtasks /create /tn "FerreteriOviedo-Auto18" /tr "E:\ferreteria-oviedo\ACTUALIZAR_TODO_AUTO.bat" /sc daily /st 18:00 /f /rl highest 2>nul
if %errorlevel%==0 (
    echo      [OK] Tarea Auto18 creada (18:00 diario)
) else (
    echo      [AVISO] No se pudo crear la tarea. Crear manualmente si se necesita.
)

:: 7. ODBC Driver check
echo [7/7] Verificando ODBC Driver 17 for SQL Server...
reg query "HKLM\SOFTWARE\ODBC\ODBCINST.INI\ODBC Driver 17 for SQL Server" >nul 2>&1
if %errorlevel%==0 (
    echo      [OK] ODBC Driver 17 ya instalado en este equipo.
) else (
    echo      [FALTA] ODBC Driver 17 no encontrado.
    echo      Descargar e instalar (~6MB):
    echo      https://go.microsoft.com/fwlink/?linkid=2187214
    echo      (o bootear desde Windows To Go en E: donde ya esta instalado)
)

echo.
echo  ================================================================
echo   ACTIVACION COMPLETADA
echo   Reiniciar sesion o equipo para que las variables tomen efecto.
echo  ================================================================
echo.
pause
```

---

## ORDEN DE EJECUCION RECOMENDADO (un PASO por sesion en Claude Code)

1. **PASO 0** — Eliminar tarea Auto18 del Task Scheduler (inmediato, sin riesgo)
2. **PASO 1** — Python portable (critico del pipeline)
3. **PASO 2** — Node.js portable (critico para firebase deploy)
4. **PASO 3** — Git portable (para ACTUALIZAR_GITHUB.bat)
5. **PASO 4** — Actualizar BATs (cuatro prompts separados, uno por BAT)
6. **PASO 6** — Junction .claude (portabilidad Claude Code)
7. **PASO 5** — Navegadores portables (comodidad)
8. **PASO 7** — Windows To Go (solucion definitiva ODBC + .NET — requiere accion manual del usuario)
9. **PASO 8** — Script ACTIVAR_EN_ESTE_EQUIPO.bat (cierre del sistema)

---

## VERIFICACION FINAL (ejecutar tras todos los pasos)

```powershell
Write-Host "=== VERIFICACION SISTEMA PORTABLE E: ===" -ForegroundColor Cyan
$py = "E:\python-portable\python.exe"
if (Test-Path $py) { $v = & $py --version 2>&1; Write-Host "[OK] Python: $v" -ForegroundColor Green }
else { Write-Host "[FALTA] Python portable" -ForegroundColor Red }

$node = "E:\nodejs-portable\node.exe"
if (Test-Path $node) { $v = & $node --version 2>&1; Write-Host "[OK] Node.js: $v" -ForegroundColor Green }
else { Write-Host "[FALTA] Node.js portable" -ForegroundColor Red }

$git = "E:\git-portable\bin\git.exe"
if (Test-Path $git) { $v = & $git --version 2>&1; Write-Host "[OK] Git: $v" -ForegroundColor Green }
else { Write-Host "[FALTA] Git portable" -ForegroundColor Red }

$fb = "E:\npm-global\bin\firebase"
if (Test-Path $fb) {
    $env:PATH = "E:\nodejs-portable;" + $env:PATH
    $v = & $node $fb --version 2>&1; Write-Host "[OK] Firebase CLI: $v" -ForegroundColor Green
} else { Write-Host "[FALTA] Firebase CLI" -ForegroundColor Red }

if (Test-Path "E:\omnara\bin\omnara.cmd") { Write-Host "[OK] Omnara" -ForegroundColor Green }
else { Write-Host "[FALTA] Omnara" -ForegroundColor Red }

$cl = "C:\Users\$env:USERNAME\.claude"
if (Test-Path $cl) {
    if ((Get-Item $cl -Force).Attributes -match "ReparsePoint") {
        Write-Host "[OK] .claude -> junction E:\claude-config\" -ForegroundColor Green
    } else { Write-Host "[AVISO] .claude existe pero NO es junction" -ForegroundColor Yellow }
}

reg query "HKLM\SOFTWARE\ODBC\ODBCINST.INI\ODBC Driver 17 for SQL Server" >nul 2>&1
if ($LASTEXITCODE -eq 0) { Write-Host "[OK] ODBC Driver 17 instalado" -ForegroundColor Green }
else { Write-Host "[INFO] ODBC Driver 17 solo disponible en Windows To Go (PASO 7)" -ForegroundColor Yellow }

Get-ScheduledTask -TaskName "FerreteriOviedo-Auto18" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "[OK] Tarea Auto18: $($_.State)" -ForegroundColor Green
}

Write-Host "`n=== FIN VERIFICACION ===" -ForegroundColor Cyan
```

---

*Generado 2026-06-02 — Proyecto Ferreteria Oviedo V37.14*
*Safe Change Protocol: cada PASO es un prompt separado en Claude Code*
*Windows To Go requiere intervencion manual del usuario (GUI de Rufus)*
