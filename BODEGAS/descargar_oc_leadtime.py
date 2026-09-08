"""
descargar_oc_leadtime.py  V1.0  2026-06-28
Genera data/oc-leadtime.json: tiempo de transito por codigo y proveedor,
desde que se crea la Orden de Compra (OC) hasta que se recibe la mercaderia
(Guia Recepcion Compra GRC, o Guia Recepcion Traslado/Ingreso Entre Bodegas
GRT/GIB cuando la OC se recibe via traslado interno desde otra sucursal/CD).

Variantes de OC cubiertas (M_DOCUMENTOS, confirmado via SQL 2026-06-28):
  8   Compra Orden Stock              26  Compra Orden Calzada
  104 Compra Orden Stock Bodega       108 Compra Orden Gastos
  800 OC Integrada Vigente            801 OC Integrada Pendiente
  802 OC Integracion MTS              803 OC Integracion MTS Pendiente
  804 Compra Orden BPD

Join: M_DOCUMENTOS_DETALLE (recepcion) -> M_DOCUMENTOS_DETALLE (OC origen) via
  IDDOCUMENTO_ORIGEN/IDSUCURSAL_ORIGEN/IDNUMERO_ORIGEN/IDLINEA_ORIGEN
(los 4 campos son obligatorios para el join - sin IDSUCURSAL_ORIGEN se duplican
filas porque IDNUMERO no es unico entre sucursales). Verificado: conteo de
recepciones con join == conteo total de recepciones GRC en el periodo (sin duplicados).

Fuente: Foviedo.dbo.M_DOCUMENTOS_DETALLE + M_ENTIDADES (nombre proveedor).
Limitacion: SQL sincroniza con JustWeb ~1 vez/dia (22:00). Requiere VPN si es WiFi.

Salida:
  data/oc-leadtime.json
    { "generado":..., "fuente":..., "ventanaDias":N,
      "productos": { "<codigo>": {
          "diasProm": N, "nRecepciones": N,
          "proveedores": [ {"rut":"...", "nombre":"...", "diasProm":N, "n":N}, ... ]
      } } }
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

VENTANA_DIAS = 180  # horizonte de analisis (recepciones recientes)

# Documentos de recepcion que pueden originarse de una OC (GRC directo o traslado interno)
DOC_RECEPCION = (15, 17, 307, 701, 712, 713, 709)
# Documentos de Orden de Compra (todas las variantes: normal/vigente/pendiente/MTS/BPD)
DOC_OC = (8, 26, 104, 108, 800, 801, 802, 803, 804)


def log(msg):
    print(msg, flush=True)


# ── Conexion SQL (mismo patron que descargar_stock_critico.py) ──
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


# Bodegas El Manzano que pueden recibir mercaderia (IDBODEGA -> simbolo), IDS_REFERENCIA.md
# ICD (73, Ingreso CD) agregada V37.55: recepciones OC en Santiago (poco frecuente pero real
# — 133 GRC con origen OC en 180d verificadas 2026-07-01) para desglose porBodega consistente.
BODEGAS_RECEPCION = {13: 'SEM', 22: 'PEM', 24: 'CEM', 29: 'MEM', 46: 'TEM', 55: 'RCE', 72: 'IEM', 23: 'CD', 73: 'ICD'}

SQL_LEADTIME = """
SELECT
    rec.CODIGO_TECNICO,
    rec.IDBODEGA                                             AS BODEGA_DESTINO,
    oc.IDENTIDAD                                            AS PROVEEDOR_RUT,
    DATEDIFF(day, oc.FECHA_EMISION, rec.FECHA_EMISION)       AS DIAS
FROM Foviedo.dbo.M_DOCUMENTOS_DETALLE rec
JOIN Foviedo.dbo.M_DOCUMENTOS_DETALLE oc
  ON oc.IDDOCUMENTO = rec.IDDOCUMENTO_ORIGEN
 AND oc.IDSUCURSAL   = rec.IDSUCURSAL_ORIGEN
 AND oc.IDNUMERO     = rec.IDNUMERO_ORIGEN
 AND oc.IDLINEA      = rec.IDLINEA_ORIGEN
WHERE rec.IDDOCUMENTO IN ({ph_rec})
  AND rec.IDSUCURSAL = '04'
  AND oc.IDDOCUMENTO IN ({ph_oc})
  AND rec.FECHA_EMISION >= ?
  AND DATEDIFF(day, oc.FECHA_EMISION, rec.FECHA_EMISION) >= 0
"""

SQL_ENTIDADES = """
SELECT IDENTIDAD, RAZON_SOCIAL FROM Foviedo.dbo.M_ENTIDADES WHERE IDENTIDAD IN ({ph})
"""


def generar(cursor):
    desde = datetime.datetime.now() - datetime.timedelta(days=VENTANA_DIAS)
    ph_rec = ','.join(['?'] * len(DOC_RECEPCION))
    ph_oc  = ','.join(['?'] * len(DOC_OC))
    sql = SQL_LEADTIME.format(ph_rec=ph_rec, ph_oc=ph_oc)
    params = list(DOC_RECEPCION) + list(DOC_OC) + [desde]
    cursor.execute(sql, params)

    # cod -> {ruts: {rut: [dias,...]}}, cod -> {bodega: [dias,...]}
    por_codigo = {}
    por_codigo_bodega = {}
    ruts_vistos = set()
    for cod, idbod, rut, dias in cursor.fetchall():
        cod = str(cod or '').strip()
        rut = str(rut or '').strip()
        if not cod or not rut:
            continue
        ruts_vistos.add(rut)
        d = por_codigo.setdefault(cod, {})
        d.setdefault(rut, []).append(int(dias))
        bod_nombre = BODEGAS_RECEPCION.get(int(idbod)) if idbod is not None else None
        if bod_nombre:
            db = por_codigo_bodega.setdefault(cod, {})
            db.setdefault(bod_nombre, []).append(int(dias))

    log(f'[stats] codigos con recepciones OC en {VENTANA_DIAS}d: {len(por_codigo)}')

    # Nombres de proveedor
    nombres = {}
    if ruts_vistos:
        ph = ','.join(['?'] * len(ruts_vistos))
        cursor.execute(SQL_ENTIDADES.format(ph=ph), list(ruts_vistos))
        for rut, razon in cursor.fetchall():
            nombres[str(rut).strip()] = (razon or '').strip()

    productos = {}
    for cod, ruts in por_codigo.items():
        proveedores = []
        todos_dias = []
        for rut, dias_list in ruts.items():
            prom = round(sum(dias_list) / len(dias_list), 1)
            proveedores.append({
                'rut': rut, 'nombre': nombres.get(rut, ''),
                'diasProm': prom, 'n': len(dias_list),
            })
            todos_dias.extend(dias_list)
        proveedores.sort(key=lambda p: p['n'], reverse=True)

        por_bodega = {}
        for bod_nombre, dias_list in por_codigo_bodega.get(cod, {}).items():
            por_bodega[bod_nombre] = {
                'diasProm': round(sum(dias_list) / len(dias_list), 1),
                'n': len(dias_list),
            }

        productos[cod] = {
            'diasProm': round(sum(todos_dias) / len(todos_dias), 1),
            'nRecepciones': len(todos_dias),
            'proveedores': proveedores,
            'porBodega': por_bodega,  # {'PEM':{diasProm,n}, 'SEM':{...}, ...} - bodega receptora real
        }

    return productos


def main():
    log('[descargar_oc_leadtime] Iniciando...')

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
        productos = generar(cursor)
    except Exception as e:
        log(f'[ERROR] generar: {e}')
        cursor.close(); conn.close()
        sys.exit(1)
    cursor.close(); conn.close()

    out = DATA_DIR / 'oc-leadtime.json'
    try:
        DATA_DIR.mkdir(exist_ok=True)
        with open(out, 'w', encoding='utf-8') as f:
            json.dump({
                'generado':    datetime.datetime.now().isoformat(timespec='seconds'),
                'fuente':      'M_DOCUMENTOS_DETALLE (OC->GRC/GRT/GIB join) — El Manzano',
                'ventanaDias': VENTANA_DIAS,
                'productos':   productos,
            }, f, ensure_ascii=False, separators=(',', ':'))
    except Exception as e:
        log(f'[ERROR] No se pudo escribir {out}: {e}')
        sys.exit(1)

    log(f'[OK] oc-leadtime.json: {len(productos)} productos')
    log('[descargar_oc_leadtime] FINALIZADO')


if __name__ == '__main__':
    main()
