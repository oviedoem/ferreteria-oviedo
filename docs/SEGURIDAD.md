# Manual de Seguridad — Ferretería Oviedo
**Versión:** V33.4 · 2026-05-15  
**Aplica a:** panel-admin.html · panel-cliente.html · index.html (vendedor) · firestore.rules · firebase-config.js

---

## Índice
1. [Arquitectura general de seguridad](#1-arquitectura-general-de-seguridad)
2. [Roles de usuario](#2-roles-de-usuario)
3. [Autenticación y acceso al panel admin](#3-autenticación-y-acceso-al-panel-admin)
4. [Device Binding — Dispositivos autorizados](#4-device-binding--dispositivos-autorizados)
5. [Rate Limiting — Protección contra ataques de fuerza bruta](#5-rate-limiting--protección-contra-ataques-de-fuerza-bruta)
6. [Rol Cooperador — Acceso restringido](#6-rol-cooperador--acceso-restringido)
7. [Audit Log — Registro de acciones](#7-audit-log--registro-de-acciones)
8. [Reglas de Firestore — Seguridad en servidor](#8-reglas-de-firestore--seguridad-en-servidor)
9. [Seguridad del catálogo y datos públicos](#9-seguridad-del-catálogo-y-datos-públicos)
10. [Headers HTTP de seguridad](#10-headers-http-de-seguridad)
11. [Qué NO protege este sistema](#11-qué-no-protege-este-sistema)
12. [Procedimientos de emergencia](#12-procedimientos-de-emergencia)
13. [Historial de cambios de seguridad](#13-historial-de-cambios-de-seguridad)

---

## 1. Arquitectura general de seguridad

El sistema usa **4 capas de seguridad independientes**. Un atacante debe superar todas para causar daño real:

```
[Internet]
    │
    ▼
[Firebase Auth]          ← Capa 1: autenticación (email+pass o Google)
    │
    ▼
[Role check en Firestore] ← Capa 2: solo role='admin'|'cooperador' entra al panel
    │
    ▼
[Device binding]          ← Capa 3: solo dispositivos autorizados pasan
    │
    ▼
[Firestore Rules server]  ← Capa 4: servidor rechaza escrituras no autorizadas
```

Incluso si un atacante supera las capas 1–3 (tiene credenciales + dispositivo válido), la Capa 4 (reglas de Firestore en el servidor) impide modificar datos críticos sin ser admin real.

---

## 2. Roles de usuario

| Rol | Panel Admin | Panel Vendedor | Panel Cliente | Descripción |
|-----|------------|---------------|--------------|-------------|
| `admin` | ✅ Completo | ✅ Completo | ✅ Completo | Control total del sistema |
| `cooperador` | ✅ Solo lectura operacional | ✅ Completo | ✅ Completo | Ve datos, no configura nada |
| `vendedor` | ❌ | ✅ Completo | ✅ Completo | Panel de ventas y cotizaciones |
| `cliente` | ❌ | ❌ | ✅ Completo | Catálogo y cotizaciones |

### Cómo asignar roles
1. Ingresar al panel admin como administrador
2. Ir a **Usuarios**
3. En el selector de rol junto al usuario, elegir el rol deseado
4. El cambio es inmediato — el usuario deberá cerrar y reabrir sesión

### Restricción importante
- Solo el `admin` puede cambiar roles
- Nadie puede cambiar su propio rol a `admin`
- El rol `cooperador` está protegido en Firestore: no puede modificar configuraciones aunque manipule el código del navegador

---

## 3. Autenticación y acceso al panel admin

### Métodos disponibles
- **Email + contraseña** (Firebase Auth)
- **Google Sign-In** (OAuth 2.0 — recomendado por seguridad)

### Flujo de verificación al iniciar sesión
```
1. Firebase Auth verifica email+contraseña
2. Se lee users/{uid} en Firestore
3. Verifica role === 'admin' o 'cooperador'
4. Verifica estado !== 'bloqueado'
5. Verifica device ID en config/adminDispositivos
6. Si todo pasa → mostrarApp()
```

Si **cualquier paso falla**, la sesión se cierra y se registra en `auditLog`.

### Timeout de inactividad
El panel admin cierra sesión automáticamente tras **4 horas de inactividad**.  
Cualquier clic, tecla o scroll reinicia el contador.

---

## 4. Device Binding — Dispositivos autorizados

### Qué es
Cada navegador/equipo genera un **ID único** (almacenado en `localStorage` como `ov_device_id`).  
Solo los dispositivos cuyo ID está en `config/adminDispositivos.lista` (Firestore) pueden acceder al panel admin.

### Cómo funciona
- **Primera vez:** Al entrar por primera vez, el dispositivo se registra automáticamente y queda autorizado.
- **Dispositivo nuevo:** Muestra su ID en la pantalla de login → se copia → se agrega desde el panel en un dispositivo ya autorizado.
- **Dispositivo no autorizado:** Se cierra sesión automáticamente y se registra el intento en `auditLog`.

### Dónde gestionar dispositivos
Panel Admin → **URL / Conexión** → **Dispositivos autorizados para admin**

Desde ahí puedes:
- Ver todos los dispositivos autorizados
- Agregar este equipo (botón)
- Agregar otro equipo por ID (campo de texto)
- Quitar un dispositivo de la lista

### Qué protege
Si alguien roba tu contraseña de Firebase pero no tiene acceso a un equipo autorizado, **no puede entrar al panel admin**.

### Limitación conocida
El `device_id` vive en `localStorage`. Si el atacante tiene acceso físico al mismo equipo y navegador donde el admin ya está registrado, podría copiar ese ID. Por eso la protección principal sigue siendo no compartir credenciales.

---

## 5. Rate Limiting — Protección contra ataques de fuerza bruta

### Reglas — aplicadas en los 3 paneles (V33.5)
- **5 intentos fallidos consecutivos** → bloqueo de **10 minutos** en ese navegador
- Un inicio de sesión exitoso resetea el contador

| Panel | Función check | Keys localStorage |
|-------|--------------|-------------------|
| Admin | `_adminCheckBloqueo()` | `_adm_bl`, `_adm_at` |
| Cliente | `_cliCheckBloqueo()` | `_cli_bl`, `_cli_int` |
| Vendedor | `_vendCheckBloqueo()` | `_vend_bl`, `_vend_int` |

### Nota
Este rate limiting es **del lado del cliente** (navegador). Firebase Auth tiene su propio rate limiting adicional del lado del servidor, que bloquea IPs con muchos intentos fallidos (`auth/too-many-requests`).
El admin además registra cada fallo en Firestore `auditLog`.

---

## 6. Rol Cooperador — Acceso restringido

### Propósito
Dar acceso operacional al panel admin (ver ventas, análisis, inventario, usuarios) sin permitir ningún tipo de configuración o modificación.

### Lo que VE el cooperador (acceso completo de lectura)
- Dashboard y estadísticas
- Ventas y análisis de ventas
- Análisis de inventario (baja rotación, quiebre, sobrestock)
- Lista de usuarios (solo lectura)
- Cotizaciones
- Sesiones activas
- Catálogo de precios

### Lo que NO VE el cooperador (bloques ocultos)
- URLs de conexión del sistema
- Instrucciones de actualización del catálogo (pipeline, scripts, bat)
- Instrucciones de cómo ejecutar procesos internos
- Mapeo de vendedores (VEN_CONFIG — revela claves internas)
- Sección de dispositivos autorizados y gestión de seguridad

### Lo que NO PUEDE HACER el cooperador (botones bloqueados)
Cualquier botón que realice escritura está interceptado:
- Guardar configuraciones
- Aprobar/rechazar usuarios
- Bloquear/activar usuarios
- Cambiar roles
- Eliminar datos
- Publicar promociones o banners
- Modificar redes sociales
- Exportar datos sensibles (costo, precio socio)
- Agregar dispositivos autorizados

Al intentar cualquier acción bloqueada:
1. La acción **no se ejecuta**
2. Aparece un **modal rojo de aviso** con el mensaje:
   > *"Tu intento de [acción] fue bloqueado. Este evento quedó registrado con tu usuario, dispositivo y hora exacta."*
3. El intento queda guardado en `auditLog` tipo `cooperador_intento_bloqueado`

### Badge de identificación
El cooperador ve un badge **🔒 Modo Cooperador** en color ámbar en el encabezado del panel, siempre visible.

### Detección de DevTools
Si el cooperador abre las herramientas de desarrollador del navegador:
- Se detecta automáticamente (monitoreo cada 2 segundos por diferencia de tamaño de ventana)
- El intento queda registrado en `auditLog` tipo `cooperador_devtools`
- Aparece el modal de aviso de seguridad

**Nota:** La detección de DevTools funciona principalmente en Chrome/Edge. En Firefox es menos confiable.

### Protección en servidor (Firestore Rules)
Aunque el cooperador manipule el JavaScript del navegador para intentar ejecutar funciones restringidas, **Firestore rechaza en el servidor** cualquier escritura a:
- `config/*` — configuraciones del sistema
- `users/*` rol/estado/registroAprobado — campos sensibles de usuarios
- `promos/*` — promociones
- `productos/*` — catálogo
- `comandos/*` — comandos del sistema
- `cotizaciones (delete)` — no puede eliminar cotizaciones

---

## 7. Audit Log — Registro de acciones

Todas las acciones relevantes quedan en la colección `auditLog` de Firestore.

### Tipos de eventos registrados

| Tipo | Cuándo se registra |
|------|--------------------|
| `login_admin_fallido` | Intento de login que falla (credenciales incorrectas, rol sin acceso) |
| `admin_dispositivo_registrado_auto` | Primer dispositivo registrado automáticamente |
| `admin_dispositivo_no_autorizado` | Intento de login desde dispositivo no en lista |
| `cooperador_accion` | Acción normal del cooperador (navegación, consultas) |
| `cooperador_intento_bloqueado` | Clic en botón restringido para cooperador |
| `cooperador_devtools` | Apertura de herramientas de desarrollador detectada |

### Campos de cada registro
```json
{
  "tipo": "cooperador_intento_bloqueado",
  "uid": "uid del usuario",
  "nombre": "Nombre completo",
  "accion": "descripción de la acción intentada",
  "deviceId": "ID del dispositivo",
  "ua": "User-Agent del navegador (primeros 120 chars)",
  "url": "ruta de la página",
  "ts": "timestamp servidor Firebase"
}
```

### Cómo ver el audit log
El audit log está en Firestore → colección `auditLog`.  
Solo el admin puede leerlo (Firestore Rules lo bloquea para otros roles).  
Acceder vía: [Firebase Console](https://console.firebase.google.com/project/ferreteria-oviedo/firestore)

---

## 8. Reglas de Firestore — Seguridad en servidor

Archivo: `firestore.rules`

### Resumen de permisos por colección

| Colección | Admin | Cooperador | Vendedor | Cliente | Sin auth |
|-----------|-------|-----------|---------|---------|----------|
| `users` (read) | ✅ | ✅ lista | propio | propio | ❌ |
| `users` (write) | ✅ | ❌ | propio\* | propio\* | ❌ |
| `config` (read) | ✅ | ✅ | ✅ | ✅ | solo sessionConfig/registroControl |
| `config` (write) | ✅ | ❌ | ❌ | ❌ | ❌ |
| `cotizaciones` | ✅ | read | read+write | read+write | ❌ |
| `ventas` | ✅ | ✅ read | ✅ read | ✅ read | ❌ |
| `ventasLineas` | ✅ | ✅ read | ❌ | ❌ | ❌ |
| `sesionesLog` | ✅ | ✅ read | ❌ | ❌ | ❌ |
| `auditLog` (read) | ✅ | ❌ | ❌ | ❌ | ❌ |
| `auditLog` (write) | ✅ | ✅ | ✅ | ✅ | ❌ |
| `promos` (read) | ✅ | ✅ | ✅ | ✅ | ✅ público |
| `promos` (write) | ✅ | ❌ | ❌ | ❌ | ❌ |
| `sesiones_activas` | ✅ | ✅ read | ✅ read | ✅ read | ❌ |
| `comandos` | ✅ | ❌ | ❌ | ❌ | ❌ |

\* Solo campos no sensibles (no puede cambiar role/estado/registroAprobado)

### Función esAdmin() (servidor)
```javascript
function esAdmin() {
  return request.auth != null &&
         exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
}
```
Esta función **siempre consulta Firestore en el servidor**. No depende del código JavaScript del cliente. Es infalsificable.

---

## 9. Seguridad del catálogo y datos públicos

### Qué es público (por diseño)
- `Datos.json` — catálogo de productos con precios IVA (sin costo, sin precio socio en la URL pública)
- `Datos.csv` — mismos datos en formato CSV
- `ventas-manzano.json` — datos de ventas agregados por periodo
- `promos/*` — promociones en Firestore (lectura pública)

### Qué no es público
- Costo promedio (solo visible en panel admin/vendedor después de autenticación)
- Precio socio (configurable por admin si se muestra o no)
- Datos de usuarios (Firestore, requiere auth)
- Logs de auditoría (solo admin)

### Firebase API Key
La API Key de Firebase en `firebase-config.js` es **pública por diseño** (es un identificador de proyecto, no una clave secreta). La seguridad real está en las **Firestore Rules** del servidor, no en ocultar la API key.

---

## 10. Headers HTTP de seguridad

Configurados en `firebase.json` para todas las páginas:

| Header | Valor | Qué protege |
|--------|-------|-------------|
| `X-Content-Type-Options` | `nosniff` | Evita MIME type sniffing |
| `X-Frame-Options` | `SAMEORIGIN` | Evita clickjacking en iframes |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controla información de referencia |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Bloquea acceso a hardware |
| `X-XSS-Protection` | `1; mode=block` | Protección adicional XSS |
| `Cache-Control: no-cache` | Solo en HTML y firebase-config.js | Siempre sirve versión actualizada |

---

## 11. Qué NO protege este sistema

Ser transparente sobre las limitaciones es parte de la seguridad:

- **Capturas de pantalla:** No hay forma de impedirlas en un navegador web.
- **Ver código fuente HTML/JS:** Cualquiera puede hacer Ctrl+U. El código JS es visible. La seguridad real está en Firestore Rules (servidor), no en ocultar el código.
- **DevTools en Firefox:** La detección funciona principalmente en Chrome/Edge. En Firefox puede no activarse.
- **Rate limiting local:** El límite de 5 intentos está en `localStorage`. Alguien puede abrir una ventana de incógnito para tener nuevos intentos. Firebase Auth tiene su propio rate limiting adicional que sí es del lado del servidor.
- **Acceso físico al equipo admin:** Si alguien tiene acceso al computador donde ya está la sesión iniciada, puede operar el panel. Usar bloqueo de pantalla del sistema operativo.

---

## 12. Procedimientos de emergencia

### Si sospechas que alguien accedió sin autorización

1. **Ir a Firebase Console** → Firestore → colección `auditLog` → buscar registros recientes
2. **Ir a Firebase Console** → Authentication → buscar el UID sospechoso
3. **En el panel admin** → Usuarios → Bloquear al usuario sospechoso
4. **Cambiar contraseña** del admin en Firebase Console → Authentication → editar usuario
5. **Limpiar lista de dispositivos** en `config/adminDispositivos` y re-registrar solo tus equipos

### Si un cooperador actuó de forma sospechosa

1. Revisar `auditLog` filtrando por `uid` del cooperador y tipos `cooperador_intento_bloqueado` y `cooperador_devtools`
2. En el panel admin → Usuarios → cambiar su rol a `cliente` o bloquearlo
3. El cambio de rol es inmediato — al recargar el panel, el cooperador verá "Sin acceso de administrador"

### Si se comprometieron las credenciales de Firebase

1. Ir a [Firebase Console](https://console.firebase.google.com/project/ferreteria-oviedo) → Configuración del proyecto
2. **Rotar API Key:** Crear nueva, actualizar `firebase-config.js`, publicar con `firebase deploy`
3. Ir a Authentication → bloquear el usuario afectado
4. Revisar Firestore Rules para asegurarse de que no se modificaron

---

## 13. Historial de cambios de seguridad

| Fecha | Versión | Cambio |
|-------|---------|--------|
| 2026-05-14 | V34.1 | **Stock fix:** panel cliente y vendedor ahora suman `pem+sem+iem+tem+rce+cd` para mostrar stock real |
| 2026-05-14 | V34.1 | **Texto GitHub eliminado:** panel vendedor ya no dice "desde GitHub" |
| 2026-05-14 | V34.1 | **URL doble fallback:** `_vadmCargarStockMap` intenta CDN Firebase, luego ruta relativa |
| 2026-05-14 | V34.2 | **Device Binding:** admin solo puede acceder desde dispositivos en lista `config/adminDispositivos` |
| 2026-05-14 | V34.2 | **Rate Limiting:** 5 intentos fallidos → bloqueo 10 min + registro en auditLog |
| 2026-05-14 | V34.2 | **Audit Log de fallos:** cada login fallido queda en Firestore auditLog |
| 2026-05-14 | V34.2 | **ID de dispositivo visible:** pantalla de login admin muestra el device ID para facilitar agregar nuevos equipos |
| 2026-05-14 | V34.2 | **Gestión de dispositivos:** panel admin → URL/Conexión permite agregar/quitar dispositivos autorizados |
| 2026-05-14 | V34.3 | **Rol Cooperador:** nuevo rol con acceso operacional al panel admin, sin configuración |
| 2026-05-14 | V34.3 | **Firestore Rules actualizadas:** `esCooperador()` con permisos explícitos de solo lectura operacional |
| 2026-05-14 | V34.3 | **Interceptor global de clics:** cooperador bloqueado en todas las acciones de escritura |
| 2026-05-14 | V34.3 | **Detección de DevTools:** cooperador registrado si abre inspector del navegador |
| 2026-05-14 | V34.3 | **Modal de aviso de seguridad:** cooperador ve aviso rojo con registro al intentar acción prohibida |
| 2026-05-14 | V34.3 | **Selector de rol en Usuarios:** admin puede asignar `cliente/vendedor/cooperador/admin` desde la tabla |
| 2026-05-14 | V34.3 | **data-coop-hide:** URLs de conexión, pipeline de actualización e instrucciones internas ocultas para cooperador |
| 2026-05-14 | V34.3 | **Headers HTTP:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-XSS-Protection` |
| 2026-05-15 | V33.4 | **XSS fix:** `venAdmEsc()` aplicado en notificaciones, auditLog y renderNotifItem — innerHTML sanitizado en los 3 paneles |
| 2026-05-15 | V33.4 | **Fix cooperador:** `registrarPresencia()` llamado en `_activarSesionAdmin()` — ahora dispara notificación de ingreso al admin y queda en auditLog |
| 2026-05-15 | V33.4 | **Fix quota badge:** `quotaTrackRead()` llamado en sesiones_activas, cotizaciones, users (onSnapshot) y auditLog (get) — badge refleja lecturas reales |
| 2026-05-15 | V33.4 | **Limpieza legacy:** código V16-V24 eliminado de los 3 paneles. `toggleLegacyMode*()` y login heredado removidos |
| 2026-05-17 | V33.5 | **Rate limiting vendedor:** `_vendCheckBloqueo/Registrar/Resetar` agregado a `index.html` — los 3 paneles tienen protección de login |
| 2026-05-17 | V33.5 | **Logos restaurados:** `logo_oviedo.jpg` recuperado desde `PANEL ADMIN COMPRAS`. `FONDO3.jpeg→.jpg` corregido en 3 paneles |
| 2026-05-17 | V33.5 | **Fix Por Hora:** `vadmParseHora` acepta formato 24h ERP (`08:30:00`). Tab Por Hora operativo |
| 2026-05-17 | V33.5 | **TORNILLO.JPG eliminado:** referencia a imagen inexistente removida de `panel-cliente.html` |

---

| 2026-05-18 | V33.6 | **CRÍTICO — Exposición de archivos sensibles en Firebase Hosting:** `firebase deploy` publicaba `VENTAS EL MANZANO/credenciales_erp.ini`, `backups/firebase_auth_users.json`, `backups/usuarios_backup_V30.json`, `users_export.json`, `.claude/**` (transcripts de sesión). Causa: `"**/.*"` en ignore no bloqueaba directorios, y `VENTAS EL MANZANO/` no tenía exclusión. **Fix:** `firebase.json` ignore expandido con `VENTAS EL MANZANO/**`, `backups/**`, `FLUJOS .MD/**`, `SERVIDOR2_DATOS_AYER/**`, `SOLO EJEMPLO/**`, `users_export.json`, `**/*.ini`, `**/*.xlsm`, `**/*.xlsb`, `**/*.mp4`. `.firebaseignore` creado con mismos patrones + `.claude/`. **Verificado:** los 3 archivos críticos devuelven 404 en producción. **Acción adicional:** credenciales ERP cambiadas por el usuario tras detección. |
| 2026-05-18 | V33.6 | **Seguridad del catálogo:** `_vadmCargarStockMap` intenta `catalogo-dinamico.json` primero (~350KB, solo stock/precio) antes que `Datos.json` (~3.5MB). Reduce superficie de datos expuestos en CDN. |

---

*Manual actualizado 2026-05-18 · V33.6. Mantener actualizado con cada cambio de seguridad.*
