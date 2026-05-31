# Aereostar — Dashboard Demo

Demo standalone de panel de control para **Aereostar**, transfer al aeropuerto en Santiago.

> **NOTA:** Todos los leads y clientes son **simulados**. Los datos de clics (2.740) e impresiones (31.700) son datos reales públicos de Google Ads obtenidos manualmente. No conecta a ninguna cuenta real.

---

## Abrir localmente (sin servidor)

```bash
# Opción 1: doble clic directo
Abre index.html en tu navegador (Chrome, Firefox, Safari)

# Opción 2: servidor local simple
cd aereostar-demo
python3 -m http.server 3000
# Luego abre http://localhost:3000
```

## Subir a GitHub Pages (gratis, URL pública en minutos)

```bash
# 1. Crea un repositorio en github.com (público)
# 2. Sube los archivos
git init
git add .
git commit -m "Aereostar dashboard demo"
git remote add origin https://github.com/TU_USUARIO/aereostar-demo.git
git push -u origin main

# 3. En GitHub → Settings → Pages → Branch: main / (root) → Save
# Tu demo estará en: https://TU_USUARIO.github.io/aereostar-demo
```

## Personalizar los datos

Edita **`data.js`** — no requiere conocimientos de programación:

| Variable      | Qué cambia                            |
|---------------|---------------------------------------|
| `KPIS`        | Cifras de Google Ads (clics, CTR…)    |
| `LEADS`       | Lista de leads y su estado            |
| `FUNNEL`      | Valores del embudo de conversión      |
| `RECOMMENDATIONS` | Textos de recomendaciones         |
| `AUDIT`       | Score y checklist de la landing       |

## Estructura del proyecto

```
aereostar-demo/
├── index.html                  Principal — HTML estructural
├── styles.css                  Diseño completo — mobile-first
├── app.js                      Lógica y renderizado dinámico
├── data.js                     Todos los datos (editar aquí)
├── firebase-config.example.js  Plantilla para conexión futura
└── README.md                   Este archivo
```

## Tecnología

- HTML5 + CSS3 + JavaScript vanilla
- Sin frameworks, sin dependencias externas
- Funciona 100% offline desde el sistema de archivos
- Mobile-first, optimizado para presentaciones en smartphone

---

*Demo desarrollado para presentación comercial. Aereostar: +56 9 3779 3527*
