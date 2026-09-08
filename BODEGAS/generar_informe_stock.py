"""
generar_informe_stock.py  V1.1  2026-07-01
Lee raw_bloque1/2_YYYYMMDD.csv (ya descargados por descargar_erp.py)
Pivota St_Disp, St_Bod y St_Ped por bodega para PEM, SEM, CEM, MEM
Genera: data/informe-stock.json
  { cod: { pem_disp, sem_disp, cem_disp, mem_disp,
            pem_bod, sem_bod, cem_bod, mem_bod,
            pem_ped, sem_ped, cem_ped, mem_ped } }

  St_Disp = disponible real (columna Disp del panel) — SSRS, misma corrida que St_Bod.
            Antes NO se leia: el panel usaba el Disponible del Excel manual
            (Datos.json / actualizar.xlsx), que puede quedar desactualizado. Confirmado
            2026-07-01: SIKA0310/SEM tenia Disp=0 en Datos.json mientras el CSV SSRS de
            la misma corrida ya traia Disp=14 (igual a R_STOCK_PRODUCTOS en vivo).
  St_Bod  = stock fisico real en bodega (columna Fís del panel)
  St_Ped  = pedidos NVM vigentes; fuente de columna Ped del panel
           St_DVen (BVE/FVE emitidas) NO se suma: no reduce St_Disp en el ERP
           y ya aparece en Dif = Fís − Disp cuando corresponde.

NOTA: pem_ped incluye vendedores de otras sucursales que usan bodegas del Manzano.
"""

import csv
import json
import sys
from pathlib import Path
from collections import defaultdict

BASE_DIR   = Path(r"E:\ferreteria-oviedo")
BACKUP_DIR = BASE_DIR / "CATALOGO PRODUCTOS" / "backups"
DATA_DIR   = BASE_DIR / "data"
_token_file = DATA_DIR / '.token-actual'
if _token_file.exists():
    DATA_DIR = DATA_DIR / _token_file.read_text(encoding='utf-8').strip()
OUT_FILE   = DATA_DIR / "informe-stock.json"

# Solo bodegas comerciales del Informe Stock
BODEGAS_KEY = {'PEM': 'pem', 'SEM': 'sem', 'CEM': 'cem', 'MEM': 'mem'}


def ultimo_csv(patron):
    archivos = sorted(BACKUP_DIR.glob(patron), reverse=True)
    if not archivos:
        print(f'[WARN] No encontrado: {patron}')
        return None
    return archivos[0]


def num(s):
    """
    Parsea número desde CSV SSRS (locale europeo).
    Punto = separador de miles (1.003 = 1003)
    Coma  = separador decimal  (1,50  = 1.50)
    Fix: eliminar puntos de miles ANTES de reemplazar coma decimal.
    """
    try:
        s = str(s or '0').strip()
        # 1) quitar puntos de miles  2) coma → decimal point
        s = s.replace('.', '').replace(',', '.')
        return float(s)
    except Exception:
        return 0.0


def leer_bloque(path):
    """Lee CSV de bloque; retorna lista de {cod, bod, st_bod, st_ped}."""
    if not path or not path.exists():
        return []
    rows = []
    with open(path, encoding='utf-8-sig', errors='replace') as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            cod = (row.get('Codigo') or '').strip()
            bod = (row.get('Bod') or '').strip().upper()
            if not cod or bod not in BODEGAS_KEY:
                continue
            rows.append({
                'cod':     cod,
                'bod':     bod,
                'st_disp': num(row.get('St_Disp', 0)),
                'st_bod':  num(row.get('St_Bod', 0)),
                # solo St_Ped (NVM vigentes); St_DVen no reduce St_Disp en el ERP
                # y ya está capturado en Dif = Fís − Disp cuando corresponde
                'st_ped':  num(row.get('St_Ped', 0)),
            })
    return rows


def main():
    print('[informe-stock] Iniciando...')

    b1_path = ultimo_csv('raw_bloque1_*.csv')
    b2_path = ultimo_csv('raw_bloque2_*.csv')

    print(f'  Bloque 1: {b1_path.name if b1_path else "NO ENCONTRADO"}')
    print(f'  Bloque 2: {b2_path.name if b2_path else "NO ENCONTRADO"}')

    if not b1_path and not b2_path:
        print('[ERROR] No se encontraron CSVs de bloque. Ejecuta descargar_erp.py primero.')
        sys.exit(1)

    filas = leer_bloque(b1_path) + leer_bloque(b2_path)
    print(f'  Total filas leidas (bodegas comerciales): {len(filas)}')

    # Pivot: (cod, bod) unico — si aparece dos veces en distintos bloques tomar el primero
    result = defaultdict(lambda: {
        'pem_disp': 0, 'sem_disp': 0, 'cem_disp': 0, 'mem_disp': 0,
        'pem_bod': 0, 'sem_bod': 0, 'cem_bod': 0, 'mem_bod': 0,
        'pem_ped': 0, 'sem_ped': 0, 'cem_ped': 0, 'mem_ped': 0,
    })
    seen = set()  # (cod, bod) ya procesados
    for r in filas:
        key = (r['cod'], r['bod'])
        if key in seen:
            continue
        seen.add(key)
        bk = BODEGAS_KEY[r['bod']]      # 'pem' / 'sem' / 'cem' / 'mem'
        result[r['cod']][f'{bk}_disp'] += r['st_disp']
        result[r['cod']][f'{bk}_bod'] += r['st_bod']
        result[r['cod']][f'{bk}_ped'] += r['st_ped']

    # Convertir a enteros (SSRS puede tener decimales .00000)
    out = {}
    for cod, d in result.items():
        out[cod] = {k: int(round(v)) for k, v in d.items()}

    DATA_DIR.mkdir(exist_ok=True)
    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)

    # Estadisticas
    con_bod = sum(
        1 for d in out.values()
        if any(d.get(f'{b}_bod', 0) > 0 for b in ['pem', 'sem', 'cem', 'mem'])
    )
    con_ped = sum(
        1 for d in out.values()
        if any(d.get(f'{b}_ped', 0) > 0 for b in ['pem', 'sem', 'cem', 'mem'])
    )
    print(f'[OK] informe-stock.json: {len(out)} productos')
    print(f'     Con Fisico>0: {con_bod} | Con Ped>0 (todas sucursales): {con_ped}')


if __name__ == '__main__':
    main()
