# Ferretería Oviedo - Sistema de Gestión

Sistema web para la gestión de ventas y administración de Ferretería Oviedo con tres aplicaciones principales:

- **index.html**: App para vendedores (creación de cotizaciones)
- **panel-admin.html**: App para administradores (gestión de usuarios, sesiones, cotizaciones)
- **panel-cliente.html**: App para clientes (consulta de productos)

## 🚀 Configuración

### Opción 1: GitHub + Firebase (Recomendada)

#### 1. Configurar Repositorio GitHub
1. Usa el repositorio existente: https://github.com/oviedoem/ferreteria-oviedo
2. Sube la carpeta `CATALOGO PRODUCTOS/` con los archivos `Datos.csv` y `Datos.json`
3. Las apps ya están preparadas para leer desde GitHub Raw; solo actualiza las URLs si cambias de repo o branch

#### 2. Configurar Firebase
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto
3. Habilita Firestore Database
4. Ve a Configuración del Proyecto > General > Tus apps > Web app
5. Copia la configuración del SDK y pega los valores en `firebase-config.js`.
   - Si quieres, puedes copiar primero `firebase-config-ejemplo.js` como `firebase-config.js` y luego reemplazar los valores.

#### 3. Configurar Reglas de Firestore
Las reglas están preparadas en `firestore.rules`. Para desarrollo, permiten acceso completo. Para producción, configura autenticación.

**Para Desarrollo (actual):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Para Producción (recomendado):**
Usa las reglas seguras en `firestore.rules` (versión completa) y habilita Authentication en Firebase Console.

#### 3.1. Desplegar Reglas
1. Instala Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Desplegar: `firebase deploy --only firestore:rules`

#### 4. Generación automática de Datos.json
Este repositorio incluye una GitHub Action que convierte `CATALOGO PRODUCTOS/Datos.csv` a `CATALOGO PRODUCTOS/Datos.json` automáticamente.

## ✅ Estado Actual del Setup

- **Catálogo actualizado**: `Datos.json` generado correctamente con 9000 productos y precios precisos.
- **Repositorio GitHub**: Cambios subidos y sincronizados en https://github.com/oviedoem/ferreteria-oviedo.
- **Servidor local**: Ejecutándose en http://127.0.0.1:8080 para pruebas.
- **Firebase**: Configurado, pendiente login y deploy de reglas para producción.
- La acción se ejecuta manualmente (`workflow_dispatch`) y también cada día a las 02:00 UTC.
- Si `Datos.json` cambia, la acción lo compromete y sube el cambio automáticamente.
- Las apps de `index.html`, `panel-admin.html` y `panel-cliente.html` cargan `firebase-config.js` para inicializar Firebase.

### Opción 2: GitHub Pages + Netlify Functions

#### 1. Configurar GitHub Pages
1. En tu repositorio GitHub, ve a Settings > Pages
2. Selecciona la rama `main` y carpeta `/`
3. La URL será `https://oviedoem.github.io/ferreteria-oviedo/`

#### 2. Configurar Netlify Functions
1. Crea una cuenta en [Netlify](https://netlify.com)
2. Conecta tu repositorio GitHub
3. Crea funciones en `/netlify/functions/` para la API
4. Actualiza `API_URL` en los archivos con la URL de Netlify

## 📁 Estructura del Catálogo

La carpeta `CATALOGO PRODUCTOS/` contiene:
- `Datos.csv`: Catálogo en formato CSV
- `Datos.json`: Catálogo en formato JSON (fallback más rápido y estable)
- `Datos.xlsx`: Catálogo en formato Excel (opcional)

> El sistema ahora puede cargar el catálogo directamente desde GitHub Raw. El archivo JSON es el mejor formato para una carga más rápida y confiable.

## 🔧 Funcionalidades

### Panel Admin
- ✅ Gestión completa de usuarios
- ✅ Visualización de sesiones activas
- ✅ Historial de cotizaciones
- ✅ Configuración de URLs de datos
- ✅ Diseño y estructura de precios sin cambios

### Panel Vendedor
- ✅ Búsqueda y filtrado de productos
- ✅ Creación de cotizaciones con PDF
- ✅ Cálculo automático de precios con margen
- ✅ Carrito de compras

### Panel Cliente
- ✅ Consulta de catálogo de productos
- ✅ Búsqueda por código, descripción o marca

## 🔄 Migración desde Google Sheets

El sistema ha sido actualizado para funcionar con GitHub Raw en lugar de Google Sheets. Los beneficios incluyen:

- ✅ No dependencia de cuentas Gmail específicas
- ✅ Mejor control de versiones
- ✅ Mayor velocidad de carga
- ✅ Funcionalidad offline mejorada
- ✅ API moderna con Firebase

## 📋 Próximos Pasos

1. Configura tu repositorio GitHub y sube los archivos
2. Configura Firebase o Netlify según la opción elegida
3. Actualiza las URLs en los archivos HTML
4. Prueba todas las funcionalidades
5. Configura autenticación en producción

## 🆘 Soporte

Si encuentras errores o necesitas ayuda con la configuración, revisa:
- Las URLs están correctamente actualizadas
- Firebase está configurado con las reglas correctas
- Los archivos del catálogo están en la ruta correcta en GitHub