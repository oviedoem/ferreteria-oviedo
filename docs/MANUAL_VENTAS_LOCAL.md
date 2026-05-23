# VENTAS EL MANZANO LOCAL — Manual de usuario

Ferretería Oviedo · El Manzano
Actualizado: 2026-05-12

---

## ¿Qué hace esta carpeta?

Genera el archivo `ventas-manzano.json` que alimenta el **Panel Admin → Ventas** y el **Panel Vendedor**, con el análisis de ventas de la sucursal El Manzano, **sin usar cuota de Firestore**.

Los datos se leen del archivo XLSM exportado del ERP Justime.  
Si el XLSM está vacío (limpiado por macro al cerrar), el sistema usa el **backup automático** `ventas_raw_backup.xlsx`.

---

## Flujo completo

```
Justime (ERP)
    │
    ▼  PASO 0 — opcional (automático o manual)
Ventas_Obs_2025.xlsm       ← reporte de ventas exportado
    │
    ├─ Si tiene datos → ventas_raw_backup.xlsx (copia de seguridad)
    │
    ▼  PASO 1
salida\ventas_manzano.csv  ← ventas filtradas El Manzano
salida\catalogo_manzano.csv
salida\datos_manzano.xlsx
    │
    ▼  PASO 2
..\data\ventas-manzano.json ← JSON publicado en Firebase Hosting
    │
    ▼  firebase deploy
panel-admin.html + index.html → datos actualizados
```

---

## Actualización automática (7 PM diaria)

El sistema tiene una **tarea programada en Windows** que ejecuta automáticamente cada día a las **19:00**:

```
Tarea: "Ferreteria Oviedo Ventas 7PM"
Bat:   ACTUALIZAR_AUTO.bat
```

El bat hace:
1. Ejecuta `preparar_datos.py --auto` (fechas: 01-01-2026 → hoy, sin prompts)
2. Ejecuta `firebase deploy --only hosting` (publica el JSON)
3. Registra todo en `salida\auto_log.txt`

**No requiere intervención del usuario.** Si el XLSM está vacío (cerrado desde Justime), el script usa `ventas_raw_backup.xlsx` automáticamente.

Para ver el log de la última ejecución automática:
```
salida\auto_log.txt
```

---

## Actualización manual (cuando se necesita antes de las 7 PM)

### Opción A: `PREPARAR_Y_PUBLICAR.bat`

1. **Cerrar** el archivo `Ventas_Obs_2025.xlsm` si está abierto en Excel
2. Ejecutar **`PREPARAR_Y_PUBLICAR.bat`** (doble clic)
3. Responde la pregunta inicial:
   - **S** → Exportar automáticamente desde Justime (ver Paso 0)
   - **N** → Usar el XLSM que ya está en la carpeta (o el backup)

### Opción B: Forzar actualización automática

Ejecutar directamente el bat automático:
```
ACTUALIZAR_AUTO.bat
```
(mismo que la tarea programada, sin ventanas interactivas)

---

## Backup automático (`ventas_raw_backup.xlsx`)

El archivo XLSM tiene una macro VBA que **borra los datos al cerrarse** en Excel.  
Para evitar perder los datos, el script guarda automáticamente un respaldo:

- **Cuándo:** cada vez que el XLSM tiene datos al leerlo
- **Dónde:** `VENTAS EL MANZANO LOCAL\ventas_raw_backup.xlsx`
- **Cuándo se usa:** si el XLSM está vacío, el script carga el backup sin avisar
- **El backup** es un Excel plano sin macros (no se limpia solo)

---

## PASO 0 — Exportar desde Justime (automático)

El bat puede abrir la ventana **CONSULTA DE VENTAS C/ OBS.** en Justime y:
- Poner fechas: 01/01/2026 → hoy
- Seleccionar sucursal El Manzano
- Hacer clic en CONSULTAR
- Guardar el XLSM resultante en esta carpeta

**Requisitos:**
- Justime debe estar abierto con sesión iniciada
- La ventana **CONSULTA DE VENTAS** debe estar visible (o se espera 60 segundos para abrirla)

Si la exportación automática falla, el bat pregunta si continuar con el XLSM existente.

---

## Exportar el XLSM manualmente (alternativa)

1. Abrir Justime → **CONSULTA DE VENTAS C/ OBS.**
2. Fecha inicio: `01/01/2026`
3. Fecha fin: fecha de hoy
4. Sucursal: **El Manzano**
5. Clic en **CONSULTAR**
6. Cuando cargue, guardar como `Ventas_Obs_2025.xlsm` en esta carpeta
7. Cerrar Excel antes de ejecutar el bat

---

## Scripts

| Archivo | Qué hace | Cuándo usarlo |
|---|---|---|
| `preparar_datos.py` | Lee el XLSM (o backup) → genera CSV, Excel y JSON | Lo ejecuta el bat automáticamente |
| `preparar_datos.py --auto` | Igual, sin prompts (fechas fijas: 01-01-2026 → hoy) | Lo usa `ACTUALIZAR_AUTO.bat` y la tarea programada |
| `exportar_consulta_ventas.py` | Automatiza la exportación desde Justime via pywin32 | Lo ejecuta `PREPARAR_Y_PUBLICAR.bat` (opción S) |
| `calibrar_offsets.py` | Muestra coordenadas de los controles de la ventana Justime | Solo si los clics fallan tras actualizar Justime |

---

## Archivos

| Archivo/Carpeta | Descripción |
|---|---|
| `Ventas_Obs_2025.xlsm` | Reporte exportado desde ERP — fuente principal (se limpia al cerrar Excel) |
| `ventas_raw_backup.xlsx` | Backup automático sin macros — fallback cuando XLSM está vacío |
| `ACTUALIZAR_AUTO.bat` | Bat no interactivo para la tarea programada de las 7 PM |
| `PREPARAR_Y_PUBLICAR.bat` | Bat interactivo para actualización manual |
| `salida\ventas_manzano.csv` | Ventas filtradas El Manzano en CSV (generado) |
| `salida\catalogo_manzano.csv` | Catálogo en CSV (generado) |
| `salida\datos_manzano.xlsx` | Excel con 2 hojas: Ventas + Catálogo (generado) |
| `salida\auto_log.txt` | Log de ejecuciones automáticas (tarea programada) |
| `..\data\ventas-manzano.json` | JSON publicado en Firebase Hosting (generado) |

---

## Filtros aplicados en `preparar_datos.py`

- **Sucursal:** El Manzano (filtra por campo SUCURSAL o por código de bodega)
- **Fecha:** 01/01/2026 → fecha de ejecución (modo `--auto`) o ingresada manualmente
- **Bodegas incluidas:** Sala El Manzano, Patio El Manzano, Calzada El Manzano, Mermas El Manzano
- **Documentos:** Boletas, Facturas y Notas de Crédito

---

## Campos del JSON (`ventas-manzano.json`)

Cada registro en el JSON representa **una línea de venta** (un producto por fila):

| Campo | Descripción |
|---|---|
| `fecha` | Fecha en formato DD/MM/YYYY |
| `hora` | Hora de la venta |
| `numero` | Número del documento (boleta/factura/NC) |
| `documento` | Tipo: Boleta, Factura, Nota de Crédito, etc. |
| `cliente` | Nombre del cliente |
| `vendedor` | Usuario Gmail del vendedor |
| `vendedorErp` | Código del vendedor en el ERP |
| `nombre` | Nombre del vendedor |
| `sucursal` | Nombre de la sucursal |
| `bodega` | Nombre de la bodega |
| `bodegaCorta` | Código corto de bodega (PEM, SEM, CEM, MEM) |
| `codigo` | Código del producto |
| `descripcion` | Descripción del producto |
| `valorNeto` | Valor neto de la línea (negativo en NC) |
| `costo` | Costo de la línea |
| `margen` | Margen en pesos |
| `observacion` | Observación del documento |

---

## Cómo se ve en los paneles

**Panel Admin → Ventas** tiene tres sub-pestañas:
- **Análisis Categorías:** drilldown Bodega → Vendedor → Cliente → Documento
- **Detalle documentos:** lista todos los documentos (BOL/FAC/NC) con filtro fecha y multi-vendedor
- **Análisis por hora:** heatmap de ventas por hora del día y día de la semana

**Panel Vendedor → Mis Ventas:**
- Muestra las ventas del vendedor autenticado (lee del JSON, no Firestore)
- Incluye Notas de Crédito (se muestran con badge ámbar)

---

## `calibrar_offsets.py` — ¿cuándo usarlo?

Solo si la exportación automática falla porque Justime fue actualizado y los controles cambiaron de posición.

```bash
python calibrar_offsets.py
```

Muestra una tabla con las coordenadas (dx, dy) de cada control. Copiar los valores al diccionario `OFFSET` en `exportar_consulta_ventas.py`.

---

## Errores comunes

| Error | Causa | Solución |
|---|---|---|
| `XLSM vacio, usando backup` | XLSM fue cerrado en Excel (macro lo limpió) | Normal — el backup se usa automáticamente |
| `No hay backup disponible` | Primer uso o backup eliminado | Exportar XLSM desde Justime manualmente |
| `Ventas_Obs_2025.xlsm no encontrado` | No se exportó el XLSM | Exportar desde Justime o usar opción S en el bat |
| `No se encontro la ventana CONSULTA DE VENTAS` | Justime no está abierto | Abrir Justime e iniciar sesión |
| `La exportación automática no completó` | Justime tardó o cambió layout | Exportar manualmente y responder N |
| `Sin registros en el período` | XLSM y backup vacíos | Verificar y re-exportar desde Justime |
| Clic en coordenada incorrecta | Justime fue actualizado | Ejecutar `calibrar_offsets.py` y actualizar OFFSET |
| `Firebase error al publicar` | Sesión expirada o sin internet | Ejecutar `firebase login` |
| Error en tarea programada | Ver `salida\auto_log.txt` | Revisar log y corregir según el error |
