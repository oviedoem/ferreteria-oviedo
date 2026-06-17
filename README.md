# Ferretería Oviedo — Sistema de Gestión Comercial

Panel web interno para la sucursal **El Manzano** de Ferretería Oviedo MTS.  
Versión activa: **V37.24** · Hosting: [ferreteria-oviedo.web.app](https://ferreteria-oviedo.web.app)

---

## Paneles

| Panel | URL | Acceso |
|-------|-----|--------|
| Vendedor | `/` o `/vendedor` | Vendedores autorizados |
| Admin | `/panel-admin` | Administradores |
| Catálogo / Cliente | `/panel-cliente` | Clientes registrados |

Todos los paneles requieren login (email/contraseña o Google). Los nuevos usuarios quedan en estado **pendiente** hasta ser aprobados por un administrador.

---

## Stack

- **Frontend:** HTML · CSS · JavaScript Vanilla (sin frameworks) · PWA con Service Worker
- **Backend / DB:** Firebase Firestore + Firebase Auth + Firebase Hosting
- **Pipeline datos:** Python 3 → SQL Server ERP (JustWeb SSRS) → JSON estáticos → Hosting
- **Automatización:** Playwright (Blazor Intranet) para datos no disponibles vía API
- **Reglas de seguridad:** Firestore RBAC (roles: admin, cooperador, vendedor, cliente)

---

## Flujo de datos (Pipeline)

```
ERP JustWeb (HTTP/SSRS)            SQL Server (tiempo real)
        │                                    │
        ▼                                    ▼
PASO 1A descargar_erp.py         → actualizar.xlsx  (precios + stock 8 bodegas)
PASO 1B procesar-actualizacion.py → Datos.json + catalogo-dinamico.json
PASO 1C leer_xlsm.py             → ventas-xlsm-*.json + ranking + precios-diff.json
PASO 1D descargar_bod.py         → bod-*.json  (stock detalle por bodega, SQL)
PASO 1E descargar_pedidos.py     → pedidos-comprometidos.json + pedidos-detalle.json
PASO 1F descargar_despachos.py   → despachos-*.json  (NVM sin BVE/FVE)
PASO 1G descargar_blazor_informe.py → informe-stock.json  (Playwright→Blazor)
PASO 1H descargar_blazor_bodegas.py → recepciones-pendientes.json  (GRT/GIB paso 2)
PASO 1K descargar_ventas_enrich.py  → xlsm-enrich.json  (rut+razonSocial, SQL, primario)
        │
        ▼
PASO 2  main.py  (consolidación + JOIN + enriquecimiento + ventas-manzano*.json)
        │
        ▼
firebase deploy --only hosting
        │
        ▼
  Panel Admin / Vendedor / Cliente  (lee JSON estáticos desde Hosting)
```

> **Servidor 2 (SQL):** sincroniza con JustWeb una vez al día a las 22:00. Datos de bodegas, pedidos y despachos reflejan el cierre del día anterior.  
> **Tiempo real:** precios y stock disponible vía HTTP/SSRS — sin límite de actualización.

---

## Bodegas activas

| Código | Nombre | IDBODEGA SQL | Tipo |
|--------|--------|-------------|------|
| PEM | Patio El Manzano | 22 | Comercial |
| SEM | Sala El Manzano | 13 | Comercial |
| CEM | Calzada El Manzano | 24 | Comercial |
| MEM | Mermas El Manzano | 29 | Comercial |
| IEM | Ingreso El Manzano | 72 | Logística |
| RCE | Recepción El Manzano | 55 | Logística |
| TEM | Tránsito El Manzano | 46 | Logística |
| GEM | Gestión El Manzano | 28 | Logística |
| RWE | Retiro Web El Manzano | 49 | Logística |
| EEM | Exhibición El Manzano | 83 | Exhibición |
| CD | Centro de Distribución | 23 | Logística |
| ICD | Ingreso CD | 73 | Logística |

---

## Tabs del Panel Admin

| Grupo | Tabs disponibles |
|-------|-----------------|
| ERP (ventas SQL) | hora · topMarcas · comparativa · vendrank · marcavend · clientes · tipodoc · facturacion · quiebre · sobrestock · transito · merma · rankingmarca · estaciones · bajrot · pagoanalisis · pagorankings · pagotemporal · entrefechas · arbol · arboltabla · arbolheat · sector · stockconsulta · informe-stock · despachos · recepciones |
| XLSM | nc · marcavend2 · preciodiff · mem |
| Análisis bodegas | analisis (selector IEM/RCE/CEM) |

---

## Roles de usuario

| Rol | Panel Admin | Panel Vendedor | Panel Cliente |
|-----|-------------|----------------|---------------|
| admin | Completo | Completo | Completo |
| cooperador | Solo lectura | Completo | Completo |
| vendedor | No | Completo | Completo |
| cliente | No | No | Completo |

---

## Pipeline — comandos principales

```bat
ACTUALIZAR_TODO.bat          :: Pipeline completo (único punto de entrada)
ACTUALIZAR_TODO_AUTO.bat     :: Sin interacción (tarea programada 18:00)
PUBLICAR.bat                 :: Solo firebase deploy
ACTUALIZAR_GITHUB.bat        :: Sync con GitHub
```

---

## Flujo de documentos ERP → Stock

| Documento | Efecto en stock |
|-----------|----------------|
| NVM / VMN | Reserva (Disponible −1, Pedido +1) |
| BVE / FVE | Confirma venta (Pedido −1) |
| GME | Despacho físico (Físico −1, Disponible −1) |
| GRC | Recepción compra (Físico +1, Disponible +1) |
| GDC / NCE | Devolución cliente (Disponible +1, Físico +1) |
| GRT / GIB | Traslado entre bodegas — requiere dos pasos manuales en JustWeb |
| GTS | Salida traslado (Físico −1) |

> **Anomalía JT:** Si Disponible > Físico (Dif < 0), hay un GRT/GIB pendiente del paso 2 (Editar+Grabar). El tab **Recepciones** del panel muestra estos documentos en tiempo real.

---

## Seguridad

- Firestore: reglas RBAC con default-deny
- Auth: login por email o Google, aprobación manual de nuevos usuarios
- Hosting: headers de seguridad (CSP sin unsafe-eval, X-Frame-Options, nosniff)
- API key Firebase: restringida a dominios autorizados + APIs específicas
- Credenciales ERP/SQL: fuera del repositorio, nunca commiteadas (en `E:\config\` cifrado DPAPI)
- Revisión automatizada: open-code-review con 14 reglas (`.opencodereview/rule.json`)

---

## Estructura de archivos

```
index.html              :: Panel Vendedor
panel-admin.html        :: Panel Admin (27+ tabs, ~3300 líneas)
panel-cliente.html      :: Panel Catálogo/Cliente
firebase-config.js      :: Configuración Firebase + auth/Firestore helpers
firestore.rules         :: Reglas de seguridad Firestore (RBAC)
sw.js                   :: Service Worker (PWA, precache)
AGENTS.md               :: Protocolo safe-change + documentación técnica completa
.opencodereview/
  rule.json             :: 14 reglas OCR para revisión automática de código
```

---

## Historial de versiones recientes

| Versión | Fecha | Descripción |
|---------|-------|-------------|
| V37.24 | 2026-06-12 | Bodega ICD agregada al análisis; descargar_bod.py parametrizado por IDSUCURSAL |
| V37.22 | 2026-06-09 | Tab "Por Recepcionar" (GRT/GIB pendientes); PASO 1H Playwright→Blazor |
| V37.19–21 | 2026-06-09 | Auditoría seguridad: XSS fixes, CSP, audit log, venAdmEsc/\_cliEsc |
| V37.15–17 | 2026-06-08 | Excel tab-aware, advertencia cobertura datos, fix tab sector email |
| V37.13–14 | 2026-06-02 | Migración D:→E:, fix árbol auto-init |
