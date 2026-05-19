# App Inventario · El Manzano

## Cómo abrir
1. Abre `index.html` directamente en tu navegador (Chrome o Edge recomendado).
2. No requiere servidor, internet solo para cargar las librerías (Chart.js, SheetJS, PapaParse).  
   > Si no hay internet, descarga las librerías y reemplaza los CDN en `index.html`.

---

## Cargar archivos

- **Sidebar izquierdo**: hay dos zonas de carga (2025 y 2026).
- Arrastra archivos `.xlsx`, `.xls` o `.csv` a la zona correspondiente, **o** usa el botón "Cargar 2025 / 2026".
- Puedes cargar **varios archivos** del mismo año — los datos se consolidan automáticamente.
- La app detecta las columnas automáticamente. Si no las reconoce, aparece un **diálogo de mapeo** para asignarlas manualmente.

### Columnas esperadas
| Campo | Ejemplos de nombre en el archivo |
|---|---|
| Producto | PRODUCTO, DESCRIPCION, SKU |
| Unidades Sistema | UNIDADES_SISTEMA, STOCK_SISTEMA |
| Unidades Real | UNIDADES_REAL, CONTEO_FISICO |
| Peso Sistema | PESO_SISTEMA, KG_SISTEMA |
| Peso Real | PESO_REAL, PESO_FISICO |
| Marca | MARCA |
| Familia | FAMILIA |
| Perfamilia | PERFAMILIA, HIPERFAMILIA, CATEGORIA |
| Zona | ZONA, SECTOR |
| Área | AREA, PASILLO |
| Patente | PATENTE, SALA, BODEGA |

---

## Modos del menú

### 📊 Análisis 2025
Analiza el inventario histórico 2025. Identifica errores y zonas problemáticas para mejorar el 2026.

### 📈 Análisis 2026
Analiza el inventario actual 2026. Muestra el estado en tiempo real para tomar acciones correctivas.

### ⚖️ Comparativo 2025 vs 2026
Compara ambos años por **Marca + Familia + Producto**. Muestra qué mejoró, qué empeoró y cuánto.

---

## KPIs — cómo interpretarlos

| KPI | Fórmula | Semáforo |
|---|---|---|
| % Exactitud Unidades | `(1 - Σ|Dif| / Σ Sist) × 100` | 🟢 >95% / 🟡 85–95% / 🔴 <85% |
| % Exactitud Peso | Igual, con datos de peso | igual |
| Σ Dif. (abs) | Suma de diferencias absolutas | — |

**Semáforo:** Verde = excelente, Amarillo = revisar, Rojo = acción urgente.

---

## Filtros
Cada modo tiene filtros por Marca, Familia, Perfamilia, Zona, Área y Patente.  
Los filtros se combinan (AND) y actualizan dashboard, tablas y gráficos en tiempo real.

---

## Exportar y reportes

- **⬇ Excel**: exporta la tabla seleccionada a `.xlsx` (SheetJS).
- **📄 Reporte**: genera un archivo `.html` descargable con KPIs + insights + tablas.
- **🖨 Imprimir**: imprime la vista actual o guarda como PDF desde el diálogo del sistema.

---

## Tablas — ordenamiento
Haz clic en cualquier encabezado de columna para ordenar (▲ ascendente / ▼ descendente).

---

## Limpiar datos
Botón **"🗑 Limpiar todo"** en el sidebar — elimina todos los datos cargados y reinicia la app.

---

## Notas técnicas
- App 100% local: HTML + CSS + JavaScript puro, sin backend.
- Librerías: [SheetJS](https://sheetjs.com/) · [PapaParse](https://www.papaparse.com/) · [Chart.js](https://www.chartjs.org/).
- Los datos **no se guardan** al cerrar el navegador (vive solo en memoria).
- Compatible con Chrome, Edge y Firefox modernos.
