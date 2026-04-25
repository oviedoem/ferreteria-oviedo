# 🚀 Deploy Completo — Ferretería Oviedo

## ✅ PASO 1: Aplicar Security Rules (5 minutos)

### 📋 Instrucciones para Firebase Console

1. **Abrir Firebase Console**
   - Ve a: https://console.firebase.google.com/
   - Selecciona proyecto: `ferreteria-oviedo`

2. **Ir a Firestore Database**
   - En el menú izquierdo: **Firestore Database**
   - Click en **Rules**

3. **Aplicar las reglas**
   - **BORRA TODO** el contenido actual
   - **COPIA Y PEGA** el contenido completo de `firestore.rules` (está abierto en tu editor)
   - Click **Publish**

4. **Verificar**
   - Deberías ver: ✅ **Rules updated successfully**

---

## 🌐 PASO 2: Deploy a Hosting (10 minutos)

### 📋 Opción A: Deploy Automático (Recomendado)

Si tienes Firebase CLI funcionando en tu máquina local:

```powershell
cd "d:\Alejandro\OneDrive\APP CORRECTA\github\ferreteria-oviedo"
firebase login
firebase deploy --only hosting
```

### 📋 Opción B: Deploy Manual desde Firebase Console

1. **En Firebase Console** → Proyecto `ferreteria-oviedo`
2. **Hosting** → **Get started**
3. **Upload files manually**
4. **Sube estos archivos:**
   - `index.html`
   - `panel-cliente.html`
   - `panel-admin.html`
   - `firebase-config.js`

5. **Configurar rutas:**
   - Para `/panel-cliente` → redirigir a `panel-cliente.html`
   - Para `/panel-admin` → redirigir a `panel-admin.html`
   - Para `/` → usar `index.html`

---

## 🧪 PASO 3: Testing (5 minutos)

### 📋 Probar las Apps

Después del deploy, abre estas URLs:

```
Vendedor: https://ferreteria-oviedo.web.app/
Cliente:  https://ferreteria-oviedo.web.app/panel-cliente
Admin:    https://ferreteria-oviedo.web.app/panel-admin
```

### 📋 Tests a Realizar

**Para cada app:**
1. ✅ **Login funciona** (carga usuarios de Firebase)
2. ✅ **Crear cotización** (se guarda en Firestore)
3. ✅ **Generar PDF** (descarga funciona)
4. ✅ **Sincronización** (datos aparecen en Firebase Console)

**Verificar en Firebase Console:**
- **Firestore Database** → **Collections**
- Deberías ver: `users`, `cotizaciones`, `sessions`

---

## 🔧 Troubleshooting

### ❌ "Permission denied" al crear cotización
- Las security rules no se aplicaron correctamente
- Revisa que estén publicadas en Firebase Console

### ❌ "404 Not Found" en URLs
- El hosting no se configuró correctamente
- Revisa las redirecciones en Firebase Hosting

### ❌ Datos no se sincronizan
- Abre DevTools (F12) → Console
- Busca errores de Firebase
- Verifica que `firebase-config.js` esté cargado

---

## 📊 Checklist Final

- [ ] Security rules aplicadas en Firebase Console
- [ ] Hosting configurado (automático o manual)
- [ ] URLs funcionando: https://ferreteria-oviedo.web.app/
- [ ] Login funciona en las 3 apps
- [ ] Cotizaciones se guardan en Firestore
- [ ] PDFs se generan correctamente

---

## 🎉 ¡Proyecto Completo!

Una vez completados estos pasos:

✅ **Sistema de cotizaciones online**  
✅ **Sincronización multi-dispositivo**  
✅ **Role-based access control**  
✅ **PDF generation**  
✅ **Firebase hosting**  
✅ **Security rules**  

**URLs de producción:**
- Vendedores: https://ferreteria-oviedo.web.app/
- Clientes: https://ferreteria-oviedo.web.app/panel-cliente
- Admin: https://ferreteria-oviedo.web.app/panel-admin

---

**Última actualización**: 24 de abril de 2026
**Proyecto**: Ferretería Oviedo - Sistema de Cotizaciones Online ✅ COMPLETADO