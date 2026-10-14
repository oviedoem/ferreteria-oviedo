# LEER PRIMERO — regla estricta para toda IA y persona que toque este proyecto

Aplica a Claude, ChatGPT/Codex, Kimi, Gemini y a cualquier persona. **Antes de modificar cualquier archivo, leer en este orden:**

1. Este archivo.
2. `../AGENTS.md` — reglas completas, Safe Change Protocol, flujo ERP y changelog de versiones.
3. `pipeline-datos-mapa.html` — mapa del **flujo vigente** (fuente → script → JSON → menú del panel) y los pasos de `ACTUALIZAR_TODO.bat`.
4. `../CLAUDE.md` — resumen operativo, checklist de cierre y última sesión.
5. `MAPA_FLUJO_PROYECTOS.md`, `IDS_REFERENCIA.md` y `README.md` — cómo se conectan los proyectos (bot de WhatsApp, fotos, etc.) y los IDs de referencia.

## Reglas estrictas

1. **Toda mejora parte del flujo actual** (mapa + `AGENTS.md`). Prohibido proponer o aplicar cambios basados en versiones antiguas, en el historial o en memoria.
2. **Safe Change Protocol:** antes de cambiar código declarar `TOCO / ARCHIVO / RAZÓN / NO TOCO`. Un prompt = una función tocada.
3. **El único deploy autorizado es `ACTUALIZAR_TODO.bat`** (lo corre el dueño o con su orden expresa) y el commit va por `ACTUALIZAR_GITHUB.bat`. Nunca `firebase deploy` manual ni editar `E:\git-sync\` a mano.
4. **No tocar** `firebase-config.js`, `credenciales_db.ini` ni `Datos.json` a mano. Tokens y credenciales siempre en `E:\config\`, nunca en git ni en documentos.
5. **`catalogo-bot.json` lo genera el PASO 5** (`generate_catalogo_bot.ps1`) y solo lo consume el bot de WhatsApp (descarga de Hosting al arrancar). No cambiar sus campos (`c d m f sf hf p pe se`) ni su formato sin coordinar con el bot (`oviedo-whatsapp-bot`, su `docs/00_LEER_PRIMERO.md`). Ningún panel lo lee.
6. **Los `.ps1` y `.bat` del pipeline se escriben solo en ASCII**: Windows PowerShell 5.1 lee los `.ps1` sin BOM como ANSI y un acento o un escape convertido en carácter real rompe el script. Probar siempre a un archivo temporal antes de dejarlo en el pipeline.
7. **Panel Bot WhatsApp / Costos IA:** no cambiar la forma de `/api/estado` ni `/api/contactos` del bot sin revisar ese menú en `panel-admin.html`.
8. **Respaldos, temporales y duplicados** van a `E:\_ARCHIVO_FERRETERIA\`, nunca dentro del proyecto.
9. **Si el cambio altera el flujo, actualizar en el mismo cambio** `pipeline-datos-mapa.html`, `AGENTS.md`, `CLAUDE.md` y `ESTADO_PROYECTO.md`. Una sesión sin changelog se considera incompleta (el 12-10 una sesión subió la versión sin dejarlo en `AGENTS.md`).
10. **Si la sesión no es de Claude** (ChatGPT/Codex u otra), registrar igual qué se hizo, qué quedó pendiente y el próximo paso en `AGENTS.md`, en `ESTADO_PROYECTO.md` y en `memory/estado-sesion-AAAA-MM-DD.md` (carpeta `memory/` del proyecto): esa IA no escribe en la memoria de Claude y sin ese registro el proyecto queda ciego.
11. **No publicar ni borrar sin confirmación del dueño.** Ante la duda, preguntar; no reescribir lo que ya funciona.
12. **Hosting publica TODO lo que `firebase.json` no ignore** (su `public` es la raíz del proyecto): cualquier archivo o carpeta nueva queda en internet en el próximo deploy. **Nunca quitar** `**/*.md`, `docs/**` ni `**/pipeline-datos-mapa.html` de `hosting.ignore`. Antes de crear archivos nuevos (guías, respaldos, exportaciones, datos de clientes), revisar esa lista; lo interno va en carpetas ya ignoradas (`_utilidades/`, `_HISTORICO/`, `backups/`, `logs/`) o se añade a `ignore` en el mismo cambio. Hasta el 13-10-2026 `AGENTS.md`, `CLAUDE.md`, `ESTADO_PROYECTO.md` y este mapa estuvieron públicos por ese defecto.
13. **Blindaje:** antes y después de cualquier sesión de otra IA correr `E:\python-portable\python.exe _utilidades\verificar_blindaje.py` (solo lectura). Avisa de archivos críticos modificados (`firebase.json`, generador del catálogo, `.bat` del pipeline, paneles, `validar_jsons.py`), de acentos rotos y de documentos expuestos en Hosting. `--guardar` actualiza la referencia: úsalo SOLO tras un cambio autorizado por el dueño y con el verificador sin fallas; nunca para "hacer pasar" una falla ni al empezar una sesión (la línea base de arranque se anota antes).

## Verificación antes de dar algo por terminado
- Un cambio de datos o scripts se prueba **sin publicar** y se compara contra lo publicado (cantidad de productos, códigos, precios y stock iguales).
- Tras un deploy: paneles (`index`, `panel-admin`, `panel-cliente`, `cotizador`) y `Datos.json` responden HTTP 200.
- Si se tocó el catálogo del bot: sin acentos rotos y búsquedas del bot correctas.
- Tras cada deploy: `AGENTS.md`, `CLAUDE.md`, `ESTADO_PROYECTO.md` y `docs/...` deben dar **HTTP 404** en `https://ferreteria-oviedo.web.app/` (lo comprueba `verificar_blindaje.py`).

Esta regla está en la primera línea de `CLAUDE.md` y `AGENTS.md`.
14. **Nada suelto en la raíz.** Todo archivo nuevo va en su carpeta por descripción y flujo: herramientas en `_utilidades/`, scripts de un módulo en la carpeta de ese módulo, documentación en `docs/`, estado de sesión en `memory/`, respaldos/deprecados/temporales en `E:\_ARCHIVO_FERRETERIA\`. Si ninguna encaja, crear una **carpeta nueva** con nombre descriptivo y un `README.md` de 3 líneas (si es interna, agregarla a `hosting.ignore`). `verificar_blindaje.py` avisa de entradas nuevas en la raíz. Al abrir una sesión en Claude usar `/inicio-sesion-proyectos`; en otras IA, seguir esta guía.

## Lo que Codex no alcanza a cargar de `AGENTS.md` (resumen vinculante)
`AGENTS.md` pesa 83 KB y Codex solo carga los primeros 32 KiB, así que **leerlo completo con lectura de archivo** (antirretroceso, archivos prohibidos, zonas intocables, pipeline y cierre están después de ese límite). Resumen:
- **Antirretroceso:** antes de modificar un `.py`, `.bat`, `.html` o `.json`, leer `MEMORY.md` y `AGENTS.md` completos y comprobar que el cambio no se aplicó ya en una versión anterior; si hay duda, detenerse y reportar.
- **Zonas intocables:** `firebase-config.js`; `window._mostrarPrecio` (default SIEMPRE `false` en `panel-cliente.html`); `credenciales_db.ini` (raíz) y `credenciales_erp.ini` (copias en `VENTAS EL MANZANO\` y `CATALOGO PRODUCTOS\scripts\`) (no tocar, no leer en voz alta, no subir); `E:\git-sync\`; las firmas de `venAdmParseFecha()` y `venAdmFmt()`; `_actualizar_xlsx_es_hoy()` fue eliminada en V36.5 y no se restaura; `data\xlsm-enrich.json` lo generan `BODEGAS\descargar_ventas_enrich.py` o `VENTAS EL MANZANO\leer_xlsm.py`, **nunca** `VENTAS EL MANZANO\main.py`.
- **Archivos que NO se eliminan:** `CATALOGO PRODUCTOS\Datos.xlsx` (master del catálogo) y `data\ventas-manzano.json` (el panel lo usa como respaldo en 4 puntos). Para regenerar datos, seguir la sección "REGENERACIÓN COMPLETA SEGURA" de `AGENTS.md`.
- **Cierre:** el deploy no lo ejecuta ningún agente, solo `ACTUALIZAR_TODO.bat` (PASO 4). Si hay cambios sin publicar, se deja constancia de "deploy pendiente" y se corre el pipeline; después `ACTUALIZAR_GITHUB.bat`.

## Cuentas (no mezclar)
Este proyecto usa la cuenta de **Ferretería** (`ferreteriaoviedo.elmanzano@gmail.com`, GitHub `oviedoem`, Firebase `ferreteria-oviedo`) y las herramientas de **E:**. Hay otra cuenta distinta, `alejandrog45@gmail.com` (GitHub `alejandrog45-svg`), que vive en `W:` con **herramientas propias** (incluido su propio Firebase CLI). El monitor UptimeRobot del bot es de la cuenta Ferretería, pero el Render del bot es de `alejandrog45`. Antes de cualquier push, deploy, login o llamada a una API, comprueba la cuenta activa del servicio (`git config user.email`, `gh auth status`, `firebase login:list`); si no coincide, detente y pregunta. Sin orden expresa del dueño: nunca `gh auth login|switch`, `firebase login|logout|login:use`, `git config --global`. En Chrome este proyecto se opera con el perfil **Oviedo** (Profile 1, ferreteriaoviedo.elmanzano); `Alejandro` (Default) es de la otra cuenta. Nunca identifiques el perfil por la posición de la ventana: verifica la cuenta en pantalla. Matriz completa y mapa de discos: `E:\BOT  OVIEDO_ELMANZANO WHATSSSAP\CUENTAS_INFRAESTRUCTURA.md` y la sección CUENTAS de los archivos globales de Claude y Codex.

## Rutas nuevas (2026-10-14)
- `_utilidades/cifrar_secreto_config.py` — cifra con DPAPI un archivo plano de `E:\config` (`<archivo>.enc`), verifica por huella, no imprime ni borra.
- `VENTAS EL MANZANO/cantidad-enrich.json` — cantidad real por `numero|codigo` desde SQL (la escribe `BODEGAS/descargar_costo_promedio.py`; la leen `main.py` y `descargar_ventas_erp.py`). Carpeta ignorada por Hosting y GitHub; interna.
- `E:\_ARCHIVO_FERRETERIA/respaldo-E-cantidades-20261014`, `respaldo-F-firebase-token-20261014`, `respaldo-hosting-ignore-enrich-20261014` y `herremientas-20261014` (con `MANIFIESTO.md`) — respaldos y archivo de esta sesión. Detalle: `memory/estado-sesion-20261014.md`.
