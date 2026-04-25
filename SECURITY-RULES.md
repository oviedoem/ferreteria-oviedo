# 🔒 Configuración de Security Rules — Firebase Firestore

## ✅ Reglas de Seguridad para Producción

Se han generado las security rules en `firestore.rules` con las siguientes políticas:

### 📋 Matriz de Permisos

| Colección | Admin | Vendedor | Cliente | Público |
|-----------|:-----:|:--------:|:-------:|:-------:|
| **users** | ✅ R/W | ❌ | Leer propio | ❌ |
| **cotizaciones** | ✅ R/W | ✅ R/W propias | ✅ R/W propias | ❌ |
| **sessions** | ✅ R | ❌ | Crear propia | ❌ |
| **catalogo** | ✅ R/W | ✅ R | ✅ R | ❌ |

### 🚀 Cómo Aplicar las Reglas

#### **Opción A: Desde Firebase Console (Recomendado)**

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona proyecto: **ferreteria-oviedo**
3. En el menú izq → **Firestore Database** → **Rules**
4. Reemplaza todo el contenido con el contenido de `firestore.rules`
5. Click **Publish**

#### **Opción B: Desde Firebase CLI (Para CI/CD)**

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login en Firebase
firebase login

# Desplegar solo las reglas
firebase deploy --only firestore:rules
```

### 🔐 Características de Seguridad

✅ **Autenticación requerida**: Solo usuarios autenticados pueden acceder  
✅ **Control de roles**: Admin, Vendedor, Cliente con permisos diferentes  
✅ **Aislamiento de datos**: Cada usuario solo ve sus cotizaciones  
✅ **Campos protegidos**: No se pueden cambiar roles/licencias desde cliente  
✅ **Auditoría**: Admin tiene acceso total a logs y sesiones  
✅ **Principio de menor privilegio**: Deny all por defecto  

### 📝 Cambios en firebase-config.js (Opcional)

Actualizar para mejorar inicialización:

```javascript
// Agregar este código después de la inicialización de Firebase
if (db) {
  // Detectar cambios en tiempo real
  db.collection('users').limit(1).onSnapshot(
    () => { /* Firestore conectado */ },
    (err) => { db = null; } // Si hay error, fallback a localStorage
  );
}
```

### ⚠️ Estado Actual

- **Proyecto Firebase**: `ferreteria-oviedo` ✅
- **Credenciales**: Configuradas en firebase-config.js ✅
- **Firestore Collections**: Creadas (users, cotizaciones, sessions) ✅
- **Security Rules**: 🔴 POR APLICAR (están en `firestore.rules`)
- **Modo actual**: Desarrollo (todas las lecturas/escrituras permitidas)

### 🔄 Próximos Pasos

1. **Hoy**: Aplicar security rules en Firebase Console
2. **Testing**: Validar permisos en modo desarrollo
3. **Deploy**: Publicar en Firebase Hosting
4. **Monitoreo**: Revisar logs en Firebase Console

### 🐛 Troubleshooting

**Error: "Permission denied"**
- Verificar que el usuario existe en Firestore
- Revisar el rol asignado (admin/vendedor/cliente)
- Comprobar que la sesión está activa

**Error: "Firebase not available"**
- Verificar conexión a internet
- Revisar credenciales en firebase-config.js
- Comprobar que Firebase SDK está cargado (abrir DevTools → Network)

**Cotizaciones no se sincronizan**
- Revisar que saveCotizacion() se llama después del login
- Comprobar que db !== null en consola (DevTools → Console)
- Verificar permisos en rules (usuario debe tener rol válido)

---

**Última actualización**: 24 de abril de 2026  
**Proyecto**: Ferretería Oviedo - Sistema de Cotizaciones Online
