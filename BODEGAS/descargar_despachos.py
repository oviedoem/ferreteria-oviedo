"""
descargar_despachos.py
Genera dos JSONs desde SQL Server para el módulo Informe Stock — columna Dif:

  data/despachos-comprometidos.json
      {codigoTecnico: {pem: N, sem: N, cem: N, mem: N}}
      Fuente: SUM(CANTIDAD_PENDIENTE) de BVE/FVE en M_DOCUMENTOS_DETALLE.
      Dif = Fís − Disp = unidades facturadas/boleteadas aún sin despacho físico.

  data/despachos-detalle.json
      {codigoTecnico: {bod: [...docs]}}
      Drill-down por documento: folio, tipo, fecha, cliente, RUT, vendedor, cant.
      Estructura idéntica a pedidos-detalle.json para reutilizar el modal del panel.

Tipos de doc incluidos: BVE (Boleta Venta Electronica), FVE (Factura Venta Electronica).
Estos documentos reducen ST_PEDIDO pero NO ST_FISICO hasta el despacho real (GME/GCE).
CANTIDAD_PENDIENTE > 0 identifica exactamente los despachos pendientes.
Ver sección FLUJO STOCK ERP en AGENTS.md.
"""

import json
import datetime
import configparser
import sys
from pathlib import Path
from collections import defaultdict

try:
    import pyodbc
except ImportError:
    print('[ERROR] pyodbc no instalado. Ejecuta: pip install pyodbc')
    sys.exit(1)

BASE_DIR  = Path(r"E:\ferreteria-oviedo")
DATA_DIR  = BASE_DIR / "data"
_token_file = DATA_DIR / '.token-actual'
if _token_file.exists():
    DATA_DIR = DATA_DIR / _token_file.read_text(encoding='utf-8').strip()
CRED_FILE = BASE_DIR / "credenciales_db.ini"
ENC_FILE  = Path(__file__).parent.parent.parent / "config" / "credenciales_db.enc"

# Bodegas comerciales para Informe Stock
BODEGAS_OBJETIVO = ['PEM', 'SEM', 'CEM', 'MEM']

# Período de búsqueda para recepciones pendientes (2 meses = mismo criterio que SSRS)
MESES_RECEPCIONES = 2

# Tipos de documento que reducen Disponible pero aún no impactan Físico.
# BVE/FVE: factura o boleta emitida → CANTIDAD_PENDIENTE > 0 → despacho aún pendiente.
# EXCLUIDOS: NVM/VMN/VMP (pedido), GME/GCE (ya despachado — reduce Físico).
DOC_TIPOS_DESPACHO = ('BVE', 'FVE')

# Período de búsqueda para despachos-detalle (últimos N meses)
MESES_HISTORICO = 12

# Período para despachos-comprometidos (totales).
# JustWeb no zeroa CANTIDAD_PENDIENTE al emitir GDE vinculada al FVE/BVE,
# por lo que documentos viejos permanecen con CANTIDAD_PENDIENTE > 0 indefinidamente.
# Filtro de 3 meses excluye esos fantasmas sin afectar despachos reales recientes.
MESES_COMPROMETIDOS = 3

# ── Queries ──────────────────────────────────────────────────────────────────

SQL_IDBODEGAS = """
SELECT IDBODEGA, SIMBOLO_BODEGA
FROM Foviedo.dbo.P_BODEGAS
WHERE SIMBOLO_BODEGA IN ('PEM','SEM','CEM','MEM')
"""

# Totales de despachos pendientes — SUM(CANTIDAD_PENDIENTE) por producto/bodega.
# No hay campo equivalente a ST_PEDIDO en R_STOCK_PRODUCTOS para despachos,
# por lo que sumamos directamente desde M_DOCUMENTOS_DETALLE.
# Filtro EXISTS: solo incluye documentos que contienen al menos 1 producto real
# (no servicio/flete) con CANTIDAD_PENDIENTE > 0. Documentos donde el UNICO
# item pendiente es FLETE VENTA / FLETE FIJO / DESPACHO quedan excluidos.
# Si el doc tiene productos reales + flete → se incluye todo (flete incluido).
SQL_COMPROMETIDOS = """
SELECT
    E.CODIGO_TECNICO,
    B.SIMBOLO_BODEGA,
    SUM(CAST(ISNULL(E.CANTIDAD_PENDIENTE, 0) AS INT)) AS DESPACHO_PEND
FROM Foviedo.dbo.M_DOCUMENTOS_DETALLE E
INNER JOIN Foviedo.dbo.M_DOCUMENTOS MD ON MD.IDDOCUMENTO = E.IDDOCUMENTO
INNER JOIN Foviedo.dbo.P_BODEGAS B     ON B.IDBODEGA     = E.IDBODEGA
WHERE E.IDBODEGA IN ({placeholders})
  AND E.IDSUCURSAL = '04'
  AND MD.DOC IN ({doc_placeholders})
  AND ISNULL(E.CANTIDAD_PENDIENTE, 0) > 0
  AND E.FECHA_EMISION >= ?
  AND EXISTS (
      SELECT 1 FROM Foviedo.dbo.M_DOCUMENTOS_DETALLE rp
      INNER JOIN Foviedo.dbo.M_DOCUMENTOS md2 ON md2.IDDOCUMENTO = rp.IDDOCUMENTO
      WHERE rp.IDDOCUMENTO = E.IDDOCUMENTO
        AND rp.IDNUMERO    = E.IDNUMERO
        AND rp.IDSUCURSAL  = E.IDSUCURSAL
        AND ISNULL(rp.CANTIDAD_PENDIENTE, 0) > 0
        AND md2.DOC IN ('BVE','FVE')
        AND rp.CODIGO_TECNICO NOT IN ('FLETE VENTA','FLETE FIJO','DESPACHO')
        AND rp.CODIGO_TECNICO NOT LIKE 'FLETE%'
        AND rp.CODIGO_TECNICO NOT LIKE 'DESPACHO%'
  )
GROUP BY E.CODIGO_TECNICO, B.SIMBOLO_BODEGA
"""

# Detalle de documentos (para drill-down modal Dif en el panel).
# CTE agrega CANTIDAD_PENDIENTE por (doc, producto, bodega) — mismo patrón que pedidos.
# Vendedor: M_DOCUMENTOS_ENCABEZADO.IDVENDEDOR (string, ej: 'alexis') — sin JOIN P_VENDEDORES.
# Cliente: M_ENTIDADES.RAZON_SOCIAL vía ent.IDENTIDAD = CAST(enc.IDENTIDAD AS NVARCHAR(20)).
# FECHA_ENTREGA = año 1900 → Python la trata como sin fecha.
SQL_DETALLE = """
WITH agg AS (
    SELECT
        E.IDDOCUMENTO,
        E.IDNUMERO,
        E.IDSUCURSAL,
        E.CODIGO_TECNICO,
        E.IDBODEGA,
        SUM(CAST(ISNULL(E.CANTIDAD_PENDIENTE, 0) AS INT)) AS CANT_PEND,
        MIN(CAST(E.FECHA_EMISION AS DATE))                AS FECHA_EM
    FROM Foviedo.dbo.M_DOCUMENTOS_DETALLE E
    INNER JOIN Foviedo.dbo.M_DOCUMENTOS MD2
        ON MD2.IDDOCUMENTO = E.IDDOCUMENTO
    WHERE E.IDBODEGA IN ({ph_bodegas})
      AND E.IDSUCURSAL = '04'
      AND MD2.DOC IN ({ph_docs})
      AND ISNULL(E.CANTIDAD_PENDIENTE, 0) > 0
      AND E.FECHA_EMISION >= ?
      AND EXISTS (
          SELECT 1 FROM Foviedo.dbo.M_DOCUMENTOS_DETALLE rp
          INNER JOIN Foviedo.dbo.M_DOCUMENTOS md2x ON md2x.IDDOCUMENTO = rp.IDDOCUMENTO
          WHERE rp.IDDOCUMENTO = E.IDDOCUMENTO
            AND rp.IDNUMERO    = E.IDNUMERO
            AND rp.IDSUCURSAL  = E.IDSUCURSAL
            AND ISNULL(rp.CANTIDAD_PENDIENTE, 0) > 0
            AND md2x.DOC IN ('BVE','FVE')
            AND rp.CODIGO_TECNICO NOT IN ('FLETE VENTA','FLETE FIJO','DESPACHO')
            AND rp.CODIGO_TECNICO NOT LIKE 'FLETE%'
            AND rp.CODIGO_TECNICO NOT LIKE 'DESPACHO%'
      )
    GROUP BY E.IDDOCUMENTO, E.IDNUMERO, E.IDSUCURSAL,
             E.CODIGO_TECNICO, E.IDBODEGA
)
SELECT
    D.SIMBOLO_BODEGA                                                              AS BODEGA,
    agg.CODIGO_TECNICO,
    MD.DOC                                                                        AS TIPO_DOC,
    LTRIM(RTRIM(ISNULL(MD.DOCUMENTO, MD.DOC)))                                   AS TIPO_LABEL,
    ISNULL(CAST(enc.NUMERO AS NVARCHAR(20)), CAST(agg.IDNUMERO AS NVARCHAR(20))) AS FOLIO,
    agg.FECHA_EM                                                                  AS FECHA_EMISION,
    enc.FECHA_ENTREGA,
    agg.CANT_PEND,
    agg.IDNUMERO                                                                  AS ID_DOC_REAL,
    ISNULL(enc.IDVENDEDOR, '')                                                   AS VENDEDOR,
    ISNULL(enc.ESTADO, '')                                                        AS ESTADO,
    ISNULL(ent.RAZON_SOCIAL, '')                                                 AS CLIENTE,
    ISNULL(ent.RUT, '')                                                           AS RUT_ENT,
    ISNULL(ent.DIGITO, '')                                                        AS DIGITO_ENT
FROM agg
INNER JOIN Foviedo.dbo.M_DOCUMENTOS MD
    ON MD.IDDOCUMENTO = agg.IDDOCUMENTO
INNER JOIN Foviedo.dbo.P_BODEGAS D
    ON D.IDBODEGA = agg.IDBODEGA
LEFT JOIN Foviedo.dbo.M_DOCUMENTOS_ENCABEZADO enc
    ON  enc.IDDOCUMENTO = agg.IDDOCUMENTO
    AND enc.IDNUMERO    = agg.IDNUMERO
    AND enc.IDSUCURSAL  = agg.IDSUCURSAL
LEFT JOIN Foviedo.dbo.M_ENTIDADES ent
    ON ent.IDENTIDAD = CAST(enc.IDENTIDAD AS NVARCHAR(20))
WHERE (enc.ESTADO IS NULL OR enc.ESTADO <> 'N')
ORDER BY agg.CODIGO_TECNICO, agg.IDBODEGA, agg.FECHA_EM DESC
"""


# IDs de documentos de recepción (GRC=15, GRI=16, GRT=17/307/701/709/712/713, GIB=709)
# Fuente: IDS_SQL_PANEL_ADMIN.md sección 3F
IDDOC_RECEPCION = (15, 16, 17, 307, 701, 709, 712, 713)

SQL_RECEPCIONES = """
SELECT
    MD.DOC                                                                        AS TIPO_DOC,
    LTRIM(RTRIM(ISNULL(MD.DOCUMENTO, MD.DOC)))                                   AS TIPO_LABEL,
    ISNULL(CAST(enc.NUMERO AS NVARCHAR(20)), CAST(E.IDNUMERO AS NVARCHAR(20)))   AS FOLIO,
    B.SIMBOLO_BODEGA                                                              AS BODEGA,
    MIN(CAST(E.FECHA_EMISION AS DATE))                                            AS FECHA_EM,
    enc.FECHA_ENTREGA,
    ISNULL(enc.IDVENDEDOR, '')                                                   AS RESPONSABLE,
    ISNULL(ent.RAZON_SOCIAL, '')                                                 AS ENTIDAD,
    SUM(CAST(ISNULL(E.CANTIDAD_PENDIENTE, 0) AS INT))                            AS CANT_PEND
FROM Foviedo.dbo.M_DOCUMENTOS_DETALLE E
INNER JOIN Foviedo.dbo.M_DOCUMENTOS MD
    ON MD.IDDOCUMENTO = E.IDDOCUMENTO
INNER JOIN Foviedo.dbo.P_BODEGAS B
    ON B.IDBODEGA = E.IDBODEGA
LEFT JOIN Foviedo.dbo.M_DOCUMENTOS_ENCABEZADO enc
    ON  enc.IDDOCUMENTO = E.IDDOCUMENTO
    AND enc.IDNUMERO    = E.IDNUMERO
    AND enc.IDSUCURSAL  = E.IDSUCURSAL
LEFT JOIN Foviedo.dbo.M_ENTIDADES ent
    ON ent.IDENTIDAD = CAST(enc.IDENTIDAD AS NVARCHAR(20))
WHERE E.IDSUCURSAL IN ('04', '08')
  AND MD.IDDOCUMENTO IN ({ph_docs})
  AND ISNULL(E.CANTIDAD_PENDIENTE, 0) > 0
  AND E.FECHA_EMISION >= ?
GROUP BY MD.DOC, MD.DOCUMENTO, E.IDNUMERO, enc.NUMERO, B.SIMBOLO_BODEGA,
         enc.FECHA_ENTREGA, enc.IDVENDEDOR, ent.RAZON_SOCIAL
HAVING SUM(CAST(ISNULL(E.CANTIDAD_PENDIENTE, 0) AS INT)) > 0
ORDER BY MIN(CAST(E.FECHA_EMISION AS DATE)) DESC
"""

# Lista de despachos pendientes (BVE/FVE) en formato panel — fuente: SQL local
SQL_LISTA_DESPACHOS = """
SELECT DISTINCT
    MD.DOC                                                                        AS TIPO_DOC,
    LTRIM(RTRIM(ISNULL(MD.DOCUMENTO, MD.DOC)))                                   AS TIPO_LABEL,
    ISNULL(CAST(enc.NUMERO AS NVARCHAR(20)), CAST(E.IDNUMERO AS NVARCHAR(20)))   AS FOLIO,
    B.SIMBOLO_BODEGA                                                              AS BODEGA,
    MIN(CAST(E.FECHA_EMISION AS DATE))                                            AS FECHA_EM,
    enc.FECHA_ENTREGA,
    ISNULL(enc.IDVENDEDOR, '')                                                   AS RESPONSABLE,
    ISNULL(ent.RAZON_SOCIAL, '')                                                 AS CLIENTE,
    ISNULL(ent.RUT, '')                                                           AS RUT_BASE,
    ISNULL(ent.DIGITO, '')                                                        AS DIGITO
FROM Foviedo.dbo.M_DOCUMENTOS_DETALLE E
INNER JOIN Foviedo.dbo.M_DOCUMENTOS MD ON MD.IDDOCUMENTO = E.IDDOCUMENTO
INNER JOIN Foviedo.dbo.P_BODEGAS B     ON B.IDBODEGA     = E.IDBODEGA
LEFT JOIN Foviedo.dbo.M_DOCUMENTOS_ENCABEZADO enc
    ON enc.IDDOCUMENTO = E.IDDOCUMENTO
    AND enc.IDNUMERO   = E.IDNUMERO
    AND enc.IDSUCURSAL = E.IDSUCURSAL
LEFT JOIN Foviedo.dbo.M_ENTIDADES ent
    ON ent.IDENTIDAD = CAST(enc.IDENTIDAD AS NVARCHAR(20))
WHERE E.IDBODEGA IN ({ph_bodegas})
  AND E.IDSUCURSAL = '04'
  AND MD.DOC IN ({ph_docs})
  AND ISNULL(E.CANTIDAD_PENDIENTE, 0) > 0
  AND E.FECHA_EMISION >= ?
  AND EXISTS (
      SELECT 1 FROM Foviedo.dbo.M_DOCUMENTOS_DETALLE rp
      INNER JOIN Foviedo.dbo.M_DOCUMENTOS md2 ON md2.IDDOCUMENTO = rp.IDDOCUMENTO
      WHERE rp.IDDOCUMENTO = E.IDDOCUMENTO
        AND rp.IDNUMERO    = E.IDNUMERO
        AND rp.IDSUCURSAL  = E.IDSUCURSAL
        AND ISNULL(rp.CANTIDAD_PENDIENTE, 0) > 0
        AND md2.DOC IN ('BVE','FVE')
        AND rp.CODIGO_TECNICO NOT IN ('FLETE VENTA','FLETE FIJO','DESPACHO')
        AND rp.CODIGO_TECNICO NOT LIKE 'FLETE%'
        AND rp.CODIGO_TECNICO NOT LIKE 'DESPACHO%'
  )
  AND (enc.ESTADO IS NULL OR enc.ESTADO <> 'N')
GROUP BY MD.DOC, MD.DOCUMENTO, E.IDNUMERO, enc.NUMERO, B.SIMBOLO_BODEGA,
         enc.FECHA_ENTREGA, enc.IDVENDEDOR, ent.RAZON_SOCIAL, ent.RUT, ent.DIGITO
ORDER BY MIN(CAST(E.FECHA_EMISION AS DATE)) DESC
"""


def log(msg):
    print(msg, flush=True)


def fecha_str(v):
    if v is None:
        return ''
    if hasattr(v, 'strftime'):
        return v.strftime('%d/%m/%Y')
    # pyodbc puede devolver DATE como string ISO 'YYYY-MM-DD'
    s = str(v)
    if len(s) >= 10 and s[4:5] == '-' and s[7:8] == '-':
        try:
            d = datetime.date.fromisoformat(s[:10])
            return d.strftime('%d/%m/%Y')
        except Exception:
            pass
    return s


def leer_credenciales():
    enc_file = ENC_FILE
    if enc_file.exists():
        try:
            import ctypes, ctypes.wintypes
            class _BLOB(ctypes.Structure):
                _fields_ = [("cbData", ctypes.wintypes.DWORD),
                             ("pbData", ctypes.POINTER(ctypes.c_char))]
            raw = enc_file.read_bytes()
            buf = ctypes.create_string_buffer(raw)
            blob_in  = _BLOB(len(raw), buf)
            blob_out = _BLOB()
            ok = ctypes.windll.crypt32.CryptUnprotectData(
                ctypes.byref(blob_in), None, None, None, None, 0,
                ctypes.byref(blob_out))
            if ok:
                dec = bytes(ctypes.string_at(blob_out.pbData, blob_out.cbData))
                ctypes.windll.kernel32.LocalFree(blob_out.pbData)
                import json as _j
                d = _j.loads(dec.decode('utf-8'))['DB']
                return d['server'], d['database'], d['user'], d['password']
        except Exception as e:
            log(f'[WARN] No se pudo leer credenciales_db.enc: {e} — usando .ini')

    cfg = configparser.ConfigParser()
    cfg.read(str(CRED_FILE), encoding='utf-8')
    return (
        cfg['DB']['server'],
        cfg['DB']['database'],
        cfg['DB']['user'],
        cfg['DB']['password'],
    )


def conectar():
    server, database, user, password = leer_credenciales()
    conn_str = (
        f"DRIVER={{SQL Server}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={user};"
        f"PWD={password};"
        f"TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str, timeout=30)


def obtener_idbodegas(cursor):
    """Obtiene IDBODEGAs para las bodegas comerciales desde P_BODEGAS."""
    cursor.execute(SQL_IDBODEGAS)
    mapa = {}
    for row in cursor.fetchall():
        idbodega = int(row[0])
        simbolo  = str(row[1] or '').strip()
        if simbolo in BODEGAS_OBJETIVO:
            mapa[simbolo] = idbodega
    return mapa


def generar_comprometidos(cursor, idbodega_map):
    """
    Genera despachos-comprometidos.json usando SUM(CANTIDAD_PENDIENTE) de BVE/FVE.
    Retorna dict: {codigoTecnico: {pem:N, sem:N, cem:N, mem:N}}
    """
    _fi      = datetime.date.today() - datetime.timedelta(days=MESES_COMPROMETIDOS * 30)
    fecha_ini = datetime.datetime(_fi.year, _fi.month, _fi.day)
    log(f'[comprometidos] Buscando docs desde {_fi.isoformat()} ({MESES_COMPROMETIDOS} meses)')

    ids    = list(idbodega_map.values())
    bod_ph = ','.join(['?'] * len(ids))
    doc_ph = ','.join(['?'] * len(DOC_TIPOS_DESPACHO))
    sql    = SQL_COMPROMETIDOS.format(placeholders=bod_ph, doc_placeholders=doc_ph)
    params = ids + list(DOC_TIPOS_DESPACHO) + [fecha_ini]

    cursor.execute(sql, *params)

    result = defaultdict(dict)
    for row in cursor.fetchall():
        cod    = str(row[0] or '').strip()
        bod    = str(row[1] or '').strip().lower()
        pend   = int(row[2]) if row[2] else 0
        if cod and bod and pend > 0:
            result[cod][bod] = pend

    log(f'[OK] comprometidos despachos: {len(result)} productos con CANTIDAD_PENDIENTE > 0')

    por_bodega = defaultdict(int)
    for v in result.values():
        for b, n in v.items():
            por_bodega[b] += n
    for b in sorted(por_bodega):
        log(f'       {b.upper()}: {por_bodega[b]} unidades pendientes despacho en {sum(1 for v in result.values() if b in v)} productos')

    return dict(result)


def generar_detalle(cursor, idbodega_map):
    """
    Genera despachos-detalle.json desde M_DOCUMENTOS_DETALLE (BVE/FVE, CANTIDAD_PENDIENTE > 0).
    Retorna dict: {cod: {bod: [{"tipoDoc":..., "tipoDocLabel":..., "numero":...,
                                "fechaEmision":..., "fechaEntrega":..., "atraso":N,
                                "tipoOrden":"Despacho Pendiente", "cliente":..., "rut":...,
                                "vendedor":..., "cant":N, "idDocReal":N, "urlERP":""}]}}
    """
    _fi_date     = datetime.date.today() - datetime.timedelta(days=MESES_HISTORICO * 30)
    fecha_inicio = datetime.datetime(_fi_date.year, _fi_date.month, _fi_date.day)
    log(f'[detalle] Buscando docs desde {_fi_date.isoformat()} — tipos: {DOC_TIPOS_DESPACHO}')

    ids    = list(idbodega_map.values())
    ph_bod = ','.join(['?'] * len(ids))
    ph_doc = ','.join(['?'] * len(DOC_TIPOS_DESPACHO))
    sql    = SQL_DETALLE.format(ph_bodegas=ph_bod, ph_docs=ph_doc)
    params = ids + list(DOC_TIPOS_DESPACHO) + [fecha_inicio]

    try:
        cursor.execute(sql, *params)
        rows = cursor.fetchall()
        log(f'[detalle] Query OK — {len(rows)} filas agregadas')
    except Exception as e:
        log(f'[ERROR] Query detalle falló: {e}')
        return {}

    hoy    = datetime.date.today()
    result = defaultdict(lambda: defaultdict(list))

    for row in rows:
        bod        = str(row[0] or '').strip().lower()
        cod        = str(row[1] or '').strip()
        tipo_doc   = str(row[2] or '').strip()
        tipo_label = str(row[3] or '').strip()
        folio      = str(row[4] or '').strip()
        fecha_em   = row[5]    # date object or ISO string
        fecha_ent  = row[6]    # datetime or None  (year=1900 → sin fecha)
        cant       = int(row[7]) if row[7] else 0
        id_doc     = int(row[8]) if row[8] else 0
        vendedor   = str(row[9] or '').strip()
        # row[10] = ESTADO (no incluido en JSON de salida)
        cliente    = str(row[11] or '').strip()
        rut_base   = str(row[12] or '').strip()
        digito     = str(row[13] or '').strip()

        if not cod or not bod or cant <= 0:
            continue

        # FECHA_ENTREGA: año ≤ 1900 significa "sin fecha pactada"
        fe_str = ''
        atraso = 0
        if fecha_ent is not None and hasattr(fecha_ent, 'year') and fecha_ent.year > 1900:
            fe_str  = fecha_ent.strftime('%d/%m/%Y')
            fe_date = fecha_ent.date() if hasattr(fecha_ent, 'date') else fecha_ent
            if fe_date < hoy:
                atraso = (hoy - fe_date).days

        rut_str = f'{rut_base}-{digito}' if rut_base and digito else rut_base

        result[cod][bod].append({
            'tipoDoc':      tipo_doc,
            'tipoDocLabel': tipo_label,
            'numero':       folio,
            'fechaEmision': fecha_str(fecha_em),
            'fechaEntrega': fe_str,
            'atraso':       atraso,
            'tipoOrden':    'Despacho Pendiente',
            'cliente':      cliente,
            'rut':          rut_str,
            'vendedor':     vendedor,
            'cant':         cant,
            'idDocReal':    id_doc,
            'urlERP':       '',
        })

    result_plain = {cod: dict(bods) for cod, bods in result.items()}
    log(f'[OK] detalle despachos: {len(result_plain)} productos con documentos')
    return result_plain


def generar_recepciones(cursor):
    """
    Genera recepciones-pendientes.json — GRC/GRT/GIB/GRI pendientes de confirmación.
    Reemplaza Blazor/API JustTime (P_CONTROL_BODEGAS). Datos al último sync 22:00.
    """
    _fi = datetime.date.today() - datetime.timedelta(days=MESES_RECEPCIONES * 30)
    fecha_ini = datetime.datetime(_fi.year, _fi.month, _fi.day)
    ph = ','.join(['?'] * len(IDDOC_RECEPCION))
    sql = SQL_RECEPCIONES.format(ph_docs=ph)
    params = list(IDDOC_RECEPCION) + [fecha_ini]
    try:
        cursor.execute(sql, *params)
        rows = cursor.fetchall()
    except Exception as e:
        log(f'[ERROR] recepciones query: {e}')
        return []

    hoy = datetime.date.today()
    result = []
    for row in rows:
        tipo_doc   = str(row[0] or '').strip()
        tipo_label = str(row[1] or '').strip()
        folio      = str(row[2] or '').strip()
        bodega     = str(row[3] or '').strip()
        fecha_em   = row[4]
        fecha_ent  = row[5]
        responsable = str(row[6] or '').strip()
        cant       = int(row[8]) if row[8] else 0

        fe_str = ''
        if fecha_ent and hasattr(fecha_ent, 'year') and fecha_ent.year > 1900:
            fe_str = fecha_ent.strftime('%d/%m/%Y')

        result.append({
            'tipoDoc':      tipo_doc,
            'tipoDocLabel': tipo_label,
            'numero':       folio,
            'bodega':       bodega,
            'emision':      fecha_str(fecha_em),
            'fechaEntrega': fe_str,
            'responsable':  responsable,
            'cant':         cant,
        })

    log(f'[OK] recepciones pendientes SQL: {len(result)} documentos')
    return result


def generar_lista_despachos(cursor, idbodega_map):
    """
    Genera despachos-pendientes-erp.json — lista de BVE/FVE por documento.
    Fuente SQL local (sync 22:00). Reemplaza endpoint Blazor API despachos.
    """
    _fi = datetime.date.today() - datetime.timedelta(days=MESES_COMPROMETIDOS * 30)
    fecha_ini = datetime.datetime(_fi.year, _fi.month, _fi.day)
    ids = list(idbodega_map.values())
    ph_bod = ','.join(['?'] * len(ids))
    ph_doc = ','.join(['?'] * len(DOC_TIPOS_DESPACHO))
    sql = SQL_LISTA_DESPACHOS.format(ph_bodegas=ph_bod, ph_docs=ph_doc)
    params = ids + list(DOC_TIPOS_DESPACHO) + [fecha_ini]
    try:
        cursor.execute(sql, *params)
        rows = cursor.fetchall()
        log(f'[lista_despachos] {len(rows)} filas')
    except Exception as e:
        log(f'[ERROR] lista_despachos query: {e}')
        return []

    hoy = datetime.date.today()
    result = []
    for row in rows:
        tipo_doc   = str(row[0] or '').strip()
        tipo_label = str(row[1] or '').strip()
        folio      = str(row[2] or '').strip()
        bodega     = str(row[3] or '').strip()
        fecha_em   = row[4]
        fecha_ent  = row[5]
        responsable = str(row[6] or '').strip()
        cliente    = str(row[7] or '').strip()
        rut_base   = str(row[8] or '').strip()
        digito     = str(row[9] or '').strip()

        fe_str = ''
        atraso = 0
        if fecha_ent and hasattr(fecha_ent, 'year') and fecha_ent.year > 1900:
            fe_str = fecha_ent.strftime('%d/%m/%Y')
            fe_d = fecha_ent.date() if hasattr(fecha_ent, 'date') else fecha_ent
            if fe_d < hoy:
                atraso = (hoy - fe_d).days

        result.append({
            'tipoDoc':      tipo_doc,
            'tipoDocLabel': tipo_label,
            'numero':       folio,
            'bodega':       bodega,
            'emision':      fecha_str(fecha_em),
            'fechaEntrega': fe_str,
            'atraso':       atraso,
            'sucursal':     'El Manzano',
            'responsable':  responsable,
            'vendedor':     responsable,
            'cliente':      cliente,
            'rut':          f'{rut_base}-{digito}' if rut_base and digito else rut_base,
        })

    log(f'[OK] lista despachos pendientes SQL: {len(result)} documentos únicos')
    return result


def main():
    log('[descargar_despachos] Iniciando...')

    if not CRED_FILE.exists() and not ENC_FILE.exists():
        log(f'[ERROR] No existe {CRED_FILE}')
        sys.exit(1)

    try:
        conn = conectar()
        log('[DB] Conexion OK')
    except Exception as e:
        log(f'[ERROR] Conexion SQL: {e}')
        sys.exit(1)

    cursor = conn.cursor()

    # ── PASO 1: obtener IDBODEGAs dinámicamente ──────────────────────────────
    idbodega_map = obtener_idbodegas(cursor)
    encontrados  = list(idbodega_map.keys())
    faltantes    = [b for b in BODEGAS_OBJETIVO if b not in idbodega_map]

    log(f'[P_BODEGAS] Encontradas: {sorted(encontrados)}')
    for b, id_ in sorted(idbodega_map.items()):
        log(f'             {b} = IDBODEGA {id_}')

    if faltantes:
        log(f'[WARN] No encontradas en P_BODEGAS: {faltantes} — se omitirán')

    if not idbodega_map:
        log('[ERROR] Ninguna bodega comercial encontrada en P_BODEGAS. Abortando.')
        cursor.close(); conn.close()
        sys.exit(1)

    # ── PASO 2: generar despachos-comprometidos.json (totales por producto) ──
    comprometidos = {}
    try:
        comprometidos = generar_comprometidos(cursor, idbodega_map)
    except Exception as e:
        log(f'[ERROR] generar_comprometidos: {e}')

    path_comp = DATA_DIR / 'despachos-comprometidos.json'
    with open(path_comp, 'w', encoding='utf-8') as f:
        json.dump(comprometidos, f, ensure_ascii=False)
    log(f'[OK] {path_comp.name}: {len(comprometidos)} productos')

    # ── PASO 3: generar despachos-detalle.json (documentos individuales) ─────
    detalle = {}
    try:
        detalle = generar_detalle(cursor, idbodega_map)
    except Exception as e:
        log(f'[ERROR] generar_detalle: {e}')

    path_det = DATA_DIR / 'despachos-detalle.json'
    with open(path_det, 'w', encoding='utf-8') as f:
        json.dump(detalle, f, ensure_ascii=False)
    log(f'[OK] {path_det.name}: {len(detalle)} productos con detalle')

    # ── PASO 4: generar despachos-pendientes-erp.json (lista por documento) ──
    lista_desp = []
    try:
        lista_desp = generar_lista_despachos(cursor, idbodega_map)
    except Exception as e:
        log(f'[ERROR] generar_lista_despachos: {e}')

    path_lista = DATA_DIR / 'despachos-pendientes-erp.json'
    with open(path_lista, 'w', encoding='utf-8') as f:
        json.dump(lista_desp, f, ensure_ascii=False)
    log(f'[OK] {path_lista.name}: {len(lista_desp)} documentos')

    # ── PASO 5: generar recepciones-pendientes.json (GRC/GRT/GIB) ────────────
    recepciones = []
    try:
        recepciones = generar_recepciones(cursor)
    except Exception as e:
        log(f'[ERROR] generar_recepciones: {e}')

    path_rece = DATA_DIR / 'recepciones-pendientes.json'
    with open(path_rece, 'w', encoding='utf-8') as f:
        json.dump(recepciones, f, ensure_ascii=False)
    log(f'[OK] {path_rece.name}: {len(recepciones)} documentos')

    cursor.close()
    conn.close()
    log('[descargar_despachos] FINALIZADO')


if __name__ == '__main__':
    main()
