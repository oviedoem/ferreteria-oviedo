# Descarga Lista de Precio VisorRS — El Manzano

## Requisitos
```
pip install playwright
python -m playwright install msedge
```

## Script

```python
import asyncio
from playwright.async_api import async_playwright
import os

DOWNLOAD_DIR = r"D:\ferreteria-oviedo"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# La sesión (S(...)) en la URL expira — si falla con 0 páginas, abrir manualmente
# http://foviedo.justtime.cl/visor/ con usuario agonzalez / 4040
# y copiar la URL del VisorRS.aspx con el nuevo session token
URL = (
    "http://foviedo.justtime.cl/visor/(S(rcpubm55ke40qyihh5idfyxh))"
    "/VisorRS.aspx?xToken=943679d1-f74c-f111-8b81-00155d9d0600"
    "&xInforme=RS_Documentos/listaprecio&xTituloInforme=Lista%20Precio"
)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="msedge", headless=False)
        context = await browser.new_context(accept_downloads=True)
        page = await context.new_page()

        await page.goto(URL, wait_until="networkidle", timeout=30000)

        # Tipo = Venta (value=1)
        await page.select_option('select[name="RV$ctl08$ctl04$ddValue"]', '1')
        await page.wait_for_load_state("networkidle", timeout=15000)

        # Lista de Precio = El Manzano (value=4)
        await page.select_option('select[name="RV$ctl08$ctl06$ddValue"]', '4')
        await page.wait_for_load_state("networkidle", timeout=15000)

        # Hiper Familia = Todas (value=1)
        await page.select_option('select[name="RV$ctl08$ctl08$ddValue"]', '1')
        await page.wait_for_load_state("networkidle", timeout=10000)

        # Id Marca = Seleccionar todo
        await page.click('button#RV_ctl08_ctl10_ctl01')
        await page.wait_for_timeout(700)
        await page.check('input#RV_ctl08_ctl10_divDropDown_ctl00')
        await page.wait_for_timeout(500)
        await page.keyboard.press('Escape')

        # Familia = Todas (value=1)
        await page.select_option('select[name="RV$ctl08$ctl12$ddValue"]', '1')

        # Temporada = Todas las Temporadas
        await page.click('button#RV_ctl08_ctl14_ctl01')
        await page.wait_for_timeout(700)
        await page.check('input#RV_ctl08_ctl14_divDropDown_ctl02')
        await page.wait_for_timeout(500)
        await page.keyboard.press('Escape')

        # Sub Familia = Todas (value=1)
        await page.select_option('select[name="RV$ctl08$ctl16$ddValue"]', '1')

        # Ver informe — puede tardar 1–2 minutos con todas las marcas
        await page.click('input#RV_ctl08_ctl00')
        await page.wait_for_load_state("networkidle", timeout=120000)
        await page.wait_for_timeout(3000)

        # Exportar a Excel
        await page.click('#RV_ctl09_ctl04_ctl00_ButtonLink')
        await page.wait_for_timeout(1000)

        async with page.expect_download(timeout=120000) as dl_info:
            await page.click('a[title="Excel"]')

        download = await dl_info.value
        filename = download.suggested_filename or "listaprecio.xlsx"
        dest = os.path.join(DOWNLOAD_DIR, filename)
        await download.save_as(dest)
        print(f"Guardado: {dest}  ({os.path.getsize(dest)//1024} KB)")

        await browser.close()

asyncio.run(main())
```

## Cómo ejecutar
```
python D:\ferreteria-oviedo\descarga_lista_precio.py
```

## Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `spawn UNKNOWN` al lanzar | Chromium built-in falla en Windows | Ya resuelto usando `channel="msedge"` |
| Informe muestra 0 páginas | Sesión `(S(...))` expiró | Abrir el VisorRS en Edge manualmente, iniciar sesión, copiar la nueva URL al script |
| `TimeoutError` en Ver informe | El reporte es grande (~500 marcas) | Aumentar `timeout=120000` a `180000` |
| Descarga no inicia | Dropdown de exportar no abrió | Aumentar `wait_for_timeout(1000)` a `2000` antes de `a[title="Excel"]` |

## Notas
- El token `xToken=943679d1-...` es permanente (identifica la sucursal El Manzano).
- El session token `(S(...))` en la URL cambia con cada nueva sesión del navegador.
- El archivo se guarda como `listaprecio.xlsx` en `D:\ferreteria-oviedo\`.
