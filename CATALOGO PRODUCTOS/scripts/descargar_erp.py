import sys, unicodedata, configparser, requests, pandas as pd, os
from bs4 import BeautifulSoup

# FIX 2026-08-03: con channel="msedge" el gestor de descargas de Edge intercepta
# el CSV y Playwright nunca recibe el evento "download" (timeout 3/3 en exportReport).
# Solución: Chromium bundled HEADLESS (exe verificado en E:\playwright-browsers;
# la variante headed está incompleta: falta chrome-win\chrome.exe). Fallback: Edge.
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", r"E:\playwright-browsers")

async def _launch_browser(p):
    """Chromium bundled headless primero (descargas confiables); Edge headed como fallback."""
    try:
        b = await p.chromium.launch(headless=True)
        print("  [browser] Usando Chromium bundled (headless)", flush=True)
        return b
    except Exception as e:
        print(f"  [browser] Fallback a Edge headed ({str(e)[:80]})", flush=True)
        return await p.chromium.launch(channel="msedge", headless=False)

def _leer_credenciales_erp():
    cfg = configparser.ConfigParser()
    ini = os.path.join(os.path.dirname(__file__), "credenciales_erp.ini")
    if not os.path.exists(ini):
        print(f"[ERROR] No se encontro {ini} — sin fallback con credenciales reales por seguridad.", flush=True)
        sys.exit(1)
    cfg.read(ini, encoding="utf-8")
    erp = cfg["ERP"] if "ERP" in cfg else {}
    return {"base": erp.get("BASE","http://[ERP-SERVER-IP]/Justweb_Foviedo"),"user": erp.get("USER","agonzalez"),"clave": erp.get("CLAVE",""),"xtoken": erp.get("XTOKEN","")}

_CREDS = _leer_credenciales_erp()
BASE  = _CREDS["base"]
USER  = _CREDS["user"]
CLAVE = _CREDS["clave"]
XTOKEN_INI = _CREDS.get("xtoken", "")
XLSX  = os.path.join(os.path.dirname(__file__), "..", "actualizar.xlsx")

def _url_bodega(nombre_enc, id_bodega):
    """Construye la URL del reporte de bodega Justime para cualquier IdBodega."""
    return (BASE+"/Reporte_Bodegas_Detalle.asp"
        "?Bodega="+nombre_enc+"&Clasificacion=Por%20Marca,%20HiperFamilia,%20Familia,%20SubFamilia"
        "&Filtro=Todos%20los%20Productos&IdBodega="+str(id_bodega)+"&IdClasificacion=3&IdFiltro=1"
        "&IdH=0&IdF=0&IdS=0&HiperFamilia=Todas%20las%20Hiper&Familia=Todas%20Las%20Fam"
        "&SubFamilia=Todas%20las%20Sub&IdMarca=0&Marca=Todas%20las%20marcas&EsFecha=1&Fecha=&IdTemp=&Temp=")

# Bodegas lite (COD+DISP únicamente — catálogo base viene de existencias_clasificadas)
URL_CEM   = _url_bodega("CEM",                       393)  # CEM — venta real
URL_IEM   = _url_bodega("Ingreso%20El%20Manzano",    72)  # IEM — sistémica (proveedor a casa matriz)
URL_RCE   = _url_bodega("Recepcion%20El%20Manzano",  55)  # RCE — sistémica (revisión recepción)
URL_MEM   = _url_bodega("Mermas%20El%20Manzano",     29)  # MEM — mermas/remate El Manzano
XTOKEN = XTOKEN_INI or "ce098199-5294-f111-8ab0-00155d9d0613"
VISOR_PARAMS = "?xToken="+XTOKEN+"&xInforme=RS_Documentos/listaprecio&xTituloInforme=Lista%20Precio"

EXIST_TOKEN  = XTOKEN_INI or "ce098199-5294-f111-8ab0-00155d9d0613"
EXIST_PARAMS = ("?xToken="+EXIST_TOKEN
                +"&xInforme=RS_Existencias/existencias_clasificadas"
                +"&xTituloInforme=Existencias%20Clasificadas")
# IDs checkbox SSRS confirmados 21-05-2026
IDS_BLOQUE1 = [
    'RV_ctl08_ctl04_divDropDown_ctl13',  # SEM - Sala El Manzano
    'RV_ctl08_ctl04_divDropDown_ctl24',  # CEM - Calzada El Manzano
    'RV_ctl08_ctl04_divDropDown_ctl52',  # RCE - Recepcion El Manzano
    'RV_ctl08_ctl04_divDropDown_ctl29',  # MEM - Mermas El Manzano
]
IDS_BLOQUE2 = [
    'RV_ctl08_ctl04_divDropDown_ctl22',  # PEM - Patio El Manzano
    'RV_ctl08_ctl04_divDropDown_ctl44',  # TEM - Transito El Manzano
    'RV_ctl08_ctl04_divDropDown_ctl23',  # CD  - Centro de Distribucion
    'RV_ctl08_ctl04_divDropDown_ctl69',  # IEM - Ingreso El Manzano
]

def log(msg): print(msg, flush=True)

def login():
    s = requests.Session()
    s.headers.update({"User-Agent":"Mozilla/5.0"})
    ultimo_error = None
    for intento in range(1,4):
        try:
            if intento>1: log(f"  Reintentando ({intento}/3)...")
            r = s.get(BASE+"/", timeout=40); r.raise_for_status(); break
        except requests.exceptions.Timeout:
            ultimo_error = f"Timeout (intento {intento}/3)"; log(f"  {ultimo_error}")
        except requests.exceptions.ConnectionError as e:
            ultimo_error = str(e); log(f"  Error conexion (intento {intento}/3): {ultimo_error[:80]}")
    else:
        raise Exception("No se pudo conectar al ERP.\nVerifica VPN Oviedo (FortiClient).")
    soup = BeautifulSoup(r.text,"html.parser")
    def val(n):
        el=soup.find("input",{"name":n}); return el["value"] if el else ""
    r2 = s.post(r.url,data={"__EVENTTARGET":"","__EVENTARGUMENT":"","__VIEWSTATE":val("__VIEWSTATE"),
        "__VIEWSTATEGENERATOR":val("__VIEWSTATEGENERATOR"),"__EVENTVALIDATION":val("__EVENTVALIDATION"),
        "Login1$txtUsuario":USER,"Login1$txtClave":CLAVE,"Login1$CmdAceptar":"Ingresar"},timeout=40)
    r2.raise_for_status()
    if "Login" in r2.url or "login" in r2.url.lower(): raise Exception("Login fallido")
    log("  Login OK"); return s, r2.url

KEYWORDS_BODEGA = ["cod","desc","marc","sub","costo","disp","stock","exist","saldo","cprom","fam"]

def parse_tabla(html, keywords=None):
    soup = BeautifulSoup(html,"html.parser")
    best_score, best_result = -1, (None,[])
    for t in soup.find_all("table"):
        if t.find("select") or t.find("input",{"type":"text"}): continue
        rows = t.find_all("tr")
        if len(rows)<5: continue
        for i,row in enumerate(rows):
            texts=[c.get_text(strip=True) for c in row.find_all(["th","td"])]
            if len([x for x in texts if x])<3: continue
            data_rows=[[c.get_text(strip=True) for c in dr.find_all(["th","td"])]
                for dr in rows[i+1:] if any(c.get_text(strip=True) for c in dr.find_all(["th","td"]))]
            if len(data_rows)<3: continue
            score = sum(1 for k in keywords if k in " ".join(texts).lower()) if keywords else len(data_rows)
            if score>best_score: best_score,best_result=score,(texts,data_rows)
            break
    return best_result

def limpiar_num(v):
    if v is None: return 0
    v=str(v).replace(".","").replace(",",".").replace("$","").strip()
    try: return int(float(v))
    except: return 0

def descargar_bodega(session, url, nombre):
    log(f"  Descargando {nombre}...")
    r=session.get(url,timeout=30); r.raise_for_status()
    headers,rows=parse_tabla(r.text,keywords=KEYWORDS_BODEGA)
    if not headers: raise Exception(f"No se encontro tabla en {nombre}")
    log(f"    Columnas: {headers}"); log(f"    Filas:    {len(rows)}")
    return pd.DataFrame(rows,columns=headers[:len(rows[0])] if rows else headers)

def normalizar_bodega_lite(df, include_trans=False):
    """Descarga liviana: solo código + Disp (+ Trans opcional).
    Usar para IEM, TEM, RCE — el catálogo viene de PEM/SEM por cruce de código."""
    cols={c.upper():c for c in df.columns}
    def fc(*kw):
        for k in kw:
            for cu,co in cols.items():
                if k.upper() in cu: return co
        return None
    cod  = fc("COD","CODIGO")
    disp = fc("DISP","STOCK","EXISTENCIA","SALDO")
    trans = fc("-TRANS-","TRANST","TRANS","TRANSIT","PEDIDO") if include_trans else None
    r=pd.DataFrame()
    r["COD"]  = df[cod].astype(str).str.strip() if cod else ""
    r["DISP"] = df[disp].apply(limpiar_num) if disp else 0
    if include_trans:
        r["TRANS"] = df[trans].apply(limpiar_num) if trans else 0
        if trans: log(f"    [TRANS] columna encontrada: '{trans}' — {r['TRANS'].sum()} unidades")
        else:     log(f"    [TRANS] columna NOT encontrada — columnas disponibles: {list(df.columns)}")
    return r[r["COD"].str.match(r"^[A-Za-z0-9]{3,}")]

async def _rv_listo(page):
    """Espera que el ReportViewer no esté en estado 'updating'."""
    await page.wait_for_function(
        """() => {
            try {
                var rv = $find('RV');
                if (!rv) return false;
                rv.get_reportAreaContentType();
                return true;
            } catch(e) { return false; }
        }""",
        timeout=180000, polling=1000
    )
    await page.wait_for_timeout(1000)


def descargar_existencias_playwright():
    """Descarga existencias_clasificadas en 2 bloques via Playwright.
    Bloque1: SEM/CEM/RCE/MEM (solo DISP). Bloque2: PEM/TEM/CD/IEM (DISP+TRANS)."""
    import asyncio
    from datetime import date
    from playwright.async_api import async_playwright

    hoy = date.today().strftime("%Y%m%d")
    scripts_dir = os.path.dirname(__file__)
    backup_dir  = os.path.join(scripts_dir, "..", "backups")
    os.makedirs(backup_dir, exist_ok=True)
    path_b1 = os.path.join(backup_dir, f"raw_bloque1_{hoy}.csv")
    path_b2 = os.path.join(backup_dir, f"raw_bloque2_{hoy}.csv")
    url_informe = BASE + "/VisorRS.aspx" + EXIST_PARAMS

    async def _configurar_filtros(page):
        await page.select_option('select[name="RV$ctl08$ctl06$ddValue"]', "1")
        await page.wait_for_load_state("networkidle", timeout=15000)
        await page.select_option('select[name="RV$ctl08$ctl08$ddValue"]', "1")
        await page.wait_for_load_state("networkidle", timeout=15000)
        try:
            await page.select_option('select[name="RV$ctl08$ctl10$ddValue"]', "1")
            await page.wait_for_timeout(500)
            await page.select_option('select[name="RV$ctl08$ctl12$ddValue"]', "1")
            await page.wait_for_timeout(500)
        except Exception:
            pass
        await page.select_option('select[name="RV$ctl08$ctl14$ddValue"]', "1")
        await page.wait_for_timeout(500)
        await page.check("input#RV_ctl08_ctl16_rbFalse")
        await page.wait_for_timeout(500)

    async def _seleccionar_bodegas(page, ids, label):
        log(f"  Seleccionando bodegas {label}...")
        await page.click("button#RV_ctl08_ctl04_ctl01")
        await page.wait_for_timeout(600)
        try:
            ctl00 = "input#RV_ctl08_ctl04_divDropDown_ctl00"
            if await page.is_checked(ctl00):
                await page.uncheck(ctl00)
                await page.wait_for_timeout(400)
        except Exception:
            pass
        for chk_id in ids:
            await page.check(f"input#{chk_id}")
            await page.wait_for_timeout(200)
            log(f"    Marcado: {chk_id}")
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(500)

    async def _ejecutar_y_exportar(page, dest_path, label):
        log(f"  Ejecutando informe {label} (puede tardar 1-2 min)...")
        await page.click("input#RV_ctl08_ctl00")
        await page.wait_for_load_state("networkidle", timeout=180000)
        log(f"  Esperando que ReportViewer este listo ({label})...")
        await _rv_listo(page)
        log(f"  Exportando {label} como CSV...")
        for intento in range(1, 4):
            try:
                async with page.expect_download(timeout=180000) as dl_info:
                    await page.evaluate("$find('RV').exportReport('CSV')")
                download = await dl_info.value
                break
            except Exception as e_exp:
                log(f"  Intento {intento}/3 fallido: {str(e_exp)[:120]}")
                if intento < 3:
                    await page.wait_for_timeout(6000)
                    await _rv_listo(page)
                else:
                    raise Exception(f"Bloque {label}: fallo exportacion CSV tras 3 intentos")
        await download.save_as(dest_path)
        log(f"  {label} guardado: {os.path.getsize(dest_path):,} bytes -> {dest_path}")

    async def _run():
        async with async_playwright() as p:
            browser = await _launch_browser(p)
            context = await browser.new_context(accept_downloads=True)
            page    = await context.new_page()

            log("  [Bloque1] Abriendo VisorRS...")
            log(f"  URL: {url_informe}")
            await page.goto(url_informe, wait_until="domcontentloaded", timeout=90000)
            log("  [Bloque1] Configurando filtros...")
            await _configurar_filtros(page)
            await _seleccionar_bodegas(page, IDS_BLOQUE1, "Bloque1 (SEM/CEM/RCE/MEM)")
            await _ejecutar_y_exportar(page, path_b1, "Bloque1")

            log("  Pausa 2s entre bloques...")
            await page.wait_for_timeout(2000)
            log("  [Bloque2] Recargando para segunda descarga...")
            await page.goto(url_informe, wait_until="domcontentloaded", timeout=90000)
            log("  [Bloque2] Configurando filtros...")
            await _configurar_filtros(page)
            await _seleccionar_bodegas(page, IDS_BLOQUE2, "Bloque2 (PEM/TEM/CD/IEM)")
            await _ejecutar_y_exportar(page, path_b2, "Bloque2")

            await browser.close()

        return normalizar_existencias(path_b1, path_b2)

    return asyncio.run(_run())


def normalizar_existencias(path_b1, path_b2):
    """Combina los 2 CSVs SSRS, pivota por Bod y retorna df con columnas Hoja2."""
    import re

    def _limpiar_jer(v):
        v = str(v).strip()
        return re.sub(r'^\d+(\.\d+)*\.-\s*', '', v).strip()

    def _limpiar_num_local(v):
        if v is None: return 0
        v = str(v).strip().strip('"').replace('.', '').replace(',', '.').strip()
        try: return int(float(v))
        except: return 0

    df_b1 = pd.read_csv(path_b1, dtype=str, encoding='utf-8-sig')
    df_b2 = pd.read_csv(path_b2, dtype=str, encoding='utf-8-sig')
    log(f"  Columnas bloque1: {list(df_b1.columns)}")
    log(f"  Columnas bloque2: {list(df_b2.columns)}")
    log(f"  Bodegas bloque1 : {df_b1['Bod'].str.strip().unique().tolist()}")
    log(f"  Bodegas bloque2 : {df_b2['Bod'].str.strip().unique().tolist()}")

    df = pd.concat([df_b1, df_b2], ignore_index=True)

    for c in ['St_Disp', 'St_Tran', 'St_Bod', 'Costo_Promedio']:
        if c in df.columns:
            df[c] = df[c].apply(_limpiar_num_local)
    for c in ['Hip', 'Fam', 'Sub']:
        if c in df.columns:
            df[c] = df[c].apply(_limpiar_jer)

    df['Codigo'] = df['Codigo'].astype(str).str.strip()
    df['Bod']    = df['Bod'].astype(str).str.strip()
    df = df[df['Codigo'].str.match(r'^[A-Za-z0-9]{3,}')].copy()

    BOD_PRIO = {'PEM': 0, 'SEM': 1, 'TEM': 2, 'CD': 3, 'CEM': 4, 'IEM': 5, 'RCE': 6, 'MEM': 7}
    df['_prio'] = df['Bod'].map(BOD_PRIO).fillna(99)
    df_sorted = df.sort_values(['Codigo', '_prio'])
    catalogo = (
        df_sorted.drop_duplicates(subset='Codigo', keep='first')
        [['Codigo', 'Descripcion', 'Marca', 'Hip', 'Fam', 'Sub', 'Costo_Promedio']]
        .rename(columns={'Codigo': 'COD', 'Descripcion': 'DESC', 'Marca': 'MARCA',
                         'Hip': 'HIPER', 'Fam': 'FAM', 'Sub': 'SUB', 'Costo_Promedio': 'COSTO'})
    )
    log(f"  Catalogo base    : {len(catalogo)} productos unicos")

    result = catalogo.copy()

    # Orden Hoja2: PEM_DISP/TRANS, SEM_DISP, CEM_DISP, MEM_DISP,
    #              IEM_DISP/TRANS, TEM_DISP/TRANS, RCE_DISP, CD_DISP/TRANS
    BOD_COLS = [
        ('PEM', 'PEM_DISP', 'PEM_TRANS'),
        ('SEM', 'SEM_DISP', None),
        ('CEM', 'CEM_DISP', None),
        ('MEM', 'MEM_DISP', None),
        ('IEM', 'IEM_DISP', 'IEM_TRANS'),
        ('TEM', 'TEM_DISP', 'TEM_TRANS'),
        ('RCE', 'RCE_DISP', None),
        ('CD',  'CD_DISP',  'CD_TRANS'),
    ]
    for bod, disp_col, trans_col in BOD_COLS:
        sub = (df[df['Bod'] == bod][['Codigo', 'St_Disp', 'St_Tran']]
               .groupby('Codigo', as_index=False).sum())
        sub = sub.rename(columns={'St_Disp': disp_col})
        cols = ['Codigo', disp_col]
        if trans_col:
            sub = sub.rename(columns={'St_Tran': trans_col})
            cols.append(trans_col)
        result = result.merge(sub[cols], left_on='COD', right_on='Codigo', how='left').drop(columns='Codigo', errors='ignore')
        result[disp_col] = result[disp_col].fillna(0).astype(int)
        if trans_col and trans_col in result.columns:
            result[trans_col] = result[trans_col].fillna(0).astype(int)

    # Agregar St_Bod para PEM, SEM, CEM (físico = disponible + comprometido)
    for bod, bod_col in [('PEM', 'PEM_BOD'), ('SEM', 'SEM_BOD'), ('CEM', 'CEM_BOD'), ('MEM', 'MEM_BOD')]:
        if 'St_Bod' in df.columns:
            sub_b = (df[df['Bod'] == bod][['Codigo', 'St_Bod']]
                     .groupby('Codigo', as_index=False).sum())
            sub_b = sub_b.rename(columns={'St_Bod': bod_col})
            result = result.merge(sub_b[['Codigo', bod_col]], left_on='COD', right_on='Codigo', how='left').drop(columns='Codigo', errors='ignore')
            result[bod_col] = result[bod_col].fillna(0).astype(int)
        else:
            result[bod_col] = 0

    all_cols = ['COD', 'DESC', 'MARCA', 'HIPER', 'FAM', 'SUB', 'COSTO',
                'PEM_DISP', 'PEM_TRANS', 'PEM_BOD', 'SEM_DISP', 'SEM_BOD',
                'CEM_DISP', 'CEM_BOD', 'MEM_DISP', 'MEM_BOD',
                'IEM_DISP', 'IEM_TRANS', 'TEM_DISP', 'TEM_TRANS', 'RCE_DISP',
                'CD_DISP', 'CD_TRANS']
    for c in all_cols:
        if c not in result.columns:
            result[c] = 0

    return result[all_cols]


def descargar_precio_playwright():
    import asyncio, tempfile
    from playwright.async_api import async_playwright
    tmp_csv = os.path.join(tempfile.gettempdir(), "listaprecio_tmp.csv")

    async def _run():
        async with async_playwright() as p:
            browser = await _launch_browser(p)
            context = await browser.new_context(accept_downloads=True)
            page    = await context.new_page()

            url_informe = BASE + "/VisorRS.aspx" + VISOR_PARAMS
            log("  Abriendo VisorRS...")
            log(f"  URL: {url_informe}")
            await page.goto(url_informe, wait_until="domcontentloaded", timeout=90000)

            log("  Seleccionando filtros...")
            await page.select_option('select[name="RV$ctl08$ctl04$ddValue"]', "1")
            await page.wait_for_load_state("networkidle", timeout=15000)
            await page.select_option('select[name="RV$ctl08$ctl06$ddValue"]', "4")
            await page.wait_for_load_state("networkidle", timeout=15000)
            await page.select_option('select[name="RV$ctl08$ctl08$ddValue"]', "1")
            await page.wait_for_load_state("networkidle", timeout=10000)
            await page.click('button#RV_ctl08_ctl10_ctl01')
            await page.wait_for_timeout(700)
            await page.check('input#RV_ctl08_ctl10_divDropDown_ctl00')
            await page.wait_for_timeout(500)
            await page.keyboard.press("Escape")
            await page.select_option('select[name="RV$ctl08$ctl12$ddValue"]', "1")
            await page.click('button#RV_ctl08_ctl14_ctl01')
            await page.wait_for_timeout(700)
            await page.check('input#RV_ctl08_ctl14_divDropDown_ctl02')
            await page.wait_for_timeout(500)
            await page.keyboard.press("Escape")
            await page.select_option('select[name="RV$ctl08$ctl16$ddValue"]', "1")

            log("  Ejecutando informe...")
            await page.click('input#RV_ctl08_ctl00')
            await page.wait_for_load_state("networkidle", timeout=120000)

            log("  Esperando que ReportViewer este listo...")
            await _rv_listo(page)

            # Exportar como CSV — sin filas de título, datos limpios directo
            log("  Exportando como CSV...")
            download = None
            for intento in range(1, 4):
                try:
                    async with page.expect_download(timeout=120000) as dl_info:
                        await page.evaluate("$find('RV').exportReport('CSV')")
                    download = await dl_info.value
                    break
                except Exception as e_exp:
                    log(f"  Intento {intento}/3 fallido: {str(e_exp)[:120]}")
                    if intento < 3:
                        await page.wait_for_timeout(6000)
                        await _rv_listo(page)
                    else:
                        raise e_exp

            await download.save_as(tmp_csv)
            await browser.close()

        size = os.path.getsize(tmp_csv)
        log(f"  CSV descargado: {size:,} bytes")

        # Leer CSV — SSRS CSV no tiene filas de título, encabezados en fila 0
        df = pd.read_csv(tmp_csv, dtype=str, encoding_errors="replace")
        df = df.dropna(how="all").reset_index(drop=True)
        try: os.remove(tmp_csv)
        except: pass
        log(f"  Filas: {len(df)} | Columnas: {list(df.columns)}")
        return df

    return asyncio.run(_run())

def _ascii_upper(t): return unicodedata.normalize("NFD",str(t)).encode("ascii","ignore").decode("ascii").upper()

def normalizar_precio(df):
    cols={_ascii_upper(c):c for c in df.columns}
    log(f"  Columnas precio: {list(df.columns)}")
    def fc(*groups):
        for g in groups:
            words=g if isinstance(g,(list,tuple)) else [g]
            for cn,co in cols.items():
                if all(_ascii_upper(w) in cn for w in words): return co,g
        return None,None
    cod,_=fc("CODIGO","COD","TECNICO")
    total,tk=fc("TOTAL1",["VALOR","TOTAL"],["PRECIO","TOTAL"],["PRECIO","IVA"],["P","IVA"],"PVENTA",["P.VENTA"],"TOTAL")
    if total is None:
        total,tk=fc("PRECIO")
        if total: log(f"  AVISO: fallback precio '{total}' — verificar IVA.")
    if not cod: raise Exception(f"No se encontro columna CODIGO. Columnas: {list(df.columns)}")
    if not total: raise Exception(f"No se encontro columna PRECIO. Columnas: {list(df.columns)}")
    log(f"  Codigo: '{cod}' | Precio: '{total}' (debe ser CON IVA)")
    r=pd.DataFrame()
    r["COD"]=df[cod].astype(str).str.strip()
    r["TOTAL"]=df[total].apply(limpiar_num)
    r=r[r["COD"].str.match(r"^[A-Za-z0-9]{3,}")]
    r=r[r["TOTAL"]>0]
    prom=r["TOTAL"].mean() if len(r) else 0
    log(f"  Precio promedio: ${prom:,.0f}")
    if 0<prom<500: log(f"  AVISO: precio promedio bajo — verificar columna '{total}'.")
    return r

def leer_csv_local_manzano(max_horas=24):
    import time
    from pathlib import Path
    csvs=sorted((Path.home()/"Downloads").glob("RS_Documentos_listaprecio*.csv"),key=lambda f:f.stat().st_mtime,reverse=True)
    if not csvs: return None
    newest=csvs[0]; edad_h=(time.time()-newest.stat().st_mtime)/3600
    if edad_h>max_horas: log(f"  CSV local ({newest.name}) tiene {edad_h:.0f}h — muy antiguo"); return None
    log(f"  Leyendo CSV local: {newest.name} ({edad_h:.1f}h)")
    try:
        df=pd.read_csv(newest); log(f"  {len(df)} filas"); return df
    except Exception as e:
        log(f"  Error CSV: {e}"); return None

def guardar_xlsx(hoja1, hoja2, path):
    os.makedirs(os.path.dirname(os.path.abspath(path)),exist_ok=True)
    log(f"  Guardando en {path}...")
    with pd.ExcelWriter(path,engine="openpyxl") as w:
        hoja1.to_excel(w,sheet_name="Hoja1",index=False)
        hoja2.to_excel(w,sheet_name="Hoja2",index=False)
    log(f"  Guardado OK — {len(hoja1)} precios, {len(hoja2)} productos")

def main():
    log("\n=== DESCARGA ERP JUSTIME ===\n")
    log("[1/4] Iniciando sesion...")
    session,landing_url=login(); log(f"  Landing URL: {landing_url}")

    log("[2/4] Descargando existencias clasificadas (todas las bodegas via SSRS)...")
    df_bodega = descargar_existencias_playwright()
    log(f"  Catalogo total   : {len(df_bodega)} productos")
    log(f"  PEM_DISP / TRANS : {int(df_bodega['PEM_DISP'].sum())} / {int(df_bodega['PEM_TRANS'].sum())}")
    log(f"  SEM_DISP         : {int(df_bodega['SEM_DISP'].sum())}")
    log(f"  CEM_DISP         : {int(df_bodega['CEM_DISP'].sum())}")
    log(f"  MEM_DISP         : {int(df_bodega['MEM_DISP'].sum())}")
    log(f"  IEM_DISP / TRANS : {int(df_bodega['IEM_DISP'].sum())} / {int(df_bodega['IEM_TRANS'].sum())}")
    log(f"  TEM_DISP / TRANS : {int(df_bodega['TEM_DISP'].sum())} / {int(df_bodega['TEM_TRANS'].sum())}")
    log(f"  RCE_DISP         : {int(df_bodega['RCE_DISP'].sum())}")
    log(f"  CD_DISP  / TRANS : {int(df_bodega['CD_DISP'].sum())} / {int(df_bodega['CD_TRANS'].sum())}")

    import time; time.sleep(2)
    log("[3/4] Descargando lista de precios (El Manzano, Tipo Venta)...")
    df_precio_raw=None
    try:
        df_precio_raw=descargar_precio_playwright(); log("  [OK] Precios desde VisorRS.")
    except Exception as e_visor:
        log(f"  VisorRS no disponible: {e_visor}")
        log("  Buscando CSV local en Descargas...")
        df_precio_raw=leer_csv_local_manzano(max_horas=24)
        if df_precio_raw is not None: log("  [OK] Precios desde CSV local.")
    if df_precio_raw is None:
        log("\n[ERROR] No se pudo obtener precios."); log("  Verifica VPN Oviedo y Edge instalado."); sys.exit(1)
    df_precio=normalizar_precio(df_precio_raw)
    log("[4/4] Guardando actualizar.xlsx...")
    guardar_xlsx(df_precio,df_bodega,XLSX)
    log("\n=== COMPLETADO ===")
    log("Ahora ejecuta ACTUALIZAR_TODO.bat para procesar y publicar.")

if __name__=="__main__":
    try: main()
    except Exception as e: log(f"\n[ERROR] {e}"); sys.exit(1)
