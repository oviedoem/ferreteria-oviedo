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
4. Actualizar el badge visual `.version-badge` en panel-admin.html (texto `AG ● VXX.XX ● DD-MM-YYYY`, buscar `version-badge` en el HTML) — **SOLO en este paso de cierre de sesión, nunca después de cada mejora/fix individual dentro de la sesión**
5. Guardar `estado-sesion-YYYYMMDD.md` en memory/ (ver formato abajo)

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

### FortiShield bloquea los discos USB (causa de desconexiones)
`FortiShield` + `fortimon3` (minifiltros FSFilter) retienen handles sobre los volúmenes USB
y los bloquean tras una desconexión abrupta. Fix rápido — desadherir de los USB:
```powershell
foreach ($v in 'E:','F:','W:','L:','M:') { fltmc detach FortiShield $v; fltmc detach fortimon3 $v }
```
Dura hasta reboot. Integrado en `REMONTAR_DISCO_E.ps1` v3. Detalle en AGENTS.md → "EMERGENCIA DISCO PROYECTO_E / CONFIG_W".

### Sin copia de docs en C: — regla del Windows Empresa (ahora en disco D:)
Los 8 documentos de referencia (AGENTS.md, MEMORY.md, CLAUDE.md, README.md, MAPA_FLUJO_PROYECTOS.md,
IDS_REFERENCIA.md, ESTADO_PROYECTO.md, rule.json) viven en `PROYECTO_E:\ferreteria-oviedo\` (fuente
real) y se espejan como respaldo de solo lectura en `CONFIG_W:\proyecto-docs\` y en el disco con
Windows alterno de esta máquina (`<letra>:\ferreteria-docs\`).

**Esta restricción aplica al Windows Empresa, que ahora vive en disco `D:`** — ahí nunca debe
quedar una copia de estos docs en su propio C:.

**NO aplica a este PC (Windows 10 personal, disco externo, CONFIG_W por USB).** En este PC el
duplicado `C:\claude-config` es intencional y documentado — ver memoria `cutover-claude-config-completado`:
`W:\claude-config` es la fuente canónica, `C:\claude-config` es respaldo deliberado sincronizado
manualmente W→C con `SYNC_W_A_C.bat` (Escritorio). No es el mismo caso ni la misma regla que la de
arriba — no confundir "Windows Empresa nunca en C" con "este PC sí puede tener duplicado en C".

---

## REVISIÓN DE CÓDIGO

### /revisar-codigo (único modo activo)
Skill de Claude Code que corre dentro de la sesión activa. Evalúa el diff contra las 14 reglas de `.opencodereview\rule.json` sin llamar a ninguna API externa.
```
/revisar-codigo
```
Antes de `/revisar-codigo` se puede correr `/paperclip-revision-costo-cero` como pasada previa
basada en grep/patrones (más rápida, sin generación de texto extra).

---

## SKILLS DISPONIBLES (`.claude\commands\`)

Skills de diseño y revisión — se activan con `/nombre`:

| Skill | Cuándo usar |
|---|---|
| `/web-design-guidelines` | Rediseño visual de panel-admin/cliente/empleado |
| `/animate-app` | Agregar transiciones, hover, micro-interacciones |
| `/sleek-mobile` | Layout mobile-first, ergonomía táctil (vendedores/clientes Android) |
| `/ui-ux-pro-max` | Checklist calidad UX final antes de entregar un cambio visual |
| `/web-guidelines` | Accesibilidad, performance, seguridad front-end (innerHTML, CSP, PWA) |
| `/frontend-design` | Dirección estética y tipografía |
| `/paperclip-revision-costo-cero` | Pasada pre-cierre: patrones XSS/reglas sin costo extra |
| `/revisar-codigo` | Revisión $0 contra 14 reglas FO del proyecto |
| `/ahorro-tokens` | Compresión de contexto + estado rápido del proyecto |

Regla: **`/animate-app` y `/sleek-mobile` siempre junto con `/web-design-guidelines`**, nunca solos.

---

## REGLAS CRÍTICAS — PIPELINE BOT WHATSAPP

### PASO 5 de ACTUALIZAR_TODO.bat — catálogo bot va a Hosting, NUNCA a Firestore
- **ACTUALIZADO 2026-08-08:** el PASO 5 genera `catalogo-bot.json` con PowerShell y hace `firebase deploy --only hosting`
- **NO llamar a `upload-catalog.js`** — sube a Firestore cuya quota gratuita está agotada. Si se llama, el pipeline se cuelga indefinidamente en "Leyendo catálogo desde..."
- El bot descarga `catalogo-bot.json` desde `https://ferreteria-oviedo.web.app/catalogo-bot.json` al arrancar

### Blazor (descargar_blazor_bodegas.py) — selector de servidor
- Usar `.filter(has_text=re.compile(r'^\s*Oviedo\s*$'))` para hacer click en el botón "Oviedo"
- **NO usar** `:not(:has-text('Test'))` — no funciona en Playwright con pseudo-clases compuestas
- Fix aplicado 2026-08-08. Si el login/selección de servidor falla en la próxima corrida, revisar que el selector `.filter()` esté vigente

### REGLA CRÍTICA — Datos.json NO está en git / deploy siempre debe copiarlo
- `E:\ferreteria-oviedo\CATALOGO PRODUCTOS\Datos.json` (3.6 MB) **NO está en git-sync**
- Cada `firebase deploy --only hosting` desde git-sync **borra Datos.json de Hosting** si no se copia antes
- **Fix aplicado 2026-08-20:** `ACTUALIZAR_TODO.bat` PASO 4 ahora copia Datos.json antes del deploy
- **Si se hace deploy manual** (sin el bat): copiar manualmente antes: `copy /Y "E:\ferreteria-oviedo\CATALOGO PRODUCTOS\Datos.json" "E:\git-sync\CATALOGO PRODUCTOS\Datos.json"`

---

### Sesión 2026-08-20 (Claude Code) — Fix búsqueda stock panel-admin + proteger Datos.json en deploy

**Resumen:** Mejora búsqueda Consulta de Stock: búsqueda AND por tokens (antes era substring completo), normalización de tildes y dimensiones "100x100"→"100 100", datalist HTML5 para sugerencias nativas. Bug introducido: mis deploys borraron Datos.json de Hosting (no estaba en git-sync). Fix: pipeline ACTUALIZAR_TODO.bat copia Datos.json antes del deploy.

**Archivos modificados:**
- `panel-admin.html`: función `vadmBuscarStock` — búsqueda por tokens AND + normalize; `_csPoblarSugerencias` — datalist con top descripciones; `<datalist id="csSugerencias">` en el input
- `ACTUALIZAR_TODO.bat`: PASO 4 agrega copia de Datos.json desde ferreteria-oviedo antes del firebase deploy

**Pendiente:**
- El error "Missing or insufficient permissions" en Ventas→Categorías ocurre cuando ventas-manzano JSON no está en Hosting → fallback a Firestore colección `ventasLineas` sin permisos. Se resuelve corriendo el pipeline completo (`ACTUALIZAR_TODO.bat`).
