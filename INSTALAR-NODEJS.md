# 📦 Instalación de Node.js para Firebase CLI

## ❌ Problema

```
node: The term 'node' is not recognized...
npm: The term 'npm' is not recognized...
```

**Solución**: Instalar Node.js (que incluye npm)

---

## 🚀 Paso 1: Descargar Node.js

### Opción A: Installer (Recomendado para Windows)

1. Ve a https://nodejs.org/
2. Descarga la versión **LTS** (Long Term Support)
   - Actual: **v22.x o superior**
   - Haz click en el botón grande verde "Download"

### Opción B: Windows Package Manager

Si tienes **Windows 11** con Winget instalado:

```powershell
winget install OpenJS.NodeJS
```

---

## 📝 Paso 2: Ejecutar el Instalador

1. Abre el archivo `.msi` descargado
2. Click **Next** hasta que vea las opciones
3. **Deja marcadas todas las opciones** (npm, Node.js, etc.)
4. Click **Install**
5. Click **Finish**

**⚠️ IMPORTANTE**: Cierra PowerShell completamente después de instalar

---

## ✅ Paso 3: Verificar Instalación

Abre PowerShell nueva y ejecuta:

```powershell
node --version
npm --version
```

Resultado esperado:
```
v22.x.x
10.x.x (o superior)
```

---

## 🔧 Paso 4: Instalar Firebase CLI

Una vez que `node` y `npm` funcionen:

```powershell
npm install -g firebase-tools
```

Verifica:
```powershell
firebase --version
```

---

## 🚀 Paso 5: Deploy a Firebase

Ahora sí puedes hacer:

```powershell
cd "d:\Alejandro\OneDrive\APP CORRECTA\github\ferreteria-oviedo"
firebase login
firebase deploy
```

---

## 🐛 Troubleshooting

### ❌ "command not found" después de instalar

Cierra y reabre PowerShell completamente (no minimices, cierra todo)

### ❌ "Access Denied" al instalar

Ejecuta PowerShell como **Administrador**:
1. Click derecho en PowerShell
2. "Run as Administrator"
3. Intenta de nuevo

### ❌ npm: permission denied

```powershell
npm config set prefix "C:\Program Files\nodejs"
```

---

## 📋 Checklist Final

- [ ] Node.js instalado (`node --version` funciona)
- [ ] npm instalado (`npm --version` funciona)
- [ ] Firebase CLI instalado (`firebase --version` funciona)
- [ ] Ejecutaste `firebase login`
- [ ] Archivo de proyecto está en: `d:\Alejandro\OneDrive\APP CORRECTA\github\ferreteria-oviedo`

Una vez completado todo, ejecuta:

```powershell
firebase deploy --only firestore:rules,hosting
```

---

**Última actualización**: 24 de abril de 2026
