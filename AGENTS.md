# AGENTS.md — Ferretería Oviedo El Manzano
# Instrucciones del agente + Safe-Change Skill + Historial desde 2026-06-01
# Versión activa: V37.23 · Última actualización: 2026-06-10 (herramientas seguridad v3)

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
[ ] xlsm-enrich.json sigue siendo generado por leer_xlsm.py (no por main.py)
[ ] _catalogo_generado_hoy() no fue revertida a _actualizar_xlsx_es_hoy()
[ ] ventas-manzano.json sigue siendo generado por guardar_json() en main.py
[ ] Subquery ULT en descargar_bod.py tiene WHERE IDBODEGA=? antes del GROUP BY
```

---

<!-- Fuente de verdad: MEMORY.md §3 — esta copia puede quedar desactualizada -->
## RUTAS CRÍTICAS — NO BUSCAR, USAR DIRECTAMENTE

```
Proyecto activo:     E:\ferreteria-oviedo\
Git sync (solo):     E:\git-sync\        (NO es el proyecto — solo copia para git)
Archivados:          E:\ferreteria-oviedo\_HISTORICO\
Bodegas XLSM:        E:\ferreteria-oviedo\BODEGAS\
Memory Claude:       W:\claude-config\projects\E--ferreteria-oviedo\memory\
                     (acceso via junction C:\Users\Ferreteria Oviedo\.claude → W:\claude-config\)
CLAUDE.md global:    W:\claude-config\CLAUDE.md
Git config:          E:\config\gitconfig  (GIT_CONFIG_GLOBAL apunta aquí)
Tokens GitHub:       E:\config\gcm-store  (DPAPI cifrado, transparente via GCM)
Herramientas W:      W:\herramientas\seguridad\
Docs backup W:       W:\proyecto-docs\   (AGENTS.md, MEMORY.md — copia de emergencia)
Backup .claude orig: C:\Users\Ferreteria Oviedo\.claude-bak-20260604  (NO borrar)

MD activos raíz:
  AGENTS.md:               E:\ferreteria-oviedo\AGENTS.md         (este archivo)
  MEMORY.md:               E:\ferreteria-oviedo\MEMORY.md
  MAPA_FLUJO_PROYECTOS.md: E:\ferreteria-oviedo\MAPA_FLUJO_PROYECTOS.md
  _HISTORICO/:             E:\ferreteria-oviedo\_HISTORICO\       (MDs históricos)
```

---

## ARQUITECTURA DE DISCOS

| Disco | Tipo | Contenido |
|---|---|---|
| Disk 0 — NVMe 256GB | C: (121GB) | Windows activo + Python + Node.js + Git for Windows |
| Disk 0 — NVMe 256GB | D: (116GB) | RESPALDO — backups, copia emergencia scripts |
| Disk 1 — TOSHIBA USB 1.8TB | W: (128GB) | Claude config + herramientas seguridad |
| Disk 1 — TOSHIBA USB 1.8TB | E: (1.7TB) | Proyecto + herramientas portables |
| Disk 2 — JMicron USB 932GB | F: (874GB) | Windows boot alternativo (KMS activo) + 4.6GB updates pendientes |
| Disk 2 — JMicron USB 932GB | L: (40GB) | PROYECTO_E — respaldo npm-global |
| Disk 2 — JMicron USB 932GB | M: (15GB) | CONFIG_W — respaldo claude-config |

**W: y E: son el mismo disco físico USB (TOSHIBA).** La partición W: es más estable (menos actividad).
**F:, L:, M: son el mismo disco físico USB (JMicron).** F: es un Windows-To-Go alternativo; activar con F:\ACTIVAR_WINDOWS.bat al primer boot.

### Junction Claude Code
```
C:\Users\Ferreteria Oviedo\.claude  ──junction──►  W:\claude-config\
```
Claude busca su config en C:, Windows redirige a W: transparentemente.
**Backup de rollback:** `C:\Users\Ferreteria Oviedo\.claude-bak-20260604` (NO borrar).

### Variables de entorno (HKCU)
```
GIT_CONFIG_GLOBAL    = E:\config\gitconfig
NPM_CONFIG_PREFIX    = E:\npm-global
NPM_CONFIG_CACHE     = E:\npm-cache
NPM_CONFIG_USERCONFIG= E:\config\.npmrc
XDG_CONFIG_HOME      = E:\config
GH_CONFIG_DIR        = E:\config\gh
PIP_CACHE_DIR        = E:\pip-cache
```

---

## EMERGENCIA DISCO E: / W:

**Causa raíz confirmada:** `FortiUSBmon.exe` (C:\Users\Ferreteria Oviedo\Desktop\FortiUSBmon.exe)
re-adhiere FortiShield/fortimon3 al volumen USB inmediatamente al remontar, impidiendo que NTFS monte.
Historial: 6 ocurrencias (2026-06-03, 2026-06-04 tarde, 2026-06-04 noche, 2026-06-06, 2026-06-09, 2026-06-10).

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

### Rollback de junction si W: falla
```powershell
cmd /c "rd ""C:\Users\Ferreteria Oviedo\.claude"""
Rename-Item "C:\Users\Ferreteria Oviedo\.claude-bak-20260604" ".claude"
```

### GitHub como respaldo final
Si no puedes acceder a W: ni a E:, dar a Claude el AGENTS.md desde GitHub:
`https://github.com/oviedoem/ferreteria-oviedo/blob/main/AGENTS.md`

---

## PROYECTO

- Stack: HTML/CSS/JS Vanilla + Firebase Hosting (JSON estáticos) + Python pipeline ERP
- Directorio activo: `E:\ferreteria-oviedo\` — NO trabajar en D:\ ni en E:\git-sync\
- Versión activa: V37.22

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
- Sesion 2026-06-10 tarde: herramientas seguridad v3 — FortiUSBmon.exe (causa raiz #6) documentado; Stop-FortiUSBmon + Repair-DirtyBit + contador fallos en REMONTAR_DISCO_E.ps1 v3; 6 archivos actualizados en D: y W: (M: pendiente, no disponible)
- Sesion 2026-06-06 mejoras adicionales:
  launch.json creado para Claude Code.
  LIBERAR_CLAUDE_RAM.bat — cierra Claude Desktop, preserva Claude Code.
  Justime Regsvr32 fix — /s agregado en 12 archivos bat (System32 + SysWOW64).
  Backups .bak-20260606 generados. Dialogos al abrir Claude eliminados.

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
3. CLAUDE.md (en W:\claude-config\CLAUDE.md)
4. Recién después ejecutar cualquier tarea

---

## ARCHIVOS PROHIBIDOS DE ELIMINAR

- **CATALOGO PRODUCTOS\Datos.xlsx** → MASTER del catálogo. Si se corrompe, regenerar con seed (ver _HISTORICO\20260604_AGENTS_completo.md → sección REGENERACIÓN COMPLETA SEGURA).
- **ventas-manzano.json** → NECESARIO: el panel lo usa como fallback en 4 puntos. NO eliminar.
- **credenciales_db.ini** → NUNCA tocar ni leer en voz alta
- **credenciales_erp.ini** → NUNCA tocar ni leer en voz alta
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
[PASO 1C] leer_xlsm.py → xlsm-enrich.json
[PASO 1D] descargar_bod.py (BODEGAS/) → bod-iem-registros.json + bod-rce-registros.json + bod-cem-registros.json
          SQL Server directo — IEM=72, RCE=55, CEM=24
[PASO 1E] descargar_pedidos.py (BODEGAS/) → pedidos-comprometidos.json + pedidos-detalle.json
          Fuente: R_STOCK_PRODUCTOS.ST_PEDIDO · Tipos: NVM/VMN/VMP
[PASO 1F] descargar_despachos.py (BODEGAS/) → despachos-comprometidos.json + despachos-detalle.json
          Fuente: BVE/FVE, CANTIDAD_PENDIENTE > 0
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
credenciales_erp.ini           — nunca tocar, nunca subir a git
credenciales_db.ini            — nunca tocar, nunca subir a git
E:\git-sync\                   — nunca trabajar aquí directamente
venAdmParseFecha()             — no cambiar firma ni comportamiento
venAdmFmt()                    — no cambiar firma
_actualizar_xlsx_es_hoy()      — ELIMINADA en V36.5, no restaurar
xlsm-enrich.json               — solo leer_xlsm.py lo genera, nadie más
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
leer_xlsm.py             Debe seguir generando xlsm-enrich.json al final.
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
        stockconsulta (V37.1)
XLSM:   nc · marcavend2 · preciodiff · mem
Stubs:  impacto
Análisis bodegas: analisis (IEM/RCE/CEM con selector bfFuente)
```

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
[ ] xlsm-enrich.json sigue siendo generado por leer_xlsm.py (no main.py)
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
