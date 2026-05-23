# AGENTS.md — Ferretería Oviedo V36.8
# Codex LEE ESTO ANTES de escribir cualquier línea de código.
# Última actualización: 2026-05-22

## RUTAS CRÍTICAS — NO BUSCAR, USAR DIRECTAMENTE

```
Proyecto activo:   D:\ferreteria-oviedo\
GitHub (solo sync):D:\ferreteria-oviedo-github\
Memory Claude:     C:\Users\Ferreteria Oviedo\.claude\projects\C--Users-Ferreteria-Oviedo\memory\
MEMORY.md index:   C:\Users\Ferreteria Oviedo\.claude\projects\C--Users-Ferreteria-Oviedo\memory\MEMORY.md
CLAUDE.md global:  C:\Users\Ferreteria Oviedo\.claude\CLAUDE.md
```

---

## PROYECTO
- Stack: HTML/CSS/JS Vanilla (panel-admin.html) + Firebase Hosting (JSON estáticos) + Python pipeline ERP
- Directorio activo: D:\ferreteria-oviedo — NO trabajar en D:\ferreteria-oviedo-github
- Versión activa: V36.8
- Deploy confirmado: 2026-05-22 18:23 — 174 archivos

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

## REGLA COMMIT OBLIGATORIO

Al terminar CUALQUIER modificación de código, ejecutar SIN EXCEPCIÓN:

  powershell -Command "cd D:\ferreteria-oviedo-github; git add .; git commit -m 'V36 <desc>'; git push"

- Si el bat pide descripción: 4 palabras en minúsculas, sin tildes.
  Ejemplo: fix bodega dropdown panel
- No preguntar al usuario. No esperar confirmación.
- Ejecutar siempre como último paso.
- Si falla: reportar el error pero NO omitir el intento.

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
5. main.py --sin-deploy
   PASO 1: catalogogeneradohoy? SI/NO
   PASO 2: descargarventaserp.py incremental
   PASO 3: consolidar JOIN catálogo + ventas + mapacliente
   PASO 3.5: enriquecerdesdexlsm → rut, sector, bodegaCorta
   PASO 4: guardarjson ventas-manzano-*.json
6. Pregunta visibilidad precios (30 seg timeout, default N=ocultos)
7. firebase deploy

BATs disponibles:
- ACTUALIZARTODO.bat  → pipeline completo
- PUBLICAR.bat        → solo firebase deploy
- ACTUALIZARGITHUB.bat → sync github
- ACTUALIZARVENTAS.bat → solo ventas (llama main.py)

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
XLSM: sector nc marcavend2 preciodiff mem
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
