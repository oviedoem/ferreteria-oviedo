⛔ REGLA ESTRICTA: antes de tocar este proyecto, lee TODA la carpeta `docs/` empezando por `docs/00_LEER_PRIMERO.md` (y `AGENTS.md`); toda mejora (Claude, ChatGPT/Codex, Kimi u otra IA) debe basarse en el flujo actual de `docs/pipeline-datos-mapa.html` y `AGENTS.md`. Sin excepciones.
⛔ Deploy y cierre (corregido 03-11-2026): cambios solo estáticos de los paneles → `_utilidades\PUBLICAR_ESTATICOS.bat`; datos o pipeline → `ACTUALIZAR_TODO.bat`; siempre con orden expresa del dueño. Nada queda pendiente: cada punto termina HECHO-VERIFICADO, PROGRAMADO, DELEGADO o BLOQUEADO con su motivo.
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
- **Versión activa:** V37.86 PUBLICADA 04-11-2026 (lote 2: íconos SVG y micro-interacciones; commit a GitHub pendiente de orden) · 2026-11-04 (V37.84 cantidad manual, contador de ítems y margen en vivo + V37.85 lote de diseño móvil solo CSS, ambos paneles; se publican con `PUBLICAR_ESTATICOS.bat` con orden del dueño; detalle en AGENTS.md y `memory/estado-sesion-20261104.md`) · ver AGENTS.md (historial de deploys)
- **Sesión 03-11-2026 (V37.81 publicada el 03-11-2026 con `_utilidades\PUBLICAR_ESTATICOS.bat`; V37.82/V37.83 (Configuración ERP, tablas, sesiones remotas con uid) también publicadas; ver `memory/estado-sesion-20261103.md`):** (0) V37.81: Consulta de Stock carga sus propias ventas de 90 días (antes mostraba «sin venta» según el menú abierto antes) y se actualizaron los textos estáticos del panel (Mejoras, Estado del sistema, guías).  (0b) `BODEGAS\descargar_despachos.py` ya no filtra la sucursal 04 (faltaban 8 docs BVE/FVE de suc 09/10/14 en el menú Despachos); JSON regenerados y publicados (66 documentos en vivo). (1) `E:\python-portable` estaba dañado desde el 29-10 (faltaban `typing_extensions` para `bs4` y `google-auth` para Firestore): reparado con pip; E: y W: (`herramientas-portables\python-portable`) son copias SEPARADAS, no actualizar una desde la otra; verificar con `E:\python-portable\VERIFICAR_PAQUETES.bat`. (2) `data/` raíz: 23 copias viejas sin token (31-08 a 08-09, públicas en Hosting) archivadas en `E:\_ARCHIVO_FERRETERIA\data-raiz-copias-viejas-20261103` (con MANIFIESTO). (3) `validar_jsons.py` ahora valida `data\<token>\` (antes miraba copias viejas de la raíz); `enviar_reporte_vendedores.py` también lee la carpeta con token. (4) `precios-diff.json` (menú «Cambios de Precio AYER vs HOY») ya no sale de `PRECIOS.xlsm` (estaba al 01-09: `leer_xlsm.py` escribe en `data\` raíz desde que se archivó `rotar_token_data.py`): lo genera `BODEGAS\enviar_variaciones_precios.py` (PASO 2B del `.bat`, lista 14 SQL, base `VENTAS EL MANZANO\precios-lista14-base.json`) y envía el correo por Outlook (`agonzalez@oviedo.cl`) a los 8 destinatarios de `VENTAS EL MANZANO\correos-precios.txt` solo si hay variaciones; reemplaza `LP_E_MANZANO.xlsm` (Escritorio\CARLOS, no se toca). `ventas-xlsm-*` y `ranking-unidades` no los consume ningún panel. Riesgo conocido del `.bat`: si falla el PASO 1A (ERP) o el PASO 2 NO aborta y termina diciendo «ACTUALIZACION COMPLETA»: vigilar el log de 1A (debe decir `Login OK`). Corrida real hecha el 03-11 17:24 desde el Centro de Control con extensión (ok, commit `c1a9b6a`; V37.80 y PASO 2B publicados; PASO 2B sin variaciones, no envió correo). Pendiente: `--guardar` del blindaje (2 fallas esperadas: `panel-admin.html` y `docs/00_LEER_PRIMERO.md`; solo con orden del dueño).
- **Última sesión (24-10-2026, V37.80, deploy HECHO 2026-11-03 17:24 desde el Centro de Control):** Informe Stock: `descargar_pedidos.py` (PASO 1E) detalla los pedidos por bodega (no por sucursal 04), solo Vigente, todos los St_Pedido y sin límite de fecha (30000/PEM mostraba «sin documentos» porque la NVM 215439 es de Litueche); botón «⏳ Pedidos tomados» en Informe Stock de `panel-admin.html` (tramos por días, folio, cliente, vendedor, CSV/Excel; solo lectura, se elimina en el ERP con el folio); badge V37.80 solo en panel-admin. Detalle en memory/estado-sesion-20261024.md y en el mapa. Pendiente: `--guardar` del blindaje (solo con orden del dueño), (despachos ya publicados).
- **Sesiones 09-09 a 20-10-2026 (condensado 03-11; detalle en `memory/estado-sesion-AAAAMMDD.md`):**
  - 20-10 (V37.79): Ventas con costo real de SQL por numero+codigo (3.6b), 239 documentos que el SSRS omite expandidos a líneas SQL, cliente = razón social, fletes; margen 26,49 % → 26,72 %.
  - 16-10: `ACTUALIZAR_TODO.bat` enganchado al registro del Centro de Control, `if errorlevel 1` en bloques, modo `/auto`, blindaje guardado (0 fallas), `ORDEN_PROYECTOS.bat`. El refresco del bot en Render ya es automático (PASO 5 llama `_utilidades\refrescar_catalogo_bot.py`).
  - 14-10: deploy con la cuenta de servicio `E:\config\ferreteria-oviedo-b143e8e7b77d.json` (token CI de respaldo); `cantidad` desde SQL (`cantidad-enrich.json`); `firebase.json` excluye `data/costo-promedio-enrich.json` y `data/xlsm-enrich.json`.
  - 13-10 (V37.78): `generate_catalogo_bot.ps1` lee UTF-8, limpia espacios y rechaza catálogos incompletos o con acentos rotos; ningún panel lee `catalogo-bot.json` (solo el bot). 12-10 (ChatGPT, V37.77): `.bat` usa `firebase_ci.token`; identidad git corregida (`GIT_CONFIG_GLOBAL=E:\config\gitconfig`).
  - 06-10 (V37.75-76): menú Dashboard del bot y Solicitud Stock. **Regla:** toda función llamada con `onclick` desde el bloque del bot debe exportarse a `window` al final de la IIFE.
  - 02-10 (V37.74): el bot exige PIN por POST en `/api/conversaciones` y `/api/errores-ia`. **NO desplegar cambios del bot que alteren `/api/estado` ni `/api/contactos` sin revisar el menú «Bot WhatsApp» de `panel-admin.html`.**
  - 01-10 (V37.73): fix de `->` sin escapar en el echo del PASO 1M. 22-09: checkpoint incremental de ventas (`_max_fecha_producto` ahora acepta `dd-mm-yyyy`) y guardrail `[ALERTA]`; **`VENTAS EL MANZANO/` está gitignoreada a propósito desde 2026-06-02: esos fixes viven en `E:\ferreteria-oviedo\` y no llegan a GitHub.**
  - 21-09: 403 por cuenta cruzada con Cabrasgo: `--account` en los deploy y credencial Git aparte para `oviedoem`; clave ERP de `agonzalez` actualizada. 09/10-09: costo promedio real SQL (PASO 1L), Margen por Tipo de Documento, menú Margen Negativo (V37.70), Análisis de Bodegas con subfilas y Excel.
- **Stack:** HTML/CSS/JS Vanilla + Firebase Hosting + Python pipeline ERP (JustWeb SSRS)
- **Deploy:** cambios solo estáticos (paneles, textos, `sw.js`) con `_utilidades\PUBLICAR_ESTATICOS.bat`; datos o pipeline con `ACTUALIZAR_TODO.bat`. Siempre desde `E:\ferreteria-oviedo\`
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

### Visibilidad de precios en panel-cliente (por diseño — 16-10-2026)
- Por defecto el cliente ve solo stock: `window._mostrarPrecio = false` en `panel-cliente.html` y `mostrarPrecioCliente = false` por defecto en Firestore `config/precios`.
- Solo un admin, desde `panel-admin.html` (tarjeta «Precios en Panel Cliente»), puede activar o desactivar la visibilidad (escribe `config/precios.mostrarPrecioCliente`).
- El aviso `HTTP Error 401` / "No se pudo obtener token Firebase" del PASO 3 de `ACTUALIZAR_TODO.bat` es esperado y no es un error: ese paso no cambia el valor vigente. No "arreglarlo" ni forzar precios visibles desde el pipeline.

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

1. **Deploy** — según qué cambió (regla corregida por el dueño el 03-11-2026: antes todo iba por el `.bat` completo porque el token de `data/` rotaba; ya no rota): **solo capa estática** (HTML/CSS/JS/textos de los paneles, `sw.js`; sin tocar scripts del pipeline, SQL ni datos) → `_utilidades\PUBLICAR_ESTATICOS.bat` (valida los JSON, publica solo Hosting con la cuenta de servicio y verifica en vivo); **datos o pipeline** (scripts `.py`/`.ps1`/`.bat`, JSON, catálogo, ventas) → `ACTUALIZAR_TODO.bat`. Siempre desde `E:\ferreteria-oviedo\`; nunca `firebase deploy` suelto ni desde `E:\git-sync`.
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
- JSON vive en la carpeta de token (`data/<token>/catalogo-cotizador.json`); la rotación del token fue eliminada y el token vigente está en `data/.token-actual`

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

### Sesión 2026-09-23 — Pipeline completo corrido (datos frescos + deploy)

**Resumen:** `ACTUALIZAR_TODO.bat` corrido completo como parte de un lote de
mantenimiento del ecosistema — precio/stock, ventas, deploy Firebase, catálogo
bot, commit y push automáticos, todo `[OK]`. Warning no bloqueante ya conocido:
"No se pudo obtener token Firebase: HTTP Error 401" al ajustar visibilidad de
precio (cae a "oculto" por default seguro, ajustar manual en panel admin si
hace falta cambiarlo).

**Commit:** `a36ed08` ("V37 2026-09-23 -- actualizacion automatica")

**Pendiente:** ninguno de esta sesión — investigar en otro momento el 401 del
token Firebase en el ajuste de visibilidad de precio (no urgente, tiene default
seguro).

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

### Registro de corridas (16-10-2026)
- `ACTUALIZAR_TODO.bat` enganchado al registro de corridas del Centro de Control (encabezado de 7 lineas, proyecto `ferreteria`; `E:\CONOCIMIENTO DEL NEGOCIO\control-center\registro`). Cada corrida queda en el calendario con su log (secretos tapados). El .bat paso a fin de linea CRLF (obligatorio para los goto). Respaldo: `E:\_ARCHIVO_FERRETERIA\ferreteria-todo-bat-respaldo-20261016`.
- `--guardar` del blindaje hecho el 16-10-2026 con orden del dueno (0 fallas). Futuros cambios a este .bat volveran a marcar FALLA: NO usar `--guardar` sin su orden expresa.
- Limitacion conocida: en los pasos 1C a 1N y 3.6 el `if %errorlevel% neq 0` esta dentro de bloques con parentesis y no lee el resultado del script (evalua el comando anterior): ni los fallos reales ni los falsos avisos de esos pasos son confiables. CORREGIDO 16-10-2026: esas 9 lineas (177,201,225,249,273,297,321,345,508) ahora usan `if errorlevel 1` (respaldo en E:\_ARCHIVO_FERRETERIA\ferreteria-errorlevel-respaldo-20261016). Solo cambia el diagnostico: desde ahora un fallo real de esos scripts muestra [AVISO] en rojo (antes un falso [OK]); el flujo y los JSON no cambian. Nota: `if errorlevel 1` no detecta codigos negativos. Blindaje guardado el 16-10-2026 (0 fallas).
- **Modo /auto (16-10-2026):** `ACTUALIZAR_TODO.bat /auto` hace el MISMO flujo sin pausas ni preguntas (variable `AUTO_MODE`: salta los 9 `pause`, la espera de 10 s y el `choice`; precios OCULTOS). `ACTUALIZAR_TODO_AUTO.bat` es ahora un lanzador de 5 lineas que lo llama con `/auto` (version anterior de 341 lineas en E:\_ARCHIVO_FERRETERIA\ferreteria-auto-respaldo-20261016). `ACTUALIZAR_GITHUB.bat` tambien respeta `AUTO_MODE` (sin pausas y sin abrir navegador de login). OJO: en /auto el commit y push a GitHub es automatico y desatendido, igual que en el TODO. No existe tarea activa de las 18:00 (verificado 16-10-2026); `_utilidades\ACTIVAR_EN_ESTE_EQUIPO.bat` la recrearia apuntando al AUTO. Sin log propio en logs\auto_*.log: el registro del Centro de Control guarda el log (con datos personales tapados). El AUTO viejo copiaba Datos.json a git-sync antes del deploy; el TODO no lo hace. Blindaje: `--guardar` hecho con orden expresa del dueno el 16-10-2026 (TODO, AUTO y GITHUB); 0 fallas. Baseline anterior respaldado en ferreteria-auto-respaldo-20261016.
- **Corrida real del 16-10-2026 18:42-18:54 (manual, consola, 727 s):** todo OK (precio/stock, ventas, deploy, catalogo bot 6188 productos, commit `d052e1b`); los 9 `if errorlevel 1` pasaron sin `[AVISO]`. Estado `ok_con_avisos` por 2 avisos conocidos y normales (2577 registros con OBS sin sector; 1386 filas sin match cantidad), que `reglas-proyectos.json` ya ignora para el estado. El log guarda `[FILA-CLIENTE-REDACTADA]`, `[TEL]`, `[IP]` y `[EMAIL]` en vez de datos personales.
- **Herramienta de orden (16-10-2026):** `E:\CONOCIMIENTO DEL NEGOCIO\control-center\orden\ORDEN_PROYECTOS.bat` revisa en solo lectura los 9 proyectos (lanzador enganchado y CRLF, rutas citadas en los documentos, HTML al día, sueltos nuevos en la raíz, copias/temporales/obsoletos, logs viejos) y deja un informe en `control-center\orden\informes`. Correrla al abrir y al cerrar cada sesión (`set OVIEDO_NO_PAUSE=1` si se llama desde una IA). FALLA = corregir antes de cerrar; AVISO = revisar y archivar lo obsoleto con MANIFIESTO (mover, no borrar sin orden del dueño).
- **Refresco del bot en Render (resuelto):** el bot descarga `catalogo-bot.json` al arrancar; desde el PASO 5 del `.bat`, `_utilidades\refrescar_catalogo_bot.py` llama `/api/refrescar-catalogo` con el `PANEL_PIN` cifrado (`E:\config\bot_panel_pin.txt.enc`). A mano: `https://oviedo-whatsapp-bot-k6ou.onrender.com/api/refrescar-catalogo?pin=...`.
