---
name: Ferretería Oviedo - Estado del Proyecto V33.4+
description: Fuente de verdad técnica V33.4 (2026-05-15): inventario por bodega completo, rol cooperador con notificaciones, WhatsApp solo en cliente, costo en vendedor, limpieza legacy
type: project
originSessionId: 2645a767-1c7a-4923-ad11-fbefc9351c71
---
# ESTADO ACTUAL DEL PROYECTO — V33.4 (2026-05-15)

**Ruta real:** `D:\ferreteria-oviedo\`
**URL producción:** `https://ferreteria-oviedo.web.app`

**Why:** V33.4 es la versión activa. Manual de actualizaciones en `MANUAL_MAESTRO.md`.

---

## Stack

- Vanilla JS + Firebase SDK compat v9.22.0 (CDN)
- Firebase Hosting (static) + Firestore + Firebase Auth (sin Storage desde V31)
- jsPDF 2.5.1 + jsPDF-AutoTable 3.5.31
- Chart.js 4.4.0 (solo panel-admin) + Cropper.js 1.5.13 (solo panel-admin)
- Python + pandas + openpyxl + requests + playwright (pipeline catálogo + descarga ERP)
- Node.js (predeploy SW timestamp)
- Service Worker (PWA, caché offline)
- Deploy exclusivamente vía `.bat` (GitHub Actions eliminado)

---

## Archivos raíz

| Archivo | Rol |
|---------|-----|
| `index.html` | Panel Vendedor |
| `panel-admin.html` | Panel Admin (~10.200 líneas) |
| `panel-cliente.html` | Panel Cliente |
| `setup-admin.html` | Config inicial (uso único) |
| `firebase-config.js` | SDK config + todas las funciones compartidas |
| `firebase.json` | Hosting config + rewrites + predeploy + headers HTTP |
| `firestore.rules` | Reglas de seguridad V33.1 (endurecidas) |
| `sw.js` | Service Worker PWA |
| `update-sw-version.js` | Predeploy: actualiza BUILD_DATE en sw.js |
| `ACTUALIZAR_Y_PUBLICAR.bat` | Pipeline completo ERP → sitio web |
| `PUBLICAR.bat` | Deploy solo (sin actualizar catálogo) |
| `SUBIR_VENTAS.bat` | Script legacy: sube ventas por vendedor a Firestore |
| `V33.md` | Documentación técnica completa del sistema |
| `ARQUITECTURA_FIREBASE.md` | Arquitectura detallada Firebase Hosting vs Firestore |

## Subcarpetas

### `CATALOGO PRODUCTOS/`
| Archivo | Rol |
|---------|-----|
| `MANUAL.md` | Manual de usuario |
| `actualizar.xlsx` | Fuente: informe ERP descargado |
| `Datos.xlsx / Datos.csv / Datos.json` | Catálogo procesado (generado) |
| `scripts/descargar_erp.py` | Descarga automática desde ERP Justime → actualizar.xlsx |
| `scripts/credenciales_erp.ini` | **V33.1** Credenciales ERP externalizadas (no se publica) |
| `scripts/procesar-actualizacion.py` | actualizar.xlsx → Datos.xlsx |
| `scripts/xlsx_a_csv.py` | Datos.xlsx → Datos.csv |
| `scripts/csv_a_json.py` | Datos.csv → Datos.json |
| `scripts/actualizar_config_precios.py` | Actualiza config/precios en Firestore via OAuth2 |
| `scripts/subir_ventas.py` | Ventas HTM del ERP → Firestore |
| `scripts/GUIA_CREAR_BAT.md` | Referencia técnica para crear .bat (ANSI, escapado) |

### `VENTAS EL MANZANO LOCAL/`
| Archivo | Rol |
|---------|-----|
| `MANUAL.md` | Manual de usuario |
| `PREPARAR_Y_PUBLICAR.bat` | Script principal: XLSM → JSON → Firebase Hosting |
| `ACTUALIZAR_AUTO.bat` | Script no-interactivo (tarea programada 7 PM) |
| `Ventas_Obs_2025.xlsm` | Reporte de ventas exportado desde ERP (fuente) |
| `ventas_raw_backup.xlsx` | Backup automático cuando XLSM está vacío |
| `preparar_datos.py` | XLSM → CSV + Excel + JSON (soporta --auto) |
| `exportar_consulta_ventas.py` | Automatiza exportación desde Justime (pywin32) |
| `calibrar_offsets.py` | Calibración de coordenadas de controles Justime |
| `salida/ventas_manzano.csv` | Ventas CSV (generado) |
| `salida/datos_manzano.xlsx` | Excel hojas Ventas + Catálogo (generado) |
| `salida/auto_log.txt` | Log de ejecuciones automáticas |

### `VENTAS EL MANZANO/`
Pipeline principal ventas → `data/ventas-manzano.json` → Firebase Hosting (Panel Admin).
Bodegas: PEM(22), SEM(13), CEM(23), MEM(24). xToken: `b91f9f93-985d-4231-a849-d2e06aa737df`.

| Archivo | Rol |
|---------|-----|
| `MANUAL.md` | Manual de usuario |
| `ACTUALIZAR_VENTAS.bat` | **Pipeline completo**: bodegas + ventas → JSON → deploy |
| `DESCARGAR_VENTAS.bat` | Solo descarga los xlsx del ERP (sin procesar ni publicar) |
| `ENVIAR_REPORTE.bat` | Envía reporte por email SMTP desde `.env` |
| `main.py` | Orquesta: descargar_bodegas → descargar_ventas_erp → JOIN → JSON → deploy |
| `descargar_bodegas.py` | HTTP directo: reporte bodegas ERP → `reporte_bodegas_YYYYMMDD.xlsx` |
| `descargar_ventas_erp.py` | Playwright: dos reportes ERP → `ventas_erp_producto_*.xlsx` + `ventas_erp_cliente_*.xlsx` |
| `enviar_reporte_vendedores.py` | Lee ventas-manzano.json y envía HTML por SMTP |
| `credenciales_erp.ini` | **V33.1** Credenciales ERP (BASE, USER, CLAVE, XTOKEN) — no se publica |
| `.env` | Credenciales SMTP para envío de email — no se publica |
| `subir_ventas_manzano.py` | Legacy: XLSM → Firestore `ventas` (mantener para respaldo) |
| `SUBIR_VENTAS_MANZANO.bat` | Legacy: ejecuta subir_ventas_manzano.py |

### `PANEL ADMIN COMPRAS/`
Panel independiente para gestión de compras. Proyecto Firebase: `oviedo-compras-admin`.

| Archivo | Rol |
|---------|-----|
| `MANUAL.md` | **V33.2** Manual de usuario (nuevo) |
| `SOLICITUDES SANTIAGO_TLC2.XLSM` | Fuente de datos compras |
| `preparar_datos_compras.py` | XLSM → JSON de datos |
| `PUBLICAR_COMPRAS.bat` | Publica el panel en oviedo-compras-admin.web.app |

### `data/`
- `ventas-manzano.json` — JSON de ventas El Manzano (leído por panel-admin.html, sin usar Firestore)

---

## URLs del sitio

| Panel | URL |
|-------|-----|
| Cliente | `https://ferreteria-oviedo.web.app/panel-cliente` |
| Vendedor | `https://ferreteria-oviedo.web.app` o `/vendedor` |
| Admin | `https://ferreteria-oviedo.web.app/panel-admin` |
| Compras | `https://oviedo-compras-admin.web.app` |

---

## Colecciones Firestore

| Colección | Contenido |
|-----------|-----------|
| `users` | Todos los usuarios (Firebase Auth UID desde V31) |
| `sesiones_activas` | Presencia activa en tiempo real |
| `sesionesLog` | Historial de accesos (dedup uid+deviceId) |
| `cotizaciones` | Cotizaciones guardadas |
| `promos` | Promociones del admin |
| `solicitudes_cupon` | Solicitudes de descuento de clientes |
| `config/registroControl` | Flags habilitación de registro por rol |
| `config/correlativo` | Contador transaccional de cotizaciones |
| `config/urls` | URLs pública y proxy para Datos.json |
| `config/cupones` | Flag solicitudes de clientes habilitadas |
| `config/redes` | `wa: '56938623488'` — número WhatsApp Business |
| `config/precios` | `mostrarPrecioCliente` + `mostrarPrecioVendedor` (independientes) |
| `config/banner` | Banner principal: imagen base64 + ajustes visuales + texto + posición |
| `config/tareasClaude` | Buzón de tareas para desarrollo |
| `config/sessionConfig` | Tipo de persistencia: `{tipo:'LOCAL'\|'SESSION'}` |
| `auditLog` | Registro de accesos: `{uid, nombre, role, panel, ts, fecha}` |
| `ventas` | Historial por vendedor (panel vendedor) |
| `ventasLineas` | Fallback admin (obsoleto como fuente primaria) |
| `comandos` | Para daemon futuro (solo admin) |
| `productos` | Catálogo fallback Firestore |

---

## Reglas Firestore V33.1

Archivo `firestore.rules` con reglas endurecidas:
- `users`: `allow get` vs `allow list` separados (list solo admin)
- `config`: `sessionConfig` y `registroControl` son públicos (se leen antes del login)
- `ventas` y `ventasLineas`: escritura bloqueada (`if false`) — solo scripts con token CLI
- catch-all `/{collection}/{docId}` → `if false` (bloquea colecciones no declaradas)
- Helpers: `autenticado()`, `esAdmin()`, `esVendedor()`
- Campos protegidos en update de `users`: `role`, `estado`, `registroAprobado`

---

## Seguridad V33.1

### HTTP Headers (firebase.json)
```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cache-Control: no-cache  (solo HTML)
```

### Credenciales ERP externalizadas
- `CATALOGO PRODUCTOS\scripts\credenciales_erp.ini` (BASE, USER, CLAVE)
- `VENTAS EL MANZANO\credenciales_erp.ini` (BASE, USER, CLAVE, XTOKEN)
- Ambos están en `firebase.json` ignore list → no se publican

### Timeouts de sesión
| Panel | Timeout |
|-------|---------|
| Admin | 4 horas |
| Vendedor | 8 horas |
| Cliente | 8 horas |

---

## Monitor de Cuota Firebase V33.1/V33.2

localStorage key: `fq_YYYY-MM-DD` → `{reads, writes, deletes, log[]}`

- **Badge topbar** `#quotaTopBadge` → muestra R+W del día, clickeable → abre modal
- **Modal** `#quotaModal` → gauges, historial, registro manual, reset
- **Inline tab-mejoras** → cards compactas
- Funciones: `quotaTrackRead(n)`, `quotaTrackWrite(n)`, `quotaActualizar()`, `quotaAbrirModal()`

**Bug V33.2 corregido:** `.quota-modal{display:none}` en CSS impedía que el card del modal se mostrara. El div `#quotaModal` (overlay) se controla por JS; el div `.quota-modal` (card) debe ser siempre visible dentro del overlay. Fix: `.quota-modal` ahora tiene estilos de card (fondo blanco, bordes, max-width:700px).

---

## Gestor de Caché V33.1

En Panel Admin → Pestaña Mejoras (scroll hacia abajo):
- `cacheLimpiarQuota()` — borra claves `fq_*`
- `cacheLimpiarLocalStorage()` — borra todo el localStorage
- `cacheLimpiarSW()` — desregistra SW + limpia Cache API
- `cacheRecargarDuro()` — todo lo anterior + reload forzado

---

## Autenticación — V31 (solo Firebase Auth, legacy eliminado)

```
Ruta A: signInWithEmailAndPassword → verifica Firestore users → mostrarApp*
Ruta B: GoogleAuthProvider → signInWithPopup → verifica UID → mostrarApp*
Ruta C: sendPasswordResetEmail (en 3 paneles)
```
Google Sign-In NO crea usuarios. El admin debe registrarlos primero.
Auto-login: `localStorage ov_creds = { uid, email }` → onAuthStateChanged

---

## Pipeline catálogo

```
[0] descargar_erp.py → actualizar.xlsx
      Precios: VisorRS Playwright → exportReport('CSV') → DataFrame
      Stock:   Reporte_Bodegas_Detalle.asp HTTP (IdBodega 22+13)
      Fallback: CSV local ~/Downloads < 24h
[CONFIG] Pregunta precios S/N/Enter → actualizar_config_precios.py (auto: E en 30s)
[1] actualizar.xlsx → Datos.xlsx     (procesar-actualizacion.py)
[2] Datos.xlsx → Datos.csv           (xlsx_a_csv.py)
[3] Datos.csv → Datos.json           (csv_a_json.py)
[4] firebase deploy --only hosting   (predeploy: update-sw-version.js)
```

> V33.3: VisorRS usa CSV (no Excel). Fix definitivo error diario ReportViewer SSRS
> (`Sys.InvalidOperationException`). Polling `get_reportAreaContentType()` antes de exportar.
> Todos los prompts .bat tienen timeout 30s con default seguro.

---

## Pipeline ventas Manzano (fuente principal panel admin)

**Pipeline nuevo (V33.4+) — `VENTAS EL MANZANO/`:**
```
[1] descargar_bodegas.py     → reporte_bodegas_YYYYMMDD.xlsx   (HTTP directo, 4 bodegas)
[2] descargar_ventas_erp.py  → ventas_erp_producto_*.xlsx
                             + ventas_erp_cliente_*.xlsx        (Playwright 2 reportes)
[3] main.py --sin-descarga   → JOIN bodegas ⟕ ventas → data/ventas-manzano.json
[4] firebase deploy --only hosting
```
Punto de entrada: `ACTUALIZAR_VENTAS.bat` (flujo completo) o `DESCARGAR_VENTAS.bat` (solo paso 1+2).

**Pipeline legacy (mantenido) — `VENTAS EL MANZANO LOCAL/`:**
```
Ventas_Obs_2025.xlsm → preparar_datos.py → data/ventas-manzano.json → firebase deploy
```
Tarea Windows 7 PM diaria: `ACTUALIZAR_AUTO.bat` → `preparar_datos.py --auto`

**IMPORTANTE:** Panel Admin lee `/data/ventas-manzano.json` desde Hosting (0 lecturas Firestore).
Fallback a Firestore `ventasLineas` solo si el JSON de Hosting falla (raro).

---

## ERP Justime

- BASE: `http://200.6.113.97/Justweb_Foviedo`
- USER: `agonzalez` / CLAVE: `4040`
- XTOKEN: `943679d1-f74c-f111-8b81-00155d9d0600` (xToken El Manzano — catálogo)
- Precios: VisorRS (`foviedo.justtime.cl/visor/`) via Playwright + msedge con xToken El Manzano
- Fallback precios: CSV local `~/Downloads` (< 24h)

### Bodegas El Manzano

| Bodega | Nombre | IdBodega | Rol | TRANS |
|--------|--------|----------|-----|-------|
| PEM | Patio El Manzano | 22 | Venta real — productos NO portables | Columna separada "TRANSITO PEM" |
| SEM | Sala El Manzano | 13 | Venta real — productos portables | No se necesita |
| IEM | Ingreso El Manzano | 20 | Sistémica — proveedor llega a casa matriz, se traslada en camión a sucursal | No se necesita |
| TEM | Tránsito El Manzano | 46 | Sistémica — mismo rol que IEM pero IdBodega distinto | Sumar a Disp TEM |
| RCE | Recepción El Manzano | 55 | Sistémica — productos en revisión (cantidad/calidad/descripción) antes de disponibilizar | No se necesita |

### Regla de descarga (optimización)
- **PEM y SEM**: descarga completa (marca, hiperFam, familia, subFam, costo, Disp, Trans)
- **IEM, TEM, RCE**: descargar **solo código + Disp** (+ Trans para TEM). Cruzar por código con catálogo PEM/SEM para descripción y clasificación. Ahorra tiempo y ancho de banda.

### Columna TRANS por bodega en el panel
- `TRANSITO PEM` = `Trans_PEM` → columna **separada**
- `TEM` = `Disp_TEM + Trans_TEM` → **una sola columna sumada**
- IEM, RCE, SEM → solo `Disp`, sin Trans propia

---

## Riesgos activos V33.2

| Nivel | Descripción |
|-------|-------------|
| RESUELTO | Contraseñas en plaintext — eliminadas V31 |
| RESUELTO | Login legacy bypasseable — eliminado V31 |
| RESUELTO | config write público — requiere esAdmin() V31 |
| RESUELTO | Credenciales ERP en código — externalizadas V33.1 |
| RESUELTO | Sin timeout de sesión — implementado V33.1 |
| RESUELTO | Sin headers HTTP seguros — agregados V33.1 |
| RESUELTO | XSS en innerHTML — venAdmEsc() aplicado en V33.4 |
| RESUELTO | Rate limiting login — implementado en 3 paneles V33.5 |

---

## Calendario hábil y cálculo días hábiles (CALCULOS.md)

- Lun–Sáb trabajados; Dom + feriados chilenos = 0
- `_vadmDiasHabilesN(n)`: usa `setDate(getDate()-n)` → ventana **n+1 días calendario** (desde hoy-n hasta hoy, inclusive)
- Ejemplo n=90, hoy=14-may-2026: desde=13-feb-2026, 91 cal, 13 domingos, 3 feriados (VS+SS+1mayo) = **75 dh**
- Horizontes reales: 30→31 cal/~26dh · 60→61 cal/~49dh · 90→91 cal/~75dh
- Bug corregido (2026-05-14): `c90/c60/c30` en `vadmRenderQuiebre`, `vadmRenderSobreStock`, `vadmRenderTransito`, tab inventario salud → agregado `.setHours(0,0,0,0)` para incluir registros del día de corte exacto (parseFR crea fechas en medianoche)
- Feriados: 13 fijos + Viernes Santo + Sábado Santo (Computus — Algoritmo de Butcher)
- NUNCA hardcodear divisores 30/60/90; siempre usar `_vadmDiasHabilesN(n)` o `_vadmDiasHabiles(desde,hasta)`

---

## Panel Admin — Inventario por bodega (V33.4 — COMPLETO)

Implementado manualmente por el usuario. Stock individual por bodega en los 3 tabs:
- **Quiebre**: PEM | SEM | IEM | TEM | RCE | TRANS PEM | CD DISP | CD TRANS | ABC | Cobertura | Rot.30/60/90d
- **Sobre-stock**: PEM | SEM | CD DISP | CD TRANS | Cobertura | Valor stock
- **Tránsito**: PEM | SEM | TRANS PEM | CD DISP | CD TRANS | Total esperado | Cob. con/sin tránsito

---

## Tareas pendientes (al cierre de V33.4)

| Prioridad | Tarea |
|-----------|-------|
| ALTA | **Daemon automatización** — proceso Python que lee colección `comandos` en Firestore y ejecuta scripts locales sin intervención manual. Ver `ARQUITECTURA_FIREBASE.md`. |
| RESUELTO | **Rate limiting** — `_vendCheckBloqueo` agregado a vendedor V33.5. Los 3 paneles protegidos. |
| BAJA | Desactivar/documentar modo "categorias" de `subir_ventas.py` (escribe en `ventasLineas`, obsoleto) |
| BAJA | Panel cliente: filtro por marca persistente entre sesiones (actualmente se resetea al recargar) |

## Resuelto en V33.4 (2026-05-15)
- ✅ Inventario por bodega (PEM/SEM/IEM/TEM/RCE) en tabs Quiebre, Sobre-stock, Tránsito
- ✅ Rol Cooperador: notificación de ingreso al admin, log de cambios, audit log con ícono/color propio
- ✅ XSS fix: venAdmEsc() en renderNotifItem y cargarAuditLog
- ✅ Quota Firebase: quotaTrackRead() en onSnapshot principales (sesiones_activas, cotizaciones, users, auditLog)
- ✅ WhatsApp de cotización: eliminado de panel vendedor, queda solo en panel cliente
- ✅ Precio costo visible en panel vendedor con margen vs retail
- ✅ Limpieza legacy: historial V16-V24 eliminado de panel-cliente, login legacy removido de vendedor y cliente, _bnrEsStorage() eliminado de admin
- ✅ Log de cambios de rol: adminCambiarRolFS() popula logUsuarios al cambiar un rol

---

## Reglas de oro (no negociables)

1. **Costo cero** — Todo en plan Spark gratuito. Nunca proponer soluciones de pago.
2. **JSON estático en Hosting >> Firestore** — Archivos grandes van a Hosting. Firestore solo para datos pequeños en tiempo real.
3. **No romper .bat ni .py** — El personal ejecuta `ACTUALIZAR_Y_PUBLICAR.bat` y `ACTUALIZAR_AUTO.bat`. Compatibilidad total siempre.
4. **Sintaxis JS crítica** — `panel-admin.html` tiene ~10.200 líneas JS en un solo `<script>`. Un error de sintaxis rompe TODO. Verificar con `node --check` antes de desplegar.
5. **No publicar credenciales** — Los `.ini` están en ignore de `firebase.json`. Nunca moverlos a rutas publicadas.

---

## Historial de versiones

| Versión | Fecha | Cambios clave |
|---------|-------|---------------|
| V29 | 2026-05-07 | WhatsApp, stock badges, precios, banner base64, ERP scraping |
| V30 | 2026-05-10 | Banner Cropper.js + editor texto + auto-ajuste. Precios toggle. Tab Mejoras. Buzón Claude |
| V31 | 2026-05-10 | Firebase Auth exclusivo. Google Sign-In. Storage eliminado. auditLog |
| V32 | 2026-05-11 | Fix banner. Pipeline ERP VisorRS. Fix HTTP 403. Fix BAT escapado |
| V33 | 2026-05-11 | Fix fecha undefined en análisis. NC en totales. Multi-vendedor. JSON-first vendedor. Auto 7PM |
| V33.1 | 2026-05-13 | Firestore rules endurecidas. HTTP headers. Credenciales ini. Timeouts sesión. Monitor cuota. Gestor caché |
| V33.2 | 2026-05-13 | Fix CSS modal cuota (display:none en card interno). Fix typo gap=6px. Init quota/cache en login |
| V33.3 | 2026-05-13 | descargar_erp.py: export CSV (no Excel). Fix definitivo ReportViewer SSRS race condition. BAT prompts con timeout 30s. Pipeline URL tab panel-admin actualizado |
| V33.4 | 2026-05-15 | Inventario por bodega completo. Cooperador notifica ingreso + audit log. XSS fix. Quota tracking. WA solo en cliente. Costo visible en vendedor. Limpieza legacy. MANUAL_MAESTRO.md |
| V33.5 | 2026-05-17 | Rate limiting en 3 paneles. Fix tab Por Hora (vadmParseHora 24h). Logos recuperados (logo_oviedo.jpg). FONDO3.jpeg→.jpg. TORNILLO.JPG eliminado. |
