# Ferretería Oviedo — Sistema de Gestión V23

Sistema web de cotizaciones y administración para Ferretería Oviedo, desplegado en Firebase Hosting con Firestore como base de datos.

## 🌐 URLs de producción

| App | URL | Rol |
|-----|-----|-----|
| Panel Vendedor | https://ferreteria-oviedo.web.app | Vendedores |
| Panel Admin | https://ferreteria-oviedo.web.app/panel-admin | Administrador |
| Panel Cliente | https://ferreteria-oviedo.web.app/panel-cliente | Clientes |

## 📁 Estructura del repositorio

```
ferreteria-oviedo/
├── index.html              # App Vendedor
├── panel-admin.html        # App Admin
├── panel-cliente.html      # App Cliente
├── firebase-config.js      # Config Firebase (inline en los HTML)
├── firebase.json           # Configuración hosting + rewrites
├── firestore.rules         # Reglas de seguridad Firestore
├── .firebaserc             # ID del proyecto Firebase
├── .gitignore
├── MANUAL_SISTEMA.md       # Manual completo de uso y usuarios
├── CATALOGO PRODUCTOS/
│   ├── Datos.csv           # Catálogo fuente (editar este)
│   ├── Datos.json          # Generado automáticamente por GitHub Action
│   └── scripts/
│       ├── sql_a_csv.py         # Convierte SQL → CSV
│       ├── productos.sql        # Fuente SQL del catálogo
│       └── ACTUALIZAR_CATALOGO.bat  # Script Windows para actualizar
└── .github/workflows/
    └── generate-datos-json.yml  # Action: CSV → JSON automático
```

## 🚀 Deploy

```bash
firebase login
firebase deploy
```

Para solo reglas de Firestore:
```bash
firebase deploy --only firestore:rules
```

## 📦 Catálogo de productos

El catálogo se carga desde **GitHub Raw** (`raw.githubusercontent.com`). El flujo es:

1. Editar `CATALOGO PRODUCTOS/Datos.csv`
2. Hacer `git push` — la GitHub Action genera `Datos.json` automáticamente
3. Las apps lo leen en tiempo real desde GitHub Raw

Para conversión manual desde SQL:
```bash
cd "CATALOGO PRODUCTOS/scripts"
python sql_a_csv.py
```

## 🔧 Funcionalidades

### Panel Vendedor (`index.html`)
- Login con credenciales Firebase
- Búsqueda y filtrado de productos (9000+ ítems)
- Precios con margen y precio socio
- Generación de cotizaciones en PDF
- Historial de cotizaciones sincronizado

### Panel Admin (`panel-admin.html`)
- Gestión completa de usuarios (crear, editar, eliminar)
- Monitor de sesiones activas en tiempo real
- Notificaciones con sonido al iniciar sesión vendedores/clientes
- Historial de cotizaciones
- Tutoriales integrados

### Panel Cliente (`panel-cliente.html`)
- Consulta de catálogo de productos
- Búsqueda por código, descripción o marca
- Generación de cotizaciones

## ⚙️ Configuración Firebase

El proyecto usa `ferreteria-oviedo` en Firebase. La configuración está inline en los archivos HTML (bloque `FIREBASE CONFIG V16 INLINE`).

Para ver usuarios, sesiones y cotizaciones: [Firebase Console](https://console.firebase.google.com/project/ferreteria-oviedo)

## 📖 Manual completo

Ver `MANUAL_SISTEMA.md` para usuarios del sistema, contraseñas, guías de uso y descripción detallada de funcionalidades.
