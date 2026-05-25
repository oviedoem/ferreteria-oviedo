# AGENTS.md — Ferretería Oviedo V36.9j
# Codex LEE ESTO ANTES de escribir cualquier línea de código.
# Última actualización: 2026-05-25

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
- Versión activa: V36.9j
- Deploy confirmado: 2026-05-25 — fix diasAntiguedad IEM subquery WHERE IDBODEGA en ULT

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
vadmRenderImpacto         Volumen vs Precio — compara dos períodos P1/P2 por vendedor (V36.9i)
                          Fuente: _vadmLineas. Clave vendedor: r.gmailUser||r.vendedorErp
                          Filtros: _vadmBodSel + _vadmVendSel + _vadmDocSel
                          NO aplica _vadmPeriodoSel (pill selector bloquearía meses distintos)
                          Métricas: suma(cantidad) + valorNeto/cantidad por vendedor
                          Genera reseña dinámica en lenguaje simple al pie de la tabla
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

## REGLA CRITICA — descargar_bod.py SQL subquery ULT

El subquery ULT DEBE incluir WHERE IDBODEGA = ? antes del GROUP BY.
Sin este filtro, MAX(IDDOCUMENTO) puede corresponder a un documento de otra bodega
(IDDOCUMENTO es tipo de documento, no ID unico de transaccion).
El JOIN con FECHA_EMISION = ULT.ULTIMA_FECHA es el metodo correcto.
NO volver a usar MAX(IDDOCUMENTO) para identificar el ultimo movimiento.
Verificado 2026-05-25: codigo 4422 IEM paso de 931 dias a 10 dias con este fix.

---

## HISTORIAL V36.9j — 2026-05-25 (fix diasAntiguedad IEM subquery bodega)

### Archivos tocados
- BODEGAS/descargar_bod.py: SQL corregido — subquery ULT ahora incluye WHERE IDBODEGA = ?
  antes del GROUP BY, y el JOIN usa FECHA_EMISION = ULT.ULTIMA_FECHA en vez de IDDOCUMENTO.
  cursor.execute recibe (idbodega, idbodega) — dos parametros para los dos ? del SQL.
  RCE no tocada — logica RCE ya funcionaba correctamente, no modificar.

### Problema resuelto
- Antes (V36.9g): MAX(IDDOCUMENTO) sin filtro de bodega en subquery ULT
  → IDDOCUMENTO es tipo de documento (ej. GRT=17), no ID unico de transaccion
  → el MAX podia corresponder a un documento de otra bodega
  → codigo 4422 IEM mostraba 931 dias (fecha 06/11/2023) siendo que el ultimo mov era 15/05/2026
- Ahora: MAX(FECHA_EMISION) filtrado por IDBODEGA = ? en el subquery
  → JOIN por fecha garantiza traer el movimiento real de IEM
  → deduplicacion Python por menor diasAntiguedad resuelve empates de misma fecha

### Verificacion
- Codigo 4422 IEM: antes 931 dias → ahora 10 dias (15/05/2026) ✅
- IEM: 19 registros (sin cambio en cantidad)
- RCE: no tocada, sigue igual ✅
- Producto mas antiguo IEM ahora: AMES0126 con 25 dias (antes habia productos con 400-900 dias falsos)

### Deploy
- Pendiente: ejecutar PUBLICAR.bat tras commit

---

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

## HISTORIAL V36.9e — 2026-05-24 (análisis bodegas IEM / RCE)

### Archivos tocados
- leer_xlsm.py: constante BOD_FEM_XLSM + función procesar_bod(path_xlsm, nombre_bod)
- panel-admin.html: sidebar grupo Análisis + tab-analisis + vadmRenderBodFem() + vadmFiltrarBodFem()
- data/bod-iem-registros.json: generado (19 registros reales IEM)
- data/bod-fem-registros.json: ELIMINADO (nombre incorrecto)

### Regla de nombre — CRÍTICA
- El archivo físico se llamaba BOD_FEM.xlsm → renombrado a BOD_RCE.xlsm el 2026-05-24
- PERO el contenido (col A) tiene bodega IEM, no RCE
- Constante en leer_xlsm.py: BOD_IEM_XLSM = BOD_RCE.xlsm (nombre físico actual)
- JSON de salida: bod-iem-registros.json (basado en contenido real, no en nombre del archivo)
- REGLA FIJA: nombre del JSON = bodega real en col A, NO nombre del archivo XLSM
- "FEM" no debe aparecer en menús, labels, JSONs ni comentarios visibles

### Deploy y commits
- a94fb5d — add procesar_bod bod_fem_xlsm
- 224764f — add analisis bodegas fem menu panel
- c26d5d3 — fix fem a iem nombre json y menu
- 4b4a369 — cierre sesion v369e docs agents claude
- d2870c2 — fix constante bod iem xlsm ruta rce
- Deploy: 2026-05-24 02:37

## HISTORIAL V36.9i — 2026-05-24 (tab Impacto: fix vendedor + periodoSel + encabezados + reseña)

### Archivos tocados
- panel-admin.html: vadmRenderImpacto — 3 bugs corregidos + 2 mejoras

### Bugs corregidos
1. Clave agrupación: r.vendedor||'?' → r.gmailUser||r.vendedor||r.vendedorErp||'?'
2. Filtro _vadmPeriodoSel: reemplazado vadmDatosFiltrados() por filtro manual sin _vadmPeriodoSel
3. Nombre display: _nombre(vk, rNom) ahora usa r.nombre del acumulador como primera opción

### Deploy
- Commit: d003042
- Deploy: 2026-05-24 22:37 — ferreteria-oviedo.web.app

## HISTORIAL V36.9b — 2026-05-23 (sector tab acordeón + NC)

vadmRenderSector — 6 cambios coordinados:
- Columnas NC y NC% eliminadas de tabla y footer
- Dropdown TIPO DOC: eliminada opción "Solo NC"
- NC excluidas siempre del cálculo: if(_esNC(r)) return false
- Columna Vis. renombrada a DESP
- Nuevo sector RETIRO CLIENTE: registros sin r.sector agrupados
- Acordeón inline: clic en fila despliega detalle (se-detail-row)

Deploy: 2026-05-23 11:00

## HISTORIAL V36.9 — 2026-05-23

vadmRenderSector migrado de ventas-xlsm-sector.json a _vadmLineas.
leer_xlsm.py — xlsm-enrich.json fix: sector normalizado, +hora, +razonSocial.
main.py — enriquecer_desde_xlsm: agrega hora y razonSocial.
Deploy: 2026-05-23.

## HISTORIAL V36.9c — 2026-05-23 (limpieza pipeline)

ARCHIVADOS: PREPARAR_Y_PUBLICAR.bat + ACTUALIZAR_AUTO.bat
csv_a_json.py: P3 (read_csv) + P4 (tem_trans al mapa)
panel-admin.html: tem_trans en _vadmCargarStockMap
ACTUALIZARTODO.bat confirmado como único punto de entrada.
Deploy: 2026-05-23.
