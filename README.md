# Ferreteria Oviedo — Sistema Web V33.5

Sistema de catalogo y gestion interna publicado en Firebase Hosting.
Tres paneles independientes con autenticacion Firebase Auth.

## URLs

| Panel | URL |
|-------|-----|
| Cliente | https://ferreteria-oviedo.web.app/panel-cliente |
| Vendedor | https://ferreteria-oviedo.web.app/vendedor |
| Admin | https://ferreteria-oviedo.web.app/panel-admin |

## Archivos principales

- panel-admin.html — Panel administrador (analisis ventas, inventario, rankings)
- panel-cliente.html — Catalogo publico con cotizaciones PDF
- index.html — Panel vendedor
- firebase.json — Configuracion Firebase Hosting
- firestore.rules — Reglas de seguridad Firestore

## Tecnologias

- Firebase Hosting + Auth + Firestore
- JavaScript vanilla
- Python (scripts ERP, no incluidos)

## Nota de seguridad

Credenciales ERP, datos de ventas y archivos Excel excluidos del repo.
