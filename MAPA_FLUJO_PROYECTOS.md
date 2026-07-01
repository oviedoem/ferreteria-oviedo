# MAPA DE FLUJO — PROYECTOS FERRETERÍA OVIEDO
# Arquitectura completa · Disco E: + W: + C: · Desde 2026-06-01
# Última actualización: 2026-06-30 · Versión activa: V37.46
#
# NOTA V37.46 — cambios al pipeline (ver MAPA 2):
#   · PASO 1H (descargar_blazor_bodegas.py) reescrito: TOKEN_RECEPCION directo en credenciales_erp.ini,
#     sin login. Blazor en http://[ERP-IP]/ (root). Selector: button.e-boton:has-text('Exportar a Excel').
#     Si token expira → JustWeb avatar → TOKEN → actualizar GUID en ini.
#   · PASO 1M (descargar_oc_leadtime.py, V37.40): oc-leadtime.json — días OC→recepción por bodega/marca.
#   · Traspasos CD (V37.45-46): filtro bodega, checkboxes ranking, prioridad 4 capas, keywords portabilidad.
#   · Para el detalle visual completo ver pipeline-datos-mapa.html (solo local).
# NOTA V37.25 (histórico): xlsm-enrich.json → SQL PASO 1K; fusionar_despachos.py PASO 1I; bod-icd ICD=73.

---

## MAPA 1 — ARQUITECTURA GENERAL DEL SISTEMA

```
╔══════════════════════════════════════════════════════════════════════════╗
║              DISCO 1 — TOSHIBA USB 1.8TB  (W: + E:)                    ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║   ┌─────────────────────────────┐   ┌──────────────────────────────┐    ║
║   │   W:\claude-config\         │   │   E:\ferreteria-oviedo\      │    ║
║   │   Claude Code config        │   │   Panel Web Oviedo           │    ║
║   │   ← junction desde C:\.claude   │   (proyecto principal)       │    ║
║   └─────────────────────────────┘   └──────────────────────────────┘    ║
║                                                                          ║
║   ┌──────────────────────────────────────────────────────────────────┐  ║
║   │  W:\herramientas\seguridad\    E:\APP-INVENTARIO\               │  ║
║   │  REMONTAR_DISCO_E.ps1          E:\omnara\  (IDE)                │  ║
║   │  EXPULSAR_DISCO_E.ps1          E:\npm-global\  (firebase CLI)   │  ║
║   │  ABRIR_CLAUDE.bat              E:\git-sync\  (push GitHub)      │  ║
║   │  W:\proyecto-docs\  (backup MDs)  E:\config\  (git/npm/tokens)  │  ║
║   └──────────────────────────────────────────────────────────────────┘  ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║              DISCO 0 — NVMe 256GB interno  (C:)                         ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║   ┌──────────────┐  ┌────────────────────┐  ┌──────────────────────┐   ║
║   │ Python 3.x   │  │ Node.js             │  │ Git for Windows      │   ║
║   │ + pyodbc     │  │ C:\Program Files\  │  │ C:\Program Files\    │   ║
║   │ + openpyxl   │  │ (runtime firebase) │  │ (runtime git)        │   ║
║   │ + requests   │  └────────────────────┘  └──────────────────────┘   ║
║   └──────────────┘                                                       ║
║                                                                          ║
║   ┌──────────────────────────────────────────────────────────────┐      ║
║   │ C:\Users\Ferreteria Oviedo\.claude  ──junction──► W:\claude-config ║
║   │ (solo un puntero — datos reales en W:)                       │      ║
║   │ Backup: C:\Users\..\.claude-bak-20260604  (NO borrar)        │      ║
║   └──────────────────────────────────────────────────────────────┘      ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝

    ⚠ ZONA DE RIESGO W:/E:: FortiClient puede bloquear el USB
        Solución: Explorador → clic derecho disco → Expulsar
    ⚠ ZONA DE RIESGO C: si falla → Python + Node + Git caen
        Proyecto en E: sobrevive pero no puede ejecutarse
```

---

<!-- Fuente de verdad: MEMORY.md §4 — esta copia puede quedar desactualizada -->
## MAPA 2 — PIPELINE FERRETERÍA OVIEDO (flujo completo de datos)

```
FUENTES DE DATOS (externas)
─────────────────────────────────────────────────────────────────────────
  ┌────────────────────┐        ┌────────────────────────────────────┐
  │ ERP (VisorRS/SSRS) │        │ SQL Server  [SQL-SERVER-IP]/Foviedo│
  │ Precios + Stock    │        │ Tablas: R_STOCK, M_DOCUMENTOS,     │
  │ (HTTP + credenciales│        │         BVE/FVE, P_BODEGAS        │
  │  credenciales_db.ini│        │         (credenciales_db.ini)      │
  └────────┬───────────┘        └──────────────┬─────────────────────┘
           │                                    │
           │ PASO 1A                            │ PASO 1D/1E/1F
           ▼                                    ▼
  ┌──────────────────────┐       ┌──────────────────────────────────┐
  │ descargar_erp.py     │       │ descargar_bod.py                 │
  │  → actualizar.xlsx   │       │  → bod-iem-registros.json        │
  │    (precios + stock  │       │  → bod-rce-registros.json        │
  │     2 bloques SSRS)  │       │  → bod-cem-registros.json        │
  └──────────┬───────────┘       │                                  │
             │                   │ descargar_pedidos.py             │
             │ PASO 1B           │  → pedidos-comprometidos.json    │
             ▼                   │  → pedidos-detalle.json          │
  ┌──────────────────────┐       │                                  │
  │procesar-actualizacion│       │ descargar_despachos.py           │
  │  → Datos.xlsx        │       │  → despachos-comprometidos.json  │
  │  → catalogo-         │       │  → despachos-detalle.json        │
  │    dinamico.json ●── │──────►│  (señal anti-doble-descarga)     │
  └──────────┬───────────┘       └──────────────────────────────────┘
             │                                    │
             │ PASO 1B (cont.)                    │
             ▼                                    │
  ┌──────────────────────┐                        │
  │ xlsx_a_csv.py        │                        │
  │  → Datos.csv         │                        │
  │ csv_a_json.py        │                        │
  │  → Datos.json        │                        │
  │    (~3.5MB, 6011 prod│                        │
  └──────────┬───────────┘                        │
             │                                    │
             │ PASO 1C                            │
             ▼                                    │
  ┌──────────────────────┐                        │
  │ leer_xlsm.py         │                        │
  │  (lee BODEGAS/*.xlsm)│                        │
  │  → xlsm-enrich.json  │                        │
  │    (rut, sector, hora│                        │
  │     razonSocial)     │                        │
  └──────────┬───────────┘                        │
             │                                    │
             │ PASO 2   ◄─────────────────────────┘
             ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ main.py  (VENTAS EL MANZANO\)                                    │
  │                                                                  │
  │  1. ¿catalogo-dinamico.json es de hoy? → usar datos del PASO 1  │
  │     Si NO → descargar bodegas HTTP (~70s extra)                  │
  │  2. descargar_ventas_erp.py  → ventas_erp_producto_YYYYMMDD.xlsx │
  │     (incremental, dedup por Numero+Codigo)                       │
  │  3. consolidar() → JOIN catálogo + ventas + mapa_cliente         │
  │  4. enriquecer_desde_xlsm() ← usa xlsm-enrich.json              │
  │  5. guardar_json() →                                             │
  │       ventas-manzano.json          (fallback — NUNCA eliminar)   │
  │       ventas-manzano-YYYY.json     (anual)                       │
  │       ventas-manzano-YYYY-MM.json  (mensual ~200KB)              │
  └──────────┬───────────────────────────────────────────────────────┘
             │
             │ PASO 3 — prompt visibilidad precios (10s, default N)
             │
             │ PASO 3.5 (MITIGACIÓN ACTIVA V37.28 — token rotativo, ver AGENTS.md)
             ▼
  ┌──────────────────────────────────────────────────────────┐
  │ _utilidades/rotar_token_data.py                          │
  │  → mueve los 27 JSON sensibles (ventas/costos/stock/      │
  │    pedidos/despachos) a data/<token-aleatorio>/           │
  │  → borra la carpeta del token anterior                    │
  │  → publica el token en Firestore dataAccessToken/current  │
  │    (protegido por firestore.rules: solo admin/vendedor)   │
  │  catalogo-dinamico.json NO se mueve: sigue público a propósito│
  │  panel-admin.html e index.html leen el token tras login y │
  │  construyen la URL con dataUrl() — sin rutas fijas en el  │
  │  código fuente (mitigación, NO es auth real a nivel HTTP) │
  │  ⚠ Storage descartado: requiere Blaze. Firestore directo  │
  │    descartado: archivos hasta 26MB superan 1MB/doc        │
  └──────────────────────┬─────────────────────────────────────┘
             │
             │ PASO 4
             ▼
  ┌──────────────────────────────────────────────┐
  │  firebase deploy --only hosting              │
  │  (Node.js de C: requerido)                   │
  │  → ferreteria-oviedo.web.app                 │
  └──────────────────────────────────────────────┘

ACTIVADORES DEL PIPELINE:
  ┌─────────────────────────────────────────────────────────────────┐
  │  Manual:     ACTUALIZAR_TODO.bat           (prompt precios)     │
  │  Manual:     ACTUALIZAR_TODO_AUTO.bat      (sin prompt)         │
  │  Solo deploy: PUBLICAR.bat                                      │
  │  Solo GitHub: ACTUALIZAR_GITHUB.bat        (Git de C: requerido)│
  └─────────────────────────────────────────────────────────────────┘
```

---

## MAPA 3 — PANEL WEB (consumidores del JSON en Firebase)

```
Firebase Hosting (ferreteria-oviedo.web.app)
────────────────────────────────────────────────────────────
  JSONs estáticos publicados:
  ┌─────────────────────────────────────────────────────┐
  │ data/Datos.json              (~3.5MB)  catálogo     │
  │ data/ventas-manzano-YYYY-MM  (~200KB) mes actual    │
  │ data/ventas-manzano-YYYY     (2-18MB) año completo  │
  │ data/ventas-manzano.json     (fallback obligatorio) │
  │ data/bod-*.json              (stock bodegas)        │
  │ data/pedidos-*.json          (comprometidos)        │
  │ data/despachos-*.json        (pendientes despacho)  │
  └────────────────────┬────────────────────────────────┘
                       │
          ┌────────────┼─────────────┐
          ▼            ▼             ▼
  ┌──────────────┐ ┌──────────┐ ┌──────────────────────┐
  │panel-admin   │ │index.html│ │panel-cliente.html     │
  │.html         │ │(vendedor)│ │(clientes B2B)         │
  │(admin/coop)  │ │          │ │_mostrarPrecio=false   │
  └──────┬───────┘ └──────────┘ └──────────────────────┘
         │
         ├── Tabs ERP: hora·topMarcas·comparativa·vendrank
         │            marcavend·clientes·tipodoc·facturacion
         │            quiebre·sobrestock·transito·merma
         │            rankingmarca·estaciones·bajrot
         │            pagoanalisis·pagorankings·pagotemporal
         │            entrefechas·arbol·arboltabla·arbolheat
         │            sector·stockconsulta (V37.1)
         │
         ├── Tabs XLSM: nc·marcavend2·preciodiff·mem
         │
         └── Análisis bodegas: IEM/RCE/CEM con selector bfFuente

  Firestore (datos dinámicos — autenticación y config):
  ┌────────────────────────────────────────────────────────┐
  │ users · config · cotizaciones · auditLog               │
  │ notificaciones · sesiones_activas · promos             │
  │ Roles: admin > cooperador > vendedor > cliente         │
  └────────────────────────────────────────────────────────┘
```

---

## MAPA 4 — APP-INVENTARIO (proyecto independiente)

```
Operador (contador de inventario)
         │
         │ Carga manual de archivos Excel/CSV
         ▼
┌─────────────────────────────────────────────────────────┐
│  E:\APP-INVENTARIO\index.html                           │
│  (SPA Vanilla JS — sin servidor)                        │
│                                                         │
│  Fuentes de datos (solo carga local — nada online):     │
│  ├── XLSX 2025: inventario conteo año anterior          │
│  └── XLSX 2026: inventario conteo año actual            │
│                                                         │
│  Procesamiento (todo en browser):                       │
│  SheetJS → parseo xlsx · PapaParse → parseo csv         │
│  Chart.js → gráficos                                    │
└─────────────────────────┬───────────────────────────────┘
                          │
                          │ ACTUALIZAR_GITHUB.bat (en E:\APP-INVENTARIO\)
                          ▼
              GitHub Pages (oviedoem.github.io/APP-INVENTARIO)
```

---

## MAPA 5 — CLAUDE CODE (config y memoria)

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLAUDE CODE — arquitectura post-migración 2026-06-04               │
│                                                                     │
│  Datos reales (en W:):                                              │
│  W:\claude-config\           ← config, skills, memory              │
│  W:\claude-config\projects\E--ferreteria-oviedo\memory\            │
│  W:\claude-config\CLAUDE.md  ← instrucciones globales              │
│  W:\proyecto-docs\           ← backup MDs del proyecto             │
│                                                                     │
│  Acceso vía junction (en C:):                                       │
│  C:\Users\Ferreteria Oviedo\.claude  ──► W:\claude-config\         │
│  Claude busca en C:, Windows redirige a W: transparentemente       │
│                                                                     │
│  Backup rollback (en C:):                                           │
│  C:\Users\Ferreteria Oviedo\.claude-bak-20260604  ← NO borrar      │
│                                                                     │
│  Claude ejecutable (en C:):                                         │
│  C:\Users\Ferreteria Oviedo\AppData\Roaming\Claude\  ← Electron    │
│  C:\Users\Ferreteria Oviedo\AppData\Roaming\Claude\claude-code\... │
└─────────────────────────────────────────────────────────────────────┘
```

---

## MAPA 6 — DEPENDENCIAS DE C: (irremovibles)

```
╔══════════════════════════════════════════════════════════════════════╗
║   DEPENDENCIAS EN C:   (si C: falla → estas cosas caen)             ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  1. PYTHON — C:\Python3x\                                            ║
║     ├── python.exe  (intérprete de todo el pipeline)                 ║
║     ├── pyodbc      (SQL Server → descargar_bod/pedidos/despachos)   ║
║     ├── openpyxl    (XLSX → descargar_erp, procesar-actualizacion)   ║
║     └── requests    (HTTP → descargar_erp SSRS)                      ║
║                                                                      ║
║  2. NODE.JS — C:\Program Files\nodejs\                               ║
║     ├── node.exe  (runtime)                                          ║
║     └── usado por: firebase deploy (PUBLICAR.bat, ACTUALIZAR_TODO)   ║
║     Los paquetes npm ya están en E:\npm-global\                      ║
║                                                                      ║
║  3. GIT FOR WINDOWS — C:\Program Files\Git\                          ║
║     └── usado por ACTUALIZAR_GITHUB.bat y Omnara internamente        ║
║                                                                      ║
║  4. CLAUDE CODE CONFIG — C:\..\.claude\  (junction → W:\)           ║
║     Los datos reales están en W:\claude-config\                      ║
║     Si la junction falla → rollback en C:\.claude-bak-20260604       ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## MAPA 7 — FLUJO SI E:/W: NO ESTÁ DISPONIBLE

```
                   E:/W: DESCONECTADO (FortiClient o falla USB)
                                  │
           ┌──────────────────────┼───────────────────────┐
           ▼                      ▼                       ▼
  ACTUALIZAR_TODO            Claude Code            Omnara Desktop
  no encuentra               no puede leer          no puede abrir
  los scripts                su memoria             el proyecto
           │
           ▼
  Pipeline completo cae — datos del último deploy siguen en Firebase CDN

  ─────────────────────────────────────────────────────────────────
  LO QUE SIGUE FUNCIONANDO SIN E:/W::
  - Panel web (datos viejos, desde Firebase CDN)
  - Firestore (auth, usuarios, cotizaciones)
  - APP-INVENTARIO en GitHub Pages (datos viejos)
  - Claude Code (ejecutable en C:) — pero sin memoria de proyecto

  RECUPERACIÓN:
  Opción A: Explorador → clic derecho USB → Expulsar → esperar remontaje
  Opción B: W:\herramientas\seguridad\REMONTAR_DISCO_E.ps1 (admin)
  Opción C (Claude sin memoria): compartir AGENTS.md desde GitHub
  ─────────────────────────────────────────────────────────────────
```

---

## MAPA 8 — FLUJO GIT-SYNC: LO QUE VA A GITHUB vs LO QUE QUEDA LOCAL

```
E:\ferreteria-oviedo\  (proyecto completo — con datos reales)
         │
         │  ACTUALIZAR_GITHUB.bat
         │  robocopy — copia solo archivos permitidos
         ▼
E:\git-sync\  (espejo sanitizado para GitHub)
         │
         │  Archivos que SÍ pasan:
         │  ├── panel-admin.html, panel-cliente.html, index.html
         │  ├── firebase.json, firestore.rules, storage.rules
         │  ├── sw.js, update-sw-version.js, firebase-config.js
         │  ├── manifest*.json, *.jpg
         │  └── AGENTS.md*, MEMORY.md*, MAPA_FLUJO_PROYECTOS.md*
         │      (* IPs/tokens reemplazados por placeholders)
         │
         │  Archivos que NO pasan (.gitignore los bloquea):
         │  ├── VENTAS EL MANZANO/  ← scripts con xTokens ERP
         │  ├── CATALOGO PRODUCTOS/ ← scripts con IPs y tokens
         │  ├── .claude/            ← archivos internos Claude
         │  ├── *.py  *.bat  *.ini  ← scripts y credenciales
         │  └── data/*.json         ← datos de ventas/stock
         │
         │  git add + commit + push
         ▼
github.com/oviedoem/ferreteria-oviedo  (PÚBLICO — ~25 archivos limpios)
         │
         │  1 commit limpio (historial reseteado 2026-06-02)
         │  Ninguna IP real, ningún token, ningún script Python
         ▼
         Backup historial viejo:
         E:\git-sync-historial-backup-20260602\
         ferreteria-oviedo-git-history.git  (16.9 MB, bare clone)
```

---

<!-- Fuente de verdad: MEMORY.md §3 — esta copia puede quedar desactualizada -->
## RESUMEN DE RUTAS CLAVE

```
PROYECTO PRINCIPAL:
  E:\ferreteria-oviedo\                        Raíz del proyecto
  E:\ferreteria-oviedo\BODEGAS\                Scripts SQL Server + XLSM
  E:\ferreteria-oviedo\VENTAS EL MANZANO\      Pipeline ventas
  E:\ferreteria-oviedo\CATALOGO PRODUCTOS\scripts\  Scripts ERP
  E:\ferreteria-oviedo\data\                   JSONs generados (hosting)
  E:\ferreteria-oviedo\_HISTORICO\             MDs y scripts históricos

APP INVENTARIO:
  E:\APP-INVENTARIO\                           Raíz — SPA independiente

CLAUDE CODE:
  W:\claude-config\                            Config y memoria Claude (físico)
  W:\claude-config\projects\E--ferreteria-oviedo\memory\  Memoria proyecto
  W:\proyecto-docs\                            Backup MDs del proyecto
  C:\Users\Ferreteria Oviedo\.claude\          Junction → W:\claude-config\
  C:\Users\Ferreteria Oviedo\.claude-bak-20260604\  Rollback (NO borrar)

HERRAMIENTAS (E:):
  E:\omnara\                      IDE Omnara completo
  E:\npm-global\                  Firebase CLI + node_modules
  E:\config\gitconfig             Git config (GIT_CONFIG_GLOBAL)
  E:\config\gcm-store\            Credenciales git (DPAPI)
  E:\git-sync\                    Copia sanitizada para GitHub

HERRAMIENTAS (W:):
  W:\herramientas\seguridad\      Scripts emergencia USB/Claude

DEPENDENCIAS CRÍTICAS (C:):
  C:\Python3x\                    Intérprete + packages (pipeline)
  C:\Program Files\nodejs\        Node.js runtime (firebase deploy)
  C:\Program Files\Git\           Git for Windows

DEPLOY DESTINOS:
  ferreteria-oviedo.web.app                   Panel principal (Firebase)
  ferreteria-oviedo.web.app/panel-cliente
  ferreteria-oviedo.web.app/panel-admin
  oviedoem.github.io/APP-INVENTARIO           App inventario (GitHub Pages)
```

---

*MAPA_FLUJO_PROYECTOS.md consolidado 2026-06-05*
*Mapas previos en _HISTORICO\20260602_MAPA_FLUJO_PROYECTOS.md*
*Para actualizar cuando se migren Python/Node a E:*
