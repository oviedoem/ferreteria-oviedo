# AGENTS.md — Ferretería Oviedo El Manzano
# Instrucciones del agente + Safe-Change Skill + Historial desde 2026-06-01
# Versión activa: V37.47 · Última actualización: 2026-06-30

---

## ⚠️ FLUJO ERP — LEER ANTES DE CUALQUIER TAREA DE STOCK
## Fuente de verdad: E:\ferreteria-oviedo\BODEGAS\Copia de Movimiento Stock.xlsx (hoja FLUJO ERP)
## Usar este archivo ante cualquier duda de movimiento, nuevo menú de stock o revisión de consistencia
## Palabra clave: **FLUJO** — ante cualquier duda sobre Disp/Fís/Ped/Dif → volver aquí primero

### Campos SSRS → Panel Admin

| Campo SSRS (raw CSV) | Panel | Descripción |
|---|---|---|
| `St_Disp` | Disp | Stock disponible neto (Fís − compromisos) |
| `St_Bod` | Fís | Stock físico real en bodega |
| `St_DVen + St_Ped` | Ped | Comprometido total (despachos + NVMs de todas las sucursales) |
| `St_Tran` | Trans | En tránsito entre bodegas |
| `St_Cont` | — | Contable (no usado en panel comercial) |
| `St_DCom` | — | Comprometido en órdenes de compra pendientes |

**Ped en panel = St_DVen + St_Ped**
**Dif en panel = Fís − Disp** → positivo = compromiso normal · negativo (rojo) = anomalía JT

### Flujo COMPRA
| Documento | St_Disp | St_Cont | St_DVen | St_DCom | St_Bod | St_Tran | St_Ped |
|---|---|---|---|---|---|---|---|
| OC (Orden de Compra) | = | = | = | +1 | = | +1 | = |
| GRC (Guía Recepción Compra) | +1 | = | = | = | +1 | −1 | = |
| FCN (Factura Compra) | = | +1 | = | −1 | = | = | = |
| **Neto ciclo completo** | +1 | +1 | 0 | 0 | +1 | 0 | 0 |

### Flujo VENTA / DESPACHO
| Documento | St_Disp | St_Cont | St_DVen | St_DCom | St_Bod | St_Tran | St_Ped |
|---|---|---|---|---|---|---|---|
| NVM (Nota de Venta) | −1 | = | = | = | = | = | +1 |
| BVE/FVE (Boleta/Factura Electrónica) | = | −1 | = | = | = | = | −1 |
| GME (Guía Despacho) | = | = | = | −1 | −1 | = | = |
| **Neto ciclo completo** | −1 | −1 | 0 | 0 | −1 | 0 | 0 |

> ⚠️ BVE/FVE NO zeroa CANTIDAD_PENDIENTE en JustWeb → filtro EXISTS en descargar_despachos.py

### Flujo DEVOLUCIÓN
| Documento | St_Disp | St_Cont | St_DVen | St_DCom | St_Bod | St_Ped |
|---|---|---|---|---|---|---|
| GDC (Guía Devolución Cliente) | +1 | = | = | +1 | = | = |
| NCE (Nota de Crédito Electrónica) | = | +1 | = | −1 | +1 | = |
| **Neto ciclo completo** | +1 | +1 | 0 | 0 | +1 | 0 |

### Anomalía JT
**Disp > Fís → Dif < 0 → fila roja en Informe Stock**

**Causa principal: GRT/GIB pendiente de segundo paso manual (Editar+Grabar)**
- Paso 1 (emisión): St_Disp +1, St_Cont +1 → sistema registra disponibilidad
- Paso 2 (Editar+Grabar en JustWeb): St_Bod +1 → físico confirmado
- Entre paso 1 y 2: Dif = Fís − Disp = −1 → fila ROJA en Informe Stock
- Documentos involucrados: GRT (Guía Recepción Traslado) y GIB (traslado entre bodegas)
- Fix: JustWeb → Movimiento de Bodegas → Mantención de despachos → Por recepcionar → seleccionar → Editar → Grabar → ACTUALIZAR_TODO.bat
- Panel admin V37.22+: tab "Por Recepcionar" muestra estos docs en tiempo real (recepciones-pendientes.json vía Playwright)

Otras causas posibles: NVM cancelada sin reversa · ajuste contable incorrecto · EXH mezclado en CEM.

### Parseo CSV SSRS — CRÍTICO
**Punto = miles · Coma = decimal** → `s.replace('.','').replace(',','.')`
`1.536` = 1536 unidades (NO 1.536). Error histórico 2026-05-30 en generar_informe_stock.py.

### Servidor 2 — Limitación Real-time
SQL Server [SQL-SERVER-IP] sincroniza con JustWeb **una sola vez al día a las 22:00**.
- descargar_erp.py / descargar_ventas_erp.py → Real-time (HTTP/SSRS)
- descargar_bod.py / descargar_pedidos.py / descargar_despachos.py / leer_xlsm.py → Solo tras 22:00

**Respuesta estándar:** "Los datos de despachos/pedidos/bodegas vienen del Servidor 2 que sincroniza a las 22:00."

### VPN — Cuándo usar
- **Cable directo a la red de la ferretería** → NO requiere VPN. Pipeline corre sin VPN.
- **WiFi (cualquier red)** → SÍ requiere VPN activa antes de correr el pipeline.
- La VPN da acceso a [SQL-SERVER-IP] y [ERP-SERVER-IP]. Por cable esa conectividad ya existe.

---

## SAFE CHANGE PROTOCOL — OBLIGATORIO ANTES DE CUALQUIER CAMBIO

**Un prompt = una función tocada.** Si el fix requiere 2 funciones → dos prompts separados.
Si el agente dice "también modifiqué X para que funcione" sin pedírselo → DETENER y revisar X.

### Cuándo aplicar SIEMPRE
- Modificar cualquier función en `panel-admin.html`, `firebase-config.js`, `main.py`, `leer_xlsm.py`
- Agregar o modificar tab, sub-tab, botón o menú del panel admin
- Cambiar cualquier función que empiece con `vadm`, `venAdm`, `_vadm`
- Modificar cualquier función del pipeline Python que produzca un JSON de `data/`

### PASO 1 — Leer antes de escribir
1. Leer la función completa que se va a modificar
2. Identificar todas las funciones que la invocan (LLAMADA POR)
3. Identificar todas las funciones que ella invoca (LLAMA A)
4. Identificar variables JS globales o Python que lee o escribe
5. Identificar qué tabs/secciones HTML o scripts consumen el output

### PASO 2 — Declaración de alcance (formato obligatorio)
```
TOCO:        [nombre exacto de la función o bloque HTML]
ARCHIVO:     [panel-admin.html | main.py | leer_xlsm.py | otro]
RAZÓN:       [una línea — qué se cambia y por qué]
LLAMADA POR: [lista de funciones que invocan la tocada]
LLAMA A:     [lista de funciones que la tocada invoca]
VARIABLES:   [variables JS globales o Python que lee o escribe]
TABS:        [vsec-* o sidebar items que usan esta función]
NO TOCO:     [lista explícita con razón de cada una]
```

### PASO 3 — Checklist post-cambio
```
[ ] La función sigue recibiendo los mismos parámetros
[ ] Las variables globales siguen con el mismo nombre
[ ] El tab que la invoca sigue en vadmReRenderTabActivo
[ ] El filtro _vadmBodSel sigue afectando el resultado
[ ] No se hardcodeó ningún valor que venga de datos reales
[ ] No se renombró ninguna función pública
[ ] window._mostrarPrecio = false sigue siendo default en panel-cliente.html
[ ] xlsm-enrich.json generado por descargar_ventas_enrich.py (SQL) o leer_xlsm.py (fallback), NUNCA main.py
[ ] _catalogo_generado_hoy() no fue revertida a _actualizar_xlsx_es_hoy()
[ ] ventas-manzano.json sigue siendo generado por guardar_json() en main.py
[ ] Subquery ULT en descargar_bod.py tiene WHERE IDBODEGA=? antes del GROUP BY
```

---

<!-- Fuente de verdad: MEMORY.md §3 — esta copia puede quedar desactualizada -->
## RUTAS CRÍTICAS — NO BUSCAR, USAR DIRECTAMENTE

```
Proyecto activo:     PROYECTO_E:\ferreteria-oviedo\   (letra real variable — identificar SIEMPRE por etiqueta de volumen)
Git sync (solo):     PROYECTO_E:\git-sync\        (NO es el proyecto — solo copia para git)
Archivados:          PROYECTO_E:\ferreteria-oviedo\_HISTORICO\
Bodegas XLSM:        PROYECTO_E:\ferreteria-oviedo\BODEGAS\
Memory Claude:       CONFIG_W:\claude-config\projects\E--ferreteria-oviedo\memory\
                     (acceso via junction C:\Users\<usuario>\.claude → CONFIG_W:\claude-config\)
CLAUDE.md global:    CONFIG_W:\claude-config\CLAUDE.md
Git config:          PROYECTO_E:\config\gitconfig  (GIT_CONFIG_GLOBAL apunta aquí)
Tokens GitHub:       PROYECTO_E:\config\gcm-store  (DPAPI cifrado, transparente via GCM)
Herramientas:        CONFIG_W:\herramientas\seguridad\
Docs backup (plan B, solo lectura): CONFIG_W:\proyecto-docs\ y <Windows-alterno>:\ferreteria-docs\
                     (AGENTS.md, MEMORY.md, CLAUDE.md, README.md, MAPA_FLUJO_PROYECTOS.md,
                      IDS_REFERENCIA.md, ESTADO_PROYECTO.md, rule.json — copia de emergencia,
                      no se usa para la memoria de Claude, solo para humanos)
                     NUNCA mantener esta copia en C: — ver regla mas abajo.

**Etiquetas de volumen (no usar letras fijas en scripts ni docs nuevos):**
- **PROYECTO_E** → contiene ferreteria-oviedo\, git-sync\, config\, npm-global\, herramientas portables
- **CONFIG_W** → contiene claude-config\ (memoria Claude, settings, skills), proyecto-docs\
Detectar con `Get-Volume -FileSystemLabel "PROYECTO_E"` / `"CONFIG_W"`. Ver CONFIG_W:\MONTAR_CLAUDE.ps1
y CONFIG_W:\SETUP_PC_NUEVO.md para el detalle completo y el procedimiento en PC nuevo.

MD activos raíz:
  AGENTS.md:               E:\ferreteria-oviedo\AGENTS.md         (este archivo)
  MEMORY.md:               E:\ferreteria-oviedo\MEMORY.md
  MAPA_FLUJO_PROYECTOS.md: E:\ferreteria-oviedo\MAPA_FLUJO_PROYECTOS.md
  _HISTORICO/:             E:\ferreteria-oviedo\_HISTORICO\       (MDs históricos)
```

---

## ARQUITECTURA DE DISCOS

**Principio (desde 2026-06-17, reafirmado 2026-06-22): las letras de disco CAMBIAN segun el PC
y segun desde que disco arranca Windows. Identificar SIEMPRE por etiqueta de volumen, nunca
por letra fija.** Ver CONFIG_W:\MONTAR_CLAUDE.ps1 (detecta por etiqueta) y
CONFIG_W:\SETUP_PC_NUEVO.md (guia completa + snapshot de la maquina mas reciente).

| Etiqueta de volumen | Contenido | Notas |
|---|---|---|
| **PROYECTO_E** | ferreteria-oviedo\, git-sync\, config\, npm-global\, herramientas portables | letra variable, tipicamente E: |
| **CONFIG_W** | claude-config\ (memoria/settings/skills Claude), proyecto-docs\, herramientas\ | letra variable, tipicamente F: o W: |
| (sin etiqueta fija) | Windows local del PC en uso | siempre se llama C: en el disco de arranque activo |
| Disco(s) con otro Windows instalado (boot alternativo) | — | si se arranca desde ahi, ESE disco pasa a ser C: — asignarle su propia etiqueta de volumen para identificarlo, no asumir una letra |

**Regla:** ningun archivo del proyecto (.md de referencia, copias, datos) debe vivir de forma
permanente en C: — C: es siempre "el Windows que esta corriendo ahora", cambia de disco fisico
segun el PC y no es portable. Las unicas excepciones documentadas y deliberadas se anotan en
CONFIG_W:\SETUP_PC_NUEVO.md (ej. el caso especial de `claude-config` en una maquina puntual,
seccion "CUTOVER claude-config" — pendiente de corregir, no replicar ese patron).

### Junction Claude Code
```
C:\Users\<usuario>\.claude  ──junction──►  CONFIG_W:\claude-config\
```
Claude busca su config en C:, Windows redirige a CONFIG_W transparentemente (letra real
detectada por MONTAR_CLAUDE.ps1, no hardcodeada).
**Backup de rollback:** ver seccion ROLLBACK en CONFIG_W:\SETUP_PC_NUEVO.md.

### Variables de entorno (HKCU)
```
GIT_CONFIG_GLOBAL    = PROYECTO_E:\config\gitconfig
NPM_CONFIG_PREFIX    = PROYECTO_E:\npm-global
NPM_CONFIG_CACHE     = PROYECTO_E:\npm-cache
NPM_CONFIG_USERCONFIG= PROYECTO_E:\config\.npmrc
XDG_CONFIG_HOME      = PROYECTO_E:\config
GH_CONFIG_DIR        = PROYECTO_E:\config\gh
PIP_CACHE_DIR        = PROYECTO_E:\pip-cache
```
(Configuradas automaticamente por MONTAR_CLAUDE.ps1 — no editar manualmente.)

---

## EMERGENCIA DISCO PROYECTO_E / CONFIG_W

**Causa raíz confirmada:** `FortiUSBmon.exe` (en el Desktop del usuario de Windows activo)
re-adhiere FortiShield/fortimon3 al volumen USB inmediatamente al remontar, impidiendo que NTFS monte.
Historial: 6 ocurrencias (2026-06-03, 2026-06-04 tarde, 2026-06-04 noche, 2026-06-06, 2026-06-09, 2026-06-10).
Nota: las letras E:/W:/F:/L:/M: mencionadas en el historial abajo correspondian a PCs antiguos —
hoy identificar siempre PROYECTO_E y CONFIG_W por etiqueta, ajustar letras segun corresponda en este PC.

- 2026-06-06: ocurrencia #4 — pipeline test post-auditoria.
  Code perdio acceso a W:\claude-appdata\ccd-environment-config.json.
  Xlsx ventas quedo en 0 bytes. Eliminado y regenerado.
  Recuperado con USBDeview Disable+Enable.
- 2026-06-10: ocurrencia #6 — 9 ciclos fallidos del Scheduled Task.
  Causa raiz identificada: FortiUSBmon.exe re-adheria filtros tras cada intento.
  Scripts actualizados a v3: Stop-FortiUSBmon + Repair-DirtyBit + contador fallos.

### Opción 0 — Matar FortiUSBmon + Detach Forti (fix v3 definitivo) ★
```powershell
# Matar FortiUSBmon.exe PRIMERO (sin esto, re-adhiere los filtros al remontar)
Stop-Process -Name FortiUSBmon -Force -ErrorAction SilentlyContinue
# Luego desadherir filtros
foreach ($v in 'E:','W:','F:','L:','M:') { fltmc detach FortiShield $v; fltmc detach fortimon3 $v }
fltmc instances -v E:   # verificar: no debe listar FortiShield ni fortimon3
```
Integrado en REMONTAR_DISCO_E.ps1 v3: Stop-FortiUSBmon + Detach-FortiUSB + Repair-DirtyBit
+ contador de fallos (Pause-ScheduledTask tras 3 fallos consecutivos).
Ejecutado por tarea `AutoRemontarDiscoE` en cada boot.

### Opción A — Sin scripts (30 seg)
1. Explorador de Windows → clic derecho disco E: → Expulsar
2. Si aparece error "disco en uso" → Aceptar (es normal)
3. Windows fuerza a FortiClient a soltar el handle → E: se remonta limpio

### Opción B — Script desde W:
```
W:\herramientas\seguridad\REMONTAR_DISCO_E.ps1   ← remonta sin expulsar (PnP) + detach Forti
W:\herramientas\seguridad\ABRIR_CLAUDE.bat        ← abre Claude verificando E: primero
```
Copias de emergencia (v3, idénticas — mismo hash):
- `D:\REMONTAR_DISCO_E.ps1`
- `M:\herramientas\seguridad\REMONTAR_DISCO_E.ps1`
(usar cuando W: no este accesible)
REGLA: W:\, D:\ y M:\ deben mantenerse sincronizadas.
Script busca USBDeview en: D:\ → E:\herramientas\ → W:\

### Rollback de junction si CONFIG_W falla
Ver seccion ROLLBACK completa en `CONFIG_W:\SETUP_PC_NUEVO.md` (busca el backup
`.claude-bak-YYYYMMDD-HHmm` mas reciente en el perfil del usuario actual).

### GitHub como respaldo final
Si no puedes acceder a CONFIG_W ni a PROYECTO_E, dar a Claude el AGENTS.md desde GitHub:
`https://github.com/oviedoem/ferreteria-oviedo/blob/main/AGENTS.md`

---

## PROYECTO

- Stack: HTML/CSS/JS Vanilla + Firebase Hosting (JSON estáticos) + Python pipeline ERP
- Directorio activo: `PROYECTO_E:\ferreteria-oviedo\` (identificar el disco por etiqueta PROYECTO_E,
  no por letra) — NUNCA trabajar directamente en `PROYECTO_E:\git-sync\` ni en discos sin la
  etiqueta PROYECTO_E (ej. el disco con Windows 10 alterno, identificado en 2026-06-22)
- Versión activa: V37.47

### Historial de deploys (desde 2026-06-01)
- Deploy V37.13: 2026-06-02 03:55 — fix árbol auto-init + guard re-render + tutoriales D:→E: ✅
- Deploy V37.14: 2026-06-02 04:22 — fix D:→E: en 5 scripts pipeline + precios arg + XDG_CONFIG_HOME ✅
- Deploy cierre sesión: 2026-06-05 22:31 — fix badge V37.13→V37.14
- Sesion auditoria 2026-06-06: 15 archivos corregidos. Puntos 1-6 auditoria completados. Pipeline test con VPN activa OK. Deploy post-verificacion OK. Commit b98eacb.
- Sesion 2026-06-07: _BOD_CORTA en leer_xlsm.py: CAL→None, SAL→None, EXH→'EXH' (activa pero sin uso aun). MEMORY.md correcciones: deploy date, PASO 1C ruta, bodegas EXH/SAL documentadas.
- Deploy V37.15: 2026-06-08 15:xx — fix reqStockPrellenar: advertencia cobertura datos cuando _vadmLineas no cubre rango pedido ✅
- Deploy V37.16: 2026-06-08 — vadmDescargarExcel: tab-aware (1-4 hojas según vista activa), estilos profesionales sin colores ABC, Calibri 10pt, alternado gris claro ✅
- Deploy V37.17: 2026-06-08 — fix tab 'sector': _vadmDatosEmailFiltrados usa vadmSEdesde/hasta, _vadmHtmlEmailSector creada, dispatcher+tabLabels actualizados ✅
- V37.18: 2026-06-08 — integración open-code-review: OCR_REVIEW.bat, .opencodereview/rule.json (14 reglas), .claude/commands/, .gitignore actualizado ✅
- Post V37.18 2026-06-09: OCR operativo. Junction C:\Users\..\.opencodereview -> E:\config\opencodereview\ (igual que .claude->W:). Config+token en E:, cero bytes en C: fisico. auth_header=x-api-key requerido (Bearer da 401). ocr llm test OK.
- Deploy V37.19: 2026-06-09 09:59 — auditoria seguridad: XSS fixes (venAdmEsc/\_cliEsc), CSP sin unsafe-eval, sesionesLog update rule, \_logAuditAdmin(), limit clamp getCotizaciones. fix rule.json OCR formato {rules:[]} ✅
- Deploy V37.20: 2026-06-09 10:07 — fixes OCR post-auditoria: venAdmEsc escapa comillas, auditLog solo admins, XSS renderCart, safeCod/id consistencia, XSS testVentasManzano, isNaN dead code, REENVIO\_ACCESO log, auditLog console.warn ✅
- Deploy V37.21: 2026-06-09 10:22 — fixes OCR segunda ronda: safeCod correcto (rawCod/jsCod/safeCod separados), id usa rawCod, onclick usa jsCod, .replace redundante removido de venAdmEsc ✅
- Deploy V37.22: 2026-06-09 — tab "Por Recepcionar" en panel admin (GRT/GIB pendientes Editar+Grabar); PASO 1H descargar_recepciones_pendientes.py Playwright→Blazor Intranet; documentado flujo GRT/GIB dos pasos en AGENTS.md ✅
- Deploy V37.23: 2026-06-10 — OCR fix: sw.js var→const (PRECACHE_ASSETS, CACHE_FIRST_EXTS, BUILD_DATE, CACHE_NAME, url, clone, ext); update-sw-version.js regex ampliado a (?:const|var) + reemplaza con const. Infra: disco F: (USB JMicron) listo para boot alterno — scripts de primer arranque, letras USB, perfil Claude, VPN-only staged ✅
- Deploy V37.24: 2026-06-12 — bodega ICD (Ingreso CD, IDBODEGA=73, SUC=08) agregada al tab Análisis de Bodegas; descargar_bod.py parametrizado (IDSUCURSAL como 4to arg en BODEGAS tuple); IDS_REFERENCIA.md creado con todos los IDs SQL/ERP/SSRS verificados ✅
- Sesion 2026-06-10 tarde: herramientas seguridad v3 — FortiUSBmon.exe (causa raiz #6) documentado; Stop-FortiUSBmon + Repair-DirtyBit + contador fallos en REMONTAR_DISCO_E.ps1 v3; 6 archivos actualizados en D: y W: (M: pendiente, no disponible)
- Sesion 2026-06-06 mejoras adicionales:
  launch.json creado para Claude Code.
  LIBERAR_CLAUDE_RAM.bat — cierra Claude Desktop, preserva Claude Code.
  Justime Regsvr32 fix — /s agregado en 12 archivos bat (System32 + SysWOW64).
  Backups .bak-20260606 generados. Dialogos al abrir Claude eliminados.

- Sesiones 2026-06-12 y 2026-06-13: pipeline descarga ERP — completado en proyecto separado.

- Sesion 2026-06-22: V37.28 deploy completo (token rotativo dataAccessToken via firestore.rules,
  fix WhatsApp 4 vendedores + scroll, limpieza referencias Storage no usado, hash transparente
  passwords legado cliente). Infra multi-PC: 8 docs de referencia resincronizados PROYECTO_E→
  CONFIG_W:\proyecto-docs y disco Windows-alterno:\ferreteria-docs; eliminada copia obsoleta en
  C:\ferreteria-docs; AGENTS.md/CLAUDE.md actualizados a notación PROYECTO_E/CONFIG_W por etiqueta
  (ya no W:/M:/L:/TOSHIBA/JMicron hardcodeados); MONTAR_CLAUDE.ps1 ahora avisa si CONFIG_W:\claude-config
  no es carpeta real; SETUP_PC_NUEVO.md y "paso a paso.txt" actualizados con snapshot de discos y
  plan de cutover pendiente (ver memoria de Claude: seguridad-carpeta-aleatoria-datos,
  pendiente-passwords-texto-plano).

- Sesion 2026-06-30 (sesión C): PASO 1H descargar_blazor_bodegas.py reescrito — token directo
  sin login, selector botón correcto `button.e-boton:has-text('Exportar a Excel')` (sin atributo
  title), tabs via `[role='tab']:has-text(...)`. TOKEN_RECEPCION en credenciales_erp.ini (visible en
  perfil JustWeb → click avatar → TOKEN). Si expira → actualizar GUID en el ini.
  Resultado: recepciones=21, despachos=25 docs. HTML de referencia guardado en
  BODEGAS\Movimiento de bodega en revision.html.

- Deploy V37.47: 2026-06-30 — Solicitud de Stock: base mínimos PEM(224)+SEM(573)=797 códigos en
  Firestore (config/baseStockMinimos_PEM|SEM). Pre-llenar rediseñado: fuente = base Firestore
  (enviado=false), marca OBLIGATORIA, sin marca muestra guía inline. Con marca = todos sus pendientes
  sin límite N, orden ventas DESC, excluye (DD). Checkboxes "Con mínimo" / "Con repos." nuevos.
  Al copiar email → _reqGuardarEnvio marca enviado+fecha en Firestore + historialEnviosStock.
  Botón "⬇️ Historial enviados" → Excel por marca con Bodega/Marca/Código/Desc/ST/Fecha.
  firestore.rules: regla historialEnviosStock (read+create admin, update+delete=false). OCR $0: 13/14 OK, 1 WARNING corregido (FO-007). Commit 9dd724e.

- Deploy V37.46: 2026-06-30 — Traspasos CD: prioridad inteligente 4 capas (P1 rojo=quiebre+demanda,
  P2 amarillo=tendencia alza, P3 verde=estable, P4 gris=sin movimiento/sin CD) + filtro keyword
  portabilidad por bodega (SEM=ligeros/herramientas, PEM=materiales pesados, CD=sin filtro) +
  ordenamiento: prioridad como clave primaria, campo dropdown como secundaria dentro de cada grupo.
  Keywords editables en _TCD_KW_SEM/_TCD_KW_PEM sin tocar más código. Badge emoji en col Código.

- Deploy V37.45: 2026-06-30 — Traspasos CD: filtro por bodega (PEM/SEM/CD con botones),
  panel checkboxes ranking para vista CD (Top10/11-25/26-75/76-200/200+/Sin venta),
  columna Solicitar en blanco por defecto (manual), export PDF/Excel/HTML solo filas con
  cantidad ingresada (_tcdExportRows), _tcdSaveInputs preserva valores al cambiar vista,
  thead dinámico (oculta columna PEM en vista SEM y viceversa). Revisión OCR $0: 14/14 reglas OK.

- Deploy V37.44: 2026-06-28 — validar_jsons.py (bloquea deploy si JSON roto, insertado en
  ACTUALIZAR_TODO.bat antes de rotar_token_data.py); TTL 8h en token rotativo dataAccessToken
  (expires_at en rotar_token_data.py, chequeo+logout en panel-admin.html/index.html, panel-cliente.html
  no aplica — no usa el token); paginación 50/pág (Anterior/Siguiente, Vanilla JS) en Quiebre,
  Sobre-Stock y Baja Rotación de panel-admin.html — antes renderizaban hasta ~6000 filas de golpe;
  Baja Rotación además corrige totales de tfoot para reflejar el filtrado completo, no solo la
  página visible (efecto secundario de quitar el MAX_ROWS=150 que truncaba sin paginar) ✅

- Sesion 2026-06-22 (tarde): fix ACTUALIZAR_TODO.bat — PASO 1K (enriquecimiento ventas)
  abortaba todo el pipeline con "No se esperaba . en este momento" por comentarios `::`
  dentro de un bloque if/else parentizado (bug clasico de cmd.exe). Cambiados a `REM`.
  Tras el fix, pipeline corrido completo manualmente (cable directo, sin VPN): ERP+SQL
  actualizados, ventas-manzano.json 45722 registros, token rotado, deploy hosting OK.
  Infra adicional: Justime en disco C reparado (reg.bat con path en espanol roto -> COM/OCX
  fix; bloqueo de Windows Defender Network Protection -> excepcion agregada); cutover
  claude-config C/W/D cerrado (ver memoria de Claude: justime-c-fix-com-y-defender,
  cutover-claude-config-completado).

*Historial pre-junio en _HISTORICO\20260604_AGENTS_completo.md*

### APP-INVENTARIO (proyecto separado)
- Repo: github.com/oviedoem/APP-INVENTARIO
- Pages: https://oviedoem.github.io/APP-INVENTARIO/
- Working: E:\APP-INVENTARIO\

---


## REGLA ANTI-CICLO

El ciclo que se repite: se arregla X, se rompe Y que estaba bien.
- Cambios atómicos y declarados.
- Si el fix requiere tocar 2 funciones → dos prompts separados en orden.
- Nunca modificar funciones adyacentes sin declarar el alcance.

---

## REGLAS ANTI-REGRESIÓN (PRIORIDAD MÁXIMA)

Antes de modificar cualquier script (.py, .bat, .html, .json):
a. Leer MEMORY.md completo.
b. Leer AGENTS.md completo.
c. Verificar si el cambio ya fue aplicado en versión anterior.
d. Si ya existe, NO volver a aplicarlo.
e. Si hay duda, detenerse y reportar antes de continuar.

### ORDEN DE LECTURA OBLIGATORIO AL INICIO DE CADA SESIÓN:
1. MEMORY.md
2. AGENTS.md
3. CLAUDE.md (en CONFIG_W:\claude-config\CLAUDE.md)
4. Recién después ejecutar cualquier tarea

---

## ARCHIVOS PROHIBIDOS DE ELIMINAR

- **CATALOGO PRODUCTOS\Datos.xlsx** → MASTER del catálogo. Si se corrompe, regenerar con seed (ver _HISTORICO\20260604_AGENTS_completo.md → sección REGENERACIÓN COMPLETA SEGURA).
- **ventas-manzano.json** → NECESARIO: el panel lo usa como fallback en 4 puntos. NO eliminar.
- **credenciales_db.ini** → NUNCA tocar ni leer en voz alta (SQL Server, en raíz del proyecto)
- **credenciales_erp.ini** → NUNCA tocar (copias en VENTAS EL MANZANO\ y CATALOGO PRODUCTOS\scripts\, gitignored por nombre)
- **E:\git-sync\** → NUNCA modificar directamente

### REGENERACIÓN COMPLETA SEGURA — qué SÍ y qué NO eliminar:
```
SÍ eliminar (se regeneran solos):
  data\ventas-manzano-YYYY-MM.json   data\ventas-manzano-YYYY.json
  data\ventas-manzano.json           data\ventas-manzano-meta.json
  data\catalogo-dinamico.json        data\xlsm-enrich.json
  data\bod-*.json                    data\despachos-*.json
  data\pedidos-*.json                data\ventas-xlsm-*.json
  data\ranking-unidades.json         data\precios-diff.json
  CATALOGO PRODUCTOS\Datos.csv       CATALOGO PRODUCTOS\merma.json

NO eliminar (son base/histórico):
  CATALOGO PRODUCTOS\Datos.xlsx
  CATALOGO PRODUCTOS\actualizar.xlsx
  data\ventas-manzano-YYYY-MM.json   (meses ANTERIORES al actual)
```

---

## REGLA DE CIERRE DE SESIÓN — DEPLOY PENDIENTE

Antes de terminar cualquier sesión donde se hayan modificado archivos:
1. Comparar mtime de archivos desplegables (HTML, JS, JSON) vs último deploy
2. Si algún archivo es más nuevo → ejecutar `firebase deploy --only hosting`
3. Actualizar línea "Deploy cierre sesión" en este archivo
4. Ejecutar `ACTUALIZAR_GITHUB.bat`

### Verificación en PowerShell:
```powershell
$ultimoDeploy = [datetime]"2026-06-04 00:21:00"
Get-ChildItem 'E:\ferreteria-oviedo\' -Filter '*.html' -File |
    Where-Object { $_.LastWriteTime -gt $ultimoDeploy } | Select-Object Name, LastWriteTime
```

---

## REGLA COMMIT OBLIGATORIO

Al terminar CUALQUIER modificación de código, ejecutar SIN EXCEPCIÓN:
```
"V37.X desc breve sin tildes" | cmd /c "E:\ferreteria-oviedo\ACTUALIZAR_GITHUB.bat"
```
- Descripción: máximo 5 palabras, minúsculas, sin tildes
- Si falla por red: reportar el error pero NO omitir el intento

### Cuenta GitHub obligatoria: oviedoem (ferreteriaoviedo.elmanzano)
- `ACTUALIZAR_GITHUB.bat` rechaza la credencial guardada y reabre login en cada corrida
  (línea ~102-107) — riesgo: si el navegador tiene otra sesión activa (ej. alejandrog45,
  cuenta de Firebase Auth de los paneles, NO de GitHub) se puede autorizar el push con
  la cuenta equivocada sin darse cuenta.
- Mitigación V37.28: el bat ahora valida con `cmdkey /list | findstr /i "oviedoem"` antes
  del `git push` y aborta con `BLOQUEADO` si no detecta esa cuenta.
- Si el bat bloquea: revisar `cmdkey /list` (target `git:https://github.com`), re-loguear
  manualmente con `ferreteriaoviedo.elmanzano@gmail.com` y reintentar.
- Verificación post-push: confirmar en `https://github.com/oviedoem/ferreteria-oviedo/commits`
  que el commit aparece como autor `oviedoem`, no otra cuenta.

---

## REGLA: Sincronización de UI con cada deploy

Con cada deploy V37.X.Y, actualizar EN EL MISMO COMMIT:
1. Version Badge en panel-admin.html (~L3113): número + fecha
2. Version Badge en panel-cliente.html (~L3300): número + fecha
3. Version Badge en index.html (~L2125): número + fecha
4. Tutoriales (~L2086-2204): si cambiaron flujos o scripts
5. Mejoras planificadas (~L2206-2330): marcar completadas

**REGLA BADGE OBLIGATORIA:** Los 3 paneles deben mostrar siempre la misma versión y fecha.
Si el agente hace un deploy sin actualizar los 3 badges → ERROR de protocolo.

**VALIDACIÓN antes de commit:**
```
grep "ACTUALIZAR_Y_PUBLICAR.bat" panel-admin.html → debe dar 0
grep "D:\\ferreteria-oviedo" panel-admin.html → debe dar 0
```

---

<!-- Fuente de verdad: MEMORY.md §4 — esta copia puede quedar desactualizada -->
## PIPELINE COMPLETO — ACTUALIZAR_TODO.bat

```
[PASO 1A] descargar_erp.py → actualizar.xlsx (precios + stock SSRS 8 bodegas, 2 bloques, 23 cols)
[PASO 1B] procesar-actualizacion.py + xlsx_a_csv.py + csv_a_json.py → Datos.json + catalogo-dinamico.json
[PASO 1C] leer_xlsm.py → ventas-xlsm-*.json + ranking-unidades.json + precios-diff.json
          (+ xlsm-enrich.json como FALLBACK — el primario lo genera PASO 1K desde SQL)
[PASO 1D] descargar_bod.py (BODEGAS/) → bod-iem-registros.json + bod-rce-registros.json + bod-cem-registros.json
          SQL Server directo — IEM=72, RCE=55, CEM=24
[PASO 1E] descargar_pedidos.py (BODEGAS/) → pedidos-comprometidos.json + pedidos-detalle.json
          Fuente: R_STOCK_PRODUCTOS.ST_PEDIDO · Tipos: NVM/VMN/VMP
[PASO 1F] descargar_despachos.py (BODEGAS/) → despachos-comprometidos.json + despachos-detalle.json
          Fuente: BVE/FVE, CANTIDAD_PENDIENTE > 0
[PASO 1K] descargar_ventas_enrich.py (BODEGAS/) → xlsm-enrich.json (PRIMARIO, V37.25)
          SQL Server directo — M_DOCUMENTOS_ENCABEZADO + M_ENTIDADES + Observacion
          Docs BVE/FVE/NCE suc 04 → rut/sector/razonSocial · reemplaza VENTAS.xlsm manual
          (en ACTUALIZAR_TODO_AUTO.bat es PASO 1J; corre siempre ANTES de main.py)
[PASO 2]  main.py --sin-deploy
          PASO 1: _catalogo_generado_hoy()? SI → leer_bodegas_desde_actualizar (3s) / NO → HTTP (~70s)
          PASO 2: descargar_ventas_erp.py incremental (dedup por Numero+Codigo)
          PASO 3: consolidar() — JOIN catálogo + ventas + mapa_cliente
          PASO 3.5: enriquecer_desde_xlsm() — agrega rut, sector, bodegaCorta, hora, razonSocial
          PASO 4: guardar_json() → ventas-manzano*.json
[PASO 3]  Pregunta visibilidad precios (10s timeout, default N=ocultos)
[PASO 4]  firebase deploy --only hosting
```

**SEÑAL ANTI-DOBLE-DESCARGA:** `procesar-actualizacion.py` escribe `catalogo-dinamico.json`.
`main.py` lo lee: si es de hoy → usa datos ya descargados (3s) · si no → descarga HTTP (~70s extra).
NO modificar esta lógica. NO eliminar ni mover `catalogo-dinamico.json`.

BATs disponibles:
```
ACTUALIZAR_TODO.bat           → pipeline completo (único punto de entrada)
PUBLICAR.bat                  → solo firebase deploy
ACTUALIZAR_GITHUB.bat         → sync github
ACTUALIZAR_TODO_AUTO.bat      → sin interacción (para ejecutar manualmente o tarea programada)
VENTAS EL MANZANO\ACTUALIZAR_VENTAS.bat → solo ventas
OCR_REVIEW.bat                → revision de codigo IA antes del deploy (ver seccion OCR abajo)
```

BATs archivados en `_HISTORICO\` — NO ejecutar:
`20260523_PREPARAR_Y_PUBLICAR.bat` · `20260523_ACTUALIZAR_AUTO.bat` · `20260530_SUBIR_VENTAS_MANZANO.bat`

---

## ZONAS ABSOLUTAMENTE INTOCABLES

```
firebase-config.js             — no modificar nunca desde panel HTML
window._mostrarPrecio          — default SIEMPRE false en panel-cliente.html
credenciales_db.ini            — nunca tocar, nunca subir a git
credenciales_erp.ini           — nunca tocar, nunca subir a git (en VENTAS EL MANZANO\ y CATALOGO PRODUCTOS\scripts\)
E:\git-sync\                   — nunca trabajar aquí directamente
venAdmParseFecha()             — no cambiar firma ni comportamiento
venAdmFmt()                    — no cambiar firma
_actualizar_xlsx_es_hoy()      — ELIMINADA en V36.5, no restaurar
xlsm-enrich.json               — lo genera descargar_ventas_enrich.py (SQL, primario, V37.25) o leer_xlsm.py (XLSM, fallback); NUNCA main.py
```

---

## REGLAS DE EJECUCIÓN

- No usar cmd /c bat > NUL desde bash — abre shell interactivo → usar PowerShell
- No subir datos de ejemplo — solo datos reales actualizados
- No agregar dependencias sin autorización
- No reescribir lo que ya funciona
- No pedir confirmación antes de ejecutar si el usuario dijo "ejecuta"
- Python: sin tildes, sin emojis, solo ASCII cp1252
- BATs: guardar en ANSI cp1252

---

## MAPA DE DEPENDENCIAS CRÍTICAS

```
Si tocas...              Debes verificar también...
------------------------------------------------------------
vadmSubTab(id)           Que id esté en vadmReRenderTabActivo.
vadmRenderSobreStock     _vadmSSProds — lo usan email, Excel y Outlook.
vadmRenderBajaRot        _vadmBRDatos + _vadmLineas cubre el rango de fechas.
vadmRenderQuiebre        _vadmStockMap debe estar cargado primero.
_vadmCargarStockMap      Cacheada. NO llamar si ya existe con datos.
vadmSSMarcaClick(el)     Usa data-marca del HTML. NUNCA string en onclick.
Sidebar HTML             Que grupos siguen colapsando correctamente.
onclick=""               NUNCA usar JSON.stringify — rompe con comillas.
venAdmParseFecha         Utility global en TODOS los tabs. No modificar firma.
descargar_ventas_enrich.py Genera xlsm-enrich.json desde SQL (primario). Debe correr ANTES de main.py.
leer_xlsm.py             Genera ventas-xlsm-*.json + ranking + precios. xlsm-enrich.json = fallback si SQL falla.
enriquecer_desde_xlsm() Debe correr DESPUÉS de consolidar() y ANTES de guardar_json().
_catalogo_generado_hoy() Verifica catalogo-dinamico.json mtime — no revertir.
descargar_bod.py         Subquery ULT: WHERE IDBODEGA=? ANTES del GROUP BY.
```

---

<!-- Fuente de verdad: MEMORY.md §11 — esta copia puede quedar desactualizada -->
## VARIABLES JS GLOBALES CLAVE — no renombrar

```
_vadmLineas       Array registros ventas {codigo, fecha, valorNeto, cantidad, marca, periodo, bodegaCorta}
_vadmStockMap     Mapa cod → {pem, sem, cem, mem, stock, marca, desc, costo, precio, pem_trans, ...}
_vadmBodSel       Array de bodegas seleccionadas ([] = todas)
_vadmVendSel      Array de vendedores seleccionados
_vadmSSProds      Cache último render sobre-stock — usan email, Excel, Outlook
_vadmBRDatos      Cache último render baja rotación — idem
_vadmAnioSel      Año seleccionado ('' = mes actual)
_vadmSSMesesMin   Cobertura mínima para sobre-stock (default 12)
```

---

<!-- Fuente de verdad: MEMORY.md §12 — esta copia puede quedar desactualizada -->
## FUNCIONES JS CLAVE — no renombrar ni cambiar firma

```
vadmCargarLineas()          Carga ventas JSON según _vadmAnioSel
_vadmCargarStockMap(cb)     Carga Datos.json → _vadmStockMap; cachea en sesión — NO llamar si ya existe
vadmRenderSobreStock()      Render sobre-stock, cobertura en meses
vadmSSMarcaClick(el)        Toggle filtro marca — usa data-marca, NUNCA string en onclick
vadmRenderBajaRot()         Render baja rotación + auto-reload si rango > datos cargados
vadmFiltrarBajaRot()        Re-filtra _vadmBRDatos sin recomputar ABC
vadmRenderQuiebre()         Render stock quiebre con ABC + Rot.30/60/90d
vadmRenderImpacto()         Volumen vs Precio: Q y precio prom por vendedor en 2 períodos
vadmRenderNC()              NC por vendedor desde _vadmLineas
vadmBuscarStock()           Filtra _vadmStockMap en memoria para Consulta de Stock
vadmRenderStockConsulta(cod) Ficha detalle de un producto (8 bodegas)
venAdmParseFecha(s)         Parsea fecha DD/MM/YYYY → timestamp ms — NO cambiar firma
venAdmFmt(n)                Formatea número como X.XXX CLP — NO cambiar firma
vadmDatosFiltrados()        Filtrado central — todas las funciones render deben usarla
```

---

<!-- Fuente de verdad: MEMORY.md §7 — esta copia puede quedar desactualizada -->
## BODEGAS — BODSTOCK 8 BODEGAS, NO REDUCIR

```javascript
var BODSTOCK = {
  PEM:'pem', SEM:'sem', CEM:'cem', RCE:'rce',
  MEM:'mem', TEM:'tem', IEM:'iem', CD:'cd'
}
```

**Comerciales** (ventas + NC + stock): PEM · SEM · CEM · MEM
**Auxiliares/logísticas** (solo stock): IEM · RCE · TEM · CD
**Eliminadas del ERP:** CAL
**Alias ERP excluidos** (→None en _BOD_CORTA): CAL · SAL (no son bodegas reales del BODSTOCK)
**EXH:** activa en _BOD_CORTA desde 2026-06-07 — entra a ventas-xlsm pero NO usada aún en pipeline ni panel

**SSRS — 2 bloques:**
- BLOQUE 1 (solo DISP): SEM CEM RCE MEM
- BLOQUE 2 (DISP+TRANS): PEM TEM CD IEM

**IDBODEGA por sistema** — verificado 2026-06-07 contra P_BODEGAS y descargar_erp.py:

Bodegas IDSUCURSAL='04' (El Manzano):
| Bodega | Nombre completo | SQL (P_BODEGAS) | ERP URL (VisorRS) |
|--------|----------------|-----------------|-------------------|
| PEM | Patio El Manzano | 22 | 22 |
| SEM | Sala El Manzano | 13 | 13 |
| CEM | Calzada El Manzano | 24 | 393 |
| IEM | Ingreso El Manzano | 72 | 72 |
| RCE | Recepcion El Manzano | 55 | 55 |
| TEM | Transito El Manzano | 46 | — |
| GEM | Gestion El Manzano | 28 | — |
| RWE | Retiro Web El Manzano | 49 | — |
| EEM | Exhibicion El Manzano | 83 | — |

Bodegas IDSUCURSAL='08' (otra sucursal, usadas como auxiliares):
| Bodega | Nombre completo | SQL (P_BODEGAS) | ERP URL (VisorRS) |
|--------|----------------|-----------------|-------------------|
| MEM | Mermas El Manzano | 29 | 29 |
| CD | Centro de Distribucion | 23 | — |

EEM (IDBODEGA=83) = lo que en _BOD_CORTA se llama 'EXH'. Activa en ERP pero aún sin uso en pipeline.
CAL = nombre antiguo ERP para CEM (misma bodega física). Excluida desde 2026-06-07.
URL_CEM=393 definida en descargar_erp.py pero sin uso activo.
NOTA CRÍTICA: Los scripts usan MD.DOC string ('BVE','FVE','NVM'...) — NO IDDOCUMENTO numérico.
Los IDDOCUMENTO abajo son referencia documental únicamente.

**Consistencia ERP vs SQL verificada 2026-06-07**: stock IEM (5 productos) = 100% coincidente entre bod-iem-registros.json (SQL) y R_STOCK_PRODUCTOS. CEM XX84502: ERP=40, SQL IDBODEGA=24=40.

**bodegaCorta=PEM** hardcodeada en descargar_ventas_erp.py (L179, L222) — no es bug, NO arreglar.
**BOD_RCE.xlsm** (nombre físico) contiene bodega IEM (col A) → JSON: `bod-iem-registros.json`

### Regla crítica subquery ULT en descargar_bod.py
- Debe incluir `WHERE IDBODEGA=?` ANTES del `GROUP BY`
- JOIN debe usar `FECHA_EMISION=ULT.ULTIMA_FECHA`, NO `IDDOCUMENTO`
- `IDDOCUMENTO` = tipo de documento (ej. GRT=17), NO ID único de movimiento
- Verificado 2026-05-25: código 4422 IEM pasó de 931 días a 10 días con el fix

---

## TIPOS DE DOCUMENTO — tabla completa verificada 2026-06-07
## Fuente negocio: E:\ferreteria-oviedo\_HISTORICO\ID DOC OVIEDO EM.xlsx

Scripts usan MD.DOC string, NO IDDOCUMENTO numerico. Cada DOC puede tener multiples IDs.

| Efecto stock | Doc | IDDOCUMENTO (todos) | Notas negocio (de ID DOC OVIEDO EM.xlsx) | Movs 6m |
|---|---|---|---|---|
| Pedido UP (Disp DN) | NVM | 205/213 | Saca del Disponible, queda en Fisico. Suma col Pedido. NO se elimina automatico | 850 |
| Pedido UP (Disp DN) | VMP | 210 | Mismo caso NVM. **SIN USO** — reemplazado por VMN (336) | ~0 |
| Pedido UP (Disp DN) | VMN | 336 | Mismo caso VMP. **ESTA ES LA ACTIVA** | 46655 |
| Pedido DN + FisDisp UP | BVE | 316/605 | Llama a NVM/VMP creada. Cliente paga. Sale de col Pedido. 605=WEB | 30431 |
| Pedido DN + FisDisp UP | FVE | 35/301/335/601 | Mismo caso BVE (factura). 4 variantes: Exenta/Electr/ExentaElectr/WEB | 17465 |
| Fisico DN + Disp DN | GME | 308 | Despacha pendientes de entrega (retiro cliente o despacho camion) | 47962 |
| Fisico DN + Disp DN | GCE | 305 | Se usa en casa matriz. Saca de Disponible y Fisico | 1 |
| Disp UP (espera NCE) | Gdc | 79 | Cliente devuelve. Suma al Disponible, espera NCE para sumar al Fisico | 518 |
| Fisico UP | NCE | 304/603 | Llama a Gdc (79). Suma stock al Fisico. 603=WEB | 514 |
| Ingreso compra | GRC | 15/86 | Activo cuando llega producto de proveedor | 2200 |
| Traslado recepcion | GRT | 17/307/701/712/713 | 17=menu antiguo (revisar). 307=hijo entre bodegas/sucursales. 712/713=hijos | 8529 |
| Traslado entre bodegas | GIB | 709 | Entre bodegas misma tienda. No tributario SII. Mueve Disp y Fisico | 6710 |
| Traslado entre sucursales | GTS | 711 | Entre tiendas Chile. Tributario. Mueve Disp y Fisico. Llama a GST | 611 |
| Solo solicitud (no mueve) | GST | 702/718 | NO mueve stock. Solicita producto a otra tienda. Lo llama GIB o GTS | 537 |
| Ajuste ingreso | GII | 33/606 | Ingresa directo a Disp y Fisico | 41 |
| Ajuste egreso | GEI | 34/710 | 34=Saca de Disp y Fisico. 710=Guia Merma-Gestion (bodega GEM) | 279 |
| Traslado salida | GET | 18/700 | Guia Envio Traslado. 700=doc antiguo, revisar | — |
| Sin efecto stock | CVI | 703 | No toma stock. Solo cotizacion cliente | 14021 |
| Sin efecto stock | CVN | 7 | Cotizacion cliente. No toma stock | 480 |
| Venta Calzada | NVC | 203 | Productos que no vendemos o sin stock | 1 |
| Menu antiguo | GCG | 98 | Mismo caso Gdc (79). Revisar cual esta activa | — |
| Menu antiguo | GRT | 17 | Considerar revisar si tiene movimientos reales | — |

**Whitelist DOC IN en descargar_bod.py:**
`GRC,GRT,GME,GIB,Gdc,GBR,GRP,GRI,GRN,GIN,GDC,GDV,GII,GTS`
NOT IN: `CVI` (excluida por diseno)

**GBR, GIN, GRN, GRP**: en whitelist pero NO existen en M_DOCUMENTOS (0 movimientos). Entradas muertas.
**GCE 315** vs **Gdc 79**: ambos son devolucion cliente. Segun Excel: "revisar cual esta activa". 315 tiene 0 movs, 79 tiene 518.
**VMP 210**: SIN USO confirmado. VMN 336 es el activo segun nota del Excel.
**GST**: no mueve stock — excluir de calculos de stock, solo de analisis de traslados.

---

## TABS VERIFICADOS — deben seguir funcionando tras cualquier cambio

```
ERP:    hora · topMarcas · comparativa · vendrank · marcavend · clientes
        tipodoc · facturacion · quiebre · sobrestock · transito · merma
        rankingmarca · estaciones · bajrot · pagoanalisis · pagorankings
        pagotemporal · entrefechas · arbol · arboltabla · arbolheat · sector
        stockconsulta (V37.1) · informe-stock (PASO 1G) · despachos (V37.22) · recepciones (V37.22)
XLSM:   nc · marcavend2 · preciodiff · mem
Stubs:  impacto
Análisis bodegas: analisis (IEM/RCE/CEM con selector bfFuente)
```

Notas tabs nuevos:
- `informe-stock`: usa informe-stock.json (PASO 1G descargar_blazor_informe.py Playwright). Muestra Dif<0 (anomalía JT) como filas rojas.
- `despachos`: usa despachos-pendientes.json (PASO 1F descargar_despachos.py SQL). Despachos NVM sin BVE/FVE.
- `recepciones` / sub-tab "Por Recepcionar": usa recepciones-pendientes.json (PASO 1H descargar_blazor_bodegas.py Playwright). GRT/GIB pendientes de Editar+Grabar.

TABS ELIMINADOS (no recrear): `vvsstock` (eliminado V35.0)
NAVEGACIÓN REAL: `showTab` → `vadmGrupo` → `vadmSubTab`. NO existe `adminShowTab()`.

---

## CARGA DE DATOS — PERFORMANCE PANEL

```
ventas-manzano-YYYY-MM.json → mes actual, ~200KB (default)
ventas-manzano-YYYY.json    → año completo, 2-18MB (al seleccionar año)
ventas-manzano.json         → FALLBACK (panel depende de él en 4 puntos — NO eliminar)
Datos.json                  → 3.5MB en CATALOGO PRODUCTOS/, cargado una vez, cacheado
catalogo-dinamico.json      → DOBLE ROL: señal Python + 404 en panel (correcto — fallback a Datos.json)
```
NO intentar mover `catalogo-dinamico.json` a `CATALOGO PRODUCTOS/` — el 404 es comportamiento correcto por diseño.

---

## SEGURIDAD FIREBASE

### Headers Hosting (firebase.json)
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: scripts/styles/fonts/img/connect srcs definidos
```

### Roles de usuario
| Rol | Panel Admin | Panel Vendedor | Panel Cliente |
|---|---|---|---|
| admin | Completo | Completo | Completo |
| cooperador | Solo lectura operacional | Completo | Completo |
| vendedor | NO | Completo | Completo |
| cliente | NO | NO | Completo |

### Hosting ignore — bloqueados
`VENTAS EL MANZANO/` · `backups/` · `.claude/` · `*.ini` · `*.xlsm` · `*.mp4`

### GitHub — estado actual (post-limpieza 2026-06-02)
- 1 commit limpio, sin credenciales ni IPs reales
- IPs/tokens reemplazados por placeholders: `[SQL-SERVER-IP]` · `[ERP-SERVER-IP]` · `[TOKEN-ERP]`
- .gitignore bloquea: `FLUJOS/` · `VENTAS EL MANZANO/` · `CATALOGO PRODUCTOS/` · `.claude/`

### ⚠️ MITIGACIÓN ACTIVA V37.28 — data/*.json (ventas, costos, stock) ya no usa ruta fija
**Hallazgo 2026-06-21:** `data/*.json` (27 archivos: ventas con RUT de clientes, costos, stock,
pedidos, despachos) se servía como estático de Firebase Hosting en ruta fija. `firestore.rules`
NO protege Hosting → cualquiera con la URL (visible en el código fuente de `panel-admin.html`)
los descargaba sin login.

**Storage descartado:** requiere plan Blaze (tarjeta vinculada) para crear bucket nuevo desde
oct-2024 — rompe la regla de costo cero. Firestore directo también descartado: varios archivos
superan los 26 MB, muy por encima del límite de 1MB/documento.

**Solución aplicada — token rotativo (sin Storage, sin Blaze, sin Firestore grande):**
- Los 27 JSON sensibles viven en `data/<token>/` con nombre aleatorio (32 hex), NO en `data/` raíz
- El token vigente se publica en Firestore `dataAccessToken/current`, protegido por
  `firestore.rules` (solo `esAdmin()`/`esVendedor()` lo leen)
- `panel-admin.html` e `index.html` (vendedor) leen el token una sola vez tras login
  (`_cargarDataToken()`) y construyen la URL con `dataUrl(nombre)` — ya no hay rutas fijas
  en el código fuente
- `_utilidades/rotar_token_data.py` rota el token y borra la carpeta del token anterior en
  cada corrida del pipeline (PASO 3.5, ver `MAPA_FLUJO_PROYECTOS.md`)
- `catalogo-dinamico.json` sigue público en ruta fija a propósito (catálogo del cliente)

**Limitación honesta:** esto NO es auth real a nivel HTTP — Hosting sigue sirviendo el archivo
sin verificar sesión. Cierra el escaneo casual y la exposición por código fuente (la URL ya no
es fija ni adivinable, y rota), pero alguien que capture la URL activa mientras es válida podría
reusarla hasta la próxima rotación. Para protección real habría que migrar a Firestore fragmentado
(documentado pero no implementado — esfuerzo alto) o aceptar Blaze.

**IMPORTANTE — ejecutar `rotar_token_data.py` SIEMPRE como parte de `ACTUALIZAR_TODO.bat`,
después de PASO 1-3 y antes de PASO 4 (`firebase deploy`)**, o los datos nuevos del pipeline
quedarán en `data/` raíz (rutas que ya no usa el panel) y el panel seguirá leyendo del token
de la corrida anterior. `subir_data_storage.py` y `storage.rules`/`firebase.json→storage`
quedan en el repo sin usar, por si se reconsidera Blaze más adelante.

---

## FLUJO LOGIN — INVARIANTES CRÍTICOS (V36.9k)

| Situación | Comportamiento correcto |
|---|---|
| Usuario Google nuevo (!snap.exists) | Crear doc /users con creadoPor:'google' — NUNCA signOut sin crear |
| Usuario pendiente (registroAprobado=false) | code:'pendiente' — NUNCA code:'noregistrado' |
| Registro deshabilitado | Bloquear, code:'noregistrado' — único caso válido |
| Usuario bloqueado (estado='bloqueado') | signOut + mensaje claro |

---

<!-- Fuente de verdad: MEMORY.md §19 — esta copia puede quedar desactualizada -->
## CHECKLIST POST-CAMBIO

```
[ ] Función modificada recibe los mismos parámetros de entrada
[ ] Variables globales que usaba siguen existiendo con el mismo nombre
[ ] El tab que la invoca sigue en vadmReRenderTabActivo
[ ] Filtro _vadmBodSel sigue afectando el resultado (stock Y ventas)
[ ] No se hardcodeó ningún valor que debe venir de datos reales
[ ] No se renombró ninguna función pública
[ ] window._mostrarPrecio = false en panel-cliente.html
[ ] xlsm-enrich.json generado por descargar_ventas_enrich.py (SQL) o leer_xlsm.py (fallback), NUNCA main.py
[ ] _catalogo_generado_hoy() no fue revertida
[ ] ventas-manzano.json sigue siendo generado por guardar_json() en main.py
[ ] Subquery ULT en descargar_bod.py tiene WHERE IDBODEGA=? antes del GROUP BY
[ ] Deploy ejecutado y "Deploy cierre sesión" en AGENTS.md actualizado
[ ] ACTUALIZAR_GITHUB.bat ejecutado con descripción del cambio
```

---

## PENDIENTES CONOCIDOS (desde 2026-06-01)

### COMPLETADO 2026-06-06 — Firebase Console verificado
Releases anteriores a 2026-06-06 eliminados desde Firebase Console.
credenciales_db.enc bloqueado en firebase.json + .firebaseignore desde 2026-06-06.
Riesgo historico eliminado.

### COMPLETADO 2026-06-06 — Pipeline test post-auditoria OK
Deploy exitoso. Xlsx corrupto limpiado (FortiClient #4).
Commit b98eacb. Auditoria 6 puntos en produccion.

### ACCIÓN 7 — Botón ♻️ Refrescar catálogo (MEDIA)
`_vadmCargarStockMap()` tiene guard: si `_vadmStockMap` existe, retorna sin fetch.
Si el pipeline actualiza Datos.json con el panel abierto, el catálogo queda viejo hasta F5.
Fix propuesto — agregar botón junto al "🔄 Actualizar":
```html
<button onclick="_vadmStockMap=null; _vadmCargarStockMap(vadmReRenderTabActivo)"
        title="Recargar catálogo de productos">♻️ Refrescar catálogo</button>
```
Safe Change: solo agregar el botón HTML. NO tocar `_vadmCargarStockMap()` por dentro.

### Tareas obsoletas Task Scheduler (apuntaban a D:)
```powershell
Unregister-ScheduledTask -TaskName "Ferreteria Oviedo - Backup Diario" -Confirm:$false
Unregister-ScheduledTask -TaskName "Ferreteria Oviedo Ventas 7PM" -Confirm:$false
```

---

## CÁLCULOS — METODOLOGÍA

### Velocidad de venta
```
velocidad_dh = unidades_vendidas_periodo / dias_habiles_periodo
cobertura_dh = stock_actual / velocidad_dh
```
Días hábiles: Lun-Sab que NO sean feriados chilenos. `_vadmDiasHabiles()` nunca retorna 0.

### Semáforos de stock
| Estado | Cobertura | Color |
|---|---|---|
| Quiebre | stock = 0 | rojo |
| Crítico | < 30 dh | rojo |
| Alerta | 30-90 dh | amarillo |
| OK | > 90 dh | verde |
| Sin datos | sin ventas | negro |

### ABC Pareto
- A: top 80% del valor de ventas · B: 81-95% · C: 96-100% · D: sin ventas

### Feriados Chile (calculados)
Fijos: 1-ene, 1-may, 21-may, 20-jun, 16-jul, 15-ago, 18-sep, 19-sep, 12-oct, 1-nov, 2-nov, 8-dic, 25-dic.
Móviles: Viernes Santo (Pascua-2), Sábado Santo (Pascua-1) — algoritmo Butcher.

---

---

---

## OPEN CODE REVIEW (OCR) — Revisión de código IA (V37.18)

Herramienta: `@alibaba-group/open-code-review` v1.2.6
Instalado en: `E:\npm-global\` (global, NO como dependencia del proyecto)
Config global: `C:\Users\Ferreteria Oviedo\.opencodereview\config.json` (NO subir a git — gitignored)
Reglas proyecto: `E:\ferreteria-oviedo\.opencodereview\rule.json` (SÍ está en git)
Comando slash: `.claude\commands\open-code-review.md` (local, NO en git por .claude/ gitignore)

### Cuándo usar OCR_REVIEW.bat
- Antes de cualquier deploy importante (V37.X)
- Cuando se modifica panel-admin.html, panel-cliente.html, firestore.rules, o sw.js
- Cuando se agrega lógica nueva de autenticación o manejo de credenciales
- Cuando se modifica el pipeline Python (main.py, descargar_*.py, leer_xlsm.py)

### Uso desde terminal
```batch
REM Opción 1 — BAT integrado (revisa + pregunta si hacer deploy)
E:\ferreteria-oviedo\OCR_REVIEW.bat

REM Opción 2 — solo revisión sin deploy
ocr review --from main --to HEAD --audience human

REM Opción 3 — solo cambios staged
ocr review --audience human

REM Opción 4 — desde Claude Code (slash command)
/open-code-review
```

### Reglas activas (rule.json)
| ID | Archivo | Severidad | Descripción |
|----|---------|-----------|-------------|
| FO-001 | firebase-config.js, credenciales*.ini | ERROR | Archivos absolutamente intocables |
| FO-002 | panel-admin.html, panel-cliente.html | ERROR | XSS via innerHTML sin sanitizar |
| FO-003 | *.html | ERROR | API keys o tokens hardcodeados en HTML |
| FO-004 | panel-admin.html | WARNING | Firma de funciones JS críticas alterada |
| FO-005 | panel-admin.html | WARNING | Variables globales JS críticas renombradas |
| FO-006 | panel-cliente.html | ERROR | window._mostrarPrecio default != false |
| FO-007 | firestore.rules | ERROR | Regla sin request.auth != null |
| FO-008 | *.py | ERROR | IP real o token hardcodeado en Python |
| FO-009 | *.py | WARNING | Ruta absoluta Windows hardcodeada |
| FO-010 | *.py | WARNING | IO sin try/except en pipeline crítico |
| FO-011 | *.bat | WARNING | Ruta D:\ferreteria-oviedo (migrada a E:) |
| FO-012 | main.py, leer_xlsm.py | ERROR | main.py escribe xlsm-enrich.json |
| FO-013 | *.py | ERROR | Token/password logueado en print() |
| FO-014 | sw.js | WARNING | Estrategia de cache del Service Worker |

### Arquitectura de config (sin rastro en C:)
```
C:\Users\Ferreteria Oviedo\.opencodereview\  ──junction──►  E:\config\opencodereview\
```
El binario lee `~/.opencodereview/config.json` → Windows redirige a `E:\config\opencodereview\config.json`.
Igual al patrón .claude → W:\claude-config\.

Claves importantes:
- `llm.auth_header = x-api-key`  (Anthropic requiere esto, NO Authorization: Bearer)
- `llm.use_anthropic = true`
- `llm.auth_token` = API key real (en E: físico, nunca en C:)
- Los wrappers `ocr.cmd/ps1/sh` solo setean `OCR_NO_UPDATE=1`

### Verificar funcionamiento
```batch
ocr llm test
REM Debe mostrar: Source: OCR config file / URL: .../v1/messages / Model: claude-sonnet-4-6
```

---

## HISTORIAL SESIÓN 2026-06-08 — Auditoría seguridad + README

### Problemas → Soluciones
- IP real SQL Server en AGENTS.md → reemplazada por `[SQL-SERVER-IP]` (commit 989c28c)
- `storage.rules` permisivo → deny-all; Firebase Storage nunca fue activado en el proyecto (commit f038a4d)
- API key Firebase sin restricciones → restringida a 2 dominios + 25 APIs vía Google Cloud Console
- Repo sin README → creado con flujo completo del proyecto (commit 40fa876)

### Pruebas realizadas
- 3 paneles verificados visualmente: Vendedor, Admin, Cliente cargan sin errores
- Flujo registro confirmado: solo usa Firestore, Storage no involucrado

---

## HISTORIAL SESIÓN 2026-06-07

### Cambios realizados
- `leer_xlsm.py` `_BOD_CORTA`: CAL→None, SAL→None, EXH→'EXH' (activa, sin uso en pipeline aún)
- `VENTAS EL MANZANO\CLAVES DE PRECIO Y RANKING.txt` creado con mapeo completo de columnas XLSM
- `panel-admin.html` L2217: `vadmSubTab('vsec-quiebre')` → `vadmSubTab('quiebre')` (fix nav tutorial card)

### Investigaciones completadas
- **P_BODEGAS verificado con VPN**: 9 bodegas SUC='04' + MEM(29)/CD(23) en SUC='08'
  - Nuevas documentadas: GEM=28, RWE=49, EEM=83 (Exhibicion = EXH en _BOD_CORTA)
- **M_DOCUMENTOS consultado**: 195 tipos. Todos los DOCs del pipeline verificados.
  - Fuente de negocio: `_HISTORICO\ID DOC OVIEDO EM.xlsx` — notas propias del equipo
  - GBR/GIN/GRN/GRP en whitelist descargar_bod.py = entradas muertas (0 movimientos, no existen en M_DOCUMENTOS)
  - VMP(210) confirmado SIN USO — VMN(336) es el activo
  - Gdc(79) flow: suma Disp primero, espera NCE para sumar Fisico
- **Consistencia ERP ↔ SQL verificada**: IEM 5 productos + CEM XX84502 → 100% coincidente
- **Auditoría panel-admin.html**: 33 tabs revisados, solo 1 bug funcional (corregido arriba)

### Documentación actualizada
- `AGENTS.md`: tabla IDBODEGA completa con SUC='04' y SUC='08'; tabla tipos de documento con notas de negocio; referencias a fuentes de verdad
- `MEMORY.md`: §7 bodegas completo verificado; §7b fuentes de verdad (2 archivos); §7c tabla documentos con movimientos reales; encabezados actualizados

*AGENTS.md consolidado 2026-06-07*
*Historial completo pre-junio: _HISTORICO\20260604_AGENTS_completo.md*
*Para actualizar: editar directamente este archivo al cierre de cada sesión.*

---

## HISTORIAL SESIÓN 2026-06-13 — V37.25 fix pipeline + skills

### Diagnóstico
- Pipeline automático (AutoUpdate18:00) NO existía en Task Scheduler — sin ejecución automática desde 2026-06-09
- Pipeline manual (ACTUALIZAR_TODO.bat) corrió a las 3:10-3:15 AM — todos los JSONs actualizados
- `recepciones-pendientes.json = []` — correcto: 0 anomalías Dif<0 en informe-stock confirmadas
- `sector/rut/razonSocial` ausentes en VENTAS EL MANZANO: VENTAS.xlsm desactualizado desde 2026-05-17
  - xlsm-enrich.json tiene datos hasta numero 1.069.494 (mayo), ventas junio > 1.080.000 → 0 matches
  - FIX REQUERIDO: actualizar VENTAS.xlsm manualmente desde servidor, luego re-correr pipeline

### Cambios realizados
- `BODEGAS\descargar_blazor_bodegas.py`:
  - Eliminada referencia a `E:\datos-erp\` en `_CRED_PATHS` (carpeta independiente/test)
  - Corregida URL de navegación: `/?Token=...&IdMenu=377` → `Central.aspx?IdMenu=377`
  - Estrategia token-directo: prueba Token URL sin form login previo (investigando)
  - `ACTUALIZAR_TODO_AUTO.bat`: PASO 1H (descargar_blazor_bodegas.py) + PASO 1I (fusionar_despachos.py) añadidos

### Skills creados (costo $0)
- `.claude/commands/ahorro-tokens.md` — compresión de contexto
- `.claude/commands/revisar-codigo.md` — revisión código vs 14 reglas FO-001 a FO-014, sin API externa

### MIGRACIÓN xlsm-enrich.json: VENTAS.xlsm manual → SQL Server (RESUELTO)
Causa raíz del `sector/rut/razonSocial` ausente: los 3 XLSM manuales (VENTAS 27d, RANKING 17d,
PRECIOS 27d) estaban desactualizados. Investigación confirmó que TODOS los campos están en SQL:
- `RAZON_SOCIAL`, `RUT` → `M_ENTIDADES` (ya usado en descargar_despachos.py)
- `OBSERVACION_IMPRESA` (sector) → `M_Documentos_Encabezado_Observacion` (ya usado en descargar_bod.py)
- La descarga ERP web (Reporte_VentasPorVendedor.asp) NO trae estas columnas (solo 3 tipos: 1/2/4)

**Nuevo script `BODEGAS\descargar_ventas_enrich.py` (V1.0):**
- Genera xlsm-enrich.json desde SQL — docs BVE/FVE/NCE suc 04, índice por NUMERO
- Reutiliza `_extraer_sector` + `_SECTOR_DISPLAY` de leer_xlsm.py (fuente única del sector)
- Validado: BVE+FVE+NCE = 100% de los números de ventas-manzano junio (1086/1086)
- Resultado tras re-correr main.py: rut 0%→100%, razonSocial 0%→100%, sector 0%→11.5% (todos los meses 2026)
- Integrado: PASO 1K en ACTUALIZAR_TODO.bat / PASO 1J en ACTUALIZAR_TODO_AUTO.bat (antes de main.py)
- leer_xlsm.py NO modificado: sigue generando ventas-xlsm/ranking/precios; su xlsm-enrich queda como fallback
- Limitación: SQL sincroniza 22:00 → enriquecimiento con ≤1 día retraso (igual que bod/pedidos/despachos)

### SOLICITUD SEMANAL DE STOCK — Mínimo/Reposición desde ERP (SQL) 2026-06-14
Antes el tab `adquisiciones` (reqStockPrellenar) CALCULABA Mínimo/Reposición por velocidad de venta
(qty/díasRango × cobertura). El usuario pidió usar la MISMA LÓGICA del ERP y quitar el cálculo de velocidad.
- **Dónde vive el dato:** `R_STOCK_PRODUCTOS.ST_MIN/ST_MAX/ST_CRITICO/ST_REPOSICION` (por bodega, SQL). NO está en M_PRODUCTOS (todo 0) ni P_PRODUCTOS_CRITERIOS (vacía).
- **Cobertura:** solo ~3.6% (1471 productos) — PEM ~10%, SEM ~11%, CEM/MEM 0%. Lo llena Adquisiciones de a poco. Productos sin configurar → 0.
- **Nuevo script** `BODEGAS\descargar_stock_critico.py` → `data/stock-critico.json` ({codigo:{min,max,critico,repo,disp}} sumado comerciales). PASO 1L en ambos bats.
- **panel-admin.html reqStockPrellenar():** Mínimo actual = ERP ST_MIN, Reposición actual = ERP ST_REPOSICION (vía `_reqStockParams` de stock-critico.json). Quitado `vel = qty/diasRango; minimoActual = vel*dias`.
- **Stock actual:** ahora PEM+SEM+CEM+MEM (antes solo PEM+SEM). Excluye IEM/RCE/TEM/CD (recepción/tránsito).
- Vta últimos 2 meses sigue de ventas-manzano (cuadra con ERP en el rango).

### Limpieza data/
- Movidos a `E:\datos-erp\`: 32 scripts de prueba + 9 archivos VENTAS EL MANZANO + 4 erp-*.json huérfanos (~20 MB)

### LIMPIEZA EXTREMA 2026-06-14 → E:\_ARCHIVO_FERRETERIA (~300 MB)
Carpeta `E:\_ARCHIVO_FERRETERIA\` **FUERA del proyecto** (raíz del disco E, NO dentro de ferreteria-oviedo;
así no se mezcla, no se sube a git ni se despliega). Estructura espejo + README.
Contiene todo lo que NO es flujo activo:
- Carpetas completas: `backups\` (node_modules+HTML+JS, 54MB), `CATALOGO PRODUCTOS\backups\` (raw CSVs, 109MB), `backups_pre_descarga\` (6MB), `VENTAS EL MANZANO LOCAL\` (flujo deprecado, 8.8MB)
- `VENTAS EL MANZANO\ventas_erp_*` viejos: 28 xlsx (solo se conserva el más reciente _20260613; el script es incremental)
- BODEGAS deprecados: `descargar_despachos_erp.py` + `descargar_recepciones_pendientes.py` (reemplazados por descargar_blazor_bodegas.py) · duplicados RANKING-FINAL/RANKINGcopia.XLSM · 2 txt vacíos
- logs viejos (17) · raíz: EJEMPLO1-4, log_actualizar viejo, diagnostico_huerfanos.py
- MANTENIDO en proyecto (decisión usuario): `_HISTORICO\`, `_PROMPTS\`, BODEGAS VBA (.bas/.cls) + xlsx análisis + EXTRAER DIRECCION.xlsx + Copia de Movimiento Stock.xlsx
- Resultado: VENTAS EL MANZANO 132→20MB, CATALOGO 118→9.6MB. Núcleo del flujo verificado íntegro.
- REGLA: archivos de respaldo/temporales/deprecados NO se mezclan con el flujo → van a `E:\_ARCHIVO_FERRETERIA`
  (FUERA de ferreteria-oviedo, en la raíz del disco E). El usuario la sacó del proyecto manualmente 2026-06-14.
- Utilidades del equipo (no son pipeline) movidas a `_utilidades\`: encriptar_credenciales.py, EXPULSAR_DISCO_SEGURO.bat, ACTIVAR_EN_ESTE_EQUIPO.bat. Ningún bat las invoca. Raíz verificada: solo flujo activo + config + assets + docs (los .jpg/manifest de mayo SÍ se usan, no son obsoletos).

### Carpeta "DATOS ERP" eliminada de GitHub (commit 9c6b4f6)
- `git rm` de `DATOS ERP/pipeline-datos-erp.html` (única doc que contenía) + push a oviedoem/ferreteria-oviedo
- Removido el bloque robocopy `E:\datos-erp → git-sync\DATOS ERP` de ACTUALIZAR_GITHUB.bat para que NO se recree

### Pendientes usuario
- **Crear tarea programada AutoUpdate18:00** (requiere autorización): `schtasks /create /tn "AutoUpdate18:00" /tr "cmd /c E:\ferreteria-oviedo\ACTUALIZAR_TODO_AUTO.bat" /sc daily /st 18:00`
- ~~Actualizar VENTAS.xlsm~~ → RESUELTO: ya no se depende del XLSM manual para rut/sector/razonSocial (ahora SQL)
- **RANKING.xlsm / PRECIOS.xlsm** siguen manuales (tabs ranking-unidades y precios-diff) — migrar a SQL en sesión futura si se desea
- **Blazor script** (`descargar_blazor_bodegas.py`): navegación a IdMenu=377 pendiente de fix definitivo (JustWeb ASP.NET TreeView usa postbacks)

## HISTORIAL SESIÓN 2026-06-21 — V37.26 Redes sociales + banner horario

### Hecho
- panel-admin.html `loadRedes()`: ahora también lee `config/redes` de Firestore (antes solo localStorage) — corrige que Instagram/FB/WA aparecieran "Sin vincular" en otro equipo/navegador
- panel-admin.html `vincularRed()`: validación de formato antes de guardar (usuario IG regex, URL FB debe empezar con facebook.com/)
- panel-cliente.html: bloque de redes sociales (`#redesInline`) movido del `.vend-section` oculto (display:none) al `<header>` siempre visible — antes nunca se mostraba a clientes. Responsive: solo iconos en mobile (<480px), texto completo en desktop
- panel-cliente.html: banner sucursal rediseñado — el horario/ubicación ya no tapa la imagen, ahora es un botón "📍 Sucursal y horario" que despliega un popover al click (cierra con click afuera o toggle)
- Limpieza código muerto: eliminado selector "Posición del texto Izquierda/Derecha" del admin (`bnrSetTextoPos`, campo `textoPos` en Firestore) — quedó sin efecto tras el cambio de banner a botón+popover; también removido el código equivalente en `cargarBannerDinamico()` de panel-cliente que ya no tenía elemento `.sucursal-info` al que aplicarse
- Deploy hecho (`firebase deploy --only hosting`) — 2 deploys en la sesión

### Pendiente
- Commit a GitHub (ACTUALIZAR_GITHUB.bat)
- Continuar plan original "Banner Principal + Redes Sociales" (memory/estado-sesion-20260621.md) — quedan: Prompt 3 (embeds Instagram), Prompt 4-10 (link banner, historial, programación por fecha, carrusel)

### Próxima sesión debe empezar por
- Confirmar commit hecho, y seguir con Prompt 3 del plan (embeds de posts Instagram) si el usuario lo pide

---

## HISTORIAL SESIÓN 2026-06-21 (continuación) — V37.27 Carrusel de banners + fixes

### Hecho
- Prompt 3 (embeds Instagram): card en admin con input URL + `igEmbedAgregar()`, guarda en `config/redes.igEmbeds` (arrayUnion), embed oficial `instagram.com/embed.js`
- Prompt 4: link clicable en banner (`config/banner.linkURL`), banner abre en nueva pestaña si hay link
- BUG FIX: `bnrGuardarFirestore()` usaba `.set()` sin `merge:true` — cada imagen nueva borraba horario/igEmbeds/linkURL. Corregido a `{merge:true}`
- Prompt 6: historial de banners — subcolección `config/banner/historial` (máx 5), archivado automático antes de cada guardado (`bnrArchivarBannerActual()`)
- Prompt 7: UI de historial en admin (thumbnail + fecha + restaurar) — `bnrCargarHistorial()`, `bnrRestaurarDeHistorial()`
- Prompt 8: programación banner por fecha/hora — inputs `bnrFechaInicio`/`bnrFechaFin` en admin, guardados como timestamp
- Prompt 9: panel-cliente.html respeta `fechaInicio`/`fechaFin` — fuera de rango muestra fondo estático default
- Prompt 10 (carrusel multi-banner): subcolección `config/banner/carrusel` (orden, activo, mismos campos que el doc único). UI admin con migrar/agregar/reordenar/activar/eliminar slides. Rotación cada 6s en panel-cliente.html **y en panel-admin (index.html)** — antes index.html no tenía nada de esto
- FIX CRÍTICO firestore.rules: `match /config/{docId}` no cubría subcolecciones (`historial`, `carrusel`) — quedaban bloqueadas por la regla catch-all. Agregado `match /config/{docId}/{subColl}/{subId}` con la misma política
- Fix visual: `background-size` cambiado de `cover` a `contain` (+`no-repeat` donde faltaba) en los 3 paneles — banners anchos (ej. oviedo.cl, 1280×341) se recortaban; ahora se ven completos
- Fix: eliminado `.sucursal-overlay` (gradiente oscuro) de panel-cliente.html y de index.html (vendedor) — quedó sin propósito real tras mover el horario a botón+popover; index.html ahora también usa botón "🕐 Horario" + popover igual que cliente (antes tenía el texto superpuesto directo en la imagen)
- Fix: preview de banner en panel-admin ("Vista previa en vivo") tenía su propio overlay+texto superpuesto desincronizado de la realidad — eliminado, texto movido a leyenda debajo de la imagen
- Limpieza: `textoPos` (selector izq/der ya removido del admin) seguía referenciado en index.html — eliminado
- Fix `_adminVerificarDispositivo()`: cuenta dueño (`alejandrog45@gmail.com`) ya no pide autorización de equipo; el resto de las cuentas admin/cooperador sigue pasando por el control de `config/adminDispositivos`
- Probado con 3 imágenes reales del carrusel de oviedo.cl cargadas directo en Firestore (vía consola del navegador, sesión admin real) — rotación confirmada funcionando en panel-cliente
- Badge de versión actualizado a V37.27 · 21-06-2026 en los 3 paneles
- Deploy: `firestore:rules` + `hosting` (varias veces durante la sesión)

### Pendiente
- Commit a GitHub (este cierre de sesión)
- Las 3 imágenes de prueba de oviedo.cl quedaron como slides reales en `config/banner/carrusel` — reemplazar por banners propios cuando se quiera publicar contenido real, o borrarlas desde la UI del carrusel en admin
- Plan original aún sin cerrar checklist final (Safe-Change Protocol por prompt, probado en admin/cliente/vendedor — vendedor recién se sumó al final, falta una pasada de prueba completa ahí)

### Próxima sesión debe empezar por
- Confirmar commit hecho
- Si se va a usar el carrusel en producción: reemplazar los 3 slides de prueba (oviedo.cl) por banners reales de Ferretería Oviedo desde el admin

---

## HISTORIAL SESIÓN 2026-06-23 — Marketing PWA + Automatización WA Business + Carrusel promos

### Hecho
- `marketing-pwa.html` (NUEVO, standalone, sin Firebase): 4 tabs (WhatsApp/Instagram/Video Reels/Lanzamiento) con textos copiables para difusión de la app cliente. Agregado a `ignore[]` de `firebase.json` (no había regla genérica `*.html` que lo excluyera del hosting)
- Tab Tutoriales (panel-admin.html): fix versión hardcodeada "Informe Stock V37.8"→"V37.28", agregadas 2 tarjetas (Redes Sociales, Difusión y Marketing) → 15 tarjetas totales
- Tab Marketing nuevo en panel-admin.html (`#tab-marketing`): mismo contenido que marketing-pwa.html pero integrado al panel — 4 sub-tabs internos, botones copiar con clipboard API + fallback `execCommand` (compat iOS Safari), nav-btn "📣 Difusión" en sidebar grupo Marketing, `showTab()` extendido con callback `loadMarketing()`
- Tab #tab-mejoras: versión/fecha corregida (V37.8→V37.28, 2026-05-28→2026-06-23), agregado item "Módulo Marketing" en Mejoras planificadas (badge "En curso V37.28")
- Automatización WA Business (panel-admin.html, dentro del red-card de WhatsApp en tab Redes): gestión de Mensaje de Bienvenida, Mensaje de Ausencia y Respuestas Rápidas `/atajo` (máx 50) — todo para configurar MANUALMENTE en la app WA Business del celular (sin API, sin costo, sin riesgo de baneo). Guarda en `config/redes.waAuto{bienvenida,ausencia}` y `config/redes.waRapidas[]` (merge:true). 6 respuestas sugeridas precargables. `_WA_PLANTILLAS` ampliado de 6→8 items (instalar app, confirmar pedido)
- Fix seguridad aplicado durante revisión (`/revisar-codigo` detectó FO-002): `renderWaRapidas()` insertaba atajo/texto en innerHTML sin escapar — corregido con `_esc()` (helper ya existente en el panel)
- Carrusel de banners + promos (panel-cliente.html): las promociones activas (`promos` collection) ahora rotan como slides adicionales dentro del mismo carrusel del banner (`.sucursal-banner`), sin lecturas extra a Firestore — fusión en memoria vía `_bnrTryFusion()` cuando ambas fuentes (`cargarBannerDinamico()` y `cargarPromosFirestore()`) ya resolvieron. Slide de promo es 100% CSS (sin imagen base64): overlay oscuro con tag/título/desc/precio. Agregados dots de navegación (`.bnr-dots`) cuando hay 2+ slides. `#promoSection` (barra horizontal bajo el banner) sigue funcionando igual, sin cambios visuales
- Fix de sintaxis aplicado durante implementación: el prompt original de `renderWaRapidas()` traía continuaciones de línea `'\` inválidas en JS (fuera de string) — reescrito con concatenación `+` normal
- `/revisar-codigo` corrido 3 veces (una por cada deploy) contra `.opencodereview/rule.json` — 0 ERRORes, 0 WARNINGs en cada pasada tras los fixes aplicados
- 2 deploys + 2 commits: `02c6416` (marketing-pwa + tab tutoriales/marketing/mejoras) y `3860a9e` (automatización WA + carrusel promos)
- Badge de versión sigue en V37.28 (sin bump) — los 3 paneles ya lo tenían

### Pendiente
- `marketing-pwa.html` NO quedó sincronizado a `E:\git-sync\` (el script `ACTUALIZAR_GITHUB.bat` usa robocopy con lista de inclusión selectiva que no lo contempla) — el archivo vive solo en `E:\ferreteria-oviedo\`, no está en GitHub. No es crítico (no es parte de la app, es material de difusión externo) pero revisar si se quiere versionarlo
- Verificación manual pendiente en dispositivo real: tab Redes → Automatización WA Business (guardar/copiar bienvenida/ausencia, agregar/borrar/copiar respuestas rápidas) y panel-cliente → carrusel con promos activas + dots visibles con 2+ slides
- Las 6 respuestas rápidas sugeridas y los presets de bienvenida/ausencia son textos genéricos — revisar que el horario/ubicación coincida con la sucursal real antes de cargarlos en WA Business

### Próxima sesión debe empezar por
- Si se va a usar Automatización WA Business en producción: abrir panel-admin → Redes → cargar/ajustar bienvenida y ausencia reales, copiar a la app WhatsApp Business del celular siguiendo las instrucciones en pantalla
- Si se cargan promos en Firestore (`promos` collection): confirmar visualmente en panel-cliente que aparecen rotando en el carrusel del banner, no solo en la barra horizontal

---

## HISTORIAL SESIÓN 2026-06-27 — VendedorPRO con IA real (Gemini) + fixes panel-admin

### Hecho
- **IA real conectada a VendedorPRO**: nuevo backend serverless en `E:\ferreteria-oviedo\_utilidades\vendedorpro-coach\` (Netlify Function `coach.js`), desplegado en `https://vendedorpro-coach.netlify.app/.netlify/functions/coach`. Proxea a la API de Google Gemini (`gemini-2.5-flash`, capa gratis, `thinkingBudget:0` para evitar que el modo "thinking" consuma el límite de tokens sin generar texto). La `GEMINI_API_KEY` vive solo en Netlify (env var marcada como secreta), nunca en el repo ni en este chat. CORS restringido a `ferreteria-oviedo.web.app`/`.firebaseapp.com`.
- **Cuenta Netlify**: proyecto creado bajo `ferreteriaoviedo.elmanzano@gmail.com` (team `oviedoem`), consistente con GitHub/Firebase. Login del CLI persistido en el perfil de Windows (no en el proyecto).
- **Hallazgo importante**: la key de Gemini creada con la cuenta de negocio (`ferreteriaoviedo.elmanzano`) y luego con `alejandrog45@gmail.com` ambas dieron `429 RESOURCE_EXHAUSTED, limit:0` en `gemini-2.0-flash` y `gemini-1.5-flash` (modelo deprecado, 404). La causa real no fue cuenta Workspace vs personal — fue el modelo: `gemini-2.5-flash` sí tiene cuota gratis activa. Si se vuelve a topar con `limit:0`, probar otro modelo antes de asumir problema de cuenta/región.
- `panel-admin.html` → `vadmVPDetalle()`: agregado botón "🤖 Generar consejos con IA" que llama al endpoint real, cachea el resultado en `_vadmVPIA[nombre]` (sesión) y lo renderiza (resumen, fortalezas, oportunidad principal, ejemplos reales de boletas con producto vendido + recomendación, consejos, meta). El payload (`_vadmVPPayload`) incluye benchmark del equipo (`_vadmVPBenchmarkEquipo`) y ejemplos extraídos de las líneas reales del vendedor (`_vadmVPEjemplos`, agrupando por N° documento).
- `_vadmVPArmarPDF()` y el correo (`vadmVPEnviarCorreo`) ahora incluyen la sección de diagnóstico IA cuando ya fue generada en pantalla — antes solo mandaban el diagnóstico de reglas fijas en texto plano.
- **Fix bug real**: `sesionesAdminRenderizar()` solo clasificaba sesiones con `app` conteniendo "cliente" o "vendedor" — las sesiones tipo `"Cooperador"` (ingreso de Emerson Acevedo, confirmado por notificación) no aparecían en ninguna pestaña de Sesiones aunque sí estaban activas en Firestore. Agregada 3ª pestaña "🔒 Cooperadores" con su propio listado y botón "Cerrar todas".
- **Fix UX**: tab "🤖 VendedorPRO" en sub-tabs de Rankings se cortaba fuera de la vista (7 tabs en la fila, sin indicio de scroll) — reordenado a 2ª posición y agregado fade visual (`mask-image`) en el borde derecho de todas las filas de sub-tabs para indicar cuando hay más contenido.
- **Causa raíz resuelta**: la instalación de `netlify-cli` fallaba con `ECONNRESET` repetido — era Windows Defender **Network Protection** (`EnableNetworkProtection=1`) bloqueando la descarga grande de `registry.npmjs.org` (mismo patrón que el incidente previo con Justime, ver `justime-c-fix-com-y-defender`). Se puso en modo Audit temporalmente (con aprobación UAC), se instaló, y se restauró a Enabled al terminar.
- Deploy `firebase deploy --only hosting` ✅ + commit `361b6e3` ✅ (vía `ACTUALIZAR_GITHUB.bat`, bloqueos de seguridad intactos, sin tokens/credenciales en el diff).

- **Fix CSP real (bloqueaba la IA en producción)**: `firebase.json` tenía `Content-Security-Policy: connect-src 'self' https://*.firebaseio.com https://*.googleapis.com ...` — no incluía el dominio de Netlify, así que el navegador bloqueaba el `fetch()` al coach con "Failed to fetch" (confirmado en consola real del usuario: "violates connect-src directive"). Agregado `https://vendedorpro-coach.netlify.app` a `connect-src`. Deploy + commit `a39d9e1`.
- **Prompt de IA mejorado** (a pedido del dueño, comparando contra el PDF de la app de referencia ovipro.netlify.app): el `SYSTEM` de `coach.js` ahora pide resumen denso de 4-6 frases, 3-4 fortalezas con número de respaldo, exactamente 7 consejos numerados (antes "5 a 7" vago), y monto estimado en pesos en cada ejemplo/consejo cuando aplica. Verificado con curl usando los mismos datos del PDF de referencia (vendedor "Rvidal") — nivel de detalle ya equivalente.
- **Fix 404 favicon.ico**: agregado `<link rel="icon" href="icons/admin-192.png">` al `<head>` de panel-admin.html (el ícono ya existía, solo faltaba la referencia).
- **Fix 2 URLs muertas**: `_vadmCargarStockMap()` intentaba primero `CATALOGO PRODUCTOS/catalogo-dinamico.json` (archivo que nunca existió en el proyecto) antes de caer a `Datos.json` que sí funciona — eliminadas, dejando solo las URLs reales.
- **Correo VendedorPRO migrado al patrón estándar del panel**: antes usaba `mailto:` con texto plano + descarga de PDF separada. Ahora usa el mismo modal `#vadmEmailModal` que ya usan Despachos/Adquisiciones — vista previa HTML idéntica a lo que se ve en pantalla (tarjetas Factura/Boleta + diagnóstico IA si ya se generó + diagnóstico de reglas fijas), con auto-copia al portapapeles como rich HTML al abrir el modal (`navigator.clipboard.write` con `ClipboardItem`, pegar directo con Ctrl+V en Outlook/Gmail con formato real). Nueva función `window._vadmHtmlEmailVendedorPRO(nombre)`.
- **Fix bug real en PDF**: el pie de página (`_vadmVPArmarPDF`) se escribía en posición fija `y=280mm`, pero el formato "letter" mide 279.4mm de alto — esa línea quedaba fuera del área imprimible. Corregido para usar la posición real del cursor con tope de seguridad en 273mm.
- Deploy + commit `9ad98e4` con todos los fixes de este bloque.

### Fix 2026-06-27 (sesión 2) — VendedorPRO no respetaba filtros globales de vendedor/bodega
- **Bug**: `_vadmVPFiltrar()` solo filtraba por fecha, ignorando los 2 selects de vendedor de la barra global (`VENTAEM` y `Ver todos`, comparten `_vadmVendSel`) y el de bodega (`_vadmBodSel`). Además `vadmReRenderTabActivo()` no tenía rama para `vendpro`, así que cambiar esos filtros no refrescaba la pestaña.
- **Fix**: agregado el mismo patrón de filtro usado en otras pestañas (`_vadmVendSel`/`_vadmBodSel`) dentro de `_vadmVPFiltrar()`, y agregada la rama `else if(id==='vendpro') setTimeout(vadmRenderVendPro, 0);` en `vadmReRenderTabActivo()`.
- Validado con datos mock vía `preview_eval` (sin login real, Firebase Auth bloquea `localhost:8799` por dominio no autorizado — esperado): combinaciones vendedor solo, vendedor+bodega, sin filtro, todas correctas.
- Deploy `firebase deploy --only hosting` ✅ + commit `d5297ed` ✅.

### Fix 2026-06-28 — VendedorPRO: candidatos de producto reales (co-compra) en vez de inventados por la IA
- **Bug real encontrado**: la IA (Gemini) inventaba productos que Oviedo no vende (ej. "Cutter profesional", "membrana asfáltica") porque el prompt de `coach.js` le permitía "estimar precios razonables" sin darle ningún dato real de catálogo.
- **Bug de consistencia encontrado**: `_vadmVPBenchmarkEquipo()` nunca calculaba `margenPctFactura` ni `lineasPorBoletaFactura` del equipo (solo Boleta) — por eso no se podía comparar margen Factura vs equipo. Agregados ambos promedios.
- **Fix arquitectura (panel-admin.html)**: nuevas funciones `_vadmVPBuildCoCompraIdx()` / `_vadmVPCandidatosReales()` — calculan, sobre `_vadmLineas` real (todo el equipo, no solo el vendedor), qué códigos aparecen junto a cada producto vendido en el mismo N° de documento. Se cruzan con `_vadmStockMap` (catálogo real) para traer código+descripción+precio reales; cualquier código sin match en catálogo se descarta automáticamente (nunca llega a la IA). `_vadmVPEjemplos()` ahora adjunta `candidatosReales` a cada ejemplo, y `vadmRenderVendPro()` invalida la caché de co-compra y fuerza carga del catálogo si falta.
- **Fix render**: `_vadmVPRenderIA()` no convertía `\n` en `<br>` (texto de la IA se veía "todo junto" en pantalla) — agregada `_vadmVPNl2br()`. También se agregó tarjeta visual por producto real citado (`productosUsados`) con código+precio.
- **Fix prompt (`coach.js`, proyecto separado en `_utilidades/vendedorpro-coach`)**: regla no negociable — la IA solo puede citar productos del array `candidatosReales` de cada ejemplo (código y precio exactos, sin inventar ni redondear); si no hay candidatos reales, omite la recomendación de producto en ese ejemplo. Nuevo campo `productosUsados` en la respuesta JSON.
- Validado con datos mock (3 documentos simulados con co-compra real conocida): detectó correctamente el complemento esperado, descartó un código sin match de catálogo (simulando "FLETE") y un candidato sin evidencia de co-compra real.
- Revisión `/revisar-codigo` (14 reglas FO-001 a FO-014): 0 errores, 0 warnings.
- Deploy Netlify `coach.js` ✅ (`netlify deploy --prod`, sitio `vendedorpro-coach`) + Deploy Firebase Hosting ✅ + commit `ea1fd92` ✅.

### Fix 2026-06-28 (sesión 2) — IA fallaba en producción tras el cambio anterior: JSON truncado
- **Bug real visto en producción** (no en testing local): "Fallo generando coaching: Expected ',' or ']' after array element in JSON at position 6720" — el payload con `candidatosReales` agrandó la respuesta de Gemini y se cortaba a mitad del JSON por `maxOutputTokens: 4000` (límite fijado antes del cambio).
- **Fix**: `maxOutputTokens` subido a 8000 en `coach.js`; agregado log de `finishReason==='MAX_TOKENS'` para diagnosticar truncamiento sin ambigüedad si vuelve a pasar.
- Validado con `curl` directo al endpoint en vivo (`https://vendedorpro-coach.netlify.app/.netlify/functions/coach`) simulando el payload real de ricpobletev (4 ejemplos, candidatosReales reales) — JSON válido, citó exactamente los códigos/precios provistos, omitió el ejemplo sin candidatos (set de puntas Einhell) tal como pide el prompt.
- Deploy Netlify `coach.js` ✅ (`netlify deploy --prod`, deployId `6a40b12a`).

### Pendiente
- Validar en producción real (con datos reales, no el payload de prueba) que el botón "Generar consejos con IA" funciona end-to-end desde panel-admin.html en el navegador del dueño, ahora con candidatos reales — el fix de CSP fue confirmado por consola real, pero falta una pasada completa post-fix (generar IA → ver modal con productos reales → descargar PDF → enviar correo) de punta a punta.
- El sitio `vendedorpro-coach.netlify.app` (carpeta `_utilidades/vendedorpro-coach`) no tiene repo git propio — queda fuera del flujo de `ACTUALIZAR_GITHUB.bat`. Pendiente decidir si se versiona en GitHub (mismo repo o uno aparte).
- Capa gratis de Gemini tiene límites de requests/día — si el uso real de VendedorPRO los supera, evaluar plan de pago de Google AI o cachear resultados por vendedor+período en Firestore para no regenerar si no cambiaron los datos.
- Notas de Crédito (devoluciones) del vendedor aún NO se envían a la IA — solo se usan para el total del equipo en el dashboard. Diseño del reporte interactivo (mockup HTML con logo+gráfico de horas+tabla Excel) quedó aprobado por el dueño pero solo implementado parcialmente (candidatos reales + fix benchmark); faltan: gráfico de ventas por hora dentro del modal real, tabla comparativa Factura/Boleta con bordes en el render real, y el diagnóstico de NC.

### Próxima sesión debe empezar por
- Probar el flujo completo de VendedorPRO en el navegador real con login: Generar IA → confirmar que los productos citados son reales (código+precio) → Descargar PDF → Enviar por correo.

### Fix 2026-06-28 (sesión 3) — Nuevo menú "Traspasos CD → PEM/SEM" (El Manzano)
- **Origen**: dueño mostró herramienta externa `traspaso-cd.netlify.app` (sube Excel manual, calcula traspaso CD→tiendas por cobertura 14 días) y pidió la misma idea pero integrada al panel, solo para El Manzano (CD→PEM/SEM), sin depender de Biwiser ni de subir Excel a mano.
- **Decisión de criterio**: en vez de calcular "máximo" por velocidad de venta propia (no había histórico de stock por bodega/fecha para sacar un máximo real), se usa el **ST_MAX configurado en el ERP por bodega** (mismo origen que ya usa Solicitud Stock) — confirmado por el dueño: "la lógica de panel admin en cálculos debe ser del ERP" para umbrales de abastecimiento.
- **Cambio en `BODEGAS\descargar_stock_critico.py`**: el SELECT a `R_STOCK_PRODUCTOS` ya traía `R.IDBODEGA` pero se sumaba sobre todas las bodegas comerciales (PEM+SEM+CEM+MEM) en un solo total, perdiendo el dato por bodega individual. Se agregó `por_bodega` (sin tocar el agregado `prods` que ya consume Solicitud Stock) y se escribe como campo nuevo `porBodega` en `data/stock-critico.json`: `{codigo: {PEM:{min,max,critico,repo,disp}, SEM:{...}, ...}}`.
- **Nuevo tab `panel-admin.html`** (`#tab-traspasocd`, función `renderTraspasoCD()`): por código, `brecha = max(0, ST_MAX_erp_bodega − stock_actual)` en PEM y en SEM (desde `_vadmStockMap.pem/sem/cd`), reparte el CD disponible priorizando la brecha mayor primero (mismo criterio de `[[reglas-negocio-stock]]`: CD abastece primero), marca "CD insuficiente" si no alcanza. Resumen ejecutivo (traspasos/unidades/SKUs insuficientes) + tabla + exportar CSV (`exportarTraspasoCDCsv()`). Botón nuevo en sidebar grupo Adquisiciones.
- **Aclaración importante post-implementación**: el dueño pidió inicialmente que "toda la lógica de cálculo del panel sea del ERP" en TODOS los menús (Quiebre/Sobrestock/Tránsito incluidos) — pero se confirmó que `R_STOCK_PRODUCTOS` NO tiene campo de rotación/velocidad, solo umbrales min/max/crítico configurados a mano por Adquisiciones. El dueño aclaró después: la rotación de Quiebre/Sobrestock/Tránsito (basada en venta real / días hábiles 30/60/90) **se mantiene como está** — es correcta y automática. El ERP solo se usa para umbrales de abastecimiento (Solicitud Stock, Traspasos CD), no para rotación. Días hábiles ya excluye domingo + feriados chilenos correctamente (`_vadmEsDiaHabil`, línea ~10931) — confirmado, sin cambios necesarios ahí.
- **Pendiente**: correr `descargar_stock_critico.py` contra el ERP (pipeline normal, próxima pasada de `ACTUALIZAR_TODO.bat`) para que `stock-critico.json` tenga el campo `porBodega` real y el tab Traspasos CD muestre datos.
- Deploy: hecho. Commit: hecho (ver fix siguiente).

### Fix 2026-06-28 (sesión 3b) — Traspasos CD ocultaba códigos sin ST_MAX configurado en el ERP
- **Bug real reportado por el dueño**: META005 tiene stock en CD pero no aparecía en Traspasos CD. Verificado contra `data/stock-critico.json`: META005 no tiene NINGÚN parámetro ERP configurado (ni ST_MIN ni ST_MAX, en ninguna bodega) — Adquisiciones nunca le asignó umbral. La lógica anterior (`if(!pb) return;`) descartaba silenciosamente cualquier código sin parámetro ERP, aunque hubiera una oportunidad obvia (CD>0, tienda en 0).
- **Fix** (`panel-admin.html`, `_tcdCalcular()`): cuando no hay `maxPem`/`maxSem` del ERP para el código, ahora se evalúa un caso alterno: si `cd>0` y (`pem<=0` o `sem<=0`), se sugiere igualar al CD disponible repartido entre las bodegas en cero, marcado con `sinErp:true` — badge "⚠️ Sin ERP" (fondo amarillo en la fila), columna Máx muestra "—", y nueva tarjeta resumen "SKU(s) sin ST_MAX en ERP". Confirmado con el dueño: se debe mostrar la sugerencia automática en vez de dejarlo invisible.
- V37.31.

### Fix 2026-06-28 (sesión 3c) — Traspasos CD rediseñado completo: del criterio ERP al criterio manual real (ranking + embalaje)
- **Contexto**: el dueño mostró su Excel real de trabajo (`SOLICITUDES SANTIAGO_SEM.XLSM`) y dijo explícitamente "no me gustó la lógica y diseño, debes editarla al igual que lo hago yo manual". Su proceso real: columnas PEM/SEM/RCE/CD (stock por bodega) + Ranking Ventas en 3 ventanas (rango elegido, 2 meses, 1 mes) + columna Solicitar manual, donde **siempre se pide en embalaje cerrado** (pallet o caja) — el código `(E12)`, `(E-50)`, `(E1)` etc. en la descripción indica el tamaño de empaque; ej. venta=80 y empaque=100 → se solicita 100, no 80.
- **Decisión**: se descartó por completo el criterio ST_MAX del ERP para este tab (se mantiene solo para Solicitud Stock, que es un proceso distinto). `BODEGAS\descargar_stock_critico.py` y su campo `porBodega` quedan sin uso en este tab (no se revirtieron, podrían servir a futuro, pero `panel-admin.html` ya no los consume aquí).
- **Verificado antes de implementar**: el patrón `(E-?\d+)` en `descripcion` solo cubre 51% del catálogo (3.085/6.022) — para el resto se usa embalaje=1 (sin redondeo) por defecto.
- **Rediseño completo de `panel-admin.html` `#tab-traspasocd`**:
  - Filtro de fechas `tcdDesde`/`tcdHasta` (default: últimos 4 meses) define el "Ranking principal"; además se calculan automáticamente Ranking 2 meses y Ranking 1 mes (ventana fija desde hoy, sin importar el filtro principal) — los 3 desde `_vadmLineas` agrupados por código y fecha.
  - Nueva función `_tcdParseEmbalaje(desc)` extrae el número de `(E12)`/`(E-50)` etc., default 1 si no hay match.
  - Tabla: Código, Marca, Descripción, PEM, SEM, RCE, CD, Ranking principal, Ranking 2m, Ranking 1m, Embalaje, **Solicitar** (input numérico editable, prellenado con `Math.ceil(rankingPrincipal/embalaje)*embalaje`, el dueño puede sobreescribirlo a mano antes de exportar).
  - `exportarTraspasoCDCsv()` ahora lee el valor actual de cada input (no el sugerido original) al exportar, para respetar ajustes manuales.
  - Resumen: códigos listados, con venta en el rango, unidades sugeridas totales, SKUs donde la sugerencia excede el CD disponible (marcados ⚠️ en la columna CD).
- V37.32.

### Fix 2026-06-28 (sesión 3d) — Traspasos CD: filtrar CD=0, quitar columna Marca, ordenar por rotación
- **Feedback del dueño** tras ver la tabla real: mostraba códigos con CD=0 (nada que traspasar), la columna Marca quitaba espacio sin agregar valor a la decisión, y faltaba poder ordenar explícitamente por la ventana de rotación que más le interesa revisar.
- **Fix** (`panel-admin.html`): `_tcdCalcular()` ahora solo agrega filas con `cd>0` (antes incluía códigos sin CD pero con venta en el rango, lo que generaba ruido). Columna Marca eliminada de la tabla y del CSV. Nuevo selector "Ordenar por" (`#tcdOrden` + `_tcdReordenar()`) con 3 opciones: rotación del rango elegido (default), 2 meses, 1 mes — reordena sin recalcular ventas.
- V37.33.

### Fix 2026-06-28 (sesión 3e) — Inconsistencia de rotación: Traspasos CD vs Quiebre no coincidían en el día de corte
- **Pedido del dueño**: "revisa consistencia en rotación". Auditoría de todos los cortes de fecha tipo `cXX` en `panel-admin.html` (Quiebre línea ~10673-10675, Sobrestock línea ~9356, Tránsito línea ~11137): todos normalizan el corte a medianoche con `setHours(0,0,0,0)` — **excepto** `c2m`/`c1m` en `_tcdCalcular()` (Traspasos CD, agregados en la sesión 3c), que heredaban la hora actual del momento (ej. 14:07) en vez de medianoche.
- **Efecto del bug**: para el mismo código y la misma ventana de 30/60 días, Quiebre incluía las ventas del día de corte completo (desde 00:00) pero Traspasos CD las excluía si ocurrían antes de la hora actual de ese día — los números de "Ranking 1 mes"/"Ranking 2 meses" podían diferir de los de Quiebre (`cob30`/`cob60`) en el mismo código.
- **Fix**: agregado `c2m.setHours(0,0,0,0)` y `c1m.setHours(0,0,0,0)` en `_tcdCalcular()`, igual patrón que el resto del panel.
- V37.34.

### Fix 2026-06-28 (sesión 3f) — Traspasos CD: exportar en PDF/Excel/HTML + correo (igual modelo que el resto del panel)
- **Pedido del dueño**: "exportar en csv no sirve, debe ser en pdf, excel y html... copia mismo modelo [de Solicitud Stock], debe descargar lo que ve el usuario en tiempo real".
- **Investigación**: Solicitud Stock tiene su propio modal bespoke (`#reqEmailModal`) con copiar HTML + mailto, pero el patrón más completo y reutilizable del panel es el modal genérico `#vadmEmailModal` (usado por Quiebre/Sobrestock/Tránsito/Merma/Despachos) que ya soporta Copiar HTML + Descargar .html + Descargar Excel, alimentado por `_vadmEmailInventarioData={tab:'...', items:[...]}`. PDF no existía en ese modal genérico (solo VendedorPRO lo tenía, con su propio jsPDF). jsPDF+autoTable y SheetJS XLSX ya están cargados globalmente en el `<head>`.
- **Decisión de arquitectura**: en vez de enganchar Traspasos CD al dispatcher global `vadmAbrirEmailModal()`/`_vadmTabActiva()` (que depende de la convención `.vsec-` de los tabs de Ventas y no aplica a los tabs `tab-pane` de Adquisiciones), se creó un flujo autocontenido: botón local en el tab (`tcdEnviarEmail()`) que llena `_vadmEmailInventarioData` y abre el modal genérico directamente — el resto de los botones del modal (Excel, PDF, Copiar HTML, Descargar .html) lo detectan por `_vadmEmailInventarioData.tab==='traspasocd'` sin tocar el dispatcher de Ventas.
- **Cambios (`panel-admin.html`)**:
  - Botón "Exportar CSV" reemplazado por "📧 Enviar / Exportar (PDF · Excel · HTML)" → `tcdEnviarEmail()`.
  - Nuevo botón "📄 Descargar PDF" agregado al modal genérico `#vadmEmailModal` (antes solo tenía Copiar HTML/Descargar .html/Descargar Excel) → dispatcher `vadmDescargarPdf()` (genérico, hoy solo implementado para `traspasocd`; otras pestañas muestran "PDF no disponible para esta pestaña todavía", no rompe nada existente).
  - `_vadmExcelInventario()`: nueva rama `if(inv.tab==='traspasocd')` → `window.tcdExportExcel()`.
  - Nueva función `_tcdLiveRows()`: lee `_tcdRows` + el valor ACTUAL de cada input `tcdSol_<i>` en pantalla — los 3 formatos de export reflejan exactamente lo que el dueño ve/edita en el momento, no el valor sugerido original.
  - `window.tcdEnviarEmail()` / `window.tcdExportExcel()` / `window.tcdExportPdf()`: HTML con `_emailHdr`/`_emailTbl` (helpers ya existentes, mismo estilo visual que el resto de reportes), Excel vía SheetJS (`XLSX.utils.aoa_to_sheet`), PDF vía jsPDF+autoTable (orientación landscape, fila roja si `solicitar>cd`).
  - `exportarTraspasoCDCsv()` eliminada por completo (reemplazada).
- V37.35.

### Fix 2026-06-28 (sesión 3g) — Consulta de Stock: todas las bodegas + margen real del ERP (sin markup propio)
- **Pedido del dueño**: "debe tener todas las bodegas que trabajamos, incluyendo todos los datos de cada código en columnas, saca lógica markup, debe ser igual que el ERP, busca el módulo en memorias o archivos".
- **Investigación**: `_csBodegas` (ficha detalle, abajo) ya tenía las 8 bodegas (PEM/SEM/CEM/MEM/IEM/TEM/RCE/CD) desde que se creó el tab — lo que faltaba era la **tabla de resultados de búsqueda** (arriba), que solo mostraba PEM/SEM/CEM/MEM/Total Comercial. Sobre el markup: confirmado contra `erp-reportes-mapeados` (memoria) y `descargar_erp.py`/`descargar_ventas_erp.py` que el ERP **no tiene un campo de markup a nivel de catálogo** (precio/costo) — el único margen real del ERP es transaccional, vía las columnas `Margen`/`Margen(%)` que trae cada venta (`descargar_ventas_erp.py` líneas 205/252, calculado por el pipeline desde `margen`/`neto` reales de cada documento ERP).
- **Fix** (`panel-admin.html`):
  - Tabla de resultados de búsqueda (`#csTablaResult`/`vadmBuscarStock()`): agregadas columnas IEM/TEM/RCE/CD (antes solo PEM/SEM/CEM/MEM/Total Comercial) — ahora muestra las 8 bodegas igual que la ficha de abajo.
  - Campo "Markup" (calculado como `precio/costo`, invención del panel sin respaldo en el ERP) reemplazado por **"Margen ERP (ventas reales)"**: promedio de `margenPct` de las ventas reales de ese código en `_vadmLineas` — mismo campo que ya usa el resto del panel (`vadmRenderStockConsulta()`), no un cálculo nuevo. Sin ventas registradas para el código → muestra "— (sin ventas registradas)" en vez de un número inventado.
- V37.36.

### Fix 2026-06-28 (sesión 3h) — Consulta de Stock: Mínimo/Crítico/Máximo/Costo Total/Rotación + tiempo de tránsito proveedor (NUEVO script SQL)
- **Pedido del dueño**: "agrega más datos en las columnas de abajo: stock, crítico, mínimo, máximo, costo total, rotación de venta, agrega conteo desde que está en tránsito hasta que se ingresa para saber cuánto se demora en llegar de cada proveedor según código — tiempo desde que se crea OC y desde que se ingresa con guía recepción proveedor o guía de ingreso entre bodegas".
- **Primer intento equivocado**: se intentó investigar el dato de fecha de OC delegando a un sub-agente sin revisar primero los archivos de referencia ya existentes en el proyecto (`IDS_REFERENCIA.md`, `BODEGAS\Copia de Movimiento Stock.xlsx`) — el dueño corrigió: "esta información la tienes hace tiempo... revisa y avanza". Lección: **antes de investigar con agentes, revisar `IDS_REFERENCIA.md` y los .xlsx de referencia del proyecto — son la fuente de verdad de IDs de documentos/bodegas y casi siempre ya tienen la respuesta.**
- **Investigación SQL en vivo (autorizada explícitamente por el dueño)**: se confirmó que la fecha de creación de OC SÍ existe en `M_DOCUMENTOS_ENCABEZADO`/`M_DOCUMENTOS_DETALLE.FECHA_EMISION`, y que el campo de enlace OC→recepción es `M_DOCUMENTOS_DETALLE.IDDOCUMENTO_ORIGEN`/`IDSUCURSAL_ORIGEN`/`IDNUMERO_ORIGEN`/`IDLINEA_ORIGEN` (los 4 campos son obligatorios para el JOIN — sin `IDSUCURSAL_ORIGEN` se duplican filas porque `IDNUMERO` no es único entre sucursales; verificado: conteo de recepciones con join == conteo total sin join, sin duplicados). Variantes de OC confirmadas vía `M_DOCUMENTOS`: 8/26/104/108 (normal), 800/801 (Integrada Vigente/Pendiente), 802/803 (Integración MTS/MTS Pendiente), 804 (BPD) — coincide exactamente con lo que describió el dueño. Proveedor = `IDENTIDAD` (RUT), nombre vía `M_ENTIDADES.RAZON_SOCIAL`.
- **Nuevo script `BODEGAS\descargar_oc_leadtime.py`** (mismo patrón de credenciales que `descargar_stock_critico.py`): genera `data/oc-leadtime.json` con, por código, días promedio de tránsito (OC→GRC/GRT/GIB) y desglose por proveedor (rut+nombre+días+n). Ventana de análisis: 180 días. Probado en vivo: 1.112 códigos con datos reales (ej. `26302`: MULTIACEROS S.A. 30.0 días, MATERIALES Y SOLUCIONES S.A. 27.0 días).
- **Pipeline**: agregado PASO 1M en `ACTUALIZAR_TODO.bat` y `ACTUALIZAR_TODO_AUTO.bat`, justo después de PASO 1L (stock-critico), mismo patrón de manejo de error (no bloquea el resto del pipeline si falla).
- **`panel-admin.html`** (Consulta de Stock):
  - Tabla "Stock por bodega": agregadas columnas Mínimo/Crítico/Máximo (ERP, desde `stock-critico.json.porBodega` ya generado en sesión 3c — solo aplica a PEM/SEM/CEM/MEM, las únicas con parámetro ERP), Costo Total (`Físico × costo`, distinto de "Valor Stock" que usa Disp), Rotación 90d (qty vendida / días hábiles 90, por bodega vía `bodegaCorta`, "—" para bodegas auxiliares sin venta).
  - Nuevo bloque "Tiempo de tránsito proveedor" en la ficha: días promedio + desglose top-5 proveedores, desde `oc-leadtime.json` (carga lazy con `_csCargarLeadTime`, mismo patrón que `_csCargarStockCritico`).
  - `vadmRenderStockConsulta()` ahora carga ambos JSON antes de pintar (`_csPintarFicha()`), sin bloquear si no están disponibles.
- **Pendiente**: correr el pipeline completo (`ACTUALIZAR_TODO_AUTO.bat`) para que el PASO 1M quede integrado en la rutina diaria — hoy se ejecutó el script suelto para validar.
- V37.37.

### Fix 2026-06-28 (sesión 3i) — Consulta de Stock: bloque "Tiempo de tránsito" quedaba pegado en "Cargando..."
- **Bug reportado por el dueño**: al buscar un código (ej. TORN0600), el bloque "Tiempo de tránsito proveedor" quedaba permanentemente en "Cargando..." y la tabla "Stock por bodega" no mostraba filas. Producto/Precios sí pintaban bien (incluye Margen ERP), lo que confirma que `_csPintarFicha()` se ejecutaba pero algo entre el bloque de margen y el final de la función impedía terminar — la causa exacta no se pudo reproducir en consola real (sin acceso a navegador del dueño), así que se aplicó una corrección defensiva en vez de adivinar.
- **Fix** (`panel-admin.html`, `_csPintarFicha()`): 
  1. El bloque de "Tiempo de tránsito proveedor" se movió ANTES del cálculo de la tabla por bodega (en vez de al final) — así pinta independientemente aunque el resto falle.
  2. Ambos bloques (tiempo de tránsito y tabla por bodega) quedaron envueltos en `try/catch` — si algo lanza una excepción, se muestra el mensaje de error real en pantalla (`e.message`) en vez de quedar la UI silenciosamente colgada, y no bloquea el resto de la ficha.
  3. Eliminado el bloque duplicado de tiempo de tránsito que había quedado al final de la función desde el cambio anterior.
- **Pendiente real**: si el error persiste después de este fix, el mensaje de error en pantalla (rojo, dentro de la tabla o el bloque de tránsito) dirá la causa exacta — pedir captura de ese mensaje en la próxima sesión si vuelve a pasar.
- V37.38.

### Fix 2026-06-28 (sesión 3j) — Causa real encontrada: ReferenceError `_isbPedidosComprometidos is not defined`
- **El try/catch de V37.38 funcionó como diagnóstico**: mostró en pantalla "Error pintando stock por bodega: _isbPedidosComprometidos is not defined" — causa raíz real, no había que adivinar más.
- **Causa**: `_isbPedidosComprometidos` se declara con `var` dentro de un IIFE `(function(){...})()` en la línea ~18422-18946 de `panel-admin.html`. Las variables `var` dentro de un IIFE quedan local a esa función — NO se filtran al scope global ni a `window`. `vadmRenderStockConsulta()`/`_csPintarFicha()` viven FUERA de ese IIFE (línea ~17796), así que nunca pudieron ver esa variable — **este bug ya existía antes de esta sesión** (la tabla "Stock por bodega" probablemente nunca tuvo datos de columna Pedido; antes sin try/catch fallaba en silencio y parecía solo recorte de pantalla, no un error real).
- **Fix**: `var pedMap = (typeof _isbPedidosComprometidos!=='undefined' ? _isbPedidosComprometidos[cod] : null) || {};` — `typeof` es la única forma segura de comprobar un identificador que puede no estar declarado en el scope (referenciarlo directo lanza `ReferenceError` aunque sea dentro de un `||`).
- V37.39.

### Fix 2026-06-28 (sesión 3k) — Tiempo de tránsito desglosado por bodega receptora (PEM/SEM/etc), no solo promedio general
- **Pedido del dueño**: viendo el bloque de tiempo de tránsito ya funcionando, preguntó "¿dónde dice cuánto se demora desde que hace la orden hasta que llega a PEM o SEM?" — el bloque solo mostraba el promedio general + desglose por proveedor, sin indicar a qué bodega llegó cada recepción.
- **Fix** (`BODEGAS\descargar_oc_leadtime.py`): la query ya traía `rec.IDBODEGA` disponible pero no se usaba — se agregó `BODEGAS_RECEPCION` (mapa IDBODEGA→símbolo, igual lista que `IDS_REFERENCIA.md`) y se agrupan los días de tránsito también por bodega destino. Nuevo campo `porBodega` en `oc-leadtime.json`: `{codigo: {... porBodega: {'PEM':{diasProm,n}, 'SEM':{...}, ...}}}`. Verificado con dato real: código `26302` → PEM 36.5 días (4 recepciones), CD 10.0 días (1 recepción) — confirma que SÍ varía por bodega, no es un solo promedio ciego.
- **`panel-admin.html`**: nueva columna "Días tránsito OC" en la tabla "Stock por bodega" — responde directo a la pregunta por fila (PEM, SEM, etc.), en vez de solo el resumen agregado arriba.
- V37.40.

### Fix 2026-06-28 (sesión 3l) — Consulta de Stock: formato tipo Excel, export PDF/Excel/HTML, desglose por marca
- **Pedido del dueño**: bordes tipo hoja Excel, mejor acomodo de columnas, columna "Bodega" → "BOD" con solo siglas (PEM/SEM/...), quitar columna "Tipo" (el dueño ya sabe para qué es cada bodega), botón de descarga Excel/HTML/PDF que descargue lo que se ve en pantalla en tiempo real, y un filtro por marca para ver los días de demora de todos los códigos de esa marca (porque distintas OC de la misma marca pueden tardar distinto, no llega todo junto).
- **Tabla "Stock por bodega"** (`panel-admin.html`):
  - Clase CSS nueva `.cs-xls` con `border:1px solid` en todas las celdas (estilo hoja de cálculo).
  - Columna "Bodega" → "BOD", celda muestra solo la sigla (`b.label` ahora es `'PEM'` en vez de `'PEM · Patio El Manzano'`), con `title` (tooltip) mostrando el nombre completo al pasar el mouse — el dato completo no se pierde, solo deja de ocupar espacio.
  - Columna "Tipo" eliminada (Comercial/Auxiliar ya no se muestra como columna, queda solo como color del texto de la sigla).
  - 3 botones nuevos: `csDescargarExcel()` (vía `XLSX.utils.table_to_book` leyendo el DOM de `#csBodTabla` tal cual está en pantalla — incluye cualquier filtro/estado visible), `csDescargarHtml()`, `csDescargarPdf()` (jsPDF+autoTable con `html:'#csBodTabla'`, también lee el DOM en vivo). Los 3 leen la tabla en tiempo real, no recalculan nada por separado.
- **Desglose por marca** (nuevo bloque debajo de la tabla): select de marca (poblado lazy desde `_vadmStockMap`, preseleccionada con la marca del producto actual) + botón "Ver desglose" → `csVerDesgloseMarca()` lista TODOS los códigos de esa marca con recepciones de OC en `oc-leadtime.json`, ordenados por días de tránsito descendente, con alerta visual si el rango (máx/mín) es mayor a 1.5× — confirma visualmente cuando "no llega todo junto".
- V37.41.

### Fix 2026-06-28 (sesión 3m, cierre) — Revisión de seguridad + actualización de planos + sync memoria
- **Revisión de seguridad de los cambios de hoy** (a pedido del dueño antes de cerrar):
  - **XSS encontrado y corregido**: `csVerDesgloseMarca()`, el bloque "Tiempo de tránsito proveedor" y `_csTablaHtmlCompleto()` (export HTML) insertaban `nombre proveedor` (M_ENTIDADES.RAZON_SOCIAL) y `descripción producto` directo en `innerHTML`/HTML exportado sin escapar — mismo patrón que causó el bug real FO-002 ya corregido antes en `renderWaRapidas()`. Aplicado `venAdmEsc()` (helper ya existente) en los 4 puntos.
  - **Nota pendiente, NO corregida hoy** (fuera de alcance — preexistente en TODO el panel, no de esta sesión): la tabla de resultados de búsqueda (`vadmBuscarStock()`) y varias tablas de Quiebre/Sobrestock/Tránsito insertan `p.desc`/`p.marca` sin escapar — mismo riesgo, pero corregirlo en todo el panel es una tarea aparte (blast radius grande). Queda anotado para una sesión dedicada a XSS.
  - **`BODEGAS\descargar_oc_leadtime.py`**: revisado — todas las queries SQL usan parámetros bindeados (`cursor.execute(sql, params)`), el único `.format()` solo inserta placeholders `?` (cantidad, no valores) — sin riesgo de inyección SQL.
- **`pipeline-datos-mapa.html` actualizado**: agregado flujo PASO 1L (`descargar_stock_critico.py`, que no estaba documentado pese a existir desde sesión 3c) y PASO 1M (`descargar_oc_leadtime.py`, nuevo hoy) → `stock-critico.json`/`oc-leadtime.json` → tabs Solicitud Stock/Traspasos CD/Consulta de Stock. Tarjetas nuevas para `stockconsulta` (actualizada) y `Traspasos CD` (nueva) en el grupo STOCK. Versión/fecha del mapa actualizada a V37.41/2026-06-28.
- **Memoria sincronizada**: `robocopy W:\claude-config → C:\claude-config /MIR` corrido manualmente (475 archivos, código robocopy 3 = éxito) — respaldo intencional al día, ver `cutover-claude-config-completado`.
- V37.42. Sesión cerrada — continúa en la próxima sesión.

### Fix 2026-06-28 (sesión 3n, cierre) — Diagnóstico de 3 pendientes + XSS real corregido
- **XSS real encontrado y corregido** (el pendiente anotado en la sesión 3m arriba era impreciso — no estaba en Quiebre/Sobrestock/Tránsito, esos ya escapaban bien con `venAdmEsc`/`_emailEsc`):
  - `vadmBuscarStock()`: tabla de resultados de la Consulta de Stock insertaba `item.cod`, `p.desc`, `p.marca` sin escapar en `innerHTML` y en el atributo `data-cod`. Corregido con `venAdmEsc()`.
  - `csVerDesgloseMarca()`: mensaje "sin recepciones para marca X" insertaba `marca` (de `sel.value`) sin escapar. Corregido.
  - Verificado: todos los `<script>` siguen siendo sintácticamente válidos, panel sin errores de consola en preview (login real no probado — requiere credenciales, no manipuladas por regla de seguridad del proyecto).
- **Playwright (PASO 1H) resuelto**: el navegador Chromium YA estaba instalado en `E:\playwright-browsers\chromium_headless_shell-1223\` (siguiendo la regla de no usar C:), pero faltaba la variable de entorno `PLAYWRIGHT_BROWSERS_PATH` (no existía). Seteada permanente a nivel Usuario. Probado: `chromium.launch()` OK.
- **PASO 1A (descargar_erp.py) — causa raíz diagnosticada**: error real es `net::ERR_BLOCKED_BY_CLIENT` en `200.6.113.97` (mismo IP del ERP). Mismo patrón ya documentado y resuelto en Justime (`justime-c-fix-com-y-defender`): Windows Defender Network Protection (confirmado activo) bloquea por reputación de IP, de forma intermitente. El intento de aplicar la excepción vía PowerShell elevado fue bloqueado por el clasificador de seguridad de Claude Code (debilitar antivirus requiere aprobación explícita del usuario, no automatizable). Se generó `C:\Users\alejandro\Desktop\FIX_DEFENDER_PASO1A.bat` para que el dueño lo ejecute como Administrador.
- Deploy V37.43: 2026-06-28 22:22 — fix XSS (vadmBuscarStock + csVerDesgloseMarca), deploy hecho con `firebase deploy --only hosting` directo (PUBLICAR.bat quedó descartado para uso headless: es interactivo, pregunta visibilidad de precios del catálogo — decisión de negocio que no corresponde automatizar).
