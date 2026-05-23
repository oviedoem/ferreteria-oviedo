---
name: feedback-reglas
description: "Cómo colaborar con el usuario, qué evitar, estilo esperado, reglas de archivo"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2b68ce11-b376-4eda-b79c-4879ab32e3af
  lastUpdated: 2026-05-21
---

Respuestas cortas y técnicas. Cambios mínimos. No refactors innecesarios.

**Why:** El usuario trabaja con Codex para implementar — Claude analiza y define, Codex ejecuta. Respuestas largas o teóricas no aportan.

**How to apply:**
- Formato obligatorio: problema → causa raíz → archivo → función → solución mínima → pseudocódigo → instrucciones exactas
- No agregar dependencias sin autorización
- No reescribir lo que ya funciona
- No pedir confirmación antes de ejecutar scripts/BATs si el usuario dijo "ejecuta"
- No usar emojis
- El usuario NO estará presente para aceptar prompts interactivos — usar background tasks y monitors
- Cuando ejecuta BATs: no usar `cmd /c "bat < NUL"` desde bash (abre shell interactivo). Usar PowerShell step-by-step o correr scripts Python directamente.
- Los archivos XLSM (VENTAS, RANKING, PRECIOS) fueron movidos a `_ARCHIVO\05_TUTORIALES_XLSM_ERP\` — ya no están en VENTAS EL MANZANO\
- No subir datos de ejemplos — solo datos reales actualizados

## Regla _ARCHIVO — revisar antes de crear (agregada 2026-05-20)
Antes de implementar cualquier script, HTML, BAT o función nueva → verificar si existe algo en `D:\ferreteria-oviedo\_ARCHIVO\` que sirva. Si existe → moverlo de vuelta (no copiar). Ver memoria [[project-archivo]] para el mapa completo de qué hay en cada subcarpeta.

**Why:** El usuario ordenó todos los archivos no activos en _ARCHIVO para reutilizarlos cuando se necesiten, no para duplicarlos.
**How to apply:** En cada tarea nueva, buscar en _ARCHIVO antes de escribir código. Si se recupera un archivo del archivo, moverlo (Move-Item) a su carpeta activa y actualizar [[project-archivo]].

## Regla SAFE CHANGE — obligatoria antes de cualquier cambio de código (agregada 2026-05-21)

Antes de escribir cualquier línea de código en panel-admin.html, firebase-config.js, main.py o cualquier script del pipeline, Codex DEBE declarar:

```
TOCO:        [función o bloque exacto]
ARCHIVO:     [nombre del archivo]
RAZÓN:       [una línea]
LLAMADA POR: [qué funciones la invocan]
LLAMA A:     [qué funciones invoca]
VARIABLES:   [variables globales JS que lee/escribe]
NO TOCO:     [lista explícita de funciones/bloques que no se modifican]
```

**Why:** El proyecto cae en ciclos donde arreglar X rompe Y. La causa raíz es que Codex modifica funciones adyacentes sin declarar el alcance. Este protocolo obliga a declarar primero, escribir después.

**How to apply:**
- Un prompt = una función tocada. Si el fix requiere 2 funciones → dos prompts separados en orden.
- Si Codex propone tocar algo fuera del alcance declarado → DETENER y consultar al usuario antes de continuar.
- Señal de alerta: si Codex dice "también modifiqué X para que funcione" sin que se lo pidiera → revisar X antes de aceptar.
- Ver mapa completo de dependencias en [[CLAUDE.md]] sección MAPA DE DEPENDENCIAS CRÍTICAS.
