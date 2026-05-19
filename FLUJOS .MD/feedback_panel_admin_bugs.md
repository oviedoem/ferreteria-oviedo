---
name: Bugs corregidos panel-admin.html — quiebres, baja rotación, hora 24h, sector, impacto
description: Correcciones V33.4-V33.6: toast quiebres, baja rotación, vadmParseHora 24h, _vendNombre ReferenceError, vadmRenderImpacto P1=P2, sessionStorage guard año
type: feedback
originSessionId: da151d24-bed9-466f-bdbe-ed49903985ab
---
## TAREA 1 — Toast quiebres (vadmQuiebresCheck / _vadmMostrarToastQuiebres)

**Problema:** El toast siempre mostraba "Quiebres en Cat. A" aunque la rotación de marcas podía incluir Cat. B. No había autoclose.

**Corrección aplicada:**
1. `vadmQuiebresCheck` línea ~10342: cambiar filtro de solo A → A o B:
   `(abcM[v.cod]==='A'||abcM[v.cod]==='B')` + agregar `quiebres.forEach(function(v){ v.abc=abcM[v.cod]; })` para que cada producto lleve su categoría al toast.
2. `_vadmMostrarToastQuiebres`: derivar `catLabel`/`catColor`/`catBg` según si hay productos A entre los `prods` pasados. El botón "Ver detalle" llama `vadmSetQbreABC` con la categoría correcta (A o B). Autoclose 15 s via `setTimeout`.

**Why:** La rotación por marca (cooldown 30 min) ya estaba implementada. Lo que faltaba era que Cat B también rotara y que el header del toast reflejara la categoría correcta.

---

## TAREA 2 — Baja rotación: productos sin venta que sí tienen venta en ERP

**Problema:** Productos aparecen como Cat. D (sin venta) en el informe de baja rotación, pero "Ventas por productos y vendedor" del ERP muestra que sí tienen venta.

**Causa raíz identificada:** Las Notas de Crédito (NC) presentes en `ventas-manzano.json` tienen `valorNeto` negativo. El loop de `ventaMap` las sumaba, cancelando ventas reales. Ej: venta +$5000 + NC -$5000 = neto 0 → clasificado como D. El ERP muestra la venta bruta, sin restar las NC.

**Correcciones aplicadas en `vadmRenderBajaRot`:**

1. **Excluir NC del ventaMap** — añadir línea antes del filtro de bodega:
   `if((r.valorNeto||0)<0) return; // NCs tienen neto negativo — no cuentan como venta`

2. **Fix `qty||1` → `qty||0`** — la cantidad fallback incorrecto sumaba 1 para registros con cantidad=0.

3. **Fallback path omitía `bodegaCorta`** — cuando `_vadmLineas` se cargaba vía fetch independiente (bajrot abierto antes de que cargaran los datos principales), el mapeo no incluía `bodegaCorta`, rompiendo el filtro de bodega. Corrección: agregar `bodegaCorta:r.bodegaCorta||''` al mapeo.

**How to apply:** Si en el futuro el reporte sigue mostrando inconsistencias con el ERP, investigar si el pipeline `descargar_ventas_erp.py` descarga todas las bodegas relevantes (PEM=22, SEM=13, CEM=23, MEM=24) y si el rango de fechas del JSON cubre el período analizado.

---

## TAREA 3 — Tab "Por Hora" → "Sin datos de hora reconocibles" (V33.5)

**Problema:** Tab Análisis > Por Hora mostraba "Sin datos de hora reconocibles" aunque `ventas-manzano.json` sí tenía el campo `hora`.

**Causa raíz:** `vadmParseHora` usaba regex `/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i` — solo acepta formato 12h con AM/PM. El ERP Justime entrega hora en formato 24h: `"08:30:00"`. Todos los registros retornaban `-1` → `byHour` vacío → mensaje de error.

**Corrección aplicada en `vadmParseHora` (panel-admin.html ~línea 7004):**
- Mantiene soporte 12h (AM/PM) para compatibilidad
- Agrega fallback regex `/^(\d{1,2}):(\d{2})/` para formato 24h: `"08:30"` o `"08:30:00"`

**How to apply:** El campo `hora` en `ventas-manzano.json` viene de `df_ventas` columna `'Hora'` del ERP (confirmado). Si en el futuro el tab vuelve a mostrar el error, verificar el formato real del campo `hora` en el JSON con `data/ventas-manzano.json`.

---

## TAREA 4 — vadmRenderSector: body queda en "Cargando..." aunque status muestra datos (V33.6)

**Problema:** Tab "Por Sector" mostraba status correcto ("7 sectores · 59 documentos") pero el cuerpo de la tabla quedaba en "Cargando..." sin renderizar.

**Causa raíz:** `_vendNombre(topVE[0])` llamada en el `.map()` de construcción de filas, pero `_vendNombre` nunca fue definida en el archivo. ReferenceError silencioso → el `.map()` lanzaba excepción → `bd.innerHTML` nunca se ejecutaba. El status se seteaba ANTES del `.map()`, por eso era correcto.

**Corrección en `vadmRenderSector` (~línea 10888) y `vadmRenderImpacto` (~línea 11193):**
Reemplazar `_vendNombre(key)` con lookup inline contra `VEN_CONFIG`:
```javascript
var _vk = topVE[0];
Object.keys(VEN_CONFIG).forEach(function(k){
  if(VEN_CONFIG[k].gmailUser===_vk||k===_vk) topNom=VEN_CONFIG[k].nombre;
});
if(topNom==='—') topNom=_vk; // fallback: mostrar key si no hay nombre
```

**How to apply:** Si en el futuro se agrega una función `_vendNombre`, asegurarse de que esté definida ANTES de `vadmRenderSector` en el archivo.

---

## TAREA 5 — vadmRenderImpacto: siempre muestra 0.0% (V33.6)

**Problema:** Tab "Q vs $" mostraba todos los deltas en ▼0.0% aunque había datos.

**Causa raíz 1:** El botón "AYER" era un `<span>` decorativo sin onclick — no seteaba ninguna fecha.
**Causa raíz 2:** Sin pre-fill ni validación, el usuario podía dejar P1=P2 con las mismas fechas. Cuando `d1===d2` y `h1===h2`, la función `_render(j,j)` compara el mismo conjunto consigo mismo → delta siempre 0%.

**Corrección:**
1. Span "AYER" reemplazado con dos botones funcionales:
   - "Mes vs año ant" → P1: mismo mes del año pasado / P2: mes actual
   - "Mes ant vs actual" → P1: mes anterior / P2: mes actual
2. Validación al inicio de `vadmRenderImpacto`: si `d1===d2 && h1===h2` → mensaje de error en vez de tabla con ceros.
3. Labels "P1:" y "vs P2:" para claridad visual.

---

## TAREA 6 — vadmCargarLineas: guard ignora cambio de año (V33.6)

**Problema:** Al seleccionar un año diferente en `vadmAnioSelector`, el panel no recargaba los datos. El guard retornaba inmediatamente porque `_vadmLineas.length > 0`.

**Causa raíz:** El guard solo verificaba `_vadmLineas.length > 0`, sin considerar si el año en memoria coincidía con el año seleccionado.

**Corrección:**
```javascript
var _anioEnMemoria = (_vadmLineas&&_vadmLineas[0]) ? (_vadmLineas[0].periodo||'').substring(0,4) : '';
var _anioRequerido = _vadmAnioSel || String(new Date().getFullYear());
if(_vadmLineas.length > 0 && _anioEnMemoria === _anioRequerido){
  // retornar con cache
} else {
  _vadmLineas = []; // limpiar antes de recargar
}
```
