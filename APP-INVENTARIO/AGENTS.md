# AGENTS.md — APP-INVENTARIO · El Manzano
# Instrucciones para Claude (y cualquier agente de IA) al trabajar en este proyecto

---

## PROYECTO INDEPENDIENTE — REGLA ABSOLUTA

```
TRABAJAR SOLO EN:   D:\ferreteria-oviedo\APP-INVENTARIO\
NUNCA TOCAR:        panel-admin.html · panel-cliente.html · panel-vendedor.html
                    Cualquier archivo fuera de D:\ferreteria-oviedo\APP-INVENTARIO\
```

Este proyecto NO forma parte del panel admin/cliente/vendedor de Ferretería Oviedo.
Es una SPA independiente. No compartir código, no abrir previews de otros proyectos,
no leer archivos fuera de esta carpeta.

---

## ARCHIVOS DEL PROYECTO

```
D:\ferreteria-oviedo\APP-INVENTARIO\
  index.html            — estructura HTML + vistas
  style.css             — estilos (CSS variables + componentes)
  app.js                — lógica completa (state, parseo, render, filtros)
  MEMORIA_PROYECTO.md   — documentación técnica y estado actual
  AGENTS.md             — este archivo
  datos/                — archivos de datos (NO editar)
  .claude/              — configuración local del entorno
```

---

## ANTES DE CUALQUIER CAMBIO

### 1. Leer MEMORIA_PROYECTO.md

Contiene el estado actual del proyecto, funciones JS, clases CSS y historial.
Es la fuente de verdad — leerla antes de proponer cualquier cambio.

### 2. Declarar alcance (Safe Change)

Para cualquier modificación en `app.js`:

```
TOCO:     [nombre exacto de la función]
ARCHIVO:  app.js
RAZÓN:    [una línea — qué se cambia y por qué]
NO TOCO:  [funciones adyacentes que NO se van a modificar]
```

**Un prompt = una función.** Si se necesitan dos funciones → dos prompts en orden.

### 3. Verificar dependencias en app.js

| Si tocas... | Verifica también... |
|---|---|
| `getFilteredData(year)` | Que siga combinando `state.drilldown` + `state.filters` |
| `renderFilters(mode)` | Que modos year solo muestren zona/área/patente/bodega |
| `clearFilters(mode)` | Que llame `closeFilterPanel` + `updateFilterBadge` al final |
| `renderEmbudo(year)` | Que no pise los filtros del drawer |
| `toggleAcc(btn)` | Que `initAccordions()` siga conectando `.acc-btn` al DOMContentLoaded |
| `renderModeComp()` | Que `setCompCategoria()` la llame (no `renderCompCategoria` directo) |
| Cualquier `render*()` | Que los IDs de elementos coincidan con los del HTML |

### 4. No romper estos invariantes

```
- state.drilldown[year]  siempre existe para '2025' y '2026'
- state.filters[mode]    siempre tiene las claves: zona, area, patente, bodega, marca, familia, perfamilia
- state.compDrill        siempre tiene: { field, value } (null cuando no hay drill activo)
- initAccordions()       debe correr en DOMContentLoaded
- updateFilterBadge(mode) debe llamarse después de cualquier cambio a filters o drilldown
```

---

## CIERRE DE SESIÓN — OBLIGATORIO

Antes de terminar cualquier sesión con cambios:

1. Actualizar `MEMORIA_PROYECTO.md`:
   - Sección **HISTORIAL DE CAMBIOS** con lo que se modificó
   - Sección **PENDIENTE** si quedan tareas abiertas

2. Ejecutar sync a GitHub:
   ```
   D:\ferreteria-oviedo\ACTUALIZAR_GITHUB_APP_INVENTARIO.bat
   ```

3. Confirmar que el commit fue exitoso (aparece hash y "subido a GitHub").

**Nunca cerrar sesión con cambios sin pushear.**

---

## STACK Y RESTRICCIONES

- HTML + CSS + **Vanilla JS** — sin frameworks, sin npm, sin build step
- Las librerías se cargan desde CDN en `index.html` (no agregar nuevas sin pedirlo)
- No agregar dependencias externas
- No crear archivos fuera de `D:\ferreteria-oviedo\APP-INVENTARIO\`

### CDN activos
```
SheetJS  xlsx-0.20.3     — parseo .xlsx / .xls
PapaParse 5.4.1          — parseo .csv
Chart.js  4.4.3          — gráficos
```

---

## ARQUITECTURA RÁPIDA

### Vistas HTML
```
view-2025         — análisis 2025 (embudo 30% | drilldown+charts 70%)
view-2026         — análisis 2026 (misma estructura)
view-comparative  — comparativo 2025 vs 2026
view-checklist    — checklist de inventario
view-mejoras      — sugerencias de mejora (acordeones)
view-reconteo     — centro de reconteo operacional
view-2025v2       — análisis avanzado 2025
```

### Sistema de filtrado (2 capas)
```
Capa 1 — Embudo (state.drilldown):  hiperfamilia → familia → marca
Capa 2 — Drawer (state.filters):    zona · área · patente · bodega
getFilteredData(year) combina ambas en orden: drilldown → filters → searchText
```

### Acordeones
```
.mej-acc-header + .mej-acc-body   — acordeones en vista mejoras (onclick inline)
.acc-btn + .acc-content            — acordeones genéricos (conectados por initAccordions)
toggleAcc(btn)                     — función única para ambos tipos
```
