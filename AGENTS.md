# AGENTS.md — Ferretería Oviedo V37
# Codex LEE ESTO ANTES de escribir cualquier línea de código.
# Última actualización: 2026-05-27 (V37.4 fix RCE)

## RUTAS CRÍTICAS — NO BUSCAR, USAR DIRECTAMENTE

```
Proyecto activo:   D:\ferreteria-oviedo\
Git sync (solo):   D:\git-sync\  (NO es el proyecto — solo copia para git. D:\ferreteria-oviedo-github NO EXISTE)
Archivados:        D:\ferreteria-oviedo\_ARCHIVADOS\  (scripts obsoletos con prefijo YYYYMMDD_)
Historico MD:      D:\ferreteria-oviedo\_HISTORICO\   (MDs anteriores archivados)
Bodegas XLSM:      D:\ferreteria-oviedo\BODEGAS\
Memory Claude:     C:\Users\Ferreteria Oviedo\.claude\projects\C--Users-Ferreteria-Oviedo\memory\
MEMORY.md index:   C:\Users\Ferreteria Oviedo\.claude\projects\C--Users-Ferreteria-Oviedo\memory\MEMORY.md
CLAUDE.md global:  C:\Users\Ferreteria Oviedo\.claude\CLAUDE.md

MD activos raiz:
  AGENTS.md:          D:\ferreteria-oviedo\AGENTS.md         (instrucciones agente + historial)
  MEMORY.md:          D:\ferreteria-oviedo\MEMORY.md         (referencia consolidada)
  ESTADO_PROYECTO.md: D:\ferreteria-oviedo\ESTADO_PROYECTO.md (snapshot estado actual)
  _HISTORICO/:        D:\ferreteria-oviedo\_HISTORICO\       (MDs anteriores — no depender de ellos)
```

---

## PROYECTO
- Stack: HTML/CSS/JS Vanilla (panel-admin.html) + Firebase Hosting (JSON estáticos) + Python pipeline ERP
- Directorio activo: D:\ferreteria-oviedo — NO trabajar en D:\ferreteria-oviedo-github
- Versión activa: V37
- Deploy V36.9k: 2026-05-26 13:47 — Fix login Google + botón ✉️ reenviar acceso + reglas Firestore notificaciones + recuperación 5 usuarios huérfanos ✅
- Deploy V37: 2026-05-26 16:58 — campana notificaciones + señales alerta + vvsstock eliminado ✅
- Deploy V37.1: 2026-05-26 17:53 — Consulta de Stock (tab + búsqueda + ficha ERP-style 8 bodegas) ✅
- Deploy V37.2: 2026-05-26 18:29 — fix ventas días incompletos + tarea auto 18:00 + ventas reparadas 22-26 mayo ✅
- Deploy V37.3: 2026-05-27 09:51 — Informe Stock Bodegas (nuevo módulo TSV + filtros + CSV + Excel) ✅
- Deploy V37.4: 2026-05-27 11:05 — fix disp CEM: ST_DISPONIBLE → ST_FISICO−ST_PEDIDO en descargar_bod.py ✅
- Deploy V37.5a: 2026-05-27 15:12 — fix diasAntiguedad RCE: GRC ausente del filtro DOC IN + dedup por codigoTecnico min(dias) ✅
- Deploy V37.5b: 2026-05-27 15:28 — auditoria DOC IN: GII+GTS agregados a whitelist + comentario clasificacion ✅
- Deploy V37.6: 2026-05-27 16:39 — fix Informe Stock Fís todo cero: pem_bod/sem_bod/cem_bod/mem_bod en pipeline + panel ✅
- Deploy V37.7: 2026-05-27 17:09 — MEM + Pedido + DifStk/DifLib + drill-down + PASO 1E descargar_pedidos.py ✅
- Deploy V37.8: 2026-05-27 23:10 — Fix pedidos-detalle + nuevo descargar_despachos.py + DifLib→Dif (22 cols) + modal Dif/Ped rediseñados ✅

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

- ventas-manzano.json → NECESARIO: main.py lo genera como salida principal (JSON_SALIDA).
  El panel lo usa como fallback en 4 puntos (líneas 4578, 6850, 6868, 7780).
  NO eliminar ni bloquear su generación. La decisión V36.9d de "eliminarlo" fue incorrecta —
  el código nunca dejó de generarlo y el panel depende de él.
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

- ventas-manzano.json → salida principal de main.py (JSON_SALIDA). NECESARIO como fallback del panel.
- ventas-manzano-2026.json → split anual generado por guardar_json() dentro de main.py
- ventas-manzano-2026-05.json → split mensual generado por guardar_json()
- descargar_erp.py descarga stock y precios — NO duplicar
- descargar_ventas_erp.py descarga ventas — NO duplicar salidas

---

## REGLA DE CIERRE DE SESIÓN — DEPLOY PENDIENTE

Antes de terminar cualquier sesión donde se hayan modificado archivos, Claude DEBE:

1. Registrar timestamp del último deploy conocido (ver sección PROYECTO → "Deploy cierre sesión")
2. Comparar mtime de archivos desplegables vs ese timestamp:
   - HTMLs: panel-admin.html, panel-cliente.html, index.html
   - JS: firebase-config.js, sw.js
   - JSONs: data/*.json
3. Si algún archivo es más nuevo → ejecutar `firebase deploy --only hosting` desde D:\ferreteria-oviedo\
4. Actualizar línea "Deploy cierre sesión" en AGENTS.md con la nueva fecha/hora
5. Ejecutar ACTUALIZAR_GITHUB.bat con descripción del cierre

Patrón de riesgo: modificación de archivo → commit github → sesión continúa → deploy se olvida.
Patrón correcto: modificar → commit github → verificar mtime → deploy si hay cambios → actualizar AGENTS.md.

### Cómo verificar en PowerShell:
```powershell
$ultimoDeploy = [datetime]"YYYY-MM-DD HH:MM:00"
Get-ChildItem 'D:\ferreteria-oviedo\' -Filter '*.html' -File |
    Where-Object { $_.LastWriteTime -gt $ultimoDeploy } | Select-Object Name, LastWriteTime
Get-ChildItem 'D:\ferreteria-oviedo\' -Filter '*.js' -File |
    Where-Object { $_.LastWriteTime -gt $ultimoDeploy } | Select-Object Name, LastWriteTime
Get-ChildItem 'D:\ferreteria-oviedo\data\' -Filter '*.json' -File |
    Where-Object { $_.LastWriteTime -gt $ultimoDeploy } | Select-Object Name, LastWriteTime
```

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

## CHANGELOG

### V37.7 — 2026-05-27

**Informe Stock Bodegas — MEM + Pedido real + drill-down + DifStk/DifLib**

Causa: módulo Informe Stock mostraba solo PEM/SEM/CEM sin visibilidad de pedidos
comprometidos ni stock MEM. Sin forma de ver qué documentos abiertos reducen
el disponible.

**Backend (V37.7):**
- `BODEGAS/descargar_pedidos.py` (NUEVO): descarga `ST_PEDIDO` de `R_STOCK_PRODUCTOS`.
  Genera `pedidos-comprometidos.json` (totales) y `pedidos-detalle.json` (documentos).

**Backend (V37.8 — fix + nuevo):**
- `BODEGAS/descargar_pedidos.py` reescrito: elimina JOIN `P_VENDEDORES` (tabla inexistente).
  Usa `CANTIDAD_PENDIENTE` (no CANTIDAD), CTE para deduplicar líneas múltiples del mismo SKU.
  DOC_TIPOS_PEDIDO corregido: NVM / VMN / VMP (solo NVs reales — VME/CVN/OVC eliminados).
  Vendedor = `M_DOCUMENTOS_ENCABEZADO.IDVENDEDOR` (string, ej: 'alexis'). Sin fallback.
  Cliente = `M_ENTIDADES.RAZON_SOCIAL` vía `ent.IDENTIDAD = CAST(enc.IDENTIDAD AS NVARCHAR(20))`.
  FECHA_ENTREGA: año ≤ 1900 → vacío. `atraso` = días desde F.Entrega hasta hoy (si vencida).
  Salida JSON nueva: tipoDoc / tipoDocLabel / numero / fechaEmision / fechaEntrega / atraso /
                     tipoOrden / cliente / rut / vendedor / cant / idDocReal / urlERP.
- `BODEGAS/descargar_despachos.py` (NUEVO): descarga BVE/FVE con `CANTIDAD_PENDIENTE > 0`.
  Genera `data/despachos-comprometidos.json` y `data/despachos-detalle.json`.
  Estructura idéntica a pedidos-detalle para reutilizar el modal del panel.
  MESES_HISTORICO = 12 meses para despachos.
- `ACTUALIZAR_TODO.bat`: PASO 1F agregado (después de 1E), llama `descargar_despachos.py`.

**Frontend (V37.7 — base):**
- Tabla: de 17 cols → 27 cols (PEM/SEM/CEM/MEM/TOTAL × Disp/Fís/Ped/DifStk/DifLib)
- DifStk = Fís − Disp. DifLib = Fís − Disp − Ped.

**Frontend (V37.8 — cambios):**
- DifLib ELIMINADO: 27 → 22 columnas (4 cols/bodega × 5 bodegas + 2 fijas)
- DifStk renombrado a Dif (fórmula: Fís − Disp, igual que antes)
- Dif = 0: verde, clic inactivo. Dif ≠ 0: naranja, clicable → modal despachos BVE/FVE.
- Modal Dif: muestra despachos-detalle.json — folio, tipo, F.Emisión, F.Entrega, badge atraso, cliente, cant.
- Modal Ped (rediseñado): usa nueva estructura pedidos-detalle — Documento/Número/F.Emisión/F.Entrega/cliente/vendedor/cant.
- `isbGenerar` carga 3 JSONs: pedidos-comprometidos + pedidos-detalle + despachos-detalle.
- Filtro "Solo negativos": antes usaba DifLib < 0, ahora usa Dif < 0 (Disp > Fís = error stock).
- Export CSV/Excel: 22 cols (DifLib eliminado de cabeceras y datos).
- Filtro "Solo negativos" ahora mira DifLib < 0 (antes miraba DifStk)
- Modal ESC + click-overlay para cerrar

**Variables JS nuevas:** `_isbPedidosComprometidos`, `_isbPedidosDetalle`
**Funciones JS nuevas:** `isbAbrirDetalle`, `isbCerrarDetalle`

**NO TOCADO:** `_vadmCargarStockMap`, módulos Quiebre, Sobrestock, BajaRot,
Análisis Bodegas (V37.5), Consulta Stock (V37.1).

### V37.6 — 2026-05-27

**Informe Stock Bodegas — fix bug "Fís todo en cero"**

Causa raíz: `normalizar_existencias()` generaba PEM_BOD/SEM_BOD/CEM_BOD desde V37.3 pero faltaban en `cols_actualizar` y `COLS_NUM` de `procesar-actualizacion.py`, así que el merge no los transfería. Además faltaba `MEM_BOD` en toda la cadena.

Archivos tocados:
- `CATALOGO PRODUCTOS/scripts/descargar_erp.py`: MEM añadido al loop St_Bod + MEM_BOD en all_cols
- `CATALOGO PRODUCTOS/scripts/procesar-actualizacion.py`: MEM_BOD en COLS_ORDEN, MAPA_HOJA2, COLS_OPCIONALES, COLS_NUMERICAS, cols_actualizar, COLS_NUM, cols_h2 (6 lugares)
- `CATALOGO PRODUCTOS/scripts/xlsx_a_csv.py`: MEM_BOD en numeric cols
- `CATALOGO PRODUCTOS/scripts/csv_a_json.py`: MEM_BOD -> mem_bod en mapa
- `panel-admin.html`: mem_bod añadido a _vadmCargarStockMap(); mem_fis:p.mem_bod añadido a _construirDatos()
- `CATALOGO PRODUCTOS/Datos.json`: regenerado (pem_bod:741 / sem_bod:2764 / cem_bod:34 / mem_bod:127)

Verificación: Datos.json tiene pem_bod>0 en 741 productos (ej. cod 10187: pem_disp=104 pem_fis=115 Dif=11) ✅
Deploy: 2026-05-27 16:39

### V37.5 — 2026-05-27

**BODEGAS/descargar_bod.py — fix diasAntiguedad RCE: GRC ausente + dedup min(dias)**

Causa raíz: `GRC` (Guía Recepción de Compra) no estaba en el filtro `DOC IN` del CTE ENTRADAS.
Para cod 15476 RCE, el único doc que pasaba el filtro era `GRT/67950/2024-03-08` (810 días).
El doc real más reciente `GRC/1056331/2026-05-25` (2 días) era invisible para la query.

**Cambios aplicados:**
- CTE ENTRADAS: `'GRC'` agregado al inicio de la lista `DOC IN`
  - Antes: `('GRT','GME','GIB','Gdc','GBR','GRP','GRI','GRN','GIN','GDC','GDV')`
  - Ahora:  `('GRC','GRT','GME','GIB','Gdc','GBR','GRP','GRI','GRN','GIN','GDC','GDV')`
- `_deduplicar_y_acumular()`: PASO 3 agregado después de la acumulación
  - La acumulación puede incluir docs viejos Y nuevos para el mismo producto
  - PASO 3 conserva solo el de menor `diasAntiguedad` (más reciente) por `codigoTecnico`
  - No-op si el producto ya tiene un solo doc (IEM/CEM no afectados)

**Verificación post-fix:**
- RCE cod 15476: `GRC/1056331/25-05-2026/Dias=2` ✅ (era 810)
- RCE AMES0096: Dias=5 ✅ (sin regresión)
- IEM: 33 registros ✅ (sin cambio)
- CEM: 35 registros ✅ (sin cambio)
- Deploy: 2026-05-27 15:12

**Auditoría DOC IN — 2026-05-27 15:28**

Query contra `M_DOCUMENTOS_DETALLE` (2025-01-01+, IDBODEGA IN 55/72/24, CANTIDAD>0)
cruzada con `M_DOCUMENTOS` (TIPOSTOCK, ESDESPACHO, ESDEVOLUCION).

Tipos candidatos encontrados fuera de la whitelist (32 tipos en total):

| Tipo | TIPOSTOCK | Decisión | Razón |
|------|-----------|----------|-------|
| GII | St_Contable | **AGREGAR** | Bodega Guia Ingreso Inventario — ajuste alza confirmado |
| GTS | St_Contable | **AGREGAR** | Guia Traslados Entre Sucursales — entrada confirmada IDSUCURSAL=04 |
| FCN | St_Contable | NO APLICA | Compra Factura — 0 registros en IDSUCURSAL=04 (sucursal=01 solo) |
| GEI | St_Contable | EXCLUIR | Bodega Guia Egreso Inventario — SALIDA |
| GST | No_Stock | EXCLUIR | Solicitud de Traslado — no afecta stock |
| NVM,CVN,BVE,VMN,FVE | St_Pedido/St_Contable | EXCLUIR | Ventas — SALIDA |
| NCE,NVC,OCN,GPF,GPE,GCE,GEE | varios | EXCLUIR | Créditos/devoluciones a proveedor o SALIDA |

Whitelist final: `'GRC','GRT','GME','GIB','Gdc','GBR','GRP','GRI','GRN','GIN','GDC','GDV','GII','GTS'`

Comentario de clasificación agregado al SQL arriba de la cláusula DOC IN.

Impacto en conteos: **0 productos cambian diasAntiguedad** (GII/GTS no son el doc más reciente para ningún producto con stock actual — futura cobertura).

Conteos antes/después: IEM=33/33 · RCE=25/25 · CEM=35/35 (sin cambio)
Deploy: 2026-05-27 15:28

**Verificación PASO 3 dedup (2026-05-27):**
- Simulado PASO1+2 sin PASO3 para RCE: 25 registros = mismos 25 que con PASO3
- Conclusión: PASO 3 es no-op para RCE en el estado actual (cada producto acumula exactamente 1 doc)
- PASO 3 está diseñado para el caso donde `fisico > cantidad_del_doc_mas_reciente` y se agregan docs más antiguos — no ocurre hoy en RCE pero puede ocurrir mañana con productos de alto stock
- Nota: la caída de RCE de 311→476 líneas SQL fue por GRC incorporado; la caída de productos 24→25 fue por un producto nuevo (GRC/1056331 ahora visible)
- El "RCE=25/35" en el resumen de chat anterior fue un typo: 35 es CEM, RCE siempre fue 25/25

### V37.2 — 2026-05-26

**descargar_ventas_erp.py — fix días incompletos (mid-day run)**

Problema: correr el pipeline a mitad del día marcaba hoy como "al día". Segunda corrida ignoraba las ventas de la tarde.

Fix en `_calcular_delta()`:
- Antes: `if max_f >= f_fin` → skip siempre
- Ahora: `if max_f >= f_fin and f_fin < hoy` → solo skip si el día ya terminó
- Si `max_f >= hoy` → `cur = hoy` (re-descarga desde hoy, dedup `(Numero,Codigo)` evita duplicados)
- Log: `"Hoy (DD/MM/YYYY) ya descargado — re-descarga por ventas nuevas del dia"`

**ACTUALIZAR_TODO_AUTO.bat — nuevo (no interactivo)**

- Sin `pause` ni `choice` — apto para Tarea Programada
- Precios: ocultos por defecto (seguro)
- Log: `logs\auto_YYYYMMDD_HH00.log`
- Mismos pasos que ACTUALIZAR_TODO: ERP → XLSM → bodegas → ventas → precios → deploy

**Tarea Programada Windows: FerreteriOviedo-Auto18**

- Ejecuta `ACTUALIZAR_TODO_AUTO.bat` todos los días a las 18:00
- `StartWhenAvailable=true` — si el equipo estaba apagado, corre al encenderse
- Primera ejecución: 27-05-2026 18:00

**Reparación ventas 22-26 mayo**

- xlsx incompletos (22-05 10:07, 23-05 12:39) eliminados
- Re-descarga completa 22-05 → 26-05: 1.451 registros nuevos, 5 dups eliminados
- 39.638 registros totales, 34.375 enriquecidos con XLSM
- Deploy: 2026-05-26 18:29

### V37.1 — 2026-05-26

**panel-admin.html — Consulta de Stock (nuevo módulo)**

- Sidebar Catálogo: botón "🔍 Consulta de Stock" → `showTab('stockconsulta')`
- `tab-stockconsulta`: buscador (código o descripción, mín 2 chars), tabla resultados (50 max, orden stock DESC), ficha detalle al hacer clic
- Ficha detalle: info producto (Cod/Desc/HiperFam/Fam/Sub/Marca) + precios (Costo/Precio c/IVA/Markup con colores) + tabla 8 bodegas (PEM/SEM/CEM/MEM/IEM/TEM/RCE/CD) con Disp/Tránsito/Físico/Valor Stock/Estado (●verde/●naranja/●gris)
- `vadmBuscarStock()`: filtra `_vadmStockMap` en memoria, sin fetch extra
- `vadmRenderStockConsulta(cod)`: render ficha, usa `data-cod` en onclick (no JSON.stringify)
- `vadmReRenderTabActivo`: stub vacío agregado para `stockconsulta`
- Fuente de datos: `_vadmStockMap` (ya cacheado en sesión, sin costo Firestore)
- CEM en selector `bfFuente` ya estaba desde V36.9k — confirmado ✅
- Deploy: 2026-05-26 17:53 — commit 30fce20

### V37 — 2026-05-26

**panel-admin.html — P-2: eliminar restos Venta vs Stock (removido V35.0)**
- `vadmRenderVvsStock()` eliminada — vsec-vvsstock no existe, no estaba en vadmReRenderTabActivo
- `_vadmHtmlEmailVvsStock()` eliminada — no referenciada en _vadmDespacharHtmlEmail
- `vvsstock` eliminado de mapas `_vadmHtmlEmailNoDisponible` y `tabLabels`

**panel-cliente.html + panel-admin.html — P-4: señales de alerta funciones críticas**
- `⚠️` agregado antes de: `doLoginGoogleCli`, `doLoginAuth`, `doRegistroCli`, `adminReenviarAcceso`
- Comentario incluye: invariantes clave, última modificación, referencia a CLAUDE.md

**Criterio código muerto revisado (aprendizaje de sesión)**
- NO eliminar funciones por ausencia de llamada directa
- Solo eliminar si la feature fue explícitamente removida del panel (changelog)
- Funciones Firestore helpers se mantienen aunque el panel llame directo — soportan el flujo

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

## FLUJO STOCK ERP — TABLA DE TIPOS DE DOCUMENTO (V37.8)

Validado desde ID_DOC_OVIEDO_EM.xlsx (2026-05-27). IDDOCUMENTOs confirmados.

| Efecto en stock        | Doc  | IDDOCUMENTO | Descripción                              |
|------------------------|------|-------------|------------------------------------------|
| ↑ Pedido (reserva)     | NVM  | 205         | Nota de Venta Mesón                      |
| ↑ Pedido (reserva)     | VMP  | 210         | Venta Mesón Público                      |
| ↑ Pedido (reserva)     | VMN  | 336         | Venta Mesón Nueva                        |
| ↓ Pedido, Fís−Disp↑    | BVE  | 316 / 605   | Boleta Venta Electrónica (despacho pend) |
| ↓ Pedido, Fís−Disp↑    | FVE  | 301         | Factura Venta Electrónica (despacho pend)|
| ↓ Físico (despacho)    | GME  | 308         | Guía de Despacho Mesón                   |
| ↓ Físico (despacho)    | GCE  | 305         | Guía de Despacho Cliente                 |
| Reversión              | GRC  | 15          | Guía Retorno Compra                      |
| Ingresos varios        | GII  | 33          | Guía Ingreso Interno                     |
| Ingreso en bodega      | GEI  | 34          | Guía Egreso/Ingreso                      |
| Traslado               | GIB  | 709         | Guía Ingreso Bodega                      |
| Traslado               | GTS  | 711         | Guía Traslado Salida                     |
| Traslado               | GST  | 702         | Guía Salida Traslado                     |
| Traslado               | Gdc  | 79          | Guía de Cargo                            |
| Nota crédito           | NCE  | 304         | Nota Crédito Electrónica                 |

**REGLA CLAVE:**
- Ped = ST_PEDIDO de R_STOCK_PRODUCTOS (fuente oficial, sin ambigüedad)
- Dif = Fís − Disp = BVE/FVE emitidos, aún sin despacho físico (GME/GCE pendiente)
- CANTIDAD_PENDIENTE > 0 en BVE/FVE = despachos no ejecutados

## TIPOS DE DOC COMPROMISO (Pedido) — V37.8 CORREGIDO

Documentos del ERP que **reservan** stock (aumentan ST_PEDIDO) sin generar salida física.
Aparecen en `data/pedidos-comprometidos.json` y `data/pedidos-detalle.json`.

**Fuente principal (totales):** `R_STOCK_PRODUCTOS.ST_PEDIDO` — campo oficial del ERP.
**Fuente de detalle:** `M_DOCUMENTOS_DETALLE.CANTIDAD_PENDIENTE > 0`, filtrado por DOC IN.

INCLUIDOS (aumentan ST_PEDIDO en R_STOCK_PRODUCTOS):
- NVM — Nota de Venta Mesón (IDDOCUMENTO=205)
- VMN — Venta Mesón Nueva (IDDOCUMENTO=336)
- VMP — Venta Mesón Público (IDDOCUMENTO=210)

ELIMINADOS DE LA LISTA (V37.8 — eran incorrectos):
- VME — no existe en ID_DOC_OVIEDO_EM.xlsx como tipo que reserva Pedido
- CVN — no confirmado
- OVC — no confirmado

EXCLUIDOS (reducen Pedido o generan salida física):
- BVE/FVE — reducen Pedido (cliente pagó) pero no Físico todavía → van a despachos
- GME/GCE — generan salida física (reducen Físico)
- NCV, NCE — notas de crédito (reversión)

REGLA: si aparece un nuevo TIPO_DOC que reserva stock sin despacho, agregarlo
a `DOC_TIPOS_PEDIDO` en `BODEGAS/descargar_pedidos.py` y documentarlo aquí.

## TIPOS DE DOC DESPACHO (Dif) — NUEVO V37.8

Documentos del ERP que **están cobrados pero pendientes de despacho físico**.
Aparecen en `data/despachos-comprometidos.json` y `data/despachos-detalle.json`.
Generados por `BODEGAS/descargar_despachos.py`.

**Fuente:** `M_DOCUMENTOS_DETALLE.CANTIDAD_PENDIENTE > 0` para BVE/FVE.
**Validación:** SUM(CANTIDAD_PENDIENTE de BVE/FVE) ≈ ST_FISICO − ST_DISPONIBLE por producto/bodega.

INCLUIDOS:
- BVE — Boleta Venta Electrónica (IDDOCUMENTO=316/605)
- FVE — Factura Venta Electrónica (IDDOCUMENTO=301)

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
   [PASO 1C] leerxlsm.py  → xlsm-enrich.json
   [PASO 1D] descargar_bod.py → bod-iem-registros.json + bod-rce-registros.json + bod-cem-registros.json
             SQL Server directo (IEM=72, RCE=55, CEM=24), sin XLSM ni macros manuales
             NOTA: El echo del bat dice "IEM y RCE" pero la lógica ya incluye CEM desde V36.9k
   [PASO 1E] descargar_pedidos.py → pedidos-comprometidos.json + pedidos-detalle.json
             Totales: R_STOCK_PRODUCTOS.ST_PEDIDO (fuente oficial — IDBODEGA lookup dinámico)
             Detalle: M_DOCUMENTOS_DETALLE.CANTIDAD_PENDIENTE > 0, tipos NVM/VMN/VMP (V37.8)
             Campos: tipoDoc, tipoDocLabel, numero, fechaEmision, fechaEntrega, atraso, cliente, rut, vendedor, cant
   [PASO 1F] descargar_despachos.py → despachos-comprometidos.json + despachos-detalle.json  (NUEVO V37.8)
             Fuente: BVE/FVE, CANTIDAD_PENDIENTE > 0 (= Fís − Disp, despachos pendientes)
             Estructura JSON idéntica a pedidos-detalle (reutiliza modal panel)
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
- ventas-manzano.json          → fallback último recurso (panel lo usa si el anual falla)
- Datos.json                   → 3.5MB en CATALOGO PRODUCTOS/, cargado una vez, cacheado
- catalogo-dinamico.json       → DOBLE ROL:
    (1) Señal Python: procesar-actualizacion.py la escribe en data/ — leída por main.py
    (2) Panel: busca en /CATALOGO%20PRODUCTOS/catalogo-dinamico.json → SIEMPRE 404 (no está ahí)
        → fallback automático a CATALOGO PRODUCTOS/Datos.json (comportamiento correcto por diseño)
    NO intentar mover catalogo-dinamico.json a CATALOGO PRODUCTOS/ — no es necesario
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

## REGLA CRITICA — subquery ULT en descargar_bod.py

El subquery ULT en `descargar_bod.py` DEBE incluir `WHERE IDBODEGA=?` antes del `GROUP BY`.
`IDDOCUMENTO` es tipo de documento (ej. GRT=17), NO un ID único de movimiento.
El JOIN debe usar `FECHA_EMISION=ULT.ULTIMA_FECHA`, NO `IDDOCUMENTO`.
NO volver a usar `MAX(IDDOCUMENTO)` como criterio de último movimiento.
Verificado 2026-05-25: código 4422 IEM pasó de 931 días a 10 días con el fix.

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
- IDBODEGA CEM=24 — confirmado desde P_BODEGAS 2026-05-25. CEM es bodega comercial, no aparece en BOD_RCE.xlsm.
- credenciales_db.ini sección [DB]: NUNCA mostrar contenido, nunca subir a git
- Query = VBA extraído de BOD_RCE.xlsm, sin modificación de lógica
- Si en el futuro se agregan bodegas → añadir entrada en lista BODEGAS de descargar_bod.py

### Deploy
- Deploy: 2026-05-24 03:02 — 8 archivos nuevos subidos
- bod-rce-registros.json: primer deploy (archivo nuevo)

## HISTORIAL V36.9h — 2026-05-24 (tab Impacto: rediseño inicial Volumen vs Precio)

### Archivos tocados
- panel-admin.html: vadmRenderImpacto reescrita desde cero

### Cambios aplicados
- Fuente migrada de ventas-xlsm-YYYY.json → _vadmLineas (ERP completo)
- Métrica Q: de contar líneas → suma(cantidad) (unidades reales)
- Nueva métrica: precio promedio = valorNeto/cantidad por vendedor y período
- Filtros: bodega y vendedor vía vadmDatosFiltrados() (primer intento — luego corregido en V36.9i)
- Título tab: "Impacto Precio: Q vs $" → "Volumen vs Precio"
- Encabezados: P1/P2 Unidades · P1/P2 Precio prom. · Var. Unidades · Var. Precio prom.
- Commits: 0ff118b

### Deploy
- Deploy: 2026-05-24 22:37 (junto con V36.9i)

## HISTORIAL V36.9i — 2026-05-24 (tab Impacto: fix vendedor + periodoSel + encabezados + reseña)

### Archivos tocados
- panel-admin.html: vadmRenderImpacto — 3 bugs corregidos + 2 mejoras

### Bugs corregidos
1. Clave agrupación: r.vendedor||'?' → r.gmailUser||r.vendedor||r.vendedorErp||'?'
   Causa: _vadmAplicarDatos renombra JSON.vendedor → objeto.gmailUser. r.vendedor era undefined → todos colapsaban en '?'
2. Filtro _vadmPeriodoSel: reemplazado vadmDatosFiltrados() por filtro manual sin _vadmPeriodoSel
   Causa: el pill de período activo bloqueaba registros de meses distintos al cargado → P1 = 0 siempre
3. Nombre display: _nombre(vk, rNom) ahora usa r.nombre del acumulador como primera opción

### Mejoras
- Encabezados completos: "Período 1 — Unidades" · "Período 2 — Precio prom." · "Variación Unidades" (con white-space:nowrap)
- Reseña dinámica: bloque azul claro con frases en lenguaje simple (5 escenarios TOTAL + 3 patrones vendedores extremos)
  Se actualiza en cada ejecución. Sin jerga: "cosas" = unidades, "plata" = monto

### Verificación
- Simulación Node: Ricardo con P1(enero)=8 uds $5.375pp / P2(mayo)=4 uds $7.000pp → ▼50% uds ▲30.2% precio ✓
- preview_eval con _vadmPeriodoSel='2026-05': datos enero NO bloqueados ✓
- 2 vendedores aparecen correctamente (antes: solo '?') ✓

### Deploy
- Commit: d003042
- Deploy: 2026-05-24 22:37 — ferreteria-oviedo.web.app

## HISTORIAL V36.9i — 2026-05-24 (fix registro y badges)

### Archivos tocados
- firestore.rules: separar create (self) de update/delete (admin) en /users/{userId}
- index.html: doRegistroVend sin pass.trim + manejo permission-denied y operation-not-allowed
- panel-cliente.html: doRegistroCli sin pass.trim + mismos mensajes de error
- index.html, panel-cliente.html, panel-admin.html: badges V36.3 21-05-2026 → V36.9i 24-05-2026

### Causa raiz del bug de registro
- firestore.rules tenia `allow write: if esAdmin()` en /users/{userId}
- El nuevo usuario (no admin) llama a db.collection('users').doc(uid).set() tras crear su cuenta Auth
- Firestore denegaba con PERMISSION_DENIED → la cuenta Auth quedaba creada pero sin doc de perfil
- El usuario no podia volver a registrarse (auth/email-already-in-use) ni ingresar (sin doc en users)

### Fix aplicado
- allow create: if request.auth.uid == userId && data.uid == userId && role in ['cliente','vendedor']
- allow update, delete: if esAdmin()
- Validacion de role impide auto-escalada a admin via registro
- Los mensajes de error en JS ahora distinguen permission-denied y operation-not-allowed

## HISTORIAL V36.9j — 2026-05-25 (fix diasAntiguedad IEM subquery WHERE IDBODEGA en ULT)

### Archivos tocados
- BODEGAS/descargar_bod.py: SQL corregido — subquery ULT ahora incluye `WHERE IDBODEGA=?` antes del `GROUP BY`, JOIN usa `FECHA_EMISION=ULT.ULTIMA_FECHA` en vez de `IDDOCUMENTO`. `cursor.execute` recibe `(idbodega, idbodega)`: primer parámetro para el WHERE en ULT, segundo para el WHERE principal.

### Problema resuelto
- IDDOCUMENTO en la tabla de movimientos es tipo de documento (ej. GRT=17), no un ID único.
- MAX(IDDOCUMENTO) devolvía el tipo de documento más alto, no el último movimiento real.
- Sin WHERE IDBODEGA=? en el subquery, ULT mezclaba movimientos de otras bodegas para el mismo artículo.
- Fix: WHERE IDBODEGA=? en subquery ULT + JOIN por FECHA_EMISION elimina la ambigüedad.

### Resultado
- Código 4422 IEM: diasAntiguedad pasó de 931 días a 10 días ✅
- RCE: no tocada (fix aplica a la lógica SQL compartida, sin regresión en RCE)

### Deploy
- 2026-05-25 fix diasAntiguedad IEM subquery WHERE IDBODEGA en ULT

## HISTORIAL V36.9k — 2026-05-25 (add bodega CEM al análisis bodegas)

### Archivos tocados
- BODEGAS/descargar_bod.py: CEM (IDBODEGA=24) agregado a lista BODEGAS → genera data/bod-cem-registros.json. Usa exacta misma lógica SQL V36.9j (WHERE IDBODEGA=? en subquery ULT, JOIN por FECHA_EMISION, cursor.execute con dos parámetros, deduplicación Python por menor diasAntiguedad).
- panel-admin.html: selector bfFuente actualizado (Ambas → Todas, + opción CEM). vadmRenderBodFem() agrega fetch bod-cem-registros.json cuando fuente==='cem'||fuente==='ambas'. Título card y botón sidebar actualizados a "IEM / RCE / CEM".
- AGENTS.md: IDBODEGA CEM=24 documentado en REGLA SQL Server bodegas. PASO 1C actualizado.

### NO TOCADO
- Lógica IEM ni RCE: sin cambios
- vadmFiltrarBodFem(): sin cambios
- SQL del script: sin cambios (solo nueva entrada en lista BODEGAS)

### IDBODEGA confirmados
- IEM=72, RCE=55, CEM=24 — todos desde P_BODEGAS DB viva
- CEM es bodega comercial (Calzada El Manzano). No aparece en BOD_RCE.xlsm (que era IEM).

### Deploy
- bod-cem-registros.json generado localmente el 2026-05-26 00:58 — PENDIENTE publicar a Firebase
- Para publicar: ejecutar PUBLICAR.bat o firebase deploy --only hosting desde D:\ferreteria-oviedo\

---

## REGLA DE LIMPIEZA — CARPETA RAÍZ

**Solo deben existir en `D:\ferreteria-oviedo\` los siguientes archivos:**

| Categoría | Archivos |
|---|---|
| HTML | panel-admin.html, panel-cliente.html, index.html |
| Firebase | firebase-config.js, firebase.json, firestore.rules, firestore.indexes.json, storage.rules, .firebaseignore, .firebaserc |
| PWA | manifest.json, manifest-cliente.json, manifest-admin.json, sw.js, update-sw-version.js |
| Assets | FONDO3.jpg, PERSONA.jpg, logo_oviedo_white.jpg, logo_oviedo.jpg |
| Credenciales | credenciales_db.ini (NUNCA a git) |
| BATs activos | ACTUALIZAR_TODO.bat, ACTUALIZAR_TODO_AUTO.bat, PUBLICAR.bat, ACTUALIZAR_GITHUB.bat |
| Scripts activos | diagnostico_huerfanos.py |
| MDs activos | AGENTS.md, MEMORY.md, ESTADO_PROYECTO.md |
| Carpetas | data/ · VENTAS EL MANZANO/ · BODEGAS/ · CATALOGO PRODUCTOS/ · backups/ · .claude/ · _HISTORICO/ · logs/ |

**REGLA:** Todo archivo que NO esté en esta lista debe moverse a `_HISTORICO/` antes de cerrar la sesión en que fue creado.
Aplica a: scripts diagnóstico, exports Excel/JSON ad-hoc, outputs debug .txt, HTMLs ERP guardados, bats de fix one-time, accesos directos .lnk, logs de sesiones anteriores.

---

## SQL SERVER — SCHEMA TABLAS VENTAS (referencia para diagnóstico directo)

Conexión: `credenciales_db.ini` sección [DB] · servidor 200.6.118.110 · base Foviedo · pyodbc

| Tabla | Columnas clave |
|---|---|
| M_DOCUMENTOS_ENCABEZADO | IDDOCUMENTO, IDSUCURSAL, NUMERO, FECHA_EMISION, IDVENDEDOR, ESTADO |
| M_DOCUMENTOS_DETALLE | IDDOCUMENTO, IDSUCURSAL, IDBODEGA, VALOR_NETO |
| P_BODEGAS | IDBODEGA, SIMBOLO_BODEGA ('PEM','SEM','CEM'...) |
| P_DOCUMENTOS | IDDOCUMENTO, DOCUMENTO (texto: 'Venta  Factura  Electronica','BOLETA ELECTRONICA') |
| R_STOCK_PRODUCTOS | IDARTICULO, IDBODEGA, IDSUCURSAL, CODIGO_TECNICO, ST_FISICO |

JOIN ventas:
```sql
M_DOCUMENTOS_DETALLE d
JOIN M_DOCUMENTOS_ENCABEZADO e ON d.IDDOCUMENTO=e.IDDOCUMENTO AND d.IDSUCURSAL=e.IDSUCURSAL
JOIN P_BODEGAS b ON d.IDBODEGA=b.IDBODEGA
JOIN P_DOCUMENTOS p ON e.IDDOCUMENTO=p.IDDOCUMENTO
WHERE e.ESTADO <> 'N'   -- excluye anulados
  AND p.DOCUMENTO IN ('Venta  Factura  Electronica','BOLETA ELECTRONICA')
```

**TRAMPA CRÍTICA:** `IDDOCUMENTO` en tablas de movimiento = tipo de documento (GRT=17, GRC=15…), NO un ID único de fila.
Para obtener el último movimiento real por bodega, usar `MAX(FECHA_EMISION)` con `WHERE IDBODEGA=?` en subquery — ver lógica en `BODEGAS/descargar_bod.py`.

Scripts de diagnóstico archivados en `_HISTORICO/` (para reutilizar si se necesitan):
- `explorar_db.py`: query ventas PEM/SEM/CEM con JOIN completo
- `ver_columnas.py`: introspección columnas C_SUCURSALES y stock por IDBODEGA

---

## TROUBLESHOOTING ENTORNO LOCAL

### Justime DLL — Error 0x80004005 (COM DllRegisterServer)
Si el cliente ERP Justime muestra popups de error al abrir:
1. Ir a `_HISTORICO\FIX_JUSTIME_DLL.bat`
2. Clic derecho → **Ejecutar como administrador**
3. El bat crea junction `C:\Program Files\Justime` y registra DLLs COM con regsvr32 de 32-bit
4. Algunos errores individuales son normales (DLLs no-COM) — el resultado importante es que Justime abra sin popups
