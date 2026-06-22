# CLAUDE.md — Ferretería Oviedo El Manzano
# Este archivo se carga automáticamente al inicio de cada sesión de Claude Code.

## LEER OBLIGATORIO ANTES DE CUALQUIER TAREA

1. Leer `AGENTS.md` (reglas completas del proyecto, Safe Change Protocol, pipeline, historial)
2. Leer `MEMORY.md` (índice de memoria — disponible en contexto)
3. Leer el archivo `estado-sesion-YYYYMMDD*.md` más reciente en memory/ para retomar el flujo exacto de la última sesión. Buscar con: `Get-ChildItem "$env:USERPROFILE\.claude\projects\E--ferreteria-oviedo\memory" -Filter "estado-sesion-*" | Sort-Object LastWriteTime -Descending | Select-Object -First 1`
4. Recién después ejecutar cualquier tarea

**REGLA MEMORIA:** Al terminar cualquier sesión con cambios, guardar `estado-sesion-YYYYMMDD.md` en memory/ con: qué se hizo, qué quedó pendiente, versión activa, próximos pasos. Esto garantiza continuidad entre sesiones y PCs.

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
4. Guardar `estado-sesion-YYYYMMDD.md` en memory/ (ver formato abajo)

### Formato estado-sesion (OBLIGATORIO al cerrar sesión con cambios)
```
## Estado sesión YYYY-MM-DD
**Versión activa:** VXX.XX
**Deploy:** hecho / pendiente
**Commit:** hash o pendiente

### Hecho en esta sesión
- [lista de cambios]

### Pendiente
- [lista de tareas pendientes con detalle]

### Próxima sesión debe empezar por
- [acción concreta inmediata]
```

---

## ARQUITECTURA DE DISCOS

| Ruta | Contenido |
|---|---|
| `E:\ferreteria-oviedo\` | Proyecto activo (solo flujo + datos + docs + `_HISTORICO` + `_utilidades`) |
| `E:\_ARCHIVO_FERRETERIA\` | Archivo histórico FUERA del proyecto — backups/deprecados/temporales (no se sube a git/firebase) |
| `E:\git-sync\` | Repo git (solo para commits/push) |
| `E:\config\` | Tokens, gitconfig, credenciales cifradas |

**Las letras de disco varían según el PC.** Las particiones se identifican por etiqueta de volumen:
- `PROYECTO_E` → contiene `ferreteria-oviedo\`, `git-sync\`, `config\`, herramientas portables
- `CONFIG_W` → contiene `claude-config\` (memoria Claude, settings, skills)

**Junction Claude:** `C:\Users\<usuario>\.claude` → `CONFIG_W:\claude-config\`
Ejecutar `CONFIG_W:\MONTAR_CLAUDE.ps1` para crearla/actualizarla en cualquier PC.

**Junction OCR:** `C:\Users\<usuario>\.opencodereview` → `PROYECTO_E:\config\opencodereview\`

### FortiShield bloquea los discos USB (causa de desconexiones)
`FortiShield` + `fortimon3` (minifiltros FSFilter) retienen handles sobre los volúmenes USB
y los bloquean tras una desconexión abrupta. Fix rápido — desadherir de los USB:
```powershell
foreach ($v in 'E:','F:','W:','L:','M:') { fltmc detach FortiShield $v; fltmc detach fortimon3 $v }
```
Dura hasta reboot. Integrado en `REMONTAR_DISCO_E.ps1` v3. Detalle en AGENTS.md → "EMERGENCIA DISCO PROYECTO_E / CONFIG_W".

### Sin copia de docs en C:
Los 8 documentos de referencia (AGENTS.md, MEMORY.md, CLAUDE.md, README.md, MAPA_FLUJO_PROYECTOS.md,
IDS_REFERENCIA.md, ESTADO_PROYECTO.md, rule.json) viven en `PROYECTO_E:\ferreteria-oviedo\` (fuente
real) y se espejan como respaldo de solo lectura en `CONFIG_W:\proyecto-docs\` y en el disco con
Windows alterno de esta máquina (`<letra>:\ferreteria-docs\`). **Nunca en C:** — ver
`CONFIG_W:\SETUP_PC_NUEVO.md` sección "PLAN B" y "CUTOVER claude-config" (caso especial pendiente,
no replicar).

---

## REVISIÓN DE CÓDIGO — DOS MODOS

### Modo $0 — /revisar-codigo (recomendado, sin costo)
Skill de Claude Code que corre dentro de la sesión activa. Evalúa el diff contra las 14 reglas de `.opencodereview\rule.json` sin llamar a ninguna API externa.
```
/revisar-codigo
```

### Modo CLI — OCR_REVIEW.bat (usa API externa)
Usa el paquete npm `open-code-review`. Requiere junction `.opencodereview` activa.
```
E:\ferreteria-oviedo\OCR_REVIEW.bat
```
Requiere: `C:\Users\<usuario>\.opencodereview` → `E:\config\opencodereview\`
Si la junction no existe: ejecutar `MONTAR_CLAUDE.ps1` (la crea automáticamente).
