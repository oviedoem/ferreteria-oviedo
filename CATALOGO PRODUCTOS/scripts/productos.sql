-- ============================================================
-- productos.sql — Ferretería Oviedo
-- Catálogo de productos para actualizar Datos.csv
--
-- INSTRUCCIONES:
--   1. Edita los precios y productos en este archivo
--   2. Ejecuta: python sql_a_csv.py
--   3. Verificar con: python sql_a_csv.py --preview
--   4. Publicar en GitHub: python sql_a_csv.py --subir
--
-- FORMATO POSICIONAL (más simple):
--   INSERT INTO productos VALUES ('CODIGO','DESCRIPCION','MARCA',PRECIO);
--
-- FORMATO CON COLUMNAS (más flexible):
--   INSERT INTO productos (codigo,descripcion,marca,subfamilia,precio,precio_socio)
--   VALUES ('CODIGO','DESCRIPCION','MARCA','SUBFAMILIA',PRECIO,PRECIO_SOCIO);
--
-- NOTAS:
--   - Si no se indica precio_socio, se calcula automáticamente al 90% del precio
--   - SubFamilia es la categoría del producto (Herramientas, Construccion, etc.)
--   - Los precios se ingresan CON IVA incluido
-- ============================================================

-- ── HERRAMIENTAS ─────────────────────────────────────────────
INSERT INTO productos VALUES ('H001', 'Martillo de Galpon 16oz',       'Tramontina', 1500);
INSERT INTO productos VALUES ('H002', 'Destornillador Phillips 1/4x4', 'Stanley',    850);
INSERT INTO productos VALUES ('H003', 'Llave Ajustable 10 pulgadas',   'Bahco',      3200);
INSERT INTO productos VALUES ('H004', 'Nivel de Burbuja 60cm',         'Stanley',    2100);
INSERT INTO productos VALUES ('H005', 'Taladro Percutor 650W',         'Bosch',      18500);

-- ── CONSTRUCCION ─────────────────────────────────────────────
INSERT INTO productos VALUES ('C001', 'Cemento Portland 50kg',     'Loma Negra',  4500);
INSERT INTO productos VALUES ('C002', 'Cal Hidratada 25kg',        'El Milagro',  1200);
INSERT INTO productos VALUES ('C003', 'Hierro 8mm x 12mts',        'Acindar',     5800);
INSERT INTO productos VALUES ('C004', 'Arena Gruesa x Bolsa 50kg', '',            890);
INSERT INTO productos VALUES ('C005', 'Ladrillos x 1000 unidades', '',            28000);

-- ── ELECTRICIDAD ─────────────────────────────────────────────
INSERT INTO productos VALUES ('E001', 'Cable Unipolar 2.5mm x 100mts', 'Prysmian',   12500);
INSERT INTO productos VALUES ('E002', 'Toma Corriente Doble Exterior',  'Sica',       950);
INSERT INTO productos VALUES ('E003', 'Lampara LED 9W Fria',            'Philips',    450);
INSERT INTO productos VALUES ('E004', 'Disyuntor Termico 16A',          'Schneider',  2200);
INSERT INTO productos VALUES ('E005', 'Cinta Aisladora x 10mts',        '',           180);

-- ── PINTURAS ─────────────────────────────────────────────────
INSERT INTO productos VALUES ('P001', 'Latex Interior Blanco 20L',   'Alba',      18500);
INSERT INTO productos VALUES ('P002', 'Sintetico Brillante Negro 1L', 'Tersuave',  2800);
INSERT INTO productos VALUES ('P003', 'Pincel Nro 20 Cerda Blanca',  'El Galgo',  650);
INSERT INTO productos VALUES ('P004', 'Rodillo Lana 23cm',            '',          950);
INSERT INTO productos VALUES ('P005', 'Sellador Transparente 1L',    'Petrilac',  1800);

-- ── PLOMERIA ─────────────────────────────────────────────────
INSERT INTO productos VALUES ('PL001', 'Canio PVC 110mm x 3mts',      '',   3200);
INSERT INTO productos VALUES ('PL002', 'Llave de Paso 1/2 pulgada',   '',   1400);
INSERT INTO productos VALUES ('PL003', 'Codo PVC 90 grados 110mm',    '',   280);

-- ============================================================
-- PARA AGREGAR PRODUCTOS NUEVOS: copiar y pegar una línea
-- INSERT INTO productos VALUES ('NUEVO_COD', 'Descripcion del producto', 'Marca', PRECIO_CON_IVA);
-- ============================================================
