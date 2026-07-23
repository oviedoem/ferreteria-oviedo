#!/usr/bin/env python3
"""
Rotación automática del dataAccessToken — Ferretera Oviedo.

Flujo:
  --prepare  Lee token actual de Firestore, descarga archivos desde Firebase Hosting CDN,
             los escribe en data/<nuevo-token>/ Y en data/<token-actual>/ (para evitar
             ventana de inconsistencia durante deploy→commit), guarda nuevo token en
             .new_token_value.
  --commit   Lee .new_token_value y actualiza Firestore dataAccessToken/current con el nuevo
             token + expires_at (TTL 26 h), cerrando la rotación tras el deploy exitoso.

Requiere env var: FIREBASE_SERVICE_ACCOUNT  (contenido JSON de la service account key)
"""

import argparse
import datetime
import json
import os
import secrets
import sys

PROJECT_ID = "ferreteria-oviedo"
SITE = "ferreteria-oviedo"
BASE_URL = f"https://{SITE}.web.app"
HOSTING_API = "https://firebasehosting.googleapis.com/v1beta1"
# 26 h cubre un ciclo de 24 h + 2 h de margen para retrasos del cron
TOKEN_TTL_HOURS = 26
NEW_TOKEN_FILE = ".new_token_value"


# ── helpers ────────────────────────────────────────────────────────────────────────────

def load_service_account():
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "")
    if not sa_json:
        sys.exit("ERROR: FIREBASE_SERVICE_ACCOUNT env var no definida")
    try:
        return json.loads(sa_json)
    except json.JSONDecodeError as e:
        sys.exit(f"ERROR: JSON inválido en FIREBASE_SERVICE_ACCOUNT: {e}")


def get_oauth_token(sa_dict):
    from google.auth.transport.requests import Request as AuthRequest
    from google.oauth2 import service_account

    cred = service_account.Credentials.from_service_account_info(
        sa_dict,
        scopes=[
            "https://www.googleapis.com/auth/firebase",
            "https://www.googleapis.com/auth/cloud-platform",
        ],
    )
    cred.refresh(AuthRequest())
    return cred.token


def get_firestore_token(db):
    doc = db.collection("dataAccessToken").document("current").get()
    if not doc.exists:
        sys.exit("ERROR: dataAccessToken/current no existe en Firestore")
    token = (doc.to_dict() or {}).get("token")
    if not token:
        sys.exit("ERROR: campo 'token' ausente en dataAccessToken/current")
    return token


def list_token_files(oauth_token, old_token):
    import requests

    headers = {"Authorization": f"Bearer {oauth_token}"}

    # Obtener la versión del último release
    try:
        resp = requests.get(
            f"{HOSTING_API}/sites/{SITE}/releases",
            headers=headers,
            params={"pageSize": 1},
            timeout=30,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        sys.exit(f"ERROR: No se pudo obtener releases de Hosting: {e}")

    releases = resp.json().get("releases", [])
    if not releases:
        sys.exit("ERROR: No se encontraron releases en Firebase Hosting")

    version_name = releases[0]["version"]["name"]
    print(f"  Versión activa: {version_name}")

    # Paginar todos los archivos de la versión
    all_files = []
    page_token = None
    while True:
        params = {"pageSize": 1000}
        if page_token:
            params["pageToken"] = page_token
        try:
            resp = requests.get(
                f"{HOSTING_API}/{version_name}/files",
                headers=headers,
                params=params,
                timeout=30,
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            sys.exit(f"ERROR: No se pudo listar archivos de la versión: {e}")
        data = resp.json()
        all_files.extend(data.get("files", []))
        page_token = data.get("nextPageToken")
        if not page_token:
            break

    prefix = f"/data/{old_token}/"
    return [f["path"] for f in all_files if f["path"].startswith(prefix)]


def download_files(file_paths):
    import requests

    content_map = {}
    for path in file_paths:
        filename = path.rsplit("/", 1)[-1]
        url = f"{BASE_URL}{path}"
        print(f"  Descargando: {filename}")
        try:
            resp = requests.get(url, timeout=60)
            resp.raise_for_status()
        except requests.RequestException as e:
            sys.exit(f"ERROR: Fallo descargando {filename}: {e}")
        content_map[filename] = resp.content
    return content_map


def write_token_dir(content_map, token):
    out_dir = os.path.join("data", token)
    try:
        os.makedirs(out_dir, exist_ok=True)
        for filename, content in content_map.items():
            with open(os.path.join(out_dir, filename), "wb") as fh:
                fh.write(content)
            print(f"  Escrito: data/{token[:8]}.../{filename}")
    except OSError as e:
        sys.exit(f"ERROR: No se pudo escribir en {out_dir}: {e}")


# ── fases ────────────────────────────────────────────────────────────────────────────

def prepare(sa_dict):
    """Fase 1: descargar archivos y preparar el nuevo directorio de token.

    Escribe tanto data/<new_token>/ como data/<old_token>/ para que el deploy
    incluya ambas carpetas y los clientes con el token anterior no reciban 404
    durante la ventana entre deploy y commit a Firestore.
    """
    import firebase_admin
    from firebase_admin import credentials, firestore

    print("[1/4] Inicializando Firebase Admin SDK...")
    cred = credentials.Certificate(sa_dict)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    print("[2/4] Leyendo token actual desde Firestore...")
    old_token = get_firestore_token(db)
    print(f"  Token anterior: {old_token[:8]}...")

    print("[3/4] Listando archivos en la ruta del token actual...")
    oauth_token = get_oauth_token(sa_dict)
    file_paths = list_token_files(oauth_token, old_token)
    print(f"  Archivos encontrados: {len(file_paths)}")
    if not file_paths:
        sys.exit("ERROR: No se encontraron archivos en la ruta del token. Abortando.")

    print("[4/4] Descargando y escribiendo en nueva ruta...")
    content_map = download_files(file_paths)
    new_token = secrets.token_hex(16)

    # Escribir carpeta nueva (será el próximo token activo)
    write_token_dir(content_map, new_token)
    # Mantener carpeta del token actual en el deploy para evitar 404 durante deploy→commit
    write_token_dir(content_map, old_token)

    with open(NEW_TOKEN_FILE, "w") as fh:
        fh.write(new_token)

    print(f"\nPhase prepare OK — nuevo token: {new_token[:8]}... ({len(content_map)} archivos)")


def commit(sa_dict):
    """Fase 2: actualizar Firestore con el nuevo token tras deploy exitoso."""
    import firebase_admin
    from firebase_admin import credentials, firestore

    if not os.path.exists(NEW_TOKEN_FILE):
        sys.exit(f"ERROR: {NEW_TOKEN_FILE} no encontrado. ¿Corrió --prepare?")

    with open(NEW_TOKEN_FILE) as fh:
        new_token = fh.read().strip()

    if not new_token:
        sys.exit("ERROR: archivo de nuevo token vacío")

    print(f"[1/2] Actualizando Firestore con nuevo token: {new_token[:8]}...")
    cred = credentials.Certificate(sa_dict)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    expires_at = (
        datetime.datetime.utcnow() + datetime.timedelta(hours=TOKEN_TTL_HOURS)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")

    db.collection("dataAccessToken").document("current").set({
        "token": new_token,
        "expires_at": expires_at,
    })

    print(f"[2/2] Firestore actualizado. expires_at: {expires_at}")
    os.remove(NEW_TOKEN_FILE)
    print(f"\nRotación completa — token activo: {new_token[:8]}...")


# ── main ────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Rotar dataAccessToken")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--prepare", action="store_true",
                       help="Descargar archivos y preparar nueva carpeta data/<token>/")
    group.add_argument("--commit", action="store_true",
                       help="Actualizar Firestore tras deploy exitoso")
    args = parser.parse_args()

    sa_dict = load_service_account()
    if args.prepare:
        prepare(sa_dict)
    else:
        commit(sa_dict)


if __name__ == "__main__":
    main()
