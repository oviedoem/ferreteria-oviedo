## Índice de memoria — proyecto E:\ferreteria-oviedo

### Estado de sesión (recientes)
- [estado-sesion-20260822](estado-sesion-20260822.md) — V37.58: pipeline TODO2 22-08 OK, fix rotar_token despachos-panel, análisis TRIM confirmado OK, docs actualizados, commit f838206.
- [estado-sesion-20260820d](estado-sesion-20260820d.md) — V37.58: SQL reemplaza Blazor definitivo, fusionar_despachos.py archivado (código muerto), modDespachosPend.bas creado, limpieza docs completa. Deploy+commit 8acd3cd.
- [estado-sesion-20260820c](estado-sesion-20260820c.md) — TODO2.bat OK, descargar_blazor_api.py creado (REST puro), BOM+URL ERP fix, TOKEN renovado. Bug JustTime: P_CONTROL_BODEGAS sin permisos cloud.
- [estado-sesion-20260820b](estado-sesion-20260820b.md) — FO_SQL_DATOS.xlsm creado+corregido (Error 3704 fix: CopyFromRecordset+adOpenStatic), XLSM=1ra fuente SQL, Python=fallback. Pendiente: probar BAJAR TODO + pipeline.
- [estado-sesion-20260820](estado-sesion-20260820.md) — Fix búsqueda Consulta de Stock (AND tokens+tildes+dimensiones), datalist sugerencias HTML5, proteger Datos.json en deploy (PASO 4 bat).
- [estado-sesion-20260818b](estado-sesion-20260818b.md) — Ventas 18-08 OK (57.460 reg), OCR descartado de docs, Litueche removido, panel-admin sin errores, commit 598b0a2.
- [estado-sesion-20260818](estado-sesion-20260818.md) — Deploy 17-08 OK (bodegas/stock frescos, ventas 11-08), TOKEN_RECEPCION actualizado, seguridad gitignore, commit 489d715.
- [estado-sesion-20260817](estado-sesion-20260817.md) — Análisis ERP vs SQL: 24 scripts inventariados, ERP_SIN_SQL_SOLUCION.md creado con plan de implementación por prioridad. CONOCIMIENTO DEL NEGOCIO\ centralizado.
- [estado-sesion-20260813](estado-sesion-20260813.md) — ISABEL RIQUELME: pipeline ERP 5 sucursales (9858 reg), 3 bugs corregidos (cache:{no-store}, SW v5, bodegasIncluidas), 3 commits GitHub Pages. Commit activo: 327dbeb.
- [estado-sesion-20260809](estado-sesion-20260809.md) — V37.57 Pipeline OK: ventas 55733 reg hasta 08-08, token rotado 262ca37c, deploy 20:18, commit 4b7adca. PASO 1A SSRS y PASO 1H Blazor fallaron (pendientes).
- [estado-sesion-20260731](estado-sesion-20260731.md) — V37.57 Fix validar_jsons kind=wrapped optional, julio completo (28-31), deploy 14:02, commit 0f93e6f. Pendiente: pipeline 18:30+.
- [estado-sesion-20260725](estado-sesion-20260725.md) — V37.57 Token 7fc97930 activo, auto-renovación TOKEN_RECEPCION implementada en blazor_bodegas.py V1.1, ERP=Blazor Web WASM documentado.
- [estado-sesion-20260723](estado-sesion-20260723.md) — V37.57 Renovación TOKEN_RECEPCION + fix validar_jsons lista vacía opcional + pipeline 52.536 ventas, 40 despachos, deploy 11:55. Commit pendiente verificar.
- [estado-sesion-20260720](estado-sesion-20260720.md) — V37.57 Sesión completa 20-07: 2 pipelines (13:48+18:34), 51.907 ventas, fix PASO 1K goto labels, CLAVE NUEVA.txt eliminada, docs sync E:/W:, commit d69d3ae. Pendiente: renovar TOKEN_RECEPCION.
- [estado-sesion-20260715b](estado-sesion-20260715b.md) — V37.57 CIERRE: headless=False Blazor (intervención manual token vencido), deploy 21:17, commit bf90036. TOKEN_RECEPCION pendiente renovar.
- [estado-sesion-20260715](estado-sesion-20260715.md) — V37.57 Fix OCR warnings Blazor: IP real movida a credenciales + token masked en exception log. Pendientes 1/2 OK. ESTADO_PROYECTO actualizado.
- [estado-sesion-20260706](estado-sesion-20260706.md) — V37.57 Pipeline completo 06-07: renovar token, main.py ventas, fix validar_jsons schema (3 errores), fix firebase.json predeploy ruta absoluta. Deploy 22:29, commit fb4f30d.
- [estado-sesion-20260703d](estado-sesion-20260703d.md) — V37.57 Agentes multi-proyecto: CLAUDE.md+skills 6 proyectos, Tutoriales/Mejoras panel actualizados (37/45 ok 82%), deploy 20:38, commit 3fab754.
- [estado-sesion-20260703c](estado-sesion-20260703c.md) — V37.57 Fix PASO 1H Blazor: 90s sin reload + route.continue_() + selector substring. Pipeline OK, deploy 19:45, commit a01149d.
- [estado-sesion-20260703b](estado-sesion-20260703b.md) — V37.57 Rediseño iconos sidebar v4: 38 SVG symbols, .tag kraft, 35 nav-btn + 22 vadm-stab, auditoría Paperclip 57/57. Deploy hecho 15:06.
- [estado-sesion-20260703](estado-sesion-20260703.md) — V37.56 Fix seguridad: token rotativo glob dinámico (julio público), XSS FO-002 venAdmEsc(bk), CLAUDE.md skills, sync W:. Deploy pendiente.
- [estado-sesion-20260701n](estado-sesion-20260701n.md) — V37.55 OC Pendiente desde SQL CERRADO: descargar_oc_pendientes.py (PASO 1N, 387 OCs/670 códigos), columna OC Pend en Solicitud Semanal (tras Stock actual, email intacto), oc_pend en _vadmStockMap con cb idempotente, whitelist rotar_token +2 (el plan lo omitía). Verificado en preview + prod badge V37.55. OCR 14/14. Deploy 22:37, commit 988dd73. Pendiente: ver columna con login real + 2 fixes OCR blazor heredados
- [estado-sesion-20260701m](estado-sesion-20260701m.md) — PASO 1H RECUPERADO con 3 workarounds en descargar_blazor_bodegas.py (CORS --disable-web-security + reescritura localhost:6969→host real + reintentos SignalR). recepciones=7, despachos-panel=35. V37.54 CERRADO: deploy datos+badge, commits e0dd33f+cce444e, OCR $0 sin errores. Pendiente: reportar server ERP a JustTime + 2 warnings OCR (IP fallback + token en log)
- [estado-sesion-20260701l](estado-sesion-20260701l.md) — ACTUALIZAR_TODO OK (venta final del día, deploy 18:27, token rotado). PASO 1H Blazor cayó: causa raíz REAL = CORS del servidor WsApi ERP (no Defender/token); tab Por Recepcionar vacío. Docs E/W a V37.53. Pendiente decidir fix A (JustTime) vs B (--disable-web-security)
- [estado-sesion-20260701k](estado-sesion-20260701k.md) — El fix sticky headers de sesiones anteriores NUNCA funcionó de verdad (solo verificado con computedStyle). Causa raíz real encontrada y corregida (wrappers overflow-x:auto secuestran el containing block). V37.53
- [estado-sesion-20260701j](estado-sesion-20260701j.md) — Sticky headers extendidos a TODOS los menús (18 tab-pane + 34 vadm-section), excepciones en 4 modales con scroll propio. V37.52
- [estado-sesion-20260701i](estado-sesion-20260701i.md) — Informe Stock: encabezados sticky (position:sticky;top:60px) para que no desaparezcan al hacer scroll
- [estado-sesion-20260701h](estado-sesion-20260701h.md) — Informe Stock: Dif fantasma por Disp desactualizado (Excel manual actualizar.xlsx) vs Fisico ya correcto (SQL/SSRS); se prioriza SQL. V37.51. Resumen de los 5 fixes en cadena del día
- [estado-sesion-20260701g](estado-sesion-20260701g.md) — Análisis de Bodegas ocultaba stock negativo por completo (GEM/CEM aceptan negativo por diseño ERP); corregido, se muestra en rojo con Valorizado negativo
- [estado-sesion-20260701f](estado-sesion-20260701f.md) — Bug real corregido: JOIN por sucursal en descargar_bod.py causaba fecha/días incorrectos en TEM (y latente en GEM). R_STOCK_PRODUCTOS se actualiza 1x/día (~22:00), no en tiempo real
- [estado-sesion-20260701e](estado-sesion-20260701e.md) — Fix real: GEM/TEM sin datos porque data/*.json vive tras carpeta-token rotativa no whitelisteada; corregido + verificado en producción
- [estado-sesion-20260701d](estado-sesion-20260701d.md) — Análisis de Bodegas: agregadas GEM+TEM (6 bodegas). ESTADO_PROYECTO.md/AGENTS.md puestos al día. V37.50, commit e7de37b
- [estado-sesion-20260701c](estado-sesion-20260701c.md) — Fix historial Solicitud Stock: exporta base completa (no solo enviados) + guarda mínimo/repos solicitados al enviar. V37.49
- [estado-sesion-20260701b](estado-sesion-20260701b.md) — Fix login: dataAccessToken vencido deslogueaba sin mensaje en admin/vendedor; pipeline re-corrido + mensaje visible. Commit 2382545
- [estado-sesion-20260701](estado-sesion-20260701.md) — Base ampliada +1.716 códigos sin mínimo/repos ERP; migración mapa→subcolección Firestore por límite de índices. V37.48
- [estado-sesion-20260630f](estado-sesion-20260630f.md) — Solicitud de Stock: base Firestore PEM(224)+SEM(573)=797 códigos, tracking envíos, historial Excel. V37.47
- [estado-sesion-20260630e](estado-sesion-20260630e.md) — Fix bug vendedores=0 al navegar a Análisis. _vadmAplicarDatos omitía campo vendedor. Commit 19fae2a
- [estado-sesion-20260630d](estado-sesion-20260630d.md) — CIERRE DEFINITIVO: PASO 1H resuelto TOKEN directo, pipeline 18:00 OK, deploy V37.46, docs E/C/W actualizados
- [estado-sesion-20260630c](estado-sesion-20260630c.md) — PASO 1A bloqueado: Playwright bloqueado por FortiShield (no Defender), requests SI funciona, falta capturar export CSV
- [estado-sesion-20260630b](estado-sesion-20260630b.md) — Traspasos CD: prioridad 4 capas + filtro keyword portabilidad + badge visual. Deploy V37.46
- [estado-sesion-20260630](estado-sesion-20260630.md) — Traspasos CD: filtro bodega PEM/SEM/CD + checkboxes ranking + Solicitar manual + export solo con cantidad. Deploy V37.45
- [estado-sesion-20260628e](estado-sesion-20260628e.md) — XSS vadmBuscarStock/csVerDesgloseMarca corregido, Playwright PATH seteado, excepción Defender PASO 1A aplicada. V37.43
- [estado-sesion-20260628d](estado-sesion-20260628d.md) — Consulta de Stock con tránsito por bodega/marca, fix XSS, plano HTML actualizado. V37.42
- [estado-sesion-20260628c](estado-sesion-20260628c.md) — Traspasos CD→PEM/SEM implementado (ST_MAX ERP por bodega), porBodega en stock-critico.json. V37.30

- [prompt-siguiente-proyecto-xlsm](prompt-siguiente-proyecto-xlsm.md) — Prompt listo para adoptar modelo XLSM+VBA+SQL en otro proyecto (sin mezclar con FO)
- [feedback-no-editar-sin-autorizacion](feedback-no-editar-sin-autorizacion.md) — REGLA PERMANENTE: no editar/crear/borrar ningún archivo sin autorización explícita en cada sesión

- [feedback-anti-regresion-datos](feedback-anti-regresion-datos.md) — Checklist anti-regresión: bot, cotizador, JSONs fuera de git, archivos temp basura

- [feedback-sesiones-cortas-enfocadas](feedback-sesiones-cortas-enfocadas.md) — REGLA PERMANENTE: una tarea por sesión — el contexto crece con cada herramienta, sesiones largas pierden coherencia

### Feedback — reglas activas (NO eliminar)
- [feedback-bodegas-gestion-bodegasIncluidas](feedback-bodegas-gestion-bodegasIncluidas.md) — REGLA: bodegasIncluidas debe ser array de {simbolo,nombre} — nunca null — o la tabla muestra 0 filas
- [feedback-proyectos-separados-ferresystem-sql](feedback-proyectos-separados-ferresystem-sql.md) — REGLA: FerreSystem, SQL, bodegas-gestion, LITUECHE y E:\CONOCIMIENTO DEL NEGOCIO\ son proyectos/carpetas separados — nunca mezclar con este proyecto sin autorización explícita
- [feedback-open-code-review-deprecado](feedback-open-code-review-deprecado.md) — REGLA: /open-code-review deprecado; usar /revisar-codigo o /paperclip-revision-costo-cero
- [feedback-validar-jsons-schema-formato](feedback-validar-jsons-schema-formato.md) — REGLA: si deploy bloqueado por validar_jsons, revisar formato real del JSON antes de asumir fallo del script
- [feedback-verificar-sticky-con-scroll-real](feedback-verificar-sticky-con-scroll-real.md) — REGLA: verificar position:sticky con scroll real + screenshot, nunca solo con getComputedStyle
- [feedback-protocolo-sesion](feedback-protocolo-sesion.md) — REGLA PERMANENTE: TOCO+anti-regresión+safe change+AGENTS.md activos en TODA sesión automáticamente
- [feedback-no-correr-rotar-token-aislado](feedback-no-correr-rotar-token-aislado.md) — REGLA CRÍTICA: nunca correr rotar_token_data.py aislado, borra carpeta de token anterior con todos los datos
- [feedback-datos-erp-aislamiento-estricto](feedback-datos-erp-aislamiento-estricto.md) — REGLA CRÍTICA: en sesión DATOS ERP jamás tocar E:\ferreteria-oviedo\ — ni commits, ni grep, ni panel-admin
- [feedback-seguridad-repo](feedback-seguridad-repo.md) — REGLA: nunca IPs reales ni tokens en repo público; placeholders obligatorios antes de todo commit
- [feedback-no-extraer-credenciales-encubierto](feedback-no-extraer-credenciales-encubierto.md) — REGLA SEGURIDAD: nunca extraer/descifrar credenciales evitando alertas (caso Pypykatz)
- [feedback-no-exponer-credenciales-en-acciones](feedback-no-exponer-credenciales-en-acciones.md) — REGLA: nunca pasar usuario/clave/token en llamadas de herramienta visibles
- [feedback-actualizar-badge-version-solo-al-cerrar-sesion](feedback-actualizar-badge-version-solo-al-cerrar-sesion.md) — REGLA: badge versión solo al CERRAR sesión, nunca en cada mejora
- [feedback-bat-encoding-ansi](feedback-bat-encoding-ansi.md) — REGLA: archivos .bat siempre en ANSI CP1252 con PowerShell+GetEncoding(1252)
- [feedback-probar-fetch-externo-en-navegador](feedback-probar-fetch-externo-en-navegador.md) — REGLA: fetch() a dominio externo SIEMPRE probar en navegador real — CSP de firebase.json solo bloquea ahí
- [feedback-verificar-codigo-en-prompts-detallados](feedback-verificar-codigo-en-prompts-detallados.md) — REGLA: código literal en prompts puede traer bugs — verificar antes de aplicar
- [feedback-revisar-referencias-antes-de-investigar](feedback-revisar-referencias-antes-de-investigar.md) — REGLA: revisar IDS_REFERENCIA.md y .xlsx ANTES de investigar con agentes
- [feedback-no-usar-c](feedback-no-usar-c.md) — REGLA: nunca usar C: para el proyecto; confirmar antes de borrar cualquier registro en C:
- [feedback-archivos-respaldo-fuera-proyecto](feedback-archivos-respaldo-fuera-proyecto.md) — REGLA: respaldos/temporales → E:\ferreteria-oviedo\_ARCHIVO_FERRETERIA, nunca dentro del proyecto
- [feedback-rutas-activas-e-w](feedback-rutas-activas-e-w.md) — REGLA: E: y W: son rutas activas; L: es solo respaldo, nunca cambiar configs a L:
- [feedback-ejecucion-bats](feedback-ejecucion-bats.md) — BATs en background con output visible; usuario puede chatear sin interrumpir
- [feedback-orientacion-sesion-nueva](feedback-orientacion-sesion-nueva.md) — REGLA: leer archivos reales al inicio, declarar scope, ejecutar pendientes sin preguntar
- [feedback-proactividad-analisis](feedback-proactividad-analisis.md) — REGLA: al analizar pipeline revisar TODAS las carpetas; ejecutar consecuencias obvias sin preguntar
- [feedback-docs-copy-paste-sin-placeholders](feedback-docs-copy-paste-sin-placeholders.md) — Guías para el dueño deben resolver la letra de disco en el comando mismo, sin placeholders

- [fix-validar-jsons-lista-vacia-opcional](fix-validar-jsons-lista-vacia-opcional.md) — Fix 23-07: lista vacía + optional=True → OMITIDO (no ERROR); método renovar TOKEN_RECEPCION con Chrome --disable-web-security

### Referencia técnica — proyecto
- [traslados-entre-sucursales-protocolo](traslados-entre-sucursales-protocolo.md) — TEM/TCD=crossdock SOLO Casa Matriz/Santiago; INGRESO (IEM/ICD)=transitoria destino; flujo GRC→GTS→GIB sin despacho automático; GTS/GIB sin origen OC → excluidos de oc-leadtime por diseño
- [sql-stock-calculos-formulas](sql-stock-calculos-formulas.md) — Fórmulas stock SQL (St_Disp/St_Bod/Ped), parseo CSV SSRS, flujos COMPRA/VENTA/DEVOLUCION, IDs bodegas
- [erp-reportes-mapeados](erp-reportes-mapeados.md) — 12 reportes JustWeb mapeados: columnas, IDs El Manzano, métodos acceso, origen ST_MIN/MAX/CRITICO
- [cuentas-identidad](cuentas-identidad.md) — Mapa cuentas: agonzalez=ERP, alejandrog45@gmail.com=Firebase Auth, ferreteriaoviedo.elmanzano=GitHub+Firebase consola
- [arquitectura-discos](arquitectura-discos.md) — Identificar SIEMPRE por etiqueta de volumen (PROYECTO_E/CONFIG_W); cutover 22-06 completado
- [cutover-claude-config-completado](cutover-claude-config-completado.md) — W: es canónico/real, C: es duplicado intencional (sync W→C con SYNC_W_A_C.bat)
- [seguridad-carpeta-aleatoria-datos](seguridad-carpeta-aleatoria-datos.md) — Fix fuga datos públicos: carpeta nombre aleatorio rotativo; rotar_token_data.py gestiona la rotación
- [conocimiento-materiales-construccion-chile](conocimiento-materiales-construccion-chile.md) — siding metálico=META005 (no SIDI0005=plástico), equivalencias OSB/Volcanita/Metalcon/Cemento
- [reglas-negocio-stock](reglas-negocio-stock.md) — Códigos XX excluidos de merma; reposición PEM/SEM solo si CD=0
- [reglas-negocio-cem](reglas-negocio-cem.md) — CEM acepta stock negativo por diseño; excluir de stock crítico siempre
- [bug-dedup-ventas-erp-perdia-lineas](bug-dedup-ventas-erp-perdia-lineas.md) — FIX 26-06: dedup Numero+Codigo perdía líneas repetidas (~1.4% venta); corregido en descargar_ventas_erp.py
- [bug-dataaccesstoken-vencido-logout-silencioso](bug-dataaccesstoken-vencido-logout-silencioso.md) — dataAccessToken TTL 8h; si vence, admin/vendedor se desloguean sin mensaje (ya tiene fix visible)

- [blazor-rest-api-endpoints](blazor-rest-api-endpoints.md) — REST API wsapi.justtime.cl despachos/recepciones, X_API_KEY, bug P_CONTROL_BODEGAS pendiente JustTime

### Referencia técnica — infraestructura
- [forticlient-disco-e-emergencia](forticlient-disco-e-emergencia.md) — FortiShield bloquea disco USB; fix v3: Stop-FortiUSBmon + fltmc detach + REMONTAR_DISCO_E.ps1
- [git-credential-fix](git-credential-fix.md) — helper=manager; tokens DPAPI en E:\config\gcm-store
- [python-portable-reparado](proyecto-python-portable-reparado.md) — Python portable en E:\python-portable; python311.dll+zip, paquetes, playwright
- [firebase-token-backup](firebase-token-backup.md) — Token Firebase en E:\config (DPAPI enc)
- [claude-mobile-config](claude-mobile-config.md) — App Claude Android: login Google (ferreteriaoviedo.elmanzano@gmail.com)
- [referencia-netlify-vendedorpro-coach](referencia-netlify-vendedorpro-coach.md) — Netlify CLI LOCAL en node_modules\.bin\netlify.cmd, no en npm-global
- [justime-c-fix-com-y-defender](justime-c-fix-com-y-defender.md) — Fix Justime: reg.bat path COM/OCX + Defender Network Protection bloqueaba WS ERP
- [justime-c-fix-truedbgrid-activex](justime-c-fix-truedbgrid-activex.md) — Justime C: ActiveX JustEDocumentos+TrueDBGrid sin registrar; fix copiando runtime desde D
