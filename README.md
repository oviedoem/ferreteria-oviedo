# Ferretería Oviedo — Sistema Web V37

Sistema de gestión interna y catálogo publicado en Firebase Hosting.
Tres paneles independientes con autenticación Firebase Auth (Google + Email/Password).

**Deploy:** 2026-05-26 | **Versión activa:** V37

## URLs

| Panel | URL |
|-------|-----|
| Cliente | https://ferreteria-oviedo.web.app/panel-cliente |
| Vendedor | https://ferreteria-oviedo.web.app/vendedor |
| Administración | https://ferreteria-oviedo.web.app/panel-admin |

## Arquitectura

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML + CSS + JS Vanilla (sin framework) |
| Auth | Firebase Auth — Google OAuth + Email/Password |
| Base de datos | Firestore (auth, config, cotizaciones, sesiones, notificaciones) |
| Hosting | Firebase Hosting — JSONs estáticos (costo cero) |
| Pipeline ERP | Python — descarga y procesa datos de JustWeb |

## Archivos principales

| Archivo | Descripción |
|---------|-------------|
| `panel-admin.html` | Panel administrador — ventas, inventario, rankings, notificaciones en tiempo real |
| `panel-cliente.html` | App clientes — catálogo, cotizaciones PDF, login Google |
| `index.html` | Panel vendedor — cotizaciones y consulta de precios |
| `firebase-config.js` | Inicialización Firebase, helpers Firestore compartidos |
| `firestore.rules` | Reglas de seguridad por rol (admin / vendedor / cliente) |
| `sw.js` | Service Worker — PWA offline |

## Flujo de datos (pipeline ERP)

```
ERP JustWeb
  └─ descargar_erp.py        → actualizar.xlsx (precios + stock todas las bodegas)
  └─ descargar_ventas_erp.py → ventas_erp_producto_YYYYMMDD.xlsx
       │
  procesar-actualizacion.py  → Datos.xlsx → Datos.csv → Datos.json
  main.py                    → ventas-manzano-YYYY-MM.json (mensual)
                             → ventas-manzano-YYYY.json    (anual)
       │
  firebase deploy --only hosting
```

## Bodegas comerciales

`PEM` · `SEM` · `CEM` · `MEM` — stock visible en panel  
`IEM` · `TEM` · `RCE` · `CD` — auxiliares/logísticas

## Módulos del panel admin

- **Ventas:** Detalle · Análisis · Rankings · Temporal · Clientes · Entre Fechas
- **Inventario:** Stock & Quiebre · Sobre-stock · Tránsito · Baja Rotación · Merma · MEM · Liquidación
- **Árbol Retail:** Árbol · Tabla KPIs · Mapa de Calor
- **Catálogo:** Precios · Configuración ERP
- **Marketing:** Promociones · Cupones · Banner
- **Sistema:** Notificaciones en tiempo real · Sesiones activas · Usuarios

## Flujo de usuarios

Ver [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md) para detalles de autenticación y roles.

Resumen:
- Registro por Google o Email/Password
- `requiereAprobacionAdmin=true` → estado `pendiente` hasta que admin apruebe
- Roles: `admin` · `vendedor` · `cooperador` · `cliente`
- Admin puede reenviar acceso, bloquear/activar usuarios desde el panel

## Seguridad

- Credenciales ERP (`credenciales_erp.ini`) excluidas del repo
- Datos de ventas, archivos Excel y scripts Python excluidos vía `.firebaseignore`
- Firestore rules con control de acceso por rol
- Headers de seguridad en `firebase.json` (CSP, X-Frame-Options, etc.)

## Nota para Claude / Codex

Leer antes de cualquier acción: `AGENTS.md` → `CLAUDE.md` → `docs/`  
Directorio activo de trabajo: `D:\ferreteria-oviedo\` (NO este repo directamente)
