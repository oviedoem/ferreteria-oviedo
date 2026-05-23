---
name: project-archivo
description: "Mapa completo de archivos archivados en _ARCHIVO — dónde está cada cosa, reglas de recuperación y uso antes de crear nada nuevo"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2b68ce11-b376-4eda-b79c-4879ab32e3af
  lastUpdated: 2026-05-21
  appVersion: V36.1
---

# Carpeta archivo del proyecto

`D:\ferreteria-oviedo\_ARCHIVO\` — creada el 2026-05-20.
Contiene todo lo que NO es parte del flujo activo actual.

**Why:** El proyecto tenía demasiados archivos mezclados con los activos. Se ordenaron para no tocarlos salvo que se necesiten integrar al flujo.

**How to apply:**
1. Antes de crear cualquier script, HTML, BAT o documento nuevo → revisar aquí si ya existe algo reutilizable.
2. Si se necesita un archivo → moverlo (no copiar) desde `_ARCHIVO\` a su carpeta activa correspondiente.
3. Si se integra al flujo → actualizar esta memoria para reflejar que ya no está en el archivo.

---

## 01_PROYECTOS_SEPARADOS

Proyectos completos independientes del flujo principal.

- `APP-INVENTARIO\` — App web de toma de inventario físico (index.html + app.js + style.css). Tiene planillas XLSX de análisis y checklist.
- `PANEL ADMIN COMPRAS\` — Panel admin de compras con su propio Firebase (firebase.json, oviedo-COMPRAS.html, preparar_datos_compras.py, PUBLICAR_COMPRAS.bat, SOLICITUDES SANTIAGO_TLC2.XLSM).
- `SOLO EJEMPLO\` — Documentos de referencia: PDFs, XLSX, XLSM, PPTX, DOCX internos (protocolo traslados, reunión admins, etc.).

---

## 02_DOCUMENTACION_HISTORICA

Solo lectura. No se ejecutan ni despliegan.

- `FLUJOS .MD\` — Carpeta con MDs técnicos: CALCULOS.md, feedback bugs panel admin/cliente, feedback Python encoding ERP, fix JusTime regsvr32, MANUAL_MAESTRO.md, project_compras_panel.md, project_ferreteria_oviedo.md, SEGURIDAD.md, SESION_2026-05-18.md, V33.4.md
- `ESTADO_PROYECTO_V33_6_18052026.md` — Snapshot del estado al 18-05-2026
- `MANUAL_catalogo_productos.md` — Manual del pipeline de catálogo (era MANUAL.md en CATALOGO PRODUCTOS\)
- `MANUAL_ventas_manzano.md` — Manual del pipeline de ventas (era MANUAL.md en VENTAS EL MANZANO\)
- `SEGURIDAD_CREDENCIALES.md` — Guía de manejo de credenciales ERP y Firebase
- `codex_fix_ventas_dia_v2.md` — Nota de fix de ventas por día
- `descarga_lista_precio.md` — Documentación del proceso de descarga de lista de precios ERP
- `GUIA_CREAR_BAT.md` — Guía para crear archivos BAT

---

## 03_DATOS_HISTORICOS

Datos generados por el ERP en fechas anteriores. Los del día activo permanecen en su carpeta original.

### catalogo_backups_xlsx\
Snapshots del pipeline de catálogo de mayo 2026:
- `datos_backup_20260513_214728.xlsx`
- `datos_backup_20260514_082820.xlsx`
- `datos_backup_20260514_144427.xlsx`
- `datos_backup_20260514_144605.xlsx`
- `datos_backup_20260514_144754.xlsx`

### reportes_bodegas_erp\
CSV + XLSX de reportes de bodegas (fechas anteriores a hoy):
- `reporte_bodegas_20260512.csv / .xlsx`
- `reporte_bodegas_20260513.csv / .xlsx`
- `reporte_bodegas_20260515.csv / .xlsx`
- `reporte_bodegas_20260517.csv / .xlsx`

### ventas_erp_xlsx\
Excel de ventas por producto y por cliente (fechas anteriores a hoy):
- `ventas_erp_20260512.xlsx` (formato legacy, un solo archivo)
- `ventas_erp_cliente_20260512 al 20260518.xlsx` (6 archivos)
- `ventas_erp_producto_20260512 al 20260518.xlsx` (6 archivos)

### SERVIDOR2_DATOS_AYER\
Duplicados de tutoriales ERP que también están en 05_TUTORIALES_XLSM_ERP:
- CLAVES DE PRECIO Y RANKING.txt, PRECIOS/RANKING/VENTAS .mp4 y .xlsm

---

## 04_SCRIPTS_AUXILIARES

Scripts Python no llamados por ningún BAT activo ni importados por el pipeline.

- `leer_xlsm.py` — Lector de XLSM via openpyxl (desarrollo previo). PENDIENTE: recuperar para fix bodegaCorta
- `subir_ventas.py` — Versión anterior de subida a Firestore (reemplazado por `subir_ventas_manzano.py`)
- `parse_clasificadas.py` — Parser auxiliar del reporte existencias_clasificadas (usado en desarrollo de descargar_erp.py)
- `_regen_json.py` — Regenerador manual de JSONs fuera del pipeline
- `log.txt` — Log histórico de scripts auxiliares

---

## 05_TUTORIALES_XLSM_ERP

Materiales de capacitación ERP JustWeb. Solo consulta/entrenamiento.

- `PRECIOS.mp4` + `PRECIOS.xlsm`
- `RANKING.mp4` + `RANKING.XLSM`
- `VENTAS.mp4` + `VENTAS.xlsm`
- `CLAVES DE PRECIO Y RANKING.txt`

---

## 06_RESPALDOS_Y_DEBUG

No se despliegan ni ejecutan.

- `panel-adminrespaldo.html` — Respaldo de panel-admin.html de una sesión anterior
- `existencias_clasificadas_raw.html` — HTML crudo del reporte SSRS, capturado durante desarrollo de descargar_erp.py
- `debug_resultado.png` — Captura de pantalla del ERP durante debugging de descargar_ventas_erp.py

---

## 07_BATS_UTILIDADES

BATs fuera del pipeline automático principal.

- `BACKUP_DIARIO.bat` — Robocopy completo de D:\ferreteria-oviedo\ a D:\ARCHIVOS AG 2025\backups\ con retención 14 días. Ejecutar manualmente cuando se necesite snapshot.
- `ACTUALIZAR_Y_PUBLICAR.bat` — Archivo vacío, reemplazado por ACTUALIZAR_TODO.bat. Solo referencia histórica.

---

## HISTORIAL DE CAMBIOS

### 2026-05-21 — V36.1
- Nota agregada en `leer_xlsm.py` (04_SCRIPTS_AUXILIARES): marcar como pendiente de recuperar para fix bodegaCorta
- `lastUpdated` y `appVersion` agregados al frontmatter
