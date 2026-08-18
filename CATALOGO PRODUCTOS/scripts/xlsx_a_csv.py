import pandas as pd
from pathlib import Path

base = Path(__file__).parent.parent
df = pd.read_excel(base / "Datos.xlsx", dtype={"CODIGO": str})

# Convertir numericos a entero para evitar floats (19880.0 → 19880) en el CSV
# Si num() en los paneles ve "19880.0", elimina el punto → 198800 (ERROR)
for col in ["PRECIO_IVA", "SOCIO_IVA", "COSTO_PROMEDIO",
            "PEM_DISP", "PEM_TRANS", "PEM_BOD", "SEM_DISP", "SEM_BOD",
            "CEM_DISP", "CEM_BOD", "MEM_DISP", "MEM_BOD",
            "IEM_DISP", "IEM_TRANS", "TEM_DISP", "TEM_TRANS", "RCE_DISP", "CD_DISP", "CD_TRANS"]:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)

df.to_csv(base / "Datos.csv", index=False, encoding="utf-8-sig")
print("  Datos.csv generado:", len(df), "productos")
