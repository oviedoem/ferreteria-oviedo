"""
descargar_stock_critico.py  V1.0  2026-06-14
Genera data/stock-critico.json desde SQL Server (R_STOCK_PRODUCTOS).

Trae los parametros de abastecimiento que el personal de Adquisiciones configura
en el ERP (se van llenando de a poco): ST_MIN, ST_MAX, ST_CRITICO, ST_REPOSICION
por producto, sumados sobre las bodegas comerciales de El Manzano.

El tab "Solicitud Semanal de Stock" del panel admin usa estos valores como
Minimo/Reposicion (misma logica que el ERP), en vez de calcular por velocidad de venta.
Productos sin parametros configurados quedan fuera del JSON (el panel los muestra en 0).

Fuente: Foviedo.dbo.R_STOCK_PRODUCTOS (misma tabla que descargar_pedidos/despachos).
Bodegas comerciales El Manzano: PEM=22, SEM=13, CEM=24, MEM=29 (suc 04 + 08).
Limitacion: SQL sincroniza con JustWeb 1 vez/dia (~22:00). Requiere VPN si es WiFi.

Salida:
  data/stock-critico.json
    { "generado":..., "fuente":..., "bodegas":[...],
      "productos": { "<codigo>": {"min":N,"max":N,"critico":N,"repo":N,"disp":N} },
      "porBodega": { "<codigo>": { "PEM":{min,max,critico,repo,disp}, "SEM":{...}, ... } } }
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

# Bodegas comerciales El Manzano (IDBODEGA SQL)
BODEGAS = {22: 'PEM', 13: 'SEM', 24: 'CEM', 29: 'MEM'}


def log(msg):
    print(msg, flush=True)


# ── Conexion SQL (mismo patron que descargar_despachos.py / descargar_ventas_enrich.py) ──
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


SQL_PARAMS = """
SELECT
    R.CODIGO_TECNICO,
    R.IDBODEGA,
    CAST(ISNULL(R.ST_MIN,        0) AS DECIMAL(18,2)) AS ST_MIN,
    CAST(ISNULL(R.ST_MAX,        0) AS DECIMAL(18,2)) AS ST_MAX,
    CAST(ISNULL(R.ST_CRITICO,    0) AS DECIMAL(18,2)) AS ST_CRITICO,
    CAST(ISNULL(R.ST_REPOSICION, 0) AS DECIMAL(18,2)) AS ST_REPOSICION,
    CAST(ISNULL(R.ST_DISPONIBLE, 0) AS DECIMAL(18,2)) AS ST_DISPONIBLE
FROM Foviedo.dbo.R_STOCK_PRODUCTOS R
WHERE R.IDBODEGA IN ({ph})
  AND ( ISNULL(R.ST_MIN,0) > 0 OR ISNULL(R.ST_MAX,0) > 0
        OR ISNULL(R.ST_CRITICO,0) > 0 OR ISNULL(R.ST_REPOSICION,0) > 0 )
"""


def generar(cursor):
    ids = list(BODEGAS.keys())
    ph  = ','.join(['?'] * len(ids))
    cursor.execute(SQL_PARAMS.format(ph=ph), *ids)

    prods = {}
    por_bodega = {}
    for cod, idbod, smin, smax, scrit, srepo, sdisp in cursor.fetchall():
        cod = str(cod or '').strip().upper()
        if not cod:
            continue
        p = prods.setdefault(cod, {'min': 0, 'max': 0, 'critico': 0, 'repo': 0, 'disp': 0})
        p['min']     += int(smin or 0)
        p['max']     += int(smax or 0)
        p['critico'] += int(scrit or 0)
        p['repo']    += int(srepo or 0)
        p['disp']    += int(sdisp or 0)

        bod_nombre = BODEGAS.get(idbod)
        if bod_nombre:
            por_bodega.setdefault(cod, {})[bod_nombre] = {
                'min': int(smin or 0), 'max': int(smax or 0),
                'critico': int(scrit or 0), 'repo': int(srepo or 0), 'disp': int(sdisp or 0),
            }

    log(f'[stats] productos con parametros configurados: {len(prods)}')
    return prods, por_bodega


def main():
    log('[descargar_stock_critico] Iniciando...')
    log(f'[cfg] Bodegas: {", ".join(BODEGAS.values())}')

    if not CRED_FILE.exists() and not ENC_FILE.exists():
        log(f'[ERROR] No existe {CRED_FILE} ni credenciales_db.enc')
        sys.exit(1)

    try:
        conn = conectar()
        log('[DB] Conexion OK')
    except Exception as e:
        log(f'[ERROR] Conexion SQL: {e}')
        sys.exit(1)

    cursor = conn.cursor()
    try:
        prods, por_bodega = generar(cursor)
    except Exception as e:
        log(f'[ERROR] generar: {e}')
        cursor.close(); conn.close()
        sys.exit(1)
    cursor.close(); conn.close()

    out = DATA_DIR / 'stock-critico.json'
    try:
        DATA_DIR.mkdir(exist_ok=True)
        with open(out, 'w', encoding='utf-8') as f:
            json.dump({
                'generado': datetime.datetime.now().isoformat(timespec='seconds'),
                'fuente':   'R_STOCK_PRODUCTOS (SQL) — El Manzano comerciales',
                'bodegas':  list(BODEGAS.values()),
                'productos': prods,
                'porBodega': por_bodega,  # {codigo: {'PEM':{min,max,critico,repo,disp}, 'SEM':{...}, ...}} - parametros ERP por bodega individual
            }, f, ensure_ascii=False, separators=(',', ':'))
    except Exception as e:
        log(f'[ERROR] No se pudo escribir {out}: {e}')
        sys.exit(1)

    log(f'[OK] stock-critico.json: {len(prods)} productos')
    log('[descargar_stock_critico] FINALIZADO')


if __name__ == '__main__':
    main()
