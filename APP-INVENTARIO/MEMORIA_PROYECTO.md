# MEMORIA DEL PROYECTO — Panel de Diferencias de Inventario · El Manzano
# VERSION: V4.1
# FECHA: 2026-05-28

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

## PENDIENTE

- [ ] Test end-to-end con archivos reales de inventario 2025 y 2026
- [ ] TAREA 6: view-planos idéntica al Excel modelo (leer hojas Sala 1/1erPiso_A/2doPiso_A/Patio_2)
- [ ] TAREA 7: view-checklist idéntica al Excel modelo (Hoja1 de CheckList.xlsx)
- [ ] TAREA 8: Centro Reconteo — rankings explícitos por $ y por unidades ordenables
- [ ] exportChecklistExcel con layout del modelo
- [ ] exportPlanosExcel con layout del modelo
- [ ] Verificar embudo con datos reales (selects populados correctamente)
- [ ] Verificar renderCompCategoria con datos reales (delta colors)
