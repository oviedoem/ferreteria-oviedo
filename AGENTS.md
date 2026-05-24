# AGENTS.md — Ferretería Oviedo V36.9f
# Codex LEE ESTO ANTES de escribir cualquier línea de código.
# Última actualización: 2026-05-24

## RUTAS CRÍTICAS — NO BUSCAR, USAR DIRECTAMENTE

```
Proyecto activo:   D:\ferreteria-oviedo\
GitHub (solo sync):D:\ferreteria-oviedo-github\
Archivados:        D:\ferreteria-oviedo\_ARCHIVADOS\  (scripts obsoletos con prefijo YYYYMMDD_)
Memory Claude:     C:\Users\Ferreteria Oviedo\.claude\projects\C--Users-Ferreteria-Oviedo\memory\
MEMORY.md index:   C:\Users\Ferreteria Oviedo\.claude\projects\C--Users-Ferreteria-Oviedo\memory\MEMORY.md
CLAUDE.md global:  C:\Users\Ferreteria Oviedo\.claude\CLAUDE.md
```

---

## PROYECTO
- Stack: HTML/CSS/JS Vanilla (panel-admin.html) + Firebase Hosting (JSON estáticos) + Python pipeline ERP
- Directorio activo: D:\ferreteria-oviedo — NO trabajar en D:\ferreteria-oviedo-github
- Versión activa: V36.9f
- Deploy confirmado: 2026-05-24 03:02 — descargar_bod.py SQL Server IEM+RCE; panel selector Fuente; PASO 1C bat

---

## SAFE CHANGE PROTOCOL — OBLIGATORIO ANTES DE CUALQUIER CAMBIO

Antes de escribir código, declarar en texto:

Regla: Un prompt = una función tocada.
Si el fix requiere 2 funciones → dos prompts separados, en orden.
Si Codex propone tocar algo fuera del alcance declarado → DETENER y preguntar.
SEÑAL DE ALERTA: Si Codex dice "también modifiqué X para que funcione"
sin que se lo pidiera → revisar X antes de aceptar el cambio.

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

### ARCHIVOS PROHIBIDOS DE REGENERAR:

- ventas-manzano.json → ELIMINADO, duplicado de ventas-manzano-2026.json
- PREPARAR_Y_PUBLICAR.bat → ARCHIVADO en _ARCHIVADOS\
- ACTUALIZAR_AUTO.bat → ARCHIVADO en _ARCHIVADOS\
- credenciales_erp.ini → NUNCA tocar ni leer en voz alta
- D:\ferreteria-oviedo-github\ → NUNCA modificar

### ORDEN DE LECTURA OBLIGATORIO AL INICIO DE CADA SESIÓN:

1. MEMORY.md
2. AGENTS.md
3. CLAUDE.md
4. Recién después ejecutar cualquier tarea

### FLUJO DE DESCARGA — REGLA FIJA:

- ventas-manzano-2026.json es el archivo activo de ventas año completo
- ventas-manzano-2026-05.json es el archivo activo de ventas mes actual
- ventas-manzano.json NO DEBE EXISTIR ni regenerarse bajo ninguna circunstancia
- descargar_erp.py descarga stock y precios — NO duplicar
- descargar_ventas_erp.py descarga ventas — NO duplicar salidas

---

## REGLA COMMIT OBLIGATORIO

Al terminar CUALQUIER modificación de código, ejecutar SIN EXCEPCIÓN desde PowerShell:

  "V36.X desc breve sin tildes" | cmd /c "D:\ferreteria-oviedo\ACTUALIZAR_GITHUB.bat"

- El bat sincroniza con robocopy los archivos permitidos y hace git add/commit/push.
- La descripción va por stdin (máximo 5 palabras, minúsculas, sin tildes).
  Ejemplo: fix bodega dropdown panel
- No preguntar al usuario. No esperar confirmación.
- Ejecutar siempre como último paso.
- Si BLOQUEADO: revisar archivo sensible en repo antes de reintentar.
- Si falla por red: reportar el error pero NO omitir el intento.

---

## REGLA SEÑALES DE DISEÑO — verificar implementación completa

Cuando CLAUDE.md dice "el script Y escribe el archivo X":
1. Hacer grep inmediato para confirmar que el código existe.
2. Si no hay json.dump / open(X, 'w') → implementación incompleta.
3. Completar antes de cerrar la sesión.
Patrón de riesgo: documentado en CLAUDE.md pero el código no lo hace.

---

## REGLA ARCHIVO — revisar antes de crear

Antes de escribir cualquier script, HTML, BAT o función nueva:
- Verificar si existe algo en D:\ferreteria-oviedo\ARCHIVO que sirva.
- Si existe → moverlo de vuelta (Move-Item), no copiar ni duplicar.
- Ver memoria project-archivo para el mapa completo.

---

## REGLAS DE EJECUCIÓN

- No usar cmd /c bat > NUL desde bash — abre shell interactivo.
- Usar PowerShell step-by-step o correr scripts Python directamente.
- No subir datos de ejemplo — solo datos reales actualizados.
- XLSMs (VENTAS, RANKING, PRECIOS) están en ARCHIVO\05-TUTORIALES-XLSM-ERP.
- No agregar dependencias sin autorización.
- No reescribir lo que ya funciona.
- No pedir confirmación antes de ejecutar scripts/BATs si el usuario dijo "ejecuta".

---

## ZONAS ABSOLUTAMENTE INTOCABLES

- firebase-config.js — no modificar nunca desde panel HTML
- window.mostrarPrecio — default SIEMPRE false en panel-cliente.html
- credencialeserp.ini — nunca tocar, nunca subir
- D:\ferreteria-oviedo-github — nunca trabajar aquí
- venAdmParseFecha — utility global, no cambiar firma ni comportamiento
- venAdmFmt — utility global, no cambiar firma

---

## MAPA DE DEPENDENCIAS CRÍTICAS

Si tocas...              Debes verificar también...
------------------------------------------------------------
vadmSubTab(id)           Que id esté en vadmReRenderTabActivo.
                         Si no está, el tab no se actualiza al cambiar filtros.
vadmRenderSobreStock     vadmSSProds lo usan email, Excel y Outlook.
                         Si cambia la estructura del objeto, rompe los 3 exports.
vadmRenderBajaRot        vadmBRDatos — mismo caso que SSProds.
                         Depende de vadmLineas cubriendo el rango de fechas.
vadmRenderQuiebre        vadmStockMap debe estar cargado primero.
                         Si no, llamar vadmCargarStockMap(cb) antes.
vadmCargarStockMap       Cacheada en sesión. NO llamar si ya existe con datos.
vadmSSMarcaClick(el)     Usa data-marca del HTML.
                         NUNCA pasar nombre como string en onclick.
Sidebar HTML             Verificar que grupos siguen colapsando correctamente.
Cualquier onclick        NUNCA usar JSON.stringify — se rompe con comillas
                         en nombres de marca/producto.
venAdmParseFecha         Utility global usada en TODOS los tabs de ventas.
                         No modificar firma ni comportamiento.
venAdmFmt                Utility global de formato CLP. No modificar.

---

## VARIABLES JS GLOBALES CLAVE — no renombrar

vadmLineas        Array registros de ventas {codigo, fecha, valorNeto,
                  cantidad, marca, periodo, bodegaCorta}
vadmStockMap      Mapa cod → {pem, sem, cem, mem, stock, marca, desc,
                  costo, precio, pemtrans, cd, cdtrans, rce, tem, iem, iemtrans}
vadmBodSel        Array de bodegas seleccionadas
vadmVendSel       Array de vendedores seleccionados
vadmSSProds       Cache último render sobre-stock — usan email, Excel, Outlook
vadmBRDatos       Cache último render baja rotación — idem
vadmAnioSel       Año seleccionado (mes actual por defecto)
vadmSSMesesMin    Cobertura mínima para sobre-stock (default 12)

---

## FUNCIONES JS CLAVE — no renombrar ni cambiar firma

vadmCargarLineas          Carga ventas JSON según vadmAnioSel
vadmCargarStockMap(cb)    Carga Datos.json → vadmStockMap, cachea en sesión
vadmRenderSobreStock      Render sobre-stock, cobertura en meses
vadmSSMarcaClick(el)      Toggle filtro marca — usa data-marca, NO string
vadmRenderBajaRot         Render baja rotación, auto-reload si rango > datos
vadmFiltrarBajaRot        Re-filtra vadmBRDatos sin recomputar ABC
vadmRenderQuiebre         Render stock quiebre con ABC + Rot.30/60/90d
vadmRenderNC              NC por vendedor — usa _vadmLineas (ERP, TODOS los vendedores)
                          Detecta NC por r.documento (contiene "nota" o "cred")
                          Agrupa 2 pasos: (vendedor|numero) → neto acumulado → por vendedor
                          NO usa ventas-xlsm-YYYY.json (V36.7 bug: solo mostraba 2 vendedores)
venAdmParseFecha          Parsea fecha DD/MM/YYYY → timestamp ms
venAdmFmt(n)              Formatea número como X.XXX CLP

---

## BODSTOCK — 8 BODEGAS, NO REDUCIR

var BODSTOCK = {
  PEM:'pem', SEM:'sem', CEM:'cem', RCE:'rce',
  MEM:'mem', TEM:'tem', IEM:'iem', CD:'cd'
}

Antes tenía solo 5 (faltaban RCE, TEM, IEM). Corregido en V36.6.
No revertir. No reducir.

---

## BODEGAS — clasificación oficial

Comerciales (visibles en cálculos de stock): PEM SEM CEM MEM
Auxiliares/logísticas (NO en cálculos comerciales): IEM TEM RCE CD
Eliminadas: CAL

Bodegas SSRS — 2 bloques desde V36.3:
BLOQUE 1 (solo DISP): SEM CEM RCE MEM
BLOQUE 2 (DISP+TRANS): PEM TEM CD IEM

---

## FLUJO ANTI-DOBLE-DESCARGA — V36.6 FIX CRÍTICO

procesar-actualizacion.py escribe data/catalogo-dinamico.json como señal.
main.py PASO 1:
  - catalogogeneradohoy()? SI → leerbodegasdesdeactualizar (3 seg)
  - catalogogeneradohoy()? NO → descargarbodegas.py HTTP (70 seg)

Quién escribe la señal: procesar-actualizacion.py (PASO 2 del bat).
NO modificar esta lógica sin entender la señal.
actualizarxlsxeshoy() ELIMINADA en V36.5 — no reintroducir.

---

## FILTRO EXH — leerxlsm.py INTOCABLE

BODCORTA incluye: EXH → None
Si bodcorta is None: continue
Evita contaminación del dropdown de bodegas con entradas de exhibición.
No revertir ni eliminar este filtro.

---

## DROPDOWN DE BODEGAS — solo bodegas reales

Eliminada la línea que forzaba CEM,MEM,SEM,CD aunque no tuvieran ventas.
Dropdown muestra solo bodegas presentes en vadmLineas.
No reintroducir la línea eliminada.

---

## bodegaCorta PEM — HARDCODEADO INTENCIONALMENTE

descargarventaserp.py líneas 179 y 222.
El reporte ERP (LstTipo2 y LstTipo4) no incluye columna bodega por fila.
No hay forma de obtenerla. Decisión documentada 21-05-2026.
NO intentar arreglarlo.

---

## PIPELINE COMPLETO — ACTUALIZARTODO.bat

1. descargarerp.py         → actualizar.xlsx (precios + stock SSRS 2 bloques)
2. procesar-actualizacion.py → Datos.xlsx + escribe catalogo-dinamico.json
3. xlsxacsv.py             → Datos.csv
4. csvajson.py             → Datos.json
   [PASO 1B] leerxlsm.py  → xlsm-enrich.json
   [PASO 1C] descargar_bod.py → bod-iem-registros.json + bod-rce-registros.json
             SQL Server directo (IDBODEGA 72/55), sin XLSM ni macros manuales
5. main.py --sin-deploy
   PASO 1: catalogogeneradohoy? SI/NO
   PASO 2: descargarventaserp.py incremental
   PASO 3: consolidar JOIN catálogo + ventas + mapacliente
   PASO 3.5: enriquecerdesdexlsm → rut, sector, bodegaCorta
   PASO 4: guardarjson ventas-manzano-*.json
6. Pregunta visibilidad precios (30 seg timeout, default N=ocultos)
7. firebase deploy

BATs disponibles:
- ACTUALIZARTODO.bat   → pipeline completo (único punto de entrada)
- PUBLICAR.bat         → solo firebase deploy
- ACTUALIZARGITHUB.bat → sync github
- ACTUALIZARVENTAS.bat → solo ventas (llama main.py)

BATs archivados en _ARCHIVADOS\ (NO ejecutar — llaman scripts inexistentes):
- 20260523_PREPARAR_Y_PUBLICAR.bat  (llamaba exportar_consulta_ventas.py y preparar_datos.py)
- 20260523_ACTUALIZAR_AUTO.bat      (llamaba preparar_datos.py --auto)

---

## CARGA DE DATOS — PERFORMANCE PANEL

- ventas-manzano-YYYY-MM.json  → mes actual, liviano ~200KB (default)
- ventas-manzano-YYYY.json     → año completo, 2-18MB (al seleccionar año)
- Datos.json                   → 3.5MB, cargado una vez, cacheado en sesión JS
- catalogo-dinamico.json       → 404 fallback a Datos.json
- vadmStockMap cacheado en sesión — NO refetch por tab
- Baja Rotación: auto-fetch año completo si rango > datos cargados

---

## REGLAS ERP / DATOS

- Nunca hardcodear familias, marcas, bodegas, columnas ni IDs nuevos.
  Siempre detectar/normalizar/mapear.
- Nunca mostrar datos hardcodeados, estimados o de ejemplo.
- Si panel muestra qty=0 pero ERP tiene ventas → BUG CRÍTICO, corregir de inmediato.
- Filtro de bodega vadmBodSel debe impactar simultáneamente:
  stock por producto, ventas contadas, KPIs y totales, Enviar Informe Excel/Outlook.
- Si un código aparece en inventario NO debe aparecer en ventas del mismo período.

---

## TABS VERIFICADOS — deben seguir funcionando tras cualquier cambio

ERP: hora topMarcas comparativa vendrank marcavend clientes tipodoc
     facturacion quiebre sobrestock transito merma rankingmarca
     estaciones bajrot pagoanalisis pagorankings pagotemporal
     entrefechas arbol arboltabla arbolheat
ERP (migrado V36.9): sector
XLSM: nc marcavend2 preciodiff mem
Stubs: impacto

---

## NAVEGACIÓN — estructura real, no inventar variantes

- showTab('ventas')        → abre panel ventas
- vadmGrupo('inventario') → activa grupo
- vadmSubTab('quiebre')   → muestra sub-tab
- NO existe adminShowTab(). No crearla ni usarla.

---

## SEGURIDAD FIREBASE — estado V36.2

Hosting headers (firebase.json):
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera, microphone, geolocation
- Content-Security-Policy: scripts/styles/fonts/img/connect srcs definidos

Firestore rules:
- cotizaciones: cliente lee solo las suyas (clienteUid = uid)
- users: solo admin o self puede leer
- config: lectura pública, escritura solo admin
- sesionesactivas: solo admin o mismo UID
- notificaciones: autenticados leen, admin/vendedor escriben
- productos, solicitudescupon: bloqueados (default deny)

Hosting ignore — directorios bloqueados:
VENTAS EL MANZANO, backups, .claude, .ini, .xlsm, .mp4

---

## CHECKLIST POST-CAMBIO — verificar antes de entregar

[ ] Función modificada recibe los mismos parámetros de entrada
[ ] Variables globales que usaba siguen existiendo con el mismo nombre
[ ] El tab que la invoca sigue funcionando (vsec- / vadmReRenderTabActivo)
[ ] Filtro de bodega vadmBodSel sigue afectando el resultado
[ ] No se hardcodeó ningún valor que debe venir de datos reales
[ ] No se renombró ninguna función pública
[ ] window.mostrarPrecio default false en panel-cliente.html

---

## CLASIFICACION REAL DE BODEGAS EL MANZANO

### Comerciales - ventas + NC + stock visible
- PEM (Patio El Manzano): ventas y NC. bodegaCorta HARDCODEADA en ERP
- SEM (Sala El Manzano): ventas y NC
- CEM (Calzada El Manzano): ventas y NC

### Auxiliares Logisticas - stock visible NO en calculos de ventas
- MEM (Mermas El Manzano): productos con detalles quebrados doblados
- RCE (Recepcion El Manzano): uso interno doble filtro proveedor
- TEM (Transito El Manzano): DISP llega de proveedor / TRANS va a llegar
- CD (Centro de Distribucion): DISP disponible para abastecer / TRANS llegara
- IEM (Ingreso El Manzano): DISP llega de proveedor o sucursal pasa a PEM/SEM/CEM / TRANS va a llegar

### Regla critica del filtro
- vadmBodSel afecta simultaneamente ventas Y stock
- Las 8 bodegas deben estar SIEMPRE visibles en el dropdown
- PEM/SEM/CEM tienen ventas reales
- MEM/RCE/TEM/CD/IEM solo tienen movimiento de stock

### Limitacion documentada NO es bug
- descargarventaserp.py lineas 179 y 222 bodegaCorta=PEM hardcodeado
- Reporte ERP no expone bodega por fila. Decision 21-05-2026 no arreglar
- Solo leerxlsm.py tiene bodegaCorta real desde VENTAS.xlsm columna BODEGA

---

## HISTORIAL V36.9e — 2026-05-24 (análisis bodegas IEM / RCE)

### Archivos tocados
- leer_xlsm.py: constante BOD_FEM_XLSM + función procesar_bod(path_xlsm, nombre_bod)
- panel-admin.html: sidebar grupo Análisis + tab-analisis + vadmRenderBodFem() + vadmFiltrarBodFem()
- data/bod-iem-registros.json: generado (19 registros reales IEM)
- data/bod-fem-registros.json: ELIMINADO (nombre incorrecto)

### Función procesar_bod() — leer_xlsm.py
- Genérica para cualquier XLSM de bodega con hoja REGISTROS y columnas A:H
- diasAntiguedad calculado en Python desde col G (datetime) — NO depende de col I (DATEDIF) ni J (NOW)
- codigoTecnico forzado a str (mixed int/str en col D)
- Salida: data/bod-{nombre_bod.lower()}-registros.json
- Para ampliar a RCE: procesar_bod(r"D:\ferreteria-oviedo\BODEGAS\BOD_RCE.xlsm", 'RCE')
- BOD_FEM_XLSM = ruta al XLSM físico (nombre interno del archivo, no nombre de negocio)

### Panel análisis bodegas
- Sidebar grupo: Análisis → Bodegas IEM / RCE (showTab('analisis'))
- Tab: tab-analisis (independiente de tab-ventas)
- Filtros: buscar por código/descripción, bodega dropdown, rango días mín/máx
- Tabla 9 cols: Bodega · Tipo Doc · Folio · Código · Descripción · Cant · Fecha · Días · Obs
- Orden: diasAntiguedad DESC (más antiguo primero)
- Colores: rojo ≥90d · naranja ≥30d
- Fetch: /data/bod-iem-registros.json
- Stub en vadmReRenderTabActivo: no usa filtros globales

### Regla de nombre — CRÍTICA
- El archivo físico se llamaba BOD_FEM.xlsm → renombrado a BOD_RCE.xlsm el 2026-05-24
- PERO el contenido (col A) tiene bodega IEM, no RCE
- Constante en leer_xlsm.py: BOD_IEM_XLSM = BOD_RCE.xlsm (nombre físico actual)
- JSON de salida: bod-iem-registros.json (basado en contenido real, no en nombre del archivo)
- REGLA FIJA: nombre del JSON = bodega real en col A, NO nombre del archivo XLSM
- "FEM" no debe aparecer en menús, labels, JSONs ni comentarios visibles
- Si en el futuro col A cambia a RCE → entonces y solo entonces usar bod-rce-registros.json

### Deploy y commits
- a94fb5d — add procesar_bod bod_fem_xlsm (leer_xlsm.py)
- 224764f — add analisis bodegas fem menu panel (panel-admin.html)
- c26d5d3 — fix fem a iem nombre json y menu
- 4b4a369 — cierre sesion v369e docs agents claude
- d2870c2 — fix constante bod iem xlsm ruta rce (leer_xlsm.py local, no en GitHub — .py bloqueado)
- Deploy: 2026-05-24 02:37

## HISTORIAL V36.9b — 2026-05-23 (sector tab acordeón + NC)

vadmRenderSector — 6 cambios coordinados:
- Columnas NC y NC% eliminadas de tabla y footer
- Dropdown TIPO DOC: eliminada opción "Solo NC" (solo Todos/Factura/Boleta)
- NC excluidas siempre del cálculo: if(_esNC(r)) return false — primer filtro
- Columna Vis. renombrada a DESP
- Nuevo sector RETIRO CLIENTE: registros sin r.sector agrupados con clave 'RETIRO CLIENTE'
  aparece al final en azul/itálica, fondo #f0f4ff
- Acordeón inline: clic en fila de sector despliega fila de detalle (se-detail-row)
  con tabla docs (N° Doc / Fecha / Tipo / Cliente / RUT / Vendedor / Neto)
  pre-renderizada al momento del Analizar, oculta con style="display:none"
  solo un sector abierto a la vez, flecha ▶/▼, scroll suave

vadmSEToggleDetalle(tr) — nueva función:
- Toggle del se-detail-row siguiente al tr clickeado
- Cierra todos los demás detalles y resetea flechas antes de abrir

Tabla: 8 columnas (#, Sector, Neto, Participación, DESP, Vendedor top, Cliente top, RUT)
Footer: colspan ajustado a 8 (eliminados totalNC y ncPct)
vadmSEDetalle() — conservada como código muerto inofensivo (no tiene trigger)

Deploy: 2026-05-23 11:00

## HISTORIAL V36.9 — 2026-05-23

vadmRenderSector — migrado de ventas-xlsm-sector.json a _vadmLineas:
- Fix: filtro vendedor funcionaba solo para Rafaela (XLSM vendedor=ERP code vs gmailUser)
- Ahora: _vadmLineas tiene r.vendedor=gmailUser → filtro funciona para todos
- Default fechas: 2026-01-01 a hoy (antes: mes actual)
- Auto-load: si rango > _vadmLineas cargado → fetch ventas-manzano-YYYY.json
- Columnas nuevas: Cliente top (razonSocial con mayor neto) + RUT
- Filtro hora: select AM/PM en barra de filtros
- Grafico: Chart.js barra (docs por hora) + linea (neto) debajo de tabla
- Sin _vadmSectorData — cache eliminado, usa _vadmLineas directamente

leer_xlsm.py — xlsm-enrich.json fix:
- Antes: sector=raw obsImp (no normalizado), faltaban hora y razonSocial
- Ahora: sector=_extraer_sector()->_SECTOR_DISPLAY (normalizado), +hora, +razonSocial
- 12092 documentos indexados

main.py — enriquecer_desde_xlsm:
- Agrega hora y razonSocial a registros de _vadmLineas
- 34375/38297 registros actualizados en el pipeline

Split JSONs actualizado: ventas-manzano-2026.json + mensuales 2026-01 a 2026-05
con campos hora y razonSocial. Deploy: 2026-05-23.

## HISTORIAL V36.9c — 2026-05-23 (limpieza pipeline)

ARCHIVADOS (movidos a _ARCHIVADOS\, no eliminados):
- VENTAS EL MANZANO LOCAL\PREPARAR_Y_PUBLICAR.bat → 20260523_PREPARAR_Y_PUBLICAR.bat
  Motivo: llamaba exportar_consulta_ventas.py y preparar_datos.py (no existen)
- VENTAS EL MANZANO LOCAL\ACTUALIZAR_AUTO.bat → 20260523_ACTUALIZAR_AUTO.bat
  Motivo: llamaba preparar_datos.py --auto (no existe); era tarea 7PM obsoleta

csv_a_json.py — 2 bugs corregidos (P3 + P4):
- P3: pd.read_excel(Datos.xlsx) → pd.read_csv(Datos.csv, encoding=utf-8-sig)
  xlsx_a_csv.py generaba Datos.csv que nunca se usaba. Ahora el pipeline es coherente.
- P4: "TEM_TRANS": "tem_trans" agregado al mapa de columnas
  tem_trans ausente de Datos.json a pesar de estar en la conversión numérica.
  Regenerado Datos.json: 6011 productos con tem_trans incluido.

panel-admin.html — _vadmCargarStockMap: tem_trans agregado al mapa de stock
- Antes: tem_trans ausente del objeto _vadmStockMap → reqStockPrellenar() calculaba
  transito como (p.pem_trans||0)+(p.tem_trans||0) pero p.tem_trans era undefined → 0
- Ahora: tem_trans:Number(p.tem_trans||p.TEM_TRANS||0) entre campos tem y rce
- Impacto: tránsito TEM ahora se suma correctamente en Solicitud Semanal de Stock
- Riesgo: NULO — campo aditivo, no modifica firma ni lógica existente

Pipeline timing log creado: logs/20260523_pipeline.log
- 7 pasos ejecutados: descargar_erp(102s) + procesar-actualizacion(11s) +
  xlsx_a_csv(4s) + csv_a_json(2s) + leer_xlsm(9s) + descargar_ventas_erp(73s) +
  actualizar_config_precios(2s) = 203s total (~3m 23s, sin alerta 5min)
- 0 errores, datos actualizados a 2026-05-23 19:07

ACTUALIZARTODO.bat confirmado como único punto de entrada del pipeline.

## HISTORIAL V36.9g — 2026-05-24 (fix diasAntiguedad último movimiento SQL)

### Archivos tocados
- BODEGAS/descargar_bod.py: SQL reemplazado — subquery ULT con MAX(FECHA_EMISION) y MAX(IDDOCUMENTO) para traer último movimiento real por producto/bodega/sucursal. Deduplicación en Python: solo registro con menor diasAntiguedad por codigoTecnico.

### Problema resuelto
- Antes: diasAntiguedad calculaba desde FECHA_EMISION del documento origen (ej. GRT 2024 → 759 días)
- Ahora: diasAntiguedad calcula desde último movimiento real en SQL (ej. AMES0096 RCE → 2 días, alineado con tarjeta ERP)

### Resultado
- IEM: 19 registros (sin cambio en cantidad)
- RCE: 10 registros (antes 12 con duplicados, ahora deduplicado por codigoTecnico)
- AMES0096 RCE verificado: 22/05/2026 → 2 días ✅

### Deploy
- Commit: V36.9g fix diasAntiguedad ultimo mov SQL
- Deploy: 2026-05-24 13:32 — ferreteria-oviedo.web.app

## HISTORIAL V36.9f — 2026-05-24 (automatización bodegas IEM/RCE vía SQL Server)

### Archivos tocados
- BODEGAS/descargar_bod.py: NUEVO — descarga IEM y RCE directo desde SQL Server
- panel-admin.html: selector Fuente (Ambas/IEM/RCE) + vadmRenderBodFem() con Promise.all
- ACTUALIZAR_TODO.bat: PASO 1C agregado entre XLSM (1B) y Ventas (2)

### descargar_bod.py
- Lee credenciales desde D:\ferreteria-oviedo\credenciales_db.ini sección [DB]
- Conecta SQL Server 200.6.118.110, base Foviedo, vía pyodbc
- Ejecuta la misma query del VBA de BOD_RCE.xlsm, parametrizada por IDBODEGA
- IEM (IDBODEGA=72): genera data/bod-iem-registros.json (19 registros)
- RCE (IDBODEGA=55): genera data/bod-rce-registros.json (12 registros)
- campo fuente='SQL Server directo' (reemplaza 'procesar_bod desde XLSM')
- Sin dependencia de openpyxl, macros ni pasos manuales

### Panel análisis bodegas — cambio selector Fuente
- Nuevo selector: id="bfFuente" (Ambas / IEM / RCE), onchange llama vadmRenderBodFem()
- vadmRenderBodFem() usa Promise.all: carga uno o ambos JSONs según fuente seleccionada
- Al seleccionar Ambas: fusiona 31 registros (19 IEM + 12 RCE), ordena diasAntiguedad DESC
- vadmFiltrarBodFem() sin cambios (opera sobre _bfDatos ya fusionados)

### REGLA SQL Server bodegas — CRÍTICA
- IDBODEGA IEM=72, RCE=55 — confirmados desde P_BODEGAS en DB viva
- credenciales_db.ini sección [DB]: NUNCA mostrar contenido, nunca subir a git
- Query = VBA extraído de BOD_RCE.xlsm, sin modificación de lógica
- Si en el futuro se agregan bodegas → añadir entrada en lista BODEGAS de descargar_bod.py

### Deploy
- Deploy: 2026-05-24 03:02 — 8 archivos nuevos subidos
- bod-rce-registros.json: primer deploy (archivo nuevo)
