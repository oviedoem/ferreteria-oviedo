# REGLAS GLOBALES — Ferretería Oviedo El Manzano (resumen ejecutivo, 20 puntos)
> Actualizado 2026-06-23. Para detalle completo: `AGENTS.md` y `CLAUDE.md` (raíz del proyecto).

1. **Proyecto activo:** trabajar SIEMPRE en `E:\ferreteria-oviedo\` (identificar disco por etiqueta de volumen `PROYECTO_E`, la letra cambia según el PC). `E:\git-sync\` es SOLO para push, nunca modificar ahí directamente.

2. **Orden obligatorio al iniciar sesión:** leer `MEMORY.md` → `AGENTS.md` → `CLAUDE.md` → último `estado-sesion-*.md` en memory/. Recién después ejecutar tareas.

3. **Modo CLI de revisión (`OCR_REVIEW.bat`) DESACTIVADO** hasta 2026-07-01 (límite de API). Único modo activo: `/revisar-codigo` (skill, $0, sin API externa, evalúa 14 reglas de `rule.json`).

4. **Safe Change Protocol obligatorio antes de tocar código:** declarar `TOCO / ARCHIVO / RAZÓN / NO TOCO` antes de modificar cualquier función. Un prompt = una función. Si se necesitan 2 funciones → dos prompts separados.

5. **Regla anti-ciclo:** nunca modificar funciones adyacentes sin declararlas. Si el agente dice "también modifiqué X" sin que se pidiera → DETENER y revisar.

6. **Regla anti-regresión (prioridad máxima):** antes de tocar cualquier .py/.bat/.html/.json, verificar en MEMORY.md/AGENTS.md si el cambio ya fue aplicado antes. Si hay duda, detenerse y reportar, no adivinar.

7. **Nunca usar C: para archivos del proyecto.** Excepción documentada y única: este PC (Windows 10 personal, disco externo) tiene `C:\claude-config` como duplicado intencional de `W:\claude-config`, sincronizado manual con `SYNC_W_A_C.bat` (Escritorio). La regla "nunca docs en C:" es del **Windows Empresa, ahora en disco D:** — no confundir ambos casos.

8. **Nunca subir IPs reales, tokens ni contraseñas a git/repo público.** Siempre placeholders resueltos en el comando mismo (nunca dejar `<letra>`/`X:` para que el usuario reemplace a mano).

9. **Archivos intocables:** `firebase-config.js`, `credenciales_db.ini`, `credenciales_erp.ini` — nunca tocar ni leer en voz alta. `CATALOGO PRODUCTOS\Datos.xlsx` y `ventas-manzano.json` nunca se eliminan (son master/fallback).

10. **Nunca extraer ni descifrar credenciales evitando alertas de seguridad**, sin importar el motivo — regla de seguridad permanente.

11. **`window._mostrarPrecio = false` debe ser SIEMPRE el default** en `panel-cliente.html`. Precios solo se habilitan manualmente por Firestore (admin), nunca por código.

12. **Todo `innerHTML` con datos dinámicos debe pasar por escape** (ej. `venAdmEsc()`) — XSS es ERROR bloqueante (regla FO-002). Cualquier escritura no autenticada a Firestore (ej. invitados) debe ir validada por esquema estricto en `firestore.rules`, con lectura restringida a admin/vendedor/dueño.

13. **Respaldos/temporales/duplicados/deprecados nunca se borran del todo:** mover a `E:\ferreteria-oviedo\_ARCHIVO_FERRETERIA\` (fuera del proyecto, no sube a git/firebase).

14. **Sesión "DATOS ERP" = aislamiento estricto:** jamás tocar `E:\ferreteria-oviedo\` desde esa sesión (ni commits, ni grep, ni panel-admin).

15. **Cierre de sesión con cambios (obligatorio, en orden):** `firebase deploy` (si hay archivos más nuevos que el último deploy) → `ACTUALIZAR_GITHUB.bat` (cuenta GitHub obligatoria `oviedoem`, el bat bloquea si detecta otra cuenta) → actualizar versión en `AGENTS.md` → sincronizar los 3 Version Badges (admin/cliente/index, mismo número y fecha) → guardar `estado-sesion-YYYYMMDD.md` en memory/.

16. **Pipeline de datos:** `xlsm-enrich.json` se genera SOLO con `descargar_ventas_enrich.py` (SQL, primario) o `leer_xlsm.py` (fallback) — NUNCA con `main.py`. `ventas-manzano.json` se genera SOLO con `guardar_json()` en `main.py`.

17. **Discos identificados SIEMPRE por etiqueta de volumen**, nunca por letra fija (cambian según el PC): `PROYECTO_E` (proyecto+git-sync+config+herramientas), `CONFIG_W` (claude-config+proyecto-docs). Si un disco USB se desconecta, ver fix FortiShield en `AGENTS.md` → "EMERGENCIA DISCO".

18. **Skill de revisión de código `/revisar-codigo`** corre dentro de la sesión, $0, sin llamadas externas — usar SIEMPRE antes de deploy importante o al tocar `panel-admin.html`, `panel-cliente.html`, `firestore.rules`, `sw.js`, o el pipeline Python.

19. **Antes de cualquier mejora/integración/corrección nueva:** confirmar que no rompe las reglas de negocio ya documentadas (ej. stock CEM acepta negativos por diseño, bodegas no se reducen, IDs de documentos/bodegas verificados) — están en `AGENTS.md`, no asumir ni reinventar.

20. **Si hay cualquier duda no cubierta en este resumen → leer `AGENTS.md` y `CLAUDE.md` completos antes de actuar.** Son la fuente de verdad; este resumen es solo un punto de entrada rápido.
