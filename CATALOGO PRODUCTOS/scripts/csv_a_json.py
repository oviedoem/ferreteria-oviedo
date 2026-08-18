import pandas as pd
import json
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, firestore as fs_admin

# Solo inicializar si no está ya inicializado (evita error en ejecuciones múltiples)
if not firebase_admin._apps:
    # Ruta absoluta confirmada — credencial vive fuera del árbol del script
    _cred_path = r'E:\config\ferreteria-oviedo-b143e8e7b77d.json'
    firebase_admin.initialize_app(credentials.Certificate(_cred_path))
_db_admin = fs_admin.client()

base = Path(__file__).parent.parent

df = pd.read_csv(base / "Datos.csv", dtype={"CODIGO": str}, encoding="utf-8-sig")

# Convertir numéricos a entero
for col in ["PRECIO_IVA", "SOCIO_IVA", "COSTO_PROMEDIO",
            "PEM_DISP", "PEM_TRANS", "PEM_BOD", "SEM_DISP", "SEM_BOD",
            "CEM_DISP", "CEM_BOD", "MEM_DISP",
            "IEM_DISP", "IEM_TRANS", "TEM_DISP", "TEM_TRANS", "RCE_DISP",
            "CD_DISP", "CD_TRANS"]:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)

# Convertir texto vacío a string vacío (evita NaN en JSON)
for col in ["DESCRIPCION", "MARCA", "HIPERFAMILIA", "FAMILIA", "SUBFAMILIA"]:
    if col in df.columns:
        df[col] = df[col].fillna("").astype(str)

mapa = {
    "CODIGO": "codigo",
    "DESCRIPCION": "descripcion",
    "MARCA": "marca",
    "HIPERFAMILIA": "hiperfamilia",
    "FAMILIA": "familia",
    "SUBFAMILIA": "subfamilia",
    "COSTO_PROMEDIO": "costopromedio",
    "PRECIO_IVA": "precioiva",
    "SOCIO_IVA": "socioiva",
    "PEM_DISP": "pem",
    "PEM_TRANS": "pem_trans",
    "PEM_BOD": "pem_bod",
    "SEM_DISP": "sem",
    "SEM_BOD": "sem_bod",
    "CEM_DISP": "cem",
    "CEM_BOD": "cem_bod",
    "MEM_DISP": "mem",
    "MEM_BOD": "mem_bod",
    "IEM_DISP": "iem",
    "IEM_TRANS": "iem_trans",
    "TEM_DISP": "tem",
    "TEM_TRANS": "tem_trans",
    "RCE_DISP": "rce",
    "CD_DISP": "cd",
    "CD_TRANS": "cd_trans",
}  # ← llave de cierre que faltaba

df = df.rename(columns={k: v for k, v in mapa.items() if k in df.columns})
cols_app = [v for v in mapa.values() if v in df.columns]
registros = df[cols_app].where(df[cols_app].notna(), None).to_dict(orient="records")

with open(base / "Datos.json", "w", encoding="utf-8") as f:
    json.dump(registros, f, ensure_ascii=False, indent=2)

print(f"[OK] Datos.json generado: {len(registros)} productos")

# Split seguro: catálogo público con stock pem+sem — sin precios
# Claves en minúsculas — confirmado en el diccionario "mapa" de este script
CAMPOS_PUBLICOS = ['codigo', 'descripcion', 'marca', 'familia', 'subfamilia', 'pem', 'sem']
publicos = [{k: r.get(k, '') for k in CAMPOS_PUBLICOS} for r in registros]

with open(base / "Datos-publico.json", "w", encoding="utf-8") as f:
    json.dump(publicos, f, ensure_ascii=False)

print(f"[csv_a_json] Datos-publico.json -> {len(publicos)} productos (con pem+sem, sin precios)")

# 1 escritura Firestore — todos los precios en 1 documento (límite 1MB, ~150KB real)
mapa_precios = {}
for r in registros:
    cod = str(r.get('codigo', '') or '').strip()
    if not cod:
        continue
    precio = int(r.get('precioiva', 0) or 0)
    stock = (int(r.get('pem', 0) or 0) +
             int(r.get('sem', 0) or 0) +
             int(r.get('cem', 0) or 0) +
             int(r.get('mem', 0) or 0))
    mapa_precios[cod] = {'p': precio, 's': stock}

_db_admin.collection('precios').document('catalogo').set({'productos': mapa_precios})
print(f"[csv_a_json] precios/catalogo -> {len(mapa_precios)} productos en Firestore (1 doc)")

import sys
tam_kb = sys.getsizeof(str(mapa_precios)) / 1024
print(f"[csv_a_json] Tamaño estimado del doc: {tam_kb:.1f} KB (límite: 1024 KB)")
