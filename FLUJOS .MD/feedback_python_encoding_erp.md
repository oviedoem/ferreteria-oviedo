---
name: Fix encoding Windows cp1252 + URLs ERP actualizadas + headless Playwright
description: UnicodeEncodeError cp1252, headless=True para ocultar credenciales, URLs/tokens ERP vigentes, IDs bodega corregidos
type: feedback
originSessionId: 0ea1fffb-bb78-4ee6-a77b-f589ce8dd2d5
---
## Problema: UnicodeEncodeError en consola Windows

Python 3.14 en Windows usa cp1252 por defecto en consola. Cualquier `print()` con caracteres fuera de cp1252 rompe con:
`UnicodeEncodeError: 'charmap' codec can't encode character`

**Caracteres prohibidos en `log()`/`print()` de scripts .py:**
`→ ⟕ ✅ ⚠ — – × ó ú é á í ñ ü` y cualquier emoji.

**Why:** Los .bat llaman a los .py sin redirigir stdout a UTF-8, la consola usa cp1252.

**How to apply:** En TODOS los scripts Python del proyecto, reemplazar en mensajes de log:
- `→` → `->`
- `—` / `–` → `-`
- `⚠` → `AVISO:`
- `✅` → `[OK]`
- Acentos en strings de log → sin acento (solo en print/log, no en datos)

No afecta datos escritos a archivos (JSON/Excel se abren con encoding explícito `utf-8`).

---

## URLs ERP Justime vigentes (actualizadas 2026-05-15)

**xToken bodegas/ventas El Manzano:** `9ca90ab1-d350-f111-8b81-00155d9d0600`

| Endpoint | URL base | Uso |
|----------|----------|-----|
| Bodegas (detalle) | `http://200.6.113.97/Justweb_Foviedo/Reporte_Bodegas_Detalle.asp?xToken=9ca90ab1...&IdBodega={id}&...` | `descargar_bodegas.py` — GET directo sin login |
| Bodegas (form) | `http://200.6.113.97/Justweb_Foviedo/Reporte_Bodegas.asp?xToken=9ca90ab1...` | Solo formulario interactivo (pm.js), no usar con requests HTTP |
| VisorRS (precios) | `http://200.6.113.97/Justweb_Foviedo/VisorRS.aspx?xToken=9ca90ab1-d350-f111-8b81-00155d9d0600&xInforme=RS_Documentos/listaprecio&xTituloInforme=Lista%20Precio` | `descargar_erp.py` catálogo |
| Ventas por vendedor | `http://200.6.113.97/Justweb_Foviedo/Reporte_VentasPorVendedor.asp?xToken=b91f9f93-985d-4231-a849-d2e06aa737df&xVendedor=agonzalez&xNombre=agonzalez` | `descargar_ventas_erp.py` (Playwright) |

**IDs bodega El Manzano corregidos:**
| Bodega | IdBodega correcto | Error previo |
|--------|-------------------|--------------|
| Patio El Manzano | 22 | — |
| Sala El Manzano | 13 | — |
| Calzada El Manzano | **24** | era 23 (=Centro Distribución) |
| Mermas El Manzano | **29** | era 24 (=Calzada) |
| Ingreso El Manzano | 72 | doc decía 20 |
| Tránsito El Manzano | 46 | — |
| Recepción El Manzano | 55 | — |

**How to apply:** Antes de correr descargar_bodegas.py o descargar_erp.py, verificar que los xToken en credenciales_erp.ini coincidan con los de esta tabla. Si el ERP rechaza, el token expiró — pedir URL nueva al usuario.

---

## Playwright headless=True — ocultar credenciales ERP

`descargar_ventas_erp.py` usaba `headless=False` → Edge se abría en pantalla mostrando usuario y clave al hacer login en el ERP.

**Corregido a `headless=True`** (línea 134 de descargar_ventas_erp.py):
```python
browser = await p.chromium.launch(channel="msedge", headless=True)
```

**Why:** El personal ve la pantalla durante la actualización. Las credenciales ERP son sensibles.
**How to apply:** Siempre `headless=True` en producción. Solo cambiar a `False` para depurar un error puntual y revertir inmediatamente.

---

## Reporte_Bodegas.asp vs Reporte_Bodegas_Detalle.asp

| Endpoint | Método | Requiere | Resultado |
|----------|--------|----------|-----------|
| `Reporte_Bodegas.asp?xToken=...` | GET/POST | pm.js (JavaScript) | Solo muestra formulario — **no sirve con requests HTTP** |
| `Reporte_Bodegas_Detalle.asp?xToken=...&IdBodega=N&...` | GET | xToken en URL | Devuelve HTML con tabla de datos directo — **usar este** |

`descargar_bodegas.py` eliminó el login de sesión y usa GET directo a `Reporte_Bodegas_Detalle.asp` con xToken. Funciona sin navegador ni cookies.
