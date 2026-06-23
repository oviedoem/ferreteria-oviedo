# MEMORY.md — Ferretería Oviedo El Manzano
# Referencia consolidada · Desde 2026-06-01
# Última actualización: 2026-06-14 · Versión activa: V37.25

---

## 1. VERSIÓN ACTIVA

| Campo | Valor |
|---|---|
| Versión | V37.25 |
| Fecha último deploy | 2026-06-13 23:04 (datos ventas con rut/sector/razón desde SQL) |
| Último cambio | V37.25: enrich ventas migrado XLSM→SQL (descargar_ventas_enrich.py), limpieza extrema a E:\_ARCHIVO_FERRETERIA, _utilidades\, DATOS ERP eliminada de GitHub |
| Pendiente | commit V37.25 + badges 3 paneles (datos ya desplegados) |

Historial reciente (desde 2026-06-01):
- V37.25 (2026-06-13/14): enrich SQL (PASO 1K), limpieza extrema, blazor recepciones/despachos
- V37.22 (2026-06-09): tab Por Recepcionar/Despachar — descargar_blazor_bodegas.py
- V37.24 (2026-06-12): bodega ICD (IDBODEGA=73) en tab Análisis de Bodegas
- V37.19-21 (2026-06-09): auditoría seguridad XSS/CSP + fixes OCR

*Historial pre-junio en _HISTORICO\20260602_MEMORY_completo.md*

*Historial pre-junio en _HISTORICO\20260602_MEMORY_completo.md*

---

## 2. URLs DE PRODUCCIÓN

| Panel | URL |
|---|---|
| Panel Vendedor | https://ferreteria-oviedo.web.app |
| Panel Cliente | https://ferreteria-oviedo.web.app/panel-cliente |
| Panel Admin | https://ferreteria-oviedo.web.app/panel-admin |
| Firebase Console | https://console.firebase.google.com/project/ferreteria-oviedo |
| APP-INVENTARIO | https://oviedoem.github.io/APP-INVENTARIO/ |

---

## 3. RUTAS CRÍTICAS LOCALES

```
Proyecto activo:     E:\ferreteria-oviedo\        (E: = particion PROYECTO_E — letra puede variar)
Git sync (solo):     E:\git-sync\                 (copia sanitizada para GitHub, NO trabajar aqui)
Historico:           E:\ferreteria-oviedo\_HISTORICO\
Utilidades equipo:   E:\ferreteria-oviedo\_utilidades\
Archivo historico:   E:\_ARCHIVO_FERRETERIA\      (FUERA del proyecto — no se sube a git/firebase)
Bodegas XLSM:        E:\ferreteria-oviedo\BODEGAS\
Pipeline ventas:     E:\ferreteria-oviedo\VENTAS EL MANZANO\
Catalogo scripts:    E:\ferreteria-oviedo\CATALOGO PRODUCTOS\scripts\
APP-INVENTARIO:      E:\APP-INVENTARIO\

Memory Claude:       CONFIG_W:\claude-config\projects\E--ferreteria-oviedo\memory\
                     (junction C:\Users\<usuario>\.claude → CONFIG_W:\claude-config\)
                     Crear/actualizar junction: CONFIG_W:\MONTAR_CLAUDE.ps1
Git config:          E:\config\gitconfig   (GIT_CONFIG_GLOBAL)
Git tokens:          E:\config\gcm-store   (DPAPI cifrado)
OCR config:          E:\config\opencodereview\config.json
                     (junction C:\Users\<usuario>\.opencodereview → E:\config\opencodereview\)

MD activos raiz:
  AGENTS.md               E:\ferreteria-oviedo\AGENTS.md
  MEMORY.md               E:\ferreteria-oviedo\MEMORY.md  (este archivo)
  MAPA_FLUJO_PROYECTOS.md E:\ferreteria-oviedo\MAPA_FLUJO_PROYECTOS.md
```

NOTA DISCOS: Las letras de particion varian segun el PC. Identificar siempre por etiqueta:
- PROYECTO_E → proyecto + config + herramientas portables
- CONFIG_W   → claude-config (memoria, settings, skills)
REGLA: Nunca trabajar en E:\git-sync\ directamente.

---

## 4. PIPELINE COMPLETO — ACTUALIZAR_TODO.bat

Único punto de entrada del pipeline. No ejecutar pasos individuales fuera de este bat.

```
PASO 1A  descargar_erp.py
         → CATALOGO PRODUCTOS\actualizar.xlsx (precios + stock SSRS 2 bloques)

PASO 1B  procesar-actualizacion.py → Datos.xlsx
         xlsx_a_csv.py → Datos.csv
         csv_a_json.py → Datos.json (~3.5MB, 6011 productos)
         CRÍTICO: procesar-actualizacion.py escribe data/catalogo-dinamico.json (señal para main.py)

PASO 1C  leer_xlsm.py (lee VENTAS EL MANZANO/RANKING.xlsm + PRECIOS.xlsm + VENTAS.xlsm)
         → ventas-xlsm-YYYY.json · ventas-xlsm-sector.json · ranking-unidades.json · precios-diff.json
         → xlsm-enrich.json (FALLBACK — el primario lo genera PASO 1K desde SQL desde V37.25)
         NOTA: NO lee BODEGAS/ — eso es exclusivo de descargar_bod.py (PASO 1D)

PASO 1D  descargar_bod.py (BODEGAS/)
         → data/bod-iem-registros.json (IEM=72)
         → data/bod-rce-registros.json (RCE=55)
         → data/bod-cem-registros.json (CEM=24)
         Si falla → continúa sin detener el pipeline

PASO 1E  descargar_pedidos.py (BODEGAS/)  [reescrito V37.8]
         Fuente comprometidos: R_STOCK_PRODUCTOS.ST_PEDIDO (oficial ERP)
         Fuente detalle: M_DOCUMENTOS_DETALLE.CANTIDAD_PENDIENTE > 0, tipos NVM/VMN/VMP
         → data/pedidos-comprometidos.json
         → data/pedidos-detalle.json

PASO 1F  descargar_despachos.py (BODEGAS/)  [V37.8]
         Fuente: BVE/FVE, CANTIDAD_PENDIENTE > 0 (= Fís − Disp)
         → data/despachos-comprometidos.json
         → data/despachos-detalle.json

PASO 1G  generar_informe_stock.py (BODEGAS/)
         Fuente: raw_bloque1/2_*.csv en CATALOGO PRODUCTOS/backups/ (escritos por descargar_erp.py)
         → data/informe-stock.json
           { cod: { pem_bod, sem_bod, cem_bod, mem_bod,
                    pem_ped, sem_ped, cem_ped, mem_ped } }
         pem_ped = St_DVen + St_Ped de TODAS las sucursales (mas completo que pedidos-comprometidos.json)
         CRITICO parseo CSV: punto=miles, coma=decimal — igual que regla SSRS en AGENTS.md
         Si no encuentra ningun CSV: sys.exit(1). BAT captura el error y continua con [AVISO].

PASO 1H  descargar_blazor_bodegas.py (BODEGAS/)  [V37.22]
         Playwright headless → Intranet JustWeb Blazor IdMenu=377 (1 sesion = 2 tabs)
         → data/recepciones-pendientes.json (GRT/GIB pendientes Editar+Grabar — anomalia JT)
         → data/despachos-pendientes-erp.json
         Reemplaza descargar_recepciones_pendientes.py + descargar_despachos_erp.py (deprecados)

PASO 1I  fusionar_despachos.py (BODEGAS/) → data/despachos-panel.json (ERP tiempo real + SQL)

PASO 1K  descargar_ventas_enrich.py (BODEGAS/)  [V37.25 — NUEVO]
         SQL: M_DOCUMENTOS_ENCABEZADO + M_ENTIDADES (RUT/razon) + Encabezado_Observacion (sector)
         Docs venta BVE/FVE/NCE suc 04, indice por NUMERO
         → data/xlsm-enrich.json (PRIMARIO — reemplaza generacion desde VENTAS.xlsm manual)
         rut 0%→100%, razonSocial 0%→100%, sector 0%→~12%
         REGLA: xlsm-enrich.json lo genera descargar_ventas_enrich.py (SQL) o leer_xlsm.py (fallback), NUNCA main.py
         (en ACTUALIZAR_TODO_AUTO.bat este paso es 1J; corre ANTES de main.py)

PASO 2   main.py --sin-deploy
         PASO 1: _catalogo_generado_hoy()? SI → leer_bodegas_desde_actualizar (3s)
                                           NO → descargar_bodegas HTTP (~70s extra)
         PASO 2: descargar_ventas_erp.py incremental (dedup por Numero+Codigo)
         PASO 3: consolidar() — JOIN catálogo + ventas + mapa_cliente
         PASO 3.5: enriquecer_desde_xlsm() — agrega rut, sector, bodegaCorta, hora, razonSocial
         PASO 4: guardar_json() → ventas-manzano*.json
         → ventas-manzano.json (FALLBACK OBLIGATORIO — 4 puntos del panel dependen de él)
         → ventas-manzano-YYYY.json (anual completo)
         → ventas-manzano-YYYY-MM.json (mensual, ~200KB)

PASO 3   Pregunta visibilidad precios (10s timeout, default N=ocultos)

PASO 4   firebase deploy --only hosting
```

SEÑAL ANTI-DOBLE-DESCARGA: `catalogo-dinamico.json` escrito por `procesar-actualizacion.py`.
`main.py` lo lee como señal. Sin señal → descarga ERP de nuevo (~70s extra). NO modificar.

---

## 5. BATS DISPONIBLES

| BAT | Función | Estado |
|---|---|---|
| ACTUALIZAR_TODO.bat | Pipeline completo — USAR ESTE | Activo |
| ACTUALIZAR_TODO_AUTO.bat | Pipeline sin interacción (ejecutar manualmente o tarea programada) | Activo V37.2 |
| PUBLICAR.bat | Solo firebase deploy | Activo |
| ACTUALIZAR_GITHUB.bat | Sync git | Activo |
| VENTAS EL MANZANO\ACTUALIZAR_VENTAS.bat | Solo ventas (llama main.py) | Activo |

BATs en _HISTORICO\ — NO ejecutar:
`20260523_PREPARAR_Y_PUBLICAR.bat` · `20260523_ACTUALIZAR_AUTO.bat` · `20260530_SUBIR_VENTAS_MANZANO.bat`

---

## 6. TAREA PROGRAMADA WINDOWS

FerreteriOviedo-Auto18 eliminada del Task Scheduler (era dependencia del registro de Windows en C:).
**Reemplazo:** ejecutar `ACTUALIZAR_TODO_AUTO.bat` manualmente o re-registrar en equipo nuevo.

---

## 7. BODEGAS EL MANZANO — IDs SQL Y CLASIFICACIÓN (verificado 2026-06-07)

### IDSUCURSAL='04' (El Manzano) — P_BODEGAS confirmado con VPN 2026-06-07
| Bodega | Nombre completo | IDBODEGA SQL | IdBodega ERP (VisorRS) |
|--------|----------------|--------------|------------------------|
| PEM | Patio El Manzano | 22 | 22 |
| SEM | Sala El Manzano | 13 | 13 |
| CEM | Calzada El Manzano | 24 | 393 |
| IEM | Ingreso El Manzano | 72 | 72 |
| RCE | Recepcion El Manzano | 55 | 55 |
| TEM | Transito El Manzano | 46 | — |
| GEM | Gestion El Manzano | 28 | — |
| RWE | Retiro Web El Manzano | 49 | — |
| EEM | Exhibicion El Manzano | 83 | — |

### IDSUCURSAL='08' (otra sucursal — usadas como auxiliares El Manzano)
| Bodega | Nombre completo | IDBODEGA SQL | IdBodega ERP (VisorRS) |
|--------|----------------|--------------|------------------------|
| MEM | Mermas El Manzano | 29 | 29 |
| CD | Centro de Distribucion | 23 | — |

**Notas clave:**
- EEM (83) = bodega Exhibicion = lo que en _BOD_CORTA se llama 'EXH'. Sin uso en pipeline aún.
- GEM (28) y RWE (49) son bodegas activas en SUC='04' no usadas en pipeline ni panel.
- CEM=24 (SQL) y CEM=393 (VisorRS) son AMBOS correctos — sistemas distintos, misma bodega.
- CAL = nombre antiguo ERP para CEM. CAL→None en _BOD_CORTA desde 2026-06-07.
- MEM y CD tienen IDSUCURSAL='08', NO '04' — pero se usan en SSRS y cálculos de informe-stock.json.
- URL_CEM=393 definida en descargar_erp.py pero sin invocación activa.

**Consistencia ERP ↔ SQL verificada 2026-06-07:**
IEM (IDBODEGA=72): 5 productos comparados entre bod-iem-registros.json y R_STOCK_PRODUCTOS → 100% coincidente.
CEM XX84502: ERP JSON=40, SQL IDBODEGA=24=40. Consistentes.

NOTA: Los scripts usan MD.DOC string ('BVE','FVE','NVM'...) — NO IDDOCUMENTO numérico.
Los IDDOCUMENTO en AGENTS.md son referencia documental, no se usan en código.
Bodegas ELIMINADAS del ERP: CAL (nombre antiguo de Calzada — reemplazado por CEM).
Alias ERP excluidos en _BOD_CORTA (leer_xlsm.py): CAL→None · SAL→None.
EXH: activa en _BOD_CORTA ('EXH') desde 2026-06-07 (= EEM IDBODEGA=83) — NO se usa aún en pipeline ni panel.

### BODSTOCK — 8 bodegas, no reducir
```javascript
var BODSTOCK = {
  PEM:'pem', SEM:'sem', CEM:'cem', RCE:'rce',
  MEM:'mem', TEM:'tem', IEM:'iem', CD:'cd'
}
```

### SSRS — bloques de descarga
- BLOQUE 1 (solo DISP): SEM, CEM, RCE, MEM
- BLOQUE 2 (DISP+TRANS): PEM, TEM, CD, IEM

---

## 7b. ARCHIVOS DE REFERENCIA — FUENTES DE VERDAD

```
E:\ferreteria-oviedo\BODEGAS\Copia de Movimiento Stock.xlsx
```

```
E:\ferreteria-oviedo\BODEGAS\Copia de Movimiento Stock.xlsx
```
Hoja activa: **FLUJO ERP** — tabla SUMA/RESTA por documento y campo de stock.
Es fuente de verdad de las tablas Flujo COMPRA/VENTA/DEVOLUCION en AGENTS.md §FLUJO ERP.
Hoja **SOLO EJEMPLO NO TOMAR EN CUENTA** → ignorar.
Usar ante cualquier duda sobre Disp/Fis/Ped/Dif o nuevo menu de stock.

```
E:\ferreteria-oviedo\_HISTORICO\ID DOC OVIEDO EM.xlsx
```
Notas de negocio por IDDOCUMENTO y DOC — quien usa cada documento, si esta activo, flujo real.
Fuente definitiva para interpretar documentos del ERP. Ver §7c para resumen.
Usar ante cualquier duda sobre un tipo de documento (activo/obsoleto, efecto en stock).

---

## 7c. TIPOS DE DOCUMENTO — verificado 2026-06-07
Fuentes: M_DOCUMENTOS (SQL) + _HISTORICO\ID DOC OVIEDO EM.xlsx (notas negocio)
Scripts filtran por MD.DOC string, NO por IDDOCUMENTO numerico.

| Doc | IDDOCUMENTO | Efecto stock | Nota clave |
|-----|-------------|-------------|------------|
| VMN | 336 | Pedido UP (Disp DN) | ACTIVO. Reemplaza VMP (210) |
| VMP | 210 | Pedido UP | SIN USO — reemplazado por VMN |
| NVM | 205/213 | Pedido UP | Nota de Venta clasica |
| BVE | 316/605 | Pedido DN + FisDip UP | Pago cliente. 605=WEB |
| FVE | 35/301/335/601 | Pedido DN + FisDisp UP | Factura. 4 variantes |
| GME | 308 | Fisico DN + Disp DN | Despacha pendientes |
| Gdc | 79 | Disp UP (espera NCE) | Devolucion cliente → espera NCE para Fisico |
| NCE | 304/603 | Fisico UP | Llama a Gdc. Suma al Fisico |
| GRC | 15/86 | Fisico UP | Llegada de proveedor |
| GRT | 17/307/701/712/713 | Fisico UP | Traslado recepcion. 17=menu antiguo |
| GIB | 709 | Fisico UP | Entre bodegas misma tienda |
| GTS | 711 | Fisico DN | Entre sucursales. Llama a GST |
| GST | 702/718 | Sin efecto | Solo solicitud. NO mueve stock |
| GII | 33/606 | Fisico+Disp UP | Ingresa directo |
| GEI | 34/710 | Fisico+Disp DN | 710=Merma-Gestion (bodega GEM) |

Pipeline pedidos: NVM/VMN/VMP | Pipeline despachos: BVE/FVE
GBR/GIN/GRN/GRP: en whitelist descargar_bod.py pero NO existen en M_DOCUMENTOS

---

## 8. CONEXIÓN SQL SERVER

| Campo | Valor |
|---|---|
| IP | [SQL-SERVER-IP] |
| Base de datos | Foviedo |
| Driver | pyodbc |
| Credenciales | E:\ferreteria-oviedo\credenciales_db.ini sección [DB] |

NUNCA mostrar contenido de credenciales_db.ini. NUNCA subir a git.

REGLA CRÍTICA subquery ULT:
- `WHERE IDBODEGA=?` ANTES del `GROUP BY`
- JOIN usa `FECHA_EMISION=ULT.ULTIMA_FECHA`, NO `IDDOCUMENTO`
- `IDDOCUMENTO` = tipo de documento (GRT=17), no ID único de movimiento

---

## 9. SCRIPTS PYTHON — QUÉ HACE CADA UNO

| Script | Ubicación | Genera | Notas |
|---|---|---|---|
| descargar_erp.py | CATALOGO PRODUCTOS\scripts\ | actualizar.xlsx | SSRS 2 bloques; precios VisorRS |
| procesar-actualizacion.py | CATALOGO PRODUCTOS\scripts\ | Datos.xlsx + catalogo-dinamico.json | catalogo-dinamico.json = señal main.py |
| xlsx_a_csv.py | CATALOGO PRODUCTOS\scripts\ | Datos.csv | Lee Datos.xlsx |
| csv_a_json.py | CATALOGO PRODUCTOS\scripts\ | Datos.json | Lee Datos.csv |
| actualizar_config_precios.py | CATALOGO PRODUCTOS\scripts\ | — | Visibilidad precios en Firestore |
| leer_xlsm.py | VENTAS EL MANZANO\ | xlsm-enrich.json | Join por numero; bodegaCorta real desde XLSM |
| descargar_bod.py | BODEGAS\ | bod-iem/rce/cem-registros.json | SQL Server directo |
| descargar_pedidos.py | BODEGAS\ | pedidos-comprometidos.json + pedidos-detalle.json | R_STOCK_PRODUCTOS.ST_PEDIDO |
| descargar_despachos.py | BODEGAS\ | despachos-comprometidos.json + despachos-detalle.json | BVE/FVE pendientes |
| generar_informe_stock.py | BODEGAS\ | data/informe-stock.json | Stock fisico + comprometido todas sucursales. Fuente: raw_bloque1/2_*.csv (backups/). pem/sem/cem/mem_bod + _ped |
| main.py | VENTAS EL MANZANO\ | ventas-manzano*.json | Pipeline ventas completo |
| descargar_ventas_erp.py | VENTAS EL MANZANO\ | ventas_erp_producto_YYYYMMDD.xlsx | Incremental; dedup por (Numero, Codigo) |
| descargar_ventas_enrich.py | BODEGAS\ | xlsm-enrich.json | **V37.25** SQL: rut/sector/razon desde M_ENTIDADES+Observacion (BVE/FVE/NCE) |
| descargar_blazor_bodegas.py | BODEGAS\ | recepciones-pendientes.json + despachos-pendientes-erp.json | Playwright Intranet IdMenu=377 |
| fusionar_despachos.py | BODEGAS\ | despachos-panel.json | Fusiona despachos ERP + SQL |
| encriptar_credenciales.py | _utilidades\ | credenciales_db.enc | Utilidad seguridad (no es pipeline; movido V37.25) |

---

## 10. JSONs EN data/ — FUENTE Y ROL

| Archivo | Fuente | Tamaño | Rol |
|---|---|---|---|
| Datos.json | csv_a_json.py | ~3.5MB | Catálogo productos — cargado una vez, cacheado en sesión JS |
| catalogo-dinamico.json | procesar-actualizacion.py | ~350KB | Señal Python (mtime) + fallback panel (siempre 404 → usa Datos.json) |
| ventas-manzano.json | main.py | variable | FALLBACK OBLIGATORIO — 4 puntos del panel dependen de él. NO eliminar |
| ventas-manzano-YYYY.json | main.py | 2-18MB | Anual completo |
| ventas-manzano-YYYY-MM.json | main.py | ~200KB | Mensual — carga por defecto |
| bod-iem-registros.json | descargar_bod.py | pequeño | ~19 registros IEM |
| bod-rce-registros.json | descargar_bod.py | pequeño | ~10 registros RCE |
| bod-cem-registros.json | descargar_bod.py | pequeño | registros CEM |
| pedidos-comprometidos.json | descargar_pedidos.py | pequeño | Totales por bodega |
| pedidos-detalle.json | descargar_pedidos.py | variable | Documentos de pedido con detalle |
| despachos-comprometidos.json | descargar_despachos.py | pequeño | Totales BVE/FVE pendientes |
| despachos-detalle.json | descargar_despachos.py | variable | Documentos BVE/FVE con detalle |
| xlsm-enrich.json | leer_xlsm.py | variable | Enriquecimiento ventas (rut, sector, hora, razonSocial) |

DOBLE ROL de catalogo-dinamico.json:
1. Python: procesar-actualizacion.py lo escribe → main.py lee su mtime como señal
2. Panel: busca en /CATALOGO%20PRODUCTOS/catalogo-dinamico.json → siempre 404 → fallback a Datos.json
NO mover catalogo-dinamico.json a CATALOGO PRODUCTOS/ — el 404 es comportamiento correcto.

---

## 11. VARIABLES JS GLOBALES CLAVE — no renombrar

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

## 12. FUNCIONES JS CLAVE — no renombrar ni cambiar firma

```
vadmCargarLineas()           Carga ventas JSON según _vadmAnioSel
_vadmCargarStockMap(cb)      Carga Datos.json → _vadmStockMap; cachea — NO llamar si ya existe
vadmRenderSobreStock()       Render sobre-stock, cobertura en meses
vadmSSMarcaClick(el)         Toggle filtro marca — usa data-marca, NUNCA string en onclick
vadmRenderBajaRot()          Render baja rotación + auto-reload si rango > datos cargados
vadmFiltrarBajaRot()         Re-filtra _vadmBRDatos sin recomputar ABC
vadmRenderQuiebre()          Render stock quiebre con ABC + Rot.30/60/90d
vadmRenderImpacto()          Volumen vs Precio: Q y precio prom por vendedor en 2 períodos
vadmRenderNC()               NC por vendedor desde _vadmLineas
vadmBuscarStock()            Filtra _vadmStockMap en memoria para Consulta de Stock
vadmRenderStockConsulta(cod) Ficha detalle de un producto (8 bodegas)
venAdmParseFecha(s)          Parsea fecha DD/MM/YYYY → timestamp ms — NO cambiar firma
venAdmFmt(n)                 Formatea número como X.XXX CLP — NO cambiar firma
vadmDatosFiltrados()         Filtrado central — todas las funciones render deben usarla
```

---

## 13. ARCHIVOS ABSOLUTAMENTE INTOCABLES

| Archivo | Motivo |
|---|---|
| firebase-config.js | Configuración SDK Firebase compartida — no modificar nunca desde panel HTML |
| credenciales_erp.ini | En VENTAS EL MANZANO\ y CATALOGO PRODUCTOS\scripts\ — nunca subir a git |
| credenciales_db.ini | Credenciales SQL Server — nunca tocar, nunca subir |
| venAdmParseFecha() | Utility global — no cambiar firma ni comportamiento |
| venAdmFmt() | Utility global — no cambiar firma |
| window._mostrarPrecio | Default SIEMPRE false en panel-cliente.html |
| xlsm-enrich.json | Lo genera descargar_ventas_enrich.py (SQL, primario, V37.25) o leer_xlsm.py (fallback) — NUNCA main.py |
| ventas-manzano.json | Fallback del panel en 4 puntos — NO eliminar |
| _catalogo_generado_hoy() | No revertir a _actualizar_xlsx_es_hoy() (eliminada V36.5) |

---

## 14. MAPA DE DEPENDENCIAS CRÍTICAS

| Si tocas... | Debes verificar también... |
|---|---|
| vadmSubTab(id) | Que id esté en vadmReRenderTabActivo |
| vadmRenderSobreStock() | _vadmSSProds — lo usan email, Excel y Outlook |
| vadmRenderBajaRot() | _vadmBRDatos + _vadmLineas cubre el rango de fechas |
| vadmRenderQuiebre() | _vadmStockMap debe estar cargado |
| _vadmCargarStockMap() | Cacheada en sesión — NO llamar si ya existe con datos |
| vadmSSMarcaClick(el) | Usa data-marca del HTML — NUNCA string en onclick |
| Sidebar HTML | Verificar que grupos siguen colapsando correctamente |
| onclick="" en botones | NUNCA usar JSON.stringify — rompe con comillas en nombres |
| descargar_ventas_enrich.py | Genera xlsm-enrich.json desde SQL (primario). Correr ANTES de main.py |
| leer_xlsm.py | Genera ventas-xlsm/ranking/precios; su xlsm-enrich es fallback si SQL falla |
| enriquecer_desde_xlsm() | Debe correr DESPUÉS de consolidar() y ANTES de guardar_json() |
| _catalogo_generado_hoy() | Verifica catalogo-dinamico.json mtime — no revertir |
| descargar_bod.py | Subquery ULT con WHERE IDBODEGA=? antes del GROUP BY |

---

## 15. TABS VERIFICADOS DEL PANEL-ADMIN

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

## 16. SEGURIDAD FIREBASE

### Reglas Firestore (resumen)
| Colección | Admin | Cooperador | Vendedor | Cliente | Sin auth |
|---|---|---|---|---|---|
| users (read) | SI | lista | propio | propio | NO |
| users (write) | SI | NO | propio* | propio* | NO |
| config (read) | SI | SI | SI | SI | sessionConfig |
| config (write) | SI | NO | NO | NO | NO |
| cotizaciones | SI | read | read+write | read+write | NO |
| auditLog (read) | SI | NO | NO | NO | NO |
| notificaciones | SI | SI | SI | SI (autenticados) | NO |

### Device Binding (autenticación admin)
- Cada navegador genera ID único en localStorage (clave: ov_device_id)
- Lista autorizada: config/adminDispositivos.lista en Firestore
- Administrar: Panel Admin → URL / Conexión → Dispositivos autorizados

### Hosting ignore — bloqueados
`VENTAS EL MANZANO/` · `backups/` · `.claude/` · `*.ini` · `*.xlsm` · `*.mp4`

---

## 17. REGLAS DEL PROYECTO — NO NEGOCIABLES

- Cambios mínimos — no refactorizar, no agregar abstracciones
- Sin dependencias externas sin autorización
- Sin renombrar funciones públicas
- Python: sin tildes, sin emojis, solo ASCII cp1252
- BATs: guardar en ANSI cp1252
- Costo cero — plan Spark gratuito Firebase
- Un prompt = una función tocada
- Datos reales siempre — nunca hardcode de valores ni datos de ejemplo
- No pedir confirmación antes de ejecutar si el usuario dijo "ejecuta"
- No usar cmd /c bat > NUL desde bash → usar PowerShell

---

## 18. FLUJO LOGIN — INVARIANTES V36.9k

| Situación | Comportamiento correcto |
|---|---|
| Usuario Google nuevo (!snap.exists) | Crear doc /users con creadoPor:'google' — NUNCA signOut sin crear |
| Usuario pendiente (registroAprobado=false) | code:'pendiente' — NUNCA code:'noregistrado' |
| Registro deshabilitado | Bloquear, code:'noregistrado' — único caso válido |
| Usuario bloqueado | signOut + mensaje claro |

---

## 19. CHECKLIST POST-CAMBIO

```
[ ] Función modificada recibe los mismos parámetros de entrada
[ ] Variables globales que usaba siguen existiendo con el mismo nombre
[ ] El tab que la invoca sigue en vadmReRenderTabActivo
[ ] Filtro _vadmBodSel sigue afectando el resultado (stock Y ventas)
[ ] No se hardcodeó ningún valor que debe venir de datos reales
[ ] No se renombró ninguna función pública
[ ] window._mostrarPrecio = false sigue siendo default en panel-cliente.html
[ ] xlsm-enrich.json sigue siendo generado por leer_xlsm.py (no main.py)
[ ] _catalogo_generado_hoy() no fue revertida
[ ] ventas-manzano.json sigue siendo generado por guardar_json() en main.py
[ ] Subquery ULT en descargar_bod.py tiene WHERE IDBODEGA=? antes del GROUP BY
[ ] Deploy ejecutado y "Deploy cierre sesión" en AGENTS.md actualizado
[ ] ACTUALIZAR_GITHUB.bat ejecutado con descripción del cambio
```

---

## 20. CÁLCULOS — METODOLOGÍA (referencia rápida)

### Velocidad de venta
```
velocidad_dh = unidades_vendidas_periodo / dias_habiles_periodo
cobertura_dh = stock_actual / velocidad_dh
```
Días hábiles = Lun-Sab que NO sean feriados chilenos. `_vadmDiasHabiles()` nunca retorna 0.

### ABC Pareto
A: top 80% valor ventas · B: 81-95% · C: 96-100% · D: sin ventas

### Sobre-stock (cobertura en meses)
```
velMes = qty_vendida_periodo / nMeses_cargados
cobMeses = stock / velMes   (si velMes=0 → cobMeses=999 = Sin venta)
```
Colores: rojo=999 · naranja>=24m · amarillo>=12m.

---

*MEMORY.md consolidado 2026-06-05*
*Historial completo pre-junio: _HISTORICO\20260602_MEMORY_completo.md*
*Para actualizar: editar directamente este archivo al cierre de cada sesión.*
