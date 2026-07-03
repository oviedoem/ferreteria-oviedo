# ESTADO_PROYECTO.md — Ferretería Oviedo El Manzano
# Version activa: V37.57
# Fecha: 2026-07-03
# Versiones anteriores disponibles en _HISTORICO/
# NOTA: este doc no se actualizaba desde V37.25 (2026-06-14) — el historial detallado
# V37.26 a V37.49 vive solo en AGENTS.md (changelog completo por sesion). Aqui se
# resume el salto de version y se retoma el mantenimiento sesion a sesion.

---

## VERSION ACTUAL

| Campo | Valor |
|---|---|
| Version | V37.57 |
| Fecha | 2026-07-03 |
| Deploy | pendiente |
| Pendiente | deploy + commit V37.57; reportar a JustTime server ERP roto (CORS + getbase) — workarounds temporales activos en PASO 1H |

---

## ULTIMOS CAMBIOS (V37.x)

### V37.57 — 2026-07-03 (Rediseño iconos sidebar v4)
- **`panel-admin.html`:** 38 SVG símbolos en `<defs>`, componente `.tag` kraft + dot indicator + `--gcolor` por grupo,
  motion `vadm-stab::after scaleX()`, stagger `.sidebar-group`, touch zone 44px, `focus-visible`, reduced-motion.
  35 `nav-btn` + 22 `vadm-stab` (Ventas) con iconos SVG + `aria-label`. Excepción "Quiebre" rojo fijo. Badge V37.57.

### V37.56 — 2026-07-03 (Fix seguridad token rotativo + XSS bodHtml)
- **`_utilidades/rotar_token_data.py`:** bug de seguridad — `ventas-manzano-2026-07.json` (y meses futuros)
  quedaba en `data/` raíz y se desplegaba públicamente porque la lista `ARCHIVOS_SENSIBLES` estaba hardcodeada
  hasta `06`. Fix: `get_archivos_sensibles()` descubre dinámicamente todos los `ventas-manzano-????-??.json`
  con `glob.glob`. Autosustentable sin tocar código al iniciar cada mes.
- **`panel-admin.html` L18550 (`_csPintarFicha`):** XSS FO-002 — clave de bodega `bk` (string de JSON externo)
  asignada a `innerHTML` sin escapar. Fix: `venAdmEsc(bk)`. Consistente con `venAdmEsc(pv.nombre)` adyacente.
- **Revisión /revisar-codigo $0:** 0 ERROREs, 0 WARNINGs (14/14 reglas).
- Deploy: pendiente.

### V37.55 — 2026-07-01 (OC Pendiente desde SQL — columna en Solicitud Semanal)
- **Nuevo script:** `BODEGAS/descargar_oc_pendientes.py` (V1.0) — OCs activas (IDDOCUMENTO 8/26/104/108/800-804,
  `CANTIDAD_PENDIENTE > 0`, `ESTADO <> 'Nulo'`, bodegas EM+CD, ultimos 6 meses) desde SQL Server (sync 22:00).
  Genera `oc-pendientes.json` (detalle por OC: proveedor, fechas, lineas) y `oc-pend-resumen.json`
  (`{codigo: qtyPendiente, _generado: ISO}`). Fallo de conexion preserva el JSON anterior (exit 1, bat continua).
  Primera corrida real: 387 OCs activas, 670 codigos con pendiente.
- **panel-admin.html:** `_vadmCargarStockMap` encadena fetch de `oc-pend-resumen.json` tras Datos.json y agrega
  `oc_pend` por codigo al mapa (cierre `_finalizar()` idempotente: `cb()` corre UNA vez, con o sin JSON; datos
  >26h se ignoran). `reqStockPrellenar` agrega columna "OC Pend" (morada si >0) DESPUES de "Stock actual" —
  posicion elegida para NO mover los indices `cells[1..7]` que lee `reqStockEnviarEmail` (cero regresion en el
  email). Div `reqOcFrescura` indica antiguedad de los datos OC. Colspan 10→11 (placeholder + mensajes bloqueo).
- **Pipeline:** PASO 1N agregado en `ACTUALIZAR_TODO.bat` y `ACTUALIZAR_TODO_AUTO.bat` (1L y 1M ya existian;
  fallo NO aborta). `rotar_token_data.py`: los 2 JSON agregados a ARCHIVOS_SENSIBLES (rotan a carpeta-token,
  no quedan publicos). `validar_jsons.py`: `oc-pend-resumen.json` registrado (optional; el detalle no se valida
  porque lista vacia es legitima).
- **Verificado en preview con servidor local:** mapa 6.049 codigos con 661 `oc_pend` mezclados; test 404
  (token falso) → `cb` 1 vez, panel no se bloquea; thead 11 columnas; 0 errores consola; sintaxis JS 0 errores.
- Revision /revisar-codigo $0: 0 ERROREs, 0 WARNINGs (14/14 reglas).
- JSON copiados a carpeta-token activa SIN re-rotar. Deploy hecho. Commit: ver AGENTS.md.
- **Adenda (misma noche):** consistencia de "Dias transito OC" en Consulta de Stock VERIFICADA con 3 trazas
  SQL reales (TORN0600 14.3d, 600445 82d, TORN0100 28d — calzan al decimal; balanceo/venta excluidos por
  join al documento padre OC). Fix: ICD(73) agregada a BODEGAS_RECEPCION de descargar_oc_leadtime.py
  (recepciones OC en Santiago → desglose porBodega, 115 codigos) + linea "Llegada por bodega" en la ficha
  de Consulta de Stock (bloque csFLeadTime). oc-leadtime.json regenerado + deploy 23:01.

### V37.54 — 2026-07-01 (PASO 1H recuperado — 3 workarounds por server ERP roto)
- **Contexto:** la actualizacion del ERP JustTime rompio el servidor en dos frentes: el WsApi (`[ERP-WSAPI-HOST]:6969`) dejo de enviar `Access-Control-Allow-Origin` (el navegador bloquea todos los fetch del Blazor) y `login/getbase` responde que la API vive en `localhost:6969` (ERR_CONNECTION_REFUSED desde cualquier otro PC). Tab Por Recepcionar quedo vacio.
- **Fix (solo `BODEGAS\descargar_blazor_bodegas.py`):** 3 workarounds en cadena — (1) Chromium con `--disable-web-security` + `--disable-features=IsolateOrigins,site-per-process`; (2) `ctx.route` reescribe requests `localhost:6969` → host real; (3) espera del boton Exportar con 3 intentos de 45s + reload (SignalR reconecta lento).
- **Resultado:** recepciones-pendientes.json = 7 docs (antes `[]`), despachos-pendientes-erp.json = 27 docs, despachos-panel.json = 35 docs (11 ERP+SQL, 13 con atraso; `despachos-detalle.json` recuperado desde la carpeta-token). JSON copiados a la carpeta-token activa SIN re-rotar + deploy OK.
- **TEMPORAL:** quitar workarounds 1 y 2 cuando JustTime corrija CORS/getbase. La intranet web del ERP en navegador normal sigue rota (el cliente nativo .exe no se afecta).

### V37.53 — 2026-07-01 (cierre real sticky headers)
- **El fix de sticky headers de V37.51/V37.52 NUNCA funciono de verdad** — solo se habia verificado con `getComputedStyle` (que el CSS se aplicaba), nunca con scroll real. El dueño reporto con screenshot que en Merma MEM el encabezado aparecia DEBAJO de la primera fila.
- **Causa raiz real:** los wrappers `overflow-x:auto` que envuelven las tablas se convierten en el "containing block" del `position:sticky` (regla del spec CSS: si `overflow-x`≠`visible` y `overflow-y`=`visible`, el navegador computa `overflow-y:auto` igual). Ese wrapper nunca tiene altura acotada → nunca hace scroll propio → el `thead` sticky nunca se activa.
- **Fix:** wrappers con `max-height:65vh;overflow-y:auto` explicito + `thead` sticky de `top:60px`→`top:0` (relativo al wrapper). Selector `:has()` para cubrir todos los wrappers dinamicos + 7 selectores puntuales para tablas estaticas por id. Ya no hacen falta las excepciones de modales de V37.52.
- **Verificado con scroll real + screenshot** (no solo computed style) en 3 casos: `.vtbl` en menu, `#isbTabla` con header de 2 filas, `.vtbl` dentro de modal.
- **Leccion permanente:** `getComputedStyle` confirma que una propiedad CSS se aplico, NO que el comportamiento visual sea el esperado. Para `position:sticky` verificar SIEMPRE con scroll real + screenshot.
- Deploy hecho, commit `df962fc`.

### V37.52 — 2026-07-01 (sticky headers extendidos — luego corregido en V37.53)
- Encabezados sticky extendidos a TODOS los menus: 18 `.tab-pane` + 34 `.vadm-section` anidados, via 2 reglas CSS scoped por clase compartida (`.tbl`/`.vtbl`/`.vadm-rank-table`) + `position:sticky` directo en el `<thead>` de 7 tablas estaticas por id.
- Excepciones para 4 modales con scroll propio (`top:0` en vez de `top:60px`).
- **NOTA:** este enfoque resulto no funcionar visualmente (ver V37.53) — solo verificado con computed style.

### V37.51 — 2026-07-01 (Informe Stock: Disp desactualizado generaba Dif fantasma)
- **Problema:** en Informe Stock, "Disp" venia de `CATALOGO PRODUCTOS/Datos.json` (generado desde el Excel manual `actualizar.xlsx`), mientras "Fis" ya se refrescaba con datos SQL/SSRS del dia. Un "Disp" desactualizado producia una Dif fantasma clickeable (ej. SIKA0310/SEM: Disp=0, Fis=14, Dif=14) sin evento real detras.
- **Decision del dueño:** priorizar el dato SQL/SSRS sobre el Excel manual (auto-corrige sin depender de reexportar el Excel).
- **Fix:** `BODEGAS\generar_informe_stock.py` (V1.1) ahora lee tambien `St_Disp` del CSV y agrega `pem_disp/sem_disp/cem_disp/mem_disp` a `informe-stock.json`; `panel-admin.html` (`isbGenerar()`→`tryRender()`) sobreescribe `_vadmStockMap[cod].pem/sem/cem/mem` (Disponible) igual que ya hacia con `_bod` (Fisico).
- **Escala:** 25 de 4.765 productos (~0.5%) con el mismo patron, concentrados en SEM.
- Verificado en vivo (9.717 productos) + preview local. Redeploy de `informe-stock.json`.

### V37.50 — 2026-07-01
- **Analisis de Bodegas ampliado a 6 bodegas:** agregadas GEM (Gestion El Manzano, IDBODEGA SQL 28) y TEM (Transito El Manzano, IDBODEGA SQL 46) al tab `analisis` (antes solo IEM/RCE/CEM/ICD). Ambas SUC=04, confirmadas en `IDS_REFERENCIA.md`.
- `BODEGAS\descargar_bod.py`: 2 entradas nuevas en `BODEGAS` → genera `bod-gem-registros.json` (155 registros) y `bod-tem-registros.json` (5 registros).
- `panel-admin.html`: checkboxes `bfChkGEM`/`bfChkTEM`, fetch de los 2 JSON nuevos en `vadmRenderBodFem()`, colores KPI agregados al mapa `BC`. Titulo del card actualizado a "IEM / RCE / CEM / ICD / GEM / TEM".
- Revision $0 (`/revisar-codigo`) contra las 14 reglas: 0 ERROREs, 0 WARNINGs.
- Resumen de sesiones anteriores (V37.26–V37.49, no documentadas aqui hasta hoy): Solicitud de Stock (base Firestore PEM+SEM 797 codigos, historial de envios, fix guardado minimo/reposicion), fix logout silencioso por `dataAccessToken` vencido, Traspasos CD (prioridad 4 capas + export PDF/Excel/HTML), Consulta de Stock (8 bodegas, minimo/critico/maximo ERP, tiempo de transito por proveedor y por bodega, desglose por marca), fixes XSS (`vadmBuscarStock`, `csVerDesgloseMarca`), migracion mapa→subcoleccion Firestore. Detalle completo en `AGENTS.md`.

### V37.25 — 2026-06-13/14
- **Enrich ventas migrado XLSM→SQL:** nuevo `BODEGAS\descargar_ventas_enrich.py` genera `xlsm-enrich.json` desde SQL Server (M_DOCUMENTOS_ENCABEZADO + M_ENTIDADES + Encabezado_Observacion, docs BVE/FVE/NCE). rut/razonSocial 0%→100%, sector 0%→~12% en todos los meses. PASO 1K (TODO) / 1J (AUTO), antes de main.py
- leer_xlsm.py intacto (sigue generando ventas-xlsm/ranking/precios; su xlsm-enrich queda como fallback)
- Skills creados: `/ahorro-tokens`, `/revisar-codigo` (revisión $0 vs 14 reglas FO)
- **Limpieza extrema (~300MB):** carpeta `E:\_ARCHIVO_FERRETERIA` (FUERA del proyecto) con backups/node_modules, CSVs crudos, VENTAS EL MANZANO LOCAL (deprecado), 28 ventas_erp viejos, scripts deprecados (descargar_recepciones_pendientes, descargar_despachos_erp), duplicados RANKING
- Utilidades del equipo → `_utilidades\`: encriptar_credenciales.py, EXPULSAR_DISCO_SEGURO.bat, ACTIVAR_EN_ESTE_EQUIPO.bat, Tarjeta rápida.docx
- Carpeta `DATOS ERP` eliminada de GitHub (commit 9c6b4f6)
- pipeline-datos-mapa.html reescrito (8 secciones) — solo local, excluido de git/firebase

### V37.22 — 2026-06-09
- panel-admin: tab "Por Recepcionar" (GRT/GIB pendientes Editar+Grabar) · Blazor Intranet
- `descargar_blazor_bodegas.py` (1 sesión Playwright = 2 tabs) reemplaza descargar_recepciones_pendientes + descargar_despachos_erp

### V37.19–V37.21 — 2026-06-09
- Auditoría seguridad: XSS fixes (venAdmEsc/_cliEsc), CSP sin unsafe-eval, _logAuditAdmin(), fixes OCR

### V37.10 — 2026-05-29
- panel-admin.html: módulo Despachos Pendientes (BVE/FVE pendientes de despacho, email, Excel)
- ACTUALIZAR_GITHUB.bat: fix firestore.indexes.json, +storage.rules/update-sw-version.js/ESTADO_PROYECTO.md, V37, pull --rebase
- ACTUALIZAR_GITHUB_APP_INVENTARIO.bat movido a APP-INVENTARIO/ (ahora en D:\APP-INVENTARIO\ — repo propio)
- AGENTS.md: encriptar_credenciales.py en Scripts activos; changelog V37.10; deploy V37.10

### V37.4 — 2026-05-26
- Limpieza carpeta raiz: 11 archivos movidos a _HISTORICO/ (scripts diagnostico, xlsx ad-hoc, bats one-time, log, lnk, html ERP)
- Carpetas eliminadas: _ARCHIVADOS/ (2 bats → _HISTORICO), docs/ (vacía)
- AGENTS.md: regla de limpieza + schema SQL Server tablas ventas + troubleshooting Justime DLL

### V37.3 — 2026-05-26
- panel-admin.html: columna CEM agregada a vadmRenderQuiebre (header verde + celda)
- panel-admin.html: columna CEM agregada a vadmRenderSobreStock (cem en prods.push + header + celda)
- panel-admin.html: vadmRenderBodFem() fetch resiliente — cada JSON con .catch individual (IEM/RCE/CEM no bloquean entre si)
- Reorganizacion MD: MEMORY.md + ESTADO_PROYECTO.md creados, docs/ consolidado en _HISTORICO/
- Deploy: 2026-05-26 22:12 — ferreteria-oviedo.web.app
- GitHub: commit 4b78f04

### V37.2 — 2026-05-26
- descargar_ventas_erp.py: fix dias incompletos (mid-day run) — re-descarga hoy si max_f >= hoy
- ACTUALIZAR_TODO_AUTO.bat: nuevo bat no interactivo para tarea programada
- Tarea Programada Windows: FerreteriOviedo-Auto18 a las 18:00 (desde 27-05-2026)
- Reparacion ventas 22-26 mayo: 1.451 registros nuevos, 39.638 totales, 34.375 enriquecidos

### V37.1 — 2026-05-26
- panel-admin.html: modulo Consulta de Stock (busqueda + ficha ERP-style 8 bodegas)
- vadmBuscarStock() + vadmRenderStockConsulta(cod) — fuente _vadmStockMap (sin fetch extra)

### V37 — 2026-05-26
- panel-admin.html: campana notificaciones
- panel-admin.html: senales de alerta en funciones criticas (comentarios invariantes)
- Eliminados restos de Venta vs Stock (removido en V35.0)

### V36.9k — 2026-05-26
- panel-cliente.html: fix doLoginGoogleCli — usuario Google nuevo crea doc en /users
- panel-cliente.html: fix mensaje pendiente vs no-registrado (code:'pendiente')
- panel-cliente.html: notificacion admin al registrarse
- firestore.rules: notificaciones allow create para autenticados
- panel-admin.html: boton Reenviar acceso por email (adminReenviarAcceso)
- diagnostico_huerfanos.py: nuevo script para detectar y reparar usuarios huerfanos
- Recuperacion 5 usuarios huerfanos (Auth sin doc Firestore)

---

## ESTADO DE ARCHIVOS CLAVE

| Archivo | Estado |
|---|---|
| panel-admin.html | Actualizado V37.2 |
| panel-cliente.html | Actualizado V36.9k |
| index.html | Actualizado V36.9i |
| firebase-config.js | No modificar |
| firestore.rules | Actualizado V36.9k |
| firebase.json | Actualizado V36.2 (security headers) |
| descargar_erp.py | Actualizado V36.4 |
| descargar_ventas_erp.py | Actualizado V37.2 |
| main.py | Actualizado V36.9 |
| leer_xlsm.py | Actualizado V36.9 |
| descargar_bod.py (BODEGAS/) | Actualizado V37.50 (GEM/TEM agregadas) |
| procesar-actualizacion.py | Actualizado V36.6 |
| csv_a_json.py | Actualizado V36.9c |
| ACTUALIZAR_TODO.bat | Activo — unico punto de entrada |
| ACTUALIZAR_TODO_AUTO.bat | Nuevo V37.2 — para tarea programada |

---

## INFRAESTRUCTURA

| Item | Estado |
|---|---|
| Firebase Hosting | ferreteria-oviedo.web.app — OK |
| Firestore | Plan Spark — solo auth/config/cotizaciones/sesiones |
| Tarea programada | FerreteriOviedo-Auto18 18:00 — activa desde 27-05-2026 |
| SQL Server | [SQL-SERVER-IP] / Foviedo — OK (descargar_bod.py) |
| ERP JustWeb | SSRS activo — token existencias y precios confirmados |

---

## MODULOS DEL PANEL-ADMIN — ESTADO

### VENTAS
| Modulo | Tab | Estado |
|---|---|---|
| Detalle | hora / topMarcas / vendrank / clientes / tipodoc / facturacion | OK |
| Analisis | comparativa / marcavend / sector / entrefechas / estaciones | OK |
| Rankings | rankingmarca / pagorankings | OK |
| Temporal | pagotemporal / pagoanalisis | OK |
| Impacto | impacto (Volumen vs Precio) | OK V36.9i |
| NC Vendedor | nc | OK V36.8 |
| Marca x Vendedor XLSM | marcavend2 | OK |
| Diff Precios | preciodiff | OK |

### INVENTARIO
| Modulo | Tab | Estado |
|---|---|---|
| Stock y Quiebre | quiebre | OK — Rot.30/60/90d |
| Sobre-stock | sobrestock | OK — cobertura en meses |
| Transito PEM | transito | OK |
| Baja Rotacion | bajrot | OK — auto-reload si rango > datos |
| MEM Merma | mem | OK |
| Merma / Remate | merma | OK |
| Liquidacion | liquidacion | OK |
| Venta vs Stock | ELIMINADO V35.0 | — |

### CATALOGO
| Modulo | Tab | Estado |
|---|---|---|
| Precios | precios | OK |
| Consulta de Stock | stockconsulta | OK V37.1 — busqueda + ficha 8 bodegas |
| Config ERP | — | OK |

### ANALISIS BODEGAS
| Modulo | Tab | Estado |
|---|---|---|
| IEM / RCE / CEM / ICD / GEM / TEM | analisis | OK V37.51 — GEM/TEM agregadas + stock negativo visible en rojo (GEM/CEM aceptan negativo por diseño ERP) |

### RECEPCIONES / DESPACHOS (Blazor JustWeb)
| Modulo | Tab | Estado |
|---|---|---|
| Por Recepcionar / Por Despachar | — | OK V37.22 — descargar_blazor_bodegas.py (Playwright) |

### ARBOL RETAIL
| Modulo | Tab | Estado |
|---|---|---|
| Arbol | arbol | OK |
| Tabla KPIs | arboltabla | OK |
| Mapa Calor | arbolheat | OK |

### ADQUISICIONES
| Modulo | Tab | Estado |
|---|---|---|
| Solicitud Semanal de Stock | tab-adquisiciones | OK V36.7 |

---

## PENDIENTES CONOCIDOS

- **RANKING.xlsm / PRECIOS.xlsm** siguen siendo manuales (tabs ranking-unidades y precios-diff) — migrar a SQL en sesión futura si se desea (igual que se hizo con VENTAS.xlsm→enrich SQL)
- descargar_erp.py falla silencioso: si falla agregar `await page.screenshot(path="debug.png")` antes del click
- PASO 1A (descargar_erp.py) puede fallar por Windows Defender Network Protection bloqueando la IP del ERP de forma intermitente — ver `FIX_DEFENDER_PASO1A.bat` en el escritorio del dueño (requiere Administrador, no automatizable por Claude Code)

---

*ESTADO_PROYECTO.md · Version V37.56 · 2026-07-03*
