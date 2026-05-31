# MEMORIA DEL PROYECTO — Panel de Diferencias de Inventario · El Manzano
# VERSION: V6.0
# FECHA: 2026-05-29

---

## REGLAS DE TRABAJO — LEER ANTES DE CUALQUIER ACCIÓN

### PRIORIDAD 0 — Aislamiento absoluto

```
TRABAJAR SOLO EN:   D:\ferreteria-oviedo\APP-INVENTARIO\
NUNCA TOCAR:        panel-admin.html · panel-cliente.html · panel-vendedor.html
                    D:\ferreteria-oviedo\  (raíz del otro proyecto)
                    D:\ferreteria-oviedo-github\
```

Este proyecto es INDEPENDIENTE del panel admin/cliente/vendedor.
No compartir funciones, no abrir su preview, no leer sus archivos.

### REGLA — Archivos .md

Solo actualizar los `.md` que están en la **raíz** de `APP-INVENTARIO\`:
- `MEMORIA_PROYECTO.md` ← este archivo
- `AGENTS.md`

**Nunca** tocar los `.md` de subdirectorios (`datos/README.md`, `datos/MEMORIA_PROYECTO.md`).

### REGLA — Safe Change en app.js

Antes de modificar cualquier función en `app.js`, declarar:
```
TOCO:     [nombre exacto de la función]
RAZÓN:    [una línea]
NO TOCO:  [lista de funciones adyacentes que NO se van a cambiar]
```
Un prompt = una función tocada. Si el fix necesita 2 funciones → dos prompts en orden.

### REGLA — Cierre de sesión

Antes de terminar cualquier sesión donde se hayan modificado archivos:

1. Verificar que los cambios están guardados en `app.js`, `style.css`, `index.html`
2. Actualizar `MEMORIA_PROYECTO.md` con los cambios de la sesión
3. Ejecutar el sync a GitHub:
   ```
   D:\ferreteria-oviedo\ACTUALIZAR_GITHUB_APP_INVENTARIO.bat
   ```
4. Confirmar el commit exitoso antes de cerrar

**Nunca dejar cambios sin subir a GitHub al terminar la sesión.**

---

## DESCRIPCIÓN

SPA (Single Page Application) Vanilla JS para análisis de diferencias de inventario.
Permite cargar archivos Excel/CSV de conteos 2025 y 2026, compararlos, y navegar
jerárquicamente hasta nivel de producto.

**Directorio activo:**
```
D:\ferreteria-oviedo\APP-INVENTARIO\
```

**Archivos principales:**
```
index.html   — estructura y vistas HTML
style.css    — estilos (CSS variables + clases de componentes)
app.js       — lógica completa (state, parseo, render, filtros, drilldown)
```

---

## STACK

- HTML + CSS + Vanilla JS (sin framework)
- SheetJS (XLSX 0.20.3) — parseo de .xlsx / .xls
- PapaParse — parseo de .csv
- Chart.js 4.4.3 — gráficos
- Todo se carga desde CDN, sin build step

---

## VISTAS

```
view-2025        — análisis inventario 2025 individual
view-2026        — análisis inventario 2026 individual
view-comparative — comparación lado a lado 2025 vs 2026
```

### Estructura layout por vista year (V3.0)

```
┌──────────────────────────────────────────────────────┐
│  Header: título + botones + ⚙ Filtros (badge)        │
├──────────────────────────────────────────────────────┤
│  KPI Cards (resumen-global + kpi-grid + monetary)    │
├─────────────────────┬────────────────────────────────┤
│  Embudo jerárquico  │  Insights + Charts + Tables    │
│  .embudo-panel      │  .drilldown-panel              │
│  (30% — sticky)     │  (70%)                         │
└─────────────────────┴────────────────────────────────┘
```

Drawer lateral (`filter-drawer-{year}`) se desliza desde la derecha con:
- Zona · Área · Patente · Bodega EM (NO marca/familia — esos son del embudo)

---

## ESTADO GLOBAL (state)

```js
const state = {
  data2025: [],
  data2026: [],
  charts: {},
  sortState: {},
  pendingLoad: null,

  filters: {
    '2025':      { marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'', bodega:'' },
    '2026':      { marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'', bodega:'' },
    comparative: { marca:'', familia:'', perfamilia:'', zona:'', area:'' }
  },
  searchText: { '2025': '', '2026': '' },
  chartMode:  { '2025': 'unidades', '2026': 'unidades' },

  // Embudo jerárquico (hiperfamilia → familia → marca)
  drilldown: {
    '2025': { hiperfamilia:'', familia:'', marca:'' },
    '2026': { hiperfamilia:'', familia:'', marca:'' }
  },

  // Tabla drilldown agrupable interactiva
  ddState: {
    '2025': { groupBy: 'familia', filterField: null, filterValue: null },
    '2026': { groupBy: 'familia', filterField: null, filterValue: null },
  },

  compCategoria: 'perfamilia',
  compDrill: { field: null, value: null },  // V3.0: drill activo en comparativa
};
```

---

## SISTEMA DE FILTRADO — DOS CAPAS (V3.0)

| Capa | Dónde vive | Qué filtra | Cómo se limpia |
|---|---|---|---|
| Embudo (`state.drilldown`) | `.embudo-panel` — chained selects | hiperfamilia → familia → marca | `clearDrillevel()` / `clearFilters()` |
| Drawer (`state.filters`) | `.filter-drawer` lateral | zona · área · patente · bodega | botón Limpiar / `clearFilters()` |

`getFilteredData(year)` combina ambas capas en orden: drilldown → filters → searchText.

`renderFilters(mode)` en modos year solo muestra zona/área/patente/bodega (marca/familia son del embudo).

---

## FUNCIONES JS CLAVE

```js
// Parseo
parseFile(file, year)              // detecta xlsx/csv
normalizeRow(raw)                  // aplica FIELD_ALIASES, calcula diferencia

// Filtrado
getFilteredData(year)              // combina drilldown + filters + searchText
getFilteredDataComp()              // aplica filters.comparative a ambos años
clearFilters(mode)                 // limpia filtros + drilldown + cierra drawer + actualiza badge
clearAllData()                     // limpia todo el estado

// Drawer (V3.0)
openFilterPanel(mode)              // abre filter-drawer-{mode} + overlay
closeFilterPanel(mode)             // cierra filter-drawer-{mode} + overlay
updateFilterBadge(mode)            // actualiza badge: suma drilldown activo + filters activos

// Render principal
renderMode(year)                   // resumenGlobal + embudo + filtros + KPIs + charts + drilldown
renderModeComp()                   // compKPIs + compCategoria + filtros + tabla comparativa

// Embudo jerárquico
renderEmbudo(year)
setEmbudoLevel(year, nivel, value)
clearDrillevel(year, nivel)
buildEmbudoGroupTable(year, groups, groupField, groupLabel)
buildEmbudoProductTable(data)

// Drilldown tabla agrupable
renderDrilldown(year, data)        // usa state.ddState[year]
setDrilldownGroup(year, groupBy)
drillIntoGroup(year, field, value)
clearDrilldownFilter(year)

// KPIs
renderResumenGlobal(year)
renderKPIs(year, data)
renderMonetaryKPIs(year, data)

// Comparativa
renderCompKPIs(d25, d26)
renderCompCategoria(d25, d26)
setCompCategoria(val)              // V3.0: llama renderModeComp() completo
drillCompProduct(field, value)     // V3.0: genera breadcrumb + tabla
clearCompDrill()                   // V3.0: limpia breadcrumb + comp-drill-products

// Acordeones
toggleAcc(btn)                     // V3.0: max-height transition + swap ▾/▴
initAccordions()                   // V3.0: conecta todos los .acc-btn al DOMContentLoaded

// Análisis Final (V4.0)
renderAnalisisFinal()              // V4.0: cuadro RESULTADOS + tops + gráficos + tablas
_renderFinalChart(id, data, field, isPie)
_renderFinalBarras(id, data)
exportFinalExcel()                 // V4.0: 4 hojas xlsx-js-style

// Exportaciones estilizadas (V4.0)
styleAnalisisSheet(ws, rows)       // V4.0: aplica estilos TABLA_ANALISIS a ws
exportDrilldownTable(year)         // V4.0: 12 columnas + RESULTADOS, xlsx-js-style

// Persistencia local (V4.0)
saveDataToIDB(year, rows)          // V4.0: guarda dataset en IndexedDB
loadDataFromIDB(year)              // V4.0: carga dataset de IndexedDB
clearIDB()                         // V4.0: limpia IndexedDB
saveStateToLS()                    // V4.0: guarda estado pequeño en localStorage
scheduleSave()                     // V4.0: debounce 800ms para saveStateToLS
clearSavedSession()                // V4.0: borra LS + IDB + estado → welcome
restoreSession()                   // V4.0: async, restaura datos + estado + muestra banner

// Exportaciones KPI y reporte rápido
exportResumenGlobalExcel(year)     // exporta KPIs en Excel (hoja KPIs_YEAR, 13 filas) — year: '2025'|'2026'|'comparative'
generateReport(mode)               // abre HTML en nueva pestaña con KPIs + tops por modo (distinto de generateReporteFinal)

// Planos (V4.1)
getPlanoContados()                 // V4.1: devuelve Set con patentes presentes en datos cargados
renderPlanos(allSheetNames)        // V4.1: +leyenda verde/rojo +badge cobertura por hoja
renderPlanoGrid(rows, zone, contados) // V4.1: colora patentes verde si contada, rojo si no

// CheckList (V4.1)
renderGantt(raw)                   // V4.1: fix slice(2), fila día 0 marcada, filtro 'dias' vacío

// Centro Reconteo (V4.1)
renderRecount()                    // V4.1: +KPI Confirmados, llama renderRecountRankings
renderRecountRankings(rows)        // V4.1: top 20 por $, top 20 por unidades — tablas con colores
exportRecountExcel()               // V4.1: Excel 2 hojas: Reconteo + Ranking_$
```

---

## CSS — CLASES PRINCIPALES

### Layout grid (V3.0)
```css
.main-panels              /* grid 30% / 70% */
.embudo-panel             /* sticky top:56px */
.drilldown-panel          /* min-width:0 */
```

### Filter drawer (V3.0)
```css
.filter-drawer            /* panel fixed derecha, transform translateX */
.filter-drawer.open       /* translateX(0) — visible */
.filter-drawer-header     /* título + botón ✕ */
.filter-drawer-close
.filter-drawer-overlay    /* backdrop semitransparente */
.filter-drawer-overlay.open
.filter-badge             /* badge naranja en botón ⚙ Filtros */
.btn.filter-drawer-btn    /* botón azul oscuro */
```

### Acordeones (V3.0)
```css
.acc-btn                  /* botón colapsable genérico */
.acc-content              /* contenedor max-height:0 → 2000px */
.acc-content.open
.mej-acc-header           /* botón acordeón en vista mejoras */
.mej-acc-body             /* cuerpo con max-height transition */
.mej-acc-body.open
.mej-acc-arrow            /* ▾/▴ — swap por JS, no rotación CSS */
```

### Comparativa (V3.0)
```css
.comp-drill-breadcrumb    /* breadcrumb drill activo */
.comp-drill-back          /* botón ← Volver */
.comp-drill-current       /* nombre del valor activo */
```

### KPIs y semáforo
```css
.global-kpi-grid / .global-kpi-card
.kpi-unid-row / .kpi-peso-row / .kpi-loss / .kpi-gain
.kpi-exact-ok / .kpi-exact-warn / .kpi-exact-bad
.count-kpi-row / .count-kpi-card
.card-faltantes / .card-sobrantes
```

### Embudo
```css
.embudo-section / .embudo-bar / .embudo-select
.embudo-breadcrumb / .embudo-chip / .embudo-chip-x
```

### Comparativa base
```css
.comp-kpi-columns / .comp-kpi-col-header.y2025 / .y2026
.comp-table / .row-mejora / .row-empeora
```

---

## HISTORIAL DE CAMBIOS

### V7.11 — 2026-05-30

**Rediseño Análisis 2026 + Informe REGISTROS + Botón Limpiar**

#### Cambios en index.html

**TAREA 1 — Eliminados de view-2026:**
- Bloque `table-block` de `resumen-marca-2026` (Resumen por Marca)
- Bloque `table-block` de `resumen-familia-2026` (Resumen por Familia / Hiperfamilia)
- `renderTables('2026')` sigue llamando a `renderResumen('resumen-marca-2026',...)` — devuelve silenciosamente porque `buildTable()` tiene guard `if (!table) return`.

**TAREA 2 — Eliminados de view-2026:**
- `chart-pie-hiper-2026` — donut "Diferencia por Hiperfamilia"
- `chart-pie-marca-2026` — donut "Diferencia por Marca"
- `makeChart()` tiene guard `if (!ctx) return` → sin errores JS al no encontrar canvas.
- Conservados: `chart-familia-unid-2026` y `chart-marca-peso-2026` (barras).

**TAREA 3 — Desglose full-width:**
- El acordeón `📊 Desglose interactivo por diferencias` movido de dentro de `.drilldown-panel` a una nueva `.desglose-2026-wrapper` full-width DEBAJO de `.main-panels`, dentro de `#view-2026`.
- Filtros agregados sobre el Desglose: `#dd-2026-search-cod`, `#dd-2026-search-desc`, `#dd-2026-sort-btn`.
- Encabezado azul `#1e40af` + letras blancas en la tabla del Desglose 2026 (CSS `.desglose-2026-wrapper .data-table th`).

**TAREA 4 — Tabla REGISTROS:**
- Nueva sección `#registros-2026-section` debajo del Desglose (full-width, display:none hasta que haya datos).
- Filtros: `#reg-search-cod`, `#reg-search-desc`.
- Checkbox `#reg-show-dif` para columna DIFERENCIA $.
- Botón "↓ Exportar a Excel".
- Encabezado azul `#1e40af` + letras blancas (CSS `#registros-2026-section .data-table th`).

**TAREA 5D — Botón "🧹 Limpiar":**
- Botón `.btn-limpiar-app` en el header nav (después de "Mejoras 2026").
- Llama `clearAllApp()`.

#### Cambios en app.js

**Estado global:**
- `state.registros2026 = []` — nuevo array para rows crudos de hoja REGISTROS.
- `state.ddFilters = { '2026': { cod:'', desc:'', sortByDif:false } }` — estado de filtros del Desglose 2026.

**`buildDDGroupTable(year, groups, groupBy, groupLabel)` — modificada:**
- Eliminada columna `% Exactitud` (no existe en TABLA_ANALISIS).
- Columnas reordenadas a orden Excel: `groupLabel · Productos · CONTEO · VALOR CONTEO · STOCK SISTEMA · VALOR SISTEMA $ · DIFERENCIA · DIFERENCIA $`.
- Aplica filtro `state.ddFilters[year].desc` (nombre de grupo) y sort por `adp` si `sortByDif`.

**`buildDDProductTable(data, year)` — modificada:**
- Nuevo parámetro `year` (caller `renderDrilldown` actualizado).
- Columnas en orden Excel: `Codigo_tecnico · Descripcion · CONTEO · COSTO $ · VALOR CONTEO · STOCK SISTEMA · VALOR SISTEMA $ · DIFERENCIA · DIFERENCIA $ · FAMILIA`.
- Aplica filtros `state.ddFilters[year].cod` (código) y `.desc` (descripción).

**Funciones nuevas:**
- `ddFilterDrilldown(year)` — lee inputs DOM, actualiza `state.ddFilters[year]`, re-renderiza Desglose.
- `ddToggleSortDif(year)` — toggle sort por |DIFERENCIA $| DESC.
- `renderRegistros2026()` — renderiza tabla REGISTROS con filtros; muestra resumen al buscar por código.
- `exportRegistros2026Excel()` — exporta REGISTROS a .xlsx con xlsx-js-style (encabezado azul, bordes thin).
- `clearAllApp()` — limpieza completa (confirm, IDB, LS, state, window globals, DOM).

**`readFileData` — modificada:**
- `let registrosRows = []` captura rows crudos de la hoja REGISTROS antes del procesamiento de patentes.
- `resolve(...)` incluye `registros: registrosRows`.

**`loadFiles` — modificada:**
- Captura `data.registros` para `state.registros2026` cuando `year === '2026'`.

**`renderMode(year)` — modificada:**
- Al final de la función: `if (year === '2026') renderRegistros2026()`.

**`clearAllData()` — modificada:**
- Agrega `state.registros2026 = []` y oculta `#registros-2026-section`.

#### Cambios en style.css

- `.btn-limpiar-app` — botón rojo en header nav.
- `.desglose-2026-wrapper`, `.desglose-2026-filters`, `.dd-filter-input`, `.dd-sort-btn` — Desglose full-width.
- `.desglose-2026-wrapper .data-table th` — encabezado azul Desglose 2026.
- `.registros-section`, `.registros-header`, `.registros-actions`, `.registros-check-lbl`, `.registros-filters`, `.reg-resumen-cod` — sección REGISTROS.
- `#registros-2026-section .data-table th` — encabezado azul tabla REGISTROS.

#### Funciones NO tocadas

`renderMode('2025')` · `renderModeComp()` · `renderPlanos()` · `const PLANO_SHEETS` · `renderRecount()` · `renderAnalisisFinal()` · `saveDataToIDB()` · `loadDataFromIDB()` · `restoreSession()` · `initAccordions()` · `toggleAcc()` · `exportFinalExcel()` · `exportDrilldownTable()` · `venAdmParseFecha()` · `venAdmFmt()` · `getFilteredData()` · `clearFilters()` · `renderEmbudo()` · `setEmbudoLevel()` · `clearDrillevel()` · `buildEmbudoGroupTable()` · `buildEmbudoProductTable()`

#### TAREA 5A — Verificación de consistencia (PENDIENTE)

Requiere cargar el archivo real `ANALISIS_EL MANZANO-V2026.xlsx` y comparar manualmente 5 códigos. Pendiente de ejecución por el operador con el archivo real.

Campos a verificar: `STOCK SISTEMA` · `CONTEO` · `VALOR SISTEMA $` · `DIFERENCIA` · `DIFERENCIA $`.

**node --check → OK ✓**
**const PLANO_SHEETS → 1 ocurrencia ✓**

---

### V7.11 — 2026-05-30

**Doc — Reclasificación sección PENDIENTE según operación real**

Revisión del proyecto detectó que la sección `## PENDIENTE` mezclaba deuda técnica con flujo operativo:

- "Test end-to-end con archivos reales" → no es pendiente: la app **está corriendo en producción** con `state.data2026` cargado en vivo mientras el operador llena el XLSX `ANALISIS_EL MANZANO-V2026.xlsx`.
- "Carga de 2025 + verificación de comparativa / `renderCompCategoria` / embudo con datos reales" → **diseño operativo**: 2025 entra recién cuando el XLSX 2026 cierre. No es deuda.
- "TAREA 5A — verificar 5 códigos" → mismo motivo: espera cierre del XLSX, no falta código.
- "Probar 📂 Actualizar Plano con XLSX real" → **ya probado en producción**, funciona. Movido a "Verificado".

**Cambios en MEMORIA_PROYECTO.md:**
- Nueva sección `## ESTADO OPERATIVO ACTUAL` documenta el caso de uso vivo (solo 2026 cargado, monitoreo de avance).
- Sub-sección "Diseño operativo (NO es deuda técnica)" separa lo que espera al XLSX.
- Sub-sección "Pendiente real (deuda técnica)" queda con 2 ítems: confirmar 465 patentes contra plano real cuando cierre + `exportChecklistExcel`/`exportPlanosExcel` (sub-tarea V4.0).
- Sub-sección "Verificado en producción" registra "Actualizar Plano" + avance por patente.

**NO TOCADO:** `app.js`, `style.css`, `index.html`, `AGENTS.md`, ninguna otra sección de MEMORIA.

---

### V7.10 — 2026-05-29

**Fix crítico — `const PLANO_SHEETS` borrado por `actualizar_planos.js`**

**Causa:** El script `actualizar_planos.js` reemplazaba `_planoHtml_PATIO_CONSTRUCTOR` buscando el siguiente `\nfunction` como delimitador final. El `const PLANO_SHEETS = {...}` estaba entre esa función y `renderPlanos()` → fue incluido en el bloque "viejo" que se eliminó y no estaba en el bloque nuevo.

**Síntoma:** Botón Planos no hacía nada. `PLANO_SHEETS` es `undefined` → `Object.keys(PLANO_SHEETS)` lanza ReferenceError en DOMContentLoaded → todos los handlers del nav que se registran después no se conectan (Avanzado, Final, Mejoras tampoco responden).

**Fix:** Restaurar `const PLANO_SHEETS` en L3420, justo antes de `renderPlanos()`.

**Regla para `actualizar_planos.js`:** Al regenerar planos, verificar que `const PLANO_SHEETS` sigue presente en app.js después del reemplazo. Si se borra, restaurar de inmediato.

**node --check → OK ✓**

---

### V7.9 — 2026-05-29

**Fix — `generar_planos.js` + `planos_generated.js` + `app.js`: patentes 1-9 ignoradas**

**Causa raíz:** `extractPatente()` en `generar_planos.js` usaba regex `/^(\d{2,4})(\s|$)/` (mínimo 2 dígitos). Las patentes de 1 dígito (1-9) presentes en el Excel plano y en REGISTROS no recibían atributo `data-patente` → `applyPatenteCellStates()` nunca las coloreaba.

**Error de diagnóstico documentado:** Claude diagnosticó incorrectamente que los números 1-9 en el plano eran "etiquetas de zona" sin verificar el Excel real ni REGISTROS. El usuario corrigió — esos números SON patentes reales con registros en REGISTROS. **Regla permanente:** no diagnosticar si no hay certeza, consultar al usuario primero.

**Fix:**
- `generar_planos.js` L155: `/^(\d{2,4})(\s|$)/` → `/^(\d{1,4})(\s|$)/`
- `node generar_planos.js` regenera `planos_generated.js`
- `node actualizar_planos.js` (nuevo script temporal) reemplaza las 4 funciones en `app.js`

**Resultado verificado:**
- Sala EXHIBICION: 55 → **64 patentes** (recuperadas 1,2,3,4,5,6,7,8,9)
- BODEGA SALA / BODEGA 2DO / PATIO: sin cambio (no tienen patentes de 1 dígito)

**node --check → OK ✓**

---

### V7.8 — 2026-05-29

**Fix — `.plano-patente-pendiente` (style.css): patentes no contadas eran invisibles**

**Causa:** La clase `.plano-patente-pendiente` solo tenía `outline: 1.5px solid rgba(239,68,68,0.45)` — borde de 1.5px al 45% de opacidad. Las celdas del plano generadas desde Excel sin color de relleno aparecían completamente blancas: sin borde visible, sin color, sin textura. El usuario no podía distinguir patentes contadas de pendientes.

**Fix en style.css:**
```css
.plano-patente-pendiente {
  background: rgba(254, 226, 226, 0.92) !important;  /* fondo rosa/rojo tenue */
  outline: 2px solid rgba(220, 38, 38, 0.75);         /* borde rojo visible */
  outline-offset: -1px;
  color: #7f1d1d !important;                           /* texto rojo oscuro */
  font-weight: 700 !important;                         /* número legible */
}
```

**Resultado:** Patentes no contadas aparecen claramente en rosa/rojo con número legible. Patentes contadas siguen en verde con inventariador.

**Nota sobre celdas de zona:** Los números 1-9 visibles en el plano son etiquetas de área/zona del Excel (identificadores de secciones), NO patentes. No tienen `data-patente` y no se colorean, lo cual es correcto.

**NO tocado:** `.plano-patente-lista`, `.plano-patente`, `.plano-inv-badge`, ninguna función JS.

---

### V7.7 — 2026-05-29

**Fix — `readFileData()`: patentes no detectadas como contadas (CONTEO vs CONTO)**

**Causa raíz:** El campo `CONTEO` representa las unidades físicas encontradas en el conteo (puede ser 0 si el producto no estaba). El campo `CONTO` es el flag de visita del inventariador (>0 = producto fue visitado, independiente del resultado). El código usaba `CONTEO > 0` como criterio de "visitado" → patentes con un producto contado como 0 unidades (CONTEO=0, CONTO=1) quedaban excluidas del Set `_patentesCargadas`. Ejemplo: Patente 11, producto TREB0028: CONTEO=0 (no encontrado físicamente), CONTO=1 (fue visitado). La patente tenía 10/11 filas con CONTEO>0 → toda la patente marcada como NO contada.

**Fix — bloque `patentesCargadasSet` (L614-645):**
- `registroSheets`: reducido de 10 entradas a solo `['REGISTROS']` (fuente oficial per instrucción de usuario; SALA/PATIO/EXHIBICION tienen 0 filas, SEM tiene estructura incompatible)
- Criterio cambiado: `CONTEO > 0` → `CONTO > 0` (field lookup: `r.CONTO || r.Conto || r.conto`)
- Comentario actualizado para explicar la diferencia CONTEO vs CONTO

**Fix — bloque `inventariadorMap` (L649-667):**
- `invSheets`: mismo cambio, solo `['REGISTROS']`
- Criterio: `conteo > 0` → `conto > 0`

**Resultado verificado (Node.js):**
- Antes: 232 patentes contadas (CONTEO)
- Después: 247 patentes contadas (CONTO = todas las presentes en REGISTROS)
- Patentes 11, 12, 18, 22, 24, 38, 50, 62 → ahora CONTADAS correctamente en Sala EXHIBICION
- Patente 56 → genuinamente ausente de REGISTROS → correctamente NO contada

**NO tocado:** `getPlanoContados()`, `applyPatenteCellStates()`, `renderPlanoZonaProgress()`, `loadFiles()`, resto de `readFileData()`, ninguna función de render, index.html, style.css.

**node --check → OK ✓**

---

### V7.6 — 2026-05-29

**Fix — tab Mejoras 2026 mostraba contenido hardcodeado sin archivos cargados**

- **Causa:** onclick handler de `.tab-btn[data-mode="mejoras"]` llamaba `switchToMode('mejoras')` directamente sin verificar `state.data2025/data2026`. El view contiene KPIs y texto hardcodeado (valores de análisis previo) que siempre eran visibles.
- **Fix:** guard `if (!state.data2025.length && !state.data2026.length)` → toast + `return`. Sin datos: permanece en welcome screen. Con datos: comportamiento anterior sin cambio.
- **NO tocado:** `switchToMode`, `refreshView`, contenido de `view-mejoras` en index.html, ninguna otra función.
- **node --check → OK ✓**

---

### V7.5 — 2026-05-29

**Auditoría 4 puntos — A/B/C ya presentes, D corregido**

**Prompt A — `limpiarCachePlanos()`**: ya existía desde V7.4. Sin cambio.

**Prompt B — `exportResumenGlobalExcel(year)`**: ya existía (sesión anterior no documentada). Sin cambio.
- Fuente: `calcKPIs(data)` + `calcMonetarySummary(data)` · hoja `KPIs_YEAR` o `KPIs_Comparativo`
- 13 filas: Unidades Sistema/Físico/Diferencia/Dispersión/Exactitud%, $ Sistema/Físico/Diferencia/Dispersión/Exactitud%, Faltantes/Sobrantes/Total
- Usa `XLSX.utils.aoa_to_sheet` · nombre archivo `KPIs_YEAR.xlsx`

**Prompt C — `generateReport(mode)`**: ya existía (sesión anterior no documentada). Sin cambio.
- Modos: `'2025'` · `'2026'` · `'comparative'`
- Abre `window.open('','_blank')` con HTML autocontenido: KPIs + top tablas por modo + tabla detalle completa
- Columnas canónicas: `Codigo_tecnico · Descripcion · CONTEO · COSTO $ · VALOR CONTEO · STOCK SISTEMA · VALOR SISTEMA $ · DIFERENCIA · DIFERENCIA $ · FAMILIA · MARCA`
- Distinta de `generateReporteFinal()` (que es solo para el tab Final)

**Prompt D — Fix CSS `#session-restore-banner` (index.html línea 35):**
- Doble atributo `style` en la misma etiqueta: `display:none` duplicado → `align-items`, `gap`, `font-size` ignorados por el navegador
- Fix: fusionados en un solo atributo `style` eliminando el segundo `display:none`

**Funciones nuevas agregadas al mapa JS CLAVE (documentación):**
- `exportResumenGlobalExcel(year)` — exporta KPIs en Excel (1 hoja, 13 filas)
- `generateReport(mode)` — reporte HTML en nueva pestaña para 2025/2026/comparative

**node --check → OK ✓**

---

### V7.3 — 2026-05-29

**Regla permanente — Títulos de columnas idénticos al Excel real**

Todos los títulos de datos en la app, informes descargables, PDFs y análisis DEBEN ser exactamente iguales a los del Excel de inventario de El Manzano. No inventar nombres alternativos.

**Columnas canónicas (del Excel real):**
`Codigo_tecnico` · `Descripcion` · `CONTEO` · `COSTO $` · `VALOR CONTEO` · `STOCK SISTEMA` · `VALOR SISTEMA $` · `DIFERENCIA` · `DIFERENCIA $` · `FAMILIA`

**Cambios aplicados en app.js:**
- `buildEmbudoProductTable`: `Código` → `Codigo_tecnico`, `Descripción del Producto` → `Descripcion`
- `renderAnalisisFinal` tops faltantes/sobrantes: `Código` → `Codigo_tecnico`, `Producto` → `Descripcion`
- `renderAnalisisFinal` tabla detalle (rf-tabla): `Código` → `Codigo_tecnico`, `Descripción` → `Descripcion`
- `exportTableToExcel` comparativa: `Producto` → `Descripcion`, `STOCK SIS. 25/26` → `STOCK SISTEMA 25/26`, `VALOR SIS. 25/26` → `VALOR SISTEMA $ 25/26`

**node --check → OK ✓**

**NO tocado:** `buildEmbudoGroupTable`, `renderDrilldown`, `exportDrilldownTable` (ya tenían headers correctos), KPI cards (son labels de resumen, no columnas de datos), lógica de filtrado, parseo, cálculos.

---

### V7.2 — 2026-05-29

**Fix — `renderCorrelativo()`: guard `if (!tbody) return` (handlers Avanzado/Final/Mejoras no respondían)**

**Causa raíz:** `renderCorrelativo()` (línea 3295) hacía `document.getElementById('corr-tbody')` → null (vista correlativo eliminada en V5.3). Como `corrState.rows` arranca vacío, entraba al branch `!corrState.rows.length` y ejecutaba `tbody.innerHTML = ''` → TypeError. Ese error abortaba el bloque DOMContentLoaded, dejando sin registrar los handlers de `data-mode="2025v2"`, `"mejoras"` y `"final"` → esos 3 botones no respondían al clic.

**Fix aplicado:** Una línea insertada justo después de `const tbody = document.getElementById('corr-tbody')`:
```js
if (!tbody) return; // vista correlativo eliminada (V5.3) — evita TypeError que aborta DOMContentLoaded
```

**Verificaciones:**
- `node --check app.js` → OK ✓
- index.html: sin `corr-tbody`, `corr-empty`, `table-correlativo`, `view-checklist`, `drop-checklist`, ni `data-mode="checklist"` ✓
- `exportChecklistExcel()` y `exportCorrelatjvoExcel()`: tienen null guards propios — solo se activan por interacción de usuario, no en arranque ✓
- `renderModeV2`, `renderAnalisisFinal`, `getRecountRows`: no referencian corrState ni datos de checklist ✓
- Handlers `.tab-btn[data-mode="checklist"]` en DOMContentLoaded: `querySelectorAll` devuelve NodeList vacía (botón no existe) → sin crash ✓

**NO tocado:** resto del cuerpo de `renderCorrelativo()`, `initCorrelativoFromPlanos`, `handleCorrInput`, `finalizarPatente`, `resetCorrelativo`, `addCorrelatjvoRow`, `exportCorrelatjvoExcel`, `exportChecklistExcel`, ningún bloque DOMContentLoaded, index.html, style.css.

---

### V7.1 — 2026-05-29

**Fix — `readFileData()`: avance de patentes no se llenaba (2 bugs)**

**Bug 1 — sheet names en mayúsculas no reconocidas:**
- `registroSheets` tenía `['busqueda',...]` — el Excel real tiene `BUSQUEDA` y `REGISTROS` (caps)
- `wb.SheetNames.includes()` es case-sensitive → nunca encontraba esas hojas → `_patentesCargadas` quedaba vacío
- Fix: lista ampliada a `['REGISTROS','BUSQUEDA','busqueda','SALA','PATIO','EXHIBICION','SEM','AREA 2','AREA 3','registro2026']`

**Bug 2 — lógica "cualquier fila" en vez de "todas las filas":**
- Código anterior: si UNA fila de la patente tenía CONTEO > 0 → patente marcada como contada
- Correcto según regla de negocio: una patente está contada cuando TODAS sus filas tienen CONTEO > 0
- Fix: nuevo algoritmo por grupos — agrupa filas por patente, cuenta {total, counted}, solo agrega al Set si `counted === total`

**También actualizado:** `invSheets` (mapa inventariador) expandido con las mismas hojas para consistencia.

**Impacto:** `window._patentesCargadas` ahora se llena correctamente al cargar el Excel → `renderCoverageZonas()`, `applyPatenteCellStates()` y `renderPlanoZonaProgress()` reciben datos reales → panel de avance y colores del plano funcionan automáticamente.

**Regla persistente guardada en memoria:** NUNCA tocar `D:\ferreteria-oviedo\` (raíz). Solo `D:\ferreteria-oviedo\APP-INVENTARIO\`.

**NO tocado:** `getPlanoContados`, `_buildCoverageZonas`, `renderCoverageZonas`, `applyPatenteCellStates`, `renderPlanoZonaProgress`, `loadFiles`

---

### V7.0 — 2026-05-29

**Planos — bordes por celda idénticos al Excel (generar_planos.js)**

**Problema:** Las 4 funciones `_planoHtml_X()` generaban HTML sin bordes. SheetJS community (0.18.5) no parsea `border` en `cell.s`. El Excel sí tiene bordes definidos en `xl/styles.xml` (73 definiciones: thin, medium).

**Solución:** Nuevo script `generar_planos.js` que:
1. Lee `xl/styles.xml` directamente del ZIP del XLSX (Node.js `zlib.inflateRawSync`) → 73 definiciones de borde con lados independientes (left/right/top/bottom, style thin/medium/etc.)
2. Lee `xl/worksheets/sheetN.xml` directamente → extrae atributo `s` (xf-index) por celda
3. Mapea: `cell xf-index → CellXf[xfId].borderId → borderDefs[borderId]` → CSS inline
4. CSS: `thin` → `1px solid #000`, `medium` → `2px solid #000`
5. Regenera las 4 funciones con colgroup, merges, fills Y bordes completos

**Resultado verificado:**
- Sala EXHIBICION: 55 patentes ✓
- BODEGA SALA: 212 patentes (+1 vs anterior — mejora de detección)
- BODEGA 2DO PISO SALA: 103 patentes (+3 vs anterior)
- PATIO CONSTRUCTOR: 99 patentes ✓
- **Total: 469 patentes** (vs 465 antes)
- 582 instancias border-top:1px solid, 2987 fills — fiel al Excel
- Fix adicional: eliminado bug `<<colgroup` (doble `<`) que tenía la versión anterior
- `node --check app.js` → OK ✓

**Archivo nuevo:**
- `generar_planos.js` — script generador reutilizable para futuros cambios de plano

**NO tocado:** `renderPlanos()`, `switchPlanoTab()`, `applyPatenteCellStates()`, `renderPlanoZonaProgress()`, `getPlanoContados()`, `loadPlanosFromFile()`

---

### V6.0 — 2026-05-29

**Fix crítico — `PLANO_SHEETS` restaurada + botón Actualizar Plano + tabs Avanzado/Final/Mejoras**

**Bug 1 — `PLANO_SHEETS` no definida (causa raíz de todos los tabs rotos)**
- `PLANO_SHEETS` perdida en sesión V5.3-V5.6. Al ejecutar `renderPlanos()` en DOMContentLoaded, `Object.keys(PLANO_SHEETS)` lanzaba ReferenceError que detenía el bloque completo. Resultado: los `.onclick` handlers de Análisis Avanzado, Análisis Final y Mejoras 2026 nunca se registraban → esos botones no respondían.
- **Fix**: `const PLANO_SHEETS = { 'Sala EXHIBICION': _planoHtml_Sala_EXHIBICION, 'BODEGA SALA': _planoHtml_BODEGA_SALA, 'BODEGA 2DO PISO SALA': _planoHtml_BODEGA_2DO_PISO_SALA, 'PATIO CONSTRUCTOR': _planoHtml_PATIO_CONSTRUCTOR }` insertada justo antes de `renderPlanos()`.
- Ahora todos los tabs del nav (Análisis Avanzado, Análisis Final, Mejoras 2026, Planos) funcionan.

**Feature — Botón "📂 Actualizar Plano" para 2027**
- `index.html`: botón + `<input type="file" id="input-plano-update" hidden>` en `view-planos` header.
- `app.js`: nueva función `loadPlanosFromFile(file)` + helper `_wsToPlanoHtml(ws)`:
  - Lee Excel con SheetJS `cellStyles:true` → preserva merges (rowspan/colspan), colores de fill (#RRGGBB), bordes (top/bottom/left/right).
  - Detecta patentes por regex `/^(\d{2,4})(\s|$)/` → `data-patente` + `class="plano-patente"`.
  - Reconstruye `planosPatentes` desde DOM → re-aplica `applyPatenteCellStates` y `renderPlanoZonaProgress`.
  - Excluye hojas de registro (REGISTROS, BUSQUEDA, etc.) — solo hojas de plano.
- Planos hardcodeados (2026) siguen siendo el render por defecto. El botón es para actualizar a 2027+.
- `planos-empty` legacy eliminado de HTML (no necesario con planos hardcodeados).

**Email/PDF**: revisados — `emailReport()` y `printMode()` funcionan correctamente (encoding OK).

**`node --check` → OK ✓**

### V5.9 — 2026-05-29

**Fix crítico — `getPlanoContados()` restaurada (función borrada en sesión V5.3-V5.6)**

- **Causa raíz**: `getPlanoContados()` fue eliminada accidentalmente en alguna sesión entre V5.3 y V5.6. Era llamada desde `_buildCoverageZonas()` (línea 1162) y desde `applyPatenteCellStates()`. Su ausencia causaba `ReferenceError: getPlanoContados is not defined`.
- **Impacto del bug**: El ReferenceError ocurría en `loadFiles()` en la llamada `renderCoverageZonas(year)` (línea 767), **antes** de `updateSidebarStatus()` (línea 773). Resultado: status quedaba en "Sin archivos", `renderMode()` nunca se llamaba, los gráficos no renderizan, el panel de patentes no aparecía.
- **Fix**: `getPlanoContados()` restaurada según especificación V5.3:
  - Fuente 1: `window._patentesCargadas` (Set construido por `readFileData` desde hojas de registro)
  - Fuente 2: fallback construye Set desde `state.data2025/data2026[].patente`
  - Retorna `null` si sin datos cargados.
- **Insertada** justo antes de `_buildCoverageZonas()`.
- **NO tocado**: `applyPatenteCellStates`, `renderPlanoZonaProgress`, `_buildCoverageZonas`, `loadFiles`, `updateSidebarStatus`.
- **`node --check` → OK ✓**

**Fix V5.8 — App parte limpia (mantenido)**
- DOMContentLoaded llama `clearIDB()` + `localStorage.removeItem(LS_STATE_KEY)` → sin auto-restore.
- `clearAllData()` limpia `#validation-summary`.

### V5.8 — 2026-05-29

**Fix — App parte limpia al abrir (sin auto-restore de sesión)**

- **Causa raíz**: `restoreSession()` se ejecutaba en `DOMContentLoaded` → cargaba datos del IndexedDB previo → `importHashes` llenaba con los 9.162 hashes → al intentar cargar el mismo archivo nuevamente, todas las filas se detectaban como duplicados → `allRows` vacío → `loadFiles()` retornaba antes de `updateSidebarStatus()` → status quedaba en "Sin archivos".
- **Fix**: `DOMContentLoaded` ahora llama `clearIDB()` + `localStorage.removeItem(LS_STATE_KEY)`. La app siempre parte limpia. `restoreSession()` se conserva como función pero no se llama automáticamente.
- **Fix 2**: `clearAllData()` ahora limpia `#validation-summary` (innerHTML + clase `.hidden`) para evitar que queden visibles números de cargas anteriores.
- **NO tocado**: `restoreSession()`, `saveDataToIDB`, `saveStateToLS`, `loadFiles`, `updateSidebarStatus`, lógica de importHashes.
- **`node --check` → OK ✓**

### V5.7 — 2026-05-29

**Auditoría de cierre — Cambios A/D/E/F verificados completos**

Sesión anterior quedó incompleta en el cierre (push pendiente). Auditoría confirmó:

- **CAMBIO A** — Banner `.inv-en-curso` como card: padding 24/30px, icon 48px, body con title (20px/900) + main (16px/600) + note, toggle Unidades|Valor, print-color-adjust. CSS:1625 + markup en `_renderCoverageBanner`. ✓
- **CAMBIO D** — Gráfico "Valor $ Sistema vs Conteo por Zona": nunca existió en el código. No requirió cambio. ✓
- **CAMBIO E** — Desglose interactivo abierto por defecto: `class="acc-content dd-acc-content open"` en index.html:134/217. CSS `.dd-acc-content.open { max-height:none; overflow:visible }`. Table scroll con `max-height: min(78vh, 920px)`. ✓
- **CAMBIO F** — `exportDrilldownTable(year)`: 11 columnas exactas (Codigo_tecnico, Descripcion, CONTEO, COSTO $, VALOR CONTEO, STOCK SISTEMA, VALOR SISTEMA $, DIFERENCIA, DIFERENCIA $, FAMILIA, MARCA), por producto, estilada con `styleSimpleSheet`, hoja RESULTADOS incluida. ✓

**Funciones protegidas V4.1→V4.9:** todas intactas. `renderPlanoGrid` fue reemplazada intencionalmente por `_planoHtml_X()` en V5.3 (cambio documentado).

**`node --check app.js` → OK ✓**

### V5.6 — 2026-05-29

**Fix — `_planoHtml_PATIO_CONSTRUCTOR()`: 72 → 99 patentes**

- **Causa raíz:** la función `isPatente` usaba `/^\d{2,4}$/` (número puro) y no detectaba
  celdas con formato `"NNN texto"` (ej: `"397 MIX"`, `"412 VOLCAN..."`, `"386 tubo"`).
  PATIO CONSTRUCTOR tiene 27 celdas de este tipo — las otras 3 hojas solo tienen números puros.
- **Dato erróneo en V5.5:** la auditoría reportó PATIO 72/72, 0 faltantes — era incorrecto.
  El `isPatente` del script de auditoría tenía el mismo bug que el generador.
- **Fix:** `extractPatente(v)` matchea `/^(\d{2,4})(\s|$)/` — extrae el número inicial,
  permite texto posterior. `data-patente` almacena solo el número; la celda muestra el texto completo.
- **Verificación set-a-set:** Excel=99, HTML=99, missing=0, extra=0. Los 27 reportados
  presentes en HTML: 27/27. Otras 3 funciones intactas (55/211/100).
- **`node --check app.js` → OK ✓**

**Conteo final correcto de patentes hardcodeadas:**
- Sala EXHIBICION: 55
- BODEGA SALA: 211
- BODEGA 2DO PISO SALA: 100
- PATIO CONSTRUCTOR: 99
- **Total: 465 patentes** con `data-patente` correctas

### V5.5 — 2026-05-29

**P1–P3 — Fix regex `/^(d+)/` → `/^(\d+)/` (3 ocurrencias)**

- `readFileData()` línea ~650: bloque `inventariadorMap` usaba literal `d` en lugar de `\d`.
- `applyPatenteCellStates()` línea ~3434: misma regex errónea — cobertura verde/rojo fallaba.
- `renderPlanoZonaProgress()` línea ~3468: misma regex errónea — % por zona fallaba.
- Las 3 ocurrencias corregidas. El bloque `patentesCargadasSet` adyacente ya tenía `\d` — no tocado.

**P4 — Auditoría de fidelidad _planoHtml_X() vs Excel real**

- Causa raíz detectada: `BODEGA SALA` tiene `ref E1:CS55` (columna inicial = E, offset=4).
  `sheet_to_json({header:1})` devuelve índices **relativos** (E→0), pero `ws['!merges']` usa
  índices **absolutos** (E→4). El generador original usó `ci` relativo para buscar en
  `spanMap`/`skipSet` con coordenadas absolutas → **69 patentes perdidas** en BODEGA SALA
  (de 211 solo se generaron 143).
- Las otras 3 hojas tienen `ref A1:...` (offset=0), por eso no tenían discrepancia.

**P5 — Regeneración corregida de las 4 funciones _planoHtml_X()**

- Script regenerador corregido: calcula `colOffset = refStart.c` y `rowOffset = refStart.r`
  desde `ws['!ref']`; todas las búsquedas en `skipSet`/`spanMap` y los accesos a
  `ws[addr]` usan coordenadas absolutas (`absR = ri + rowOffset`, `absC = ci + colOffset`).
- Resultado verificado (0 faltantes, 0 extras):
  - Sala EXHIBICION:       Excel=55  HTML=55  ✓
  - BODEGA SALA:           Excel=211 HTML=211 ✓  (antes: 143, +68 recuperadas)
  - BODEGA 2DO PISO SALA:  Excel=100 HTML=100 ✓
  - PATIO CONSTRUCTOR:     Excel=72  HTML=72  ✓
- Total: 438 patentes con `data-patente` correctas, merges/rowspan/colspan y colores RGB fieles al Excel.
- `node --check app.js` → OK ✓

**NO tocado:** `renderPlanos()`, `switchPlanoTab()`, `applyPatenteCellStates()` (firma y lógica),
`renderPlanoZonaProgress()` (firma y lógica), CSS `.plano-patente/-lista/-pendiente/.plano-inv-badge`,
`exportPlanosExcel`/`exportSheetExcel`/`countPatentesInSheet` (stubs intencionales).

### V5.4 — 2026-05-29

**Fix — `isInvalidNumericInput()`: guion contable Excel = cero válido**

- Contexto: celdas con guion contable (`"-"`, `"$ -"`, `"- "`) generaban ~7.625 advertencias
  "tipo numérico inválido" al cargar archivos reales. En Excel, ese símbolo representa cero.
- Fix en `isInvalidNumericInput()` (~línea 275 app.js): después de quitar símbolos monetarios,
  puntos de miles, comas y espacios, si el string restante es vacío o solo guiones → retorna
  `false` (es cero válido, no inválido).
- Ninguna lógica de cálculo tocada — solo la función de validación de entrada.
- Verificado: `node --check app.js` → OK ✓

**Fix — `readFileData()`: regex `/^(\d+)/` corregida en bloque inventariadorMap**

- El bloque que construye `window._inventariadorPorPatente` usaba `pat.match(/^(d+)/)` 
  (matcheaba la letra "d", no dígitos). Corregido a `pat.match(/^(\d+)/)`.
- Solo esa línea tocada. El bloque `patentesCargadasSet` adyacente ya tenía la regex correcta.

### V5.3 — 2026-05-29

**PROMPT-1 — 4 cambios visuales y de lógica**

**C1 — Eliminar menú CheckList**
- `index.html`: eliminados botón tab `data-mode="checklist"`, `div#view-checklist` completo y `div#drop-checklist` del sidebar.
- `app.js` DOMContentLoaded: eliminado bloque de drag&drop del checklist (referencias a elementos ya inexistentes).
- Guard `if (mode === 'checklist' || mode === 'planos') return` en `refreshView()` — ya existía, conservado.
- `switchToMode` allViews: `'checklist'` sigue en la lista (inofensivo, el view no existe pero no rompe).

**C2 — Patentes y zonas contadas automáticas**
- `readFileData()`: nuevo bloque que lee hojas `['busqueda','AREA 2','AREA 3','registro2026','SALA','PATIO']` y construye `window._patentesCargadas` (Set) con patentes que tienen CONTEO > 0. Fix aplicado: `?.[1]` en lugar de `?.` (syntax error del prompt).
- `getPlanoContados()`: reescrita — Fuente 1 es `window._patentesCargadas`; Fuente 2 es fallback desde `row.patente`.
- `loadFiles()`: agrega `renderCoverageZonas(year)` después de `saveDataToIDB`.

**C3 — Conteo de productos consistente en banner**
- `_renderCoverageBanner()`: calcula `prodContados` = filas con `unidades_real > 0` y `prodTotal` = total filas. Línea principal muestra "X de Y productos contados (Z%)". Sub-línea muestra unidades (toggle existente conservado).

**C4 — Títulos KPIs idénticos a planilla Excel**
- `renderKPIs()`: reordenado y renombrado — TOTAL UNID. SISTEMA → TOTAL UNID. FÍSICO → DIFERENCIA UNIDADES → EXACTITUD UNIDADES → DIFERENCIA $ → EXACTITUD $.
- `renderCountKPIs()`: PRODUCTOS EXACTOS / FALTANTES (fondo rojo suave) / SOBRANTES (fondo verde suave).
- `renderMonetaryKPIs()`: TOTAL $ SISTEMA / TOTAL $ FÍSICO / DIFERENCIA $ / DIFERENCIAS + SOBRANTES / DIFERENCIAS − FALTANTES / DISPERSIÓN TOTAL.
- `renderKPIsComp()` no tocada.

**PROMPT-2 — Tabla res-table en generateReporteFinal()**
- Helper local `_pct(val, decimals)` creado dentro de `generateReporteFinal()` — NO redefinió `fmtPct()` global (que rompe 15+ callers).
- Columna EN % en `res-table`: base monetaria (`m.totalSistema`), formato chileno (coma decimal), colores por fila (rojo Diferencias/Faltantes, azul Sobrantes, neutro Dispersión). Diferencias obtiene su % (antes mostraba `—`).
- Card KPI "Dispersión Total" corregida para usar `pctDisp` como número con `.toFixed(2).replace('.',',')`.
- Punto 6 del prompt (hoja RESULTADOS xlsm) no implementado — no existe en el código.

**PROMPT-3 + PROMPT-4 fusionados — Planos hardcodeados + colorización**

**Arquitectura nueva: plano fijo sin carga de archivo**
- Eliminado `div#drop-planos` del sidebar en `index.html`.
- Eliminado bloque drag&drop de planos en DOMContentLoaded de `app.js`.
- `renderPlanos()` ya no recibe `allSheetNames` — llama funciones hardcodeadas.
- `renderPlanos()` se llama en DOMContentLoaded → plano visible inmediatamente al abrir la app.

**HTML hardcodeado desde Excel real**
- Script Node.js generó 4 funciones `_planoHtml_X()` desde `Planos patentes 2026 EM.xlsx`:
  - `_planoHtml_Sala_EXHIBICION()` — 34 filas, 49 cols, 109 merges, 55 patentes únicas (10–64)
  - `_planoHtml_BODEGA_SALA()` — 55 filas, 93 cols, 262 merges, 211 patentes únicas (65–278)
  - `_planoHtml_BODEGA_2DO_PISO_SALA()` — 57 filas, 51 cols, 137 merges, 100 patentes únicas (279–378)
  - `_planoHtml_PATIO_CONSTRUCTOR()` — 70 filas, 48 cols, 147 merges, 72 patentes únicas (379–478)
- Total: 373 celdas `data-patente` generadas.
- Colores RGB del Excel preservados con `background:#RRGGBB` inline.
- `const PLANO_SHEETS` mapea nombre → función generadora.

**Colorización post-render (DOM)**
- `applyPatenteCellStates()`: aplica `.plano-patente-lista` (verde) o `.plano-patente-pendiente` (borde rojo) sobre celdas `data-patente` ya renderizadas. Badge con primer nombre del inventariador en celdas listas.
- `renderPlanoZonaProgress(sheetName)`: barra de progreso por hoja (contadas/pendientes/%).
- `switchPlanoTab(name)`: switch de tabs por `data-sheet`.

**PROMPT-3 PASO 1 — Mapa inventariador**
- `readFileData()`: nuevo bloque que lee hojas `['REGISTROS','BUSQUEDA','busqueda','registro2026']` y construye `window._inventariadorPorPatente` (Map patente→nombre).

**Auto-refresh**
- `loadFiles()`: después de cargar 2025/2026, si hay `.plano-patente` en el DOM → llama `applyPatenteCellStates()` + `renderPlanoZonaProgress()` por cada hoja.
- Tab Planos: onclick también re-aplica estados si hay datos cargados.

**CSS agregado a style.css**
- `.plano-overflow-wrap`, `.plano-table`, `.plano-patente`, `.plano-patente:hover`, `.plano-patente-pendiente`, `.plano-patente-lista`, `.plano-inv-badge`, `.plano-zona-progress-bar`, `.plano-prog-*`, `.plano-tab-btn`, `.plano-tab-btn.active`.

**NO tocado:** `calcKPIs`, `calcMonetarySummary`, `getFilteredData`, `renderMode*`, sistema de filtrado, persistencia, reconteo, exports, email/print, `fmtPct` global, `venAdmParseFecha`, `venAdmFmt`.

**Verificación:** `node --check app.js` pendiente (ver PENDIENTE).

### V5.2 — 2026-05-28

**FASE 1 — Robustez de datos incremental**

**Validación previa antes de consolidar**
- Nueva función `validateInventoryRows(rows, ctx)` aplicada en `loadFiles()` y `applyMapping()` después del mapeo y antes de concatenar en `state.data2025/data2026`.
- Valida filas vacías, SKU vacío, tipos numéricos inválidos, números negativos, valores/pesos negativos, posibles duplicados producto/patente y duplicados exactos.
- Duplicados exactos se omiten como advertencia para prevenir doble carga accidental.
- Advertencias no bloquean operación. Solo bloquea si no quedan filas válidas o faltan columnas críticas.

**Resumen visual**
- Nuevo placeholder `#validation-summary` en sidebar.
- Nueva función `renderValidationSummary(summary)` muestra:
  - Filas válidas
  - Advertencias
  - Errores críticos
  - Detalle breve de filas vacías/duplicadas/primeras advertencias.

**Normalización interna**
- Nuevas funciones:
  - `normalizeInventoryValue()`
  - `normalizeSku()`
  - `normalizeProductName()`
  - `normalizeNumber()`
- `parseNum()` ahora delega en `normalizeNumber()` para mejorar formatos chilenos y caracteres invisibles.
- `applyRowMapping()` agrega `_sku_norm` y `_producto_norm` para matching/validación interna sin cambiar nombres visibles ni columnas exportadas.

**Metadata por fila**
- Nuevas funciones:
  - `buildCompositeKey(row)`
  - `buildRowHash(row)`
- Cada fila válida recibe `sourceFile`, `importTimestamp`, `compositeKey`, `rowHash`.

**Persistencia de reglas de mapeo**
- Nuevo `LS_MAPPING_RULES_KEY = appInv_mapping_rules_v1`.
- Nuevas funciones `loadMappingRules()`, `saveMappingRules(mapping)`, `applySavedMappingRules(headers, mapping)`.
- Los mapeos detectados o manuales se guardan en `localStorage` para acelerar cargas futuras.

**NO tocado:** filtros, comparativos, exports, KPIs, persistencia IndexedDB existente, Planos, reconteo, email/print, `getFilteredData`, `renderMode*`.

**Verificación:** `node --check app.js` → OK ✓

### V5.1 — 2026-05-28

**CAMBIO B — Nuevo panel "Avance de conteo: Patentes y Zonas"**
- Nueva función `renderCoverageZonas(year)` debajo del banner de inventario en curso para vistas 2025/2026.
- Nuevo helper `_buildCoverageZonas()` cruza el universo ya cargado desde Planos (`planosPatentes`, derivado de `planosData`) contra el set existente de contadas (`getPlanoContados()`).
- El panel muestra total global "X de Y patentes contadas (Z%)", semáforo y detalle por sala/zona con lista de patentes faltantes.
- Si aún no hay Planos cargados, muestra una card informativa para cargar Planos y poder cruzar el universo real.
- Texto operativo agregado: "Terminar conteo → pasar a reconteo con base completa."

**CAMBIO C — Destaque post-carga de paneles de avance**
- Nueva función `_showLoadedYearCoverage(year)` activa la vista del año cargado después de leer inventario.
- Nueva función `_highlightCoveragePanels(year)` hace scroll y aplica destaque breve a los paneles de unidades/valor y patentes/zonas.
- `loadFiles()` y `applyMapping()` usan el nuevo flujo post-carga.
- `loadPlanos()` re-renderiza los paneles de patentes/zonas para 2025/2026 cuando se actualiza el universo de Planos.

**index.html / style.css:**
- Placeholders `inv-coverage-zonas-2025` y `inv-coverage-zonas-2026`.
- Nuevas clases `.inv-zonas-*` con estilo ámbar destacado consistente con V4.9/V5.0 y animación `.coverage-pulse`.

**NO tocado:** `getPlanoContados`, `renderPlanoGrid`, `renderPlanos`, merges de Planos, colores verde/rojo de cobertura, cálculos V4.9/V5.0, reconteo, persistencia, email/print.

**Verificación:** `node --check app.js` → OK ✓

### V5.0 — 2026-05-28

**CAMBIO A — Banner "Inventario EN CURSO" más visible**
- `_renderCoverageBanner(data, ctx)`: markup reorganizado en icono, cuerpo textual y toggle.
- `style.css`: `.inv-en-curso` pasa a card destacada con más padding, borde izquierdo ámbar más fuerte, título legible, sombra y layout responsive.
- Conservado: color ámbar, ⏳, toggle Unidades|Valor, impresión en color y umbral/lógica de `getCountCoverage`.

**CAMBIO D — Gráfico zona eliminado/verificado**
- Verificado que no existen `chart-zona-*`, texto "Sistema vs Conteo por Zona" ni llamada `groupedBarChart` asociada a zona en `index.html`/`app.js`.
- No se tocaron los demás gráficos del grid.

**CAMBIO E — Énfasis al Desglose interactivo**
- `index.html`: acordeón de `drilldown-2025` y `drilldown-2026` queda abierto por defecto.
- `style.css`: bloque `.dd-section` destacado, más espacio, título mayor y scroll interno alto/cómodo para `#dd-tbl-{year}` sin recortes agresivos.
- Conservado: `toggleAcc(btn)` e `initAccordions()` siguen conectados a DOMContentLoaded.

**CAMBIO F — Excel del Desglose en formato TABLA_ANALISIS**
- `exportDrilldownTable(year)`: hoja `TABLA_ANALISIS` genera 11 columnas exactas:
  `Codigo_tecnico`, `Descripcion`, `CONTEO`, `COSTO $`, `VALOR CONTEO`, `STOCK SISTEMA`, `VALOR SISTEMA $`, `DIFERENCIA`, `DIFERENCIA $`, `FAMILIA`, `MARCA`.
- Export por producto usando `getFilteredData(year)`.
- Estilado cambiado a `styleSimpleSheet(ws, rows)` para header #002060/blanco, bordes, datos blancos, freeze A2, formatos y condicional rojo/azul en columnas de diferencia.
- Hoja `RESULTADOS` se mantiene y también se estiliza con `styleSimpleSheet`.

**NO tocado:** `getCountCoverage`, `_toggleCoverage`, cálculos de KPI/monetarios, filtros, persistencia, reconteo, planos, email/print, demás gráficos.

**Verificación:** `node --check app.js` → OK ✓

### V4.9 — 2026-05-28

**Banner "Inventario EN CURSO" — conteo parcial (solo informativo, sin tocar cálculos)**

**Nuevas funciones (app.js):**
- `getCountCoverage(data, modo)` — calcula % de inventario contado:
  - `'unidades'`: contados=Σ `unidades_real` / total=Σ `unidades_sistema`
  - `'valor'`: contados=Σ `peso_real` / total=Σ `peso_sistema`
  - Devuelve `{ modo, contados, total, pct }`
- `_renderCoverageBanner(data, ctx)` — inyecta banner si `pct < COUNT_EN_CURSO_PCT (90)`
- `_toggleCoverage(ctx, modo)` — toggle Unidades|Valor del banner (sin re-render completo)
- Constante `COUNT_EN_CURSO_PCT = 90` — umbral configurable
- Estado `window._coverageModo` + `window._coverageData` — por contexto (`'2025'`/`'2026'`/`'final'`)

**Llamadas añadidas (1 línea cada una):**
- `renderMode(year)`: `_renderCoverageBanner(data, year)` antes de `renderResumenGlobal`
- `renderAnalisisFinal()`: `_renderCoverageBanner(data, 'final')` después de `emptyEl.style.display='none'`

**index.html:** 3 divs placeholder (`inv-coverage-banner-2025`, `-2026`, `-final`)

**style.css:** clase `.inv-en-curso` (fondo ámbar #fff7ed, borde #fed7aa, borde-left naranja #f97316, color oscuro #7c2d12) + `.inv-en-curso-toggle` con botones activo/inactivo. Incluye `print-color-adjust: exact` para PDF/impresión en color.

**Comportamiento:**
- Inventario completo (≥90%): sin banner
- Inventario parcial (<90%): banner ámbar con ⏳ + toggle Unidades|Valor
- Toggle recalcula `getCountCoverage` y re-inyecta solo el banner (no re-renderiza la vista)
- Se imprime en color (respeta `print-color-adjust` existente)

**NO tocado:** `calcKPIs`, `calcMonetarySummary`, `renderResumenGlobal`, `renderKPIs`, `renderMonetaryKPIs`, ningún cálculo existente.

**Verificación:** `node --check app.js` → OK ✓

### V4.8 — 2026-05-28 (MERGE celular + V4.6)

**Origen del merge:**
- Rama TRABAJO (V4.6): exportTableToExcel reescrita con estilos, buildFamiliaIndex+subfamilia, bordes .data-table, títulos canónicos, regla anti-retroceso.
- Rama celular (origin/main dc02e99→77160a0): `styleSimpleSheet()`, renombres HIPERMALIA→HIPERFAMILIA en salidas, y workflow `.github/workflows/deploy-inventario.yml`.

**CAMBIO 1 — styleSimpleSheet agregado (de celular)**
- Función `styleSimpleSheet(ws, rows)` insertada antes de `styleAnalisisSheet`.
- Estilador genérico de propósito general: header #002060 blanco, bordes FFBBBBBB, columnas auto, formato `$ #,##0` / `#,##0` según encabezado, condicional rojo/azul en DIFERENCIA/DIF, freeze A2, datos con `patternType:'none'`.
- `styleAnalisisSheet` conservado (TABLA_ANALISIS 12-col — anchos fijos, formatos por índice).

**CAMBIO 2 — exportTableToExcel refactorizada para usar styleSimpleSheet**
- Inline style logic eliminada (HDR_FILL, HDR_FONT, HDR_ALIGN, isNumCol, isMoneyCol, colWidths, bucle ws manual).
- Ahora: `XLSX.utils.aoa_to_sheet(allRows)` + `styleSimpleSheet(ws, allRows)`.
- CONSERVADO de V4.6: extracción DOM thead/tbody/tfoot, hoja LEYENDA, override footer TOTAL azul `FFDBEAFE` aplicado después de `styleSimpleSheet`.

**CAMBIO 3 — HIPERMALIA → HIPERFAMILIA en headers de salida Excel**
- Líneas de output cambiadas: `exportDrilldownTable` (header array `~l.1541`), `exportFinalExcel` hoja 1 (`~l.3605`) y hoja 3 (`~l.3638`).
- Aliases de lectura (`FIELD_ALIASES`, `rowValueByAliases`) — intactos. Siguen reconociendo 'HIPERMALIA' como typo real de los archivos EM.

**CAMBIO 4 — Workflow deploy-inventario.yml (de celular)**
- Copiado a `D:\ferreteria-oviedo\APP-INVENTARIO\.github\workflows\deploy-inventario.yml`.
- Dispara en push a main con paths `APP-INVENTARIO/**` o vía `workflow_dispatch`.
- Despliega a GitHub Pages usando la carpeta `APP-INVENTARIO` como raíz.

**Verificación:**
- `node --check app.js` → sin errores ✓
- Aliases HIPERMALIA de lectura intactos ✓
- styleSimpleSheet es el único estilador genérico; styleAnalisisSheet conservado para TABLA_ANALISIS ✓
- Mejoras V4.1→V4.6 sin regresiones ✓

### V4.6 — 2026-05-28

**CAMBIO 0 — Regla anti-retroceso escrita en AGENTS.md**
- Lista de funcionalidades V4.1→V4.5 protegidas con descripción explícita de qué no tocar

**CAMBIO 1 — Fix Excel fondo negro (exportTableToExcel + styleAnalisisSheet)**
- xlsx-js-style usa ARGB de 8 dígitos. Todos los `rgb:` corregidos: `'002060'` → `'FF002060'`, `'FFFFFF'` → `'FFFFFFFF'`, `'C00000'` → `'FFC00000'`, `'0000FF'` → `'FF0000FF'`, `'000000'` → `'FF1F2937'`
- Celdas de datos: `fill:{}` → `fill:{patternType:'none'}` para evitar relleno negro por defecto
- Footer: `fgColor:{rgb:'DBEAFE'}` → `fgColor:{rgb:'FFDBEAFE'}`

**CAMBIO 2 — Títulos canónicos verbatim (app.js + index.html)**
- "Dif Unid"/"DIF UNID" → "DIFERENCIA" en todas las tablas
- "Dif $"/"DIF $"/"Impacto $" → "DIFERENCIA $"
- "Stock Sist." → "STOCK SISTEMA"
- "Valor Sistema" → "VALOR SISTEMA $"
- "Valor Conteo" → "VALOR CONTEO"
- "Diferencia neta" → "Diferencias" (cuadro RESULTADOS)
- "Dispersión (|+|+|−|)" → "Dispersion" (cuadro RESULTADOS)
- Contextos multi-año conservan sufijo: "DIFERENCIA 2025", "DIFERENCIA $ 2026"

**CAMBIO 3 — Bordes completos en tablas (style.css)**
- `.data-table th`: `border-bottom` → `border: 1px solid #c9ced6` (bordes en los 4 lados)
- `.data-table td`: `border-bottom` → `border: 1px solid #c9ced6`
- `.data-table tr:last-child td` eliminado (ya no relevante)

**CAMBIO 4 — Planos: zoom reducido (style.css)**
- `.plano-raw-table`: `font-size: 11px` → `9px`, `padding: 3px 5px` → `1px 3px`, `height: 26px` → `18px`, `min-width: 30px` → `22px`
- `.cell-num`: `font-size: 12px` → `10px`, `min-width: 38px` → `28px`
- Bordes ya existían; merges (V4.4) y cobertura verde/rojo (V4.1) intactos

**CAMBIO 5 — Categorías completas desde hoja FAMILIA (app.js)**
- `buildFamiliaIndex`: agrega campo `subfamilia` al índice
- Cadena enriquecimiento `_subfamilia`: agrega `|| cleanText(fam.subfamilia)` como segundo fallback
- `applyRowMapping`: fallback `'Sin clasificar'` para `marca`, `familia`, `perfamilia` cuando quedan vacíos tras enriquecimiento

**NO tocado:** cálculos de KPIs, parseo CSV, sistema de filtrado, drilldown, gráficos, persistencia, planos merges/cobertura, email Final, impresión

### V4.4 — 2026-05-28

**CAMBIO 1 — Planos: soporte de celdas combinadas (merges)**

- `loadPlanos()`: agrega `planosDataMerges = {}` paralelo a `planosData`; por cada hoja lee `ws['!merges'] || []`
- `renderPlanoGrid(rows, zone, contados, merges)`: nuevo parámetro `merges`; construye `spanMap` (`rowspan`/`colspan` por clave `"r,c"`) y `skipSet` (celdas cubiertas que se omiten); genera `<td rowspan= colspan=>` donde el Excel tenía merge
- `renderPlanos()`: pasa `planosDataMerges[name]` a `renderPlanoGrid`
- `style.css`: `table-layout: auto` (antes `fixed`), fondo blanco en celdas, bordes `#cbd5e1`, `td[rowspan]/td[colspan]` en negrita
- Patentes siguen en amarillo (#FEFF9C) sin datos, verde/rojo con datos — capa cobertura intacta
- `getPlanoContados`, `_planoLabelStyle`, `extractPatentesFromGridSheets`, `showPlanoSheet` no tocados

**CAMBIO 2 — Email Final: quitar auto-print bloqueante**

- `emailReport(mode)` rama `'final'`: eliminados `printMode('final')` y `setTimeout(..., 800)` que causaban conflicto con diálogo de impresión modal
- Ahora abre `window.location.href = mailto:...` directamente, sin depender del diálogo de impresión
- Nota del cuerpo del correo actualizada: "usa el botón 🖨 Imprimir / PDF → Guardar como PDF, y adjunta el PDF aquí"
- `index.html`: botón `🖨 Imprimir` en view-final renombrado a `🖨 Imprimir / PDF` para mayor claridad
- El PDF y el email son ahora acciones independientes; el botón Imprimir/PDF sigue generando el PDF

**NO tocado:** `calcKPIs`, `calcMonetarySummary`, otras ramas de `emailReport`, `printMode`, `renderAnalisisFinal`, ninguna función de parseo o filtrado

### V4.3 — 2026-05-28

**P1 — IMPRESIÓN/EMAIL/REPORTE EN COLOR Y DESDE LA VISTA ACTIVA**

**CAMBIO 1 — Color en impresión (style.css, @media print general ~línea 638)**
- `* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }` agregado dentro del bloque general
- Cambiado `display: block !important` → `display: none !important` en `.view` y `.view.hidden` para que SOLO la vista activa imprima (fix: antes mostraba TODAS las vistas)
- Canvas/chart-wrap: `height: 180px !important; overflow: visible !important` + `canvas { max-width:100%; height:180px }`
- KPIs con color, números rojo/azul, fondos y gráficos se imprimen correctamente

**CAMBIO 2 — getActiveViewMode() + botones imprimir/email/reporte desde vista activa**
- Nueva función `getActiveViewMode()`: devuelve el modo del `.view:not(.hidden)` via `id.replace('view-','')` (fallback cuando no hay `data-mode` en el elemento view)
- `printMode(mode)`: si no llega `mode`, usa `getActiveViewMode()`
- `emailReport(mode)`: `mode = mode || getActiveViewMode()` al inicio
- `generateReporteFinal(mode)`: recibe `mode` opcional (no lo usa internamente, pero unifica la firma)

**P2 — EXCEL PROFESIONAL**

**CAMBIO 3 — exportTableToExcel con estilos profesionales**
- Reescrita para no usar `table_to_sheet` plano
- Extrae datos DOM → detecta tipos de celda (texto/número) → detecta columnas monetarias por encabezado (`$`, `VALOR`, `COSTO`, etc.)
- Encabezado: fondo #002060, blanco, negrita, centrado
- Bordes finos `THIN_BDR` en TODAS las celdas
- Anchos automáticos por contenido (máx 40)
- Formato `$ #,##0` para monetarias, `#,##0` para cantidades
- Condicional rojo/azul en columnas que contienen "DIFERENCIA" o "DIF"
- Pie de tabla (tfoot con "TOTAL"): fondo #DBEAFE, negrita
- Freeze fila 1
- Hoja extra `LEYENDA`: explica columnas clave (DIFERENCIA, DISPERSIÓN, CONTEO, etc.) + timestamp

**P3 — VISTAS MÁS CLARAS**

**CAMBIO 4 — Centro Reconteo: prioridad por impacto $, clic en ranking filtra tabla**
- Nueva función `_recountPriority(r)`: confirmados → fondo, resto por |money| DESC
- Nueva función `_recountSemaforoColor(r, maxImpacto)`:
  - Confirmado → verde · Recontado → azul
  - pct ≥ 50% → rojo · pct ≥ 20% → naranja · resto → amarillo
- `renderRecount()` ahora ordena `sorted` por `_recountPriority` DESC antes de renderizar
- Dot de semáforo (12px, color) antes de cada state-pill en la tabla principal
- Fila destacada (`id="recount-row-{rowId}"`, fondo amarillo + outline naranja) cuando `window._recountHighlightId` está activo; scroll automático a la fila
- Nueva función `recountFiltrarPorFila(rowId)`: sets `window._recountHighlightId`, limpia búsqueda, llama `renderRecount()`, hace scroll a la tabla
- Nueva función `recountLimpiarFiltro()`: limpia highlight y re-renderiza
- `renderRecountRankings()`: cada `<tr>` tiene `onclick="recountFiltrarPorFila(rowId)"` + cursor:pointer + title "Clic para destacar en la tabla principal"
  - Dot de semáforo (10px) en columna nueva antes del nombre
  - Color de valor en ranking usa `semColor` (semáforo) en vez de rojo/azul fijo
  - `globalMax` calculado sobre todos los rows para comparación uniforme

**CAMBIO 5 — Análisis Avanzado: orden y legibilidad**
- Top Riesgo $ reubicado como primera sección en index.html (borde izquierdo rojo + "Atacar primero")
- Tablas `renderV2PatenteTable`, `renderV2CostoRangos`, `renderV2Riesgo`: cambiadas de `class="tbl"` (sin CSS) → `class="data-table"` con `.num` en todas las columnas numéricas
- `div.tbl-wrap` → `div.table-scroll` (scroll vertical con max-height)
- Encabezados de columna más claros: "Prods" en vez de "Productos", "Valor Sist." en vez de "Valor Sistema", etc.
- Top Riesgo: código en `font-family:monospace`, producto truncado con `title` attribute

**CAMBIO 6 — Planos: fiel al Excel + etiquetas especiales**
- Nueva función `_planoLabelStyle(raw)`: detecta DESPACHO (rojo), ZONA DE SEGURIDAD (naranja), BAÑO (azul), SALA DE VENTAS (verde), PASILLO (gris), CAJA (violeta), BODEGA (verde oscuro)
- `renderPlanoGrid()`: sin datos de inventario → patentes en amarillo `#FEFF9C` (como el Excel modelo, antes usaba color de zona)
- Con datos de inventario: verde (contada) / rojo (sin contar) — sin cambios
- Etiquetas especiales reciben estilo inline de `_planoLabelStyle`

**CAMBIO 7 — CheckList: columnas sticky para scroll horizontal**
- `th.col-task` y `th.col-resp` → `position: sticky; left: 0/180px; z-index:3`
- `td.td-task` y `td.td-resp` → `position: sticky; left: 0/180px; z-index:1; background: inherit`
- `th.col-today` → font-weight:800; font-size:11px (más prominente)
- Nueva clase `td.td-today` → fondo `#fff7ed` + borde naranja (para celda de hoy en datos)
- `th.col-weekend` → opacity:.7

**Funciones nuevas:**
- `getActiveViewMode()` (app.js)
- `_recountPriority(r)` (app.js)
- `_recountSemaforoColor(r, maxImpacto)` (app.js)
- `recountFiltrarPorFila(rowId)` (app.js)
- `recountLimpiarFiltro()` (app.js)
- `_planoLabelStyle(raw)` (app.js)

**NO tocado:** `renderAnalisisFinal`, `_renderFinalChart`, `_renderFinalBarras`, `exportFinalExcel`, `getPlanoContados`, cálculos base de KPIs, ninguna función de parseo

**Verificación:**
- `node --check app.js` → sin errores de sintaxis ✓
- FIELD_ALIASES verificados contra xlsx 2025/2026 reales → alias cubren todos los encabezados ✓

### V4.2 — 2026-05-28

**CAMBIO 1 — CSS @media print para vista Final (style.css)**
- Bloque `@media print` agregado al final de style.css específico para `#view-final.print-active`
- `.print-page-2` para salto de página entre RESULTADOS+gráficos y Tops+Hiperfamilia
- `.no-print` oculta filtros y botones en impresión
- Límite Top N=12 filas por tabla vía CSS `nth-child(n+13) { display:none }`
- Encabezados tabla: fondo #002060 blanco, bordes finos, tipografía 9-10px
- Gráficos reducidos a 160px de altura, grid 2 columnas
- `@page { size: letter; margin: 12mm }`

**CAMBIO 2 — emailReport('final') con cuadro RESULTADOS real (app.js)**
- Rama `if (mode === 'final')` en `emailReport()`: no lee `#kpi-final` (no existe)
- Lee directamente `state.data2026 / state.data2025` + `calcKPIs()` + `calcMonetarySummary()`
- Cuerpo email incluye Total Sistema/Conteo, Dif neta, Sobrantes, Faltantes, Dispersión con %
- Llama `printMode('final')` primero → instruye generar PDF → luego `setTimeout(800ms)` abre mailto
- Nota explícita: navegadores no permiten adjuntar archivos vía mailto

**CAMBIO 3 — generateReporteFinal() — Reporte interactivo en nueva pestaña (app.js)**
- Nueva función `generateReporteFinal()` antes de `printMode()`
- Abre `window.open('','_blank')` con HTML autocontenido (~280 líneas)
- Embebe `RF_DATA = JSON.stringify(data)` completo en el HTML generado
- ÍNDICE con anclas: #resumen · #tops · #graficos · #detalle · #por-hiper
- Sección 1 «Resumen Ejecutivo»: 6 KPI cards + tabla RESULTADOS completa
- Sección 2 «Top Faltantes y Sobrantes»: Top 15 cada uno con color rojo/verde
- Sección 3 «Gráficos»: 4 charts vivos con Chart.js CDN (marca/familia/hiper/barras)
  - Al filtrar, `rfRenderGraficos(filtered)` re-renderiza los 4 gráficos en tiempo real
- Sección 4 «Detalle Completo»: TODAS las filas del dataset sin recortar
  - Filtros en cascada: Hiperfamilia → Familia → Subfamilia → Marca (selects dependientes)
  - `rfCascada()` re-filtra tabla y gráficos simultáneamente
  - `rfLimpiarFiltros()` restaura vista completa
  - Tabla: 12 columnas, encabezado sticky, scroll, condicional rojo/azul en DIF UNID / DIF $
  - Totales en tfoot con fondo azul
  - Badge "X / Y filas" actualizado al filtrar
- Sección 5 «Resumen por Hiperfamilia»: tabla agregada con % exactitud unid y $
- `@media print` propio en el reporte: oculta filtros, limita tablas a 12 filas, encabezados #002060
- `class="no-print"` en barra de filtros del reporte

**CAMBIO 4 — Botón "📑 Reporte Final" en index.html**
- Agregado entre botón Excel y botón Imprimir en `.view-actions` de `#view-final`
- `onclick="generateReporteFinal()"`

**Funciones nuevas/modificadas:**
- `generateReporteFinal()` — NUEVA en app.js
- `emailReport(mode)` — rama 'final' reescrita
- `@media print` (style.css) — bloque nuevo al final del archivo

**NO tocado:** `renderAnalisisFinal`, `_renderFinalChart`, `_renderFinalBarras`, `exportFinalExcel`, ninguna función de 2025/2026/comparative/checklist/planos/mejoras/reconteo

### V4.0 — 2026-05-28

**TAREA 1 — Menú reordenado por flujo de trabajo real:**
- Nuevo orden: Planos → CheckList → Centro Reconteo → Análisis 2025 → Análisis 2026 → Comparativo → Análisis Avanzado → Análisis Final → Mejoras 2026
- CDN SheetJS community → xlsx-js-style 1.2.0 (permite estilos de celda en exports)
- Tab "Análisis Final" (data-mode="final") añadido a nav + view-final HTML con IDs:
  `final-resultados`, `final-tops-grid`, `chart-final-{marca,familia,hiper,barras}`,
  `final-faltantes-tbl`, `final-hiper-tbl`, `final-empty`

**TAREA 2 — Fix botones y tabs que no respondían:**
- `switchToMode()` allViews ampliado: añadidos 'mejoras' y 'final'
- `refreshView()` allViews ampliado: todos los 9 modos
- Handler `onclick` para tab 'mejoras' añadido a DOMContentLoaded (FALTABA COMPLETAMENTE)
- Handler `onclick` para tab 'final' añadido a DOMContentLoaded
- `emailReport()` titles dict: añadidos 'mejoras', 'final', 'reconteo'

**TAREA 3 — Exportación Excel con formato del modelo TABLA_ANALISIS:**
- `styleAnalisisSheet(ws, rows)` — helper nuevo:
  header #002060/blanco/negrita/centrado, anchos A17..L11, formatos $/#,##0,
  condicional fuente roja(C00000)/azul(0000FF) en columnas H (DIFERENCIA) e I (DIFERENCIA $),
  bordes CELL_BDR, freeze A2 vía ws['!views']
- `exportDrilldownTable(year)` — reescrita:
  genera las 12 columnas exactas del modelo + hoja RESULTADOS en el mismo workbook
  Usa `getFilteredData(year)` directamente (no DOM table)
- `exportFinalExcel()` — nueva: workbook de 4 hojas (TABLA_ANALISIS + RESULTADOS +
  DATOS_FALTANTES + dinamica_HIPER), todas con datos reales

**TAREA 4 — Persistencia local autosave + restore:**
- IndexedDB (`appInvDB`, store `datasets`): guarda data2025/data2026 al cargar archivos
  Funciones: `saveDataToIDB`, `loadDataFromIDB`, `clearIDB`
- localStorage (`appInv_v3_state`): guarda filtros, drilldowns, chartMode, compCategoria,
  compDrill, modo activo, timestamp
  Funciones: `saveStateToLS`, `scheduleSave` (debounce 800ms)
- `restoreSession()` async: carga IDB + LS, muestra banner azul "Sesión restaurada · [fecha]"
  con botón "Empezar de cero"
- `clearSavedSession()`: borra LS + IDB + estado → welcome screen
- Banner HTML: `<div id="session-restore-banner">` con botones cerrar y limpiar
- Hooks: `saveDataToIDB` se llama en ambos paths de parseFile al asignar datos;
  `clearAllData` también limpia LS + IDB
- Punto de extensión comentado: `// FUTURE:FIREBASE`
- NOTA: los hooks de `setEmbudoLevel` y `clearFilters` wrappean las funciones en window
  para disparar `scheduleSave` sin modificar la firma

**TAREA 5 — Vista "Análisis Final":**
- `renderAnalisisFinal()`: cuadro RESULTADOS, top 15 faltantes/sobrantes,
  4 gráficos Chart.js, tabla DATOS_FALTANTES, tabla dinamica_HIPER
- `_renderFinalChart(canvasId, data, field, isPie)`: bar horizontal o doughnut
- `_renderFinalBarras(canvasId, data)`: barras faltantes vs sobrantes por familia
- `exportFinalExcel()`: 4 hojas xlsx-js-style con datos reales

**PENDIENTE (no implementado en esta sesión):**
- exportChecklistExcel / exportPlanosExcel con formato idéntico al modelo Excel
- Test end-to-end con archivos reales 2025/2026

### V4.1 — 2026-05-28

**TAREA 6 — Planos: cross-reference con inventario cargado:**
- `getPlanoContados()`: extrae Set de patentes desde `state.data2026` (o `state.data2025`);
  incluye string completo + solo dígitos para match flexible ("397 MIX" → también "397")
- `renderPlanoGrid(rows, zone, contados)`: nuevo parámetro `contados`;
  celdas de patente → verde (#bbf7d0) si contada, rojo (#fee2e2) si no encontrada, zona-color si sin datos
- `renderPlanos(allSheetNames)`: 
  - Leyenda añade chips "Contada (verde)" / "Sin contar (rojo)" cuando hay datos cargados
  - Header de cada hoja muestra badge cobertura: "X/Y contadas · Z%"
  - Semáforo ≥80% = verde, ≥50% = naranja, <50% = rojo

**TAREA 7 — CheckList: fix Gantt y legibilidad mejorada:**
- `renderGantt(raw)`:
  - Fix índice: `slice(3)` → `slice(2)` — días empiezan en col C (-30, -29...) no col D
  - Filtro: ignora cols con label vacío o "dias" (solo label de grupo, no datos)
  - Fila extra "DÍA 0" sobre headers cuando existe día 0 en la planilla
  - `dayClass(v)`: función local — col-today si 0, col-pos si >0, col-neg si <0, col-weekend si SAB/DOM
  - Responsable muestra "—" si vacío (antes mostraba "")
  - `taskCount` en el header de la columna "Tarea"

**TAREA 8 — Centro Reconteo: rankings explícitos + export:**
- `renderRecountRankings(rows)` — NUEVA:
  - Ranking 1: top 20 ordenados por |Impacto $| descendente
  - Ranking 2: top 20 ordenados por |Diferencia Unidades| descendente
  - Cada fila: # · Producto · Marca · Dif unid · Impacto $ · punto de estado (verde=Confirmado, azul=Recontado, gris=Pendiente)
  - Sección `#recount-rankings` visible cuando hay datos, oculta si no hay
- `renderRecount()` actualizado:
  - KPI nuevo: "Confirmados" (verde)
  - Llama `renderRecountRankings(rows)` con todos los rows (no filtrados)
  - `state-pill` de tabla toma color del estado (verde/azul/gris)
- `exportRecountExcel()` — NUEVA: 2 hojas (Reconteo completo + Ranking_$)
- `index.html`: view-actions en view-reconteo: ⬇ Excel + 🖨 Imprimir + ✉ Email
- `style.css`: clases `.recount-rankings`, `.ranking-card`, `.ranking-card-header`,
  `.ranking-badge`, `.ranking-table`, `.ranking-table-wrap`, `.plano-coverage-badge`

### V3.0 — 2026-05-28

**Layout grid vistas year:**
- `.main-panels` CSS grid 30%/70% — `.embudo-panel` sticky izquierda, `.drilldown-panel` derecha
- `#embudo-{year}` movido al panel izquierdo; charts y tables al panel derecho
- Mobile `<768px`: columna única, embudo arriba

**Filter drawer (sidebar colapsable):**
- Botón `⚙ Filtros` con badge de activos en cada view-header
- Panel desliza desde la derecha (`transform: translateX`)
- `openFilterPanel(mode)` / `closeFilterPanel(mode)` / `updateFilterBadge(mode)`
- Overlay backdrop para cerrar haciendo clic fuera
- Drawer integrado también en vista comparativa

**Refactor sistema de filtrado:**
- `renderFilters(mode)` en modos year solo muestra: zona · área · patente · bodega (NO marca/familia/perfamilia)
- `getFilteredData(year)` combina `state.drilldown[year]` (embudo) + `state.filters[year]` (drawer)
- Badge cuenta suma de: filtros drawer activos + niveles embudo activos + searchText
- `clearFilters(mode)` ahora cierra el panel y actualiza el badge

**Acordeones:**
- `toggleAcc(btn)` reescrita: usa `max-height` transition (no `display:none/block`)
- Swap de caracteres `▾` → `▴` en lugar de CSS `rotate(180deg)`
- `initAccordions()`: conecta todos los `.acc-btn` al `DOMContentLoaded` sin `onclick` inline
- `#drilldown-2025`, `#drilldown-2026`, `#comp-categoria` envueltos en acordeón
- CSS: `.acc-content { max-height: 0 }` / `.acc-content.open { max-height: 2000px }`

**Fixes vista comparativa:**
- `setCompCategoria(val)` ahora llama `renderModeComp()` (antes solo `renderCompCategoria`)
- `drillCompProduct()` genera breadcrumb con `← Volver` en `#comp-drill-breadcrumb`
- `clearCompDrill()` nueva función: limpia breadcrumb y tabla drill
- `clearFilters('comparative')` limpia `state.compDrill` + breadcrumb + products
- `state.compDrill = { field, value }` añadido al estado global

### V2.0 — 2026-05-20

- `renderResumenGlobal()` — 8 KPI cards grandes en 2 filas + 2 count cards
- `renderEmbudo()` — Navegador Jerárquico Embudo con chained selects + breadcrumb
- `renderCompKPIs()` — KPIs comparativos lado a lado en 2 columnas
- `renderCompCategoria()` — tabla comparativa por categoría con delta y drill-down
- `setCompCategoria()` — selector de agrupación en vista comparativa
- `drillCompProduct()` — tabla productos 2025 vs 2026 al hacer clic en fila
- `toggleAcc()` — función accordion faltante agregada
- Estado: `drilldown` (embudo) + `ddState` (tabla drilldown)

### V1.0 — (anterior a 2026-05-20)

- SPA base con carga de archivos xlsx/csv 2025 y 2026
- Filtros inline por zona, área, marca, familia, bodega, patente
- Tabla drilldown agrupable con chart.js
- Vista comparativa básica

---

## ESTADO OPERATIVO ACTUAL (2026-05-30)

**Inventario 2026 EN CURSO — XLSX en llenado por el operador.**

La app se usa hoy en producción para **monitorear el avance del conteo 2026**:
- Solo `state.data2026` está cargado (decisión deliberada del operador).
- `state.data2025` se carga **recién cuando el XLSX 2026 esté completo** → habilita comparativa y reportes finales.
- La vista de progreso por patente / hoja / cobertura es el caso de uso activo.

### Diseño operativo (NO es deuda técnica — esperan cierre del XLSX 2026)

- Carga de `data2025` y vista comparativa 2025 vs 2026.
- TAREA 5A — Verificación de 5 códigos Excel↔App (`STOCK SISTEMA`, `CONTEO`, `VALOR SISTEMA $`, `DIFERENCIA`, `DIFERENCIA $`).
- Validación end-to-end con dataset 2025+2026 completo (embudo, `renderCompCategoria`, delta colors, drill comparativo).

### Pendiente real (deuda técnica)

- [ ] Confirmar planos hardcodeados contra el plano del XLSX 2026 cuando cierre: 465 patentes (Sala EXHIBICION=55, BODEGA SALA=211, BODEGA 2DO PISO SALA=100, PATIO CONSTRUCTOR=99).
- [ ] `exportChecklistExcel` / `exportPlanosExcel` con formato espejo del Excel modelo (sub-tarea V4.0 sin terminar).

### Verificado en producción

- ✅ **"📂 Actualizar Plano"** probado con XLSX real — funciona.
- ✅ Avance por patente operativo con `state.data2026` cargado en vivo.

**Estado funcional confirmado (V6.0 — 2026-05-29):**
- ✅ Cargar 2025/2026: status verde + gráficos + KPIs + banner EN CURSO
- ✅ Tabs Planos / Centro Reconteo / Análisis 2025 / Análisis 2026 / Comparativo / Avanzado / Final / Mejoras: todos responden
- ✅ Planos hardcodeados se renderizan al abrir la app (465 patentes, 4 hojas)
- ✅ Avance por patente: aparece al cargar inventario con planos
- ✅ Email (mailto) y PDF (window.print) funcionales en todas las vistas
- ✅ Excel export: TABLA_ANALISIS 11 cols con styleSimpleSheet, hoja RESULTADOS
- ✅ App parte limpia al abrir (sin auto-restore de sesión)

**Hallazgos verificados con archivos de ejemplo (V5.4):**
- TABLA_ANALISIS: 9.163 filas con headers correctos (Codigo_tecnico, CONTEO, COSTO $, etc.)
- Hojas de registro V2026: REGISTROS (1.671 filas) + BUSQUEDA (6.476 filas)
- Guiones contables: 25.039 → todos resueltos como cero (fix V5.4)
- Cobertura planos con datos ejemplo: 457/469 patentes (97%)
