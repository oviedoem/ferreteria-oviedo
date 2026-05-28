# MEMORIA DEL PROYECTO — Panel de Diferencias de Inventario · El Manzano
# VERSION: V2.0
# FECHA: 2026-05-20

---

## DESCRIPCIÓN

SPA (Single Page Application) Vanilla JS para análisis de diferencias de inventario.
Permite cargar archivos Excel/CSV de conteos 2025 y 2026, compararlos, y navegar
jerárquicamente hasta nivel de producto.

**Directorio:**
```
D:\ferreteria-oviedo\_ARCHIVO\01_PROYECTOS_SEPARADOS\APP-INVENTARIO-UX-FINAL\APP-INVENTARIO\
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
- Chart.js 4.4.3 — gráficos (barras horizontales en drilldown)
- Todo se carga desde CDN, sin build step

---

## VISTAS

```
view-2025       — análisis inventario 2025 individual
view-2026       — análisis inventario 2026 individual
view-comparative — comparación lado a lado 2025 vs 2026
```

Cada vista single-year tiene:
1. `#resumen-global-{year}` — 8 KPI cards grandes
2. `#embudo-{year}` — Navegador Jerárquico (chained selects)
3. `#filters-bar` — filtros inline (zona, área, marca, familia, etc.)
4. `#drilldown-{year}` — tabla agrupada con chart + drill-in

Vista comparativa tiene:
1. `#comp-kpis` — KPIs lado a lado 2025 vs 2026
2. `#comp-categoria` — tabla comparativa por categoría con delta
3. `#filters-comparative` — filtros comparativos
4. `#comp-table` — tabla de productos comparados

---

## ESTADO GLOBAL (state)

```js
const state = {
  data: { '2025': [], '2026': [] },     // arrays de filas parseadas
  loaded: { '2025': false, '2026': false },
  mode: '2025',                         // vista activa

  filters: {
    '2025':      { marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'', bodega:'' },
    '2026':      { marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'', bodega:'' },
    comparative: { marca:'', familia:'', perfamilia:'', zona:'', area:'' }
  },

  // Navegador jerárquico embudo (hiperfamilia → familia → marca)
  drilldown: {
    '2025': { hiperfamilia:'', familia:'', marca:'' },
    '2026': { hiperfamilia:'', familia:'', marca:'' }
  },

  // Tabla drilldown agrupable interactiva (groupBy + drill-in a valor)
  ddState: {
    '2025': { groupBy: 'familia', filterField: null, filterValue: null },
    '2026': { groupBy: 'familia', filterField: null, filterValue: null },
  },

  compCategoria: 'perfamilia',   // agrupación activa en vista comparativa
};
```

---

## COLUMNAS Y ALIAS

El parseo es tolerante a nombres de columna variantes via `FIELD_ALIASES`:

```js
const FIELD_ALIASES = {
  codigo:      ['codigo','cod','code','sku','código'],
  descripcion: ['descripcion','desc','description','nombre','producto','descripción'],
  marca:       ['marca','brand'],
  familia:     ['familia','family','fam'],
  perfamilia:  ['perfamilia','hiperfamilia','hiper','super familia','superfamilia'],
  zona:        ['zona','zone','sector'],
  area:        ['area','área','local','sucursal'],
  patente:     ['patente','patent','placa'],
  bodega:      ['bodega','warehouse','almacen','almacén'],
  conteo:      ['conteo','cantidad','qty','quantity','unidades','count'],
  sistema:     ['sistema','stock','sistema_stock','stock_sistema'],
  diferencia:  ['diferencia','diff','diferencia_unidades'],
  costo:       ['costo','cost','precio_costo','valor_unitario'],
  valor_dif:   ['valor_dif','valor_diferencia','diferencia_valor','diff_valor','peso'],
};
```

---

## KPIs Y SEMÁFORO

### Exactitud Unidades
```
exactitudUnid = (filas con diferencia == 0) / total_filas × 100
```

### Exactitud Peso ($)
```
exactitudPeso = 1 - (|sum(valor_dif_negativas)| / sum(costo × sistema)) × 100
Si no hay costo → se muestra "—"
```

### Semáforo (ambos KPIs)
- ≥ 95% → verde (kpi-exact-ok)
- ≥ 85% → amarillo (kpi-exact-warn)
- < 85% → rojo (kpi-exact-bad)

### Cards de conteo
- Faltantes: diferencia < 0 (fondo rojo claro)
- Sobrantes: diferencia > 0 (fondo verde claro)

---

## MÓDULOS IMPLEMENTADOS EN V2.0

### renderResumenGlobal(year)
Renderiza en `#resumen-global-{year}`:
- Fila 1 (azul): Total productos · Exactitud unidades · Faltantes · Sobrantes
- Fila 2 (naranja): Total $ sistema · Exactitud peso · Pérdida neta $ · Ganancia neta $
- Fila 3: 2 count-kpi-cards (cant. SKUs faltantes / sobrantes)

### renderEmbudo(year)
Renderiza en `#embudo-{year}`:
- Select Hiperfamilia → Select Familia (populated según HF) → Select Marca (populated según F)
- Breadcrumb con chips × para limpiar niveles
- Tabla agrupada del nivel activo (o productos si marca seleccionada)

### setEmbudoLevel(year, nivel, value) / clearDrillevel(year, nivel)
Actualiza `state.drilldown[year]` y re-renderiza el embudo.

### renderCompKPIs(d25, d26)
Renderiza en `#comp-kpis`:
- Dos columnas lado a lado: 2025 (fondo gris) vs 2026 (fondo naranja claro)
- Cada columna: exactitud unidades + exactitud peso + faltantes/sobrantes

### renderCompCategoria(d25, d26)
Renderiza en `#comp-categoria`:
- Selector de agrupación (perfamilia / familia / marca / zona / area)
- Tabla con columnas: Grupo | 2025 Exact. | 2026 Exact. | Delta | Prod 2025 | Prod 2026
- Filas coloreadas: verde si mejoró, rojo si empeoró
- Clic en fila → drillCompProduct() muestra tabla de productos comparados

### toggleAcc(btn)
Función accordion que faltaba. Maneja `.open` en btn y su nextElementSibling.

---

## FUNCIONES JS CLAVE

```js
// Parseo
parseFile(file, year)              // detecta xlsx/csv, llama parsers
normalizeRow(raw)                  // aplica FIELD_ALIASES, calcula diferencia

// Filtros
getFilteredData(year)              // aplica state.filters[year] a state.data[year]
getFilteredDataComp()              // aplica state.filters.comparative a ambos años
clearFilters(mode)                 // limpia filters + drilldown + ddState
clearAllData()                     // limpia todo

// Render principal
renderMode(year)                   // llama resumenGlobal + embudo + filtros + charts + drilldown
renderModeComp()                   // llama compKPIs + compCategoria + filtros + tabla comparativa

// Embudo jerárquico
renderEmbudo(year)
setEmbudoLevel(year, nivel, value)
clearDrillevel(year, nivel)
buildEmbudoGroupTable(year, groups, groupField, groupLabel)
buildEmbudoProductTable(data)

// Drilldown agrupable
renderDrilldown(year, data)        // usa state.ddState[year]
setDrilldownGroup(year, groupBy)
drillIntoGroup(year, field, value)
clearDrilldownFilter(year)

// KPIs
renderResumenGlobal(year)
_buildCompColKPIs(data, yearLabel)

// Comparativo
renderCompKPIs(d25, d26)
renderCompCategoria(d25, d26)
setCompCategoria(val)
drillCompProduct(field, value)

// Utilerías
venAdmFmt(n)                       // formato $X.XXX CLP
```

---

## CSS — VARIABLES USADAS

```css
--blue-dark, --orange, --red, --green   /* accents KPI cards */
--red-light, --green-light              /* fondos count-kpi-cards */
--border, --text-muted                  /* bordes y texto secundario */
```

### Clases nuevas V2.0

```css
.global-kpi-grid          /* grid 4 columnas */
.global-kpi-card          /* card base */
  .kpi-unid-row           /* accent azul */
  .kpi-peso-row           /* accent naranja */
  .kpi-loss               /* accent rojo */
  .kpi-gain               /* accent verde */
  .kpi-exact-ok/warn/bad  /* semáforo */
.count-kpi-row            /* grid 2 columnas */
.count-kpi-card
  .card-faltantes         /* fondo rojo claro */
  .card-sobrantes         /* fondo verde claro */
.embudo-section
.embudo-bar               /* flex row de selects */
select.embudo-select
.embudo-breadcrumb
.embudo-chip / .embudo-chip-x
.embudo-nav-header
.comp-kpi-columns         /* grid 2 columnas */
.comp-kpi-col-header.y2025 / .y2026
.comp-table               /* tabla comparativa */
  .row-mejora             /* fondo verde */
  .row-empeora            /* fondo rojo */
```

---

## HISTORIAL DE CAMBIOS

### V2.0 — 2026-05-20

- `renderResumenGlobal()` — 8 KPI cards grandes en 2 filas + 2 count cards
- `renderEmbudo()` — Navegador Jerárquico Embudo con chained selects + breadcrumb
- `renderCompKPIs()` — KPIs comparativos lado a lado en 2 columnas
- `renderCompCategoria()` — tabla comparativa por categoría con delta y drill-down
- `setCompCategoria()` — selector de agrupación en vista comparativa
- `drillCompProduct()` — tabla productos 2025 vs 2026 al hacer clic en fila
- `toggleAcc()` — función accordion faltante agregada
- Estado: `drilldown` (embudo) + `ddState` (tabla drilldown antigua renombrada)
- `state.filters.comparative` + `getFilteredDataComp()` — soporte perfamilia agregado
- Secciones HTML: resumen-global-2025/2026, embudo-2025/2026, comp-kpis, comp-categoria
- CSS: todas las clases nuevas descriptas arriba

### V1.0 — (anterior a 2026-05-20)

- SPA base con carga de archivos xlsx/csv 2025 y 2026
- Filtros inline por zona, área, marca, familia, bodega, patente
- Tabla drilldown agrupable (familia → zona → marca) con chart.js
- Vista comparativa básica con tabla de productos

---

## PENDIENTE / PRÓXIMOS PASOS

- [ ] Test end-to-end con archivos reales de inventario 2025 y 2026
- [ ] Verificar que los selects del embudo se populen correctamente según los datos reales
- [ ] Verificar renderCompCategoria con datos reales (delta colors)
- [ ] Agregar export Excel / PDF del resumen global
- [ ] Posible: modo oscuro (CSS variables ya preparadas)
