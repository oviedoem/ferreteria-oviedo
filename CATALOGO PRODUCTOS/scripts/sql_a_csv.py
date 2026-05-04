#!/usr/bin/env python3
# ============================================================
# sql_a_csv.py — Ferretería Oviedo
# Convierte archivo SQL con INSERT INTO productos → Datos.csv
# Uso:
#   python sql_a_csv.py                      (usa productos.sql por defecto)
#   python sql_a_csv.py mi_catalogo.sql      (archivo SQL personalizado)
#   python sql_a_csv.py --preview            (solo muestra, no escribe)
#   python sql_a_csv.py --subir              (escribe CSV + hace git push)
# ============================================================

import re
import csv
import sys
import os
import subprocess
from datetime import datetime

# ── CONFIG ──────────────────────────────────────────────────
SQL_DEFAULT     = 'productos.sql'
CSV_SALIDA      = 'CATALOGO PRODUCTOS/Datos.csv'
COLUMNAS_CSV    = ['Codigo', 'Descripcion', 'Marca', 'SubFamilia', 'PrecioIVA', 'SocioIVA']
MARGEN_SOCIO    = 0.90   # Precio socio = PrecioIVA * 0.90 (descuento 10%)
ENCODING        = 'utf-8-sig'  # BOM para que Excel lo abra bien
# ────────────────────────────────────────────────────────────

VERDE  = '\033[92m'
ROJO   = '\033[91m'
CYAN   = '\033[96m'
AMARIL = '\033[93m'
RESET  = '\033[0m'
BOLD   = '\033[1m'

def ok(m):   print(f"  {VERDE}✅{RESET} {m}")
def err(m):  print(f"  {ROJO}❌{RESET} {m}")
def info(m): print(f"  {CYAN}ℹ️ {RESET} {m}")
def warn(m): print(f"  {AMARIL}⚠️ {RESET} {m}")

# ── PARSEO SQL → lista de dicts ─────────────────────────────
def parsear_sql(contenido_sql):
    """
    Acepta INSERT en 3 formatos:
    1. INSERT INTO productos VALUES ('COD','DESC','MARCA',PRECIO);
    2. INSERT INTO productos (codigo,descripcion,marca,subfamilia,precio,precio_socio) VALUES (...);
    3. INSERT INTO productos (codigo,descripcion,marca,precio) VALUES (...);
    """
    productos = []
    errores   = []

    # Detectar si hay definición de columnas
    patron_col = re.compile(
        r"INSERT\s+INTO\s+\w+\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)",
        re.IGNORECASE
    )
    patron_pos = re.compile(
        r"INSERT\s+INTO\s+\w+\s+VALUES\s*\(([^)]+)\)",
        re.IGNORECASE
    )

    def limpiar(v):
        v = v.strip().strip("'\"")
        return v

    def parsear_fila(row_str):
        """Parsea una fila de VALUES respetando strings con comas dentro."""
        items, cur, in_q, qc = [], '', False, ''
        for ch in row_str:
            if ch in ('"', "'") and not in_q:
                in_q, qc = True, ch
            elif ch == qc and in_q:
                in_q = False
            elif ch == ',' and not in_q:
                items.append(cur.strip()); cur = ''
                continue
            cur += ch
        items.append(cur.strip())
        return [limpiar(x) for x in items]

    lineas = contenido_sql.splitlines()
    for i, linea in enumerate(lineas, 1):
        linea = linea.strip()
        if linea.startswith('--') or not linea:
            continue

        # Formato con columnas explícitas
        m = patron_col.search(linea)
        if m:
            cols_raw = [c.strip().lower() for c in m.group(1).split(',')]
            vals     = parsear_fila(m.group(2))
            if len(vals) < len(cols_raw):
                errores.append(f"Línea {i}: columnas/valores no coinciden → {linea[:60]}")
                continue
            # Mapear columnas a campos estándar
            mapeo = {}
            for j, col in enumerate(cols_raw):
                col_n = re.sub(r'[^a-z]', '', col)
                if   'cod'   in col_n:             mapeo['Codigo']      = vals[j]
                elif 'desc'  in col_n:             mapeo['Descripcion'] = vals[j]
                elif 'marc'  in col_n:             mapeo['Marca']       = vals[j]
                elif 'sub'   in col_n or 'fam' in col_n: mapeo['SubFamilia'] = vals[j]
                elif 'socio' in col_n:             mapeo['SocioIVA']    = vals[j]
                elif 'prec'  in col_n or 'iva' in col_n: mapeo['PrecioIVA']  = vals[j]
            prod = {c: mapeo.get(c, '') for c in COLUMNAS_CSV}
            if not prod['Codigo'] or not prod['PrecioIVA']:
                errores.append(f"Línea {i}: Código o Precio vacío → {linea[:60]}")
                continue
            if not prod['SocioIVA']:
                try:
                    prod['SocioIVA'] = str(int(float(prod['PrecioIVA']) * MARGEN_SOCIO))
                except: pass
            productos.append(prod)
            continue

        # Formato posicional VALUES (cod, desc, marca, precio) o (cod, desc, marca, subfamilia, precio)
        m2 = patron_pos.search(linea)
        if m2:
            vals = parsear_fila(m2.group(1))
            prod = {c: '' for c in COLUMNAS_CSV}
            if len(vals) >= 4:
                prod['Codigo']      = vals[0]
                prod['Descripcion'] = vals[1]
                prod['Marca']       = vals[2]
                if len(vals) == 4:
                    prod['PrecioIVA'] = vals[3]
                elif len(vals) == 5:
                    prod['SubFamilia'] = vals[3]
                    prod['PrecioIVA']  = vals[4]
                elif len(vals) >= 6:
                    prod['SubFamilia'] = vals[3]
                    prod['PrecioIVA']  = vals[4]
                    prod['SocioIVA']   = vals[5]
                if not prod['SocioIVA']:
                    try:
                        prod['SocioIVA'] = str(int(float(prod['PrecioIVA']) * MARGEN_SOCIO))
                    except: pass
                productos.append(prod)
            else:
                errores.append(f"Línea {i}: pocos valores → {linea[:60]}")

    return productos, errores

# ── LEER CSV EXISTENTE ───────────────────────────────────────
def leer_csv_existente(ruta):
    if not os.path.exists(ruta):
        return []
    productos = []
    try:
        with open(ruta, 'r', encoding=ENCODING, errors='replace') as f:
            reader = csv.DictReader(f)
            for row in reader:
                productos.append({c: row.get(c,'') for c in COLUMNAS_CSV})
    except Exception as e:
        warn(f"No se pudo leer CSV existente: {e}")
    return productos

# ── ESCRIBIR CSV ─────────────────────────────────────────────
def escribir_csv(productos, ruta):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, 'w', newline='', encoding=ENCODING) as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNAS_CSV)
        writer.writeheader()
        for p in productos:
            writer.writerow({c: p.get(c,'') for c in COLUMNAS_CSV})

# ── GIT PUSH ─────────────────────────────────────────────────
def git_push():
    print(f"\n  {CYAN}Subiendo cambios a GitHub...{RESET}")
    cmds = [
        ['git', 'add', CSV_SALIDA],
        ['git', 'commit', '-m', f'Actualizar catálogo {datetime.now().strftime("%Y-%m-%d %H:%M")}'],
        ['git', 'push', 'origin', 'main'],
    ]
    for cmd in cmds:
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            err(f"{' '.join(cmd[1:])}: {r.stderr.strip() or r.stdout.strip()}")
            return False
        ok(' '.join(cmd[1:]))
    ok("¡GitHub Pages actualizado! Las apps verán los precios nuevos en ~1 min.")
    return True

# ── MAIN ─────────────────────────────────────────────────────
def main():
    args     = sys.argv[1:]
    preview  = '--preview' in args
    subir    = '--subir'   in args
    archivos = [a for a in args if not a.startswith('--')]
    sql_path = archivos[0] if archivos else SQL_DEFAULT

    print(f"\n{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}  🔩 SQL → CSV — Ferretería Oviedo{RESET}")
    print(f"{CYAN}{'='*60}{RESET}\n")
    print(f"  Archivo SQL: {sql_path}")
    print(f"  CSV salida:  {CSV_SALIDA}")
    print(f"  Modo:        {'SOLO VISTA PREVIA' if preview else 'ESCRIBIR CSV' + (' + GIT PUSH' if subir else '')}")

    # Leer SQL
    if not os.path.exists(sql_path):
        err(f"Archivo no encontrado: {sql_path}")
        print(f"\n  {AMARIL}Crea el archivo {sql_path} con los INSERT INTO productos.{RESET}")
        print(f"  Ejemplo:\n    INSERT INTO productos VALUES ('H001','Martillo 16oz','Tramontina',1500);")
        sys.exit(1)

    with open(sql_path, 'r', encoding='utf-8', errors='replace') as f:
        sql = f.read()

    # Parsear
    nuevos, errores = parsear_sql(sql)
    print(f"\n  {VERDE}Productos parseados: {len(nuevos)}{RESET}")
    if errores:
        warn(f"{len(errores)} líneas con errores:")
        for e in errores[:5]:
            print(f"    • {e}")
        if len(errores) > 5:
            print(f"    ... y {len(errores)-5} más")

    if not nuevos:
        err("No se encontraron productos válidos en el SQL.")
        sys.exit(1)

    # Comparar con CSV existente
    existentes = leer_csv_existente(CSV_SALIDA)
    existentes_map = {p['Codigo']: p for p in existentes}
    nuevos_codigos  = {p['Codigo'] for p in nuevos}
    prev_codigos    = set(existentes_map.keys())
    agregados       = nuevos_codigos - prev_codigos
    eliminados      = prev_codigos  - nuevos_codigos
    modificados     = []
    for p in nuevos:
        if p['Codigo'] in existentes_map:
            old = existentes_map[p['Codigo']]
            if old.get('PrecioIVA') != p.get('PrecioIVA') or old.get('Descripcion') != p.get('Descripcion'):
                modificados.append(p['Codigo'])

    print(f"\n  Cambios detectados:")
    print(f"    ➕ Nuevos:      {len(agregados)}")
    print(f"    ✏️  Modificados: {len(modificados)}")
    print(f"    ➖ Eliminados:  {len(eliminados)}")

    # Vista previa de primeros 5
    print(f"\n  Vista previa (primeros 5):")
    print(f"  {'Código':<10} {'Descripción':<35} {'Precio':<10} {'Socio':<10}")
    print(f"  {'-'*68}")
    for p in nuevos[:5]:
        desc = p['Descripcion'][:33]
        print(f"  {p['Codigo']:<10} {desc:<35} ${p['PrecioIVA']:<9} ${p['SocioIVA']:<9}")
    if len(nuevos) > 5:
        print(f"  ... y {len(nuevos)-5} productos más")

    if preview:
        print(f"\n  {AMARIL}Modo PREVIEW — no se escribió ningún archivo.{RESET}\n")
        return

    # Escribir
    escribir_csv(nuevos, CSV_SALIDA)
    ok(f"CSV escrito: {CSV_SALIDA}  ({len(nuevos)} productos)")

    if subir:
        git_push()

    print(f"\n{CYAN}{'='*60}{RESET}")
    print(f"{VERDE}  ✅ Proceso completado{RESET}")
    if not subir:
        print(f"  Para publicar: python sql_a_csv.py {sql_path} --subir")
        print(f"  O manualmente: git add '{CSV_SALIDA}' && git commit -m 'Precios' && git push")
    print()

if __name__ == '__main__':
    main()
