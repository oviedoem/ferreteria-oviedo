# AGENTS.md — Ferretería Oviedo El Manzano
# Instrucciones del agente + Safe-Change Skill + Historial desde 2026-06-01
# Versión activa: V37.61 · Última actualización: 2026-08-27 (NCE fix + bat .py check)

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

### ERP JustWeb — Servidor (actualizado 2026-08-09)
- **Servidor nuevo (desde 2026-08):** `https://erp.justtime.cl/justweb_foviedo` (cloud JustTime)
- **Servidor viejo (hasta 2026-07):** `http://200.6.113.97/Justweb_Foviedo` (IP local — ya NO funciona, da 503)
- BASE y XTOKEN configurados en `credenciales_erp.ini` (no hardcodeados en scripts)
- XTOKEN para VisorRS.aspx en campo XTOKEN del ini. TTL aproximado: días/semanas.
- TOKEN_RECEPCION y X_API_KEY en ini — usados por wsapi.justtime.cl REST API (pendiente permiso JustTime P_CONTROL_BODEGAS).

### VPN — Cuándo usar
- **Cable directo a la red de la ferretería** → NO requiere VPN. Pipeline corre sin VPN.
- **WiFi (cualquier red)** → SÍ requiere VPN activa antes de correr el pipeline.
- La VPN da acceso a [SQL-SERVER-IP]. ERP JustWeb ya es cloud (https://erp.justtime.cl) — accesible sin VPN.

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
- Versión activa: V37.61

### Historial de deploys (resumen — detalle completo en _HISTORICO\)
- V37.13-14: 2026-06-02 — fix árbol auto-init, guard re-render, tutoriales D:→E:, 5 scripts pipeline D:→E:
- V37.15-17: 2026-06-08 — reqStockPrellenar advertencia cobertura, vadmDescargarExcel tab-aware 4 hojas, fix tab 'sector'
- V37.18-21: 2026-06-08/09 — OCR integrado 14 reglas; auditoría seguridad XSS/CSP; safeCod/rawCod/jsCod separados
- V37.22-23: 2026-06-09/10 — tab "Por Recepcionar" (GRT/GIB), Playwright→Blazor; OCR fix sw.js var→const
- V37.24: 2026-06-12 — bodega ICD (IDBODEGA=73) en Análisis Bodegas; IDS_REFERENCIA.md creado
- V37.25: 2026-06-13 — descargar_ventas_enrich.py (SQL→rut/sector/razonSocial); xlsm-enrich primario SQL (en proyecto DATOS ERP)
- V37.26-28: 2026-06-21/22 — carrusel banners multi-slide+historial+fecha; redes sociales Firestore; token rotativo dataAccessToken 8h TTL
- V37.29-30: 2026-06-23 — marketing-pwa.html; automatización WA Business (en proyecto separado)
- V37.31-44: 2026-06-28 — Traspasos CD criterio embalaje; Consulta Stock 8 bodegas OC leadtime; dedup despachos; validar_jsons; paginación 50/pág
- V37.45: 2026-06-30 — Traspasos CD: filtros PEM/SEM/CD, checkboxes ranking, export PDF/Excel solo filas con cantidad
- V37.46: 2026-06-30 — Traspasos CD: prioridad 4 capas (quiebre/tendencia/estable/sin mov), keywords portabilidad por bodega
- V37.47: 2026-06-30 — Solicitud Stock: base Firestore PEM(224)+SEM(573)=797 códigos, tracking envíos+historial Excel
- V37.48: 2026-07-01 — base +1716 códigos sin ST_MIN/MAX ERP; migración campo mapa→subcolección Firestore
- V37.49: 2026-07-01 — fix historial Solicitud Stock: exporta base completa, guarda mínimo/repos al enviar
- V37.50: 2026-07-01 — Análisis Bodegas: GEM+TEM agregadas (6 bodegas total)
- V37.51-54: 2026-07-01 — fix Dif fantasma (Excel manual vs SQL); sticky headers todos los menús; PASO 1H 3 workarounds CORS
- V37.55: 2026-07-01 — OC Pendiente desde SQL: descargar_oc_pendientes.py PASO 1N, columna "OC Pend" en Solicitud Semanal
- V37.56: 2026-07-03 — token rotativo glob dinámico (julio público fix); XSS venAdmEsc(bk) bodHtml
- V37.57: 2026-07-03 — rediseño iconos sidebar v4: 38 SVG symbols, 35 nav-btn + 22 vadm-stab; skills .claude/commands/
- V37.58: 2026-08-09 — migración servidor ERP a https://erp.justtime.cl; fix descargar_erp.py+blazor_bodegas.py; 55733 ventas
- V37.58 (2026-08-11): PASO 3.6 generar_catalogo_cotizador_rotacion.ps1 (v3m/v6m por SKU, 6106 productos)
- V37.58 (2026-08-20): FO_SQL_DATOS.xlsm creado (Error 3704 fix); XLSM=1ra fuente SQL; fix búsqueda stock AND+tildes+datalist
- V37.58 (2026-08-22): pipeline TODO2 OK; fix rotar_token despachos-panel; TRIM análisis confirmado OK; docs synced
- V37.58 (2026-08-24): fix duplicados ventas (dedup cli + sync fechas delta); JSONs datos negocio excluidos git
- V37.58 (2026-08-26): Blazor→SQL completado; pipeline ACTUALIZAR_TODO OK (244 archivos deploy 16:54); pipeline-datos-mapa.html actualizado (Playwright→SQL en docs); limpieza proyecto: carpetas Blazor archivadas, 36 CSVs backups pre-20260817 archivados, 8 CSVs/archivos _utilidades archivados; commit 955f87a
- V37.59 (2026-08-26): documentosGRT multi-GRT en Análisis Bodegas — algoritmo LIFO híbrido en descargar_bod.py (GRT/GRC/GIB como entradas, GME como consumo); chevron ▶ + sub-filas expandibles en panel-admin.html; fix path: descargar_bod.py guarda en token subfolder; commit 452510f
- V37.60 (2026-08-27): fix inconsistencia ventas ERP cloud ago-2026 — normalizar_totales_sql() escala lineas SSRS a VALOR_NETO SQL (corrige 1733 pares duplicados), fix NCE sign inversion, agregar_docs_sin_ssrs() recupera 163 docs omitidos por cloud; descargar_ventas_enrich.py agrega campos neto+fecha; panel 24-Jul a 23-Ago: $187.6M sin NCE vs meta ERP $187.3M (0.13% dif.); commit 442e795
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
- `informe-stock`: usa informe-stock.json (PASO 1G generar_informe_stock.py, lee raw_bloque1/2_*.csv de SSRS). Muestra Dif<0 (anomalía JT) como filas rojas.
- `despachos`: usa despachos-pendientes.json (PASO 1F descargar_despachos.py SQL). Despachos NVM sin BVE/FVE.
- `recepciones` / sub-tab "Por Recepcionar": usa recepciones-pendientes.json (PASO 1F descargar_despachos.py SQL, GRC/GRT/GIB pendientes). Datos al último sync 22:00.

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

## REVISIÓN DE CÓDIGO — /revisar-codigo (único modo activo)

Reglas del proyecto en `.opencodereview\rule.json` (14 reglas FO-001 a FO-014).
Usar `/revisar-codigo` o `/paperclip-revision-costo-cero` desde Claude Code.
OCR_REVIEW.bat y open-code-review npm: **descartados**.

---

---
## HISTORIAL SESIONES — archivado 2026-08-24
*Detalle completo en:*
- memory/estado-sesion-YYYYMMDD.md — cada sesión tiene su propio estado
- _HISTORICO\AGENTS_sesiones_junio_agosto_2026.md — sesiones jun-ago 2026 (627 líneas)
- _HISTORICO\20260604_AGENTS_completo.md — historial pre-junio

**Resumen sesiones principales:**
- 2026-06-08: Auditoría seguridad (XSS, CSP, Storage deny-all). V37.19-21.
- 2026-06-13: descargar_ventas_enrich.py SQL→rut/sector. V37.25.
- 2026-06-21/27: Banner carrusel, redes sociales, VendedorPRO IA. V37.26-28.
- 2026-06-28: Traspasos CD embalaje, Consulta Stock 8 bodegas, dedup despachos. V37.31-44.
- 2026-06-30/07-01: Solicitud Stock Firestore, Análisis Bodegas GEM/TEM, OC Pendiente. V37.45-55.
- 2026-07-03/20: Token rotativo fix, iconos sidebar v4, pipelines. V37.56-57.
- 2026-08-09: Migración ERP a erp.justtime.cl. V37.58.
- 2026-08-11: Catálogo cotizador con rotación v3m/v6m (PASO 3.6).
- 2026-08-20: FO_SQL_DATOS.xlsm (Error 3704 fix); XLSM=1ra fuente SQL; búsqueda stock mejorada.
- 2026-08-22: Pipeline TODO2 OK; fix rotar_token despachos-panel.
- 2026-08-24: Fix duplicados ventas; seguridad JSONs datos negocio excluidos git.
