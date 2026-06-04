# RECUPERACIÓN CLAUDE CODE — Guía completa
## Fecha de creación: 2026-06-04
## Versión validada: Claude Code desktop v1.11187.1 / CLI 2.1.161
## Autor: Alejandro G. — Ferretería Oviedo

---

## QUÉ SE HIZO Y POR QUÉ

### Problema original
FortiClient Zero Trust (seguridad corporativa) bloquea el disco E: (TOSHIBA USB) al inicio.
Cuando E: está bloqueado, Claude Code no puede leer su memoria ni configuración si éstas viven en E:.

### Arquitectura implementada
```
Disk 0 — NVMe interno (NUNCA bloqueado por FortiClient):
  C:  121 GB  Windows + ejecutable Claude

Disk 1 — TOSHIBA USB (puede bloquearse por FortiClient):
  W:  128 GB  ← configuración Claude + herramientas de emergencia
  E: 1735 GB  ← proyecto ferreteria-oviedo
```

### Solución aplicada
Se creó una JUNCTION (enlace de directorio de Windows) en C: que apunta a W:.

```
C:\Users\Ferreteria Oviedo\.claude  ──junction──►  W:\claude-config\
```

**Qué significa:** Cuando Claude busca su configuración en `C:\..\.claude\`,
Windows redirige transparentemente a `W:\claude-config\`. Los datos reales viven en W:.

### Validación superada
- ✅ Escritura bidireccional confirmada (archivos escritos en C: aparecen en W:)
- ✅ Update de Claude Code v1.11187.1 NO rompió la junction
- ✅ 454 archivos en W:\claude-config\

---

## ESTADO ACTUAL DEL SISTEMA

| Componente | Ubicación física | Ruta de acceso |
|---|---|---|
| Claude memoria/skills/config | `W:\claude-config\` | Via junction `C:\Users\Ferreteria Oviedo\.claude` |
| Claude ejecutable (Electron) | `C:\Users\Ferreteria Oviedo\AppData\Roaming\Claude\` | Directo |
| Claude CLI | `C:\Users\Ferreteria Oviedo\AppData\Roaming\Claude\claude-code\2.1.161\` | Directo |
| Proyecto | `E:\ferreteria-oviedo\` | Directo |
| Git config | `E:\config\gitconfig` | Via env var `GIT_CONFIG_GLOBAL` |
| Git tokens (DPAPI cifrado) | `E:\config\gcm-store` | Transparente via GCM |
| Herramientas emergencia | `W:\herramientas\seguridad\` | Directo |
| Docs backup .md | `W:\proyecto-docs\` | Copia de emergencia |
| **BACKUP .claude original** | `C:\Users\Ferreteria Oviedo\.claude-bak-20260604\` | Solo rollback — NO borrar aún |

---

## DIAGNÓSTICO — Verificar que todo funciona

Abrir PowerShell y ejecutar estos comandos uno a uno:

### Verificación 1: Junction intacta
```powershell
$j = Get-Item "C:\Users\Ferreteria Oviedo\.claude"
Write-Host "Tipo: $($j.LinkType)"
Write-Host "Apunta a: $($j.Target)"
```
**Resultado esperado:**
```
Tipo: Junction
Apunta a: W:\claude-config
```
**Si dice otra cosa:** ir a ROLLBACK más abajo.

### Verificación 2: W: contiene los archivos
```powershell
Test-Path "W:\claude-config\settings.json"
Test-Path "W:\claude-config\projects\E--ferreteria-oviedo\memory\MEMORY.md"
(Get-ChildItem "W:\claude-config" -Recurse -File).Count
```
**Resultado esperado:** True / True / ~454 (puede crecer)

### Verificación 3: Git config apunta a E:
```powershell
[System.Environment]::GetEnvironmentVariable("GIT_CONFIG_GLOBAL","User")
```
**Resultado esperado:** `E:\config\gitconfig`

### Verificación 4: Backup de seguridad presente
```powershell
Test-Path "C:\Users\Ferreteria Oviedo\.claude-bak-20260604"
```
**Resultado esperado:** `True`

---

## PRUEBA REAL — Confirmar que Claude recuerda el proyecto

1. Cerrar Claude Code completamente
2. Abrir Claude Code nuevamente
3. Preguntar: "¿recuerdas el proyecto ferreteria-oviedo?"
4. Claude debe mencionar: FortiClient, disco E:, junction W:, AGENTS.md, o detalles del proyecto

**Si Claude recuerda → migración exitosa ✅**
**Si Claude no recuerda nada → ver ROLLBACK**

---

## ROLLBACK COMPLETO — Si la junction falla

### Caso A: Junction rota o Claude no lee memoria

```powershell
# Paso 1: Eliminar junction rota (cmd, no PowerShell Remove-Item)
cmd /c "rd ""C:\Users\Ferreteria Oviedo\.claude"""

# Paso 2: Verificar que se eliminó
if (-not (Test-Path "C:\Users\Ferreteria Oviedo\.claude")) {
    Write-Host "Junction eliminada OK"
}

# Paso 3: Restaurar backup original de C:
Rename-Item "C:\Users\Ferreteria Oviedo\.claude-bak-20260604" `
            "C:\Users\Ferreteria Oviedo\.claude"

# Paso 4: Verificar restauración
(Get-ChildItem "C:\Users\Ferreteria Oviedo\.claude" -Recurse -File).Count
# Debe mostrar ~453 archivos
```

**Resultado:** Claude vuelve a funcionar con configuración en C:, exactamente igual que antes del 2026-06-04.

---

### Caso B: W: no accesible (FortiClient bloqueó el USB)

Si W: está bloqueado y Claude no puede leer su config:

1. Abrir Explorador de Windows
2. Clic derecho en el disco USB → **Expulsar**
3. Aceptar el error si aparece ("el dispositivo está en uso")
4. Esperar 10-15 segundos → Windows remonta el disco
5. Verificar que W: y E: vuelven en el Explorador
6. Abrir Claude normalmente

**Script de remontado disponible en:**
```
W:\herramientas\seguridad\REMONTAR_DISCO_E.ps1
W:\herramientas\seguridad\EXPULSAR_DISCO_E.ps1
```

---

### Caso C: Todo falla — W: y E: bloqueados, Claude sin memoria

1. Recuperar disco: Explorador → clic derecho USB → Expulsar
2. Esperar 10-15 seg
3. Abrir Claude — aunque no recuerde, funciona
4. Darle a Claude el enlace de AGENTS.md en GitHub:
   `https://github.com/oviedoem/ferreteria-oviedo/blob/main/AGENTS.md`
5. Claude puede retomar el trabajo desde GitHub aunque no tenga memoria local

---

## RECREAR LA JUNCTION DESDE CERO

Si necesitas rehacer la junction en un PC nuevo o tras reinstalar Windows:

```powershell
# Prerequisito: W:\claude-config\ debe existir con los archivos
# Si no existe, copiar desde backup o restaurar desde la última sesión de Claude

# Paso 1: Si .claude ya existe como directorio real, copiarlo a W: primero
robocopy "C:\Users\<USUARIO>\.claude" "W:\claude-config" /E /R:1 /W:1

# Paso 2: Renombrar .claude original como backup
Rename-Item "C:\Users\<USUARIO>\.claude" `
            "C:\Users\<USUARIO>\.claude-bak-$(Get-Date -Format 'yyyyMMdd')"

# Paso 3: Crear la junction
cmd /c "mklink /J ""C:\Users\<USUARIO>\.claude"" ""W:\claude-config"""

# Paso 4: Verificar
$j = Get-Item "C:\Users\<USUARIO>\.claude"
Write-Host "Tipo: $($j.LinkType) → $($j.Target)"
# Debe decir: Tipo: Junction → W:\claude-config
```

---

## VARIABLES DE ENTORNO (HKCU — si se pierden)

```powershell
[System.Environment]::SetEnvironmentVariable("GIT_CONFIG_GLOBAL",   "E:\config\gitconfig",  "User")
[System.Environment]::SetEnvironmentVariable("NPM_CONFIG_PREFIX",   "E:\npm-global",         "User")
[System.Environment]::SetEnvironmentVariable("NPM_CONFIG_CACHE",    "E:\npm-cache",          "User")
[System.Environment]::SetEnvironmentVariable("NPM_CONFIG_USERCONFIG","E:\config\.npmrc",     "User")
[System.Environment]::SetEnvironmentVariable("XDG_CONFIG_HOME",     "E:\config",             "User")
[System.Environment]::SetEnvironmentVariable("GH_CONFIG_DIR",       "E:\config\gh",          "User")
[System.Environment]::SetEnvironmentVariable("PIP_CACHE_DIR",       "E:\pip-cache",          "User")
```

---

## HERRAMIENTAS DE EMERGENCIA EN W:

```
W:\herramientas\seguridad\
  REMONTAR_DISCO_E.ps1          Remonta E: sin expulsar (disable/enable PnP USB)
  EXPULSAR_DISCO_E.ps1          Expulsión segura cerrando procesos
  VERIFICAR_ANTES_DE_TRABAJAR.bat  Monitoreo de salud del disco
  ABRIR_CLAUDE.bat              Abre Claude verificando E: primero
  USBDeview\USBDeview.exe       Gestión USB avanzada
```

---

## GITHUB COMO RESPALDO FINAL

Si no puedes acceder a W: ni a E:, el proyecto está en GitHub:
- AGENTS.md: `https://github.com/oviedoem/ferreteria-oviedo/blob/main/AGENTS.md`
- Panel admin: `https://github.com/oviedoem/ferreteria-oviedo/blob/main/panel-admin.html`

Compartir AGENTS.md con Claude en sesión nueva es suficiente para retomar el trabajo completo.

---

*Documento creado: 2026-06-04*
*Update Claude Code v1.11187.1 superado sin romper junction: ✅*
*Ubicaciones: W:\RECUPERACION_CLAUDE.md y E:\ferreteria-oviedo\RECUPERACION_CLAUDE.md*
