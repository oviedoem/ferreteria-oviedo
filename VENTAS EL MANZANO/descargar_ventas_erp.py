"""
descargar_ventas_erp.py — Descarga incremental de DOS reportes ERP en una sola sesión:

  1) "Ventas Por Producto"          -> transaccional (Fecha, Numero, Documento, Sucursal)
  2) "Ventas Por Cliente - Producto" -> enriquecimiento (Cliente, Cantidad)

Lógica incremental:
  - Detecta la fecha máxima ya descargada en ventas_erp_producto_*.xlsx
  - Solo descarga los días laborales chilenos faltantes (excluye domingos y feriados)
  - Combina el delta con el histórico existente (dedup por Numero+Codigo en prod)
  - Guarda Excel combinado con nombre de hoy

Salida:
  ventas_erp_producto_YYYYMMDD.xlsx   ← datos transaccionales (acumulado)
  ventas_erp_cliente_YYYYMMDD.xlsx    ← datos de cliente (acumulado)

Uso:
  python descargar_ventas_erp.py
  python descargar_ventas_erp.py 01-01-2026 20-05-2026
"""

import asyncio
import json
import os
import sys
import datetime
import configparser
from pathlib import Path


def _leer_credenciales():
    cfg = configparser.ConfigParser()
    ini = Path(__file__).parent / "credenciales_erp.ini"
    if ini.exists():
        cfg.read(str(ini), encoding="utf-8")
        erp = cfg["ERP"] if "ERP" in cfg else {}
        return {
            "base":   erp.get("BASE",   "http://200.6.113.97/Justweb_Foviedo"),
            "xtoken": erp.get("XTOKEN", "b91f9f93-985d-4231-a849-d2e06aa737df"),
            "user":   erp.get("USER",   "agonzalez"),
            "clave":  erp.get("CLAVE",  "4040"),
        }
    return {
        "base":   "http://200.6.113.97/Justweb_Foviedo",
        "xtoken": "b91f9f93-985d-4231-a849-d2e06aa737df",
        "user":   "agonzalez",
        "clave":  "4040",
    }


_CREDS            = _leer_credenciales()
ERP_BASE          = _CREDS["base"]
XTOKEN            = _CREDS["xtoken"]
USER              = _CREDS["user"]
CLAVE             = _CREDS["clave"]
FECHA_INI_DEFAULT = "01-01-2026"
SALIDA_DIR        = Path(__file__).parent

ERP_TO_GMAIL_USER = {
    "greyes":          "gregorioreyessalazar5",
    "jsubiabre":       "jaimesubiabre33",
    "rflores":         "rafaelaoviedo1983",
    "rvidal":          "ricpobletev",
    "agonzalez":       "alejandrog45",
    "callcentersexta": "callcentersexta",
    "ccaroca":         "ccaroca",
    "eduardo.paz":     "eduardo.paz",
    "jorge.bello":     "jorge.bello",
    "lmejias":         "lmejias",
    "pmoyanoj":        "pmoyanoj",
    "rmorar":          "rmorar",
}

TIPO_PRODUCTO = ["producto"]
TIPO_CLIENTE  = ["cliente", "producto"]


def log(msg):
    print(msg, flush=True)


def _limpiar_num(s):
    import math
    try:
        s = str(s).strip().replace("$", "").replace("\xa0", "")
        if s.lower() in ('nan', 'none', '', '-', 'n/a', 'inf', '-inf'):
            return 0.0
        if "," in s:
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(".", "")
        result = float(s) if s else 0.0
        return 0.0 if (math.isnan(result) or math.isinf(result)) else result
    except Exception:
        return 0.0


def _norm_cols(df):
    df.columns = [
        c.strip().lower()
         .replace(" ", "_").replace(".", "")
         .replace("\xa0", "").replace("%", "pct")
         .replace("(", "").replace(")", "")
        for c in df.columns
    ]
    return df


def _registros_desde_prod(df_prod, df_cli):
    fam_map = {}
    # qty_map: {(vendedor, codigo, neto_int): [{"cantidad": x, "cliente": y}, ...]}
    # Mismo filtro que df_prod (sub/tot + neto==0) para que los contadores coincidan.
    qty_map = {}

    if df_cli is not None:
        dc = _norm_cols(df_cli.copy())
        for _, row in dc.iterrows():
            vend_c = str(row.get("vendedor", "") or "").strip()
            if not vend_c or vend_c.lower().startswith("sub") or vend_c.lower().startswith("tot"):
                continue
            neto_c = _limpiar_num(str(row.get("valor_neto", 0)))
            if neto_c == 0:
                continue
            cod_c = str(row.get("codigo", "")).strip()
            if not cod_c:
                continue
            cant_c = _limpiar_num(str(row.get("cantidad", 0)))
            cli_c  = str(row.get("cliente", "")).strip()
            if cod_c not in fam_map:
                fam_map[cod_c] = {
                    "hiperFam": str(row.get("hiperfamilia", "")).strip(),
                    "familia":  str(row.get("familia",      "")).strip(),
                    "subFam":   str(row.get("subfamilia",   "")).strip(),
                }
            key_c = (vend_c, cod_c, int(neto_c))
            if key_c not in qty_map:
                qty_map[key_c] = []
            qty_map[key_c].append({"cantidad": cant_c, "cliente": cli_c})

    qty_cnt  = {}  # {(vend, cod, neto_int): indice_actual}
    sin_cant = 0   # filas sin match en df_cli

    dp = _norm_cols(df_prod.copy())
    registros = []

    for _, row in dp.iterrows():
        vendedor_erp = str(row.get("vendedor", "")).strip()
        if not vendedor_erp:
            continue
        if vendedor_erp.lower().startswith("sub") or vendedor_erp.lower().startswith("tot"):
            continue

        neto = _limpiar_num(str(row.get("valor_neto", 0)))
        if neto == 0:
            continue

        gmail_user = ERP_TO_GMAIL_USER.get(vendedor_erp, vendedor_erp)
        cod    = str(row.get("codigo",      "")).strip()
        desc   = str(row.get("descripcion", "")).strip()
        costo  = _limpiar_num(str(row.get("costo",  0)))
        margen = _limpiar_num(str(row.get("margen", 0)))
        numero = str(row.get("numero", "")).strip()
        hora   = str(row.get("hora",   "")).strip()
        doc    = str(row.get("documento",   "")).strip()
        resp   = str(row.get("responsable", "")).strip()

        fecha_raw = str(row.get("femision", "")).strip()
        try:
            partes = fecha_raw.split("/")
            periodo        = f"{partes[2]}-{partes[1]}"
            fecha_ddmmyyyy = fecha_raw
        except Exception:
            periodo        = ""
            fecha_ddmmyyyy = ""

        fi = fam_map.get(cod, {})

        # JOIN con df_cli por (vendedor, codigo, neto) — get cantidad y cliente reales
        qty_key = (vendedor_erp, cod, int(neto))
        q_idx   = qty_cnt.get(qty_key, 0)
        q_items = qty_map.get(qty_key, [])
        if q_idx < len(q_items):
            cant_val = q_items[q_idx]["cantidad"]
            cli_val  = q_items[q_idx]["cliente"]
            qty_cnt[qty_key] = q_idx + 1
        else:
            cant_val = 1.0  # fallback: sin match en df_cli
            cli_val  = ""
            sin_cant += 1

        registros.append({
            "vendedor":    gmail_user,
            "vendedorErp": vendedor_erp,
            "responsable": resp,
            "cliente":     cli_val,
            "hiperFam":    fi.get("hiperFam", ""),
            "familia":     fi.get("familia",  ""),
            "subFam":      fi.get("subFam",   ""),
            "codigo":      cod,
            "descripcion": desc,
            "cantidad":    cant_val,
            "valorNeto":   neto,
            "costo":       costo,
            "margen":      margen,
            "margenPct":   round((margen / neto * 100) if neto > 0 else 0, 2),
            "periodo":     periodo,
            "fecha":       fecha_ddmmyyyy,
            "hora":        hora,
            "numero":      numero,
            "documento":   doc,
            "bodegaCorta": "PEM",
        })

    if sin_cant:
        log(f"  [AVISO] {sin_cant} filas sin match cantidad en df_cli (fallback=1)")
    return registros


def _registros_desde_r2(df, fecha_inicio, fecha_fin):
    df = _norm_cols(df.copy())
    registros = []
    for _, row in df.iterrows():
        vendedor_erp = str(row.get("vendedor", "")).strip()
        if not vendedor_erp:
            continue
        if vendedor_erp.lower().startswith("sub") or vendedor_erp.lower().startswith("tot"):
            continue
        neto = _limpiar_num(str(row.get("valor_neto", 0)))
        if neto == 0:
            continue
        gmail_user = ERP_TO_GMAIL_USER.get(vendedor_erp, vendedor_erp)
        try:
            partes = fecha_fin.split("-")
            periodo = f"{partes[2]}-{partes[1]}"
            fecha_ddmmyyyy = f"{partes[0]}/{partes[1]}/{partes[2]}"
        except Exception:
            periodo = ""; fecha_ddmmyyyy = ""
        registros.append({
            "vendedor":    gmail_user,
            "vendedorErp": vendedor_erp,
            "responsable": str(row.get("responsable", "")).strip(),
            "cliente":     str(row.get("cliente", "")).strip(),
            "hiperFam":    str(row.get("hiperfamilia", "")).strip(),
            "familia":     str(row.get("familia", "")).strip(),
            "subFam":      str(row.get("subfamilia", "")).strip(),
            "codigo":      str(row.get("codigo", "")).strip(),
            "descripcion": str(row.get("descripcion", "")).strip(),
            "cantidad":    float(_limpiar_num(str(row.get("cantidad", 0)))),
            "valorNeto":   neto,
            "costo":       _limpiar_num(str(row.get("costo", 0))),
            "margen":      _limpiar_num(str(row.get("margen", 0))),
            "margenPct":   round((_limpiar_num(str(row.get("margen",0)))/neto*100) if neto>0 else 0, 2),
            "periodo":     periodo,
            "fecha":       fecha_ddmmyyyy,
            "bodegaCorta": "PEM",
        })
    return registros


def _elegir_tipo(opts, palabras_clave):
    return next(
        (o for o in opts if all(k in o["t"].lower() for k in palabras_clave)),
        None
    )


# ── Helpers incrementales ─────────────────────────────────────────────────────

def _max_fecha_producto():
    """Retorna (max_date, xlsx_path) del Excel de producto más reciente, o (None, None)."""
    excels = sorted(SALIDA_DIR.glob("ventas_erp_producto_*.xlsx"), reverse=True)
    if not excels:
        return None, None
    import openpyxl
    xlsx = excels[0]
    wb = openpyxl.load_workbook(str(xlsx), read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if len(rows) < 2:
        return None, xlsx
    header = list(rows[0])
    try:
        idx = header.index("F.Emision")
    except ValueError:
        return None, xlsx
    max_f = None
    for r in rows[1:]:
        v = r[idx]
        if v and str(v) not in ("-", ""):
            try:
                f = datetime.datetime.strptime(str(v), "%d/%m/%Y").date()
                if max_f is None or f > max_f:
                    max_f = f
            except Exception:
                pass
    return max_f, xlsx


def _calcular_delta(fecha_ini_str, fecha_fin_str):
    """
    Retorna (delta_ini, delta_fin, xlsx_prod, xlsx_cli).
    delta_ini/delta_fin = None si ya está al día o no hay días laborales nuevos.
    """
    try:
        f_fin = datetime.datetime.strptime(fecha_fin_str, "%d-%m-%Y").date()
    except Exception:
        return fecha_ini_str, fecha_fin_str, None, None

    max_f, xlsx_prod = _max_fecha_producto()
    excels_cli = sorted(SALIDA_DIR.glob("ventas_erp_cliente_*.xlsx"), reverse=True)
    xlsx_cli   = excels_cli[0] if excels_cli else None

    if max_f is None:
        log(f"  Sin historico -> descarga completa: {fecha_ini_str} -> {fecha_fin_str}")
        return fecha_ini_str, fecha_fin_str, None, None

    if max_f >= f_fin:
        log(f"  [OK] Datos al día hasta {max_f.strftime('%d/%m/%Y')}. Nada que descargar.")
        return None, None, xlsx_prod, xlsx_cli

    try:
        import holidays as hl
        cl_hol = hl.Chile(years=list(range(max_f.year, f_fin.year + 1)))
    except ImportError:
        log("  AVISO: 'holidays' no instalado. Solo se excluyen domingos.")
        cl_hol = set()

    cur  = max_f + datetime.timedelta(days=1)
    dias = []
    while cur <= f_fin:
        if cur.weekday() != 6 and cur not in cl_hol:
            dias.append(cur)
        cur += datetime.timedelta(days=1)

    if not dias:
        log(f"  [OK] Sin días laborales nuevos hasta {f_fin.strftime('%d/%m/%Y')}.")
        return None, None, xlsx_prod, xlsx_cli

    delta_ini = dias[0].strftime("%d-%m-%Y")
    delta_fin = dias[-1].strftime("%d-%m-%Y")
    log(f"  Descarga incremental: {delta_ini} -> {delta_fin} ({len(dias)} dias laborales)")
    return delta_ini, delta_fin, xlsx_prod, xlsx_cli


def _cargar_excel(path):
    import pandas as pd
    return pd.read_excel(str(path), engine="openpyxl", dtype=str).fillna("")


def _combinar_prod(xlsx_exist, df_nuevo):
    import pandas as pd
    df_exist = _cargar_excel(xlsx_exist)
    df = pd.concat([df_exist, df_nuevo.astype(str).fillna("")], ignore_index=True)
    if "Numero" in df.columns and "Codigo" in df.columns:
        antes = len(df)
        df = df.drop_duplicates(subset=["Numero", "Codigo"], keep="first")
        log(f"  Producto: {len(df_exist)} hist + {len(df_nuevo)} nuevas = {len(df)} filas ({antes - len(df)} dups eliminados)")
    return df


def _combinar_cli(xlsx_exist, df_nuevo):
    import pandas as pd
    df_exist = _cargar_excel(xlsx_exist)
    df = pd.concat([df_exist, df_nuevo.astype(str).fillna("")], ignore_index=True)
    log(f"  Cliente:  {len(df_exist)} hist + {len(df_nuevo)} nuevas = {len(df)} filas")
    return df


def _generar_jsons(df_prod, df_cli, fecha_ini, fecha_fin):
    """Genera ventas-manzano-YYYY.json, mensuales y compat desde DataFrames."""
    import collections as _col
    registros = _registros_desde_prod(df_prod, df_cli)
    log(f"  Registros totales: {len(registros)}")

    _data_dir    = Path(__file__).parent.parent / "data"
    _data_dir.mkdir(parents=True, exist_ok=True)
    _hoy         = datetime.date.today()
    _anio_actual = str(_hoy.year)

    _por_anio = _col.defaultdict(list)
    for _r in registros:
        _per  = str(_r.get("periodo", "") or "")
        _anio = _per[:4] if len(_per) >= 4 else _anio_actual
        _por_anio[_anio].append(_r)

    log(f"  Años encontrados: {sorted(_por_anio.keys())}")

    _meta_anios = []
    for _anio, _regs in sorted(_por_anio.items()):
        _fname = _data_dir / f"ventas-manzano-{_anio}.json"
        _chunk = {
            "generado":  _hoy.isoformat(),
            "anio":      _anio,
            "desde":     fecha_ini,
            "hasta":     fecha_fin,
            "total":     len(_regs),
            "registros": _regs,
        }
        with open(_fname, "w", encoding="utf-8") as _f:
            json.dump(_chunk, _f, ensure_ascii=False, separators=(",", ":"))
        _sz_kb = round(_fname.stat().st_size / 1024)
        log(f"  [OK] {_fname.name}: {len(_regs)} registros ({_sz_kb} KB)")
        _meta_anios.append({"anio": _anio, "total": len(_regs), "kb": _sz_kb})

    _meta = {
        "generado": _hoy.isoformat(),
        "desde":    fecha_ini,
        "hasta":    fecha_fin,
        "total":    len(registros),
        "anios":    _meta_anios,
    }
    _meta_path = _data_dir / "ventas-manzano-meta.json"
    with open(_meta_path, "w", encoding="utf-8") as _f:
        json.dump(_meta, _f, ensure_ascii=False, separators=(",", ":"))
    log(f"  [OK] ventas-manzano-meta.json: {len(_meta_anios)} años")

    _por_mes = _col.defaultdict(list)
    for _r in registros:
        _per = str(_r.get("periodo", "") or "")
        if _per and len(_per) == 7:
            _por_mes[_per].append(_r)
    for _mes, _regs in sorted(_por_mes.items()):
        _fname_mes = _data_dir / f"ventas-manzano-{_mes}.json"
        _chunk_mes = {
            "generado": _hoy.isoformat(),
            "periodo":  _mes,
            "desde":    fecha_ini,
            "hasta":    fecha_fin,
            "total":    len(_regs),
            "registros": _regs,
        }
        with open(_fname_mes, "w", encoding="utf-8") as _f:
            json.dump(_chunk_mes, _f, ensure_ascii=False, separators=(",", ":"))
    log(f"  [OK] JSONs mensuales: {len(_por_mes)} meses")



# ── Extracción HTML ───────────────────────────────────────────────────────────

def _extraer_df(html):
    import pandas as pd
    from bs4 import BeautifulSoup

    soup   = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")

    mejor, mejor_filas = None, 0
    for t in tables:
        if t.find("input") or t.find("select"):
            continue
        filas = t.find_all("tr")
        if len(filas) > mejor_filas:
            mejor_filas = len(filas)
            mejor = t

    if mejor is None or mejor_filas < 3:
        raise Exception(
            f"No se encontró tabla de datos ({len(tables)} tablas, máx {mejor_filas} filas)"
        )

    log(f"    Tabla encontrada: {mejor_filas} filas")
    filas   = mejor.find_all("tr")
    headers = [c.get_text(strip=True) for c in filas[0].find_all(["th", "td"])]
    datos   = [
        [c.get_text(strip=True) for c in f.find_all(["th", "td"])]
        for f in filas[1:]
        if any(c.get_text(strip=True) for c in f.find_all(["th", "td"]))
    ]
    n_cols = len(headers)
    datos  = [d[:n_cols] + [""] * max(0, n_cols - len(d)) for d in datos]

    df = pd.DataFrame(datos, columns=headers)

    if "Producto" in df.columns:
        partes = df["Producto"].str.extract(r'^(\S+)\s+-\s+(.+)$', expand=True)
        idx = df.columns.get_loc("Producto")
        df.insert(idx,     "Codigo",      partes[0].fillna(""))
        df.insert(idx + 1, "Descripcion", partes[1].fillna(df["Producto"]))
        df = df.drop(columns=["Producto"])
        log(f"    Columna 'Producto' separada en 'Codigo' + 'Descripcion'")

    log(f"    Columnas : {list(df.columns)}")
    log(f"    Filas    : {len(df)}")
    return df


# ── Descarga HTTP directa (sin browser) ──────────────────────────────────────

# Campos fijos del formulario ERP (extraídos del HTML guardado)
_ERP_ESTADO_FIJO = {
    "_method":                  "?_method=_EM__onclientevent&pcount=2&p0=CmdAplica&p1=onclick",
    "LstVendedor":              "",
    "LstSucursal":              "04",
    "CmbHiperFamilia":          "0",
    "CmbFamilia":               "0",
    "CmbSubFamilia":            "0",
    "_txtPeriodoInicio_state":  "_bVisible=true&_nColumnCount=10&_nMaxLength=10",
    "_txtPeriodoTermino_state": "_bVisible=true&_nColumnCount=10&_nMaxLength=10",
    "_LstTipo_state":           "selectedIndex=-1&_nCount=3&t0=Ventas%20Por%20Cliente&v0=1&t1=Ventas%20Por%20Producto&v1=2&t2=Ventas%20Por%20Cliente%20-%20Producto&v2=4",
    "_LstSucursal_state":       "selectedIndex=0&_nCount=16&t0=Todas%20las%20Sucursales&v0=&t1=Casa%20Matriz&v1=01&t2=Isabel%20Riquelme&v2=02&t3=Administracion%20central&v3=03&t4=El%20Manzano%20&v4=04&t5=San%20Vicente&v5=05&t6=Las%20Cabras%20&v6=06&t7=Patio%20Constructor%20&v7=07&t8=Centro%20de%20Distribucion%20&v8=08&t9=Ventas%20Empresas&v9=09&t10=Ventas%20Web&v10=10&t11=Litueche&v11=11&t12=Alhue&v12=12&t13=Peralillo&v13=13&t14=Distribucion&v14=14&t15=MarketPlace&v15=15",
    "_CmbHiperFamilia_state":   "selectedIndex=-1&_nCount=11&t0=Todas%20las%20Hiper&v0=0&t1=ACERO&v1=58&t2=ELECTRICIDAD&v2=64&t3=FERRETERIA&v3=59&t4=GASFITERIA&v4=65&t5=MADERA&v5=60&t6=MAQUINARIA%20Y%20HERRAMIENTAS&v6=61&t7=MATERIALES%20DE%20CONSTRUCCION&v7=62&t8=OUTLET&v8=57&t9=PRODUCTOS%20CALZADOS&v9=31&t10=TERMINACIONES&v10=63",
    "_CmbFamilia_state":        "selectedIndex=-1&_nCount=1&t0=Todas%20Las%20Fam&v0=0",
    "_CmbSubFamilia_state":     "selectedIndex=-1&_nCount=1&t0=Todas%20las%20Sub&v0=0",
    "_CmdAplica_state":         "value=Aplica",
    "_ChkGuia_state":           "_strCaption=Incluir%20Guias%20no%20facturadas",
    "_chkOrigen_state":         "_strCaption=Valor%20Origen",
    "_thisPage_state":          "",
}


def _descargar_reporte_http(fecha_ini, fecha_fin, tipo_id, timeout=150,
                            _session=None, _form_base=None):
    """
    Descarga un reporte via HTTP (GET para extraer campos de sesion + POST para ejecutar).
    tipo_id: "2" = Ventas Por Producto, "4" = Ventas Por Cliente - Producto
    _session/_form_base: reutilizar sesion ya abierta (evita GET extra).
    Retorna DataFrame o None si falla.
    """
    import requests
    from bs4 import BeautifulSoup

    url = (
        ERP_BASE + "/Reporte_VentasPorVendedor.asp"
        f"?xToken={XTOKEN}&xVendedor={USER}&xNombre={USER}"
    )
    try:
        if _session is None or _form_base is None:
            _session = requests.Session()
            resp_get = _session.get(url, timeout=30)
            resp_get.encoding = "windows-1252"
            soup = BeautifulSoup(resp_get.text, "html.parser")
            _form_base = {}
            for inp in soup.find_all("input"):
                n = inp.get("name", ""); v = inp.get("value", "")
                if n:
                    _form_base[n] = v

        data = dict(_form_base)
        data["_method"] = (
            "/Justweb_Foviedo/Reporte_VentasPorVendedor.asp"
            "?_method=_EM__onclientevent&pcount=2&p0=CmdAplica&p1=onclick"
        )
        data["txtPeriodoInicio"]  = fecha_ini
        data["txtPeriodoTermino"] = fecha_fin
        data["LstVendedor"]       = ""
        data["LstTipo"]           = tipo_id
        data["LstSucursal"]       = "04"
        data["CmbHiperFamilia"]   = "0"
        data["CmbFamilia"]        = "0"
        data["CmbSubFamilia"]     = "0"

        resp = _session.post(url, data=data, timeout=timeout,
                             headers={"Referer": url})
        resp.encoding = "windows-1252"
        df = _extraer_df(resp.text)
        col_check = "F.Emision" if tipo_id == "2" else "Cliente"
        if col_check not in df.columns:
            log(f"    HTTP: respuesta sin columna '{col_check}' - posible sesion expirada")
            return None
        return df
    except Exception as e:
        log(f"    HTTP directo error: {e}")
        return None


# ── Descarga Playwright (fallback) ────────────────────────────────────────────

async def _run(fecha_ini: str, fecha_fin: str):
    """
    Descarga ambos reportes ERP para el rango dado.
    Intenta HTTP directo primero; si falla, usa Playwright como fallback.
    Retorna (df_prod, df_cli).
    """
    # ── Intento 1: HTTP directo (sin browser, mucho mas rapido) ───────────────
    log("  [HTTP] Intentando descarga directa sin browser...")
    try:
        import requests
        from bs4 import BeautifulSoup
        url_form = (
            ERP_BASE + "/Reporte_VentasPorVendedor.asp"
            f"?xToken={XTOKEN}&xVendedor={USER}&xNombre={USER}"
        )
        _sess = requests.Session()
        _resp_get = _sess.get(url_form, timeout=30)
        _resp_get.encoding = "windows-1252"
        _soup = BeautifulSoup(_resp_get.text, "html.parser")
        _form_base = {}
        for _inp in _soup.find_all("input"):
            _n = _inp.get("name", ""); _v = _inp.get("value", "")
            if _n: _form_base[_n] = _v
        log(f"  [HTTP] Sesion OK ({len(_form_base)} campos del formulario)")
    except Exception as _e:
        log(f"  [HTTP] GET formulario fallo: {_e}")
        _sess = None; _form_base = None

    df_prod = _descargar_reporte_http(fecha_ini, fecha_fin, "2",
                                      _session=_sess, _form_base=_form_base)
    if df_prod is not None:
        log("  [HTTP] Reporte 1 OK")
        df_cli = _descargar_reporte_http(fecha_ini, fecha_fin, "4",
                                         _session=_sess, _form_base=_form_base)
        if df_cli is not None:
            log("  [HTTP] Reporte 2 OK")
        else:
            log("  [HTTP] Reporte 2 fallo - continuando sin enriquecimiento")
        return df_prod, df_cli

    log("  [HTTP] Fallo - usando Playwright como fallback...")

    # ── Fallback: Playwright ──────────────────────────────────────────────────
    from playwright.async_api import async_playwright

    URL_VENTAS = (
        ERP_BASE + "/Reporte_VentasPorVendedor.asp"
        f"?xToken={XTOKEN}&xVendedor={USER}&xNombre={USER}"
    )

    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="msedge", headless=True)
        context = await browser.new_context(accept_downloads=True)
        page    = await context.new_page()

        # ── Login ──────────────────────────────────────────────────────────────
        log("  Iniciando sesión ERP...")
        await page.goto(ERP_BASE + "/", wait_until="load", timeout=60000)
        if await page.query_selector("input[name='Login1$txtUsuario']"):
            await page.fill("input[name='Login1$txtUsuario']", USER)
            await page.fill("input[name='Login1$txtClave']",    CLAVE)
            await page.click("input[name='Login1$CmdAceptar']")
            await page.wait_for_load_state("load", timeout=30000)
        log("  Login OK")

        # ── Cargar formulario ──────────────────────────────────────────────────
        log("  Cargando formulario...")
        await page.goto(URL_VENTAS, wait_until="load", timeout=60000)
        await page.wait_for_timeout(1000)

        opts_tipo = await page.evaluate(
            "Array.from(document.querySelector(\"select[name='LstTipo']\").options)"
            ".map(o => ({v: o.value, t: o.text.trim()}))"
        )
        log(f"  Tipos disponibles: {[o['t'] for o in opts_tipo]}")

        async def setear_formulario():
            await page.fill("input[name='txtPeriodoInicio']",  fecha_ini)
            await page.fill("input[name='txtPeriodoTermino']", fecha_fin)
            opts_suc = await page.evaluate(
                "Array.from(document.querySelector(\"select[name='LstSucursal']\").options)"
                ".map(o => ({v: o.value, t: o.text.trim()}))"
            )
            manzano = next((o for o in opts_suc if "manzano" in o["t"].lower()), None)
            if not manzano:
                raise Exception(f"'El Manzano' no encontrado. Opciones: {[o['t'] for o in opts_suc]}")
            await page.select_option("select[name='LstSucursal']", value=manzano["v"])

        # ── Reporte 1: Ventas Por Producto ────────────────────────────────────
        log("")
        log("  [Reporte 1/2] Ventas Por Producto (transaccional)...")
        await setear_formulario()
        tipo1_prod = next(
            (o for o in opts_tipo
             if "producto" in o["t"].lower() and "cliente" not in o["t"].lower()),
            None
        )
        if not tipo1_prod:
            raise Exception("No se encontró 'Ventas Por Producto'.")
        await page.select_option("select[name='LstTipo']", value=tipo1_prod["v"])
        log(f"    Tipo = '{tipo1_prod['t']}'")
        log(f"    Fechas: {fecha_ini} -> {fecha_fin}")
        log("    Generando informe (30-90 s)...")
        await page.click("input[name='CmdAplica']")
        await page.wait_for_load_state("networkidle", timeout=150000)
        await page.wait_for_timeout(2000)
        html1   = await page.content()
        df_prod = _extraer_df(html1)

        # ── Reporte 2: Ventas Por Cliente - Producto ──────────────────────────
        log("")
        log("  [Reporte 2/2] Ventas Por Cliente - Producto (enriquecimiento)...")
        df_cli = None
        try:
            await page.goto(URL_VENTAS, wait_until="load", timeout=60000)
            await page.wait_for_timeout(1000)
            opts_tipo2 = await page.evaluate(
                "Array.from(document.querySelector(\"select[name='LstTipo']\").options)"
                ".map(o => ({v: o.value, t: o.text.trim()}))"
            )
            await setear_formulario()
            tipo2 = _elegir_tipo(opts_tipo2, TIPO_CLIENTE)
            if not tipo2:
                log("    AVISO: 'Ventas Por Cliente - Producto' no encontrado.")
            else:
                await page.select_option("select[name='LstTipo']", value=tipo2["v"])
                log(f"    Tipo = '{tipo2['t']}'")
                log(f"    Fechas: {fecha_ini} -> {fecha_fin}")
                log("    Generando informe (30-90 s)...")
                await page.click("input[name='CmdAplica']")
                await page.wait_for_load_state("networkidle", timeout=150000)
                await page.wait_for_timeout(2000)
                html2  = await page.content()
                df_cli = _extraer_df(html2)
        except Exception as e_r2:
            log(f"    [AVISO] Reporte 2 falló: {e_r2}")
            log("    Continuando sin enriquecimiento de cliente.")

        await browser.close()

    return df_prod, df_cli


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    import shutil
    hoy       = datetime.date.today()
    hoy_str   = hoy.strftime("%d-%m-%Y")
    hoy_tag   = hoy.strftime("%Y%m%d")
    fecha_ini = sys.argv[1] if len(sys.argv) > 1 else FECHA_INI_DEFAULT
    fecha_fin = sys.argv[2] if len(sys.argv) > 2 else hoy_str

    dest_prod = SALIDA_DIR / f"ventas_erp_producto_{hoy_tag}.xlsx"
    dest_cli  = SALIDA_DIR / f"ventas_erp_cliente_{hoy_tag}.xlsx"

    log("")
    log("=" * 60)
    log("  DESCARGA VENTAS ERP - El Manzano (incremental)")
    log("=" * 60)
    log(f"  Rango solicitado : {fecha_ini}  ->  {fecha_fin}")
    log(f"  Sucursal         : El Manzano")
    log("")

    try:
        delta_ini, delta_fin, xlsx_prod_exist, xlsx_cli_exist = _calcular_delta(fecha_ini, fecha_fin)

        if delta_ini is None:
            # Ya al día o sin días laborales nuevos
            if xlsx_prod_exist and Path(xlsx_prod_exist) != dest_prod:
                shutil.copy2(str(xlsx_prod_exist), str(dest_prod))
                log(f"  Copiado a: {dest_prod.name}")
            if xlsx_cli_exist and Path(xlsx_cli_exist) != dest_cli:
                shutil.copy2(str(xlsx_cli_exist), str(dest_cli))
                log(f"  Copiado a: {dest_cli.name}")
            # Generar JSONs desde existente
            if dest_prod.exists():
                log("  Generando JSONs desde datos existentes...")
                df_prod = _cargar_excel(dest_prod)
                df_cli  = _cargar_excel(dest_cli) if dest_cli.exists() else None
                _generar_jsons(df_prod, df_cli, fecha_ini, fecha_fin)
            log("")
            return

        # ── Descargar delta ────────────────────────────────────────────────────
        df_prod_new, df_cli_new = asyncio.run(_run(delta_ini, delta_fin))

        # ── Combinar con histórico ─────────────────────────────────────────────
        log("")
        log("  Combinando con histórico...")
        if xlsx_prod_exist:
            df_prod_final = _combinar_prod(xlsx_prod_exist, df_prod_new)
        else:
            df_prod_final = df_prod_new

        if df_cli_new is not None:
            if xlsx_cli_exist:
                df_cli_final = _combinar_cli(xlsx_cli_exist, df_cli_new)
            else:
                df_cli_final = df_cli_new
        elif xlsx_cli_exist:
            df_cli_final = _cargar_excel(xlsx_cli_exist)
            log("  Reporte 2 no disponible → usando cliente histórico existente")
        else:
            df_cli_final = None

        # ── Guardar Excel combinado ────────────────────────────────────────────
        df_prod_final.to_excel(str(dest_prod), index=False, engine="openpyxl")
        log(f"\n  Guardado (producto): {dest_prod}  ({dest_prod.stat().st_size:,} bytes)")
        if df_cli_final is not None:
            df_cli_final.to_excel(str(dest_cli), index=False, engine="openpyxl")
            log(f"  Guardado (cliente):  {dest_cli}  ({dest_cli.stat().st_size:,} bytes)")

        # ── Generar JSONs ──────────────────────────────────────────────────────
        log("")
        log("  Generando JSONs de ventas...")
        _generar_jsons(df_prod_final, df_cli_final, fecha_ini, fecha_fin)

        log("")
        log("=" * 60)
        log("  COMPLETADO")
        log("=" * 60)
        log("")

    except Exception as e:
        log(f"\n[ERROR] {e}")
        import traceback; traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
