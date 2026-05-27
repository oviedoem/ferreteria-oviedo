# App Oviedo El Manzano — Estado del proyecto V33.6
# Fecha: 18-05-2026

> Punto de restauración oficial V33.6
> Todo lo que está aquí está APLICADO y en producción

---

## URLs producción

| Panel | URL |
|-------|-----|
| Cliente | https://ferreteria-oviedo.web.app/panel-cliente |
| Vendedor | https://ferreteria-oviedo.web.app/vendedor |
| Admin | https://ferreteria-oviedo.web.app/panel-admin |

---

## Archivos del proyecto

| Archivo | Ruta | Tamaño |
|---------|------|--------|
| panel-admin.html | D:\ferreteria-oviedo\ | ~824KB |
| panel-cliente.html | D:\ferreteria-oviedo\ | ~172KB |
| index.html | D:\ferreteria-oviedo\ | ~83KB |
| descargar_erp.py | D:\ferreteria-oviedo\CATALOGO PRODUCTOS\scripts\ | 24KB |
| procesar-actualizacion.py | D:\ferreteria-oviedo\CATALOGO PRODUCTOS\scripts\ | 20KB |
| subir_ventas.py | D:\ferreteria-oviedo\CATALOGO PRODUCTOS\scripts\ | 20KB |
| csv_a_json.py | D:\ferreteria-oviedo\CATALOGO PRODUCTOS\scripts\ | 4KB |
| xlsx_a_csv.py | D:\ferreteria-oviedo\CATALOGO PRODUCTOS\scripts\ | 4KB |
| leer_xlsm.py | D:\ferreteria-oviedo\CATALOGO PRODUCTOS\scripts\ | nuevo V33.5 |
| descargar_ventas_erp.py | D:\ferreteria-oviedo\VENTAS EL MANZANO\ | pipeline ventas |

---

## Pipeline de actualización (ACTUALIZAR_TODO.bat)

```
Paso 1 — Precio + Stock ERP
  descargar_erp.py → actualizar.xlsx
  procesar-actualizacion.py → Datos.xlsx + merma.json + catalogo-dinamico.json
  xlsx_a_csv.py → Datos.csv
  csv_a_json.py → Datos.json

Paso 2 — Ventas ERP
  descargar_ventas_erp.py → ventas-manzano-YYYY.json (por año)
                           → ventas-manzano-YYYY-MM.json (por mes)
                           → ventas-manzano-meta.json
                           → ventas-manzano.json (año actual, compatibilidad)

Paso 2C — XLSM Servidor 2 (datos de ayer)
  leer_xlsm.py → ventas-xlsm-YYYY.json
               → ventas-xlsm-sector.json
               → ranking-unidades.json
               → precios-diff.json

Paso 3 — Visibilidad precios (S/N/E, auto E en 30s)

Paso 4 — Deploy Firebase Hosting
```

---

## Tarea programada Windows

| Campo | Valor |
|-------|-------|
| Nombre | Ferreteria Oviedo Ventas 7PM |
| Horario | Daily 19:00 |
| Ejecuta | cmd.exe /c "D:\ferreteria-oviedo\ACTUALIZAR_TODO.bat" |
| Estado | Ready ✅ |

---

## JSONs en data\

| Archivo | Fuente | Tamaño aprox |
|---------|--------|-------------|
| ventas-manzano-YYYY.json | ERP por año | ~16MB |
| ventas-manzano-YYYY-MM.json | ERP por mes | ~2MB |
| ventas-manzano-meta.json | índice años | <1KB |
| ventas-manzano.json | año actual (compatibilidad) | ~18MB |
| ventas-xlsm-YYYY.json | VENTAS.xlsm | ~9MB |
| ventas-xlsm-sector.json | VENTAS.xlsm OBS_IMP | ~600KB |
| ranking-unidades.json | RANKING.xlsm | ~1MB |
| precios-diff.json | PRECIOS.xlsm diff | ~1KB |
| Datos.json | ERP catálogo | ~3.5MB |
| catalogo-dinamico.json | ERP solo stock+precio | ~350KB |
| merma.json | ERP liquidación | — |

---

## Cambios aplicados en panel-admin.html V33.6

| # | Cambio | Función | Estado |
|---|--------|---------|--------|
| 1 | MAX_ROWS=150 en baja rotación | _vadmRenderBajaRotTabla | ✅ |
| 2 | setTimeout en renders pesados | vadmReRenderTabActivo | ✅ |
| 3 | Cache fetch 1h Math.floor(Date.now()/3600000) | vadmRenderBajaRot | ✅ |
| 4 | Excluir NCs del ventaMap | vadmRenderBajaRot | ✅ |
| 5 | bodegaCorta fallback | vadmRenderBajaRot | ✅ |
| 6 | Toast quiebres Cat A+B con autoclose | vadmQuiebresCheck | ✅ |
| 7 | Badge vadmFechaActualizacion | vadmCargarLineas | ✅ |
| 8 | Split ventas por año/mes | vadmCargarLineas | ✅ |
| 9 | Selector año + carga mes actual por defecto | vadmAnioSelector | ✅ |
| 10 | sessionStorage guard con validación año | vadmCargarLineas | ✅ |
| 11 | URLs catalogo-dinamico primero | _vadmCargarStockMap | ✅ |
| 12 | Campo mem en stockMap + BOD_STOCK corregido | _procesarDatos | ✅ |
| 13 | 6 nuevos tabs XLSM | vadmSubTab | ✅ |
| 14 | sobrestock/transito/merma/entrefechas en ReRender | vadmReRenderTabActivo | ✅ V33.6 |
| 15 | Fix permisos admin _esAdmin | _coopGuard / interceptor | ✅ |
| 16 | Fix dropdown vendedores gmailUser | vadmVendBuildCheckList | ✅ |

---

## Cambios aplicados en panel-cliente.html

| # | Cambio | Función | Estado |
|---|--------|---------|--------|
| T1 | _mostrarPrecio=false default+catch | _cargarConfigPrecios | ✅ |
| T2 | btnWaCot visible siempre post-PDF | generarPDF | ✅ intencional |
| T3 | _sanitizarCotizInput 5 campos | generarPDF | ✅ |
| T4 | Rate limiting login 5 intentos/10min | doLoginCli | ✅ |
| T5 | carrito.slice(0,100) | registrarCotizacionResumen | ✅ |

---

## Regla crítica de precios

```
window._mostrarPrecio = false  ← DEFAULT SIEMPRE
```
Solo true si admin activa mostrarPrecioCliente:true en Firestore config/precios.
Si Firestore falla → false. Si campo no existe → false.

---

## Vendedores ERP_TO_GMAIL_USER

| ERP | Gmail |
|-----|-------|
| greyes | gregorioreyessalazar5 |
| jsubiabre | jaimesubiabre33 |
| rflores | rafaelaoviedo1983 |
| rvidal | ricpobletev |
| agonzalez | alejandrog45 |

---

## IDs bodega El Manzano

| Bodega | ID |
|--------|-----|
| Patio El Manzano (PEM) | 22 |
| Sala El Manzano (SEM) | 13 |
| Ingreso El Manzano (IEM) | 72 |
| Transito El Manzano (TEM) | 46 |
| Recepcion El Manzano (RCE) | 55 |
| Centro Distribucion (CD) | 23 |
| Mermas El Manzano (MEM) | 29 |

---

## Seguridad Firebase

| Archivo | Estado |
|---------|--------|
| firebase.json ignore | ✅ excluye *.ini, VENTAS EL MANZANO/**, backups/**, FLUJOS .MD/**, etc. |
| .firebaseignore | ✅ excluye .claude/, credenciales*, SEGURIDAD_CREDENCIALES* |
| firestore.rules | ✅ endurecidas V33.1 |
| firebase-config.js | ✅ API key pública por diseño (seguridad real en Firestore Rules) |

---

## GitHub

| Item | Valor |
|------|-------|
| Repo | https://github.com/oviedoem/ferreteria-oviedo |
| Visibilidad | Público |
| Script actualización | D:\ferreteria-oviedo\ACTUALIZAR_GITHUB.bat |
| Excluidos | *.ini, *.env, *.bat, *.py, data/*.json, VENTAS EL MANZANO/, backups/ |

---

## Tabs panel-admin verificados V33.6

| Tab | Función render | En vadmSubTab | En vadmReRenderTabActivo |
|-----|---------------|---------------|--------------------------|
| hora | vadmRenderHora | ✅ | ✅ |
| top | vadmRenderTop | ✅ | ✅ |
| marcas | vadmRenderMarcas | ✅ | ✅ |
| comparativa | vadmRenderComparativa | ✅ | ✅ |
| vendrank | vadmRenderVendRank | ✅ | ✅ |
| marcavend | vadmRenderMarcaVend | ✅ | ✅ |
| clientes | vadmRenderClientes | ✅ | ✅ |
| tipodoc | vadmRenderTipoDoc | ✅ | ✅ |
| facturacion | vadmRenderFacturacion | ✅ | ✅ |
| quiebre | vadmRenderQuiebre | ✅ | ✅ |
| sobrestock | vadmRenderSobreStock | ✅ | ✅ V33.6 |
| transito | vadmRenderTransito | ✅ | ✅ V33.6 |
| merma | vadmRenderMerma | ✅ | ✅ V33.6 |
| entrefechas | vadmRenderEntrefechas | ✅ | ✅ V33.6 |
| rankingmarca | vadmRenderRankingMarca | ✅ | ✅ |
| estaciones | vadmRenderEstaciones | ✅ | ✅ |
| vvsstock | vadmRenderVvsStock | ✅ | ✅ |
| bajrot | vadmRenderBajaRot | ✅ | ✅ |
| pagoanalisis | vadmRenderPagoAnalisis | ✅ | ✅ |
| pagorankings | vadmRenderPagoRankings | ✅ | ✅ |
| pagotemporal | vadmRenderPagoTemporal | ✅ | ✅ |
| arbol | vadmIniciarArbol | ✅ | ✅ |
| arboltabla | vadmRenderArbolTabla | ✅ | ✅ |
| arbolheat | vadmRenderArbolHeat | ✅ | ✅ |
| sector | vadmRenderSector | ✅ | ✅ |
| impacto | vadmRenderImpacto | ✅ | ✅ stub |
| nc | vadmRenderNC | ✅ | ✅ |
| marcavend2 | vadmRenderMarcaVend2 | ✅ | ✅ stub |
| preciodiff | vadmRenderPrecioDiff | ✅ | ✅ |
| mem | vadmRenderMEM | ✅ | ✅ |

---

## Reglas del proyecto (no negociables)

- Cambios minimos — no refactorizar
- No agregar dependencias externas
- No renombrar funciones publicas
- Python log(): sin tildes, sin emojis, solo ASCII (cp1252)
- bat: guardar ANSI cp1252
- panel-cliente.html: precio SIEMPRE oculto por defecto
- index.html = panel vendedor / panel-cliente.html = panel cliente
- Claude define arquitectura / Codex implementa exactamente
- Costo cero — todo en plan Spark gratuito
- JSON estático en Hosting >> Firestore
