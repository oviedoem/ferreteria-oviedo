# SKILL: SAFE-CHANGE
# Proyecto: Ferretería Oviedo El Manzano
# Ruta canónica: D:\ferreteria-oviedo\.claude\skills\safe-change\safe-change.md
# Última actualización: 2026-05-23

## REGLA 0 — LECTURA OBLIGATORIA AL INICIO
Antes de cualquier acción leer en este orden:
1. C:\Users\Ferreteria Oviedo\.claude\CLAUDE.md
2. D:\ferreteria-oviedo\AGENTS.md
3. C:\Users\Ferreteria Oviedo\.claude\projects\D--ferreteria-oviedo\memory\MEMORY.md
4. Este archivo safe-change.md
Si alguno no existe, detenerse y reportar.

## REGLA 1 — UNA FUNCIÓN A LA VEZ
- Tocar solo 1 función o archivo por prompt.
- Si hay riesgo en más de 1 función, detenerse y pedir segundo prompt.
- Si Codex dice "también modifiqué X para que funcione" sin que se lo pidiera → DETENER y revisar X antes de aceptar.

## REGLA 2 — ANTI-REGRESIÓN
- Verificar que el cambio no fue aplicado en versión anterior.
- Si ya fue aplicado, confirmar y NO repetir.
- Si hay conflicto con memoria anterior, detenerse y reportar.

## REGLA 3 — ARCHIVOS PROHIBIDOS
- credenciales_erp.ini → NUNCA tocar ni leer en voz alta
- D:\ferreteria-oviedo-github\ → NUNCA modificar
- ventas-manzano.json → ELIMINADO, no regenerar jamás (duplicado de ventas-manzano-YYYY.json)
- PREPARAR_Y_PUBLICAR.bat → ARCHIVADO en _ARCHIVADOS\, no usar
- ACTUALIZAR_AUTO.bat → ARCHIVADO en _ARCHIVADOS\, no usar
- _actualizar_xlsx_es_hoy() → ELIMINADA en V36.5, no restaurar
- xlsm-enrich.json → solo leer_xlsm.py lo genera, nadie más

## REGLA 4 — PIPELINE ACTIVO
- Único punto de entrada: ACTUALIZAR_TODO.bat
- Archivos activos de ventas:
    ventas-manzano-YYYY.json      (año completo)
    ventas-manzano-YYYY-MM.json   (mes actual, carga por defecto)
- NO duplicar salidas de descarga bajo ninguna circunstancia
- catalogo-dinamico.json: escrito por procesar-actualizacion.py, leído por _catalogo_generado_hoy() en main.py

## REGLA 5 — ENCODING
- Todo archivo del proyecto: ANSI cp1252
- Excepción logs\: UTF-8

## REGLA 6 — DEPLOY Y COMMIT
- Nunca hacer deploy automático sin instrucción explícita
- Nunca hacer commit sin instrucción explícita
- Siempre reportar timestamp y SHA del commit al terminar

## REGLA 7 — PANEL ADMIN
- Nunca romper menú, submenú, tab ni botón existente
- Cambios en panel-admin.html: máximo 1 función por prompt
- window._mostrarPrecio default: false en panel-cliente.html
- Versión activa: V36.9c (2026-05-23)
- Restore point producción: V33.6 (2026-05-18) — estado documentado en _ARCHIVO\02_DOCUMENTACION_HISTORICA\ESTADO_PROYECTO_V33_6_18052026.md

## REGLA 8 — HISTORIAL SEMANA 2026-05-17 AL 2026-05-23

---

### V33.6 — 2026-05-18 (Restore point)
Archivos tocados: firebase.json · .firebaseignore · credenciales_erp.ini
- firebase.json + .firebaseignore: bloquean VENTAS EL MANZANO/**, backups/**, .claude/, *.ini, *.xlsm, *.mp4
- Credenciales ERP cambiadas tras detección de exposición pública
- Snapshot: _ARCHIVO\02_DOCUMENTACION_HISTORICA\ESTADO_PROYECTO_V33_6_18052026.md

---

### V33.7 — 2026-05-18/19
Archivos tocados: descargar_erp.py · procesar-actualizacion.py
- descargar_erp.py: migrado a existencias_clasificadas + TEM_TRANS separado · bodega CAL eliminada
- procesar-actualizacion.py: TEM_TRANS agregado

---

### V33.9 — 2026-05-19
Archivos tocados: main.py
- main.py: leer_bodegas_desde_actualizar() + señal de detección de descarga doble (versión preliminar)
- ACTUALIZAR_TODO.bat: corregido para llamar main.py --sin-deploy

---

### V34.0 — 2026-05-20
Archivos tocados: panel-admin.html
- Sidebar acordeón con toggle por grupo
- Eliminados duplicados del menú: Sector · NC Vendedor · Diff Precios
- Barra vadm-groups eliminada del contenido

---

### V35.0 — 2026-05-20
Archivos tocados: panel-admin.html
- vadmRenderSobreStock(): lógica completamente reescrita — cobertura en meses (velMes/cobMeses) en vez de días sin venta
- _vadmSSProds: nueva variable caché para email/Excel/Outlook
- vadmSSMarcaClick(el): nueva función (fix comillas en nombres de marca vía data-marca)
- vadmSSMesesMin: reemplaza vadmSSDias
- vadmRenderBajaRot(): fix cobertura de datos — detecta si _vadmLineas cubre el rango, auto-fetch año completo
- Baja Rotación: columna "Valor stock" = (PEM+SEM) × costo, total en tfoot
- Venta vs Stock: eliminado (sidebar + subtab + HTML section + auto-render + email dispatch)

---

### V36.0 — 2026-05-20
Archivos tocados: descargar_ventas_erp.py · ACTUALIZAR_TODO.bat · main.py
- descargar_ventas_erp.py: reescritura completa — HTTP directo (BeautifulSoup) + descarga incremental + feriados CL (holidays.Chile())
  - Detecta max fecha en ventas_erp_producto_*.xlsx, descarga solo días faltantes
  - Dedup por (Numero, Codigo) en Reporte 1; concat en Reporte 2
  - LstTipo=2 (por producto) · LstTipo=4 (por cliente-producto) · LstSucursal=04
  - Playwright conservado como fallback
- ACTUALIZAR_TODO.bat: default visibilidad precios → N (ocultos)
- main.py: fix charmap — flechas Unicode reemplazadas por ASCII en logs

---

### V36.1 — 2026-05-21
Archivos tocados: CLAUDE.md
- Safe Change Protocol completo agregado
- Mapa de dependencias críticas agregado
- Regla Anti-Ciclo agregada

---

### V36.2 — 2026-05-21
Archivos tocados: firebase.json · firestore.rules · leer_xlsm.py
- firebase.json: security headers — X-Frame-Options: DENY · X-Content-Type-Options: nosniff · Referrer-Policy · Permissions-Policy · Content-Security-Policy (scripts/styles/fonts/img/connect srcs)
- firestore.rules: reescritura completa con control de acceso por rol
  - cotizaciones: cliente solo lee las suyas (clienteUid == request.auth.uid)
  - users: solo admin o self
  - config: lectura pública · escritura solo admin
  - sesiones_activas: solo admin o mismo UID
  - notificaciones: autenticados leen · admin/vendedor escriben
  - productos, solicitudes_cupon: BLOQUEADOS (default deny)
  - Helpers: esAdmin() · esVendedor() · estaAutenticado() · esElMismoUsuario(uid)
- leer_xlsm.py: movido desde _ARCHIVO/04_SCRIPTS_AUXILIARES/ → VENTAS EL MANZANO/
  - Agrega log de columnas al inicio para diagnóstico
  - NO integrado en ACTUALIZAR_TODO.bat aún
  - Genera: ventas-xlsm-YYYY.json · ventas-xlsm-sector.json · ranking-unidades.json · precios-diff.json
Deploy: 2026-05-21

---

### V36.3 — 2026-05-21
Archivos tocados: descargar_erp.py · procesar-actualizacion.py · xlsx_a_csv.py · csv_a_json.py · panel-admin.html
- descargar_erp.py: TODAS las bodegas vía SSRS en 2 bloques
  - BLOQUE 1 (solo DISP): SEM · CEM · RCE · MEM
    IDs: ctl13 · ctl24 · ctl52 · ctl29
  - BLOQUE 2 (DISP+TRANS): PEM · TEM · CD · IEM
    IDs: ctl22 · ctl44 · ctl23 · ctl69
  - normalizar_existencias(path_b1, path_b2) → concat + pivot por Bod → 19 columnas Hoja2
  - Raw CSVs: backups/raw_bloque1_YYYYMMDD.csv · backups/raw_bloque2_YYYYMMDD.csv
  - Eliminadas: URLs HTTP lite CEM/IEM/RCE/MEM · normalizar_bodega()
- procesar-actualizacion.py: IEM_TRANS agregado en 7 lugares
- xlsx_a_csv.py + csv_a_json.py: IEM_TRANS y TEM_TRANS agregados a conversión int
- panel-admin.html: iem_trans agregado a _vadmCargarStockMap
Deploy: 2026-05-21 22:12:42 — 9.880 productos catálogo · 6.010 en Datos.json

---

### V36.4 — 2026-05-21
Archivos tocados: descargar_erp.py · panel-admin.html · index.html · ACTUALIZAR_TODO.bat · PUBLICAR.bat
- descargar_erp.py: fix precios VisorRS
  - Token actualizado: 943679d1... → 6044bcb5-7255-f111-8b81-00155d9d0600
  - URL directa IP: eliminado truco sesión foviedo.justtime.cl/visor/ → BASE/VisorRS.aspx directo
  - VISOR_BASE eliminado (código muerto)
  - 1ra corrida real confirmada: Bloque1=['CEM','SEM','MEM','RCE'] ✓ Bloque2=['PEM','IEM','CD','TEM'] ✓
- panel-admin.html: 5 fixes de filtros
  - vadmReRenderTabActivo: vadmRenderEntrefechas() → vadmBuscarEntreFechas()
  - vadmRenderComparativa: _vadmLineas → vadmDatosFiltrados()
  - _arFiltrar: _vadmLineas → vadmDatosFiltrados()
  - vadmRenderArbolTabla + vadmRenderArbolHeat: _vadmLineas → var datos=vadmDatosFiltrados()
  - vadmRenderMarcaVend2: _vadmLineas.filter( → vadmDatosFiltrados().filter(
- index.html: fix margenReal IVA duplicado
  - ANTES: (1 - cp/p.PIva*1.19) → cp=1000,PIva=2380 → 64.7% INCORRECTO
  - DESPUÉS: (1 - cp*1.19/p.PIva) → 50.0% CORRECTO
- Bats: timeout pregunta precios 30s → 10s · opción E relabel "NO VISIBLE (sin cambios)"
Deploy: 2026-05-21 23:26:38

---

### V36.5 — 2026-05-22
Archivos tocados: leer_xlsm.py · main.py
- leer_xlsm.py: genera xlsm-enrich.json al final de procesar_ventas()
  - Construye {numero → {rut, sector, bodegaCorta}} iterando registros
  - numero normalizado con int(float()) para celdas numéricas de Excel
  - sector = rec['obsImp'] (raw), bodegaCorta = rec['bodegaCorta']
  - Guarda en DATA_DIR/'xlsm-enrich.json'
- main.py: 3 cambios
  - _actualizar_xlsx_es_hoy() ELIMINADA → nueva _catalogo_generado_hoy() (verifica catalogo-dinamico.json)
  - Nueva constante CATALOGO_HOY = DATA_DIR / "catalogo-dinamico.json"
  - enriquecer_desde_xlsm(registros) nueva función (PASO 3.5 entre consolidar() y guardar_json())
    - Join por numero de documento con int(float()) en ambos scripts
    - Sobreescribe SOLO campos vacíos: rut, sector, bodegaCorta
    - Fallback silencioso si xlsm-enrich.json no existe
- panel-admin.html: botón vstab-marcavend agregado en vstabs-analisis (solo faltaba el botón)

---

### V36.6 — 2026-05-22
Archivos tocados: procesar-actualizacion.py · PUBLICAR.bat · leer_xlsm.py · panel-admin.html · main.py
Deploy: 2026-05-22 11:05 (166 archivos · 11 nuevos)
- procesar-actualizacion.py: escribe data/catalogo-dinamico.json al final del bloque try
  - Fix señal anti-doble-descarga: antes _catalogo_generado_hoy() siempre retornaba False → descargar_bodegas.py corría siempre (~70 seg extra)
- PUBLICAR.bat: timeout /t 30 → /t 10 (consistencia con ACTUALIZAR_TODO.bat)
- leer_xlsm.py: _BOD_CORTA expandido + filtro EXH
  - Agregadas: Calzada El Manzano→CEM · Centro de Distribucion→CD · CAL→CEM · SAL→SEM · EXH→None
  - if bod_corta is None: continue (evita contaminación dropdown bodegas con EXH)
- panel-admin.html (2 cambios):
  - vadmBodBuildCheckList: eliminada línea que forzaba CEM/MEM/SEM/CD · labels simples (sin sufijo stock)
  - vadmRenderQuiebre BOD_STOCK: {PEM,SEM,CEM,MEM,CD} (5) → {PEM,SEM,CEM,RCE,MEM,TEM,IEM,CD} (8 bodegas)
- main.py: log enriquecimiento — reemplaza "? NO ENCONTRADA" por "[enriquece: fuente]"
- Regla nueva: "Señales de diseño — verificar implementación completa antes de cerrar sesión"

---

### V36.7 — 2026-05-22
Archivos tocados: panel-admin.html
Deploy: 2026-05-22 17:21:42
- Solicitud Semanal de Stock: rediseño completo del módulo
  - Filtros nuevos: checkboxes tránsito Con/Sin (reqConTrans/reqSinTrans) · input N ítems (reqN, default=10)
  - TIPO eliminado como columna → círculo dot 8px inline (A=#16a34a · B=#ca8a04 · C=#ea580c)
  - <tr data-abc="A/B/C"> para que email lo lea
  - reqStockPrellenar() reescrita:
    - vel = qty/diasRango · minimoActual = round(vel × cobertura_días)
    - transito = pem_trans + tem_trans · stockActual = pem + sem
    - reposicion = max(0, minimoActual - stockActual - transito)
    - ABC Pareto sobre netoMap global (sin filtro marca)
    - Orden: qty DESC → stockActual===0 como desempate
  - reqStockEnviarEmail() reescrita: 9 columnas, anchos fijos Outlook/Gmail safe, día dinámico
  - Columnas app (10): # · Código · Producto[dot] · Vta 2m · MinActual · ReposActual · Tránsito · StockActual · MinSol[inp] · ReposSol[inp]
  - Columnas email (9, sin #): mismas sin columna TIPO

---

### V36.8 — 2026-05-22
Archivos tocados: panel-admin.html
Deploy: 2026-05-22 18:23:45 (174 archivos)
Commits: 1593fb1 · 98dcb1b
- vadmRenderNC: 2 fixes coordinados
  - Fix 1 — suma correcta por documento:
    - Antes: cantNC++ por línea → mostraba líneas, no documentos únicos
    - Ahora: Paso 1 agrupa por (vendedor|numero) sumando valorNeto → Paso 2 agrega por vendedor
    - NC 62583 (6 líneas): antes $126.588 → ahora $153.560
  - Fix 2 — fuente XLSM → ERP:
    - Antes: ventas-xlsm-YYYY.json (solo algunos vendedores) → aparecían 2 de N
    - Ahora: _vadmLineas (ERP, todos los vendedores del período)
    - NC detectado por r.documento.toLowerCase() contiene "nota" o "cred"
    - Eliminado: _vadmCargarXlsmAnio, lógica cross-year, variables anio1/anio2
    - OBS siempre vacía: r.observacion del ERP siempre es "" (limitación documentada)

---

### V36.8b — 2026-05-22
Archivos tocados: panel-admin.html · AGENTS.md
Commit: "V36 2026-05-22 -- rediseno render por sector"
- vadmRenderSector: rediseño (panel-admin.html L11047-11143)
  - Antes: cnt++ por línea · sin _vadmBodSel · vendedorTop por neto
  - Ahora: docMap[numero+'\x01'+sector] dedup → agrupa por sector · vendedorTop por count docs
  - Header #1a1d3a · barras #5b6ee8 · filas alternas · tfoot #f3f4f6
  - Fuente: ventas-xlsm-sector.json (generado por leer_xlsm.py · _extraer_sector() · _SECTOR_DISPLAY)
- AGENTS.md: nombre bat corregido (ACTUALIZARGITHUB.bat → ACTUALIZAR_GITHUB.bat)

---

### V36.8c — 2026-05-22
Archivos tocados: ACTUALIZAR_GITHUB.bat · PUBLICAR.bat · docs/ (nueva) · 3 BATs marcados [OBSOLETO]
Deploy: 2026-05-22 22:33 (188 archivos · 0 pendientes)
- ACTUALIZAR_GITHUB.bat: agrega AGENTS.md + docs/*.md al robocopy
- PUBLICAR.bat: fix comentario "30 seg" → "10 seg"
- 3 BATs marcados [OBSOLETO]: SUBIR_VENTAS_MANZANO.bat · PREPARAR_Y_PUBLICAR.bat · ACTUALIZAR_AUTO.bat
- docs/ creada en raíz: MANUAL_MAESTRO.md · feedback_reglas.md · project_archivo.md · CALCULOS.md · SEGURIDAD.md · MANUAL_VENTAS_LOCAL.md
- Pipeline ejecutado: 9.881 productos · 6.011 Datos.json · 38.297 registros ventas · 34.375 enriquecidos XLSM
- xlsm-enrich.json: 12.092 documentos indexados
- Protocolo de cierre de sesión establecido (deploy + AGENTS.md + CLAUDE.md + memoria)

---

### V36.9 — 2026-05-23
Archivos tocados: panel-admin.html · leer_xlsm.py · main.py
- vadmRenderSector: migrado de ventas-xlsm-sector.json → _vadmLineas (ERP)
  - Fix: filtro vendedor antes funcionaba solo para Rafaela (XLSM vendedor=ERP code vs gmailUser)
  - Default fechas: 2026-01-01 a hoy (antes: mes actual)
  - Auto-load: si rango > _vadmLineas cargado → fetch ventas-manzano-YYYY.json
  - Columnas nuevas: Cliente top (razonSocial con mayor neto) + RUT
  - Filtro hora: select AM/PM
  - Gráfico: Chart.js barra (docs por hora) + línea (neto)
- leer_xlsm.py: xlsm-enrich.json enriquecido
  - sector=_extraer_sector()→_SECTOR_DISPLAY (normalizado) · +hora · +razonSocial
  - 12.092 documentos indexados
- main.py: enriquecer_desde_xlsm() agrega hora y razonSocial
  - 34.375/38.297 registros actualizados
- guardar_json(): ahora genera splits anuales/mensuales con enrichment XLSM completo
  - Antes: descargar_ventas_erp.py generaba splits sin enrichment
  - Campos enriquecidos en _vadmLineas: rut · sector · bodegaCorta · hora · razonSocial · observacion

---

### V36.9b — 2026-05-23
Archivos tocados: panel-admin.html
Deploy: 2026-05-23 11:00 (198 archivos · sw.js BUILD_DATE actualizado)
- vadmRenderSector: 6 cambios coordinados
  - Columnas NC y NC% eliminadas (8 columnas finales: # · Sector · Neto · Participación · DESP · Vendedor top · Cliente top · RUT)
  - Dropdown TIPO DOC: opción "Solo NC" eliminada (solo Todos/Factura/Boleta)
  - NC excluidas siempre del cálculo: if(_esNC(r)) return false — primer filtro
  - Columna Vis. renombrada a DESP
  - Nuevo sector RETIRO CLIENTE: registros sin r.sector → aparece al final en azul/itálica fondo #f0f4ff
  - Acordeón inline: se-detail-row pre-renderizada · solo un sector abierto · flecha ▶/▼ · scroll suave
    Tabla detalle: N° Doc · Fecha · Tipo · Cliente · RUT · Vendedor · Neto
- vadmSEToggleDetalle(tr): nueva función — toggle se-detail-row adyacente, cierra los demás
- vadmSEDetalle(): conservada como código muerto inofensivo (sin trigger activo)
- Footer: colspan ajustado a 8

---

### V36.9c — 2026-05-23
Archivos tocados: csv_a_json.py · panel-admin.html · _ARCHIVADOS\ (nueva)
Commit: be3e0a7 — "V36 2026-05-23 19:14 -- fix pipeline: tem_trans stockmap + log ejecucion V36.9c"
Deploy: 2026-05-23
- _ARCHIVADOS\ creada en D:\ferreteria-oviedo\
- 2 BATs archivados (movidos, no eliminados):
  - VENTAS EL MANZANO LOCAL\PREPARAR_Y_PUBLICAR.bat → _ARCHIVADOS\20260523_PREPARAR_Y_PUBLICAR.bat
    (llamaba exportar_consulta_ventas.py y preparar_datos.py — no existen)
  - VENTAS EL MANZANO LOCAL\ACTUALIZAR_AUTO.bat → _ARCHIVADOS\20260523_ACTUALIZAR_AUTO.bat
    (llamaba preparar_datos.py --auto — no existe; era tarea 7PM obsoleta)
- csv_a_json.py: 2 bugs corregidos
  - Bug P3: pd.read_excel(Datos.xlsx) → pd.read_csv(Datos.csv, encoding=utf-8-sig)
    (xlsx_a_csv.py generaba Datos.csv que nunca se usaba — inconsistencia del pipeline)
  - Bug P4: "TEM_TRANS": "tem_trans" agregado al mapa de columnas
    (tem_trans ausente de Datos.json a pesar de estar en la conversión numérica)
  - Datos.json regenerado: 6.011 productos con tem_trans incluido
- panel-admin.html: tem_trans agregado a _vadmCargarStockMap
  - tem_trans:Number(p.tem_trans||p.TEM_TRANS||0) entre campos tem y rce
  - reqStockPrellenar() ahora calcula tránsito TEM correctamente (antes siempre 0)
- Pipeline medido: 7 pasos · 203s total (~3m 23s) · 0 errores
  - log: logs/20260523_pipeline.log

---

### V36.9d — 2026-05-23 (documentación)
Archivos tocados: AGENTS.md · CLAUDE.md · MEMORY.md (solo .md)
- AGENTS.md: sección REGLAS ANTI-REGRESIÓN (PRIORIDAD MÁXIMA) agregada
  - Lista archivos prohibidos de regenerar
  - Orden de lectura obligatorio al inicio de sesión
  - Flujo de descarga — regla fija
- CLAUDE.md: sección PRIORIDAD 0 agregada al inicio
- MEMORY.md: entrada project_antiregresion_v369d.md agregada

---

## SCRIPTS ACTIVOS (9)
- descargar_erp.py              — stock + precios SSRS 2 bloques
- procesar-actualizacion.py     — Datos.xlsx + señal catalogo-dinamico.json
- xlsx_a_csv.py                 — Datos.csv
- csv_a_json.py                 — Datos.json (lee CSV, no Excel)
- actualizar_config_precios.py  — visibilidad precios en Firestore
- main.py                       — orquestador ventas ERP
- descargar_ventas_erp.py       — ventas incrementales HTTP directo
- leer_xlsm.py                  — XLSM → xlsm-enrich.json + ventas-xlsm-sector.json
- enviar_reporte_vendedores.py  — reporte email vendedores

## SCRIPTS ARCHIVADOS (en _ARCHIVADOS\)
- 20260523_PREPARAR_Y_PUBLICAR.bat
- 20260523_ACTUALIZAR_AUTO.bat

## TOKENS ERP (activos al 21-05-2026)
- existencias_clasificadas: 0a47cd76-ee53-f111-8b81-00155d9d0600
- listaprecio: 6044bcb5-7255-f111-8b81-00155d9d0600
- URL base: http://200.6.113.97/Justweb_Foviedo/VisorRS.aspx

## VARIABLES JS GLOBALES — NO RENOMBRAR
- _vadmLineas, _vadmStockMap, _vadmBodSel, _vadmVendSel
- _vadmSSProds, _vadmBRDatos, _vadmAnioSel, _vadmSSMesesMin

## FUNCIONES INTOCABLES — NO CAMBIAR FIRMA
- venAdmParseFecha(s), venAdmFmt(n), vadmDatosFiltrados()

## CÓMO REFERENCIAR ESTE SKILL EN PROMPTS
Usar siempre esta línea exacta:
Leer archivo: D:\ferreteria-oviedo\.claude\skills\safe-change\safe-change.md
