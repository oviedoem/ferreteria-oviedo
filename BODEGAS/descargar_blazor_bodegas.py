"""
descargar_blazor_bodegas.py  V1.1  2026-07-25
Descarga "Por Recepcionar" y "Por Despachar" en UNA sola sesion Playwright.
Reemplaza: descargar_recepciones_pendientes.py + descargar_despachos_erp.py
           (antes 2 logins + 2 sesiones Chromium al mismo URL/token)

Ahorro: ~15-20s + 1 sesion de browser eliminada.

Genera:
  data/recepciones-pendientes.json   -- GRT/GIB pendientes de Editar+Grabar
  data/despachos-pendientes-erp.json -- docs pendientes de despacho (tiempo real)

Fuente: Intranet JustWeb Blazor Web App (blazor.web.js v8, render mode WASM por componente)
        IdMenu=377 (Movimiento de Bodegas -> Mantencion despachos)

Auto-renovacion TOKEN_RECEPCION (V1.1 2026-07-25):
  Si la pagina no carga (token vencido, TTL ~2 dias), el script hace login con
  user/pass, lee el nuevo token del DOM del PERFIL DE USUARIO y actualiza
  credenciales_erp.ini automaticamente, sin intervencion manual.
"""

import asyncio, json, sys, os, configparser, tempfile, re
from pathlib import Path

BASE_DIR = Path(r"E:\ferreteria-oviedo")
DATA_DIR = BASE_DIR / "data"

_CRED_PATHS = [
    BASE_DIR / "CATALOGO PRODUCTOS" / "scripts" / "credenciales_erp.ini",
]


def log(msg):
    try:
        print(msg, flush=True)
    except UnicodeEncodeError:
        print(str(msg).encode("ascii", errors="replace").decode("ascii"), flush=True)


def leer_credenciales():
    cfg = configparser.ConfigParser()
    for p in _CRED_PATHS:
        if p.exists():
            cfg.read(str(p), encoding="utf-8")
            if "ERP" in cfg:
                log("[cred] Usando: " + str(p))
                break
    if "ERP" not in cfg:
        raise FileNotFoundError("No se encontro credenciales_erp.ini con seccion [ERP]")
    erp = cfg["ERP"]
    return {
        "user":            erp.get("USER", ""),
        "clave":           erp.get("CLAVE", ""),
        "base":            erp.get("BASE", ""),
        "blazor_root":     erp.get("BLAZOR_ROOT", ""),
        "token_recepcion": erp.get("TOKEN_RECEPCION", ""),
        "ws_ip_fallback":  erp.get("WS_IP_FALLBACK", ""),
    }


def parsear_recepciones(path_excel):
    import pandas as pd
    df = pd.read_excel(path_excel, dtype=str)
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    log("[excel-recep] Columnas: " + str(list(df.columns)))
    result = []
    for _, row in df.iterrows():
        numero = str(row.get("numero", "") or "").strip()
        if not numero or numero.lower() in ("nan", "none", ""):
            continue
        result.append({
            "tipoDoc":      str(row.get("documento",     "") or "").strip(),
            "numero":       numero,
            "sucursal":     str(row.get("sucursal",      "") or "").strip(),
            "responsable":  str(row.get("responsable",   "") or "").strip(),
            "emision":      str(row.get("emision",       "") or "").strip(),
            "bodega":       str(row.get("bod",           "") or "").strip(),
            "fechaEntrega": str(
                row.get("fecha_entrega", "") or
                row.get("fecha entrega", "") or ""
            ).strip(),
        })
    return result


def parsear_despachos(path_excel):
    import pandas as pd
    df = pd.read_excel(path_excel, dtype=str)
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    log("[excel-despa] Columnas: " + str(list(df.columns)))
    result = []
    for _, row in df.iterrows():
        numero = str(row.get("numero", "") or "").strip()
        if not numero or numero.lower() in ("nan", "none", ""):
            continue
        result.append({
            "tipoDoc":      str(row.get("documento",     "") or "").strip(),
            "numero":       numero,
            "sucursal":     str(row.get("sucursal",      "") or "").strip(),
            "responsable":  str(row.get("responsable",   "") or "").strip(),
            "emision":      str(row.get("emision",       "") or "").strip(),
            "bodega":       str(row.get("bod",           "") or "").strip(),
            "fechaEntrega": str(
                row.get("fecha_entrega", "") or
                row.get("fecha entrega", "") or ""
            ).strip(),
            "cliente":      str(row.get("cliente",       "") or
                               row.get("razon_social",   "") or
                               row.get("razon social",   "") or "").strip(),
            "rut":          str(row.get("rut",           "") or "").strip(),
            "vendedor":     str(row.get("vendedor",      "") or
                               row.get("idvendedor",     "") or "").strip(),
            "atraso":       str(row.get("dias_atraso",   "") or
                               row.get("atraso",         "") or "0").strip(),
        })
    return result


_GUID_RE = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', re.I)


def actualizar_token_ini(nuevo_token):
    """Reemplaza TOKEN_RECEPCION en credenciales_erp.ini."""
    for p in _CRED_PATHS:
        if p.exists():
            texto = p.read_text(encoding="utf-8")
            nuevo = re.sub(
                r'(?im)^(TOKEN_RECEPCION\s*=\s*).*$',
                lambda m: m.group(1) + nuevo_token,
                texto,
            )
            if nuevo != texto:
                p.write_text(nuevo, encoding="utf-8")
                log(f"[token] credenciales_erp.ini actualizado → {nuevo_token[:8]}...")
            else:
                log(f"[token] Token sin cambios en ini ({nuevo_token[:8]}...)")
            return


async def leer_token_del_perfil(page):
    """
    Abre el panel PERFIL DE USUARIO (click en #right-pain) y lee el GUID del token.
    Selector del token: div.user-profile-item-value[title] dentro de .user-profile-dialog
    (confirmado desde HTML guardado 25-07-2026).
    Retorna el GUID en minusculas o None si falla.
    """
    try:
        await page.locator("#right-pain").first.click()
        await page.wait_for_selector(".user-profile-dialog", timeout=25000)
        await page.wait_for_timeout(1000)
        valor = await page.locator(
            ".user-profile-dialog .user-profile-item-value[title]"
        ).first.get_attribute("title")
        if valor and _GUID_RE.fullmatch(valor.strip()):
            # cerrar el dialogo para no interferir con los clicks de exportar
            try:
                await page.locator(".user-profile-dialog .e-dlg-closeicon-btn").first.click()
                await page.wait_for_timeout(500)
            except Exception:
                pass
            return valor.strip().lower()
    except Exception as e:
        log(f"[token] WARN leer_token_del_perfil: {e}")
    return None


async def renovar_token_via_login(page, creds):
    """
    Si el token expiro, hace login con user/pass en la raiz del ERP.
    El ERP Blazor muestra primero una seleccion de empresa (escribir "oviedo")
    antes del formulario de usuario/clave.
    Retorna el nuevo token (str) o None si falla.
    """
    try:
        log("[token] Token vencido — intentando login con credenciales...")
        await page.goto(creds["blazor_root"] + "/", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(5000)

        # Paso 1: formulario usuario / clave
        # Blazor WASM tarda 10-20s en renderizar el formulario — esperar el input
        user_input = page.locator("input[type='text'], input[type='email']").first
        await user_input.wait_for(state="visible", timeout=60000)
        await user_input.fill(creds["user"])
        pass_input = page.locator("input[type='password']").first
        await pass_input.fill(creds["clave"])

        btn = page.locator("button:has-text('LOGIN'), button:has-text('Ingresar'), button[type='submit']").first
        await btn.click()
        await page.wait_for_timeout(10000)

        # Paso 2: seleccion de servidor — aparece menu con "SQL Instancia 3" / "Oviedo"
        # Nuevo servidor erp.justtime.cl puede omitir este paso y ir directo a catálogos
        try:
            import re as _re
            btn_oviedo = page.locator("button").filter(has_text=_re.compile(r'^\s*Oviedo\s*$'))
            await btn_oviedo.wait_for(state="visible", timeout=10000)
            await btn_oviedo.click()
            log("[token] Servidor 'Oviedo' seleccionado OK")
            await page.wait_for_timeout(5000)
        except Exception as e:
            log(f"[token] (servidor skip) {e}")

        # Paso 3: seleccion de catalogo — aparece menu con Cachapoal/Foviedo/Foviedo_spa/Foviedo_Test
        # Regex exacto para no confundir "Foviedo" con "Foviedo_spa" o "Foviedo_Test"
        try:
            import re as _re2
            btn_foviedo = page.locator("button").filter(has_text=_re2.compile(r'^\s*Foviedo\s*$'))
            await btn_foviedo.wait_for(state="visible", timeout=30000)
            await btn_foviedo.click()
            log("[token] Catalogo 'Foviedo' seleccionado OK")
            await page.wait_for_timeout(20000)
        except Exception as e:
            log(f"[token] (catalogo skip) {e}")

        nuevo_token = await leer_token_del_perfil(page)
        if nuevo_token:
            actualizar_token_ini(nuevo_token)
            log(f"[token] Auto-renovacion OK: {nuevo_token[:8]}...")
            return nuevo_token
        else:
            log("[token] WARN: login OK pero no se pudo leer token del perfil")
    except Exception as e:
        log(f"[token] WARN renovar_token_via_login: {e}")
    return None


async def exportar_tab(page, texto_tab, nombre_log):
    """Click en tab y descarga Excel. Retorna path temporal o None.
    Tab structure: <div role='tab' class='e-tab-wrap'>...<div class='e-tab-text'>Por despachar</div>
    Export button: <button class='e-boton'>Exportar a Excel</button>  (sin atributo title)
    """
    # Click en el tab — solo si el texto no corresponde al tab ya activo
    try:
        tab_loc = page.locator(f"[role='tab']:has-text('{texto_tab}')").first
        await tab_loc.wait_for(state="visible", timeout=20000)
        await tab_loc.click()
        log(f"[nav] Tab 'Por {texto_tab}' clickeado")
        # Esperar que Blazor actualice el contenido del tab via SignalR
        await page.wait_for_timeout(4000)
    except Exception as e:
        log(f"[nav] WARN click tab '{texto_tab}': {e}")

    # Exportar — boton class=e-boton con texto 'Exportar' (substring; el texto completo
    # puede variar entre versiones del ERP: 'Exportar' / 'Exportar a Excel')
    tmp = tempfile.mktemp(suffix=".xlsx")
    try:
        export_loc = page.locator("button.e-boton:has-text('Exportar')").first
        await export_loc.wait_for(state="visible", timeout=20000)
        async with page.expect_download(timeout=45000) as dl_info:
            await export_loc.click()
        dl = await dl_info.value
        await dl.save_as(tmp)
        log(f"[export] {nombre_log}: OK ({dl.suggested_filename or 'archivo.xlsx'})")
        return tmp
    except Exception as e:
        log(f"[ERROR] Exportar {nombre_log}: {e}")
        return None


async def _ejecutar(creds):
    from playwright.async_api import async_playwright

    token = creds["token_recepcion"]
    blazor_root = creds["blazor_root"]
    url_menu = blazor_root + "/?Token=" + token + "&IdMenu=377"
    log(f"[nav] URL: {blazor_root}/?Token=***&IdMenu=377")

    async with async_playwright() as p:
        # Workaround CORS 2026-07-01: el WsApi ERP (foviedo.justtime.cl:6969) dejo de enviar
        # Access-Control-Allow-Origin y el navegador bloquea los fetch del Blazor ("No existe
        # conexion al WS"). --disable-web-security desactiva ese chequeo SOLO en este browser
        # de automatizacion (Playwright usa un user-data-dir temporal propio, requisito del flag).
        # Quitar cuando JustTime restaure CORS en el servidor.
        browser = await p.chromium.launch(
            channel="msedge", headless=False,
            args=["--disable-web-security", "--disable-features=IsolateOrigins,site-per-process"],
        )
        ctx  = await browser.new_context(accept_downloads=True)

        # Workaround #2 (2026-07-01): tras el login el ERP le dice a la app (via getbase)
        # que su API vive en localhost:6969 en vez de foviedo.justtime.cl:6969 —
        # misconfig del servidor tras la actualizacion. Desde otro PC eso da
        # ERR_CONNECTION_REFUSED y el menu IdMenu=377 nunca carga. Reescribimos esas
        # llamadas al host real. Quitar cuando JustTime corrija getbase en el servidor.
        # 2026-07-03: con VPN activa getbase() puede devolver la IP real del servidor
        # o el hostname en vez de localhost — intercept ampliado.
        # IP real leída de WS_IP_FALLBACK en credenciales_erp.ini (no hardcodeada).
        _WS_HOST = "foviedo.justtime.cl:6969"
        _WS_ALIASES = ["localhost:6969"]
        if creds.get("ws_ip_fallback"):
            _WS_ALIASES.append(creds["ws_ip_fallback"])
        async def _rewrite_ws(route):
            req = route.request
            matched = next((a for a in _WS_ALIASES if a in req.url), None)
            if matched:
                new_url = req.url.replace(matched, _WS_HOST)
                try:
                    r = await ctx.request.fetch(
                        new_url, method=req.method, headers=req.headers,
                        data=req.post_data_buffer,
                    )
                    # body ya viene descomprimido; quitar headers que descuadran al reenviar
                    hdrs = {k: v for k, v in r.headers.items()
                            if k.lower() not in ("content-encoding", "content-length", "transfer-encoding")}
                    await route.fulfill(status=r.status, headers=hdrs, body=await r.body())
                except Exception:
                    await route.continue_()  # si el proxy falla, dejar pasar la request original
            else:
                await route.continue_()
        await ctx.route("**://localhost:6969/**", _rewrite_ws)
        await ctx.route("**://wsapi.justtime.cl/**", _rewrite_ws)

        page = await ctx.new_page()

        # ── Navegar directo con token ──────────────────────────────────────────
        await page.goto(url_menu, wait_until="domcontentloaded", timeout=60000)

        # Esperar que Blazor conecte SignalR y renderice el botón Exportar.
        # 2026-07-01: CORS workaround hace que SignalR tarde >30s en estabilizarse.
        # 2026-07-03: los reloads interrumpían SignalR justo cuando estaba por conectar.
        #             Un solo intento de 90s sin reload da tiempo suficiente.
        exportar_visible = False
        try:
            await page.wait_for_selector("button.e-boton:has-text('Exportar')", timeout=90000)
            log("[nav] Pagina lista (Exportar visible)")
            exportar_visible = True
        except Exception:
            log("[nav] WARN: Exportar no visible en 90s — token puede estar expirado o SignalR caido")
        if not exportar_visible:
            # Token vencido o SignalR caido — intentar auto-renovacion via login
            nuevo_token = await renovar_token_via_login(page, creds)
            if nuevo_token:
                url_retry = blazor_root + "/?Token=" + nuevo_token + "&IdMenu=377"
                log(f"[nav] Reintentando con token renovado...")
                await page.goto(url_retry, wait_until="domcontentloaded", timeout=60000)
                try:
                    await page.wait_for_selector(
                        "button.e-boton:has-text('Exportar')", timeout=90000
                    )
                    log("[nav] Pagina lista con token renovado")
                    exportar_visible = True
                except Exception:
                    log("[nav] ERROR: pagina no cargo con token renovado — SignalR/servidor caido")
            if not exportar_visible:
                await page.wait_for_timeout(3000)

        # Tab "Por despachar" es el activo por defecto — exportar primero
        log("[despa] Exportando tab Por Despachar (activo por defecto)...")
        tmp_despa = await exportar_tab(page, "Despachar", "despachos-pendientes-erp.xlsx")

        # Hacer click en tab "Por recepcionar" y exportar
        log("[recep] Haciendo click en tab Por Recepcionar...")
        tmp_recep = await exportar_tab(page, "Recepcionar", "recepciones-pendientes.xlsx")

        await browser.close()

    return tmp_recep, tmp_despa


def guardar_json(items, nombre_archivo):
    DATA_DIR.mkdir(exist_ok=True)
    out = DATA_DIR / nombre_archivo
    with open(out, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    return out


def main():
    log("[blazor_bodegas] Iniciando -- 1 sesion Playwright para 2 tabs")

    try:
        creds = leer_credenciales()
    except Exception as e:
        log("[ERROR] Credenciales: " + str(e))
        sys.exit(1)

    try:
        tmp_recep, tmp_despa = asyncio.run(_ejecutar(creds))
    except Exception as e:
        safe_msg = str(e).replace(creds["token_recepcion"], "***")
        log("[ERROR] Playwright: " + safe_msg)
        sys.exit(1)

    # ── Guardar recepciones ───────────────────────────────────────────────────
    items_recep = []
    if tmp_recep:
        try:
            items_recep = parsear_recepciones(tmp_recep)
        except Exception as e:
            log("[ERROR] Parsear recepciones: " + str(e))
        finally:
            try: os.unlink(tmp_recep)
            except Exception: pass

    guardar_json(items_recep, "recepciones-pendientes.json")
    log(f"[OK] recepciones-pendientes.json: {len(items_recep)} doc(s)")

    # ── Guardar despachos ─────────────────────────────────────────────────────
    items_despa = []
    if tmp_despa:
        try:
            items_despa = parsear_despachos(tmp_despa)
        except Exception as e:
            log("[ERROR] Parsear despachos: " + str(e))
        finally:
            try: os.unlink(tmp_despa)
            except Exception: pass

    guardar_json(items_despa, "despachos-pendientes-erp.json")
    log(f"[OK] despachos-pendientes-erp.json: {len(items_despa)} doc(s)")

    # ── Diagnostico: ERP reemplaza SQL? ──────────────────────────────────────
    tiene_cliente  = any(d.get("cliente")  for d in items_despa)
    tiene_rut      = any(d.get("rut")      for d in items_despa)
    tiene_vendedor = any(d.get("vendedor") for d in items_despa)
    log("[info] Columnas despachos con datos: cliente=" + str(tiene_cliente) +
        " | rut=" + str(tiene_rut) + " | vendedor=" + str(tiene_vendedor))
    if tiene_cliente and tiene_rut and tiene_vendedor:
        log("[OK] ERP tiene cliente+RUT+vendedor -> PUEDE reemplazar descargar_despachos.py (SQL)")
    else:
        log("[INFO] Columnas incompletas -> fusionar_despachos.py necesario")

    log("[blazor_bodegas] FINALIZADO")


if __name__ == "__main__":
    main()
