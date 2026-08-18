"""
actualizar_config_precios.py
Escribe mostrarPrecioCliente en config/precios de Firestore via REST API.
Usa el token de Firebase CLI almacenado localmente (no requiere login adicional).
Uso: python actualizar_config_precios.py true|false
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

PROJECT_ID = "ferreteria-oviedo"

# Cliente OAuth2 de Firebase CLI (publico, no es secreto)
FIREBASE_CLIENT_ID     = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
FIREBASE_CLIENT_SECRET = "j9iVZfS8yvTdBQ8WGki9intJ"
TOKEN_REFRESH_URL      = "https://oauth2.googleapis.com/token"

FIRESTORE_URL = (
    "https://firestore.googleapis.com/v1/projects/"
    + PROJECT_ID
    + "/databases/(default)/documents/config/precios"
    "?updateMask.fieldPaths=mostrarPrecioCliente"
)

_xdg = os.environ.get("XDG_CONFIG_HOME")
CONFIGSTORE_PATH = (Path(_xdg) if _xdg else Path.home() / ".config") / "configstore" / "firebase-tools.json"


def obtener_token():
    """Lee el access token del configstore de Firebase CLI.
    Si esta por vencer (menos de 5 minutos), lo refresca automaticamente."""
    if not CONFIGSTORE_PATH.exists():
        raise FileNotFoundError(
            f"No se encontro el archivo de credenciales Firebase CLI:\n  {CONFIGSTORE_PATH}\n"
            "  Ejecuta 'firebase login' una vez desde la terminal."
        )

    with open(CONFIGSTORE_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)

    tokens = config.get("tokens", {})
    access_token  = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    expires_at    = tokens.get("expires_at", 0)   # milisegundos

    ahora_ms = time.time() * 1000
    por_vencer = expires_at - ahora_ms < 5 * 60 * 1000   # menos de 5 min

    if access_token and not por_vencer:
        return access_token

    # Token vencido o por vencer — refrescar
    if not refresh_token:
        raise Exception("refresh_token no disponible. Ejecuta 'firebase login' en la terminal.")

    body = urllib.parse.urlencode({
        "client_id":     FIREBASE_CLIENT_ID,
        "client_secret": FIREBASE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type":    "refresh_token",
    }).encode("utf-8")

    req = urllib.request.Request(
        TOKEN_REFRESH_URL,
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    nuevo_token = data["access_token"]
    nuevo_expira = ahora_ms + int(data.get("expires_in", 3600)) * 1000

    # Actualizar configstore con el nuevo token
    tokens["access_token"] = nuevo_token
    tokens["expires_at"]   = nuevo_expira
    config["tokens"] = tokens
    with open(CONFIGSTORE_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    return nuevo_token


def main():
    if len(sys.argv) < 2 or sys.argv[1].lower() not in ("true", "false"):
        print("Uso: python actualizar_config_precios.py true|false")
        sys.exit(1)

    valor = sys.argv[1].lower() == "true"
    estado_txt = "VISIBLE" if valor else "OCULTO"

    try:
        import urllib.parse   # asegurar importacion para el refresh
        token = obtener_token()
    except Exception as e:
        print(f"  WARN - No se pudo obtener token Firebase: {e}")
        print("         El ajuste de precio debe hacerse manualmente en el panel admin.")
        return

    body = json.dumps({
        "fields": {
            "mostrarPrecioCliente": {"booleanValue": valor}
        }
    }).encode("utf-8")

    req = urllib.request.Request(
        FIRESTORE_URL,
        data=body,
        method="PATCH",
        headers={
            "Content-Type":  "application/json",
            "Authorization": f"Bearer {token}",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"  OK - Precio configurado como: {estado_txt}")
            print("  Los paneles cliente usaran esta configuracion al iniciar sesion.")
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="replace")
        print(f"  WARN - Error Firestore: HTTP {e.code}")
        print(f"         {body_err[:200]}")
        print("         El ajuste de precio debe hacerse manualmente en el panel admin.")
    except Exception as e:
        print(f"  WARN - Sin conexion a Firestore: {e}")
        print("         El ajuste de precio debe hacerse manualmente en el panel admin.")


if __name__ == "__main__":
    main()
