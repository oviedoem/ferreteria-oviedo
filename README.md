# Ferretería Oviedo — Sistema de Gestión Comercial

Panel web interno para la sucursal **El Manzano** de Ferretería Oviedo MTS.  
Versión activa: **V37.17** · Hosting: [ferreteria-oviedo.web.app](https://ferreteria-oviedo.web.app)

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

- **Frontend:** HTML · CSS · JavaScript Vanilla (sin frameworks)
- **Backend / DB:** Firebase Firestore + Firebase Auth + Firebase Hosting
- **Pipeline datos:** Python 3 → SQL Server ERP (JustWeb) → JSON estáticos → Hosting
- **Reglas de seguridad:** Firestore RBAC (roles: admin, cooperador, vendedor, cliente)

---

## Flujo de datos

```
ERP JustWeb (HTTP/SSRS)
        │
        ▼
descargar_erp.py          → actualizar.xlsx  (precios + stock 8 bodegas)
descargar_ventas_erp.py   → ventas-manzano*.json
descargar_bod.py          → bod-*.json        (stock detalle por bodega)
descargar_pedidos.py      → pedidos-*.json
descargar_despachos.py    → despachos-*.json
leer_xlsm.py              → xlsm-enrich.json  (datos XLSM bodegas)
        │
        ▼
     main.py  (consolidación + JOIN + enriquecimiento)
        │
        ▼
firebase deploy --only hosting
        │
        ▼
  Panel Admin / Vendedor / Cliente  (lee JSON estáticos desde Hosting)
```

> Los datos de bodegas, pedidos y despachos provienen del **Servidor 2** que sincroniza una vez al día. Los datos de precios y stock disponible son en tiempo real vía HTTP/SSRS.

---

## Bodegas activas

| Código | Nombre | Tipo |
|--------|--------|------|
| PEM | Patio El Manzano | Comercial |
| SEM | Sala El Manzano | Comercial |
| CEM | Calzada El Manzano | Comercial |
| MEM | Mermas El Manzano | Comercial |
| IEM | Ingreso El Manzano | Logística |
| RCE | Recepción El Manzano | Logística |
| TEM | Tránsito El Manzano | Logística |
| CD | Centro de Distribución | Logística |

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
ACTUALIZAR_TODO.bat          # Pipeline completo (único punto de entrada)
ACTUALIZAR_TODO_AUTO.bat     # Sin interacción (tarea programada)
PUBLICAR.bat                 # Solo firebase deploy
ACTUALIZAR_GITHUB.bat        # Sync con GitHub
```

---

## Flujo de documentos ERP → Stock

| Documento | Efecto |
|-----------|--------|
| NVM / VMN | Reserva stock (Disponible −1, Pedido +1) |
| BVE / FVE | Confirma venta (Pedido −1) |
| GME | Despacho físico (Físico −1, Disponible −1) |
| GRC | Recepción compra (Físico +1, Disponible +1) |
| GDC / NCE | Devolución cliente (Disponible +1, Físico +1) |
| GIB / GTS | Traslado entre bodegas/sucursales |

---

## Seguridad

- Firestore: reglas RBAC con default-deny
- Auth: login por email o Google, aprobación manual de nuevos usuarios
- Hosting: headers de seguridad (CSP, X-Frame-Options, nosniff)
- API key: restringida a dominios autorizados
- Credenciales ERP/SQL: fuera del repositorio, nunca commiteadas

---

## Estructura de archivos relevantes

```
index.html              # Panel Vendedor
panel-admin.html        # Panel Admin
panel-cliente.html      # Panel Catálogo/Cliente
firebase-config.js      # Configuración Firebase + funciones auth/Firestore
firestore.rules         # Reglas de seguridad Firestore
sw.js                   # Service Worker (PWA)
AGENTS.md               # Instrucciones del agente + protocolo safe-change
```
