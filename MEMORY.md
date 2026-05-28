# MEMORY.md — Ferretería Oviedo El Manzano
# Referencia consolidada · No depender de docs/ ni _HISTORICO/
# Ultima actualizacion: 2026-05-26 · Version activa: V37.2

---

## 1. VERSION ACTIVA

| Campo | Valor |
|---|---|
| Version | V37.8 |
| Fecha ultimo deploy | 2026-05-27 23:10 |
| Ultimo cambio | Fix pedidos-detalle (P_VENDEDORES→IDVENDEDOR directo, CTE CANTIDAD_PENDIENTE, cliente RAZON_SOCIAL) + descargar_despachos.py (BVE/FVE→Dif) + Informe Stock 22 cols (DifLib eliminado) + modal Dif/Ped rediseñados |
| Deploy cierre sesion | 2026-05-27 23:10 — todo publicado, sin pendientes |

Historial reciente:
- V37.8 (2026-05-27): fix pedidos-detalle + nuevo descargar_despachos.py + DifLib→Dif + modales
- V37.7 (2026-05-27): MEM + Pedido + DifStk/DifLib + drill-down + PASO 1D descargar_pedidos.py
- V37.6 (2026-05-27): fix Informe Stock Fis todo cero (pem_bod/sem_bod en pipeline)
- V37.5 (2026-05-27): fix diasAntiguedad RCE + auditoria DOC IN GII/GTS
- V37.4 (2026-05-27): fix disp CEM: ST_DISPONIBLE → ST_FISICO−ST_PEDIDO en descargar_bod.py
- V37.3 (2026-05-27): Informe Stock Bodegas nuevo modulo en Inventario
- V37.2 (2026-05-26): fix mid-day run, ACTUALIZAR_TODO_AUTO.bat, tarea programada 18:00

---

## 2. URLs DE PRODUCCION

| Panel | URL |
|---|---|
| Panel Vendedor | https://ferreteria-oviedo.web.app |
| Panel Cliente | https://ferreteria-oviedo.web.app/panel-cliente |
| Panel Admin | https://ferreteria-oviedo.web.app/panel-admin |
| Firebase Console | https://console.firebase.google.com/project/ferreteria-oviedo |

---

## 3. RUTAS CRITICAS LOCALES

```
Proyecto activo:    D:\ferreteria-oviedo\
Git sync (solo):    D:\git-sync\  (NO es el proyecto — solo copia para git)
Carpeta archivados: D:\ferreteria-oviedo\_ARCHIVADOS\  (scripts obsoletos prefijo YYYYMMDD_)
Carpeta historico:  D:\ferreteria-oviedo\_HISTORICO\  (MDs historicos)
Bodegas XLSM:       D:\ferreteria-oviedo\BODEGAS\
Pipeline ventas:    D:\ferreteria-oviedo\VENTAS EL MANZANO\
Memory Claude:      C:\Users\Ferreteria Oviedo\.claude\projects\C--Users-Ferreteria-Oviedo\memory\
CLAUDE.md global:   C:\Users\Ferreteria Oviedo\.claude\CLAUDE.md
AGENTS.md:          D:\ferreteria-oviedo\AGENTS.md
MEMORY.md:          D:\ferreteria-oviedo\MEMORY.md  (este archivo)
ESTADO_PROYECTO.md: D:\ferreteria-oviedo\ESTADO_PROYECTO.md
```

REGLA: Nunca trabajar en D:\ferreteria-oviedo-github\ (no existe). Nunca en D:\git-sync\ directamente.

---

## 4. PIPELINE COMPLETO — ACTUALIZAR_TODO.bat

Unico punto de entrada del pipeline. No ejecutar pasos individuales fuera de este bat.

```
PASO 1   descargar_erp.py
         → actualizar.xlsx (precios + stock SSRS 2 bloques)
         → escribe: CATALOGO PRODUCTOS\actualizar.xlsx

PASO 1A  procesar-actualizacion.py
         → Datos.xlsx
         → CRITICO: escribe data/catalogo-dinamico.json (senal para main.py PASO 1)

PASO 1B  xlsx_a_csv.py → Datos.csv
         csv_a_json.py → Datos.json (~3.5MB, 6011 productos)

PASO 1C  leer_xlsm.py
         → xlsm-enrich.json (enriquecimiento: rut, sector, bodegaCorta, hora, razonSocial)
         REGLA: solo leer_xlsm.py genera este archivo — main.py lo consume, no lo genera

PASO 1C  descargar_bod.py (BODEGAS/)
         → data/bod-iem-registros.json (IEM=72, ~19 registros)
         → data/bod-rce-registros.json (RCE=55, ~10 registros)
         → data/bod-cem-registros.json (CEM=24, ~N registros)
         Si falla → continua sin detener el pipeline

PASO 1D  descargar_pedidos.py (BODEGAS/)  [reescrito V37.8]
         Fuente comprometidos: R_STOCK_PRODUCTOS.ST_PEDIDO (oficial ERP)
         Fuente detalle: M_DOCUMENTOS_DETALLE.CANTIDAD_PENDIENTE > 0, tipos NVM/VMN/VMP
         → data/pedidos-comprometidos.json ({cod:{pem,sem,cem,mem}})
         → data/pedidos-detalle.json ({cod:{bod:[{tipoDoc,numero,fechaEmision,fechaEntrega,atraso,cliente,rut,vendedor,cant}]}})
         Si falla → panel muestra Ped=0 hasta proximo intento

PASO 1E  descargar_despachos.py (BODEGAS/)  [NUEVO V37.8]
         Fuente: BVE/FVE, CANTIDAD_PENDIENTE > 0 (= Fís − Disp = despachos pendientes)
         → data/despachos-comprometidos.json ({cod:{pem,sem,cem,mem}})
         → data/despachos-detalle.json ({cod:{bod:[{tipoDoc,numero,fechaEmision,fechaEntrega,atraso,cliente,rut,vendedor,cant}]}})
         Si falla → panel muestra Dif sin drill-down hasta proximo intento

PASO 2   main.py --sin-deploy
         PASO 1: _catalogo_generado_hoy()? SI → leer_bodegas_desde_actualizar (3s)
                                           NO → descargar_bodegas.py HTTP (70s)
         PASO 2: descargar_ventas_erp.py incremental (dedup por Numero+Codigo)
         PASO 3: consolidar() — JOIN catalogo + ventas + mapa_cliente
         PASO 3.5: enriquecer_desde_xlsm() — agrega rut, sector, bodegaCorta, hora, razonSocial
         PASO 4: guardar_json() — genera todos los splits JSON de ventas
         → ventas-manzano.json (fallback, NECESARIO — 4 puntos del panel dependen de el)
         → ventas-manzano-YYYY.json (anual completo)
         → ventas-manzano-YYYY-MM.json (mensual, ~200KB)

PASO 3   Pregunta visibilidad precios (10s timeout, default N=ocultos)

PASO 4   firebase deploy --only hosting
```

SENAL ANTI-DOBLE-DESCARGA: procesar-actualizacion.py escribe catalogo-dinamico.json.
main.py lee esa senal. Sin la senal → descarga ERP de nuevo (~70s extra).
NO eliminar ni modificar esta logica.

---

## 5. BATS DISPONIBLES

| BAT | Funcion | Estado |
|---|---|---|
| ACTUALIZAR_TODO.bat | Pipeline completo — USAR ESTE | Activo |
| ACTUALIZAR_TODO_AUTO.bat | Pipeline completo sin interaccion (para tarea programada) | Activo V37.2 |
| PUBLICAR.bat | Solo firebase deploy | Activo |
| ACTUALIZAR_GITHUB.bat | Sync git | Activo |
| ACTUALIZAR_VENTAS.bat (VENTAS EL MANZANO/) | Solo ventas (llama main.py) | Activo |

BATs ARCHIVADOS en _ARCHIVADOS/ — NO ejecutar (llaman scripts inexistentes):
- 20260523_PREPARAR_Y_PUBLICAR.bat (llamaba exportar_consulta_ventas.py y preparar_datos.py)
- 20260523_ACTUALIZAR_AUTO.bat (llamaba preparar_datos.py --auto)

---

## 6. TAREAS PROGRAMADAS WINDOWS

| Nombre | Horario | BAT | Estado |
|---|---|---|---|
| FerreteriOviedo-Auto18 | Todos los dias 18:00 | ACTUALIZAR_TODO_AUTO.bat | Activo desde 27-05-2026 |

Configuracion Auto18:
- StartWhenAvailable=true (corre al encenderse si estaba apagado)
- Log: D:\ferreteria-oviedo\logs\auto_YYYYMMDD_HH00.log
- Primera ejecucion: 27-05-2026 18:00

Tarea OBSOLETA (ya no existe):
- "Ferreteria Oviedo Ventas 7PM" → llamaba ACTUALIZAR_AUTO.bat (archivado V36.9c)

---

## 7. BODEGAS EL MANZANO — IDs SQL Y CLASIFICACION

### Comerciales (ventas + NC + stock visible en calculos)
| Bodega | Nombre | IDBODEGA SQL | Notas |
|---|---|---|---|
| PEM | Patio El Manzano | — | bodegaCorta hardcodeada en ERP (no bug, no arreglar) |
| SEM | Sala El Manzano | — | ventas y NC |
| CEM | Calzada El Manzano | 24 | ventas y NC; tambien en descargar_bod.py |
| MEM | Mermas El Manzano | — | stock de merma; no ventas regulares |

### Auxiliares / Logisticas (stock visible, NO en calculos de ventas)
| Bodega | Nombre | IDBODEGA SQL | Notas |
|---|---|---|---|
| IEM | Ingreso El Manzano | 72 | DISP llega de proveedor o sucursal → pasa a PEM/SEM/CEM; TRANS va a llegar |
| RCE | Recepcion El Manzano | 55 | uso interno, doble filtro proveedor |
| TEM | Transito El Manzano | — | DISP llega de proveedor; TRANS va a llegar |
| CD | Centro de Distribucion | — | DISP disponible para abastecer; TRANS llegara |

IDBODEGA confirmados desde P_BODEGAS DB viva (2026-05-25): IEM=72, RCE=55, CEM=24.
Bodegas ELIMINADAS: CAL.

### Regla critica del filtro
- _vadmBodSel afecta simultaneamente ventas Y stock
- Las 8 bodegas deben estar siempre visibles en el dropdown
- Solo PEM/SEM/CEM tienen ventas reales en ERP

### BODSTOCK — 8 bodegas, no reducir
```javascript
var BODSTOCK = {
  PEM:'pem', SEM:'sem', CEM:'cem', RCE:'rce',
  MEM:'mem', TEM:'tem', IEM:'iem', CD:'cd'
}
```
Antes tenia solo 5. Corregido V36.6. No revertir.

### SSRS — bloques de descarga
- BLOQUE 1 (solo DISP): SEM, CEM, RCE, MEM
- BLOQUE 2 (DISP+TRANS): PEM, TEM, CD, IEM

---

## 8. CONEXION SQL SERVER — descargar_bod.py

| Campo | Valor |
|---|---|
| IP | 200.6.118.110 |
| Base de datos | Foviedo |
| Driver | pyodbc |
| Credenciales | D:\ferreteria-oviedo\credenciales_db.ini seccion [DB] |

NUNCA mostrar contenido de credenciales_db.ini. NUNCA subir a git.

Query: misma logica que VBA de BOD_RCE.xlsm, parametrizada por IDBODEGA.
REGLA CRITICA subquery ULT:
- Debe incluir WHERE IDBODEGA=? ANTES del GROUP BY
- JOIN debe usar FECHA_EMISION=ULT.ULTIMA_FECHA, NO IDDOCUMENTO
- IDDOCUMENTO es tipo de documento (GRT=17), no ID unico de movimiento
- cursor.execute recibe (idbodega, idbodega): primer param para WHERE en ULT, segundo para WHERE principal
- Verificado 2026-05-25: codigo 4422 IEM paso de 931 dias a 10 dias con el fix

Para agregar una bodega nueva: anadir entrada en lista BODEGAS de descargar_bod.py con su IDBODEGA.

---

## 9. VENDEDORES ERP → GMAIL

La tabla de mapeo VEN_CONFIG esta en panel-admin.html (variable JS interna).
No se duplica aqui por seguridad (revela codigos internos del ERP).
Para consultarla: buscar VEN_CONFIG en panel-admin.html.
Solo el admin puede ver la seccion de mapeo de vendedores (data-coop-hide).

---

## 10. SCRIPTS PYTHON — QUE HACE CADA UNO

| Script | Ubicacion | Genera | Notas |
|---|---|---|---|
| descargar_erp.py | raiz | actualizar.xlsx | SSRS 2 bloques; precios VisorRS |
| procesar-actualizacion.py | raiz | Datos.xlsx + catalogo-dinamico.json | catalogo-dinamico.json es senal para main.py |
| xlsx_a_csv.py | raiz | Datos.csv | Lee Datos.xlsx |
| csv_a_json.py | raiz | Datos.json | Lee Datos.csv; mapa JSON incluye iem_trans, tem_trans |
| leer_xlsm.py | VENTAS EL MANZANO/ | xlsm-enrich.json | Join por numero; bodegaCorta real desde XLSM |
| descargar_bod.py | BODEGAS/ | bod-iem/rce/cem-registros.json | SQL Server directo; diasAntiguedad calculado en Python |
| main.py | VENTAS EL MANZANO/ | ventas-manzano*.json | Pipeline ventas completo |
| descargar_ventas_erp.py | VENTAS EL MANZANO/ | ventas_erp_producto_YYYYMMDD.xlsx | Incremental; dedup por (Numero, Codigo) |

REGLA bod-XLSM: nombre JSON = bodega real en col A del XLSM, NO en nombre del archivo fisico.
- BOD_RCE.xlsm (nombre fisico) contiene bodega IEM (col A) → JSON: bod-iem-registros.json
- Si col A cambia a RCE → entonces usar bod-rce-registros.json

---

## 11. JSONs EN data/ — FUENTE Y ROL

| Archivo | Fuente | Tamano | Rol |
|---|---|---|---|
| Datos.json | csv_a_json.py | ~3.5MB | Catalogo productos — cargado una vez, cacheado en sesion JS |
| catalogo-dinamico.json | procesar-actualizacion.py | ~350KB | Senal Python (mtime) + fallback panel (siempre 404 → usa Datos.json) |
| ventas-manzano.json | main.py | variable | FALLBACK OBLIGATORIO — 4 puntos del panel dependen de el. NO eliminar |
| ventas-manzano-YYYY.json | main.py | 2-18MB | Anual completo — carga al seleccionar año |
| ventas-manzano-YYYY-MM.json | main.py | ~200KB | Mensual — carga por defecto |
| bod-iem-registros.json | descargar_bod.py | pequeno | ~19 registros IEM |
| bod-rce-registros.json | descargar_bod.py | pequeno | ~10 registros RCE |
| bod-cem-registros.json | descargar_bod.py | pequeno | registros CEM |
| xlsm-enrich.json | leer_xlsm.py | variable | Enriquecimiento ventas (rut, sector, hora, razonSocial) |

DOBLE ROL de catalogo-dinamico.json:
1. Python: procesar-actualizacion.py lo escribe en data/ → main.py lee su mtime como senal
2. Panel: busca en /CATALOGO%20PRODUCTOS/catalogo-dinamico.json → siempre 404 → fallback a Datos.json
NO intentar mover catalogo-dinamico.json a CATALOGO PRODUCTOS/ — el 404 es comportamiento correcto.

---

## 12. VARIABLES JS GLOBALES CLAVE — no renombrar

```
_vadmLineas       Array registros de ventas {codigo, fecha, valorNeto, cantidad, marca, periodo, bodegaCorta, hora, razonSocial}
_vadmStockMap     Mapa cod → {pem, sem, cem, mem, stock, marca, desc, costo, precio, pem_trans, cd, cd_trans, rce, tem, iem, iem_trans, tem_trans}
_vadmBodSel       Array de bodegas seleccionadas ([] = todas)
_vadmVendSel      Array de vendedores seleccionados
_vadmSSProds      Cache ultimo render sobre-stock — usan email, Excel, Outlook
_vadmBRDatos      Cache ultimo render baja rotacion — idem
_vadmAnioSel      Ano seleccionado ('' = mes actual)
_vadmSSMesesMin   Cobertura minima para sobre-stock (default 12)
```

---

## 13. FUNCIONES JS CLAVE — no renombrar ni cambiar firma

```
vadmCargarLineas()          Carga ventas JSON segun _vadmAnioSel
_vadmCargarStockMap(cb)     Carga Datos.json → _vadmStockMap; cachea en sesion — NO llamar si ya existe
vadmRenderSobreStock()      Render sobre-stock, cobertura en meses
vadmSSMarcaClick(el)        Toggle filtro marca — usa data-marca, NUNCA string en onclick
vadmRenderBajaRot()         Render baja rotacion + auto-reload si rango > datos cargados
vadmFiltrarBajaRot()        Re-filtra _vadmBRDatos sin recomputar ABC
vadmRenderQuiebre()         Render stock quiebre con ABC + Rot.30/60/90d — requiere _vadmStockMap cargado
vadmRenderImpacto()         Volumen vs Precio: Q y precio prom. por vendedor en 2 periodos
vadmRenderNC()              NC por vendedor desde _vadmLineas — detecta por r.documento ("nota"/"cred")
vadmRenderBodFem()          Carga y muestra bod-iem/rce/cem-registros.json segun selector bfFuente
vadmFiltrarBodFem()         Re-filtra _bfDatos sin recargar JSON
vadmBuscarStock()           Filtra _vadmStockMap en memoria para Consulta de Stock
vadmRenderStockConsulta()   Ficha detalle de un producto (8 bodegas, Disp/Trans/Fisico/Valor)
venAdmParseFecha(s)         Parsea fecha DD/MM/YYYY → timestamp ms — utility global, no cambiar firma
venAdmFmt(n)                Formatea numero como X.XXX CLP — utility global, no cambiar firma
```

---

## 14. BODSTOCK — 8 BODEGAS, NO REDUCIR

Ver seccion 7. Mapa completo: PEM/SEM/CEM/RCE/MEM/TEM/IEM/CD.
Antes tenia solo 5 bodegas. Corregido V36.6. No revertir ni reducir.

---

## 15. REGLA CRITICA DE PRECIOS

```javascript
window._mostrarPrecio = false  // SIEMPRE false por defecto en panel-cliente.html
```

Se activa solo si el usuario elige S en el prompt del bat (visibilidad precios).
El bat actualiza un config en Firebase Hosting.
NUNCA cambiar el default a true.

---

## 16. SEGURIDAD FIREBASE

### Headers Hosting (firebase.json)
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: scripts/styles/fonts/img/connect srcs definidos
```

### Reglas Firestore (resumen)
| Coleccion | Admin | Cooperador | Vendedor | Cliente | Sin auth |
|---|---|---|---|---|---|
| users (read) | SI | lista | propio | propio | NO |
| users (write) | SI | NO | propio* | propio* | NO |
| config (read) | SI | SI | SI | SI | sessionConfig/registroControl |
| config (write) | SI | NO | NO | NO | NO |
| cotizaciones | SI | read | read+write | read+write | NO |
| auditLog (read) | SI | NO | NO | NO | NO |
| auditLog (write) | SI | SI | SI | SI | NO |
| notificaciones (create) | SI | SI | SI | SI (autenticados) | NO |
| sesiones_activas | SI | read | read | read | NO |
| promos (read) | SI | SI | SI | SI | publico |
| promos (write) | SI | NO | NO | NO | NO |

*Solo campos no sensibles — no puede cambiar role/estado/registroAprobado

### Hosting ignore — directorios bloqueados
VENTAS EL MANZANO/, backups/, .claude/, *.ini, *.xlsm, *.mp4

### Device Binding (autenticacion admin)
- Cada navegador genera ID unico en localStorage (clave: ov_device_id)
- Lista autorizada: config/adminDispositivos.lista en Firestore
- Primer dispositivo se registra automaticamente
- Dispositivo nuevo: muestra ID en pantalla de login para copiar y agregar
- Administrar: Panel Admin → URL / Conexion → Dispositivos autorizados

### Rate Limiting (client-side — todos los paneles)
- 5 intentos fallidos → bloqueo 10 minutos en ese navegador
| Panel | Funciones | Keys localStorage |
|---|---|---|
| Admin | _adminCheckBloqueo() | _adm_bl, _adm_at |
| Cliente | _cliCheckBloqueo() | _cli_bl, _cli_int |
| Vendedor | _vendCheckBloqueo() | _vend_bl, _vend_int |

Firebase Auth tiene rate limiting adicional server-side (auth/too-many-requests).

### Audit Log (Firestore coleccion auditLog)
Solo admin puede leer. Tipos de eventos:
- login_admin_fallido · admin_dispositivo_registrado_auto · admin_dispositivo_no_autorizado
- cooperador_accion · cooperador_intento_bloqueado · cooperador_devtools

### Rol Cooperador
Ve datos operacionales (ventas, inventario, usuarios, cotizaciones) pero NO puede:
- Guardar configuraciones · aprobar usuarios · cambiar roles · eliminar datos
- Exportar costos/precios socio · agregar dispositivos autorizados
Badge visible: "Modo Cooperador" en ambar. Deteccion de DevTools (Chrome/Edge).
Firestore Rules bloquean en servidor aunque manipule el JS del cliente.

### Procedimiento de emergencia
1. Firebase Console → Firestore → auditLog → registros recientes
2. Panel Admin → Usuarios → Bloquear usuario sospechoso
3. Cambiar contrasena en Firebase Console → Authentication
4. Limpiar config/adminDispositivos y re-registrar solo equipos propios

---

## 17. REGLAS DEL PROYECTO — NO NEGOCIABLES

- Cambios minimos — no refactorizar, no agregar abstracciones
- Sin dependencias externas sin autorizacion
- Sin renombrar funciones publicas
- Python: sin tildes, sin emojis, solo ASCII cp1252
- BATs: guardar en ANSI cp1252
- Costo cero — plan Spark gratuito Firebase (JSON estaticos en Hosting, no Firestore para ventas)
- Claude define arquitectura / Codex implementa
- Un prompt = una funcion tocada
- Datos reales siempre — nunca hardcode de valores ni datos de ejemplo
- Nunca subir datos de ejemplo
- No pedir confirmacion antes de ejecutar si el usuario dijo "ejecuta"
- No usar cmd /c bat > NUL desde bash (abre shell interactivo) → usar PowerShell

---

## 18. ARCHIVOS ABSOLUTAMENTE INTOCABLES

| Archivo | Motivo |
|---|---|
| firebase-config.js | Configuracion SDK Firebase compartida — no modificar nunca desde panel HTML |
| credenciales_erp.ini | Credenciales ERP — nunca tocar, nunca subir a git |
| credenciales_db.ini | Credenciales SQL Server — nunca tocar, nunca subir |
| serviceAccountKey.json | .gitignore lo bloquea; nunca subir |
| venAdmParseFecha() | Utility global — no cambiar firma ni comportamiento |
| venAdmFmt() | Utility global — no cambiar firma |
| window._mostrarPrecio | Default SIEMPRE false en panel-cliente.html |
| D:\git-sync\ | No trabajar ahi directamente |
| _catalogo_generado_hoy() | No revertir a _actualizar_xlsx_es_hoy() (eliminada V36.5) |
| xlsm-enrich.json | Solo leer_xlsm.py lo genera — main.py lo consume |
| ventas-manzano.json | Fallback del panel en 4 puntos — NO eliminar ni bloquear generacion |

---

## 19. MAPA DE DEPENDENCIAS CRITICAS

| Si tocas... | Debes verificar tambien... |
|---|---|
| vadmSubTab(id) | Que id este en vadmReRenderTabActivo — si no, el tab no se actualiza al cambiar filtros |
| vadmRenderSobreStock() | _vadmSSProds — lo usan email, Excel y Outlook; si cambia estructura rompe los 3 |
| vadmRenderBajaRot() | _vadmBRDatos + _vadmLineas cubre el rango de fechas |
| vadmRenderQuiebre() | _vadmStockMap debe estar cargado — llamar _vadmCargarStockMap(cb) si no |
| _vadmCargarStockMap() | Cacheada en sesion — NO llamar si ya existe con datos |
| vadmSSMarcaClick(el) | Usa data-marca del HTML — NUNCA string en onclick |
| vadmRenderBodFem() | Selector bfFuente (Todas/IEM/RCE/CEM) + Promise.all para cargar JSONs |
| Sidebar HTML | Verificar que grupos siguen colapsando correctamente |
| onclick="" en botones | NUNCA usar JSON.stringify — rompe con comillas en nombres |
| venAdmParseFecha() | Usada en TODOS los tabs de ventas — no modificar |
| leer_xlsm.py | Debe seguir generando xlsm-enrich.json al final del loop |
| enriquecer_desde_xlsm() | Debe correr DESPUES de consolidar() y ANTES de guardar_json() |
| _catalogo_generado_hoy() | Verifica catalogo-dinamico.json mtime — no revertir |
| descargar_bod.py | Subquery ULT debe tener WHERE IDBODEGA=? antes del GROUP BY |

---

## 20. TABS VERIFICADOS DEL PANEL-ADMIN

Deben seguir funcionando tras cualquier cambio:

```
ERP tabs:    hora · topMarcas · comparativa · vendrank · marcavend · clientes
             tipodoc · facturacion · quiebre · sobrestock · transito · merma
             rankingmarca · estaciones · bajrot · pagoanalisis · pagorankings
             pagotemporal · entrefechas · arbol · arboltabla · arbolheat · sector
             stockconsulta (V37.1)

XLSM tabs:  nc · marcavend2 · preciodiff · mem

Stubs:      impacto

Analisis bodegas: analisis (tab-analisis — IEM/RCE/CEM con selector bfFuente)
```

TABS ELIMINADOS (no recrear): vvsstock (eliminado V35.0)
NAVEGACION REAL: showTab → vadmGrupo → vadmSubTab. NO existe adminShowTab().

---

## 21. UBICACION DE LOS 4 MD ACTIVOS

```
D:\ferreteria-oviedo\
├── AGENTS.md          ← instrucciones agente + historial versiones + dependencias
├── MEMORY.md          ← referencia consolidada (este archivo)
├── ESTADO_PROYECTO.md ← snapshot estado actual para entrega / handoff
└── _HISTORICO\        ← MDs anteriores archivados (no se borran, solo referencia)
    ├── CALCULOS.md
    ├── SEGURIDAD.md
    ├── MANUAL_MAESTRO.md
    ├── MANUAL_VENTAS_LOCAL.md
    ├── project_archivo.md
    └── feedback_reglas.md
```

REGLA: Si una sesion futura necesita un dato → buscar en AGENTS.md o MEMORY.md.
No depender de _HISTORICO/ para operacion.

---

## 22. CHECKLIST POST-CAMBIO

Antes de entregar cualquier cambio:

```
[ ] Funcion modificada recibe los mismos parametros de entrada
[ ] Variables globales que usaba siguen existiendo con el mismo nombre
[ ] El tab que la invoca sigue en vadmReRenderTabActivo
[ ] El filtro _vadmBodSel sigue afectando el resultado (stock Y ventas)
[ ] No se hardcodeo ningun valor que deba venir de datos reales
[ ] No se renombro ninguna funcion publica
[ ] window._mostrarPrecio = false sigue siendo default en panel-cliente.html
[ ] xlsm-enrich.json sigue siendo generado por leer_xlsm.py (no main.py)
[ ] _catalogo_generado_hoy() no fue revertida a _actualizar_xlsx_es_hoy()
[ ] ventas-manzano.json sigue siendo generado por guardar_json() en main.py
[ ] Subquery ULT en descargar_bod.py tiene WHERE IDBODEGA=? antes del GROUP BY
[ ] Deploy ejecutado y "Deploy cierre sesion" en AGENTS.md actualizado
[ ] ACTUALIZAR_GITHUB.bat ejecutado con descripcion del cambio
```

---

## CALCULOS — METODOLOGIA (referencia rapida)

### Dias habiles
- Dias habiles = Lun-Sab que NO sean feriados chilenos
- Sabado cuenta como habil (hay ventas, menor flujo)
- Funcion: _vadmDiasHabiles(desde, hasta) — nunca retorna 0
- _vadmDiasHabilesN(n) retrocede n dias → ventana [hoy-n, hoy] = n+1 dias calendario

### Velocidad de venta
```
velocidad_dh = unidades_vendidas_periodo / dias_habiles_periodo
```
Expresada en unidades por dia habil (u/dh). Horizontes: 30dh (~26dh), 60dh (~49dh), 90dh (~75dh).

### Cobertura de stock (Rot.30d / 60d / 90d)
```
cobertura_dh = stock_actual / velocidad_dh
```

Semaforos:
| Estado | Cobertura | Color |
|---|---|---|
| Quiebre | stock = 0 | rojo |
| Critico | < 30 dh | rojo |
| Alerta | 30-90 dh | amarillo |
| OK | > 90 dh | verde |
| Sin datos | sin ventas | negro |

### ABC Pareto (todos los modulos)
- A: top 80% del valor de ventas — maxima prioridad
- B: siguiente 15% (81-95%) — prioridad media
- C: siguiente 5% (96-100%) — prioridad baja
- D: sin ventas en el periodo

### Sobre-stock (cobertura en meses)
```
velMes = qty_vendida_periodo / nMeses_cargados
cobMeses = stock / velMes   (si velMes=0 → cobMeses=999 = Sin venta)
```
Filtro de entrada: _vadmSSMesesMin (default 12). Colores: rojo=999 · naranja>=24m · amarillo>=12m.

### Feriados Chile (calculados automaticamente)
Fijos: 1-ene, 1-may, 21-may, 20-jun, 16-jul, 15-ago, 18-sep, 19-sep, 12-oct, 1-nov, 2-nov, 8-dic, 25-dic.
Moviles: Viernes Santo (Pascua-2), Sabado Santo (Pascua-1) — calculados con algoritmo Butcher.

---

## CARPETA _ARCHIVO — MAPA

Creada 2026-05-20. Contiene todo fuera del flujo activo.
Antes de crear cualquier script nuevo → revisar aqui si ya existe algo reutilizable.

```
D:\ferreteria-oviedo\_ARCHIVO\
├── 01_PROYECTOS_SEPARADOS\
│   ├── APP-INVENTARIO\          (app web toma inventario fisico)
│   ├── PANEL ADMIN COMPRAS\     (panel compras oviedo-compras-admin.web.app)
│   └── SOLO EJEMPLO\            (PDFs, XLSX, PPTX referencia)
├── 02_DOCUMENTACION_HISTORICA\
│   ├── FLUJOS .MD\              (MDs tecnicos antiguos)
│   ├── ESTADO_PROYECTO_V33_6_18052026.md
│   └── varios MANUAL_*, SEGURIDAD_CREDENCIALES.md, codex_fix_*.md
├── 03_DATOS_HISTORICOS\
│   ├── catalogo_backups_xlsx\   (snapshots pipeline catalogo mayo 2026)
│   ├── reportes_bodegas_erp\    (CSV+XLSX bodegas fechas anteriores)
│   └── ventas_erp_xlsx\         (Excel ventas por producto y cliente anteriores)
├── 04_SCRIPTS_AUXILIARES\       (scripts Python no en pipeline activo)
├── 05_TUTORIALES_XLSM_ERP\      (PRECIOS/RANKING/VENTAS .mp4 + .xlsm — solo consulta)
└── 07_BATS_UTILIDADES\          (BACKUP_DIARIO.bat — robocopy a D:\ARCHIVOS AG 2025\backups\)
```

REGLA: Si se necesita un archivo de _ARCHIVO → moverlo (Move-Item), no copiar.

---

## ROLES DE USUARIO

| Rol | Panel Admin | Panel Vendedor | Panel Cliente |
|---|---|---|---|
| admin | Completo | Completo | Completo |
| cooperador | Solo lectura operacional | Completo | Completo |
| vendedor | NO | Completo | Completo |
| cliente | NO | NO | Completo |

Solo admin puede cambiar roles. Nadie puede auto-asignarse admin.
Asignar: Panel Admin → Usuarios → selector rol → confirmar (cambio inmediato).

---

## FLUJO LOGIN USUARIOS — INVARIANTES CRITICOS (V36.9k)

| Situacion | Comportamiento correcto |
|---|---|
| Usuario Google nuevo (!snap.exists) | Crear doc en /users con creadoPor:'google' — NUNCA signOut sin crear |
| Usuario pendiente (registroAprobado=false) | Mensaje "pendiente", code:'pendiente' — NUNCA code:'noregistrado' |
| Registro deshabilitado (registroClienteHabilitado=false) | Bloquear, code:'noregistrado' — unico caso valido |
| Usuario bloqueado (estado='bloqueado') | signOut + mensaje claro |

Funciones criticas — nunca romper comportamiento visible:
- doLoginGoogleCli() · doRegistroCli() · doLoginAuth() (panel-cliente.html)
- adminAprobarFS() (panel-admin.html)

Reparar usuarios huerfanos (Auth sin doc Firestore):
```powershell
python D:\ferreteria-oviedo\diagnostico_huerfanos.py          # diagnostico
python D:\ferreteria-oviedo\diagnostico_huerfanos.py --fix    # crea docs pendientes
```

---

*MEMORY.md generado 2026-05-26 · Consolidado desde AGENTS.md + docs/ (movidos a _HISTORICO/).*
*Para actualizar: editar directamente este archivo al cierre de cada sesion.*
