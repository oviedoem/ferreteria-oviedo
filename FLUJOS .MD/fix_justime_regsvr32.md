---
name: Fix RegSvr32 Justime — justccentral.dll no encontrado
description: Error RegSvr32 al abrir Justime ERP. JustCritico.exe busca DLLs en ruta sin (x86). Solución: junction Program Files\Justime → Program Files (x86)\Justime
type: fix
date: 2026-05-16
originSessionId: da151d24-bed9-466f-bdbe-ed49903985ab
---
## Síntoma

Al abrir el ERP Justime aparecen varios popups de RegSvr32:

> No se pudo cargar el módulo `C:\Archivos de programa\Justime\Justime\justccentral.dll`  
> No se puede encontrar el módulo especificado.

Aparece uno por cada DLL que JustCritico intenta registrar (múltiples mensajes).

---

## Causa raíz

`JustCritico.exe` es el módulo de Justime que registra todos los DLLs COM al arrancar.  
Fue compilado en VB6 con la ruta hardcodeada `C:\Archivos de programa\Justime\Justime\`.

En Windows 10 la cadena de rutas es:
- `C:\Archivos de programa` → junction a `C:\Program Files` ✅ (existe)
- `C:\Program Files\Justime` → **NO existe** ❌

Justime está instalado en `C:\Program Files (x86)\Justime\` (32-bit), no en el `Program Files` de 64-bit.  
El DLL existe en `C:\Program Files (x86)\Justime\Justime\justccentral.dll` pero JustCritico lo busca sin el `(x86)`.

---

## Solución aplicada

Crear junction de directorio (una sola vez, requiere admin):

```
C:\Program Files\Justime  →  C:\Program Files (x86)\Justime
```

Comando ejecutado (con elevación UAC desde Claude):
```cmd
mklink /J "C:\Program Files\Justime" "C:\Program Files (x86)\Justime"
```

Resultado verificado:
```
Test-Path 'C:\Program Files\Justime\Justime\justccentral.dll'  → True
```

La cadena completa queda:
```
C:\Archivos de programa\Justime\Justime\justccentral.dll
        ↓ (junction existente)
C:\Program Files\Justime\Justime\justccentral.dll
        ↓ (junction nueva)
C:\Program Files (x86)\Justime\Justime\justccentral.dll  ← archivo real
```

---

## Si el error vuelve a aparecer

Verificar que la junction sigue activa:
```powershell
(Get-Item 'C:\Program Files\Justime').LinkType   # debe decir "Junction"
Test-Path 'C:\Program Files\Justime\Justime\justccentral.dll'  # debe ser True
```

Si la junction se perdió (ej. tras reinstalar Justime), ejecutar de nuevo como admin:
```cmd
mklink /J "C:\Program Files\Justime" "C:\Program Files (x86)\Justime"
```

Script alternativo: `D:\ferreteria-oviedo\FIX_JUSTIME_DLL.bat` (ejecutar como admin).

---

## Notas

- No se tocó ningún archivo del ERP ni del registro de Windows.
- El flujo de Playwright y pywin32 que usan los scripts Python no se ve afectado.
- La junction es transparente para Justime y para Windows.
