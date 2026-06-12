# IDS_REFERENCIA.md — Ferretería Oviedo El Manzano
# Fuente de verdad: SQL Server Foviedo + SSRS VisorRS + archivos históricos
# Verificado: 2026-06-12 | Consulta directa a BD viva
# NO editar manualmente — actualizar solo tras consulta SQL

---

## SUCURSALES — C_SUCURSALES

| IDSUCURSAL | Nombre | Relevancia proyecto |
|:---:|---|---|
| **01** | Casa Matriz | No aplica |
| **02** | Isabel Riquelme | No aplica (otro proyecto) |
| **03** | Administración Central | No aplica |
| **04** | **El Manzano** | ✅ PROYECTO ACTIVO — filtro principal en todas las queries |
| 05 | San Vicente | No aplica |
| 06 | Las Cabras | No aplica |
| 07 | Patio Constructor | No aplica |
| **08** | **Centro de Distribución** | ✅ MEM y CD (bodegas auxiliares usadas en pipeline) |
| 09 | Ventas Empresas | No aplica |
| 10 | Ventas Web | No aplica |
| 11 | Litueche | No aplica |
| 12 | Alhue | No aplica |
| 13 | Peralillo | No aplica |
| 14 | Distribucion | No aplica |
| 15 | MarketPlace | No aplica |

**Regla:** `WHERE IDSUCURSAL = '04'` en todas las queries SQL del pipeline El Manzano.
CD (23) y MEM (29) viven en SUC=08 pero se usan como auxiliares en los cálculos de stock.

---

## BODEGAS EL MANZANO — P_BODEGAS

### SUC=04 — Bodegas propias El Manzano (verificadas SQL 2026-06-12)

| IDBODEGA SQL | SIMBOLO | Nombre completo | SSRS ctl | Bloque SSRS | Clasificación | Uso en pipeline |
|:---:|:---:|---|:---:|:---:|---|---|
| **13** | **SEM** | Sala El Manzano | ctl13 | BLOQUE 1 | Comercial | ✅ ventas, stock, informe |
| **22** | **PEM** | Patio El Manzano | ctl22 | BLOQUE 2 | Comercial | ✅ ventas, stock, informe |
| **24** | **CEM** | Calzada El Manzano | ctl24 | BLOQUE 1 | Comercial | ✅ ventas, stock, informe, bod-cem-registros.json |
| **28** | **GEM** | Gestion El Manzano | ctl28 | — | Auxiliar | ❌ no usado en pipeline |
| **46** | **TEM** | Transito El Manzano | ctl44 | BLOQUE 2 | Logística | ✅ stock SSRS bloque 2 |
| **49** | **RWE** | Retiro Web El Manzano | ctl47 | — | Auxiliar | ❌ no usado en pipeline |
| **55** | **RCE** | Recepcion El Manzano | ctl52 | BLOQUE 1 | Logística | ✅ bod-rce-registros.json |
| **72** | **IEM** | Ingreso El Manzano | ctl69 | BLOQUE 2 | Logística | ✅ bod-iem-registros.json |
| **83** | **EEM** | Exhibicion El Manzano | ctl80 | — | Auxiliar | ❌ no usado (= EXH en _BOD_CORTA) |

### SUC=08 — Bodegas Centro de Distribución (verificadas SQL 2026-06-12)

| IDBODEGA SQL | SIMBOLO | Nombre completo | Uso en pipeline |
|:---:|:---:|---|---|
| 7 | XCD | CrossDock Centro Distribucion | ❌ no usado |
| 12 | FCM | Ferrocenter | ❌ no usado |
| **23** | **CD** | **Centro de Distribucion** | ✅ stock SSRS bloque 2 |
| 26 | MCD | Mermas CD | ❌ no usado |
| 27 | GCD | Gestion CD | ❌ no usado |
| **29** | **MEM** | **Mermas El Manzano** | ✅ stock SSRS bloque 1, informe |
| 54 | RCD | Recepcion Centro Distribucion | ❌ no usado |
| 67 | TCD | Transito Centro Distribucion | ❌ no usado |
| 73 | ICD | Ingreso Centro Distribucion | ❌ no usado |

### SSRS Bloques de descarga (descargar_erp.py)

| Bloque | Bodegas | Columna descargada | SSRS ctl IDs |
|---|---|---|---|
| BLOQUE 1 | SEM, CEM, RCE, MEM | Solo St_Disp | ctl13, ctl24, ctl52, ctl29 |
| BLOQUE 2 | PEM, TEM, CD, IEM | St_Disp + St_Trans | ctl22, ctl44, ctl23, ctl69 |

### ⚠️ Discrepancia IDBODEGA SQL ≠ SSRS ctl
Los IDs son sistemas distintos — NO intercambiarlos:

| Bodega | IDBODEGA SQL | SSRS ctl |
|:---:|:---:|:---:|
| SEM | 13 | 13 ✓ |
| PEM | 22 | 22 ✓ |
| CEM | 24 | 24 ✓ |
| MEM | 29 | 29 ✓ |
| GEM | 28 | 28 ✓ |
| CD | 23 | 23 ✓ |
| EEM | 83 | 80 ⚠️ |
| TEM | 46 | 44 ⚠️ |
| RWE | 49 | 47 ⚠️ |
| RCE | 55 | 52 ⚠️ |
| IEM | 72 | 69 ⚠️ |

**Regla crítica:** scripts pyodbc/SQL usan IDBODEGA. Scripts Playwright/SSRS usan ctl.

---

## BODEGAS — Mapeo nombre completo → SIMBOLO (_BOD_CORTA en leer_xlsm.py)

| Nombre completo (VENTAS.xlsm) | SIMBOLO | Usado en pipeline |
|---|:---:|---|
| Patio El Manzano | PEM | ✅ |
| Sala El Manzano | SEM | ✅ |
| Calzada El Manzano | CEM | ✅ |
| Recepcion El Manzano | RCE | ✅ |
| Mermas El Manzano | MEM | ✅ |
| Transito El Manzano | TEM | ✅ |
| Ingreso El Manzano | IEM | ✅ |
| Centro de Distribucion | CD | ✅ |
| EXH | EXH | ✅ (activa en leer_xlsm.py, sin uso en pipeline aún) |
| CAL | None | ❌ excluida (nombre antiguo de CEM) |
| SAL | None | ❌ excluida (alias obsoleto) |
| (vacío) | PEM | ⚠️ hardcode pendiente de fix |

---

## DOCUMENTOS — M_DOCUMENTOS (verificado SQL 2026-06-12)

### Grupo 1 — USADOS EN PIPELINE (whitelist bod / pedidos / despachos)

#### Entradas de stock (whitelist bod-*-registros.json)
| IDDOCUMENTO | DOC | Nombre | TIPOSTOCK | Uso |
|:---:|:---:|---|---|---|
| 15 | GRC | Compra Guia Recepcion | St_DevCom | ✅ bod whitelist |
| 16 | GRI | Compra Guia Recepcion Importacion | St_DevCom | ✅ bod whitelist |
| 17 | GRT | Bodega Guia Recepcion Traslado | St_Contable | ✅ bod whitelist |
| 33 | GII | Bodega Guia Ingreso Inventario | St_Contable | ✅ bod whitelist |
| 42 | GDF | Bodega Guia Despacho Facturas | St_DevVen | ✅ bod whitelist |
| 79 | Gdc | Bodega Guia devolucion Cliente | St_DevCom | ✅ bod whitelist (devolución → sube stock) |
| 301 | GRT (alt) | — ver 307 | — | — |
| 307 | GRT | Bodega Guia Recepcion Traslado Elect | St_Contable | ✅ bod whitelist |
| 308 | GME | GUIA ELECT DESPACHO FACTURA | St_DevVen | ✅ bod whitelist |
| 700 | GET | Guia Envio Traslado Interna | St_Contable | ✅ bod whitelist |
| 701 | GRT | Guia Recepcion Traslado | St_Contable | ✅ bod whitelist |
| 709 | GIB | Guia Ingreso Entre Bodegas | St_Contable | ✅ bod whitelist |
| 711 | GTS | Guia Traslados Entre Sucursales | St_Contable | ✅ bod whitelist |
| 712 | GRT | Bodega Guia Recepcion Traslado 2 | St_Contable | ✅ bod whitelist |
| 713 | GRT | Bodega Guia Recepcion Traslado 3 | St_Contable | ✅ bod whitelist |

#### Reservas de stock — Pedidos (descargar_pedidos.py — DOC_TIPOS_PEDIDO)
| IDDOCUMENTO | DOC | Nombre | TIPOSTOCK |
|:---:|:---:|---|---|
| 203 | NVC | Venta Nota Calzada | St_Pedido |
| **205** | **NVM** | **Venta Nota de Venta** | St_Pedido |
| 209 | MKP | Nota de Venta MarketPlace | St_Pedido |
| **210** | **VMP** | **Venta meson publico** | St_Pedido |
| 213 | NVM | Nota de Venta Mercado Libre | St_Pedido |
| 214 | NVR | Nota de Venta Ripley | St_Pedido |
| 215 | NVL | Nota de Venta Linio | St_Pedido |
| 216 | NVF | Nota de Venta Falabella | St_Pedido |
| 217 | NVW | Nota de Venta WEB | St_Pedido |
| 219 | NVC | Venta Nota BDP | St_Pedido |
| **336** | **VMN** | **Venta meson publico nueva** | St_Pedido |

> **Pipeline activo usa solo NVM(205), VMP(210), VMN(336)** — confirmado en descargar_pedidos.py

#### Despachos pendientes — Dif (descargar_despachos.py — DOC_TIPOS_DESPACHO)
| IDDOCUMENTO | DOC | Nombre | TIPOSTOCK |
|:---:|:---:|---|---|
| **301** | **FVE** | **Venta Factura Electronica** | St_Contable |
| **316** | **BVE** | **BOLETA ELECTRONICA** | St_Contable |
| **605** | **BVE** | **BOLETA ELECTRONICA WEB** | St_Contable |

> Filtro: `CANTIDAD_PENDIENTE > 0` — identifica despachos aún no ejecutados.

#### OC Pendientes (erp_oc_pendientes.py — ERP xIdDocumento)
| xIdDocumento ERP | DOC SQL | Nombre |
|:---:|:---:|---|
| **8** | OCN | Orden de Compra (todos los tipos SQL: 8,26,104,108,800,801,802,803,804) |

---

### Grupo 2 — EXCLUIDOS (no afectan stock El Manzano o son salidas)

| IDDOCUMENTO | DOC | Nombre | Razón exclusión |
|:---:|:---:|---|---|
| 34 | GEI | Bodega Guia Egreso Inventario | Salida — reduce stock |
| 702 | GST | Solicitud de Traslado | No_Stock — no afecta |
| 718 | GST | Solicitud de Traslado Vigente | No_Stock |
| 703 | CVI | Cotizacion IVA Incluido | No_Stock |
| 304 | NCE | Nota Credito Electronica | Reversión venta |
| 305 | GCE | Venta Guia Despacho Electronica | Despacho físico (reduce St_Fisico) |
| 309 | GDE | Guia despacho a proveedores elect | Devolución proveedor |
| 310 | GPE | Guia Dev Proveedor Electr no Fact | Devolución proveedor |
| 311 | GPF | Guia Dev Proveedor Electr Fact | Devolución proveedor |
| 10 | FCN | Compra Factura | 0 registros en SUC=04 (solo SUC=01) |
| 7 | CVN | Cotización | No_Stock |
| 59 | CVN | Cotización calzada | No_Stock |
| 802 | OCN | Orden Compra Integracion MTS | St_Transito (no despacho) |

---

### Grupo 3 — REFERENCIA (todos los tipos de documento SQL)

Listado completo extraído de M_DOCUMENTOS (2026-06-12). Columnas clave:
- `TIPOSTOCK`: St_Pedido / St_Contable / St_DevVen / St_DevCom / St_Transito / No_Stock / vacío
- `ESDESPACHO`: True = genera movimiento físico
- `ESDEVOLUCION`: True = es reversión/devolución

| IDDOCUMENTO | DOC | Nombre resumido | TIPOSTOCK | Desp | Dev |
|:---:|:---:|---|---|:---:|:---:|
| 1 | FCV | Venta Factura | St_Contable | | |
| 2 | BVN | Venta Boleta | St_Contable | | |
| 3 | NDV | Venta Nota Debito | St_Contable | | |
| 4 | NCV | Venta Nota Credito | St_Contable | | |
| 5 | GDV | Venta Guia Despacho | St_DevVen | ✓ | |
| 8 | OCN | Compra Orden Stock | St_Transito | | |
| 9 | OCI | Compra Orden Importacion | St_Transito | | |
| 10 | FCN | Compra Factura | St_Contable | | |
| 15 | GRC | Compra Guia Recepcion | St_DevCom | | |
| 16 | GRI | Compra Guia Rec. Importacion | St_DevCom | | |
| 17 | GRT | Bodega Guia Rec. Traslado | St_Contable | ✓ | ✓ |
| 18 | GET | Bodega Guia Envio Traslado | St_Contable | ✓ | |
| 26 | OCN | Compra Orden Calzada | St_Transito | | |
| 33 | GII | Bodega Guia Ingreso Inventario | St_Contable | | |
| 34 | GEI | Bodega Guia Egreso Inventario | St_Contable | | |
| 35 | FVE | Venta Factura Exenta | St_Contable | | |
| 42 | GDF | Bodega Guia Despacho Facturas | St_DevVen | ✓ | ✓ |
| 45 | GCS | Servicio Guia Consumo | St_DevVen | | |
| 57 | GNF | Compra Dev. no facturada | st_devCom | | ✓ |
| 58 | GDF | Compra Dev. facturada | St_Devven | | ✓ |
| 74 | GDS | Servicio Guia Devolucion | St_DevVen | | ✓ |
| 79 | Gdc | Bodega Guia devolucion Cliente | St_DevCom | | ✓ |
| 104 | OCN | Compra Orden Stock Bodega | St_Transito | | |
| 108 | OCN | Compra Orden Gastos | St_Transito | | |
| 203 | NVC | Venta Nota Calzada | St_Pedido | | |
| 205 | NVM | Venta Nota de Venta | St_Pedido | | |
| 209 | MKP | Nota de Venta MarketPlace | St_Pedido | | |
| 210 | VMP | Venta meson publico | St_Pedido | | |
| 211 | OCR | Orden de Despacho | St_Transito | | |
| 212 | ORP | Orden con Retiros Parciales | St_Transito | | |
| 213 | NVM | Nota de Venta Mercado Libre | St_Pedido | | |
| 217 | NVW | Nota de Venta WEB | St_Pedido | | |
| 301 | FVE | Venta Factura Electronica | St_Contable | | |
| 303 | NDE | Venta Nota Debito Electronica | St_Contable | | |
| 304 | NCE | Venta Nota Credito Electronica | St_Contable | | |
| 305 | GCE | Venta Guia Despacho Elect. | St_DevVen | ✓ | |
| 306 | GTE | Guia Despacho Elect. Interno | St_Contable | ✓ | |
| 307 | GRT | Bodega Guia Rec. Traslado Elect. | St_Contable | ✓ | ✓ |
| 308 | GME | Guia Elect. Despacho Factura | St_DevVen | ✓ | ✓ |
| 309 | GDE | Guia despacho proveedores elect. | St_DevVen | | ✓ |
| 310 | GPE | Guia Dev. Proveedor Elect. no Fact | st_devCom | | ✓ |
| 311 | GPF | Guia Dev. Proveedor Elect. Fact. | St_Devven | | ✓ |
| 316 | BVE | BOLETA ELECTRONICA | St_Contable | | |
| 335 | FVE | Venta Factura Exenta Elect. | St_Contable | | |
| 336 | VMN | Venta meson publico nueva | St_Pedido | | |
| 401 | FVP | Factura Electronica POS | St_Contable | | |
| 404 | GDP | Guia Despacho Factura Elect. POS | St_DevVen | ✓ | ✓ |
| 405 | BVP | BOLETA ELECTRONICA POS | St_Contable | | |
| 500 | GIK | Bodega Guia Ingreso Kit | St_Contable | | |
| 501 | GEK | Bodega Guia Egreso Kit | St_Contable | | |
| 601 | FVE | Factura Electronica WEB | St_Contable | | |
| 604 | GDP | Guia Despacho Factura Elect. WEB | St_DevVen | ✓ | ✓ |
| 605 | BVE | BOLETA ELECTRONICA WEB | St_Contable | | |
| 700 | GET | Guia Envio Traslado Interna | St_Contable | ✓ | |
| 701 | GRT | Guia Recepcion Traslado | St_Contable | ✓ | ✓ |
| 702 | GST | Solicitud de Traslado | No_Stock | ✓ | |
| 703 | CVI | Cotizacion IVA Incluido | No_Stock | | |
| 709 | GIB | Guia Ingreso Entre Bodegas | St_Contable | ✓ | |
| 710 | GEI | Guia Merma-Gestion | St_Contable | ✓ | |
| 711 | GTS | Guia Traslados Entre Sucursales | St_Contable | ✓ | |
| 712 | GRT | Bodega Guia Rec. Traslado 2 | St_Contable | ✓ | ✓ |
| 713 | GRT | Bodega Guia Rec. Traslado 3 | St_Contable | ✓ | ✓ |
| 718 | GST | Solicitud de Traslado Vigente | No_Stock | ✓ | |
| 800 | OCN | OC Integrada Vigente | St_Transito | | |
| 801 | OCN | OC Integrada Pendiente | St_Transito | | |
| 802 | OCN | OC Integracion MTS | St_Transito | | |
| 803 | OCN | OC Integracion MTS Pendiente | St_Transito | | |
| 804 | OCN | Compra Orden BPD | St_Transito | | |

---

## ACCESO RÁPIDO — IDs más usados en el código

```
# SQL BODEGAS — descargar_bod.py, descargar_pedidos.py, descargar_despachos.py
IEM  = 72    RCE  = 55    CEM  = 24
PEM  = 22    SEM  = 13    TEM  = 46
MEM  = 29    CD   = 23    GEM  = 28
RWE  = 49    EEM  = 83

# SSRS BODEGAS — descargar_erp.py (Playwright checkboxes)
IEM  = ctl69  RCE  = ctl52  CEM  = ctl24
PEM  = ctl22  SEM  = ctl13  TEM  = ctl44
MEM  = ctl29  CD   = ctl23

# SUCURSALES
El Manzano SQL  = '04'
El Manzano SSRS = value 5 (dropdown sucursal VisorRS)
CD / MEM SQL    = '08'

# DOCUMENTOS clave
NVM=205  VMP=210  VMN=336   # Pedidos (St_Pedido)
BVE=316  BVE_WEB=605        # Boletas (despacho pendiente)
FVE=301                     # Facturas (despacho pendiente)
GRC=15   GRT=17,307,701,712,713  # Recepciones
GME=308  GIB=709  GTS=711   # Traslados/despachos bodega
GII=33   Gdc=79             # Ajuste alza / Devolución cliente
OC ERP   = xIdDocumento=8   # Orden de compra (ERP ASP)
```

---

## DÓNDE USAR CADA ID

| Contexto | Usar | Archivo |
|---|---|---|
| Query SQL pyodbc `WHERE IDBODEGA=?` | IDBODEGA (22, 72, 55…) | descargar_bod.py, descargar_pedidos.py |
| Playwright SSRS checkbox bodega | ctl ID (ctl22, ctl69…) | descargar_erp.py |
| Filtro SQL sucursal | `IDSUCURSAL='04'` | todas las queries |
| ERP ASP StockCritico `?IdB=` | IDBODEGA (mismos que SQL) | erp_stock_critico.py |
| ERP ASP OC `?xIdDocumento=` | 8 | erp_oc_pendientes.py |
| Panel JS `_vadmBodSel` / `bodegaCorta` | SIMBOLO ('PEM','SEM'…) | panel-admin.html |
| leer_xlsm.py `_BOD_CORTA` | nombre completo → SIMBOLO | leer_xlsm.py |

---

*Generado 2026-06-12 — consulta SQL directa a Foviedo.dbo.P_BODEGAS, C_SUCURSALES, M_DOCUMENTOS*
*No editar manualmente. Para actualizar: re-ejecutar queries y reemplazar secciones.*
