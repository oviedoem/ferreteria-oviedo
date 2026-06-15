# ESTADO_PROYECTO.md — Ferretería Oviedo El Manzano
# Version activa: V37.25
# Fecha: 2026-06-14
# Versiones anteriores disponibles en _HISTORICO/

---

## VERSION ACTUAL

| Campo | Valor |
|---|---|
| Version | V37.25 |
| Fecha | 2026-06-14 |
| Deploy | 2026-06-13 23:04 (datos ventas con rut/sector/razon) |
| Pendiente | commit V37.25 + badges 3 paneles (datos ya desplegados) |

---

## ULTIMOS CAMBIOS (V37.x)

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
| descargar_bod.py (BODEGAS/) | Actualizado V36.9k (CEM agregado) |
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
| IEM / RCE / CEM / ICD | analisis | OK V37.24 — selector bfFuente (Todas/IEM/RCE/CEM/ICD) |

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

- **Commit V37.25 + badges:** datos ya desplegados (2026-06-13); falta commit a GitHub y actualizar badge de versión en los 3 paneles
- **RANKING.xlsm / PRECIOS.xlsm** siguen siendo manuales (tabs ranking-unidades y precios-diff) — migrar a SQL en sesión futura si se desea (igual que se hizo con VENTAS.xlsm→enrich SQL)
- Tarea programada AutoUpdate18:00 no existe en Task Scheduler — crear si se quiere pipeline automático
- descargar_erp.py falla silencioso: si falla agregar `await page.screenshot(path="debug.png")` antes del click

---

*ESTADO_PROYECTO.md · Version V37.25 · 2026-06-14*
