# CALCULOS.md — Metodología de análisis · Ferretería Oviedo El Manzano

Actualizado: 2026-05-15

---

## 1. Calendario hábil de la ferretería

### Horario de atención

| Día | Horario | Horas hábiles |
|---|---|---|
| Lunes a Viernes | 08:30–13:30 y 14:30–18:00 | **8,5 h** |
| Sábado | 09:00–13:30 | **4,5 h** |
| Domingo | — | 0 h |
| Feriados legales | — | 0 h |

> Un **día hábil** (dh) es cualquier día Lunes–Sábado que **no** sea feriado.  
> El Sábado cuenta como día hábil porque hay ventas, aunque con menor flujo.

---

### Feriados Chile (algoritmo implementado)

Se calculan automáticamente para cualquier año. No requieren mantenimiento manual.

#### Feriados fijos
| Fecha | Descripción |
|---|---|
| 1 Enero | Año Nuevo |
| 1 Mayo | Día del Trabajo |
| 21 Mayo | Glorias Navales |
| 20 Junio | Día de los Pueblos Indígenas |
| 16 Julio | Virgen del Carmen |
| 15 Agosto | Asunción de la Virgen |
| 18 Septiembre | Independencia Nacional |
| 19 Septiembre | Día de las Glorias del Ejército |
| 12 Octubre | Encuentro de Dos Mundos |
| 1 Noviembre | Día de Todos los Santos |
| 2 Noviembre (Trasladado) | Día de los Difuntos |
| 8 Diciembre | Inmaculada Concepción |
| 25 Diciembre | Navidad |

#### Feriados móviles (Algoritmo de Butcher — Computus)
El Domingo de Pascua se calcula algebraicamente y de ahí se derivan:

- **Viernes Santo** = Pascua − 2 días
- **Sábado Santo** = Pascua − 1 día

---

## 2. Función `_vadmDiasHabiles(desde, hasta)`

Cuenta los días hábiles entre dos fechas (inclusivas en ambos extremos).

```
dias_habiles = 0
para cada día d desde "desde" hasta "hasta":
    si d.diaDeSemana ≠ Domingo (0)
    y d no está en el conjunto de feriados chilenos del año d.año:
        dias_habiles += 1
retorna max(dias_habiles, 1)   ← nunca devuelve 0 (evita división por cero)
```

**Nota técnica — ventana de n+1 días calendario:**  
`_vadmDiasHabilesN(n)` ejecuta `setDate(getDate() − n)`, lo que retrocede exactamente **n días** en el calendario local. La ventana resultante es `[hoy − n, hoy]` **inclusive en ambos extremos**, es decir **n + 1 días calendario**.  
Los registros de ventas se filtran con `parseFR` (medianoche) y los cortes se normalizan con `.setHours(0,0,0,0)` para incluir registros del día de corte exacto.

**Ejemplo verificado — n=90, hoy=14-may-2026:**

| Componente | Valor |
|---|---|
| `setDate(14 − 90)` = `setDate(−76)` | **13-feb-2026** |
| Ventana | 13-feb-2026 → 14-may-2026 |
| Días calendario | **91** (n + 1) |
| Domingos en el período | 13 (15/22-feb · 1/8/15/22/29-mar · 5/12/19/26-abr · 3/10-may) |
| Feriados en el período | 3 → Viernes Santo (3-abr), Sábado Santo (4-abr), 1 Mayo |
| **Días hábiles** | **91 − 13 − 3 = 75** |

> 21 de Mayo (Glorias Navales) **no** cae en este período — está fuera del rango.

---

## 3. Velocidad de venta (vel/dh)

### Definición
```
velocidad = unidades_vendidas / dias_habiles_del_período
```

La velocidad se expresa en **unidades por día hábil (u/dh)**.

### Horizontes de cálculo
El panel calcula velocidad en 3 horizontes retroactivos desde hoy:

| Horizonte | Ventana real (n+1 cal.) | Días hábiles típicos (Lun–Sáb − feriados) |
|---|---|---|
| 30 días | **31** cal. | ~26 dh |
| 60 días | **61** cal. | ~49 dh |
| 90 días | **91** cal. | ~75 dh |

> Los días hábiles exactos varían según los feriados que caigan en cada período. El sistema los cuenta día por día.  
> Los valores típicos usan proporción 6/7 (Lun–Sáb) menos el promedio de feriados del período.

### Por qué NO se usa días calendario
Si se divide por 91 días calendario y la ferretería trabajó 75 días, la velocidad aparece **artificialmente baja** (18% menor). Esto subestimaría el stock de seguridad y los pedidos sugeridos. Al usar días hábiles el dato refleja el ritmo real de trabajo.

---

## 4. Cobertura de stock (cob30 / cob60 / cob90)

### Definición
```
cobertura_dh = stock_actual / velocidad_por_dia_habil
             = stock_actual / (unidades_vendidas / dias_habiles)
```

Se expresa en **días hábiles de cobertura** — cuántos días de trabajo puede atender el stock actual al ritmo observado.

### Interpretación de semáforos

| Estado | Cobertura | Significado |
|---|---|---|
| 🔴 Zero | stock = 0 | Quiebre activo — ventas perdidas ahora |
| 🔴 Crítico | < 30 dh | Menos de ~6 semanas — urgente reponer |
| 🟡 Alerta | 30–90 dh | 6 semanas a ~4 meses — monitorear |
| 🟢 OK | > 90 dh | Bien cubierto |
| ⚫ Sin datos | Sin ventas | No se puede calcular velocidad |

> 30 días hábiles ≈ 6 semanas calendario ≈ 1,5 meses.  
> 90 días hábiles ≈ 18 semanas calendario ≈ 4,5 meses.

---

## 5. Análisis de quiebre (tab Stock & Quiebre)

**Objetivo:** Identificar productos sin stock que tienen demanda activa.

### Criterio de inclusión
- `stock_actual ≤ 0`
- `unidades vendidas en últimos 60 dh > 0`

### KPIs del reporte
| KPI | Fórmula |
|---|---|
| Vel/dh | qty_60dh / dias_habiles_60 |
| Cob30 | stock / (qty_30dh / dh30) |
| Cob60 | stock / (qty_60dh / dh60) |
| Cob90 | stock / (qty_90dh / dh90) |
| Venta potencial perdida | Σ neto_60dh de productos en quiebre |

### ABC Pareto (Curva de valor)
Los productos se clasifican según su participación acumulada en ventas del período seleccionado:
- **A** (80% del valor): máxima prioridad
- **B** (siguiente 15%, hasta 95%): prioridad media
- **C** (siguiente 5%, hasta 100%): prioridad baja
- **D**: sin ventas en el período

> Los quiebres en productos A son los más críticos — generan la mayor pérdida de margen.

---

## 6. Sobre-stock (tab Sin Venta)

**Objetivo:** Liberar capital inmovilizado en productos sin rotación.

### Criterio
- `stock_actual > 0`
- `qty_vendida_90dh = 0` (sin movimiento en 90 días hábiles)

### KPIs
| KPI | Descripción |
|---|---|
| Valor en bodega | stock × costo_promedio |
| Markup % | (precio / costo − 1) × 100 |
| Días sin venta (dh) | días hábiles desde la última venta |

### Acción sugerida para equipo de compras
1. **Revisar vigencia**: ¿el producto sigue en el surtido activo?
2. **Precio**: ¿tiene markup excesivo que frena rotación?
3. **Liquidar / reubicar**: transferir a sucursal con demanda o mover a bodega de merma.
4. **No reponer**: bloquear en ERP hasta agotar stock.

---

## 7. Tránsito PEM (tab Tránsito)

**Objetivo:** Visibilizar pedidos en camino para no hacer doble compra.

### Datos
- `transito`: unidades ordenadas al proveedor aún no recibidas (campo del ERP).
- `stock_total_esperado = stock_actual + transito`

### Cobertura con tránsito
```
cob_con_transito = (stock + transito) / velocidad_dh
cob_sin_transito = stock / velocidad_dh
```

Si `cob_con_transito > umbral_OK` → no hay urgencia de compra aunque `cob_sin_transito` sea bajo.

---

## 8. Merma / Remate

**Objetivo:** Gestionar productos descontinuados o con baja rotación crónica que se ofrecen a precio especial.

### Fuente de datos
`merma.json` — lista curada de SKUs en bodega de merma. Se genera desde `Datos.xlsx` en `CATALOGO PRODUCTOS/` a partir de familias o marcas marcadas como "merma".

### KPIs
| KPI | Descripción |
|---|---|
| Total en catálogo merma | Cantidad de SKUs en lista de merma |
| Con stock disponible | SKUs que aún tienen unidades físicas |
| Valor en bodega (costo) | Σ stock × costo_promedio |

---

## 9. Venta vs Stock (tab VvsStock)

**Objetivo:** Detectar desbalance entre lo que se vende y lo que se tiene en bodega, por marca.

### Por marca
```
participacion_ventas  = neto_marca / neto_total × 100
participacion_stock   = valor_stock_marca / valor_stock_total × 100
ratio_desbalance      = participacion_ventas / participacion_stock
```

- Ratio > 1,5: la marca vende más de lo que representa en bodega → posible sub-stock.
- Ratio < 0,5: la marca tiene más bodega que ventas → posible sobre-stock.

---

## 10. Análisis general de ventas (tabs principales)

### Período de análisis
El usuario selecciona el período (mes, trimestre, año) desde el selector del panel. Todos los cálculos de ventas usan el período seleccionado.

### Métricas base
| Métrica | Descripción |
|---|---|
| Neto | Precio venta sin IVA |
| Cantidad | Unidades vendidas |
| Ticket promedio | Neto / número de documentos |
| Crecimiento % | (período actual − anterior) / anterior × 100 |

### Hora del día
El análisis de ventas por hora usa la hora del documento ERP. Muestra concentración de demanda dentro del horario hábil para planificar turnos y cobertura de caja.

---

## 11. Relación con Justime y Biwiser

| Sistema | Rol | Datos que aporta |
|---|---|---|
| **Justime** (ERP) | Sistema transaccional | Ventas, stock, precios, tránsito, costo promedio |
| **Biwiser** | BI / análisis | Reportes históricos, tendencias, comparativas multi-período |
| **Panel Admin** | Operativo diario | Quiebre, sobre-stock, tránsito, velocidad en días hábiles |

El Panel Admin complementa a Biwiser con métricas operativas en tiempo real (stock del día, quiebres actuales) que Biwiser puede no actualizar en tiempo real.

---

## 12. Guía de decisión de compra

### ¿Cuándo comprar?
```
SI  cobertura_90dh < 30 dh  (crítico)
Y   abc IN (A, B)
→   COMPRA URGENTE
```

```
SI  cobertura_90dh < 60 dh  (alerta)
Y   abc = A
→   Cotizar en los próximos días
```

```
SI  transito > 0
Y   cob_con_transito > 30 dh
→   Esperar llegada antes de comprar
```

### ¿Cuánto comprar? (Stock de seguridad)
```
stock_seguridad  = velocidad_dh × lead_time_dh × factor_seguridad
punto_reorden    = stock_seguridad + (velocidad_dh × lead_time_dh)
```

- `lead_time_dh`: días hábiles desde orden al proveedor hasta recepción en bodega.
- `factor_seguridad`: 1.2 a 1.5 según variabilidad de demanda (A = 1.5, B = 1.3, C = 1.2).

> *Ejemplo:* producto A con vel=2 u/dh, lead time=10 dh, factor=1.5  
> → stock_seg = 2 × 10 × 1.5 = **30 u**  
> → punto_reorden = 30 + (2 × 10) = **50 u**

### ¿Qué NO comprar?
- Productos con `cobertura > 180 dh` → revisar antes de reponer.
- Productos en lista de **merma** → no reponer nunca (liquidar existencias).
- Productos **D** (sin ventas en el período) → analizar si descontinuar.

---

## 13. Resumen de fórmulas clave

```
dias_habiles(desde, hasta)  = Σ días Lun–Sáb no feriados en [desde, hasta]

velocidad_dh = unidades_vendidas_período / dias_habiles_período

cobertura_dh = stock_actual / velocidad_dh

quiebre      = stock ≤ 0 AND qty_60dh > 0

sobre_stock  = stock > 0 AND qty_90dh = 0

val_bodega   = stock × costo_promedio
```

---

*Documento generado automáticamente por el asistente del panel — no editar manualmente.*
