# Plan Seguridad Catálogo — Split JSON + Firestore 1 doc
# Proyecto: ferreteria-oviedo · Versión base: V37.27
# Protocolo: Safe-Change — 1 prompt = 1 archivo/función
# Verificado contra código real 2026-06-22 · Corregido 2026-06-23 (OCR_REVIEW.bat)
---
## INSTRUCCIONES PARA CLAUDE CODE ANTES DE EMPEZAR
1. Leer en orden: MEMORY.md → AGENTS.md → CLAUDE.md
2. Activar skill `/ahorro-tokens` al inicio de la sesión
3. Activar skill `/revisar-codigo` antes de cada deploy (modo $0, costo cero)
4. Safe-Change Protocol activo: 1 prompt = 1 función/archivo. Si el fix requiere 2 archivos → dos prompts separados
5. No combinar pasos. Esperar confirmación explícita antes de avanzar al siguiente prompt
---
## ESTADO VERIFICADO (auditoría 2026-06-22)
| Componente | Estado real |
|---|---|
| `icons/` en repo | ✅ ya existe con los 6 PNG |
| `csv_a_json.py` | ✅ en disco — `CATALOGO PRODUCTOS/scripts/csv_a_json.py` (gitignored por carpeta) |
| Variable lista productos en csv_a_json.py | `registros` (NO `productos`) |
| Claves JSON en csv_a_json.py | todas en minúsculas: `codigo`, `descripcion`, `marca`, `familia`, `subfamilia`, `precioiva`, `pem`, `sem`, `cem`, `mem` |
| Tipos pem/sem/cem/mem | ✅ `int` garantizado (`.astype(int)` + `.fillna(0)` en csv_a_json.py L16) |
| `firebase_admin` en csv_a_json.py | ❌ NO importado — agregar import + init desde cero |
| Credencial Admin SDK | ✅ `E:\config\ferreteria-oviedo-b143e8e7b77d.json` (confirmado en `_utilidades\rotar_token_data.py` L36) |
| `firestore.rules` bloque `precios` | ❌ no existe aún |
| Catch-all firestore.rules | ✅ línea 123, última regla del archivo — insertar `precios` antes es válido |
| `cargarPreciosFirestore()` en panel-cliente.html | ❌ no existe aún |
| `JSON_URL_PUB_DEFAULT` | L1025 → `Datos.json` → cambiar a `Datos-publico.json` |
| `window._mostrarPrecio = false` | ✅ L1055 — NO tocar jamás |
| Flujo post-login real | `mostrarAppCli()` → `_cargarConfigPrecios()` → `renderProductos()` |
| `_cargarConfigPrecios()` L2297 | Lee `config/precios` Firestore, setea `_mostrarPrecio`, llama `renderProductos()` en .then() y .catch() |
| `iniciarApp()` | fetch JSON → `PRODUCTOS = parsed` → `initUI()` → `renderProductos()` |
| OCR_REVIEW.bat | ✅ NO obsoleto — AGENTS.md lo exige como capa adicional cuando se toca `firestore.rules` o `panel-cliente.html` (este caso) |
| Skills activos .claude | `/ahorro-tokens`, `/revisar-codigo` (ambos confirmados en `.claude/commands/`) |
| Versión activa | V37.27 · 21-06-2026 |
---
## QUÉ CAMBIA EN SIMPLE
- **Panel Admin** → nada, cero cambios
- **Panel Vendedor (index.html)** → nada, cero cambios
- **Panel Cliente sin cuenta** → ve catálogo con stock PEM+SEM pero **sin precios**
- **Panel Cliente con cuenta** → exactamente igual que hoy (login → precios desde Firestore en 1 lectura)
- **Pipeline ACTUALIZAR_TODO.bat** → genera `Datos-publico.json` adicional + sube precios a Firestore `precios/catalogo`
---
## PROMPT 0 — Auditoría local previa (SOLO LECTURA)
```
Activa skill /ahorro-tokens.
Lee MEMORY.md → AGENTS.md → CLAUDE.md en ese orden.
Confirma Safe-Change Protocol activo y versión V37.27.
SOLO LECTURA — cero cambios:
1. Abre CATALOGO PRODUCTOS/scripts/csv_a_json.py
   - Confirma nombre exacto de la variable que contiene la lista de productos
     (esperamos "registros")
   - Confirma que todas las claves del dict son minúsculas:
     codigo, descripcion, marca, familia, subfamilia, precioiva, pem, sem, cem, mem
   - Confirma que NO importa firebase_admin
   - Muestra las últimas 10 líneas del script
2. Confirma que icons/ existe en el repo con los 6 PNG
3. Confirma que JSON_URL_PUB_DEFAULT en panel-cliente.html L1025
   apunta a Datos.json (no a Datos-publico.json)
4. Confirma que _cargarConfigPrecios() en L2297 llama renderProductos()
   en su .then() Y en su .catch()
5. Confirma que window._mostrarPrecio = false está en L1055
Responde con diagnóstico ✅/❌ por cada punto. Cero cambios.
```
---
## PROMPT 1 — csv_a_json.py: split JSON + 1 documento Firestore
```
TOCO:        csv_a_json.py — agregar bloques al INICIO y al FINAL del script
ARCHIVO:     CATALOGO PRODUCTOS/scripts/csv_a_json.py
RAZÓN:       (A) generar Datos-publico.json con stock pem+sem pero sin precios
             (B) subir todos los precios a 1 solo documento Firestore → 1 lectura/sesión
LLAMADA POR: ACTUALIZAR_TODO.bat (sin cambios en el bat)
LLAMA A:     firebase_admin.firestore (importar desde cero)
NO TOCO:     lógica existente del script, Datos.json, ningún otro archivo
── PARTE 0: imports y init Admin SDK ──
Agregar al INICIO del archivo, después de los imports existentes:
import firebase_admin
from firebase_admin import credentials, firestore as fs_admin
# Solo inicializar si no está ya inicializado (evita error en ejecuciones múltiples)
if not firebase_admin._apps:
    # Ruta absoluta confirmada — credencial vive fuera del árbol del script
    _cred_path = r'E:\config\ferreteria-oviedo-b143e8e7b77d.json'
    firebase_admin.initialize_app(credentials.Certificate(_cred_path))
_db_admin = fs_admin.client()
── PARTE A: Datos-publico.json ──
Agregar al FINAL del script, después de la línea que escribe Datos.json:
# Split seguro: catálogo público con stock pem+sem — sin precios
# Claves en minúsculas — confirmado en csv_a_json.py diccionario de mapeo
CAMPOS_PUBLICOS = ['codigo', 'descripcion', 'marca', 'familia', 'subfamilia', 'pem', 'sem']
publicos = []
for r in registros:
    pub = {k: r.get(k, '') for k in CAMPOS_PUBLICOS}
    publicos.append(pub)
ruta_publico = ruta_salida.replace('Datos.json', 'Datos-publico.json')
with open(ruta_publico, 'w', encoding='utf-8') as f:
    json.dump(publicos, f, ensure_ascii=False)
print(f'[csv_a_json] Datos-publico.json → {len(publicos)} productos (con pem+sem, sin precios)')
── PARTE B: 1 documento Firestore con todos los precios ──
# 1 escritura Firestore — todos los precios en 1 documento (límite 1MB, ~150KB real)
mapa_precios = {}
for r in registros:
    cod = str(r.get('codigo', '')).strip()  # minúsculas — confirmado
    if not cod:
        continue
    precio = int(r.get('precioiva', 0) or 0)
    stock  = (int(r.get('pem', 0) or 0) +
              int(r.get('sem', 0) or 0) +
              int(r.get('cem', 0) or 0) +
              int(r.get('mem', 0) or 0))
    mapa_precios[cod] = {'p': precio, 's': stock}
_db_admin.collection('precios').document('catalogo').set({'productos': mapa_precios})
print(f'[csv_a_json] precios/catalogo → {len(mapa_precios)} productos en Firestore (1 doc)')
import sys
tam_kb = sys.getsizeof(str(mapa_precios)) / 1024
print(f'[csv_a_json] Tamaño estimado del doc: {tam_kb:.1f} KB (límite: 1024 KB)')
Muéstrame el diff exacto antes de aplicar. No toques nada más del script.
```
---
## PROMPT 2 — firestore.rules: bloque precios
```
TOCO:        firestore.rules — agregar 1 bloque nuevo
ARCHIVO:     firestore.rules
RAZÓN:       proteger colección precios/catalogo — solo usuarios autenticados
             NO anónimos pueden leer precios reales
LLAMADA POR: panel-cliente.html → cargarPreciosFirestore() post-login
LLAMA A:     nada (solo regla declarativa)
NO TOCO:     ninguna regla existente — insertar bloque nuevo solamente
Insertar ANTES de la regla catch-all final (match /{document=**}, línea 123):
    // ── PRECIOS (1 doc — split seguro V37.28) ─────────────────────────────
    // precios/catalogo: mapa {codigo: {p: precioIVA, s: stock}} para todos los productos.
    // Solo usuarios autenticados NO anónimos pueden leer.
    // Escritura: exclusiva del pipeline vía Admin SDK (bypassa estas reglas).
    match /precios/{docId} {
      allow read: if request.auth != null
                  && request.auth.token.firebase.sign_in_provider != 'anonymous';
      allow write: if false;
    }
Muéstrame el diff exacto. No toques ninguna regla existente.
Tras confirmar el diff, ejecutar: firebase deploy --only firestore:rules
```
---
## PROMPT 3 — panel-cliente.html: función cargarPreciosFirestore() nueva
```
TOCO:        panel-cliente.html — agregar 1 función nueva, nada más
ARCHIVO:     panel-cliente.html
RAZÓN:       1 get() Firestore post-login inyecta precios en PRODUCTOS
             → 1 lectura total por sesión, costo cero en free tier
LLAMADA POR: _cargarConfigPrecios() — se conecta en Prompt 4
LLAMA A:     window.db.collection('precios').doc('catalogo').get()
VARIABLES:   PRODUCTOS (array global, ya cargado por iniciarApp antes de este punto)
NO TOCO:     tryFetch, renderProductos, iniciarApp, initUI, doLoginAuth,
             _mostrarPrecio L1055, ninguna función existente
Insertar la función INMEDIATAMENTE ANTES de:
  function _cargarConfigPrecios(){   (L2297)
Función a insertar:
function cargarPreciosFirestore(productos) {
  // 1 sola lectura Firestore — todos los precios en 1 documento
  // Inyecta PrecioIVA y Stock en el array PRODUCTOS ya cargado por iniciarApp()
  if (!window.db) return Promise.resolve();
  return window.db.collection('precios').doc('catalogo').get()
    .then(function(snap) {
      if (!snap.exists) return;
      var mapa = snap.data().productos || {};
      for (var i = 0; i < productos.length; i++) {
        var entry = mapa[productos[i].Codigo];
        if (entry) {
          productos[i].PrecioIVA = entry.p || 0;
          productos[i].Stock     = entry.s || 0;
        }
      }
    })
    .catch(function() {
      // fail silencioso — app sigue funcionando sin precios
    });
}
Muéstrame la función completa y la línea exacta donde se inserta.
No toques nada más.
```
---
## PROMPT 4 — panel-cliente.html: enganchar cargarPreciosFirestore en _cargarConfigPrecios
```
TOCO:        panel-cliente.html — SOLO el interior del .then() de _cargarConfigPrecios() (L2297)
ARCHIVO:     panel-cliente.html
RAZÓN:       enriquecer PRODUCTOS con precios Firestore ANTES de renderProductos()
             pero SOLO cuando admin activó mostrarPrecioCliente=true
             Si está en false → cero lecturas Firestore (ahorro máximo)
LLAMADA POR: mostrarAppCli() L1508 — sin tocar mostrarAppCli
LLAMA A:     cargarPreciosFirestore() creada en Prompt 3
VARIABLES:   window._mostrarPrecio
NO TOCO:     mostrarAppCli, iniciarApp, initUI, el .catch() de _cargarConfigPrecios,
             ninguna otra función
Flujo actual del .then() de _cargarConfigPrecios():
  window._mostrarPrecio = (d.mostrarPrecioCliente === true);
  renderProductos();
Reemplazar SOLO ese bloque interior por:
      var d = doc.exists ? doc.data() : {};
      window._mostrarPrecio = (d.mostrarPrecioCliente === true);
      if (window._mostrarPrecio) {
        cargarPreciosFirestore(PRODUCTOS).then(function() {
          renderProductos();
        });
      } else {
        renderProductos();
      }
El .catch() NO se modifica — sigue con _mostrarPrecio=false + renderProductos() directo.
Muéstrame el diff de las líneas afectadas solamente.
```
---
## PROMPT 5 — panel-cliente.html: JSON_URL_PUB_DEFAULT → Datos-publico.json
```
TOCO:        panel-cliente.html — SOLO la variable JSON_URL_PUB_DEFAULT (L1025)
ARCHIVO:     panel-cliente.html
RAZÓN:       modo sin login carga Datos-publico.json (stock pem+sem, sin precios)
LLAMADA POR: iniciarApp() → tryFetch(JSON_URL_PUB)
LLAMA A:     Datos-publico.json generado por pipeline en Prompt 1
NO TOCO:     JSON_URL_DEFAULT (admin/vendedor siguen con Datos.json),
             JSON_URL_PUB de localStorage, ninguna otra variable ni función
Cambiar SOLO L1025:
  var JSON_URL_PUB_DEFAULT = 'https://ferreteria-oviedo.web.app/CATALOGO%20PRODUCTOS/Datos.json';
  →
  var JSON_URL_PUB_DEFAULT = 'https://ferreteria-oviedo.web.app/CATALOGO%20PRODUCTOS/Datos-publico.json';
Muéstrame diff de 1 sola línea antes de aplicar.
```
---
## PROMPT 6 — Badge + revisión seguridad (doble capa) + deploy
```
TOCO:        panel-admin.html, panel-cliente.html, index.html — SOLO badges versión
ARCHIVO:     los 3 paneles
RAZÓN:       regla BADGE OBLIGATORIA AGENTS.md — los 3 paneles misma versión y fecha
NO TOCO:     ninguna lógica
Actualizar badge en los 3 paneles:
  V37.27 · 21-06-2026  →  V37.28 · [fecha de hoy]
Este deploy modifica firestore.rules y panel-cliente.html. Según AGENTS.md (sección
"Cuándo usar OCR_REVIEW.bat"), ambos archivos requieren la capa adicional de OCR_REVIEW.bat
además de /revisar-codigo — no es opcional para este caso.
Ejecutar en orden ESTRICTO:
  1. /revisar-codigo — revisar cambios contra reglas FO-001 a FO-014 (costo cero)
     Confirmar que no hay violaciones antes de continuar
  2. E:\ferreteria-oviedo\OCR_REVIEW.bat — segunda capa obligatoria por tocar
     firestore.rules y panel-cliente.html (regla AGENTS.md)
     Confirmar que no hay violaciones antes de continuar
  3. Si ambas revisiones pasan: ACTUALIZAR_TODO.bat
     (genera Datos-publico.json + sube precios/catalogo a Firestore)
  4. firebase deploy --only hosting,firestore:rules
  5. ACTUALIZAR_GITHUB.bat → "v37.28 split json precios firestore"
Checklist AGENTS.md antes del deploy:
  [ ] window._mostrarPrecio = false sigue en L1055
  [ ] xlsm-enrich.json NO lo genera csv_a_json.py
  [ ] JSON_URL_DEFAULT (vendedor/admin) sigue apuntando a Datos.json
  [ ] Los 3 badges dicen V37.28 con la misma fecha
  [ ] Regla catch-all firestore.rules sigue siendo la última
  [ ] Bloque precios insertado ANTES del catch-all
```
---
## PROMPT 7 — Verificación final (SOLO LECTURA)
```
SOLO LECTURA. No modifiques nada.
Verificar con ✅/❌:
1.  Datos-publico.json existe, contiene pem y sem, y NO contiene precioiva, socioiva, cem, mem
2.  Firestore precios/catalogo existe con campo "productos" con al menos 10 entradas
3.  Cada entrada del mapa tiene claves "p" (precio int) y "s" (stock int)
4.  firestore.rules tiene bloque match /precios/{docId} ANTES del catch-all
5.  panel-cliente.html L1025 apunta a Datos-publico.json
6.  cargarPreciosFirestore() hace exactamente 1 get() sin loops ni batches
7.  _cargarConfigPrecios() llama cargarPreciosFirestore SOLO si _mostrarPrecio===true
8.  _cargarConfigPrecios() .catch() sin modificar (renderProductos directo)
9.  window._mostrarPrecio = false sigue en L1055 (default intacto)
10. Los 3 paneles muestran V37.28 con la misma fecha
11. doLoginAuth → onAuthStateChanged → mostrarAppCli intacto sin cambios de firma
12. JSON_URL_DEFAULT (admin/vendedor) sigue apuntando a Datos.json sin cambios
Dame lista ✅/❌ por cada punto.
```
---
## NOTAS ARQUITECTURA
- **csv_a_json.py** gitignored por carpeta — no en repo remoto, sí en disco
  Leer siempre desde `PROYECTO_E:\CATALOGO PRODUCTOS\scripts\csv_a_json.py`
- **Credencial Admin SDK** `E:\config\ferreteria-oviedo-b143e8e7b77d.json` — ruta confirmada,
  ya usada por `_utilidades\rotar_token_data.py` L36. No regenerar ni mover
- **Costo Firestore**:
  - 1 escritura/día (pipeline ACTUALIZAR_TODO.bat)
  - 1 lectura/sesión solo si admin activó `mostrarPrecioCliente=true`
  - Si `mostrarPrecioCliente=false` → 0 lecturas de la colección precios
  - Free tier: 50.000 lecturas/día → margen amplísimo
- **Panel Admin y Vendedor**: cero cambios, siguen leyendo Datos.json completo
- **Nunca tocar**: `credenciales_db.ini`, `credenciales_erp.ini`, `E:\git-sync\`,
  `ventas-manzano.json`, `_catalogo_generado_hoy()`, `venAdmParseFecha()`
- **Identificar disco** siempre por etiqueta de volumen `PROYECTO_E`, no por letra fija
- **Skills activos en esta sesión**: `/ahorro-tokens`, `/revisar-codigo`
- **OCR_REVIEW.bat**: NO es obsoleto. AGENTS.md lo exige como capa adicional (no sustituible
  por /revisar-codigo) cuando el cambio toca panel-admin.html, panel-cliente.html,
  firestore.rules o sw.js — exactamente el caso de este plan. Correr ambos en el Prompt 6.
