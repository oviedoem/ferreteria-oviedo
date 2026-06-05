# AGENTS.md — Ferretería Oviedo El Manzano
# Instrucciones del agente + Safe-Change Skill + Historial desde 2026-06-01
# Versión activa: V37.14 · Última actualización: 2026-06-05

---

## ⚠️ FLUJO ERP — LEER ANTES DE CUALQUIER TAREA DE STOCK
## Palabra clave: **FLUJO** — ante cualquier duda sobre Disp/Fís/Ped/Dif → volver aquí primero

### Campos SSRS → Panel Admin

| Campo SSRS (raw CSV) | Panel | Descripción |
|---|---|---|
| `St_Disp` | Disp | Stock disponible neto (Fís − compromisos) |
| `St_Bod` | Fís | Stock físico real en bodega |
| `St_DVen + St_Ped` | Ped | Comprometido total (despachos + NVMs de todas las sucursales) |
| `St_Tran` | Trans | En tránsito entre bodegas |
| `St_Cont` | — | Contable (no usado en panel comercial) |
| `St_DCom` | — | Comprometido en órdenes de compra pendientes |

**Ped en panel = St_DVen + St_Ped**
**Dif en panel = Fís − Disp** → positivo = compromiso normal · negativo (rojo) = anomalía JT

### Flujo COMPRA
| Documento | St_Disp | St_Cont | St_DVen | St_DCom | St_Bod | St_Tran | St_Ped |
|---|---|---|---|---|---|---|---|
| OC (Orden de Compra) | = | = | = | +1 | = | +1 | = |
| GRC (Guía Recepción Compra) | +1 | = | = | = | +1 | −1 | = |
| FCN (Factura Compra) | = | +1 | = | −1 | = | = | = |
| **Neto ciclo completo** | +1 | +1 | 0 | 0 | +1 | 0 | 0 |

### Flujo VENTA / DESPACHO
| Documento | St_Disp | St_Cont | St_DVen | St_DCom | St_Bod | St_Tran | St_Ped |
|---|---|---|---|---|---|---|---|
| NVM (Nota de Venta) | −1 | = | = | = | = | = | +1 |
| BVE/FVE (Boleta/Factura Electrónica) | = | −1 | = | = | = | = | −1 |
| GME (Guía Despacho) | = | = | = | −1 | −1 | = | = |
| **Neto ciclo completo** | −1 | −1 | 0 | 0 | −1 | 0 | 0 |

> ⚠️ BVE/FVE NO zeroa CANTIDAD_PENDIENTE en JustWeb → filtro EXISTS en descargar_despachos.py

### Flujo DEVOLUCIÓN
| Documento | St_Disp | St_Cont | St_DVen | St_DCom | St_Bod | St_Ped |
|---|---|---|---|---|---|---|
| GDC (Guía Devolución Cliente) | +1 | = | = | +1 | = | = |
| NCE (Nota de Crédito Electrónica) | = | +1 | = | −1 | +1 | = |
| **Neto ciclo completo** | +1 | +1 | 0 | 0 | +1 | 0 |

### Anomalía JT
**Disp > Fís → Dif < 0 → fila roja en Informe Stock**
Causas: NVM cancelada sin reversa · ajuste contable incorrecto · EXH mezclado en CEM.

### Parseo CSV SSRS — CRÍTICO
**Punto = miles · Coma = decimal** → `s.replace('.','').replace(',','.')`
`1.536` = 1536 unidades (NO 1.536). Error histórico 2026-05-30 en generar_informe_stock.py.

### Servidor 2 — Limitación Real-time
SQL Server 200.6.118.110 sincroniza con JustWeb **una sola vez al día a las 22:00**.
- descargar_erp.py / descargar_ventas_erp.py → Real-time (HTTP/SSRS)
- descargar_bod.py / descargar_pedidos.py / descargar_despachos.py / leer_xlsm.py → Solo tras 22:00

**Respuesta estándar:** "Los datos de despachos/pedidos/bodegas vienen del Servidor 2 que sincroniza a las 22:00."

---

## SAFE CHANGE PROTOCOL — OBLIGATORIO ANTES DE CUALQUIER CAMBIO

**Un prompt = una función tocada.** Si el fix requiere 2 funciones → dos prompts separados.
Si el agente dice "también modifiqué X para que funcione" sin pedírselo → DETENER y revisar X.

### Cuándo aplicar SIEMPRE
- Modificar cualquier función en `panel-admin.html`, `firebase-config.js`, `main.py`, `leer_xlsm.py`
- Agregar o modificar tab, sub-tab, botón o menú del panel admin
- Cambiar cualquier función que empiece con `vadm`, `venAdm`, `_vadm`
- Modificar cualquier función del pipeline Python que produzca un JSON de `data/`

### PASO 1 — Leer antes de escribir
1. Leer la función completa que se va a modificar
2. Identificar todas las funciones que la invocan (LLAMADA POR)
3. Identificar todas las funciones que ella invoca (LLAMA A)
4. Identificar variables JS globales o Python que lee o escribe
5. Identificar qué tabs/secciones HTML o scripts consumen el output

### PASO 2 — Declaración de alcance (formato obligatorio)
```
TOCO:        [nombre exacto de la función o bloque HTML]
ARCHIVO:     [panel-admin.html | main.py | leer_xlsm.py | otro]
RAZÓN:       [una línea — qué se cambia y por qué]
LLAMADA POR: [lista de funciones que invocan la tocada]
LLAMA A:     [lista de funciones que la tocada invoca]
VARIABLES:   [variables JS globales o Python que lee o escribe]
TABS:        [vsec-* o sidebar items que usan esta función]
NO TOCO:     [lista explícita con razón de cada una]
```

### PASO 3 — Checklist post-cambio
```
[ ] La función sigue recibiendo los mismos parámetros
[ ] Las variables globales siguen con el mismo nombre
[ ] El tab que la invoca sigue en vadmReRenderTabActivo
[ ] El filtro _vadmBodSel sigue afectando el resultado
[ ] No se hardcodeó ningún valor que venga de datos reales
[ ] No se renombró ninguna función pública
[ ] window._mostrarPrecio = false sigue siendo default en panel-cliente.html
[ ] xlsm-enrich.json sigue siendo generado por leer_xlsm.py (no por main.py)
[ ] _catalogo_generado_hoy() no fue revertida a _actualizar_xlsx_es_hoy()
[ ] ventas-manzano.json sigue siendo generado por guardar_json() en main.py
[ ] Subquery ULT en descargar_bod.py tiene WHERE IDBODEGA=? antes del GROUP BY
```

---

## RUTAS CRÍTICAS — NO BUSCAR, USAR DIRECTAMENTE

```
Proyecto activo:     E:\ferreteria-oviedo\
Git sync (solo):     E:\git-sync\        (NO es el proyecto — solo copia para git)
Archivados:          E:\ferreteria-oviedo\_HISTORICO\
Bodegas XLSM:        E:\ferreteria-oviedo\BODEGAS\
Memory Claude:       W:\claude-config\projects\E--ferreteria-oviedo\memory\
                     (acceso via junction C:\Users\Ferreteria Oviedo\.claude → W:\claude-config\)
CLAUDE.md global:    W:\claude-config\CLAUDE.md
Git config:          E:\config\gitconfig  (GIT_CONFIG_GLOBAL apunta aquí)
Tokens GitHub:       E:\config\gcm-store  (DPAPI cifrado, transparente via GCM)
Herramientas W:      W:\herramientas\seguridad\
Docs backup W:       W:\proyecto-docs\   (AGENTS.md, MEMORY.md — copia de emergencia)
Backup .claude orig: C:\Users\Ferreteria Oviedo\.claude-bak-20260604  (NO borrar)

MD activos raíz:
  AGENTS.md:               E:\ferreteria-oviedo\AGENTS.md         (este archivo)
  MEMORY.md:               E:\ferreteria-oviedo\MEMORY.md
  MAPA_FLUJO_PROYECTOS.md: E:\ferreteria-oviedo\MAPA_FLUJO_PROYECTOS.md
  _HISTORICO/:             E:\ferreteria-oviedo\_HISTORICO\       (MDs históricos)
```

---

## ARQUITECTURA DE DISCOS

| Disco | Tipo | Contenido |
|---|---|---|
| Disk 0 — NVMe 256GB | C: (121GB) | Windows + Python + Node.js + Git for Windows |
| Disk 1 — TOSHIBA USB 1.8TB | W: (128GB) | Claude config + herramientas seguridad |
| Disk 1 — TOSHIBA USB 1.8TB | E: (1.7TB) | Proyecto + herramientas portables |

**W: y E: son el mismo disco físico USB.** La partición W: es más estable (menos actividad).

### Junction Claude Code
```
C:\Users\Ferreteria Oviedo\.claude  ──junction──►  W:\claude-config\
```
Claude busca su config en C:, Windows redirige a W: transparentemente.
**Backup de rollback:** `C:\Users\Ferreteria Oviedo\.claude-bak-20260604` (NO borrar).

### Variables de entorno (HKCU)
```
GIT_CONFIG_GLOBAL    = E:\config\gitconfig
NPM_CONFIG_PREFIX    = E:\npm-global
NPM_CONFIG_CACHE     = E:\npm-cache
NPM_CONFIG_USERCONFIG= E:\config\.npmrc
XDG_CONFIG_HOME      = E:\config
GH_CONFIG_DIR        = E:\config\gh
PIP_CACHE_DIR        = E:\pip-cache
```

---

## EMERGENCIA DISCO E: / W:

**Causa raíz confirmada:** FortiClient Zero Trust retiene handle sobre el volumen USB. Historial: 3 ocurrencias (2026-06-03, 2026-06-04 tarde, 2026-06-04 noche).

### Opción A — Sin scripts (30 seg)
1. Explorador de Windows → clic derecho disco E: → Expulsar
2. Si aparece error "disco en uso" → Aceptar (es normal)
3. Windows fuerza a FortiClient a soltar el handle → E: se remonta limpio

### Opción B — Script desde W:
```
W:\herramientas\seguridad\REMONTAR_DISCO_E.ps1   ← remonta sin expulsar (PnP)
W:\herramientas\seguridad\ABRIR_CLAUDE.bat        ← abre Claude verificando E: primero
```

### Rollback de junction si W: falla
```powershell
cmd /c "rd ""C:\Users\Ferreteria Oviedo\.claude"""
Rename-Item "C:\Users\Ferreteria Oviedo\.claude-bak-20260604" ".claude"
```

### GitHub como respaldo final
Si no puedes acceder a W: ni a E:, dar a Claude el AGENTS.md desde GitHub:
`https://github.com/oviedoem/ferreteria-oviedo/blob/main/AGENTS.md`

---

## PROYECTO

- Stack: HTML/CSS/JS Vanilla + Firebase Hosting (JSON estáticos) + Python pipeline ERP
- Directorio activo: `E:\ferreteria-oviedo\` — NO trabajar en D:\ ni en E:\git-sync\
- Versión activa: V37.14

### Historial de deploys (desde 2026-06-01)
- Deploy V37.13: 2026-06-02 03:55 — fix árbol auto-init + guard re-render + tutoriales D:→E: ✅
- Deploy V37.14: 2026-06-02 04:22 — fix D:→E: en 5 scripts pipeline + precios arg + XDG_CONFIG_HOME ✅
- Deploy cierre sesión: 2026-06-04 00:21

*Historial pre-junio en _HISTORICO\20260604_AGENTS_completo.md*

### APP-INVENTARIO (proyecto separado)
- Repo: github.com/oviedoem/APP-INVENTARIO
- Pages: https://oviedoem.github.io/APP-INVENTARIO/
- Working: E:\APP-INVENTARIO\

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

### ORDEN DE LECTURA OBLIGATORIO AL INICIO DE CADA SESIÓN:
1. MEMORY.md
2. AGENTS.md
3. CLAUDE.md (en W:\claude-config\CLAUDE.md)
4. Recién después ejecutar cualquier tarea

---

## ARCHIVOS PROHIBIDOS DE ELIMINAR

- **CATALOGO PRODUCTOS\Datos.xlsx** → MASTER del catálogo. Si se corrompe, regenerar con seed (ver _HISTORICO\20260604_AGENTS_completo.md → sección REGENERACIÓN COMPLETA SEGURA).
- **ventas-manzano.json** → NECESARIO: el panel lo usa como fallback en 4 puntos. NO eliminar.
- **credenciales_db.ini** → NUNCA tocar ni leer en voz alta
- **credenciales_erp.ini** → NUNCA tocar ni leer en voz alta
- **E:\git-sync\** → NUNCA modificar directamente

### REGENERACIÓN COMPLETA SEGURA — qué SÍ y qué NO eliminar:
```
SÍ eliminar (se regeneran solos):
  data\ventas-manzano-YYYY-MM.json   data\ventas-manzano-YYYY.json
  data\ventas-manzano.json           data\ventas-manzano-meta.json
  data\catalogo-dinamico.json        data\xlsm-enrich.json
  data\bod-*.json                    data\despachos-*.json
  data\pedidos-*.json                data\ventas-xlsm-*.json
  data\ranking-unidades.json         data\precios-diff.json
  CATALOGO PRODUCTOS\Datos.csv       CATALOGO PRODUCTOS\merma.json

NO eliminar (son base/histórico):
  CATALOGO PRODUCTOS\Datos.xlsx
  CATALOGO PRODUCTOS\actualizar.xlsx
  data\ventas-manzano-YYYY-MM.json   (meses ANTERIORES al actual)
```

---

## REGLA DE CIERRE DE SESIÓN — DEPLOY PENDIENTE

Antes de terminar cualquier sesión donde se hayan modificado archivos:
1. Comparar mtime de archivos desplegables (HTML, JS, JSON) vs último deploy
2. Si algún archivo es más nuevo → ejecutar `firebase deploy --only hosting`
3. Actualizar línea "Deploy cierre sesión" en este archivo
4. Ejecutar `ACTUALIZAR_GITHUB.bat`

### Verificación en PowerShell:
```powershell
$ultimoDeploy = [datetime]"2026-06-04 00:21:00"
Get-ChildItem 'E:\ferreteria-oviedo\' -Filter '*.html' -File |
    Where-Object { $_.LastWriteTime -gt $ultimoDeploy } | Select-Object Name, LastWriteTime
```

---

## REGLA COMMIT OBLIGATORIO

Al terminar CUALQUIER modificación de código, ejecutar SIN EXCEPCIÓN:
```
"V37.X desc breve sin tildes" | cmd /c "E:\ferreteria-oviedo\ACTUALIZAR_GITHUB.bat"
```
- Descripción: máximo 5 palabras, minúsculas, sin tildes
- Si falla por red: reportar el error pero NO omitir el intento

---

## REGLA: Sincronización de UI con cada deploy

Con cada deploy V37.X.Y, actualizar EN EL MISMO COMMIT:
1. Version Badge en panel-admin.html (~L3043): número + fecha
2. Version Badge en panel-cliente.html (si lo tiene)
3. Tutoriales (~L2086-2204): si cambiaron flujos o scripts
4. Mejoras planificadas (~L2206-2330): marcar completadas

**VALIDACIÓN antes de commit:**
```
grep "ACTUALIZAR_Y_PUBLICAR.bat" panel-admin.html → debe dar 0
grep "D:\\ferreteria-oviedo" panel-admin.html → debe dar 0
```

---

## PIPELINE COMPLETO — ACTUALIZAR_TODO.bat

```
[PASO 1A] descargar_erp.py → actualizar.xlsx (precios + stock SSRS 8 bodegas, 2 bloques, 23 cols)
[PASO 1B] procesar-actualizacion.py + xlsx_a_csv.py + csv_a_json.py → Datos.json + catalogo-dinamico.json
[PASO 1C] leer_xlsm.py → xlsm-enrich.json
[PASO 1D] descargar_bod.py (BODEGAS/) → bod-iem-registros.json + bod-rce-registros.json + bod-cem-registros.json
          SQL Server directo — IEM=72, RCE=55, CEM=24
[PASO 1E] descargar_pedidos.py (BODEGAS/) → pedidos-comprometidos.json + pedidos-detalle.json
          Fuente: R_STOCK_PRODUCTOS.ST_PEDIDO · Tipos: NVM/VMN/VMP
[PASO 1F] descargar_despachos.py (BODEGAS/) → despachos-comprometidos.json + despachos-detalle.json
          Fuente: BVE/FVE, CANTIDAD_PENDIENTE > 0
[PASO 2]  main.py --sin-deploy
          PASO 1: _catalogo_generado_hoy()? SI → leer_bodegas_desde_actualizar (3s) / NO → HTTP (~70s)
          PASO 2: descargar_ventas_erp.py incremental (dedup por Numero+Codigo)
          PASO 3: consolidar() — JOIN catálogo + ventas + mapa_cliente
          PASO 3.5: enriquecer_desde_xlsm() — agrega rut, sector, bodegaCorta, hora, razonSocial
          PASO 4: guardar_json() → ventas-manzano*.json
[PASO 3]  Pregunta visibilidad precios (10s timeout, default N=ocultos)
[PASO 4]  firebase deploy --only hosting
```

**SEÑAL ANTI-DOBLE-DESCARGA:** `procesar-actualizacion.py` escribe `catalogo-dinamico.json`.
`main.py` lo lee: si es de hoy → usa datos ya descargados (3s) · si no → descarga HTTP (~70s extra).
NO modificar esta lógica. NO eliminar ni mover `catalogo-dinamico.json`.

BATs disponibles:
```
ACTUALIZAR_TODO.bat           → pipeline completo (único punto de entrada)
PUBLICAR.bat                  → solo firebase deploy
ACTUALIZAR_GITHUB.bat         → sync github
ACTUALIZAR_TODO_AUTO.bat      → sin interacción (para ejecutar manualmente o tarea programada)
VENTAS EL MANZANO\ACTUALIZAR_VENTAS.bat → solo ventas
```

BATs archivados en `_HISTORICO\` — NO ejecutar:
`20260523_PREPARAR_Y_PUBLICAR.bat` · `20260523_ACTUALIZAR_AUTO.bat` · `20260530_SUBIR_VENTAS_MANZANO.bat`

---

## ZONAS ABSOLUTAMENTE INTOCABLES

```
firebase-config.js             — no modificar nunca desde panel HTML
window._mostrarPrecio          — default SIEMPRE false en panel-cliente.html
credenciales_erp.ini           — nunca tocar, nunca subir a git
credenciales_db.ini            — nunca tocar, nunca subir a git
E:\git-sync\                   — nunca trabajar aquí directamente
venAdmParseFecha()             — no cambiar firma ni comportamiento
venAdmFmt()                    — no cambiar firma
_actualizar_xlsx_es_hoy()      — ELIMINADA en V36.5, no restaurar
xlsm-enrich.json               — solo leer_xlsm.py lo genera, nadie más
```

---

## REGLAS DE EJECUCIÓN

- No usar cmd /c bat > NUL desde bash — abre shell interactivo → usar PowerShell
- No subir datos de ejemplo — solo datos reales actualizados
- No agregar dependencias sin autorización
- No reescribir lo que ya funciona
- No pedir confirmación antes de ejecutar si el usuario dijo "ejecuta"
- Python: sin tildes, sin emojis, solo ASCII cp1252
- BATs: guardar en ANSI cp1252

---

## MAPA DE DEPENDENCIAS CRÍTICAS

```
Si tocas...              Debes verificar también...
------------------------------------------------------------
vadmSubTab(id)           Que id esté en vadmReRenderTabActivo.
vadmRenderSobreStock     _vadmSSProds — lo usan email, Excel y Outlook.
vadmRenderBajaRot        _vadmBRDatos + _vadmLineas cubre el rango de fechas.
vadmRenderQuiebre        _vadmStockMap debe estar cargado primero.
_vadmCargarStockMap      Cacheada. NO llamar si ya existe con datos.
vadmSSMarcaClick(el)     Usa data-marca del HTML. NUNCA string en onclick.
Sidebar HTML             Que grupos siguen colapsando correctamente.
onclick=""               NUNCA usar JSON.stringify — rompe con comillas.
venAdmParseFecha         Utility global en TODOS los tabs. No modificar firma.
leer_xlsm.py             Debe seguir generando xlsm-enrich.json al final.
enriquecer_desde_xlsm() Debe correr DESPUÉS de consolidar() y ANTES de guardar_json().
_catalogo_generado_hoy() Verifica catalogo-dinamico.json mtime — no revertir.
descargar_bod.py         Subquery ULT: WHERE IDBODEGA=? ANTES del GROUP BY.
```

---

## VARIABLES JS GLOBALES CLAVE — no renombrar

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

## FUNCIONES JS CLAVE — no renombrar ni cambiar firma

```
vadmCargarLineas()          Carga ventas JSON según _vadmAnioSel
_vadmCargarStockMap(cb)     Carga Datos.json → _vadmStockMap; cachea en sesión — NO llamar si ya existe
vadmRenderSobreStock()      Render sobre-stock, cobertura en meses
vadmSSMarcaClick(el)        Toggle filtro marca — usa data-marca, NUNCA string en onclick
vadmRenderBajaRot()         Render baja rotación + auto-reload si rango > datos cargados
vadmFiltrarBajaRot()        Re-filtra _vadmBRDatos sin recomputar ABC
vadmRenderQuiebre()         Render stock quiebre con ABC + Rot.30/60/90d
vadmRenderImpacto()         Volumen vs Precio: Q y precio prom por vendedor en 2 períodos
vadmRenderNC()              NC por vendedor desde _vadmLineas
vadmBuscarStock()           Filtra _vadmStockMap en memoria para Consulta de Stock
vadmRenderStockConsulta(cod) Ficha detalle de un producto (8 bodegas)
venAdmParseFecha(s)         Parsea fecha DD/MM/YYYY → timestamp ms — NO cambiar firma
venAdmFmt(n)                Formatea número como X.XXX CLP — NO cambiar firma
vadmDatosFiltrados()        Filtrado central — todas las funciones render deben usarla
```

---

## BODEGAS — BODSTOCK 8 BODEGAS, NO REDUCIR

```javascript
var BODSTOCK = {
  PEM:'pem', SEM:'sem', CEM:'cem', RCE:'rce',
  MEM:'mem', TEM:'tem', IEM:'iem', CD:'cd'
}
```

**Comerciales** (ventas + NC + stock): PEM · SEM · CEM · MEM
**Auxiliares/logísticas** (solo stock): IEM · RCE · TEM · CD
**Eliminadas:** CAL

**SSRS — 2 bloques:**
- BLOQUE 1 (solo DISP): SEM CEM RCE MEM
- BLOQUE 2 (DISP+TRANS): PEM TEM CD IEM

**IDBODEGA SQL confirmados:** IEM=72 · RCE=55 · CEM=24 (de P_BODEGAS · 2026-05-25)

**bodegaCorta=PEM** hardcodeada en descargar_ventas_erp.py (L179, L222) — no es bug, NO arreglar.
**BOD_RCE.xlsm** (nombre físico) contiene bodega IEM (col A) → JSON: `bod-iem-registros.json`

### Regla crítica subquery ULT en descargar_bod.py
- Debe incluir `WHERE IDBODEGA=?` ANTES del `GROUP BY`
- JOIN debe usar `FECHA_EMISION=ULT.ULTIMA_FECHA`, NO `IDDOCUMENTO`
- `IDDOCUMENTO` = tipo de documento (ej. GRT=17), NO ID único de movimiento
- Verificado 2026-05-25: código 4422 IEM pasó de 931 días a 10 días con el fix

---

## TIPOS DE DOCUMENTO — tabla completa V37.8

| Efecto | Doc | IDDOCUMENTO | Descripción |
|---|---|---|---|
| ↑ Pedido (reserva) | NVM | 205 | Nota de Venta Mesón |
| ↑ Pedido (reserva) | VMP | 210 | Venta Mesón Público |
| ↑ Pedido (reserva) | VMN | 336 | Venta Mesón Nueva |
| ↓ Pedido, Fís−Disp↑ | BVE | 316/605 | Boleta Venta Electrónica |
| ↓ Pedido, Fís−Disp↑ | FVE | 301 | Factura Venta Electrónica |
| ↓ Físico | GME | 308 | Guía Despacho Mesón |
| ↓ Físico | GCE | 305 | Guía Despacho Cliente |
| Ingreso compra | GRC | 15 | Guía Retorno/Recepción Compra |
| Ajuste ingreso | GII | 33 | Guía Ingreso Interno |
| Traslado | GIB | 709 | Guía Ingreso Bodega |
| Traslado | GTS | 711 | Guía Traslado Salida |
| Nota crédito | NCE | 304 | Nota Crédito Electrónica |

Whitelist DOC IN (descargar_bod.py): `GRC,GRT,GME,GIB,Gdc,GBR,GRP,GRI,GRN,GIN,GDC,GDV,GII,GTS`

---

## TABS VERIFICADOS — deben seguir funcionando tras cualquier cambio

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

## CARGA DE DATOS — PERFORMANCE PANEL

```
ventas-manzano-YYYY-MM.json → mes actual, ~200KB (default)
ventas-manzano-YYYY.json    → año completo, 2-18MB (al seleccionar año)
ventas-manzano.json         → FALLBACK (panel depende de él en 4 puntos — NO eliminar)
Datos.json                  → 3.5MB en CATALOGO PRODUCTOS/, cargado una vez, cacheado
catalogo-dinamico.json      → DOBLE ROL: señal Python + 404 en panel (correcto — fallback a Datos.json)
```
NO intentar mover `catalogo-dinamico.json` a `CATALOGO PRODUCTOS/` — el 404 es comportamiento correcto por diseño.

---

## SEGURIDAD FIREBASE

### Headers Hosting (firebase.json)
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: scripts/styles/fonts/img/connect srcs definidos
```

### Roles de usuario
| Rol | Panel Admin | Panel Vendedor | Panel Cliente |
|---|---|---|---|
| admin | Completo | Completo | Completo |
| cooperador | Solo lectura operacional | Completo | Completo |
| vendedor | NO | Completo | Completo |
| cliente | NO | NO | Completo |

### Hosting ignore — bloqueados
`VENTAS EL MANZANO/` · `backups/` · `.claude/` · `*.ini` · `*.xlsm` · `*.mp4`

### GitHub — estado actual (post-limpieza 2026-06-02)
- 1 commit limpio, sin credenciales ni IPs reales
- IPs/tokens reemplazados por placeholders: `[SQL-SERVER-IP]` · `[ERP-SERVER-IP]` · `[TOKEN-ERP]`
- .gitignore bloquea: `FLUJOS/` · `VENTAS EL MANZANO/` · `CATALOGO PRODUCTOS/` · `.claude/`

---

## FLUJO LOGIN — INVARIANTES CRÍTICOS (V36.9k)

| Situación | Comportamiento correcto |
|---|---|
| Usuario Google nuevo (!snap.exists) | Crear doc /users con creadoPor:'google' — NUNCA signOut sin crear |
| Usuario pendiente (registroAprobado=false) | code:'pendiente' — NUNCA code:'noregistrado' |
| Registro deshabilitado | Bloquear, code:'noregistrado' — único caso válido |
| Usuario bloqueado (estado='bloqueado') | signOut + mensaje claro |

---

## CHECKLIST POST-CAMBIO

```
[ ] Función modificada recibe los mismos parámetros de entrada
[ ] Variables globales que usaba siguen existiendo con el mismo nombre
[ ] El tab que la invoca sigue en vadmReRenderTabActivo
[ ] Filtro _vadmBodSel sigue afectando el resultado (stock Y ventas)
[ ] No se hardcodeó ningún valor que debe venir de datos reales
[ ] No se renombró ninguna función pública
[ ] window._mostrarPrecio = false en panel-cliente.html
[ ] xlsm-enrich.json sigue siendo generado por leer_xlsm.py (no main.py)
[ ] _catalogo_generado_hoy() no fue revertida
[ ] ventas-manzano.json sigue siendo generado por guardar_json() en main.py
[ ] Subquery ULT en descargar_bod.py tiene WHERE IDBODEGA=? antes del GROUP BY
[ ] Deploy ejecutado y "Deploy cierre sesión" en AGENTS.md actualizado
[ ] ACTUALIZAR_GITHUB.bat ejecutado con descripción del cambio
```

---

## PENDIENTES CONOCIDOS (desde 2026-06-01)

### ACCIÓN 7 — Botón ♻️ Refrescar catálogo (MEDIA)
`_vadmCargarStockMap()` tiene guard: si `_vadmStockMap` existe, retorna sin fetch.
Si el pipeline actualiza Datos.json con el panel abierto, el catálogo queda viejo hasta F5.
Fix propuesto — agregar botón junto al "🔄 Actualizar":
```html
<button onclick="_vadmStockMap=null; _vadmCargarStockMap(vadmReRenderTabActivo)"
        title="Recargar catálogo de productos">♻️ Refrescar catálogo</button>
```
Safe Change: solo agregar el botón HTML. NO tocar `_vadmCargarStockMap()` por dentro.

### Tareas obsoletas Task Scheduler (apuntaban a D:)
```powershell
Unregister-ScheduledTask -TaskName "Ferreteria Oviedo - Backup Diario" -Confirm:$false
Unregister-ScheduledTask -TaskName "Ferreteria Oviedo Ventas 7PM" -Confirm:$false
```

---

## CÁLCULOS — METODOLOGÍA

### Velocidad de venta
```
velocidad_dh = unidades_vendidas_periodo / dias_habiles_periodo
cobertura_dh = stock_actual / velocidad_dh
```
Días hábiles: Lun-Sab que NO sean feriados chilenos. `_vadmDiasHabiles()` nunca retorna 0.

### Semáforos de stock
| Estado | Cobertura | Color |
|---|---|---|
| Quiebre | stock = 0 | rojo |
| Crítico | < 30 dh | rojo |
| Alerta | 30-90 dh | amarillo |
| OK | > 90 dh | verde |
| Sin datos | sin ventas | negro |

### ABC Pareto
- A: top 80% del valor de ventas · B: 81-95% · C: 96-100% · D: sin ventas

### Feriados Chile (calculados)
Fijos: 1-ene, 1-may, 21-may, 20-jun, 16-jul, 15-ago, 18-sep, 19-sep, 12-oct, 1-nov, 2-nov, 8-dic, 25-dic.
Móviles: Viernes Santo (Pascua-2), Sábado Santo (Pascua-1) — algoritmo Butcher.

---

*AGENTS.md consolidado 2026-06-05*
*Historial completo pre-junio: _HISTORICO\20260604_AGENTS_completo.md*
*Para actualizar: editar directamente este archivo al cierre de cada sesión.*
