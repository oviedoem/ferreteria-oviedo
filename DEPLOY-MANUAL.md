# 🚀 Deploy Manual — Firebase Hosting

## ❌ Problema con Firebase CLI

Firebase CLI requiere autenticación interactiva que no funciona en este entorno. Vamos a aplicar las reglas manualmente.

---

## 📋 Pasos para Aplicar Security Rules

### **Paso 1: Abrir Firebase Console**

Ve a: https://console.firebase.google.com/

### **Paso 2: Seleccionar Proyecto**

1. Selecciona proyecto: **ferreteria-oviedo**
2. En el menú izquierdo: **Firestore Database**
3. Click en **Rules**

### **Paso 3: Aplicar Reglas**

1. Borra TODO el contenido actual
2. Copia y pega el contenido completo de `firestore.rules`
3. Click **Publish**

### **Paso 4: Verificar**

Deberías ver: ✅ **Rules updated successfully**

---

## 🌐 Deploy a Hosting (Opcional)

Si quieres publicar la app online:

### **Opción A: Desde Firebase Console**

1. Ve a Firebase Console → **ferreteria-oviedo**
2. **Hosting** → **Get started**
3. **Upload files manually** → Sube estos archivos:
   - `index.html`
   - `panel-cliente.html`
   - `panel-admin.html`
   - `firebase-config.js`

### **Opción B: Usar GitHub Integration**

1. Conecta tu repo de GitHub
2. Firebase detectará automáticamente `firebase.json`
3. Deploy automático

---

## ✅ Verificación Final

Después de aplicar las reglas:

1. **Prueba login**: Abre `index.html` localmente
2. **Crea cotización**: Verifica que se guarda en Firestore
3. **Revisa Console**: Ve a Firestore Database → Collections

---

## 🔗 URLs de Producción

```
Vendedor: https://ferreteria-oviedo.web.app/
Cliente:  https://ferreteria-oviedo.web.app/panel-cliente
Admin:    https://ferreteria-oviedo.web.app/panel-admin
```

---

## 🆘 Si Firebase CLI funciona en tu máquina local

Ejecuta estos comandos:

```powershell
cd "d:\Alejandro\OneDrive\APP CORRECTA\github\ferreteria-oviedo"
firebase login
firebase deploy --only firestore:rules,hosting
```

---

**Estado**: Security Rules listas para aplicar manualmente
**Proyecto**: ferreteria-oviedo ✅
**Archivos**: Todos preparados ✅
