"""
Procesa actualizar.xlsx (2 hojas ERP) y actualiza Datos.xlsx.

Deteccion automatica de columnas por similitud de nombre (sin importar
tildes, mayusculas/minusculas ni orden de columnas).

Mapeos ERP -> sistema:
  Hoja 1: Codigo/Código -> CODIGO | Valor Total -> PRECIO_IVA (= SOCIO_IVA)
  Hoja 2: Codigo_Tecnico -> CODIGO | Disp -> STOCK | Costo Promedio -> COSTO_PROMEDIO

Limpieza automatica:
  - Elimina filas donde DESCRIPCION contiene '(DD)'
  - Elimina filas donde MARCA contiene 'DESCONTINUADO'
  - Elimina filas donde MARCA contiene 'CALZADO'
  - Elimina duplicados por CODIGO (primer valor gana)

Flujo de escritura:
  BACKUP → LEER → DEDUPLICAR EN MEMORIA → LIMPIAR Datos.xlsx → ESCRIBIR → VERIFICAR
"""
import pandas as pd
import unicodedata
import sys
import shutil
import os
from datetime import datetime
from pathlib import Path

BASE         = Path(__file__).parent.parent
ACTUALIZXLSX = BASE / "actualizar.xlsx"
DATOSXLSX    = BASE / "Datos.xlsx"

COLS_ORDEN = ["CODIGO", "DESCRIPCION", "MARCA", "HIPERFAMILIA", "FAMILIA", "SUBFAMILIA",
              "COSTO_PROMEDIO", "PRECIO_IVA", "SOCIO_IVA",
              "PEM_DISP", "PEM_TRANS", "PEM_BOD", "SEM_DISP", "SEM_BOD", "CEM_DISP", "CEM_BOD",
              "MEM_DISP", "MEM_BOD", "IEM_DISP", "IEM_TRANS", "TEM_DISP", "TEM_TRANS", "RCE_DISP", "CD_DISP", "CD_TRANS"]

MAPA_HOJA1 = [
    ("CODIGO",     ["COD"]),
    ("PRECIO_IVA", ["TOTAL"]),
]
MAPA_HOJA2 = [
    ("CODIGO",         ["COD"]),
    ("DESCRIPCION",    ["DESC"]),
    ("MARCA",          ["MARCA"]),
    ("HIPERFAMILIA",   ["HIPER"]),
    ("FAMILIA",        ["FAM"]),
    ("SUBFAMILIA",     ["SUB"]),
    ("COSTO_PROMEDIO", ["COSTO"]),
    ("PEM_DISP",       ["PEM_DISP", "DISP"]),   # Patio El Manzano — fallback a DISP (formato antiguo)
    ("PEM_TRANS",      ["PEM_TRANS", "TRANS"]), # Patio El Manzano — fallback a TRANS (formato antiguo)
    ("PEM_BOD",        ["PEM_BOD"]),    # Patio El Manzano — stock físico (St_Bod)
    ("SEM_DISP",       ["SEM_DISP"]),   # Sala El Manzano — disponible
    ("SEM_BOD",        ["SEM_BOD"]),    # Sala El Manzano — stock físico (St_Bod)
    ("CEM_DISP",       ["CEM_DISP"]),   # CEM — disponible
    ("CEM_BOD",        ["CEM_BOD"]),    # CEM — stock físico (St_Bod)
    ("MEM_DISP",       ["MEM_DISP"]),   # Mermas El Manzano
    ("MEM_BOD",        ["MEM_BOD"]),    # Mermas El Manzano -- stock fisico (St_Bod) — disponible
    ("IEM_DISP",       ["IEM_DISP"]),   # Ingreso El Manzano — disponible
    ("IEM_TRANS",      ["IEM_TRANS"]),  # Ingreso El Manzano — en transito
    ("TEM_DISP",       ["TEM_DISP"]),   # Tránsito El Manzano — disponible
    ("TEM_TRANS",      ["TEM_TRANS"]),  # Tránsito El Manzano — en tránsito
    ("RCE_DISP",       ["RCE_DISP"]),   # Recepción El Manzano — disponible
    ("CD_DISP",        ["CD_DISP"]),    # Centro de Distribución — disponible
    ("CD_TRANS",       ["CD_TRANS"]),   # Centro de Distribución — tránsito
]

FILTRO_MARCA      = ["DESCONTINUADO", "CALZADO", "OUTLET", "GARMENDIA"]
FILTRO_DESC       = ["(DD)"]
FILTRO_SUBFAMILIA = ["OUTLET"]


# ── UTILIDADES ──────────────────────────────────────────────────────────────────

def normalizar(texto):
    """Quita tildes y pasa a mayusculas para comparacion flexible."""
    return unicodedata.normalize("NFD", str(texto)) \
                      .encode("ascii", "ignore") \
                      .decode("ascii") \
                      .upper()


def detectar_columna(columnas_erp, palabras_clave):
    """Devuelve la columna ERP que contiene todas las palabras clave (sin tildes)."""
    for col in columnas_erp:
        col_norm = normalizar(col)
        if all(k in col_norm for k in palabras_clave):
            return col
    return None


COLS_OPCIONALES  = {"HIPERFAMILIA", "FAMILIA",
                    "PEM_TRANS", "PEM_BOD", "SEM_DISP", "SEM_BOD", "CEM_DISP", "CEM_BOD",
                    "MEM_DISP", "MEM_BOD", "IEM_DISP", "IEM_TRANS", "TEM_DISP", "TEM_TRANS", "RCE_DISP",
                    "CD_DISP", "CD_TRANS"}  # no fallan si la bodega no está disponible
COLS_NUMERICAS   = {"PEM_DISP", "PEM_TRANS", "PEM_BOD", "SEM_DISP", "SEM_BOD",
                    "CEM_DISP", "CEM_BOD", "MEM_DISP", "MEM_BOD",
                    "IEM_DISP", "IEM_TRANS", "TEM_DISP", "TEM_TRANS",
                    "RCE_DISP", "CD_DISP", "CD_TRANS", "COSTO_PROMEDIO"}            # default 0 cuando son opcionales

def mapear_columnas(df, mapa, hoja_nombre):
    # Buscar siempre en las columnas originales (antes de agregar columnas vacías)
    cols_originales = df.columns.tolist()
    renombres  = {}
    vacias     = []   # columnas opcionales no encontradas en el ERP
    usadas_erp = set()  # evita que dos destinos tomen la misma columna ERP

    for destino, claves in mapa:
        # Buscar saltando columnas ya asignadas (evita FAM→HIPERFAMILIA cuando ya se usó)
        col_erp = None
        for col in cols_originales:
            if col in usadas_erp:
                continue
            col_norm = normalizar(col)
            if all(k in col_norm for k in claves):
                col_erp = col
                break
        if col_erp is None:
            if destino in COLS_OPCIONALES:
                print(f"  [{hoja_nombre}] '{destino}' no encontrada en ERP — se usará vacío")
                vacias.append(destino)
                continue
            print(f"ERROR: Hoja '{hoja_nombre}' - no se encontro columna para '{destino}' (buscando: {claves})")
            print(f"  Columnas disponibles: {cols_originales}")
            sys.exit(1)
        renombres[col_erp] = destino
        usadas_erp.add(col_erp)
        print(f"  [{hoja_nombre}] '{col_erp}' -> {destino}")

    df = df.rename(columns=renombres)
    for col_vacia in vacias:
        # Numéricas → 0.0 para evitar conflicto de dtype con columnas float64
        # Texto      → None (NaN) para que notna() sea False y no se sobreescriban
        df[col_vacia] = 0.0 if col_vacia in COLS_NUMERICAS else None
    return df


def aplicar_filtros(df, hoja_nombre):
    """Aplica filtros de limpieza de filas. Retorna df filtrado."""
    total = len(df)

    if "MARCA" in df.columns:
        mascara = df["MARCA"].astype(str).str.upper().apply(
            lambda m: any(f in m for f in FILTRO_MARCA)
        )
        n = mascara.sum()
        if n:
            print(f"  ['{hoja_nombre}'] {n} eliminada(s) por MARCA (DESCONTINUADO/CALZADO/OUTLET/GARMENDIA)")
        df = df[~mascara]

    if "DESCRIPCION" in df.columns:
        mascara = df["DESCRIPCION"].astype(str).str.upper().apply(
            lambda d: any(f in d for f in FILTRO_DESC)
        )
        n = mascara.sum()
        if n:
            print(f"  ['{hoja_nombre}'] {n} eliminada(s) por DESCRIPCION con (DD)")
        df = df[~mascara]

    if "SUBFAMILIA" in df.columns:
        mascara = df["SUBFAMILIA"].astype(str).str.upper().apply(
            lambda s: any(f in s for f in FILTRO_SUBFAMILIA)
        )
        n = mascara.sum()
        if n:
            print(f"  ['{hoja_nombre}'] {n} eliminada(s) por SUBFAMILIA OUTLET")
        df = df[~mascara]

    print(f"  ['{hoja_nombre}'] {total} filas originales -> {len(df)} filas tras filtros")
    return df.reset_index(drop=True)


def deduplicar(df, hoja_nombre):
    """
    Deduplicacion en memoria: conserva el primero por CODIGO (criterio original).
    Retorna (df_limpio, n_duplicados).
    """
    antes = len(df)
    df = df.drop_duplicates(subset="CODIGO", keep="first").reset_index(drop=True)
    n_dup = antes - len(df)
    print(f"  Duplicados encontrados: {n_dup} | Registros despues de deduplicar: {len(df)}")
    return df, n_dup


def main():

    # ── BACKUP AUTOMÁTICO ───────────────────────────────────────────────────────
    if not ACTUALIZXLSX.exists():
        print(f"ERROR: No se encontro el archivo:")
        print(f"  {ACTUALIZXLSX}")
        print(f"  Coloca el informe ERP en esa ubicacion con ese nombre exacto.")
        sys.exit(1)
    if not DATOSXLSX.exists():
        print(f"ERROR: No se encontro {DATOSXLSX}")
        sys.exit(1)

    timestamp   = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BASE / f"datos_backup_{timestamp}.xlsx"
    shutil.copy2(DATOSXLSX, backup_path)
    print(f"[OK] Backup creado: {backup_path.name}")
    print()

    # Variable para saber si la operacion exitosa al final
    exito = False

    try:

        # ── PASO 1: LEER FUENTE ─────────────────────────────────────────────────
        print("=== PASO 1: Leyendo actualizar.xlsx ===")

        h1_raw = pd.read_excel(ACTUALIZXLSX, sheet_name=0, dtype=str)
        h1 = mapear_columnas(h1_raw, MAPA_HOJA1, "Hoja1-Precios")
        h1["PRECIO_IVA"] = pd.to_numeric(h1["PRECIO_IVA"], errors="coerce")
        h1["CODIGO"] = h1["CODIGO"].astype(str).str.strip()
        h1 = aplicar_filtros(h1[["CODIGO", "PRECIO_IVA"]], "Hoja1-Precios")

        h2_raw = pd.read_excel(ACTUALIZXLSX, sheet_name=1, dtype=str)
        # Compatibilidad formato antiguo: renombrar DISP→PEM_DISP y TRANS→PEM_TRANS
        if "DISP" in h2_raw.columns and "PEM_DISP" not in h2_raw.columns:
            h2_raw = h2_raw.rename(columns={"DISP": "PEM_DISP"})
            print("  [Hoja2] formato antiguo: DISP -> PEM_DISP")
        if "TRANS" in h2_raw.columns and "PEM_TRANS" not in h2_raw.columns:
            h2_raw = h2_raw.rename(columns={"TRANS": "PEM_TRANS"})
            print("  [Hoja2] formato antiguo: TRANS -> PEM_TRANS")
        h2 = mapear_columnas(h2_raw, MAPA_HOJA2, "Hoja2-Productos")
        for c in ["COSTO_PROMEDIO", "PEM_DISP", "PEM_TRANS", "PEM_BOD", "SEM_DISP", "SEM_BOD", "CEM_DISP", "CEM_BOD", "MEM_DISP", "IEM_DISP", "IEM_TRANS", "TEM_DISP", "TEM_TRANS", "RCE_DISP", "CD_DISP", "CD_TRANS"]:
            if c in h2.columns:
                h2[c] = pd.to_numeric(h2[c], errors="coerce")
        h2["CODIGO"] = h2["CODIGO"].astype(str).str.strip()

        # Columnas que van al catálogo
        cols_h2 = ["CODIGO", "DESCRIPCION", "MARCA", "HIPERFAMILIA", "FAMILIA",
                   "SUBFAMILIA", "COSTO_PROMEDIO", "PEM_DISP"]
        for c in ["PEM_TRANS", "PEM_BOD", "SEM_DISP", "SEM_BOD", "CEM_DISP", "CEM_BOD", "MEM_DISP", "MEM_BOD", "IEM_DISP", "IEM_TRANS", "TEM_DISP", "TEM_TRANS", "RCE_DISP", "CD_DISP", "CD_TRANS"]:
            if c in h2.columns:
                cols_h2.append(c)

        h2_completo = h2[cols_h2].copy()   # antes de filtrar (para merma)
        h2 = aplicar_filtros(h2_completo.copy(), "Hoja2-Productos")

        # ── GENERAR merma.json (productos filtrados = descontinuados/outlet/DD) ──
        import json as _json
        codigos_ok  = set(h2["CODIGO"])
        h2_merma    = h2_completo[~h2_completo["CODIGO"].isin(codigos_ok)].copy()
        if len(h2_merma) > 0:
            # Agregar precio de venta desde h1
            h1_tmp = pd.read_excel(ACTUALIZXLSX, sheet_name=0, dtype=str)
            h1_tmp = mapear_columnas(h1_tmp, MAPA_HOJA1, "Hoja1-Merma-Precios")
            h1_tmp["PRECIO_IVA"] = pd.to_numeric(h1_tmp["PRECIO_IVA"], errors="coerce").fillna(0).astype(int)
            h1_tmp["CODIGO"] = h1_tmp["CODIGO"].astype(str).str.strip()
            h2_merma = h2_merma.merge(h1_tmp[["CODIGO","PRECIO_IVA"]], on="CODIGO", how="left")
        else:
            h2_merma["PRECIO_IVA"] = 0
        for c in ["COSTO_PROMEDIO","PEM_DISP","PEM_TRANS","PEM_BOD","SEM_DISP","SEM_BOD","CEM_DISP","CEM_BOD","MEM_DISP","IEM_DISP","IEM_TRANS","TEM_DISP","TEM_TRANS","RCE_DISP","CD_DISP","CD_TRANS","PRECIO_IVA"]:
            if c in h2_merma.columns:
                h2_merma[c] = h2_merma[c].fillna(0).astype(int)
        # STOCK = suma de bodegas comerciales — campo de compatibilidad para el panel
        disp_cols = [c for c in ["PEM_DISP","SEM_DISP","CEM_DISP","MEM_DISP"] if c in h2_merma.columns]
        h2_merma["STOCK"] = h2_merma[disp_cols].sum(axis=1).astype(int) if disp_cols else 0
        # TRANSITO = PEM_TRANS para compatibilidad
        h2_merma["TRANSITO"] = h2_merma["PEM_TRANS"].astype(int) if "PEM_TRANS" in h2_merma.columns else 0
        merma_records = h2_merma.where(h2_merma.notna(), None).to_dict(orient="records")
        merma_path = BASE / "merma.json"
        with open(merma_path, "w", encoding="utf-8") as _f:
            _json.dump(merma_records, _f, ensure_ascii=False, indent=2)
        print(f"  merma.json generado: {len(merma_records)} productos de liquidacion/descontinuados")

        # Leer catalogo existente (solo lectura, NO se escribe aún)
        print()
        print("  Leyendo Datos.xlsx existente (solo lectura)...")
        datos = pd.read_excel(DATOSXLSX, dtype={"CODIGO": str}, sheet_name="Sheet1")
        datos["CODIGO"] = datos["CODIGO"].astype(str).str.strip()
        if "STOCK" not in datos.columns:
            datos["STOCK"] = 0
        print(f"  Datos.xlsx: {len(datos)} filas cargadas")
        print()

        # ── PASO 2: DEDUPLICAR EN MEMORIA ───────────────────────────────────────
        print("=== PASO 2: Deduplicando en memoria (criterio: conservar el primero) ===")

        # 2a. Deduplicar Hoja1 (precios del ERP)
        h1, n_dup_h1 = deduplicar(h1, "Hoja1-Precios")
        h1["SOCIO_IVA"] = h1["PRECIO_IVA"]

        sin_precio = h1["PRECIO_IVA"].isna().sum()
        if sin_precio:
            print(f"  AVISO: {sin_precio} codigo(s) sin precio valido en Hoja1")

        # 2b. Deduplicar Hoja2 (productos del ERP)
        h2, n_dup_h2 = deduplicar(h2, "Hoja2-Productos")

        # 2c. Combinar las dos hojas del ERP en un solo DataFrame de actualizacion
        actualizacion = h2.merge(
            h1[["CODIGO", "PRECIO_IVA", "SOCIO_IVA"]],
            on="CODIGO", how="left"
        )
        # Deduplicar el resultado del merge (por si un mismo CODIGO estaba
        # en ambas hojas con distintos datos)
        actualizacion, n_dup_merge = deduplicar(actualizacion, "Actualizacion-merged")

        # 2d. Deduplicar el catalogo existente ANTES de usarlo como base
        #     (puede tener duplicados de una ejecucion anterior fallida)
        # No aplicar filtros a productos ya existentes — se preservan aunque el ERP
        # cambie su MARCA a DESCONTINUADO. Solo se filtran productos NUEVOS (ver h2).
        n_datos_antes_dup = len(datos)
        datos, n_dup_datos = deduplicar(datos, "Datos.xlsx-existente")
        print()

        # 2e. Aplicar actualizacion sobre el catalogo limpio y deduplicado
        total_antes     = len(datos)
        codigos_exist   = set(datos["CODIGO"])
        nuevos          = actualizacion[~actualizacion["CODIGO"].isin(codigos_exist)]
        existentes      = actualizacion[ actualizacion["CODIGO"].isin(codigos_exist)]

        # Actualizar columnas de productos ya existentes
        # Usamos merge (mas seguro que set_index cuando puede haber duplicados residuales)
        cols_actualizar = ["PRECIO_IVA", "SOCIO_IVA", "COSTO_PROMEDIO", "MARCA", "HIPERFAMILIA", "FAMILIA", "SUBFAMILIA",
                           "PEM_DISP", "PEM_TRANS", "PEM_BOD", "SEM_DISP", "SEM_BOD", "CEM_DISP", "CEM_BOD",
                           "MEM_DISP", "MEM_BOD", "IEM_DISP", "IEM_TRANS", "TEM_DISP", "TEM_TRANS", "RCE_DISP", "CD_DISP", "CD_TRANS"]
        cols_update     = ["CODIGO"] + [c for c in cols_actualizar if c in existentes.columns]
        datos = datos.merge(
            existentes[cols_update],
            on="CODIGO", how="left", suffixes=("", "_new")
        )
        COLS_NUM = {"PRECIO_IVA", "SOCIO_IVA", "COSTO_PROMEDIO",
                    "PEM_DISP", "PEM_TRANS", "PEM_BOD", "SEM_DISP", "SEM_BOD", "CEM_DISP", "CEM_BOD",
                    "MEM_DISP", "MEM_BOD", "IEM_DISP", "IEM_TRANS", "TEM_DISP", "TEM_TRANS", "RCE_DISP",
                    "CD_DISP", "CD_TRANS"}
        for col in cols_actualizar:
            col_new = col + "_new"
            if col_new not in datos.columns:
                continue
            src = datos[col_new]
            if col in COLS_NUM:
                # Coerce numeric → evita asignar StringArray a float64
                src = pd.to_numeric(src, errors="coerce")
            else:
                # Texto: convertir StringDtype → object puro (str o None)
                src = src.astype(object)
                # Si el destino quedó float64 por ser todo-NaN, convertirlo a object
                if col in datos.columns and datos[col].dtype.kind == 'f':
                    datos[col] = datos[col].astype(object)
            mask_valido = src.notna()
            if mask_valido.any():
                datos.loc[mask_valido, col] = src[mask_valido]
            datos.drop(columns=[col_new], inplace=True)

        # Agregar productos nuevos
        if len(nuevos) > 0:
            datos = pd.concat([datos, nuevos.reindex(columns=COLS_ORDEN)], ignore_index=True)

        # Asegurar todas las columnas en el orden correcto
        for col in COLS_ORDEN:
            if col not in datos.columns:
                datos[col] = None
        datos = datos[COLS_ORDEN].sort_values("CODIGO").reset_index(drop=True)

        # Deduplicacion final del DataFrame completo (garantia de integridad)
        datos, n_dup_final = deduplicar(datos, "resultado-final")

        n_duplicados_total = n_dup_h1 + n_dup_h2 + n_dup_datos + n_dup_final

        # ── PASO 3: LIMPIAR Datos.xlsx ──────────────────────────────────────────
        print("=== PASO 3: Limpiando Datos.xlsx antes de escribir ===")
        # pd.ExcelWriter con mode='w' sobrescribe el archivo completo,
        # equivalente a borrar todas las filas y reescribir desde cero.
        # Usamos un archivo temporal para garantizar atomicidad:
        # si la escritura falla a mitad, el original (ya respaldado) no queda corrupto.
        import tempfile
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".xlsx", dir=BASE)
        os.close(tmp_fd)
        print(f"  Archivo temporal: {Path(tmp_path).name}")

        # ── PASO 4: ESCRIBIR DATOS LIMPIOS ──────────────────────────────────────
        print()
        print("=== PASO 4: Escribiendo datos limpios en Datos.xlsx ===")
        with pd.ExcelWriter(tmp_path, engine="openpyxl", mode="w") as writer:
            datos.to_excel(writer, index=False, sheet_name="Sheet1")

        # Reemplazar el original solo cuando la escritura completo sin errores
        os.replace(tmp_path, DATOSXLSX)
        print(f"  Datos.xlsx reemplazado correctamente.")

        # ── PASO 5: VERIFICACIÓN FINAL ──────────────────────────────────────────
        print()
        print("=== PASO 5: Verificacion final ===")
        print(f"  Productos antes (catalogo existente) : {total_antes}")
        print(f"  Actualizados desde ERP               : {len(existentes)}")
        print(f"  Nuevos productos agregados           : {len(nuevos)}")
        print()
        print(f"[OK] Datos.xlsx actualizado correctamente.")
        print(f"   Productos escritos           : {len(datos)}")
        print(f"   Duplicados eliminados (total): {n_duplicados_total}")
        print(f"   Archivo limpiado antes de escribir: SI")

        exito = True

        # Señal para main.py: omite descargar_bodegas() si ya corrió hoy
        import json as _json_sig
        _sig = BASE.parent / "data" / "catalogo-dinamico.json"
        _sig.parent.mkdir(exist_ok=True)
        with open(_sig, "w", encoding="utf-8") as _f:
            _json_sig.dump({"generado": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"), "productos": len(datos)}, _f)
        print(f"[OK] catalogo-dinamico.json escrito ({len(datos)} productos)")

        # Centinela de fecha para _catalogo_generado_hoy() en main.py
        (_sig.parent.parent / ".pipeline_date").write_text(
            datetime.now().strftime("%Y-%m-%d"), encoding="ascii"
        )

    except Exception as e:
        print()
        print(f"[ERROR] durante la actualizacion:")
        print(f"   {e}")
        # Limpiar temporal si quedó a medias
        try:
            if 'tmp_path' in locals() and os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass
        print()
        print(f"[AVISO] El backup se conserva para restauracion manual:")
        print(f"   {backup_path}")
        print(f"   Para restaurar: copia {backup_path.name} sobre Datos.xlsx")
        sys.exit(1)

    finally:
        # Eliminar backup solo si todo salió bien
        if exito:
            try:
                os.remove(backup_path)
                print(f"[OK] Backup eliminado (actualizacion exitosa)")
            except Exception:
                print(f"   (No se pudo eliminar el backup automaticamente: {backup_path.name})")


if __name__ == "__main__":
    main()
