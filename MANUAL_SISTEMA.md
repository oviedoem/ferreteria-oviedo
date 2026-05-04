# 📖 Manual del Sistema — Ferretería Oviedo V22

**GitHub:** https://github.com/oviedoem/ferreteria-oviedo  
**Fecha:** Mayo 2026

---

## 📱 URLs de acceso

| App | URL | Quién la usa |
|-----|-----|-------------|
| Panel Vendedor | https://ferreteria-oviedo.web.app | Vendedores El Manzano |
| Panel Admin | https://ferreteria-oviedo.web.app/panel-admin | Administrador |
| Panel Cliente | https://ferreteria-oviedo.web.app/panel-cliente | Clientes finales |

---

## 👥 Usuarios del sistema

### Panel Vendedor
| Usuario | Contraseña | Nombre |
|---------|-----------|--------|
| vendedor1 | vend2025 | Ricardo Vidal |
| vendedor2 | vend2025 | Rafaela Flores |
| vendedor3 | vend2025 | Gregorio Reyes |
| vendedor4 | vend2025 | Jaime Subiabre |
| admin | oviedo2025admin | Administrador |

### Panel Cliente
| Usuario | Contraseña | Tipo |
|---------|-----------|------|
| cliente1 | cli2025 | Cliente |
| cliente2 | cli2025 | Cliente |
| demo | demo123 | Demo |

### Panel Admin
| Usuario | Contraseña |
|---------|-----------|
| admin | oviedo2025admin |

> 💡 Para agregar más usuarios: Panel Admin → pestaña **Usuarios** → "Agregar usuario"

---

## 🔔 Sistema de notificaciones (NUEVO V22)

### ¿Qué hace?
El Panel Admin recibe un **aviso con sonido** cada vez que:
- Un **vendedor** inicia sesión en la app de vendedores
- Un **cliente** inicia sesión en la app de clientes  
- Se genera una nueva **cotización PDF**

### ¿Cómo funciona?
1. Abre el **Panel Admin** en tu computador o celular
2. Las notificaciones llegan automáticamente en tiempo real via Firebase
3. Aparece un **popup** en la esquina superior derecha con el nombre y la app
4. Suena un **tono diferente** para vendedores (agudo) y clientes (medio)
5. La **campana 🔔** en la barra superior muestra el contador de no leídas
6. También hay una pestaña **"🔔 Notif."** en el menú para ver el historial

### Configuración
- **Botón 🔊/🔇**: activa o desactiva el sonido
- **Pestaña Notificaciones → Configuración**: elige qué tipos de eventos notificar
- Las configuraciones se guardan automáticamente

### Importante
> El Panel Admin debe estar **abierto en el navegador** para recibir notificaciones.
> No es necesario que esté en primer plano, pero sí abierto en una pestaña.

---

## 🏷️ Actualizar el catálogo de precios

El catálogo se almacena en `CATALOGO PRODUCTOS/Datos.csv` en GitHub.  
Las apps lo cargan automáticamente cada vez que un usuario entra.

### Método recomendado: SQL → CSV

**Archivos necesarios** (en `CATALOGO PRODUCTOS/scripts/`):
- `productos.sql` — editar aquí los precios
- `sql_a_csv.py` — script conversor (Python)
- `ACTUALIZAR_CATALOGO.bat` — ejecutable Windows (doble clic)

### Paso a paso para actualizar precios

#### Opción A — Doble clic (Windows, más fácil)
1. Abrir la carpeta `CATALOGO PRODUCTOS/scripts/`
2. Editar `productos.sql` con Bloc de Notas o VSCode
3. Cambiar los precios que necesites
4. Doble clic en `ACTUALIZAR_CATALOGO.bat`
5. Elegir opción `3` para actualizar y subir automáticamente a GitHub

#### Opción B — Línea de comandos
```bash
# Navegar a la carpeta
cd "CATALOGO PRODUCTOS/scripts"

# Ver cambios sin modificar nada
python sql_a_csv.py --preview

# Actualizar solo el CSV
python sql_a_csv.py

# Actualizar CSV y publicar en GitHub (las apps se actualizan en ~1 min)
python sql_a_csv.py --subir
```

#### Opción C — Editar el CSV directamente
1. Abrir `CATALOGO PRODUCTOS/Datos.csv` con Excel
2. Modificar los valores en las columnas `PrecioIVA` y `SocioIVA`
3. Guardar como CSV (sin cambiar el nombre)
4. Subir a GitHub:
```bash
git add "CATALOGO PRODUCTOS/Datos.csv"
git commit -m "Actualizar precios mayo 2026"
git push origin main
```

### Formato del archivo SQL

```sql
-- Formato simple (recomendado):
INSERT INTO productos VALUES ('CODIGO', 'Descripcion del producto', 'Marca', PRECIO);

-- Ejemplo:
INSERT INTO productos VALUES ('H001', 'Martillo de Galpon 16oz', 'Tramontina', 1500);

-- Con subfamilia y precio socio:
INSERT INTO productos (codigo, descripcion, marca, subfamilia, precio, precio_socio)
VALUES ('H001', 'Martillo 16oz', 'Tramontina', 'Herramientas', 1500, 1350);
```

**Reglas:**
- Los precios van **con IVA incluido**
- Si no se indica `precio_socio`, se calcula automáticamente al **90% del precio**
- El `CODIGO` debe ser único (H001, C001, E001, etc.)
- Los comentarios empiezan con `--`

### Estructura del CSV

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| `Codigo` | Identificador único | H001 |
| `Descripcion` | Nombre del producto | Martillo de Galpon 16oz |
| `Marca` | Marca del producto | Tramontina |
| `SubFamilia` | Categoría | Herramientas |
| `PrecioIVA` | Precio público con IVA | 1500 |
| `SocioIVA` | Precio especial/socio | 1350 |

---

## 🔗 Conexión Firebase

**Proyecto:** `ferreteria-oviedo`  
**Console:** https://console.firebase.google.com/project/ferreteria-oviedo

### Colecciones Firestore activas

| Colección | Qué guarda |
|-----------|-----------|
| `users` | Usuarios (vendedores y clientes) sincronizados entre apps |
| `cotizaciones` | Todas las cotizaciones generadas |
| `sesiones_activas` | Quién está conectado ahora (tiempo real) |
| `promos` | Promociones creadas desde admin |
| `config/urls` | URLs del catálogo configuradas desde admin |

---

## 🔧 Gestión desde Panel Admin

### Pestaña Usuarios
- **Agregar usuario cliente**: nombre, usuario, contraseña, duración licencia
- **Agregar usuario vendedor**: nombre, usuario, contraseña, rol (vendedor/admin)
- **Bloquear/desbloquear**: el usuario no puede ingresar mientras esté bloqueado
- **Eliminar**: borra el usuario permanentemente

### Pestaña Cotizaciones
- Ver todas las cotizaciones con fecha, usuario, app y total
- Filtrar por usuario o app de origen
- Ver detalle completo de productos de cada cotización
- Descargar PDF de cualquier cotización
- Ver Top 10/20/50/100 productos más cotizados

### Pestaña Precios
- Ver el catálogo completo con precios
- Verificar conexión al catálogo de GitHub
- Buscar productos

### Pestaña URL / Conexión
- Actualizar la URL del catálogo CSV si cambia la fuente
- Probar la conexión

### Pestaña Promociones
- Crear promociones con título, descripción y precio
- Las promociones aparecen en la app cliente

### Pestaña 🔔 Notificaciones
- Ver historial de ingresos y cotizaciones
- Configurar qué eventos generan notificaciones
- Activar/desactivar sonido

---

## 🚀 Publicar cambios en GitHub Pages

Cuando modifiques cualquier archivo:

```bash
# Desde la carpeta raíz del proyecto
git add .
git commit -m "Descripción del cambio"
git push origin main
```

GitHub Pages se actualiza en **~1 minuto**.  
Refrescar con **Ctrl+F5** en el navegador para ver los cambios.

---

## 🛑 Problemas frecuentes

| Problema | Solución |
|---------|---------|
| "Usuario o contraseña incorrectos" | Verificar que no haya espacios. Si el problema persiste, verificar en Panel Admin → Usuarios que el usuario esté activo y no bloqueado |
| El catálogo no carga | Verificar que el archivo `Datos.csv` esté en GitHub. Ir a Panel Admin → URL / Conexión → Probar conexión |
| Las notificaciones no llegan | El Panel Admin debe estar abierto en una pestaña del navegador. Verificar que Firebase esté conectado |
| No suena el aviso | El navegador puede bloquear audio hasta que el usuario interactúe. Hacer clic en cualquier parte de la página de admin |
| Los precios no se actualizan | Esperar 1 minuto y refrescar con Ctrl+F5. Si persiste, verificar que el git push fue exitoso |
| Error al ejecutar el .bat | Verificar que Python esté instalado: abrir CMD y escribir `python --version` |

---

*Manual V22 — Ferretería Oviedo El Manzano*
