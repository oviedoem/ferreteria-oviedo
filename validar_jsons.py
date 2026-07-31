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
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'fuente', 'bod', 'total', 'registros'], 'array_field': 'registros',
        'optional': True,
    },
    'bod-rce-registros.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'fuente', 'bod', 'total', 'registros'], 'array_field': 'registros',
    },
    'bod-cem-registros.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['generado', 'fuente', 'bod', 'total', 'registros'], 'array_field': 'registros',
    },
    'bod-icd-registros.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
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
    'despachos-panel.json': {
        'dir': DATA_DIR, 'kind': 'wrapped',
        'keys': ['meta', 'documentos'], 'array_field': 'documentos',
    },
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
