---
name: Distinción crítica paneles cliente vs vendedor
description: Reglas claras de qué archivo es cada panel y qué funciones corresponden a cada uno, para no confundirlos al editar
type: feedback
originSessionId: d810e60e-8403-4465-899b-b3da5aec4a4a
---
**Regla:** Antes de editar cualquier función de UI, verificar SIEMPRE en qué archivo está el panel correcto.

| Archivo | Panel | Usuarios | URL |
|---------|-------|----------|-----|
| `index.html` | **Vendedor** | Personal de la ferretería (vendedores, admin) | `/` o `/vendedor` |
| `panel-cliente.html` | **Cliente** | Compradores externos (público) | `/panel-cliente` |
| `panel-admin.html` | **Admin** | Administradores y cooperadores | `/panel-admin` |

**Por qué:** El usuario reportó confusión recurrente al mejorar funciones de menú — se editaba el archivo equivocado.

**How to apply:**
- WhatsApp de cotización → SOLO en `panel-cliente.html` (el cliente cotiza y confirma por WA con la empresa)
- Precio costo / margen → SOLO en `index.html` (solo el vendedor necesita ver el costo)
- Auditoría, roles, estadísticas → SOLO en `panel-admin.html`
- Si una función existe en ambos paneles con lógica diferente (ej. guardarCotizacion), es CORRECTO — son autocontenidos
- Variables globales: vendedor usa `CART`, cliente usa `carrito` — son archivos separados, no comparten estado

**Señales de confusión:**
- Si modificas una función y el cambio no aparece en el panel esperado → revisaste el archivo equivocado
- Si ves `CART` (mayúsculas) → estás en `index.html` (vendedor)
- Si ves `carrito` (minúsculas) → estás en `panel-cliente.html` (cliente)
