# CLAUDE.md — Ferretería Oviedo El Manzano
# Este archivo se carga automáticamente al inicio de cada sesión de Claude Code.

## LEER OBLIGATORIO ANTES DE CUALQUIER TAREA

1. Leer `AGENTS.md` (reglas completas del proyecto, Safe Change Protocol, pipeline, historial)
2. Leer `MEMORY.md` (si está disponible en contexto)
3. Recién después ejecutar cualquier tarea

---

## STACK Y DIRECTORIO

- **Proyecto activo:** `E:\ferreteria-oviedo\` — trabajar SIEMPRE aquí
- **Git repo:** `E:\git-sync\` — NUNCA modificar directamente
- **Versión activa:** ver AGENTS.md (historial de deploys)
- **Stack:** HTML/CSS/JS Vanilla + Firebase Hosting + Python pipeline ERP (JustWeb SSRS)
- **Deploy:** `firebase deploy` desde `E:\ferreteria-oviedo\`
- **Commit:** `ACTUALIZAR_GITHUB.bat` desde `E:\ferreteria-oviedo\`

---

## REGLAS CRÍTICAS (resumen — ver AGENTS.md para detalle completo)

### Nunca hacer esto
- Usar `C:` para guardar archivos del proyecto
- Subir IPs reales, tokens, contraseñas a git (usar placeholders)
- Modificar `firebase-config.js`, `credenciales_db.ini`
- Trabajar directamente en `E:\git-sync\`
- Usar `cmd /c bat > NUL` desde bash (usar PowerShell)
- Dejar respaldos/temporales/duplicados/deprecados dentro del proyecto → van a `E:\_ARCHIVO_FERRETERIA\` (fuera del proyecto). Utilidades del equipo → `_utilidades\`.

### xlsm-enrich.json (V37.25)
Lo genera `BODEGAS\descargar_ventas_enrich.py` desde SQL (primario) o `leer_xlsm.py` desde XLSM (fallback). NUNCA main.py.

### Antes de cualquier cambio de código
```
TOCO:        [función exacta]
ARCHIVO:     [panel-admin.html | main.py | otro]
RAZÓN:       [una línea]
NO TOCO:     [qué queda igual y por qué]
```
Un prompt = una función tocada. Si el fix requiere 2 funciones → dos prompts separados.

### Al terminar cualquier sesión con cambios
1. `firebase deploy` si hay archivos HTML/JS/JSON más nuevos que el último deploy
2. `ACTUALIZAR_GITHUB.bat` para commitear
3. Actualizar versión en AGENTS.md

---

## ARQUITECTURA DE DISCOS

| Ruta | Contenido |
|---|---|
| `E:\ferreteria-oviedo\` | Proyecto activo (solo flujo + datos + docs + `_HISTORICO` + `_utilidades`) |
| `E:\_ARCHIVO_FERRETERIA\` | Archivo histórico FUERA del proyecto — backups/deprecados/temporales (no se sube a git/firebase) |
| `E:\git-sync\` | Repo git (solo para commits/push) |
| `W:\claude-config\` | Config Claude (junction desde C:\Users\..\.claude) |
| `E:\config\` | Tokens, gitconfig, credenciales cifradas |

**W: y E: son el mismo USB físico.** Si se desconecta: Explorador → clic derecho E: → Expulsar → remontar.

### FortiShield bloquea los discos USB (causa de desconexiones)
`FortiShield` + `fortimon3` (minifiltros FSFilter) retienen handles sobre los volúmenes USB
y los bloquean tras una desconexión abrupta. Fix rápido y quirúrgico — desadherir solo de los
USB (C: queda protegido, no toca servicios → no pelea con tamper protection):
```powershell
foreach ($v in 'E:','W:','F:','L:','M:') { fltmc detach FortiShield $v; fltmc detach fortimon3 $v }
```
Dura hasta reboot o reconexión del USB. Ya integrado en `REMONTAR_DISCO_E.ps1` v3
(función `Detach-FortiUSB`) → lo corre la tarea `AutoRemontarDiscoE` en cada boot.
Script v3 en 3 copias sincronizadas: `W:\herramientas\seguridad\` · `D:\` · `M:\herramientas\seguridad\`.
Detalle completo en AGENTS.md → "EMERGENCIA DISCO E: / W:".

---

## OPEN CODE REVIEW (OCR)

Herramienta de revisión de código con IA. Correr antes de deploys importantes:
```
cd E:\git-sync
ocr review --audience agent --commit <hash>
```
Config en `E:\config\opencodereview\config.json` (junction desde C:\Users\..\.opencodereview).
