# CRITERIO.md — Ferretería Oviedo El Manzano (Panel Admin)
# El "cerebro" del agente: criterios de decisión antes de ejecutar.
# Este archivo dice POR QUÉ y CUÁNDO — CLAUDE.md dice CÓMO.

## QUÉ ES ESTE ARCHIVO

`CLAUDE.md` describe instrucciones técnicas y procedimientos.
Este archivo describe los **criterios de juicio** que el agente aplica cuando hay una decisión que tomar.

---

## JERARQUÍA DE DECISIÓN

En orden de prioridad. Si hay conflicto, gana el nivel más alto:

1. **No romper el panel en producción** — `ferreteria-oviedo.web.app` es la herramienta del día a día
2. **Datos.json nunca se pierde** — cada deploy debe copiarlo antes; si se pierde, el catálogo baja
3. **Catálogo bot va a Hosting, nunca a Firestore** — quota Firestore agotada
4. **Un cambio a la vez** — un prompt = una función; nunca agregar scope no pedido
5. **Credenciales fuera de git** — IPs, contraseñas, tokens solo en archivos del `.gitignore`

---

## CRITERIOS DE ACEPTACIÓN DE UN CAMBIO

| Criterio | Pregunta |
|---|---|
| **Panel no rompe** | ¿El cambio puede dejar el panel-admin.html sin cargar datos? |
| **Datos.json protegido** | ¿El deploy copia Datos.json antes de subir a Hosting? |
| **Sin Firestore write masivo** | ¿El cambio escribe más de 100 documentos a Firestore? |
| **Credentials fuera de git** | ¿Algún archivo nuevo contiene IP, contraseña o token? |
| **Deploy verificado** | ¿Se verificó la URL pública después del `firebase deploy`? |

---

## CUÁNDO DECIR NO SIN PREGUNTAR

- Cualquier write masivo a Firestore (quota agotada)
- Commitear `credenciales_db.ini`, `credenciales_erp.ini` o el JSON de Firebase Admin
- Hacer `firebase deploy` sin copiar Datos.json primero
- Modificar `firebase-config.js`
- Trabajar directamente en `E:\git-sync\`

---

## CUÁNDO PEDIR CONFIRMACIÓN

- El cambio afecta `panel-admin.html` en secciones fuera del alcance del pedido
- El pipeline (`ACTUALIZAR_TODO.bat`) necesita un paso nuevo
- Una función nueva requiere acceso a SQL Server (nuevo query, nueva tabla)

---

## FILOSOFÍA DE FONDO

**Panel primero, pipeline después.**

El panel-admin es la herramienta que el dueño usa todos los días.
Un pipeline roto que el dueño puede arreglar solo (correr el bat) es tolerable.
Un panel roto bloquea el negocio — tiene prioridad absoluta.

Prioridad: **panel siempre verde → pipeline funcional → features nuevas**.

**El dueño trabaja solo.**
No hay equipo técnico disponible. El dueño debe poder entender y arreglar lo que falla.
Cada solución debe ser lo suficientemente simple para que el dueño la depure sin ayuda de IA.
