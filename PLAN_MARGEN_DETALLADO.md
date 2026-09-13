# Plan — Margen Detallado (Panel Admin + Panel Vendedor)
Creado 2026-09-09 (sesión cloud Claude Code) · Rama: `claude/ferreteria-margin-analysis-bpj08h`

> **Este documento es una PROPUESTA, no una orden de ejecución.**
> Ninguna fase se ejecuta sola. El flujo es siempre: **proponer → pedir revisión al dueño → recién ahí tocar código.**
> Aplica en todo momento: Regla Anti-retroceso, protocolo `TOCO/ARCHIVO/RAZÓN/NO TOCO` de `AGENTS.md`, un cambio por prompt, y ahorro de tokens (grep antes que leer archivo completo, una tarea a la vez, sin mezclar proyectos).

## Artefacto visual del diagnóstico

📉 **Diagnóstico de Margen** (estado actual de los menús + brecha de datos + gráfico ERP ene–sep 2026):
https://claude.ai/code/artifact/8f717002-14f7-46aa-b4f6-251400435e8f

Léelo primero — resume en una página todo lo que sigue abajo con más detalle.

---

## 1. Cómo retomar esto en el PC (E:\ferreteria-oviedo)

Seguir el orden que ya exige `CLAUDE.md` del proyecto, sin saltarse pasos:

```powershell
# 1. Parado en la carpeta del proyecto
cd E:\ferreteria-oviedo

# 2. Leer las reglas completas (Safe Change Protocol, historial, pipeline)
#    -> AGENTS.md, MEMORY.md ya se cargan solos al abrir Claude Code aquí

# 3. Confirmar que este plan llegó (se pushea desde la rama cloud)
git fetch origin claude/ferreteria-margin-analysis-bpj08h
git log --oneline -5 origin/claude/ferreteria-margin-analysis-bpj08h

# 4. Ver qué archivo es más reciente en la raíz (regla "flujo actual" de CLAUDE.md)
Get-ChildItem "E:\ferreteria-oviedo" -File | Sort-Object LastWriteTime -Descending | Select-Object Name, LastWriteTime | Select-Object -First 20

# 5. Verificar VPN FortiClient activa (se necesita para consultar SQL Server / documento_lineas)
```

Al abrir Claude Code en esa carpeta, decir explícitamente algo como:
> "Retomamos `PLAN_MARGEN_DETALLADO.md` — revisamos la Fase 1 antes de tocar nada."

Así la sesión del PC entra en modo revisión, no en modo ejecución automática.

---

## 2. Diagnóstico (resumen — detalle completo en el artefacto)

- **Dato real del ERP** (reporte SSRS adjunto por el dueño): margen mensual 2026 cae de ~27-28% (ene-jun) a 28%/25%/24% en jul/ago/sep(parcial, 8 días).
- **Lo que ya existe y funciona, sin tocar:**
  - Panel Admin → Análisis → Ventas (`vadm*` en `panel-admin.html`): margen agregado por documento, filtros vendedor/bodega/período, ve **todos** los vendedores.
  - Panel Vendedor → Detalle de venta y margen (`vs*` en `index.html`): mismo cálculo, pero **restringido** — confirmado en código que filtra por `vendedor/vendedorErp/gmailUser === vendKey` de la sesión. Un vendedor no puede ver venta ajena.
- **Brecha real:** ambos leen `ventas-manzano*.json`, que es **a nivel documento** (cabecera), no de línea de producto. No hay código, marca, familia, subfamilia ni hiperfamilia por ítem — hoy es imposible aislar qué categoría o marca está arrastrando el margen hacia abajo, solo se ve el total.
- **Límite de esta sesión cloud:** no están presentes `main.py`, `descargar_ventas_erp.py`, la carpeta `data/` con los JSON reales, ni acceso a SQL Server/VPN — todo eso vive solo en el PC. Por eso el detalle de línea no se puede generar ni probar desde acá.

---

## 3. Fases propuestas (una a la vez — cada una se abre con revisión, no con ejecución)

### Fase 1 — Especificar el export de detalle por línea
- **Qué:** definir el query SQL (`documento_lineas` + `productos`) que trae código, descripción, marca, familia, subfamilia, hiperfamilia, costo y precio por vendedor/mes, y el script que lo vuelca a un nuevo JSON (ej. `ventas-manzano-detalle-YYYY-MM.json`).
- **Dónde corre:** en el PC, con VPN activa — no en esta sesión cloud.
- **Antes de escribir el query:** revisar con `/revisar-pipeline` el estado actual del pipeline ERP→Firebase para no duplicar un paso que ya existe, y con `AG-FERRESYSTEM` (`/consultar-historico` o el propio `E:\SQL`) confirmar nombres reales de columnas en `documento_lineas`.
- **Salida esperada:** un archivo `.sql` o `.py` propuesto + una fila de ejemplo del JSON de salida, para revisar el formato ANTES de correrlo contra producción.

### Fase 2 — Menú nuevo en Panel Admin: "Margen Detallado"
- **Qué:** pestaña nueva en `panel-admin.html`, sin tocar `vadm*`. Filtros: vendedor, marca, familia, subfamilia, hiperfamilia, rango de margen (incluye negativos), período. Ve todos los vendedores.
- **Antes de tocar código:** declarar `TOCO / ARCHIVO / RAZÓN / NO TOCO`, correr `/paperclip-revision-costo-cero` y `/revisar-codigo` sobre el diff, aplicar `/web-design-guidelines` si hay componente visual nuevo.
- **Depende de:** el JSON de la Fase 1 (o, si el dueño prefiere adelantar el diseño, se puede maquetar con datos de ejemplo y dejarlo listo para conectar).

### Fase 3 — Mismo menú en Panel Vendedor ("Vendedor Pro")
- **Qué:** reutiliza el componente de la Fase 2 en `index.html`, con el filtro de vendedor **forzado** al `vendKey` de sesión — mismo patrón que ya usa `vs*` (verificado en Fase de diagnóstico).
- **Revisión obligatoria antes de cerrar:** confirmar en código que un vendedor no puede cambiar el filtro para ver a otro vendedor (mismo chequeo que ya existe en `vs*`).

### Fase 4 — Diagnóstico Agosto vs Septiembre
- **Qué:** con el detalle de línea ya cargado, cruzar jul–sep por marca/familia/vendedor para aislar qué está arrastrando el margen — insumo real para decidir una acción, no solo para verla en una tabla.
- **Depende de:** Fases 1 y 2 (o 3) ya en producción con datos reales de al menos 2 meses.

---

## 4. Checklist de revisión por cada fase (repetir siempre)

```
[ ] TOCO / ARCHIVO / RAZÓN / NO TOCO declarado antes de editar
[ ] Anti-retroceso: ¿qué función/menú existente NO se toca?
[ ] Skill de diseño aplicada si hay UI nueva (/web-design-guidelines + /sleek-mobile si es mobile)
[ ] /paperclip-revision-costo-cero y/o /revisar-codigo corridos sobre el diff
[ ] Ahorro de tokens: ¿se usó grep antes de leer archivo completo? ¿una sola tarea a la vez?
[ ] Restricción de acceso verificada (vendedor solo ve su propia venta) si el cambio toca index.html
[ ] Confirmación explícita del dueño ANTES de pasar a la fase siguiente
```

---

## 5. Próximo paso

Este documento queda para revisión. **No se ha tocado ningún archivo de código** (`panel-admin.html`, `index.html` intactos). Cuando el dueño confirme, se abre la Fase 1 con su propio `TOCO/ARCHIVO/RAZÓN/NO TOCO` en un mensaje aparte.
