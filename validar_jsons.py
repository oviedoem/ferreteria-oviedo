"""
validar_jsons.py - Validador post-pipeline (solo lectura)

Corre entre el ultimo paso Python (main.py / PASO 2) y el deploy en
ACTUALIZAR_TODO.bat. Si algun JSON de salida quedo roto, vacio o a medio
generar, bloquea el deploy con exit(1) ANTES de que rotar_token_data.py
mueva los archivos y firebase publique datos inconsistentes.

No escribe ni modifica ningun JSON. Solo lee y valida.

Uso: python validar_jsons.py
"""
import json
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, 'data')
CATALOGO_DIR = os.path.join(BASE, 'CATALOGO PRODUCTOS')

# bod-* van a data/[token]/ (descargar_bod.py usa token subfolder)
_token_file = os.path.join(DATA_DIR, '.token-actual')
_token = open(_token_file).read().strip() if os.path.exists(_token_file) else ''
BOD_DIR = os.path.join(DATA_DIR, _token) if _token else DATA_DIR

# kind:
#   'wrapped'   -> dict con claves raiz obligatorias; si hay array_field, debe
#                  ser una lista/dict no vacio
#   'raw_dict'  -> dict en la raiz, keyed por codigo de producto, no vacio
#   'raw_list'  -> lista en la raiz, no vacia
#
# optional=True -> si el archivo no existe se omite (pasos opcionales, ej.
#                  Playwright que puede no haber corrido en esta sesion)
SCHEMA = {
    'catalogo-dinamico.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'productos'],
    },
    'ranking-unidades.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'fuente', 'total', 'registros'], 'array_field': 'registros',
    },
    'precios-diff.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'fuente', 'total', 'registros'], 'array_field': 'registros',
    },
    'ventas-xlsm-2026.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'fuente', 'anio', 'total', 'registros'], 'array_field': 'registros',
    },
    'ventas-xlsm-sector.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'fuente', 'total', 'registros'], 'array_field': 'registros',
    },
    'bod-iem-registros.json': {
        'dir': BOD_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'fuente', 'bod', 'total', 'registros'], 'array_field': 'registros',
        'optional': True,
    },
    'bod-rce-registros.json': {
        'dir': BOD_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'fuente', 'bod', 'total', 'registros'], 'array_field': 'registros',
        'optional': True,
    },
    'bod-cem-registros.json': {
        'dir': BOD_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'fuente', 'bod', 'total', 'registros'], 'array_field': 'registros',
    },
    'bod-icd-registros.json': {
        'dir': BOD_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'fuente', 'bod', 'total', 'registros'], 'array_field': 'registros',
    },
    'pedidos-comprometidos.json': {
        'dir': DATA_DIR, 'kind': 'raw_dict',
    },
    'pedidos-detalle.json': {
        'dir': DATA_DIR, 'kind': 'raw_dict',
    },
    'despachos-comprometidos.json': {
        'dir': DATA_DIR, 'kind': 'raw_dict',
    },
    'despachos-detalle.json': {
        'dir': DATA_DIR, 'kind': 'raw_dict',
    },
    # despachos-panel.json eliminado 2026-08-20: fusionar_despachos.py archivado, panel usa despachos-detalle.json
    'informe-stock.json': {
        'dir': DATA_DIR, 'kind': 'raw_dict',
    },
    'stock-critico.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'fuente', 'bodegas', 'productos', 'porBodega'], 'array_field': 'productos',
    },
    'oc-leadtime.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'fuente', 'ventanaDias', 'productos'], 'array_field': 'productos',
    },
    # oc-pendientes.json (detalle) no se valida: lista vacia es legitima (0 OCs activas)
    'oc-pend-resumen.json': {
        'dir': DATA_DIR, 'kind': 'raw_dict', 'optional': True,
    },
    'xlsm-enrich.json': {
        'dir': DATA_DIR, 'kind': 'raw_dict',
    },
    'recepciones-pendientes.json': {
        'dir': DATA_DIR, 'kind': 'raw_list', 'optional': True,
    },
    'despachos-pendientes-erp.json': {
        'dir': DATA_DIR, 'kind': 'raw_list', 'optional': True,
    },
    'ventas-manzano-meta.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'desde', 'hasta', 'total', 'anios'],
    },
    'ventas-manzano.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'total', 'registros'], 'array_field': 'registros',
    },
    'ventas-manzano-2026.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'total', 'registros'], 'array_field': 'registros',
    },
    'ventas-manzano-2026-01.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'total', 'registros'], 'array_field': 'registros',
    },
    'ventas-manzano-2026-02.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'total', 'registros'], 'array_field': 'registros',
    },
    'ventas-manzano-2026-03.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'total', 'registros'], 'array_field': 'registros',
    },
    'ventas-manzano-2026-04.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'total', 'registros'], 'array_field': 'registros',
    },
    'ventas-manzano-2026-05.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'total', 'registros'], 'array_field': 'registros',
    },
    'ventas-manzano-2026-06.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'total', 'registros'], 'array_field': 'registros',
    },
    'Datos.json': {
        'dir': CATALOGO_DIR, 'kind': 'raw_list',
    },
}


def validar_ventas_vs_enrich():
    """
    Compara la suma de valorNeto por documento en ventas-manzano.json contra
    el VALOR_NETO SQL guardado en xlsm-enrich.json (campo 'neto').

    Detecta documentos con divergencia >5% entre panel y SQL.
    Si >10% del total de docs con neto SQL divergen, es senal de que la
    normalizacion no se aplico (ej. ERP cloud genero duplicados sin correccion).
    Bloquea el deploy con descripcion del problema.

    No hace consultas SQL: solo lee archivos locales ya generados.
    """
    ventas_path = os.path.join(DATA_DIR, 'ventas-manzano.json')
    enrich_path = os.path.join(DATA_DIR, 'xlsm-enrich.json')

    if not os.path.exists(ventas_path) or not os.path.exists(enrich_path):
        return None, 'OMITIDO (archivos no disponibles aun)'

    try:
        with open(ventas_path, 'r', encoding='utf-8') as f:
            ventas_data = json.load(f)
        with open(enrich_path, 'r', encoding='utf-8') as f:
            enrich = json.load(f)
    except Exception as e:
        return None, 'OMITIDO (error al leer: ' + str(e) + ')'

    sample = next(iter(enrich.values()), {})
    if 'neto' not in sample:
        return False, ('xlsm-enrich.json sin campo neto — '
                       'ejecutar descargar_ventas_enrich.py (PASO 1K) antes de deploy')

    registros = ventas_data.get('registros', [])
    if not registros:
        return None, 'OMITIDO (ventas-manzano.json sin registros)'

    # Sumar valorNeto por documento (panel)
    sumas_panel = {}
    for r in registros:
        try:
            num = str(int(float(str(r.get('numero', '')).strip())))
        except Exception:
            continue
        sumas_panel[num] = sumas_panel.get(num, 0) + r.get('valorNeto', 0)

    divergentes = []
    docs_con_neto = 0
    for num, panel_sum in sumas_panel.items():
        e = enrich.get(num, {})
        sql_neto = int(e.get('neto', 0) or 0)
        if not sql_neto:
            continue
        docs_con_neto += 1
        # NCE: signos opuestos SQL/SSRS por diseno — saltar
        if (panel_sum > 0) != (sql_neto > 0):
            continue
        if sql_neto == 0:
            continue
        diff_pct = abs(panel_sum - sql_neto) / abs(sql_neto) * 100
        if diff_pct > 5:
            divergentes.append((num, panel_sum, sql_neto, round(diff_pct, 1)))

    n_div = len(divergentes)
    umbral = max(10, int(docs_con_neto * 0.10))

    if n_div > umbral:
        muestra = divergentes[:3]
        return False, (
            'INCONSISTENCIA VENTAS vs SQL: ' + str(n_div) + '/' + str(docs_con_neto) +
            ' docs con divergencia >5% -- senal de duplicados ERP cloud sin normalizar. '
            'Ejecutar main.py para aplicar normalizacion. '
            'Muestra (num, panel, sql, pct%): ' + str(muestra)
        )

    return True, (str(n_div) + ' docs con divergencia >5% de ' +
                  str(docs_con_neto) + ' verificados (dentro del umbral)')


def validar_datos_campos_bot():
    """
    Verifica que Datos.json tenga los campos que consume el bot de WhatsApp.
    catalogo-bot.json (PASO 5) se genera desde este archivo; si faltan campos
    o los precios vienen todos en 0, el bot responderia sin precio/stock.
    Bloquea el deploy en esos casos.

    Solo lectura. No modifica nada.
    """
    ruta = os.path.join(CATALOGO_DIR, 'Datos.json')
    if not os.path.isfile(ruta):
        return None, 'OMITIDO (Datos.json no existe)'
    try:
        with open(ruta, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        return None, 'OMITIDO (error al leer: ' + str(e) + ')'
    if not isinstance(data, list) or not data:
        return None, 'OMITIDO (lista vacia o no es lista)'

    campos = ['codigo', 'descripcion', 'precioiva', 'pem', 'sem']
    for p in data[:50]:  # muestra de los primeros 50
        faltan = [c for c in campos if c not in p]
        if faltan:
            return False, ('Datos.json sin campos ' + str(faltan) +
                           ' en codigo ' + str(p.get('codigo', '?')) +
                           ' -- el bot no podria dar precio ni stock')

    sin_precio = sum(1 for p in data if not p.get('precioiva'))
    if sin_precio == len(data):
        return False, ('Datos.json con TODOS los precios en 0 -- '
                       'revisar descarga ERP antes de publicar al bot')

    pct = round(sin_precio * 100 / len(data), 1)
    return True, (str(len(data)) + ' productos con campos bot OK; ' +
                  str(sin_precio) + ' sin precio (' + str(pct) + '%)')


def contar(valor):
    if isinstance(valor, list):
        return len(valor)
    if isinstance(valor, dict):
        return len(valor)
    return None


def validar_archivo(nombre, spec):
    ruta = os.path.join(spec['dir'], nombre)

    if not os.path.isfile(ruta):
        if spec.get('optional'):
            return None, 'OMITIDO (opcional, no generado en esta corrida)'
        return False, 'NO EXISTE: ' + ruta

    if os.path.getsize(ruta) == 0:
        return False, 'ARCHIVO VACIO (0 bytes): ' + ruta

    try:
        with open(ruta, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return False, 'JSON INVALIDO (' + str(e) + '): ' + ruta
    except Exception as e:
        return False, 'ERROR AL LEER (' + str(e) + '): ' + ruta

    kind = spec['kind']

    if kind == 'raw_list':
        if not isinstance(data, list):
            return False, 'SE ESPERABA UNA LISTA en la raiz: ' + ruta
        if len(data) < 1:
            if spec.get('optional'):
                return None, 'OMITIDO (opcional, lista vacía — Playwright sin datos esta corrida)'
            return False, 'LISTA VACIA: ' + ruta
        return True, str(len(data)) + ' registros'

    if kind == 'raw_dict':
        if not isinstance(data, dict):
            return False, 'SE ESPERABA UN OBJETO en la raiz: ' + ruta
        if len(data) < 1:
            return False, 'OBJETO VACIO: ' + ruta
        return True, str(len(data)) + ' claves'

    if kind == 'wrapped':
        if not isinstance(data, dict):
            return False, 'SE ESPERABA UN OBJETO en la raiz: ' + ruta
        faltantes = [k for k in spec['keys'] if k not in data]
        if faltantes:
            return False, 'FALTAN CLAVES ' + str(faltantes) + ' en: ' + ruta

        array_field = spec.get('array_field')
        if array_field:
            cnt = contar(data.get(array_field))
            if cnt is None:
                return False, 'CAMPO "' + array_field + '" no es lista/objeto en: ' + ruta
            if cnt < 1:
                if spec.get('optional'):
                    return None, 'OMITIDO (opcional, lista vacía — sin datos esta corrida)'
                return False, 'CAMPO "' + array_field + '" VACIO en: ' + ruta
            return True, str(cnt) + ' registros'

        return True, 'OK (sin campo de conteo)'

    return False, 'KIND DESCONOCIDO EN SCHEMA: ' + kind


def main():
    print('=' * 60)
    print('VALIDACION POST-PIPELINE DE JSONs')
    print('=' * 60)

    errores = []
    resumen = []

    for nombre, spec in SCHEMA.items():
        ok, msg = validar_archivo(nombre, spec)
        if ok is None:
            resumen.append((nombre, 'OMITIDO', msg))
        elif ok:
            resumen.append((nombre, 'OK', msg))
        else:
            resumen.append((nombre, 'ERROR', msg))
            errores.append(nombre + ': ' + msg)

    # Validacion cruzada ventas panel vs SQL neto (detecta duplicados ERP cloud)
    ok_v, msg_v = validar_ventas_vs_enrich()
    if ok_v is None:
        resumen.append(('ventas-vs-enrich [CONSISTENCIA]', 'OMITIDO', msg_v))
    elif ok_v:
        resumen.append(('ventas-vs-enrich [CONSISTENCIA]', 'OK', msg_v))
    else:
        resumen.append(('ventas-vs-enrich [CONSISTENCIA]', 'ERROR', msg_v))
        errores.append('ventas-vs-enrich [CONSISTENCIA]: ' + msg_v)

    # Validacion campos que consume el bot de WhatsApp (catalogo-bot.json PASO 5)
    ok_b, msg_b = validar_datos_campos_bot()
    if ok_b is None:
        resumen.append(('datos-campos-bot [BOT WHATSAPP]', 'OMITIDO', msg_b))
    elif ok_b:
        resumen.append(('datos-campos-bot [BOT WHATSAPP]', 'OK', msg_b))
    else:
        resumen.append(('datos-campos-bot [BOT WHATSAPP]', 'ERROR', msg_b))
        errores.append('datos-campos-bot [BOT WHATSAPP]: ' + msg_b)

    print('')
    for nombre, estado, msg in resumen:
        print('[' + estado + '] ' + nombre + ' - ' + msg)

    print('')
    print('=' * 60)

    if errores:
        print('RESULTADO: BLOQUEADO -- ' + str(len(errores)) + ' archivo(s) con error')
        print('=' * 60)
        for e in errores:
            print('  - ' + e)
        sys.exit(1)

    print('RESULTADO: OK -- todos los JSONs validados correctamente')
    print('=' * 60)
    sys.exit(0)


if __name__ == '__main__':
    main()
