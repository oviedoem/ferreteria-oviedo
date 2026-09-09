"""
descargar_pedidos.py
Genera dos JSONs desde SQL Server para el módulo Informe Stock:

  data/pedidos-comprometidos.json
      {codigoTecnico: {pem: N, sem: N, cem: N, mem: N}}
      Fuente: R_STOCK_PRODUCTOS.ST_PEDIDO  (campo oficial ERP, sin ambigüedad)

  data/pedidos-detalle.json
      {codigoTecnico: {pem: [...docs], sem: [...], cem: [...], mem: [...]}}
      Fuente: M_DOCUMENTOS_DETALLE filtrado por tipos de venta abiertos.
      Si la query falla por schema inesperado, escribe {} y loguea el error.

Tipos de doc incluidos: NVM, VMN, VMP  (notas de venta que incrementan ST_PEDIDO).
Ver sección TIPOS DE DOC COMPROMISO en AGENTS.md para la lista actualizada.
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
    DATA_DIR.mkdir(parents=True, exist_ok=True)
CRED_FILE = BASE_DIR / "credenciales_db.ini"
ENC_FILE  = Path(__file__).parent.parent.parent / "config" / "credenciales_db.enc"

# Bodegas comerciales para Informe Stock
BODEGAS_OBJETIVO = ['PEM', 'SEM', 'CEM', 'MEM']

# Tipos de documento que RESERVAN stock (pedidos abiertos, sin salida física).
# Documentados en AGENTS.md sección TIPOS DE DOC COMPROMISO.
# EXCLUIDOS: FCN/FVE (factura), BVE (boleta), NCV/NCE (nota crédito) — ya salieron.
DOC_TIPOS_PEDIDO = ('NVM', 'VMN', 'VMP')

# Período de búsqueda para pedidos-detalle (últimos N meses)
MESES_HISTORICO = 6

# ── Queries ──────────────────────────────────────────────────────────────────

SQL_IDBODEGAS = """
SELECT IDBODEGA, SIMBOLO_BODEGA
FROM Foviedo.dbo.P_BODEGAS
WHERE SIMBOLO_BODEGA IN ('PEM','SEM','CEM','MEM')
"""

# Totales desde R_STOCK_PRODUCTOS — fuente oficial del ERP
SQL_COMPROMETIDOS = """
SELECT
    A.CODIGO_TECNICO,
    B.SIMBOLO_BODEGA,
    CAST(ISNULL(A.ST_PEDIDO, 0) AS INT) AS PEDIDO
FROM Foviedo.dbo.R_STOCK_PRODUCTOS A
INNER JOIN Foviedo.dbo.P_BODEGAS B ON A.IDBODEGA = B.IDBODEGA
WHERE A.IDBODEGA IN ({placeholders})
  AND A.IDSUCURSAL = '04'
  AND ISNULL(A.ST_PEDIDO, 0) > 0
"""

# Detalle de documentos (para drill-down en el panel).
# CTE agrega CANTIDAD_PENDIENTE > 0 por (doc, producto, bodega) antes de hacer los JOINs,
# evitando filas duplicadas cuando un mismo NV tiene varias líneas del mismo SKU.
# Fuente autorizada: M_DOCUMENTOS_DETALLE.CANTIDAD_PENDIENTE (unidades aún sin despachar).
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
    Genera pedidos-comprometidos.json usando R_STOCK_PRODUCTOS.ST_PEDIDO.
    Retorna dict: {codigoTecnico: {pem:N, sem:N, cem:N, mem:N}}
    """
    ids = list(idbodega_map.values())
    ph  = ','.join(['?'] * len(ids))
    sql = SQL_COMPROMETIDOS.format(placeholders=ph)

    cursor.execute(sql, *ids)

    result = defaultdict(dict)
    for row in cursor.fetchall():
        cod    = str(row[0] or '').strip()
        bod    = str(row[1] or '').strip().lower()
        pedido = int(row[2]) if row[2] else 0
        if cod and bod and pedido > 0:
            result[cod][bod] = pedido

    log(f'[OK] comprometidos: {len(result)} productos con ST_PEDIDO > 0')

    # Validación por bodega
    por_bodega = defaultdict(int)
    for v in result.values():
        for b, n in v.items():
            por_bodega[b] += n
    for b in sorted(por_bodega):
        log(f'       {b.upper()}: {por_bodega[b]} unidades comprometidas en {sum(1 for v in result.values() if b in v)} productos')

    return dict(result)


def generar_detalle(cursor, idbodega_map):
    """
    Genera pedidos-detalle.json desde M_DOCUMENTOS_DETALLE (CANTIDAD_PENDIENTE > 0).
    Fuente doc: NVM / VMN / VMP únicamente (tipos que aumentan ST_PEDIDO en R_STOCK).
    Retorna dict: {cod: {bod: [{"tipoDoc":..., "tipoDocLabel":..., "numero":...,
                                "fechaEmision":..., "fechaEntrega":..., "atraso":N,
                                "tipoOrden":"New Order", "cliente":..., "rut":...,
                                "vendedor":..., "cant":N, "idDocReal":N, "urlERP":""}]}}
    """
    _fi_date     = datetime.date.today() - datetime.timedelta(days=MESES_HISTORICO * 30)
    fecha_inicio = datetime.datetime(_fi_date.year, _fi_date.month, _fi_date.day)  # datetime → pyodbc pasa como datetime, no nvarchar
    log(f'[detalle] Buscando docs desde {_fi_date.isoformat()} — tipos: {DOC_TIPOS_PEDIDO}')

    ids    = list(idbodega_map.values())
    ph_bod = ','.join(['?'] * len(ids))
    ph_doc = ','.join(['?'] * len(DOC_TIPOS_PEDIDO))
    sql    = SQL_DETALLE.format(ph_bodegas=ph_bod, ph_docs=ph_doc)
    params = ids + list(DOC_TIPOS_PEDIDO) + [fecha_inicio]

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
        fecha_em   = row[5]    # date object or None
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
            'tipoOrden':    'New Order',
            'cliente':      cliente,
            'rut':          rut_str,
            'vendedor':     vendedor,
            'cant':         cant,
            'idDocReal':    id_doc,
            'urlERP':       '',
        })

    result_plain = {cod: dict(bods) for cod, bods in result.items()}
    log(f'[OK] detalle: {len(result_plain)} productos con documentos')
    return result_plain


def main():
    log('[descargar_pedidos] Iniciando...')

    if not CRED_FILE.exists() and not ENC_FILE.exists():
        log(f'[ERROR] No existe {CRED_FILE}')
        sys.exit(1)

    try:
        conn = conectar()
        log('[DB] Conexion OK')
    except Exception as e:
        log(f'[ERROR] Conexion SQL: {e}')
        sys.exit(1)

    hoy = datetime.date.today().isoformat()
    cursor = conn.cursor()

    # ── PASO 1: obtener IDBODEGAs dinámicamente ──────────────────────────────
    idbodega_map = obtener_idbodegas(cursor)
    encontrados = list(idbodega_map.keys())
    faltantes   = [b for b in BODEGAS_OBJETIVO if b not in idbodega_map]

    log(f'[P_BODEGAS] Encontradas: {sorted(encontrados)}')
    for b, id_ in sorted(idbodega_map.items()):
        log(f'             {b} = IDBODEGA {id_}')

    if faltantes:
        log(f'[WARN] No encontradas en P_BODEGAS: {faltantes} — se omitirán')

    if not idbodega_map:
        log('[ERROR] Ninguna bodega comercial encontrada en P_BODEGAS. Abortando.')
        cursor.close(); conn.close()
        sys.exit(1)

    # ── PASO 2: generar pedidos-comprometidos.json (totales ST_PEDIDO) ────────
    comprometidos = {}
    try:
        comprometidos = generar_comprometidos(cursor, idbodega_map)
    except Exception as e:
        log(f'[ERROR] generar_comprometidos: {e}')

    path_comp = DATA_DIR / 'pedidos-comprometidos.json'
    with open(path_comp, 'w', encoding='utf-8') as f:
        json.dump(comprometidos, f, ensure_ascii=False)
    log(f'[OK] {path_comp.name}: {len(comprometidos)} productos')

    # ── PASO 3: generar pedidos-detalle.json (documentos individuales) ────────
    detalle = {}
    try:
        detalle = generar_detalle(cursor, idbodega_map)
    except Exception as e:
        log(f'[ERROR] generar_detalle: {e}')

    path_det = DATA_DIR / 'pedidos-detalle.json'
    with open(path_det, 'w', encoding='utf-8') as f:
        json.dump(detalle, f, ensure_ascii=False)
    log(f'[OK] {path_det.name}: {len(detalle)} productos con detalle')

    cursor.close()
    conn.close()
    log('[descargar_pedidos] FINALIZADO')


if __name__ == '__main__':
    main()
