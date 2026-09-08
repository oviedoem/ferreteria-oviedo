"""
descargar_oc_pendientes.py  V1.0  2026-07-01
Genera data/oc-pendientes.json (detalle por OC) y data/oc-pend-resumen.json
({codigo: qty_pendiente, _generado: ISO}) con las ordenes de compra activas
(aun no recibidas) cuyas lineas apuntan a bodegas El Manzano + CD.

El panel (Solicitud Semanal de Stock) usa el resumen para mostrar si ya existe
una OC vigente por codigo antes de proponer un nuevo pedido (campo oc_pend
en _vadmStockMap).

Fuente SQL (verificado en vivo 2026-07-01):
  M_DOCUMENTOS_DETALLE    -> CODIGO_TECNICO, CANTIDAD, CANTIDAD_PENDIENTE, IDBODEGA
  M_DOCUMENTOS_ENCABEZADO -> NUMERO, ESTADO, FECHA_EMISION, FECHA_ENTREGA, IDENTIDAD
  M_ENTIDADES             -> RAZON_SOCIAL (nombre proveedor)
  Tipos OC (M_DOCUMENTOS, mismos que descargar_oc_leadtime.py):
    8, 26, 104, 108, 800, 801, 802, 803, 804 (todas las variantes OCN)
  ESTADO: 'Vigente' / 'Pendiente' = activa; 'Nulo' = anulada (se excluye).
  CANTIDAD_PENDIENTE > 0 = unidades aun no recibidas (el ERP la mantiene).

Limitacion: SQL sincroniza con JustWeb ~1 vez/dia (22:00). Requiere VPN si es WiFi.
Fallo de conexion: se PRESERVA el JSON anterior (exit 1, el bat continua).
Query OK con 0 filas: se escribe resumen vacio {_generado} (caso legitimo).

Uso: python descargar_oc_pendientes.py
"""

import json
import sys
import datetime
import configparser
from pathlib import Path

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

MESES_HACIA_ATRAS = 6

# Variantes de OC (M_DOCUMENTOS) — mismas que descargar_oc_leadtime.py
DOC_OC = (8, 26, 104, 108, 800, 801, 802, 803, 804)

# Bodegas El Manzano + CD que reciben mercaderia (IDBODEGA SQL, IDS_REFERENCIA.md)
BODEGAS_EM = {13: 'SEM', 22: 'PEM', 24: 'CEM', 29: 'MEM', 46: 'TEM', 55: 'RCE', 72: 'IEM', 23: 'CD'}


def log(msg):
    print(msg, flush=True)


# ── Conexion SQL (mismo patron que descargar_oc_leadtime.py) ──
def leer_credenciales():
    if ENC_FILE.exists():
        try:
            import ctypes, ctypes.wintypes
            class _BLOB(ctypes.Structure):
                _fields_ = [("cbData", ctypes.wintypes.DWORD),
                            ("pbData", ctypes.POINTER(ctypes.c_char))]
            raw = ENC_FILE.read_bytes()
            buf = ctypes.create_string_buffer(raw)
            blob_in  = _BLOB(len(raw), buf)
            blob_out = _BLOB()
            ok = ctypes.windll.crypt32.CryptUnprotectData(
                ctypes.byref(blob_in), None, None, None, None, 0,
                ctypes.byref(blob_out))
            if ok:
                dec = bytes(ctypes.string_at(blob_out.pbData, blob_out.cbData))
                ctypes.windll.kernel32.LocalFree(blob_out.pbData)
                d = json.loads(dec.decode('utf-8'))['DB']
                return d['server'], d['database'], d['user'], d['password']
        except Exception as e:
            log(f'[WARN] No se pudo leer credenciales_db.enc: {e} - usando .ini')

    cfg = configparser.ConfigParser()
    cfg.read(str(CRED_FILE), encoding='utf-8')
    return (cfg['DB']['server'], cfg['DB']['database'],
            cfg['DB']['user'], cfg['DB']['password'])


def conectar():
    server, database, user, password = leer_credenciales()
    conn_str = (
        f"DRIVER={{SQL Server}};SERVER={server};DATABASE={database};"
        f"UID={user};PWD={password};TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str, timeout=30)


SQL_OC_PENDIENTES = """
SELECT
    e.NUMERO,
    MD.DOC,
    e.ESTADO,
    CONVERT(varchar, e.FECHA_EMISION, 23)  AS FECHA_EMISION,
    CONVERT(varchar, e.FECHA_ENTREGA, 23)  AS FECHA_ENTREGA,
    e.IDENTIDAD                            AS PROVEEDOR_RUT,
    ISNULL(ent.RAZON_SOCIAL, '')           AS PROVEEDOR,
    d.IDBODEGA,
    d.CODIGO_TECNICO,
    ISNULL(d.DESCRIPCION, '')              AS DESCRIPCION,
    d.CANTIDAD,
    d.CANTIDAD_PENDIENTE
FROM Foviedo.dbo.M_DOCUMENTOS_DETALLE d
JOIN Foviedo.dbo.M_DOCUMENTOS_ENCABEZADO e
  ON  e.IDDOCUMENTO = d.IDDOCUMENTO
  AND e.IDSUCURSAL  = d.IDSUCURSAL
  AND e.IDNUMERO    = d.IDNUMERO
JOIN Foviedo.dbo.M_DOCUMENTOS MD
  ON MD.IDDOCUMENTO = d.IDDOCUMENTO
LEFT JOIN Foviedo.dbo.M_ENTIDADES ent
  ON ent.IDENTIDAD = CAST(e.IDENTIDAD AS NVARCHAR(20))
WHERE d.IDDOCUMENTO IN ({ph_oc})
  AND ISNULL(d.CANTIDAD_PENDIENTE, 0) > 0
  AND d.IDBODEGA IN ({ph_bod})
  AND d.FECHA_EMISION >= ?
  AND ISNULL(e.ESTADO, '') <> 'Nulo'
"""


def generar(cursor):
    desde = datetime.datetime.now() - datetime.timedelta(days=MESES_HACIA_ATRAS * 31)
    ph_oc  = ','.join(['?'] * len(DOC_OC))
    ph_bod = ','.join(['?'] * len(BODEGAS_EM))
    sql = SQL_OC_PENDIENTES.format(ph_oc=ph_oc, ph_bod=ph_bod)
    params = list(DOC_OC) + list(BODEGAS_EM.keys()) + [desde]
    cursor.execute(sql, params)

    ocs_map = {}   # (doc, numero) -> {numero, tipodoc, ..., lineas: []}
    resumen = {}   # codigo -> qty pendiente total
    for (num, doc, estado, f_emi, f_ent, rut, proveedor,
         idbod, cod, desc, qty, qty_pend) in cursor.fetchall():
        cod = str(cod or '').strip().upper()
        qty_pend = int(qty_pend or 0)
        if not cod or qty_pend <= 0:
            continue

        resumen[cod] = resumen.get(cod, 0) + qty_pend

        key = (doc, str(num))
        if key not in ocs_map:
            ocs_map[key] = {
                'numero':       str(num),
                'tipodoc':      str(doc or '').strip(),
                'estado':       str(estado or '').strip(),
                'fechaEmision': f_emi or '',
                'fechaEntrega': f_ent or '',
                'proveedorRut': str(rut or '').strip(),
                'proveedor':    str(proveedor or '').strip(),
                'lineas':       [],
            }
        ocs_map[key]['lineas'].append({
            'cod':          cod,
            'desc':         str(desc or '').strip(),
            'bodega':       BODEGAS_EM.get(int(idbod), str(idbod)),
            'qtyPedida':    int(qty or 0),
            'qtyPendiente': qty_pend,
        })

    detalle = sorted(ocs_map.values(), key=lambda o: o['fechaEmision'], reverse=True)
    return detalle, resumen


def escribir_jsons(detalle, resumen):
    resumen['_generado'] = datetime.datetime.now().isoformat(timespec='seconds')
    DATA_DIR.mkdir(exist_ok=True)
    with open(DATA_DIR / 'oc-pendientes.json', 'w', encoding='utf-8') as f:
        json.dump(detalle, f, ensure_ascii=False, separators=(',', ':'))
    with open(DATA_DIR / 'oc-pend-resumen.json', 'w', encoding='utf-8') as f:
        json.dump(resumen, f, ensure_ascii=False, separators=(',', ':'))


def main():
    log(f"[PASO 1N] {datetime.datetime.now().strftime('%H:%M:%S')} - Descargando OC pendientes desde SQL...")

    if not CRED_FILE.exists() and not ENC_FILE.exists():
        log(f'[ERROR] No existe {CRED_FILE} ni credenciales_db.enc')
        sys.exit(1)

    try:
        conn = conectar()
        log('[DB] Conexion OK')
    except Exception as e:
        log(f'[ERROR] Conexion SQL: {e} - se preserva el JSON anterior si existe')
        sys.exit(1)

    cursor = conn.cursor()
    try:
        detalle, resumen = generar(cursor)
    except Exception as e:
        log(f'[ERROR] generar: {e} - se preserva el JSON anterior si existe')
        cursor.close(); conn.close()
        sys.exit(1)
    cursor.close(); conn.close()

    try:
        escribir_jsons(detalle, resumen)
    except Exception as e:
        log(f'[ERROR] No se pudo escribir JSONs en {DATA_DIR}: {e}')
        sys.exit(1)

    n_cods = len([k for k in resumen if not k.startswith('_')])
    log(f'[OK] oc-pendientes.json: {len(detalle)} OCs activas | oc-pend-resumen.json: {n_cods} codigos con pendiente')
    log('[descargar_oc_pendientes] FINALIZADO')


if __name__ == '__main__':
    main()
