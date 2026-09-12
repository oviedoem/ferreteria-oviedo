# CLAUDE.md — Ferretería Oviedo El Manzano
# Este archivo se carga automáticamente al inicio de cada sesión de Claude Code.

## LEER OBLIGATORIO ANTES DE CUALQUIER TAREA

1. Leer `AGENTS.md` (reglas completas del proyecto, Safe Change Protocol, pipeline, historial)
2. Leer `MEMORY.md` (índice de memoria — disponible en contexto)
3. Leer el archivo `estado-sesion-YYYYMMDD*.md` más reciente en memory/ para retomar el flujo exacto de la última sesión. Buscar con: `Get-ChildItem "$env:USERPROFILE\.claude\projects\E--ferreteria-oviedo\memory" -Filter "estado-sesion-*" | Sort-Object LastWriteTime -Descending | Select-Object -First 1`
4. **REGLA FLUJO ACTUAL:** Revisar fechas de modificación de archivos en la raíz del proyecto. Los archivos con fechas más recientes marcan el flujo actual — no solo los `.md`. Un archivo `.bat`, `.py` o `.ps1` reciente puede indicar un pipeline nuevo no documentado aún.
   ```powershell
   Get-ChildItem "E:\ferreteria-oviedo" -File | Sort-Object LastWriteTime -Descending | Select-Object Name, LastWriteTime | Select-Object -First 20
   ```
5. Recién después ejecutar cualquier tarea

**REGLA MEMORIA:** Al terminar cualquier sesión con cambios, guardar `estado-sesion-YYYYMMDD.md` en memory/ con: qué se hizo, qué quedó pendiente, versión activa, próximos pasos. Esto garantiza continuidad entre sesiones y PCs.

---

## STACK Y DIRECTORIO

- **Proyecto activo:** `E:\ferreteria-oviedo\` — trabajar SIEMPRE aquí
- **Git repo:** `E:\git-sync\` — NUNCA modificar directamente
- **Versión activa:** V37.71 · 2026-09-10 · ver AGENTS.md (historial de deploys) · **DEPLOY HECHO, commit 5b88166**
- **Sesión 12-09-2026 (Claude Code Web) — Revisión de seguridad GitHub, solo lectura, sin cambios:** auditoría del repo `oviedoem/ferreteria-oviedo` a pedido del dueño. Hallazgos documentados como **PENDIENTE** (ver `ESTADO_PROYECTO.md` → PENDIENTES CONOCIDOS → "Seguridad GitHub 12-09-2026"), nada corregido todavía por decisión explícita del dueño ("documentar, no hacer nada ahora").
- **Última sesión (10-09-2026, continuación noche):** Análisis de Bodegas — subfilas con detalle completo por documento (Bodega/Código/Descripción/Costo/Valorizado, antes en blanco), filtro "Filtrar por persona (CEM)" con KPI de acumulado (extracción dinámica de nombres desde observación), fix `_x000d_` en Excel, y reescritura completa de `bfExportExcel` a SpreadsheetML con color/negrita/AutoFilter (el patrón SheetJS anterior no soporta color en su versión gratuita) — verificado abriendo el archivo real con Excel vía COM (sin aviso de reparación, autofiltro y colores confirmados). Consistencia SQL en vivo verificada en las 6 bodegas (51+ códigos, 0 discrepancias, 2 agentes en paralelo + verificación propia). **Ver `memory/estado-sesion-20260910.md` completo.**
- **Sesión previa misma noche (V37.70):** menú "⚠️ Margen Negativo" en Panel Admin y Vendedor (ventas reales bajo costo vs NC), pipeline completo corrido en vivo, deploy+commit 1422bec — detalle completo en `memory/estado-sesion-20260910.md`.
- **Sesión 09-09-2026 (resumen, detalle en `memory/estado-sesion-20260909.md`):** costo promedio real desde SQL (`descargar_costo_promedio.py`, PASO 1L) reemplaza el fallback a costo del catálogo. Margen por Tipo de Documento con drilldown en Panel Admin y Vendedor. Fix `calcSocio()`. Investigación "líneas SSRS duplicadas" cerrada (1 documento aislado, no un patrón).
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

### Al terminar cualquier sesión con cambios — CHECKLIST COMPLETO (9 puntos, verificado 2026-09-10)
No asumir que "actualizar todo" es solo AGENTS.md — son 9 archivos/pasos distintos, cada uno con su propósito. Marcar cada uno, no saltarse ninguno:

1. **Deploy** — `ACTUALIZAR_TODO.bat` (pipeline+deploy) si hay cambios de HTML/JS/JSON. Si el cambio es solo capa de presentación (sin tocar pipeline/SQL), igual correr el `.bat` completo — es la única forma de deploy autorizada, nunca `firebase deploy` manual.
2. **Commit a GitHub** — `ACTUALIZAR_GITHUB.bat` (commit+push con lista blanca de archivos vía robocopy). Esto **dispara automáticamente** la regeneración de `negocio.md` del bot (Centro de Comandos) leyendo este CLAUDE.md — no hace falta correr `ACTUALIZAR_CONTEXTO_BOT.bat` a mano salvo que se necesite el paso pesado de SQL/ERP de ese proyecto.
3. **Badge de versión** (`.version-badge` / bloque fixed bottom-right, texto `AG ● VXX.XX ● DD-MM-YYYY`) — actualizar **solo en los paneles que realmente cambiaron esta sesión**: `panel-admin.html`, `index.html` (Panel Vendedor), `panel-cliente.html` son 3 archivos independientes con su propio badge — no forzar los 3 si solo se tocó uno. **Solo en este paso de cierre, nunca después de cada fix individual dentro de la sesión.**
4. **`AGENTS.md`** — bump "Versión activa" (aparece 2 veces: línea 3 del header y en la sección PROYECTO) + nuevo bloque de changelog arriba del anterior (no reemplazar historial viejo).
5. **`CLAUDE.md`** (este archivo) — bump línea "Versión activa" + resumen de "Última sesión" (reemplazar o condensar el detalle de la sesión previa si ya quedó guardado completo en su propio `estado-sesion-*.md`).
6. **`ESTADO_PROYECTO.md`** — bump versión (aparece 2 veces: header y tabla `VERSION ACTUAL`) + nueva sección en "ULTIMOS CAMBIOS (V37.x)".
7. **`memory/estado-sesion-YYYYMMDD.md`** — crear nuevo, o **continuar el mismo archivo** si la sesión sigue siendo la misma versión activa (ej. una sesión larga que retoma de noche) en vez de crear uno separado con fecha distinta y duplicar contenido.
8. **`MEMORY.md`** (índice, en `~/.claude/projects/.../memory/`) — actualizar la línea del `estado-sesion` más reciente con el resumen final, mantener "últimas 7" (recortar la más antigua si se pasa).
9. **`pipeline-datos-mapa.html`** — actualizar **solo si el cambio agrega/modifica un menú, fuente de datos o flujo documentado ahí** (nueva tarjeta en tab 6 "Menús Panel Admin", bump de versión en el subtítulo). **No está en la lista blanca de `ACTUALIZAR_GITHUB.bat`** — queda actualizado en `E:\ferreteria-oviedo\` (la fuente real que se lee) pero no se sube a git, esto es esperado, no es un error.

10. **REVISAR siempre (editar solo si aplica) — `E:\CONOCIMIENTO DEL NEGOCIO\CLAUDE.md`**: el bot/Centro de Comandos lee el CLAUDE.md de **cada proyecto** (13/13 según el log de la última corrida) para armar `negocio.md` — si este cambio contradice o vuelve obsoleta una regla escrita ahí (ej. cómo se hace deploy, qué panel muestra qué), corregirla ahí también; si no toca nada de eso, no editar nada (no mezclar proyectos sin necesidad real).
11. **REVISAR solo si el cambio es de flujo físico de stock — `flujo-stock-justime.html`** (en `CONOCIMIENTO DEL NEGOCIO\`): no aplica a cambios de ventas/margen, solo a movimiento Disp/Fís/Ped/Tránsito.

**Por qué importa el orden 1→11:** el bot y el Centro de Comandos dependen de que TODOS estos archivos queden consistentes entre sí al mismo tiempo — un `AGENTS.md` actualizado pero un `CLAUDE.md` con la versión vieja (o viceversa) deja al bot con información contradictoria la próxima vez que alguien pregunte "¿qué versión está activa?". No cerrar la sesión con solo 1 o 2 de los 11 hechos.

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
| `/arbitro-flujo` | Árbitro anti-confusión — flujo actual vs archivado, trampas frecuentes |
| `/analizar-ventas` | Análisis de ventas (usar JSONs en data/, NO foviedo_local.db de Bodegas) |
| `/revisar-pipeline` | Auditoría pipeline ERP→Firebase (pasos 1A–1N + 3/3.5/3.6/4/5) |
| `/caveman` | Simplificación de código — remover complejidad innecesaria |
| `/open-code-review` | **DEPRECADO** — no usar, reemplazado por `/revisar-codigo` |

Regla: **`/animate-app` y `/sleek-mobile` siempre junto con `/web-design-guidelines`**, nunca solos.

---

## REGLAS CRÍTICAS — PIPELINE BOT WHATSAPP

### PASO 3.6 de ACTUALIZAR_TODO.bat — catálogo cotizador con precios rotativos
- `generar_catalogo_cotizador_rotacion.ps1` genera `catalogo-cotizador.json` (precios v3m/v6m por SKU)
- Corre entre PASO 3 (visibilidad precios) y PASO 4 (firebase deploy)
- JSON vive en carpeta token rotativo (`data/<token>/catalogo-cotizador.json`)

### PASO 5 de ACTUALIZAR_TODO.bat — catálogo bot va a Hosting, NUNCA a Firestore
- **ACTUALIZADO 2026-08-08:** el PASO 5 genera `catalogo-bot.json` con PowerShell y hace `firebase deploy --only hosting`
- **NO llamar a `upload-catalog.js`** — sube a Firestore cuya quota gratuita está agotada. Si se llama, el pipeline se cuelga indefinidamente en "Leyendo catálogo desde..."
- El bot descarga `catalogo-bot.json` desde `https://ferreteria-oviedo.web.app/catalogo-bot.json` al arrancar

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

**Pendiente:** — (resuelto 2026-08-28: error Ventas→Categorías corregido corriendo ACTUALIZAR_TODO.bat completo)

---

### Sesiones V37.59–V37.61 (2026-08-27) — pipeline completo + documentosGRT + fix NCE

**V37.59:** `descargar_bod.py` — soporte multi-GRT para documentosGRT + algoritmo LIFO híbrido.
Sub-filas chevron en panel-admin para detalles de documentos por GRT.

**V37.60:** `normalizar_totales_sql` — corrección de totales SQL. Fix NCE (primera corrección).
`agregar_docs_sin_ssrs` — documentos sin correlativo SSRS ahora incluidos.

**V37.61:** Fix NCE definitivo. Validación `.py` en ACTUALIZAR_TODO.bat.
Badge actualizado: `AG ● V37.61 ● 27-08-2026`. Deploy commit `acdc33b` — 17:07.

**Estado al 2026-08-28:** pipeline funcional, ningún pendiente activo.

---

### Centro de Comando — ACTUALIZAR_CONTEXTO_BOT.bat

Panel Agentes: `https://oviedo-agentes-panel.onrender.com/agentes` (lee `contexto/negocio.md`)
`ACTUALIZAR_CONTEXTO_BOT.bat` (en `E:\BOT  OVIEDO_ELMANZANO WHATSSSAP\`) regenera `negocio.md`
leyendo el CLAUDE.md de cada proyecto. Correr después de actualizar cualquier CLAUDE.md del stack.
