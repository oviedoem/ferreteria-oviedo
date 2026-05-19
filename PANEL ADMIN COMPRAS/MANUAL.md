# PANEL ADMIN COMPRAS — Manual de usuario

Ferretería Oviedo · El Manzano
Actualizado: 2026-05-13

---

## ¿Qué es esto?

Panel web independiente para la **gestión de compras y reposición de stock**.
Desplegado en Firebase Hosting en un proyecto separado.

- **URL:** https://oviedo-compras-admin.web.app
- **Clave de acceso:** `compras2026`
- **Proyecto Firebase:** `oviedo-compras-admin`

---

## Cómo publicar (actualizar datos)

1. Abrir o actualizar el archivo `SOLICITUDES SANTIAGO_TLC2.XLSM`
2. Ejecutar **`PUBLICAR_COMPRAS.bat`** (doble clic)
3. Esperar a que termine — publica los datos en el sitio web

```bash
# Lo que hace el bat internamente:
python preparar_datos_compras.py   # XLSM → JSON en data/
call firebase deploy --only hosting
```

---

## Estructura de archivos

| Archivo | Descripción |
|---|---|
| `SOLICITUDES SANTIAGO_TLC2.XLSM` | Fuente de datos — archivo XLSM con hojas del ERP |
| `preparar_datos_compras.py` | XLSM → JSON de datos (generado en `data/`) |
| `PUBLICAR_COMPRAS.bat` | Script de publicación (doble clic para ejecutar) |
| `index.html` / `oviedo-COMPRAS.html` | Aplicación web del panel |
| `sw.js` | Service Worker (PWA, actualización automática) |
| `firebase.json` | Configuración Firebase Hosting |
| `data/` | JSONs generados por el script (no editar manualmente) |
| `public/` | Assets estáticos del panel |

---

## Hojas del XLSM que usa el sistema

| Hoja | Contenido |
|---|---|
| RESUMEN | Stocks, venta 2026, clasificación ABC (tipo A/B/C/D) |
| TIPO | `ventaAnioMovil` (rolling 12 meses), `stockVal`, `costoUnitario` |
| Ranking | Venta por familia/subfamilia/hiperfamilia (ene-may 2025) |
| VENTA-H | Histórico 2022-2025 por producto |
| VENTA PESOS | Histórico 2022-2026 por pesos, por familia/hiperfamilia |

---

## Funcionalidades del panel (v3)

### Clasificación ABC80

Recalculado desde `ventaAnioMovil` (rolling 12 meses):

| Clase | Cantidad de SKUs (aprox.) | % del total vendido |
|---|---|---|
| A | ~470 SKUs | 80% |
| B | ~877 SKUs | 15% |
| C | ~2.480 SKUs | 5% |
| D | ~5.693 SKUs | sin venta significativa |

### Filtros globales (sidebar)

- Excluir productos `(DD)` — descontinuados con código DD
- Excluir Descontinuados
- Excluir Outlet

### Pestañas del panel

| Pestaña | Descripción |
|---|---|
| **Sin Movimiento** | Stock sin venta en los últimos 12 meses (≈1.210 SKUs). Muestra cobertura en meses |
| **Sugerido Compra** | Sugerencia de reposición agrupada por Marca / Familia / Subfamilia / Hiperfamilia. Meta: 3 meses de cobertura |
| **Temporada Chile** | Productos por temporada (Verano / Otoño / Invierno / Primavera) clasificados por keywords de familia |

### Gráficos

- **ABC80 doughnut** — distribución visual de SKUs por clase
- **% venta en riesgo** — porcentaje del total vendido en riesgo por quiebres de stock en productos clase A (`pctRiesgoA`)

---

## Lógica `pctRiesgoA`

```
riesgoVentaA = suma de ventaAnioMovil de todos los productos
               con abc80 = "A" que están en quiebre (stock = 0)
               expresado como % del total vendido
```

Si `pctRiesgoA` es alto, hay productos de alta rotación sin stock.

---

## Service Worker

El panel usa un SW con versión timestamp. Cada vez que se ejecuta `PUBLICAR_COMPRAS.bat`, la versión cambia y los usuarios ven el banner "Nueva versión disponible" al volver a abrir el panel.

---

## Errores comunes

| Error | Causa | Solución |
|---|---|---|
| `SOLICITUDES SANTIAGO_TLC2.XLSM no encontrado` | Archivo movido o renombrado | Verificar que está en `D:\ferreteria-oviedo\PANEL ADMIN COMPRAS\` |
| Datos desactualizados en el panel | No se publicó después de actualizar el XLSM | Ejecutar `PUBLICAR_COMPRAS.bat` |
| `firebase login` requerido | Sesión expirada | Ejecutar `firebase login` en terminal |
| Panel no actualiza tras publicar | Caché del navegador | Ctrl+Shift+R o esperar banner de actualización |
| XLSM bloqueado | Excel lo tiene abierto | Cerrar Excel antes de ejecutar el bat |

---

## Notas

- Este panel es **independiente** del sistema principal (`ferreteria-oviedo.web.app`)
- Tiene su propio proyecto Firebase: `oviedo-compras-admin`
- No usa Firebase Auth — acceso por clave simple (`compras2026`)
- No usa Firestore — todos los datos son JSON estáticos en Hosting
