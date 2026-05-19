# CATALOGO PRODUCTOS — Manual de usuario

Ferretería Oviedo · El Manzano
Actualizado: 2026-05-13

---

## ¿Qué hace esta carpeta?

Mantiene el **catálogo de productos** (precios, stock, descripciones) sincronizado entre el ERP Justime y el sitio web público.

---

## Flujo completo

```
ERP Justime
    │
    ▼  (automático o manual)
actualizar.xlsx          ← informe exportado del ERP
    │
    ▼  PASO 1
Datos.xlsx               ← catálogo maestro (precios + stock + descripción)
    │
    ▼  PASO 2
Datos.csv                ← exportación CSV (sin fórmulas)
    │
    ▼  PASO 3
Datos.json               ← JSON que leen los paneles web
    │
    ▼  PASO 4
firebase deploy          → ferreteria-oviedo.web.app
```

---

## Cómo actualizar el catálogo (uso normal)

### Opción A — Automático (recomendado)

1. Ejecutar **`ACTUALIZAR_Y_PUBLICAR.bat`** desde la raíz del proyecto `D:\ferreteria-oviedo\`
2. El bat pregunta la visibilidad de precios (S = visible / N = oculto / Enter = sin cambios)
3. Espera a que termine — muestra COMPLETADO al final

### Opción B — Solo descargar datos del ERP (sin publicar)

```bash
python "scripts\descargar_erp.py"
```

Genera `actualizar.xlsx` directamente desde el ERP Justime.
Requiere red interna o VPN.

---

## Scripts (carpeta `scripts\`)

| Archivo | Qué hace | Cuándo usarlo |
|---|---|---|
| `descargar_erp.py` | Descarga precios (VisorRS/Playwright) y stock (HTTP) del ERP → `actualizar.xlsx` | Antes de actualizar el catálogo |
| `procesar-actualizacion.py` | `actualizar.xlsx` → `Datos.xlsx` | PASO 1 del bat |
| `xlsx_a_csv.py` | `Datos.xlsx` → `Datos.csv` | PASO 2 del bat |
| `csv_a_json.py` | `Datos.csv` → `Datos.json` | PASO 3 del bat |
| `actualizar_config_precios.py` | Cambia visibilidad de precios en Firestore | Lo llama el bat automáticamente |
| `subir_ventas.py` | Sube ventas desde HTM del ERP a Firestore | Usado por `SUBIR_VENTAS.bat` |
| `credenciales_erp.ini` | Credenciales del ERP Justime (no se publica en Firebase) | Los scripts lo leen automáticamente |
| `descarga_lista_precio.md` | Documentación técnica del flujo Playwright para descargar precios | Solo referencia/debug |
| `GUIA_CREAR_BAT.md` | Referencia técnica para crear archivos .bat | Solo desarrollo |

---

## Archivo `credenciales_erp.ini`

Las credenciales del ERP están en este archivo, **separadas del código**. No se suben al sitio web (están en la lista de exclusión de `firebase.json`).

```ini
[ERP]
BASE   = http://200.6.113.97/Justweb_Foviedo
USER   = agonzalez
CLAVE  = 4040
```

Si el archivo no existe o hay algún error al leerlo, los scripts usan los valores hardcodeados internos como respaldo.

---

## Archivos de datos

| Archivo | Descripción | ¿Editar? |
|---|---|---|
| `actualizar.xlsx` | Informe exportado del ERP — **fuente de entrada** | No (se genera automáticamente) |
| `Datos.xlsx` | Catálogo maestro generado | No |
| `Datos.csv` | Exportación CSV del catálogo | No |
| `Datos.json` | JSON publicado en el sitio web | No |

---

## Columnas del catálogo (`Datos.xlsx`)

| Columna | Descripción |
|---|---|
| `CODIGO` | Código interno del producto |
| `DESCRIPCION` | Nombre/descripción del producto |
| `MARCA` | Marca |
| `SUBFAMILIA` | Categoría del producto |
| `COSTO_PROMEDIO` | Costo de adquisición |
| `PRECIO_IVA` | Precio de venta con IVA |
| `SOCIO_IVA` | Precio socio con IVA |
| `STOCK` | Unidades disponibles |

---

## Script `descargar_erp.py` — Detalle

- **Precios:** VisorRS via Playwright + msedge → `foviedo.justtime.cl/visor/`
  - Tipo: Venta | Lista: El Manzano (xToken permanente)
  - Selecciona todas las marcas, todas las familias, todas las temporadas
  - **Formato exportación: CSV** (`exportReport('CSV')`) — más rápido y sin errores de parsing
  - Espera que el ReportViewer SSRS termine de renderizar antes de exportar
    (polling `get_reportAreaContentType()` cada 1 s hasta que no lanza excepción)
  - Si Playwright falla: lee CSV local `RS_Documentos_listaprecio*.csv` en `~/Downloads` (< 24h)
  - Si ambos fallan: error y detiene la ejecución (nunca descarga de otra sucursal)
- **Stock (Bodega):** desde `Reporte_Bodegas_Detalle.asp` (HTTP directo)
  - IdBodega=22 → Patio El Manzano
  - IdBodega=13 → Sala El Manzano
  - Stock combinado PEM + SEM sumados por código

Requiere Edge instalado y `python -m playwright install msedge` ejecutado al menos una vez.

---

## Errores comunes

| Error | Causa | Solución |
|---|---|---|
| `actualizar.xlsx no encontrado` | No se exportó el informe | Ejecutar `descargar_erp.py` o exportar manualmente |
| `Sys.InvalidOperationException: The report or page is being updated` | ReportViewer SSRS aún procesando | **Resuelto automáticamente** — el script espera hasta que el viewer esté listo |
| `Datos.xlsx no encontrado` | Archivo borrado o movido | Verificar que existe en esta carpeta |
| `Firebase CLI no instalado` | Falta `npm install -g firebase-tools` | Ejecutar ese comando en terminal |
| `Ejecuta: firebase login` | Sesión expirada | Ejecutar `firebase login` en terminal |
| Error HTTP 403 en `actualizar_config_precios.py` | Token Firebase expirado | Ejecutar `firebase login` en terminal |
| Precios no se actualizan en el sitio | Caché del navegador | Ctrl+Shift+R en el navegador |
| Error al leer `credenciales_erp.ini` | Archivo editado incorrectamente | Verificar formato INI o borrar para usar fallback hardcodeado |

---

## Visibilidad de precios

El bat pregunta al inicio:

- **S** → Precios **visibles** para clientes en el catálogo web
- **N** → Precios **ocultos** → los clientes ven botón "Consultar precio" vía WhatsApp
- **Enter** → Sin cambios (mantiene lo que había)

También se puede cambiar desde el **Panel Admin → Catálogo → Visibilidad de precios**.
