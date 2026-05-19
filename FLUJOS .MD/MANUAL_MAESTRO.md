# MANUAL MAESTRO — FERRETERÍA OVIEDO
## Guía completa de actualizaciones paso a paso

**Proyecto:** `D:\ferreteria-oviedo\`  
**Sitio web:** https://ferreteria-oviedo.web.app  
**Panel Admin:** https://ferreteria-oviedo.web.app/panel-admin  
**Panel Compras:** https://oviedo-compras-admin.web.app  

---

## ¿QUÉ NECESITO HACER HOY?

| Situación | Script a ejecutar |
|-----------|------------------|
| Actualizar catálogo + precios + publicar | `ACTUALIZAR_Y_PUBLICAR.bat` |
| Actualizar ventas El Manzano (panel admin) | `VENTAS EL MANZANO LOCAL\PREPARAR_Y_PUBLICAR.bat` |
| Solo publicar cambios de código (sin catálogo) | `PUBLICAR.bat` |
| Subir ventas El Manzano a Firestore | `VENTAS EL MANZANO\ACTUALIZAR_VENTAS.bat` |
| Actualizar panel de compras | `PANEL ADMIN COMPRAS\PUBLICAR_COMPRAS.bat` |

---

## OPERACIÓN 1 — ACTUALIZACIÓN COMPLETA DE CATÁLOGO
> Usar cuando llegó un nuevo informe ERP con precios/stock actualizados

### Prerequisito
Tener el informe exportado del ERP en:
```
D:\ferreteria-oviedo\CATALOGO PRODUCTOS\actualizar.xlsx
```

### Ejecutar
Doble clic en:
```
D:\ferreteria-oviedo\ACTUALIZAR_Y_PUBLICAR.bat
```

### Qué hace automáticamente (en orden):

**PASO 0 — Descarga automática desde ERP** *(opcional, si se llama desde el BAT con descarga)*
- `descargar_erp.py` → descarga precios desde VisorRS + stock de 5 bodegas (PEM/SEM/IEM/TEM/RCE)
- Resultado: `CATALOGO PRODUCTOS\actualizar.xlsx`

**PASO 1 — Procesar catálogo**
- `procesar-actualizacion.py`
- Lee: `actualizar.xlsx`
- Genera: `Datos.xlsx` (con todas las columnas de bodega)

**PASO 2 — Exportar CSV**
- `xlsx_a_csv.py`
- Lee: `Datos.xlsx`
- Genera: `Datos.csv`

**PASO 3 — Generar JSON**
- `csv_a_json.py`
- Lee: `Datos.csv`
- Genera: `Datos.json` (lo que lee el sitio web)

**PASO 4 — Publicar**
- `firebase deploy --only hosting`
- Sube: `Datos.json` + HTML + SW
- URL activa: https://ferreteria-oviedo.web.app

### Pregunta que hace el BAT
```
S = Precios VISIBLES para clientes
N = Precios OCULTOS (consultan por WhatsApp)
E = Sin cambios  ← default en 30 seg
```
Si no respondes en 30 segundos → avanza con **Sin cambios (E)**.

### Resultado esperado
```
[OK] PASO 1 - Catalogo procesado desde ERP
[OK] PASO 2 - Datos.csv generado sin decimales
[OK] PASO 3 - Datos.json generado para el sitio web
[OK] PASO 4 - Sitio web publicado en Firebase
```

### Si falla en PASO 4 (sin internet)
Los pasos 1-3 ya quedaron OK. Cuando tengas conexión ejecuta solo:
```
D:\ferreteria-oviedo\PUBLICAR.bat
```

---

## OPERACIÓN 2 — ACTUALIZAR VENTAS EL MANZANO (panel admin)
> Usar cuando necesitas que el panel admin muestre ventas actualizadas

### Prerequisito
Tener el archivo de ventas exportado:
```
D:\ferreteria-oviedo\VENTAS EL MANZANO LOCAL\Ventas_Obs_2025.xlsm
```
*(Debe estar cerrado antes de ejecutar)*

### Ejecutar
Doble clic en:
```
D:\ferreteria-oviedo\VENTAS EL MANZANO LOCAL\PREPARAR_Y_PUBLICAR.bat
```

### Qué hace:
1. Lee `Ventas_Obs_2025.xlsm` → filtra El Manzano desde 01/01/2026
2. Lee `CATALOGO PRODUCTOS\Datos.xlsx` para cruzar descripciones
3. Genera en `salida\`:
   - `datos_manzano.xlsx` (Excel: hojas Ventas + Catálogo)
   - `ventas_manzano.csv`
4. Publica `data/ventas-manzano.json` en Firebase Hosting

### Automático cada día a las 7 PM
Windows Task Scheduler ejecuta:
```
D:\ferreteria-oviedo\VENTAS EL MANZANO LOCAL\ACTUALIZAR_AUTO.bat
```
Log en: `VENTAS EL MANZANO LOCAL\salida\auto_log.txt`

---

## OPERACIÓN 3 — SOLO PUBLICAR CAMBIOS DE CÓDIGO
> Usar cuando modificaste HTML/JS del sitio y quieres subirlo sin tocar el catálogo

### Ejecutar
Doble clic en:
```
D:\ferreteria-oviedo\PUBLICAR.bat
```

### Qué hace:
1. Verifica Firebase CLI
2. Pregunta visibilidad de precios (igual que el otro BAT)
3. `firebase deploy --only hosting`

### Cuando usar este BAT en lugar del otro:
- Cambios en `panel-admin.html`, `index.html` o `panel-cliente.html`
- Cambios en `firebase-config.js` o `sw.js`
- Cambios en `firestore.rules` *(en ese caso agregar `--only firestore:rules`)*
- Después de que el BAT completo falló solo en el PASO 4

---

## OPERACIÓN 4 — SUBIR VENTAS MANZANO A FIRESTORE
> Alternativa: sube ventas directamente a la colección `ventas` en Firestore

### Ejecutar
Doble clic en:
```
D:\ferreteria-oviedo\VENTAS EL MANZANO\ACTUALIZAR_VENTAS.bat
```

### Diferencia con OPERACIÓN 2:
| | OPERACIÓN 2 (LOCAL) | OPERACIÓN 4 (FIRESTORE) |
|--|--|--|
| Destino | JSON en Hosting | Colección `ventas` en Firestore |
| Panel admin | Lee JSON (0 lecturas Firestore) | Lee Firestore (usa cuota) |
| Recomendado | ✅ Sí (usa menos cuota) | Solo si el JSON falla |

---

## OPERACIÓN 5 — ACTUALIZAR PANEL DE COMPRAS
> Panel independiente en oviedo-compras-admin.web.app

### Prerequisito
Tener el archivo actualizado:
```
D:\ferreteria-oviedo\PANEL ADMIN COMPRAS\SOLICITUDES SANTIAGO_TLC2.XLSM
```

### Ejecutar
Doble clic en:
```
D:\ferreteria-oviedo\PANEL ADMIN COMPRAS\PUBLICAR_COMPRAS.bat
```

### Qué hace:
1. `preparar_datos_compras.py` → XLSM → JSON
2. `firebase deploy` → oviedo-compras-admin.web.app

---

## CRONOGRAMA TÍPICO SEMANAL

| Día | Acción | Script |
|-----|--------|--------|
| **Lunes** | Actualizar catálogo con precios/stock de la semana | `ACTUALIZAR_Y_PUBLICAR.bat` |
| **Todos los días 7 PM** | Auto-actualización de ventas | Automático (Task Scheduler) |
| **Cuando llegue un XLSM nuevo** | Actualizar panel compras | `PANEL ADMIN COMPRAS\PUBLICAR_COMPRAS.bat` |
| **Cuando hagas cambios de código** | Solo publicar | `PUBLICAR.bat` |

---

## ERRORES COMUNES Y SOLUCIONES

### "Firebase CLI no encontrado"
```
npm install -g firebase-tools
```

### "Sesión Firebase expirada"
```
firebase login
```
Luego vuelve a ejecutar el BAT.

### "No se encontró actualizar.xlsx"
El archivo debe estar en:
```
D:\ferreteria-oviedo\CATALOGO PRODUCTOS\actualizar.xlsx
```
Descárgalo manualmente del ERP y ponlo ahí con ese nombre exacto.

### El sitio web no muestra los cambios
Presiona `Ctrl + Shift + R` en el navegador (recarga forzada sin caché).  
Si sigue igual, Panel Admin → Mejoras → 🔥 Limpiar caché completo.

### "python no está instalado"
Descarga Python desde https://python.org/downloads/ y asegúrate de marcar "Add to PATH".

### El BAT no abre / se cierra solo
Clic derecho → "Ejecutar como administrador".

---

## ARCHIVOS IMPORTANTES — NO BORRAR NI MOVER

| Archivo | Para qué sirve |
|---------|---------------|
| `ACTUALIZAR_Y_PUBLICAR.bat` | Actualización completa catálogo + web |
| `PUBLICAR.bat` | Solo publicar cambios de código |
| `firebase.json` | Configuración Firebase Hosting |
| `firestore.rules` | Reglas de seguridad Firestore |
| `firebase-config.js` | SDK Firebase compartido |
| `CATALOGO PRODUCTOS\actualizar.xlsx` | Fuente del catálogo (se reemplaza con cada ERP) |
| `CATALOGO PRODUCTOS\Datos.xlsx` | Catálogo procesado (no borrar, se regenera) |
| `CATALOGO PRODUCTOS\scripts\credenciales_erp.ini` | Credenciales ERP (**nunca publicar**) |
| `VENTAS EL MANZANO\credenciales_erp.ini` | Credenciales ERP ventas (**nunca publicar**) |

---

## ARQUITECTURA RÁPIDA

```
ERP Justime
    │
    ▼
descargar_erp.py ──────→ actualizar.xlsx
                              │
procesar-actualizacion.py ←──┘
    │
    ▼
Datos.xlsx → Datos.csv → Datos.json
                              │
firebase deploy ←─────────────┘
    │
    ▼
https://ferreteria-oviedo.web.app
├── /              → Panel Vendedor (index.html)
├── /panel-cliente → Panel Cliente
└── /panel-admin   → Panel Admin
```

---

## ROLES Y PANELES

| Rol | Panel | URL |
|-----|-------|-----|
| **admin** | Panel Admin completo | `/panel-admin` |
| **cooperador** | Panel Admin (solo lectura, sin modificar nada) | `/panel-admin` |
| **vendedor** | Panel Vendedor (catálogo + carrito + cotización PDF) | `/` o `/vendedor` |
| **cliente** | Panel Cliente (catálogo + WhatsApp + cotización PDF) | `/panel-cliente` |

**Para asignar cooperador:** Panel Admin → Usuarios → selector de rol → "cooperador" → confirmar.

---

## VERSIÓN ACTUAL

**V33.4** (2026-05-15)

Cambios desde V33.3:
- Stock por bodega individual (PEM/SEM/IEM/TEM/RCE) en tabs Quiebre, Sobre-stock, Tránsito
- Rol Cooperador: acceso de solo lectura al panel admin con audit log completo
- Cooperador notifica ingreso al admin y queda en log de cambios
- Precio costo visible en panel vendedor con margen vs retail
- WhatsApp de cotización movido exclusivamente al panel cliente
- Fix XSS en notificaciones (venAdmEsc aplicado)
- Quota Firebase trackea lecturas reales (badge del panel)
- Limpieza: código legacy V16-V24 eliminado de los 3 paneles
