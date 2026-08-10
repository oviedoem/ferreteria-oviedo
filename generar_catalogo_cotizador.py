"""
generar_catalogo_cotizador.py
Genera catalogo-cotizador.json con campos v3m/v6m (unidades vendidas).
Lee data/ventas-manzano-YYYY-MM.json (generados por main.py PASO 2).
Sin SQL Server, sin configuracion adicional.
"""

import json, os, sys
from datetime import date
from pathlib import Path

BASE        = Path(__file__).parent
DATOS_JSON  = BASE / "CATALOGO PRODUCTOS" / "Datos.json"
DATA_DIR    = BASE / "data"
SALIDA      = BASE / "catalogo-cotizador.json"


def log(msg):
    try:
        print(msg, flush=True)
    except UnicodeEncodeError:
        print(str(msg).encode("ascii", errors="replace").decode("ascii"), flush=True)


def meses_en_ventana(n):
    """Lista de strings 'YYYY-MM' desde hace N meses hasta el mes actual."""
    hoy = date.today()
    resultado = []
    for delta in range(n + 1):
        m = hoy.month - delta
        y = hoy.year
        while m <= 0:
            m += 12
            y -= 1
        resultado.append(f"{y:04d}-{m:02d}")
    return resultado


def cargar_rotacion(meses_atras):
    meses = set(meses_en_ventana(meses_atras))
    totales = {}
    leidos = 0
    for mes in sorted(meses):
        path = DATA_DIR / f"ventas-manzano-{mes}.json"
        if not path.exists():
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                data = list(data.values())
            for r in data:
                cod  = str(r.get("codigo") or r.get("Codigo") or "").strip().upper()
                cant = float(r.get("cantidad") or r.get("Cantidad") or 0)
                if cod and cant > 0:
                    totales[cod] = totales.get(cod, 0) + cant
            leidos += 1
        except Exception as e:
            log(f"  [AVISO] {path.name}: {e}")
    return totales, leidos


log("[1/3] Cargando rotacion desde ventas mensuales...")
rot3m, n3 = cargar_rotacion(3)
rot6m, n6 = cargar_rotacion(6)
log(f"  v3m: {len(rot3m)} SKUs en {n3} archivos | v6m: {len(rot6m)} SKUs en {n6} archivos")

if n6 == 0:
    log("  [AVISO] No hay archivos ventas-manzano-YYYY-MM.json en data/")
    log("  El catalogo se generara sin campos v3m/v6m (columnas mostraran N/D en el panel)")

log("[2/3] Leyendo Datos.json...")
try:
    with open(DATOS_JSON, "r", encoding="utf-8") as f:
        datos = json.load(f)
except FileNotFoundError:
    log(f"  [ERROR] No se encontro {DATOS_JSON}")
    sys.exit(1)
log(f"  {len(datos)} productos")

log("[3/3] Generando catalogo-cotizador.json...")
cotizador = []
for p in datos:
    cod = str(p.get("codigo") or "").strip().upper()
    obj = {
        "codigo":        p.get("codigo", ""),
        "descripcion":   p.get("descripcion", ""),
        "marca":         (p.get("marca") or "").strip(),
        "familia":       p.get("familia", ""),
        "subfamilia":    p.get("subfamilia", ""),
        "precioiva":     int(p.get("precioiva")     or 0),
        "socioiva":      int(p.get("socioiva")      or 0),
        "costopromedio": int(p.get("costopromedio") or 0),
        "sem":           int(p.get("sem")           or 0),
        "pem":           int(p.get("pem")           or 0),
        "cd":            int(p.get("cd")            or 0),
    }
    v3 = rot3m.get(cod)
    v6 = rot6m.get(cod)
    if v3 is not None:
        obj["v3m"] = int(v3)
    if v6 is not None:
        obj["v6m"] = int(v6)
    cotizador.append(obj)

con_rot = sum(1 for p in cotizador if "v3m" in p)
with open(SALIDA, "w", encoding="utf-8") as f:
    json.dump(cotizador, f, ensure_ascii=False, separators=(",", ":"))

kb = os.path.getsize(SALIDA) // 1024
log(f"  {len(cotizador)} productos | {con_rot} con rotacion | {kb} KB")
log(f"  {SALIDA}")
log("[OK] catalogo-cotizador.json listo")
