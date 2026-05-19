---
name: Panel Compras — Estado v3 (2026-05-11)
description: XLSM fijo, ABC80, exclusiones DD/Descontinuado/Outlet, Sin Venta, Sugerido, Temporada
type: project
originSessionId: 2645a767-1c7a-4923-ad11-fbefc9351c71
---
# Panel Compras — v3

**XLSM fijo:** `D:\ferreteria-oviedo\PANEL ADMIN COMPRAS\SOLICITUDES SANTIAGO_TLC2.XLSM`
**Firebase:** `https://oviedo-compras-admin.web.app`
**Clave:** `compras2026`
**Publicar:** `PUBLICAR_COMPRAS.bat`

## Hojas usadas
- RESUMEN: stocks, venta 2026, tipo A/B/C/D
- TIPO: ventaAnioMovil (rolling 12m), stockVal, costoUnitario
- Ranking: familia/subfamilia/hiperfamilia (ene-may 2025)
- VENTA-H: histórico 2022-2025 por producto
- VENTA PESOS: histórico 2022-2026 por pesos, por familia/hiperfamilia

## Features v3 (2026-05-11)
- ABC80 (80/15/5): recalculado desde ventaAnioMovil — A=470, B=877, C=2480, D=5693
- Filtros exclusión global sidebar: (DD), Descontinuados, Outlet
- Tab Sin Movimiento: stock sin venta 12m (1210 SKUs), cobertura por meses
- Tab Sugerido Compra: por Marca/Familia/Subfamilia/Hiperfamilia, meta 3 meses cobertura
- Tab Temporada Chile: Verano/Otoño/Invierno/Primavera por keywords familia
- Charts: ABC80 doughnut, % venta en riesgo por quiebres A
- SW auto-generado con version timestamp en cada deploy

## Why: pctRiesgoA
riesgoVentaA = suma ventaAnioMovil de productos abc80=A en quiebre → % del total vendido en riesgo
