# 🚀 Guía de Deploy — Firebase Hosting

## Estado Actual ✅

```
✅ firebase-config.js     - Credenciales configuradas
✅ firestore.rules        - Security rules listas
✅ firebase.json          - Configuración de hosting
✅ .firebaserc            - ID del proyecto
✅ index.html             - App Vendedor
✅ panel-cliente.html     - App Cliente
✅ panel-admin.html       - App Admin
```

## 🎯 Objetivo Final

Publicar en: **https://ferreteria-oviedo.web.app/**

---

## 📋 Pasos para Deploy

### **Paso 1: Instalar Firebase CLI** (Una sola vez)

Abre PowerShell y ejecuta:

```powershell
npm install -g firebase-tools
```

Verifica instalación:
```powershell
firebase --version
```

### **Paso 2: Aplicar Security Rules**

**Opción A: Desde Firebase Console (Recomendado)**

1. Ve a https://console.firebase.google.com/
2. Selecciona proyecto: **ferreteria-oviedo**
3. Menú izq → **Firestore Database** → **Rules**
4. Abre `firestore.rules` en VS Code (desde tu proyecto)
5. Copia TODO el contenido (Ctrl+A → Ctrl+C)
6. Pega en Firebase Console
7. Click **Publish**

**Opción B: Desde Terminal**

```powershell
cd "d:\Alejandro\OneDrive\APP CORRECTA\github\ferreteria-oviedo"
firebase login
firebase deploy --only firestore:rules
```

### **Paso 3: Verificar Archivos**

Asegúrate que están en la carpeta raíz del proyecto:

```
✅ index.html
✅ panel-cliente.html  
✅ panel-admin.html
✅ firebase-config.js
✅ firebase.json
✅ .firebaserc
```

### **Paso 4: Deploy a Hosting**

Abre PowerShell en la carpeta del proyecto:

```powershell
cd "d:\Alejandro\OneDrive\APP CORRECTA\github\ferreteria-oviedo"
firebase login
firebase deploy --only hosting
```

**Espera a que termine...**

Resultado esperado:
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/ferreteria-oviedo/overview
Hosting URL: https://ferreteria-oviedo.web.app
```

---

## 🔗 URLs Después del Deploy

| App | URL |
|-----|-----|
| **Vendedor** | https://ferreteria-oviedo.web.app/ |
| **Cliente** | https://ferreteria-oviedo.web.app/panel-cliente |
| **Admin** | https://ferreteria-oviedo.web.app/panel-admin |

### Compartir links:
- **Vendedores**: https://ferreteria-oviedo.web.app/
- **Clientes**: https://ferreteria-oviedo.web.app/panel-cliente
- **Admin**: https://ferreteria-oviedo.web.app/panel-admin

---

## ✅ Testing Post-Deploy

Después de publicar, prueba:

1. **Login**: Usa credenciales de Firebase
2. **Crear cotización**: Genera PDF
3. **Sincronización**: Verifica que se guardan en Firestore (Firebase Console → Firestore Database)
4. **Offline**: Desactiva internet en DevTools → verifica localStorage

---

## 🔄 Re-deploy (Si Haces Cambios)

Después de editar cualquier archivo:

```powershell
firebase deploy --only hosting
```

**Nota**: El caché de navegador limpia automáticamente en 1 hora. Para forzar actualización: **Ctrl+Shift+Delete** (borrar caché del navegador).

---

## 🐛 Troubleshooting

### ❌ Error: "firebase command not found"
```powershell
npm install -g firebase-tools
```

### ❌ Error: "You don't have permission"
```powershell
firebase login --reauth
```

### ❌ "Security rules rejected"
- Verifica que `firestore.rules` está aplicado en Firebase Console
- Espera 2 minutos después de publicar rules

### ❌ "404 Not Found en URLs"
- Verifica que `firebase.json` existe
- Revisa la configuración de `rewrites`
- Re-ejecuta: `firebase deploy --only hosting`

### ❌ "Cambios no se ven en producción"
- Abre DevTools (F12)
- **Application** → **Storage** → **Clear site data**
- Recarga (Ctrl+F5)

---

## 📊 Monitoreo en Producción

### Firestore Console
https://console.firebase.google.com/project/ferreteria-oviedo/firestore/data

Ver:
- ✅ Usuarios creados
- ✅ Cotizaciones guardadas
- ✅ Sesiones activas

### Firebase Analytics
Dashboard automático de:
- Sesiones diarias
- Dispositivos
- Errores

### Storage
Para futuro: imágenes de productos, archivos

---

## 🔐 Seguridad en Producción

✅ **Ya configurado:**
- Security rules activadas
- Autenticación requerida
- Control de roles
- Campos protegidos

⚠️ **Próximos pasos:**
1. Configurar dominios autorizados en Firebase Console
2. Habilitar reCAPTCHA en login (opcional)
3. Backup automático de Firestore

---

## 📝 Comandos Útiles

```powershell
# Ver estado de deployment
firebase status

# Logs de errors
firebase functions:log

# Usar un proyecto diferente
firebase use otro-proyecto

# Deploy solo reglas (sin hosting)
firebase deploy --only firestore:rules

# Deploy solo hosting (sin reglas)
firebase deploy --only hosting

# Deploy de todo
firebase deploy
```

---

## 🎉 ¡Listo!

Una vez completados estos pasos:

1. ✅ Tu app estará en: **https://ferreteria-oviedo.web.app/**
2. ✅ Datos sincronizados en Firestore en tiempo real
3. ✅ Seguridad configurada con roles
4. ✅ Disponible 24/7 desde cualquier dispositivo
5. ✅ Certificado SSL automático (HTTPS)

**Soporte**: Revisar Firebase Console para logs y errores.

---

**Última actualización**: 24 de abril de 2026
