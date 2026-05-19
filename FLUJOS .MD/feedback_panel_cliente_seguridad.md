---
name: Seguridad panel-cliente.html — 5 parches aplicados
description: Parches de seguridad y fix WA aplicados en panel-cliente.html: precio default false, WA siempre visible, sanitización inputs, rate limiting login, slice carrito Firestore
type: feedback
originSessionId: da151d24-bed9-466f-bdbe-ed49903985ab
---
## Parches aplicados en panel-cliente.html

### T1 — `_cargarConfigPrecios` default seguro
`window._mostrarPrecio = false` se asigna al INICIO de la función, antes de cualquier llamada async.
Si Firestore falla o no existe el campo, se llama `renderProductos()` de todas formas con `false`.
El `.then` usa `d.mostrarPrecioCliente === true` (comparación estricta).

**Why:** Si el `.catch` estaba vacío, un error de Firestore dejaba `_mostrarPrecio` sin valor definitivo. Estado ambiguo puede mostrar precios sin autorización.

### T2 — Botón WhatsApp siempre visible post-PDF
`btnWaCot` se muestra con `display='block'` SIEMPRE al generar PDF, fuera del bloque `if(_mostrarPrecio)`.
El bloque de cupones (`cuponMostrarBloque`) sigue condicionado a `_mostrarPrecio === true`.

**Why:** El botón WA nunca aparecía porque `_mostrarPrecio` es `false` por defecto (estado más común).

### T3 — Sanitización inputs cotización
Helper `_sanitizarCotizInput(s)` añadido antes de `_cargarConfigPrecios`:
- Elimina `< > " ' \` \\`
- Trim + substring 200 chars
Aplicado en `_ultimaDatosCliente` (nombre, rut, dir, tel, obs).
Los valores locales para el PDF (variables `nombre`, `rut`, etc. en `generarPDF`) NO se tocan — solo el objeto guardado en Firestore.

### T4 — Rate limiting login cliente
Variables globales: `_CLI_MAX_INTENTOS=5`, `_CLI_BLOQUEO_MS=10min`.
Funciones: `_cliCheckBloqueo()`, `_cliRegistrarIntentoFallido()`, `_cliResetarIntentos()`.
- Antes de `signInWithEmailAndPassword`: check bloqueo (retorna si activo, restaura btn).
- En `.then` exitoso: `_cliResetarIntentos()` antes de `mostrarAppCli`.
- En `.catch`, después de guardar los guards bloqueado/pendiente: `_cliRegistrarIntentoFallido()`.
Usa localStorage keys `_cli_bl` (timestamp bloqueo) y `_cli_int` (contador JSON `{n,t}`).

### T5 — Slice carrito Firestore
`registrarCotizacionResumen`: `carrito.map(...)` → `carrito.slice(0,100).map(...)`.
Previene documentos enormes en Firestore con carritos de 500+ items.

---

**How to apply:** Si en el futuro se modifica el flujo de login de clientes, mantener los 3 puntos de integración del rate limiting (check antes, reset en éxito, registro en fallo). No mezclar con el rate limiting del admin (`_adminCheckBloqueo`).
