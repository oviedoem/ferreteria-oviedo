# MEMORIA DEL PROYECTO — Panel de Diferencias de Inventario · El Manzano
# VERSION: V3.0
# FECHA: 2026-05-28

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
- [ ] Verificar embudo con datos reales (selects populados correctamente)
- [ ] Verificar renderCompCategoria con datos reales (delta colors)
- [ ] Export Excel / PDF del resumen global
