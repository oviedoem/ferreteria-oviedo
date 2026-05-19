# Codex — descargar_ventas_erp.py + panel-admin.html · Fix ventas día actual

> Archivos: `descargar_ventas_erp.py` · `panel-admin.html`  
> Reglas: cambios mínimos · no refactorizar · no agregar dependencias · preservar estructura

---

## Contexto crítico

El ERP tiene este formulario en `Reporte_VentasPorVendedor.asp`:

| Campo | Valor actual en script |
|-------|----------------------|
| F.Inicio | `01-01-YYYY` |
| F.Termino | fecha de hoy |
| Vendedor | Todos los vendedores |
| Tipo de Informe | **"Ventas Por Producto"** ← INCORRECTO |
| Sucursal | El Manzano |

**El tipo correcto es "Ventas Por Cliente - Producto"** — ya se descarga como Reporte 2/2 pero sus datos NO se usan para generar `ventas-manzano.json`.

El log confirma:
```
[Reporte 2/2] Ventas Por Cliente - Producto
  Columnas: ['Vendedor', 'Responsable', 'Cliente', 'HiperFamilia', 'Familia',
             'SubFamilia', 'Codigo', 'Descripcion', 'Cantidad', 'Descto.',
             'Valor Neto', 'Costo', 'Margen', 'Margen\xa0(%)']
  Filas: 37390
```

Este reporte SÍ tiene fecha implícita en el período solicitado y cubre el día actual.

---

## TAREA 1 — descargar_ventas_erp.py: usar Reporte 2 para ventas-manzano.json

### Causa raíz
`ventas-manzano.json` se genera desde el Reporte 1 ("Ventas Por Producto") que NO tiene fecha por línea.  
El Reporte 2 ("Ventas Por Cliente - Producto") tiene: Vendedor, Cliente, HiperFamilia, Familia, SubFamilia, Codigo, Descripcion, Cantidad, Valor Neto, Costo, Margen — y cubre el día actual.

### Localizar en `descargar_ventas_erp.py`

Busca el bloque donde se construye `ventas-manzano.json`. Debe contener algo como:

```python
registros = parsear_reporte1(df_r1)
# o:
registros = _construir_registros(tabla_r1, ...)
```

Y el guardado final:
```python
json_out = {"generado": ..., "registros": registros}
with open(JSON_VENTAS, "w", encoding="utf-8") as f:
    json.dump(json_out, f, ...)
```

### Cambio mínimo

**Reemplazar la fuente de `registros` para que use `df_r2` (o `tabla_r2`) en lugar de `df_r1`.**

Busca donde se parsea el reporte 2 y extrae su DataFrame/tabla. Si ya existe una variable como `df_r2`, `tabla_r2`, `rows_r2`, usarla directamente.

Si el parseo del reporte 2 produce un DataFrame con columnas:
`Vendedor, Responsable, Cliente, HiperFamilia, Familia, SubFamilia, Codigo, Descripcion, Cantidad, Valor Neto, Costo, Margen, Margen%`

Agregar esta función de parseo junto a las otras funciones del script:

```python
def _registros_desde_r2(df, fecha_inicio, fecha_fin):
    """
    Construye lista de registros para ventas-manzano.json
    desde el reporte 'Ventas Por Cliente - Producto'.
    Asigna fecha=fecha_fin (dia de descarga) ya que el reporte cubre el periodo.
    """
    registros = []
    # Normalizar nombres de columnas a minusculas sin espacios
    df.columns = [c.strip().lower().replace(' ', '_').replace('.', '').replace('\xa0', '') for c in df.columns]

    for _, row in df.iterrows():
        vendedor_erp = str(row.get('vendedor', '')).strip()
        if not vendedor_erp:
            continue
        # Saltar subtotales
        if vendedor_erp.lower().startswith('sub') or vendedor_erp.lower().startswith('tot'):
            continue

        neto = _limpiar_num(str(row.get('valor_neto', 0)))
        if neto == 0:
            continue

        gmail_user = ERP_TO_GMAIL_USER.get(vendedor_erp, vendedor_erp)
        hiper  = str(row.get('hiperfamilia', '')).strip()
        fam    = str(row.get('familia', '')).strip()
        sub    = str(row.get('subfamilia', '')).strip()
        cod    = str(row.get('codigo', '')).strip()
        desc   = str(row.get('descripcion', '')).strip()
        cant   = _limpiar_num(str(row.get('cantidad', 0)))
        costo  = _limpiar_num(str(row.get('costo', 0)))
        margen = _limpiar_num(str(row.get('margen', 0)))

        # periodo YYYY-MM desde fecha_fin (DD-MM-YYYY)
        try:
            partes = fecha_fin.split('-')  # formato ERP: DD-MM-YYYY
            periodo = f"{partes[2]}-{partes[1]}"
        except Exception:
            periodo = ""

        # fecha en formato DD/MM/YYYY para compatibilidad con panel
        try:
            fecha_ddmmyyyy = f"{partes[0]}/{partes[1]}/{partes[2]}"
        except Exception:
            fecha_ddmmyyyy = ""

        registros.append({
            "vendedor":    gmail_user,
            "vendedorErp": vendedor_erp,
            "responsable": str(row.get('responsable', '')).strip(),
            "cliente":     str(row.get('cliente', '')).strip(),
            "hiperFam":    hiper,
            "familia":     fam,
            "subFam":      sub,
            "codigo":      cod,
            "descripcion": desc,
            "cantidad":    float(cant),
            "valorNeto":   neto,
            "costo":       costo,
            "margen":      margen,
            "margenPct":   round((margen / neto * 100) if neto > 0 else 0, 2),
            "periodo":     periodo,
            "fecha":       fecha_ddmmyyyy,
            "bodegaCorta": "PEM",
        })

    return registros
```

### En `main()` — reemplazar la construcción de registros:

```python
# ANTES (incorrecto — usa reporte 1 sin fecha):
# registros = _construir_registros(tabla_r1, ...)

# DESPUES (correcto — usa reporte 2 con cobertura del dia actual):
registros = _registros_desde_r2(df_r2, fecha_inicio, fecha_fin)
log(f"  Registros para ventas-manzano.json: {len(registros)}")

json_out = {
    "generado": datetime.date.today().isoformat(),
    "desde":    fecha_inicio,   # DD-MM-YYYY
    "hasta":    fecha_fin,      # DD-MM-YYYY
    "registros": registros
}
with open(JSON_VENTAS, "w", encoding="utf-8") as f:
    json.dump(json_out, f, ensure_ascii=False, separators=(',', ':'))
log(f"  [OK] ventas-manzano.json: {len(registros)} registros")
```

### Notas
- `fecha_inicio` y `fecha_fin` ya existen como variables en el script (formato `DD-MM-YYYY` del ERP).
- `ERP_TO_GMAIL_USER` ya existe en el script.
- `_limpiar_num` ya existe — reutilizarla.
- No tocar la lógica de descarga ni el guardado de los Excel.

---

## TAREA 2 — panel-admin.html: mostrar fecha de actualización de datos

### Causa raíz
El panel carga `ventas-manzano.json` pero no muestra de qué fecha son los datos.  
El JSON ya tiene campos `generado`, `desde`, `hasta` — solo hay que mostrarlos.

### Localizar en `panel-admin.html`

La función `vadmCargarLineas` lee el JSON y llama `_vadmAplicarDatos`.  
Busca este bloque:

```javascript
.then(function(json){
    var gen = json.generado ? json.generado.slice(0,10) : '';
    _vadmAplicarDatos(json.registros||[], status, 'local · '+gen);
})
```

### Cambio mínimo — reemplazar ese `.then` por:

```javascript
.then(function(json){
    var gen   = json.generado ? json.generado.slice(0,10) : '';
    var desde = json.desde  || '';
    var hasta = json.hasta  || '';
    var rango = (desde && hasta) ? (' · ' + desde + ' al ' + hasta) : '';
    // Mostrar indicador de fecha en el status
    var indEl = document.getElementById('vadmFechaActualizacion');
    if(indEl){
        indEl.textContent = 'Datos al: ' + hasta + ' · Generado: ' + gen;
        indEl.style.display = hasta ? 'inline-block' : 'none';
    }
    _vadmAplicarDatos(json.registros||[], status, 'local · ' + gen + rango);
})
```

### Agregar elemento HTML — busca el contenedor del status de ventas admin (cerca de `vadmHtmStatus`):

```html
<!-- Agregar junto al div del status, dentro del mismo contenedor -->
<span id="vadmFechaActualizacion"
  style="display:none;font-size:11px;font-weight:600;color:#059669;
         background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;
         padding:2px 8px;margin-left:8px;white-space:nowrap">
</span>
```

### Restricción
- Solo agregar el `<span>` junto al elemento `vadmHtmStatus` existente.
- No mover ni reestructurar el contenedor.

---

## TAREA 3 — ACTUALIZAR_TODO.bat: confirmar que escribe ventas-manzano.json

El bat ya llama `python descargar_ventas_erp.py`.  
Después de aplicar TAREA 1, el script generará el JSON automáticamente.

**Verificar** que `JSON_VENTAS` en `descargar_ventas_erp.py` apunte a:
```
D:\ferreteria-oviedo\data\ventas-manzano.json
```

Y que `firebase deploy` en el bat incluya este archivo (debe estar dentro de la carpeta `public` o configurada en `firebase.json`).

Si la ruta es diferente, ajustar solo la variable `JSON_VENTAS` en el script.

---

## Resumen de cambios

| Archivo | Cambio | Impacto |
|---------|--------|---------|
| `descargar_ventas_erp.py` | Usar Reporte 2 para JSON en vez de Reporte 1 | Ventas del día actual aparecen en el panel |
| `descargar_ventas_erp.py` | Agregar campos `desde`/`hasta` al JSON | Trazabilidad del rango de datos |
| `panel-admin.html` | Badge `vadmFechaActualizacion` | Admin ve hasta qué fecha están actualizados los datos |

**No agregar reportes nuevos. No cambiar la lógica de descarga. Solo cambiar la fuente del JSON.**
