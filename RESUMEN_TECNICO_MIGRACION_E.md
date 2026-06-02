# RESUMEN TÉCNICO — MIGRACIÓN A DISCO E:
# Ferretería Oviedo · Sistema completo
# Fecha: 2026-06-02

---

## 1. INVENTARIO COMPLETO DEL SISTEMA

### Proyectos activos

| Proyecto | Ruta activa | Deploy destino |
|---|---|---|
| Panel Web (ferreteria-oviedo) | `E:\ferreteria-oviedo\` | Firebase Hosting — ferreteria-oviedo.web.app |
| APP-INVENTARIO | `E:\APP-INVENTARIO\` | GitHub Pages — oviedoem.github.io/APP-INVENTARIO |
| Git sync (solo push) | `E:\git-sync\` | GitHub — rama sincronización |

### Herramientas del sistema

| Herramienta | Ubicación | Disco | Movible |
|---|---|---|---|
| Python 3.14 + site-packages | `C:\Python314\` | **C:** | No — instalador Windows |
| pyodbc / openpyxl / requests | `C:\Python314\Lib\site-packages\` | **C:** | No — dependen del Python de C: |
| Node.js runtime | `C:\Program Files\nodejs\` | **C:** | No — instalador de sistema |
| npm global packages (firebase-tools) | `E:\npm-global\` | **E:** ✓ | Ya en E: |
| Git for Windows (binarios) | `C:\Program Files\Git\` | **C:** | No — instalador de sistema |
| Git Credential Manager store | `E:\config\gcm-store\` | **E:** ✓ | Ya en E: |
| XDG_CONFIG_HOME | `E:\config\` | **E:** ✓ | Variable de entorno configurada |
| Omnara CLI home | `E:\omnara\home\` | **E:** ✓ | Migrado 2026-06-02 |
| Omnara Desktop app | `E:\omnara\desktop-app\` | **E:** ✓ | Migrado 2026-06-02 |
| Omnara user data | `E:\omnara\desktop-data\` | **E:** ✓ | Migrado 2026-06-02 |
| Claude Code config (.claude) | `C:\Users\Ferreteria Oviedo\.claude\` | **C:** | No — ruta del sistema por diseño |
| Tarea programada Auto18 | `E:\ferreteria-oviedo\ACTUALIZAR_TODO_AUTO.bat` | **E:** ✓ | Apunta a E: correctamente |

---

## 2. ESTADO DE LA MIGRACIÓN A E:

### ✅ Completado

| Componente | Desde | Hasta | Fecha |
|---|---|---|---|
| Proyecto ferreteria-oviedo | `D:\ferreteria-oviedo\` | `E:\ferreteria-oviedo\` | 2026-06-02 |
| Proyecto APP-INVENTARIO | `D:\APP-INVENTARIO\` | `E:\APP-INVENTARIO\` | 2026-06-02 |
| npm global | `C:\Users\...\AppData\Roaming\npm\` | `E:\npm-global\` | 2026-06-02 |
| GCM credentials store | default AppData | `E:\config\gcm-store\` | 2026-06-02 |
| Omnara CLI + Desktop + Data | `C:\Users\...\AppData\...` | `E:\omnara\` | 2026-06-02 |
| Historial Claude (D: proyecto) | `C:\..\.claude\projects\D--ferreteria-oviedo\` | Eliminado | 2026-06-02 |
| Temp safe-change (D: artifact) | `C:\...\Temp\claude\D--...` | Eliminado | 2026-06-02 |
| daemon.json | Tenía entrada D:\ferreteria-oviedo | Solo E:\ferreteria-oviedo | 2026-06-02 |

### ⚠️ Pendiente / Inconcluso

| Ítem | Problema | Solución recomendada |
|---|---|---|
| Tarea "Ferreteria Oviedo - Backup Diario" | Apunta a `D:\ferreteria-oviedo\BACKUP_DIARIO.bat` — D: ya no es el proyecto | Actualizar o eliminar la tarea |
| Tarea "Ferreteria Oviedo Ventas 7PM" | Apunta a `D:\ferreteria-oviedo\ACTUALIZAR_TODO.bat` — obsoleta | Eliminar (duplicada por Auto18 en E:) |
| Omnara auto-updater | Al actualizar Omnara Desktop, reinstala en `C:\...\AppData\Local\Programs\omnara-desktop` por comportamiento hardcodeado de electron-builder | Después de cada update de Omnara → re-mover a E:\omnara\desktop-app\ |
| Python en C: | El intérprete y todos los paquetes están en `C:\Python314\` | Ver sección 4 |
| Node.js en C: | Runtime en `C:\Program Files\nodejs\` | Ver sección 4 |

---

## 3. PROS Y CONTRAS DE TENER EL PROYECTO EN E:

### ✅ PROS

**Separación de datos y sistema operativo**
- C: queda para Windows y herramientas del sistema únicamente
- E: contiene todo lo del proyecto → respaldo simple: copiar E:
- Si Windows corrompe o requiere reinstalación → E: sobrevive intacto con todos los datos

**Espacio en C:**
- C: no se llena con los ~1.5GB del proyecto + 1.5GB de Omnara
- Actualizaciones de Windows tienen más espacio libre en C:

**Portabilidad parcial**
- E: podría ser un disco externo o SSD separado → proyecto portátil entre equipos
- El pipeline no depende de la ruta de usuario de C: (scripts usan `%~dp0` y rutas relativas)

**Organización clara**
- Todo el trabajo en `E:\` — un solo lugar para buscar cualquier archivo del proyecto
- Regla fácil de aplicar: si es del proyecto va en E:

**npm global en E:**
- Firebase CLI y dependencias npm no contaminan el perfil de C:

**Credenciales git en E:**
- `E:\config\gcm-store\` protege credenciales si se borra el perfil de usuario de C:

---

### ❌ CONTRAS Y RIESGOS

**Python no puede moverse fácilmente**
- Python 3.14 está en `C:\Python314\` con todos sus paquetes (`pyodbc`, `openpyxl`, `requests`)
- Si se reinstala Windows o se borra C:, hay que reinstalar Python y todos los paquetes
- Los scripts del pipeline (`descargar_erp.py`, `descargar_bod.py`, etc.) dependen de este Python de C:
- No existe una forma limpia de mover el intérprete de Python sin reinstalar

**Node.js no puede moverse**
- `C:\Program Files\nodejs\` es instalación de sistema
- `firebase deploy` (usado en PUBLICAR.bat y ACTUALIZAR_TODO.bat) llama a este Node
- Si C: se borra → Firebase CLI deja de funcionar aunque esté en E:\npm-global\

**Claude Code (.claude) permanece en C:**
- `C:\Users\Ferreteria Oviedo\.claude\` contiene configuración global de Claude Code
- No es posible mover esta carpeta (Claude Code la crea en el perfil de usuario)
- Si se borra el perfil → se pierde configuración global y keybindings

**Omnara auto-updater vuelve a C:**
- Cada actualización automática de Omnara reinstala en `AppData\Local\Programs\omnara-desktop`
- Requiere intervención manual para mantener E: como ubicación

**Windows siempre necesario**
- Las tareas programadas (Task Scheduler) viven en el registro de Windows en C:
- Los accesos directos (.lnk) del escritorio y menú inicio están en C:
- Si E: no está disponible al arranque, la tarea Auto18 falla silenciosamente

**Riesgo de desincronía entre discos**
- Si E: no está disponible (disco desconectado, fallo), nada del proyecto funciona
- C: no tiene fallback — no hay copia del pipeline
- La tarea Auto18 a las 18:00 falla sin aviso si E: no está montado

**Git for Windows en C:**
- `git` en los BATs y scripts depende de `C:\Program Files\Git\`
- El ACTUALIZAR_GITHUB.bat falla si Git no está en C:

---

## 4. DEPENDENCIAS CRÍTICAS DE C: — TABLA DE RIESGO

| Dependencia en C: | Usada por | Riesgo si falla | Solución posible |
|---|---|---|---|
| `C:\Python314\python.exe` | Todo el pipeline (6 scripts) | Pipeline completo cae | Reinstalar Python en E: y actualizar PATH |
| `C:\Python314\Lib\site-packages\pyodbc` | descargar_bod.py, descargar_pedidos.py, descargar_despachos.py | Sin datos SQL Server | Reinstalar con nuevo Python |
| `C:\Python314\Lib\site-packages\openpyxl` | descargar_erp.py, procesar-actualizacion.py, xlsx_a_csv.py | Sin catálogo ni precios | Reinstalar con nuevo Python |
| `C:\Program Files\nodejs\node.exe` | firebase deploy, update-sw-version.js | No se puede publicar en Firebase | Instalar Node en E: (posible) |
| `C:\Program Files\Git\` | ACTUALIZAR_GITHUB.bat, omnara CLI internamente | Sin sync a GitHub | Instalar Git portable en E: |
| `C:\Users\..\.claude\` | Claude Code (toda la IA) | Sin asistencia de Claude | No movible |
| Registro Windows (Task Scheduler) | Tarea Auto18 a las 18:00 | Sin actualización automática diaria | No aplica (siempre en C:) |

---

## 5. RECOMENDACIONES PARA COMPLETAR LA MIGRACIÓN

### Prioridad alta

1. **Eliminar tareas obsoletas que apuntan a D:**
   ```powershell
   Unregister-ScheduledTask -TaskName "Ferreteria Oviedo - Backup Diario" -Confirm:$false
   Unregister-ScheduledTask -TaskName "Ferreteria Oviedo Ventas 7PM" -Confirm:$false
   ```

2. **Mover Python a E:** (requiere reinstalación)
   - Descargar Python installer
   - Instalar en `E:\Python\`
   - `pip install pyodbc openpyxl requests`
   - Actualizar PATH para quitar C:\Python314 y agregar E:\Python
   - Verificar que el pipeline funciona

3. **Mover Node.js a E:** (requiere reinstalación)
   - Descargar Node.js installer o usar nvm-windows apuntando a E:
   - Instalar en `E:\nodejs\`
   - Actualizar PATH

### Prioridad media

4. **Git portable en E:**
   - Descargar Git portable (no-installer) en `E:\git-portable\`
   - Agregar a PATH antes que `C:\Program Files\Git\`

5. **Script de verificación de disco E:**
   - Agregar al inicio de ACTUALIZAR_TODO.bat: si E: no responde → cancelar con aviso
   - Ya existe esta lógica implícita pero no hay aviso explícito

### Prioridad baja

6. **Omnara post-update script:**
   - Crear bat que re-mueva Omnara Desktop a E: después de cada update automático

---

## 6. RESUMEN EJECUTIVO

```
ESTADO ACTUAL:
  E: contiene → 100% del código y datos del proyecto
  E: contiene → Omnara (IDE) + npm global + credenciales git
  C: contiene → Python (crítico) + Node.js (crítico) + Git + Claude Code config

RIESGO PRINCIPAL:
  Si C: falla o se reinstala Windows →
    - Pipeline Python cae (requiere reinstalar Python + 3 packages en E:)
    - Firebase deploy cae (requiere reinstalar Node.js)
    - Claude Code pierde config global

PROYECTO FUNCIONAL: SÍ — con E: disponible y C: con Python/Node intactos
RESPALDO SEGURO: E: tiene todos los datos; C: tiene las herramientas de ejecución
```

---

*Generado 2026-06-02 · Actualizar cuando se complete la migración de Python/Node a E:*
