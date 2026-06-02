# MAPA DE FLUJO — PROYECTOS FERRETERÍA OVIEDO
# Arquitectura completa · Disco E: + dependencias C: · 2026-06-02
# Última actualización: 2026-06-02 — Mapa 8 agregado (seguridad GitHub)

---

## MAPA 1 — ARQUITECTURA GENERAL DEL SISTEMA

```
╔══════════════════════════════════════════════════════════════════════════╗
║                     DISCO E:  (datos + código)                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║   ┌─────────────────────────────┐   ┌──────────────────────────────┐    ║
║   │   ferreteria-oviedo\        │   │   APP-INVENTARIO\            │    ║
║   │   Panel Web Oviedo          │   │   App Inventario Diferencias │    ║
║   └─────────────────────────────┘   └──────────────────────────────┘    ║
║                                                                          ║
║   ┌──────────┐  ┌─────────────┐  ┌──────────┐  ┌───────────────────┐   ║
║   │ omnara\  │  │ npm-global\ │  │ git-sync\│  │ config\           │   ║
║   │ (IDE)    │  │ firebase CLI│  │ (push)   │  │ gcm-store (creds) │   ║
║   └──────────┘  └─────────────┘  └──────────┘  └───────────────────┘   ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                     DISCO C:  (Windows + herramientas)                  ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║   ┌──────────────┐  ┌────────────────────┐  ┌──────────────────────┐   ║
║   │ Python 3.14  │  │ Node.js             │  │ Git for Windows      │   ║
║   │ + pyodbc     │  │ C:\Program Files\  │  │ C:\Program Files\    │   ║
║   │ + openpyxl   │  │ (runtime firebase) │  │ (runtime git)        │   ║
║   │ + requests   │  └────────────────────┘  └──────────────────────┘   ║
║   └──────────────┘                                                       ║
║                                                                          ║
║   ┌──────────────────────────┐  ┌───────────────────────────────────┐   ║
║   │ .claude\                 │  │ Task Scheduler (registro Windows) │   ║
║   │ (Claude Code config)     │  │ Tarea Auto18 → llama E:\...bat    │   ║
║   └──────────────────────────┘  └───────────────────────────────────┘   ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝

         ⚠ ZONA DE RIESGO: si C: falla → Python + Node + Git caen
              Proyecto en E: sobrevive pero no puede ejecutarse
```

---

## MAPA 2 — PIPELINE FERRETERÍA OVIEDO (flujo completo de datos)

```
FUENTES DE DATOS (externas)
─────────────────────────────────────────────────────────────────────────
  ┌────────────────────┐        ┌────────────────────────────────────┐
  │ ERP (VisorRS/SSRS) │        │ SQL Server  [SQL-SERVER-IP]/Foviedo  │
  │ Precios + Stock    │        │ Tablas: R_STOCK, M_DOCUMENTOS,     │
  │ (HTTP + credenciales│        │         BVE/FVE, P_BODEGAS        │
  │  credenciales_db.ini│        │         (credenciales_db.ini)      │
  └────────┬───────────┘        └──────────────┬─────────────────────┘
           │                                    │
           │ PASO 1                             │ PASO 1D/1E/1F
           ▼                                    ▼
  ┌──────────────────────┐       ┌──────────────────────────────────┐
  │ descargar_erp.py     │       │ descargar_bod.py                 │
  │  → actualizar.xlsx   │       │  → bod-iem-registros.json        │
  │    (precios + stock  │       │  → bod-rce-registros.json        │
  │     2 bloques SSRS)  │       │  → bod-cem-registros.json        │
  └──────────┬───────────┘       │                                  │
             │                   │ descargar_pedidos.py             │
             │ PASO 1A           │  → pedidos-comprometidos.json    │
             ▼                   │  → pedidos-detalle.json          │
  ┌──────────────────────┐       │                                  │
  │procesar-actualizacion│       │ descargar_despachos.py           │
  │  → Datos.xlsx        │       │  → despachos-comprometidos.json  │
  │  → catalogo-         │       │  → despachos-detalle.json        │
  │    dinamico.json ●── │──────►│  (señal anti-doble-descarga)     │
  └──────────┬───────────┘       └──────────────────────────────────┘
             │                                    │
             │ PASO 1B                            │
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
  │  3. consolidar() → JOIN catalogo + ventas + mapa_cliente         │
  │  4. enriquecer_desde_xlsm() ← usa xlsm-enrich.json              │
  │  5. guardar_json() →                                             │
  │       ventas-manzano.json          (fallback — NUNCA eliminar)   │
  │       ventas-manzano-YYYY.json     (anual)                       │
  │       ventas-manzano-YYYY-MM.json  (mensual ~200KB)              │
  └──────────┬───────────────────────────────────────────────────────┘
             │
             │ PASO 3 — prompt visibilidad precios (10s, default N)
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
  │  Manual:     ACTUALIZAR_TODO.bat          (prompt precios)      │
  │  Automático: ACTUALIZAR_TODO_AUTO.bat     (sin prompt, 18:00)   │
  │              ↑ Task Scheduler de Windows (registro en C:)       │
  │  Solo deploy: PUBLICAR.bat                                      │
  │  Solo GitHub: ACTUALIZAR_GITHUB.bat       (Git de C: requerido) │
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
                       │  (cada panel carga sus JSON al abrir)
          ┌────────────┼─────────────┐
          ▼            ▼             ▼
  ┌──────────────┐ ┌──────────┐ ┌──────────────────────┐
  │panel-admin   │ │panel-    │ │panel-cliente.html     │
  │.html         │ │vendedor  │ │(clientes B2B)         │
  │(admin/coop)  │ │.html     │ │_mostrarPrecio=false   │
  └──────┬───────┘ └──────────┘ └──────────────────────┘
         │
         ├── Tabs ERP: hora·topMarcas·comparativa·vendrank
         │            marcavend·clientes·tipodoc·facturacion
         │            quiebre·sobrestock·transito·merma
         │            rankingmarca·estaciones·bajrot
         │            pagoanalisis·pagorankings·pagotemporal
         │            entrefechas·arbol·arboltabla·arbolheat
         │            sector·stockconsulta
         │
         ├── Tabs XLSM: nc·marcavend2·preciodiff·mem
         │
         └── Analisis bodegas: IEM/RCE/CEM con selector

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
│  ┌─────────────────────────────────────────────────┐   │
│  │ XLSX 2025: inventario conteo año anterior        │   │
│  │ XLSX 2026: inventario conteo año actual          │   │
│  │ (archivos cargados por drag&drop o selector)     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Procesamiento (todo en browser):                       │
│  SheetJS → parseo xlsx                                  │
│  PapaParse → parseo csv                                 │
│  Chart.js → gráficos                                    │
│                                                         │
│  Vistas:                                                │
│  ├── Planos (465 patentes: Sala/Bodega/2do/Patio)       │
│  ├── Centro Reconteo                                    │
│  ├── Análisis 2025 / Análisis 2026                      │
│  ├── Comparativo 2025 vs 2026                           │
│  ├── Avanzado · Final · Mejoras                         │
│  └── Avance por patente (modo "en curso")               │
└─────────────────────────┬───────────────────────────────┘
                          │
                          │ git push (ACTUALIZAR_GITHUB_APP_INVENTARIO.bat)
                          │ (Git de C: requerido)
                          ▼
              GitHub Pages (oviedoem.github.io/APP-INVENTARIO)
              (accesible desde cualquier navegador — sin autenticación)
```

---

## MAPA 5 — OMNARA (IDE de trabajo) — DISCO E: vs C:

```
┌─────────────────────────────────────────────────────────────────────┐
│  OMNARA — distribuido entre E: y C:                                 │
│                                                                     │
│  E:\omnara\home\          CLI daemon + sesiones + versiones         │
│  E:\omnara\bin\           Wrappers .cmd (omnara.cmd, omnara-claude) │
│  E:\omnara\desktop-app\   Omnara.exe (Electron app)                │
│  E:\omnara\desktop-data\  auth-tokens · DB · preferences           │
│  E:\omnara\desktop-updater\ cache del updater (puede volver a C:)  │
│                                                                     │
│  C:\Users\...\Desktop\Omnara.lnk  ──► apunta a E:\omnara\...       │
│  C:\...\Start Menu\Omnara.lnk     ──► apunta a E:\omnara\...       │
│                                                                     │
│  ⚠ ATENCIÓN: cada actualización automática de Omnara               │
│    reinstala en C:\...\AppData\Local\Programs\omnara-desktop\       │
│    Acción post-update: mover de vuelta a E:\omnara\desktop-app\     │
│                                                                     │
│  OMNARA_HOME = E:\omnara\home  (variable de entorno de usuario)     │
│  PATH += E:\omnara\bin\bin                                          │
│                                                                     │
│  Proyecto activo configurado en daemon.json:                        │
│    E:\ferreteria-oviedo  ← único directorio activo                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## MAPA 6 — ZONA DE CONFLICTO: LO QUE SIEMPRE VIVE EN C:

```
╔══════════════════════════════════════════════════════════════════════╗
║   DEPENDENCIAS IRREMOVIBLES DE C:   (buscar soluciones aquí)        ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  1. PYTHON — C:\Python314\                                           ║
║     ├── python.exe  (intérprete)                                     ║
║     ├── pyodbc      (SQL Server → descargar_bod/pedidos/despachos)   ║
║     ├── openpyxl    (XLSX → descargar_erp, procesar-actualizacion)   ║
║     └── requests    (HTTP → descargar_erp SSRS)                      ║
║     SOLUCIÓN: Reinstalar Python en E:\Python\                        ║
║     COMANDO:  setx PYTHONPATH E:\Python\ + pip install en E:\        ║
║                                                                      ║
║  2. NODE.JS — C:\Program Files\nodejs\                               ║
║     ├── node.exe  (runtime)                                          ║
║     └── npm       (pero los paquetes ya están en E:\npm-global\)     ║
║     SOLUCIÓN: Instalar nvm-windows → apuntar a E:\nodejs\            ║
║     O bien: descargar Node.js portable → E:\nodejs\                  ║
║                                                                      ║
║  3. GIT FOR WINDOWS — C:\Program Files\Git\                          ║
║     └── usado por ACTUALIZAR_GITHUB.bat y Omnara internamente        ║
║     SOLUCIÓN: Git portable en E:\git-portable\                       ║
║     Descarga: git-scm.com → PortableGit-x64.7z → E:\git-portable\   ║
║                                                                      ║
║  4. CLAUDE CODE CONFIG — C:\Users\Ferreteria Oviedo\.claude\         ║
║     ├── settings.json  (permisos, hooks)                             ║
║     ├── keybindings.json                                             ║
║     └── projects\E--ferreteria-oviedo\memory\ (notas del proyecto)  ║
║     SOLUCIÓN: NO hay solución limpia — Claude Code siempre usa        ║
║     el perfil del usuario en C:. Hacer backup de .claude\ a E:       ║
║                                                                      ║
║  5. TASK SCHEDULER — Registro de Windows (siempre en C:)            ║
║     └── Tarea Auto18 → llama E:\...\ACTUALIZAR_TODO_AUTO.bat         ║
║     SOLUCIÓN: No aplica — el scheduler siempre es de Windows.        ║
║     El bat SÍ está en E:, solo el trigger está en C:.                ║
║                                                                      ║
║  6. TAREAS OBSOLETAS APUNTANDO A D: (pendiente eliminar)            ║
║     ├── "Ferreteria Oviedo - Backup Diario" → D:\...\BACKUP.bat      ║
║     └── "Ferreteria Oviedo Ventas 7PM"      → D:\...\ACTUALIZAR.bat  ║
║     SOLUCIÓN: Eliminar ambas tareas (son duplicados obsoletos)       ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## MAPA 7 — FLUJO SI E: NO ESTÁ DISPONIBLE

```
                   E: DESCONECTADO O FALLA
                           │
          ┌────────────────┼──────────────────┐
          ▼                ▼                  ▼
   ACTUALIZAR_TODO    Tarea Auto18       Omnara Desktop
   no encuentra       falla a las        no puede abrir
   los scripts        18:00 sin aviso    el proyecto
          │
          ▼
   Todo el pipeline cae:
   - No se actualizan precios
   - No se descargan bodegas
   - No se generan JSONs de ventas
   - No se hace firebase deploy
   - Panel web muestra datos del último deploy anterior
          │
          ▼
   Panel web en ferreteria-oviedo.web.app SIGUE FUNCIONANDO
   (Firebase Hosting sirve los JSONs del último deploy exitoso)
   PERO con datos del día anterior o más

   ─────────────────────────────────────────────────────
   LO ÚNICO QUE SIGUE FUNCIONANDO SIN E::
   - Panel web (datos viejos, desde Firebase CDN)
   - Firestore (auth, usuarios, cotizaciones)
   - APP-INVENTARIO en GitHub Pages (datos viejos)
   - Claude Code (desde C:) para trabajar en otras cosas
   ─────────────────────────────────────────────────────
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
         │  ├── manifest*.json
         │  └── AGENTS.md*, MEMORY.md*, ESTADO_PROYECTO.md*
         │      MAPA_FLUJO_PROYECTOS.md*, RESUMEN_TECNICO_MIGRACION_E.md
         │      (* IPs/tokens reemplazados por placeholders al publicar)
         │
         │  Archivos que NO pasan (.gitignore los bloquea):
         │  ├── VENTAS EL MANZANO/  ← xTokens ERP en scripts .py
         │  ├── CATALOGO PRODUCTOS/ ← IPs y tokens ERP
         │  ├── FLUJOS/             ← docs históricos con credenciales
         │  ├── .claude/            ← archivos internos Claude
         │  ├── *.py  *.bat  *.ini  ← scripts y credenciales
         │  └── data/*.json         ← datos de ventas/stock
         │
         │  git add + commit + push
         ▼
github.com/oviedoem/ferreteria-oviedo  (PÚBLICO — 25 archivos limpios)
         │
         │  1 commit en historial (reseteado 2026-06-02)
         │  Ninguna IP real, ningún token, ningún script Python
         ▼
         Backup historial viejo (solo local, nunca en GitHub):
         E:\git-sync-historial-backup-20260602\
         ferreteria-oviedo-git-history.git  (16.9 MB, bare clone)
```

---

## RESUMEN DE RUTAS CLAVE

```
PROYECTO PRINCIPAL:
  E:\ferreteria-oviedo\           Raíz del proyecto
  E:\ferreteria-oviedo\BODEGAS\   Scripts SQL Server + XLSM
  E:\ferreteria-oviedo\VENTAS EL MANZANO\  Pipeline ventas
  E:\ferreteria-oviedo\CATALOGO PRODUCTOS\scripts\  ERP scripts
  E:\ferreteria-oviedo\data\      JSONs generados (hosting)

APP INVENTARIO:
  E:\APP-INVENTARIO\              Raíz — SPA independiente

HERRAMIENTAS (E:):
  E:\omnara\                      IDE Omnara completo
  E:\npm-global\                  Firebase CLI + node_modules
  E:\config\gcm-store\            Credenciales git
  E:\git-sync\                    Copia sanitizada para GitHub
  E:\git-sync-historial-backup-20260602\  Historial viejo (solo backup)

HERRAMIENTAS (C: — dependencias críticas):
  C:\Python314\                   Intérprete + packages
  C:\Program Files\nodejs\        Node.js runtime
  C:\Program Files\Git\           Git for Windows
  C:\Users\Ferreteria Oviedo\.claude\  Config Claude Code

DEPLOY DESTINOS:
  ferreteria-oviedo.web.app       Panel principal (Firebase)
  ferreteria-oviedo.web.app/panel-cliente
  ferreteria-oviedo.web.app/panel-admin
  oviedoem.github.io/APP-INVENTARIO  App inventario (GitHub Pages)
```

---

*Generado 2026-06-02 · Para actualizar el mapa cuando se migren Python/Node a E:*
