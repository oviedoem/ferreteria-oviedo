# CLAUDE.md — Ferretería Oviedo El Manzano
# Este archivo se carga automáticamente al inicio de cada sesión de Claude Code.

## LEER OBLIGATORIO ANTES DE CUALQUIER TAREA

1. Leer `AGENTS.md` (reglas completas del proyecto, Safe Change Protocol, pipeline, historial)
2. Leer `MEMORY.md` (si está disponible en contexto)
3. Recién después ejecutar cualquier tarea

---

## STACK Y DIRECTORIO

- **Proyecto activo:** `E:\ferreteria-oviedo\` — trabajar SIEMPRE aquí
- **Git repo:** `E:\git-sync\` — NUNCA modificar directamente
- **Versión activa:** ver AGENTS.md (historial de deploys)
- **Stack:** HTML/CSS/JS Vanilla + Firebase Hosting + Python pipeline ERP (JustWeb SSRS)
- **Deploy:** `firebase deploy` desde `E:\ferreteria-oviedo\`
- **Commit:** `ACTUALIZAR_GITHUB.bat` desde `E:\ferreteria-oviedo\`

---

## REGLAS CRÍTICAS (resumen — ver AGENTS.md para detalle completo)

### Nunca hacer esto
- Usar `C:` para guardar archivos del proyecto
- Subir IPs reales, tokens, contraseñas a git (usar placeholders)
- Modificar `firebase-config.js`, `credenciales_db.ini`, `credenciales_erp.ini`
- Trabajar directamente en `E:\git-sync\`
- Usar `cmd /c bat > NUL` desde bash (usar PowerShell)

### Antes de cualquier cambio de código
```
TOCO:        [función exacta]
ARCHIVO:     [panel-admin.html | main.py | otro]
RAZÓN:       [una línea]
NO TOCO:     [qué queda igual y por qué]
```
Un prompt = una función tocada. Si el fix requiere 2 funciones → dos prompts separados.

### Al terminar cualquier sesión con cambios
1. `firebase deploy` si hay archivos HTML/JS/JSON más nuevos que el último deploy
2. `ACTUALIZAR_GITHUB.bat` para commitear
3. Actualizar versión en AGENTS.md

---

## ARQUITECTURA DE DISCOS

| Ruta | Contenido |
|---|---|
| `E:\ferreteria-oviedo\` | Proyecto activo |
| `E:\git-sync\` | Repo git (solo para commits/push) |
| `W:\claude-config\` | Config Claude (junction desde C:\Users\..\.claude) |
| `E:\config\` | Tokens, gitconfig, credenciales cifradas |

**W: y E: son el mismo USB físico.** Si se desconecta: Explorador → clic derecho E: → Expulsar → remontar.

---

## OPEN CODE REVIEW (OCR)

Herramienta de revisión de código con IA. Correr antes de deploys importantes:
```
cd E:\git-sync
ocr review --audience agent --commit <hash>
```
Config en `E:\config\opencodereview\config.json` (junction desde C:\Users\..\.opencodereview).
