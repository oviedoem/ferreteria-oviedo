'use strict';
const DEBUG = false;

/* ═══════════════════════════════════════════════════════════════
   INVENTARIO EL MANZANO · app.js
   ═══════════════════════════════════════════════════════════════ */

// ── ESTADO GLOBAL ──────────────────────────────────────────────
const state = {
  data2025: [],
  data2026: [],
  registros2026: [],   // rows crudos de la hoja REGISTROS del Excel 2026
  charts: {},
  sortState: {},
  pendingLoad: null,
  filters: {
    '2025':      { marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'', bodega:'' },
    '2026':      { marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'', bodega:'' },
    comparative: { marca:'', familia:'', perfamilia:'', zona:'', area:'' }
  },
  searchText: { '2025': '', '2026': '' },
  chartMode:  { '2025': 'unidades', '2026': 'unidades' },
  // Embudo jerárquico (nuevo V2)
  drilldown: {
    '2025': { hiperfamilia:'', familia:'', marca:'' },
    '2026': { hiperfamilia:'', familia:'', marca:'' }
  },
  // Desglose interactivo existente (tabla #drilldown-{year})
  ddState: {
    '2025': { groupBy: 'familia', filterField: null, filterValue: null },
    '2026': { groupBy: 'familia', filterField: null, filterValue: null },
  },
  // Filtros de búsqueda del Desglose (solo view-2026 por ahora)
  ddFilters: {
    '2026': { cod: '', desc: '', sortByDif: false }
  },
  compCategoria: 'perfamilia',
  compDrill: { field: null, value: null },
};

// ── MAPEO DE COLUMNAS ──────────────────────────────────────────
// Incluye columnas específicas de archivos El Manzano:
//   TABLA_ANALISIS: Descripcion, CONTEO (físico), STOCK SISTEMA, FAMILIA, MARCA, HIPERFAMILIA
//   AREA 2/3 / registro2026: CODIGO, PRODUCTOS, AREA, PATENTE, CONTEO, CONTO
const FIELD_ALIASES = {
  producto:         ['DESCRIPCION','DESCRIPCIÓN','PRODUCTOS','PRODUCTO','SKU',
                     'ARTICULO','ARTÍCULO','NOMBRE','ITEM','PRODUCT','CODIGO_TECNICO'],
  codigo:           ['CODIGO_TECNICO','CODIGO','CÓDIGO','COD_PROD','SKU','CODE'],
  patente:          ['PATENTE','SALA','BODEGA','SECCION','SECCIÓN','UBICACION','UBICACIÓN','SECTION'],
  zona:             ['ZONA','SECTOR','ZONE','AREA_GRANDE','PASILLO_PRINCIPAL'],
  area:             ['AREA','ÁREA','SUBSECTOR','UBICACION_DETALLE','PASILLO','SUBAREA','SUBÁREA'],
  marca:            ['MARCA','BRAND','FABRICANTE','PROVEEDOR'],
  familia:          ['FAMILIA','FAMILY','LINEA','LÍNEA','LINE'],
  perfamilia:       ['HIPERMALIA','PERFAMILIA','HIPERFAMILIA','SUPERFAMILIA',   // HIPERMALIA = typo en archivos EM
                     'CATEGORIA','CATEGORÍA','DEPARTMENT','SUPER_FAMILIA','SUPER_CATEGORY'],
  subfamilia:       ['SUBFAMILIA','SUB_FAMILIA','SUBLINEA','SUB_LINEA','SUBLINEA_'],
  costo:            ['COSTO_','COSTO','PRECIO_UNIT','PRECIO_UNITARIO','VALOR_UNIT','PRECIO'],
  unidades_sistema: ['STOCK_SISTEMA','STOCK SISTEMA','UNIDADES_SISTEMA','STOCKSISTEMA',
                     'UNID_SIST','CANT_SIST','QTY_SYSTEM','CONTEO_SISTEMA','STK_SIST',
                     'STOCK','CANT_SISTEMA','UNIDADES_SIST','CONTO'],
  unidades_real:    ['CONTEO','UNIDADES_REAL','CONTEO_FISICO','CONTEOFISICO','UNID_REAL',
                     'CANT_REAL','QTY_REAL','FISICO','CONTEO_REAL','STOCK_FISICO',
                     'CANT_FISICO','FISICO_UNID','UNIDADES_FISICO'],
  // VALOR_SISTEMA / VALOR_CONTEO son los nombres reales en TABLA_ANALISIS de El Manzano
  peso_sistema:     ['VALOR_SISTEMA','VALOR_SISTEM','PESO_SISTEMA','PESO_SIST',
                     'KG_SISTEMA','KG_SIST','PESO_SIS','WEIGHT_SYSTEM','KILO_SISTEMA'],
  peso_real:        ['VALOR_CONTEO','VALOR_CONTE','PESO_REAL','PESO_FISICO',
                     'KG_REAL','KG_FISICO','PESO_FIS','WEIGHT_REAL','KILO_REAL'],
  dif_valor:        ['DIFERENCIA $','DIFERENCIA_$','DIF_VALOR','DIFERENCIA_VALOR',
                     'DIFERENCIA_PESO','DIF_$','DIF_PESO'],
};

const FIELD_LABELS = {
  producto:         'Producto / Descripción *',
  unidades_sistema: 'Unidades Sistema *',
  unidades_real:    'Unidades Real *',
  peso_sistema:     'Valor Sistema ($)',
  peso_real:        'Valor Conteo ($)',
  patente:          'Patente / Sala',
  zona:             'Zona',
  area:             'Área',
  marca:            'Marca',
  familia:          'Familia',
  perfamilia:       'Hiperfamilia',
  subfamilia:       'Subfamilia',
  costo:            'Costo Unitario ($)',
  dif_valor:        'Diferencia ($)',
  bodega:           'Bodega EM',
};

function normalizeHeader(h) {
  return (h || '').toString().toUpperCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar tildes
    .replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
}

function isBlankLike(v) {
  if (v === null || v === undefined) return true;
  const s = v.toString().trim();
  if (!s) return true;
  const n = normalizeHeader(s).replace(/_/g, '');
  return ['NA','N/A','SINDATO','SINDATOS','NULL','UNDEFINED','ERROR'].includes(n) ||
         s === '#N/A' || s === '#VALUE!' || s === '#REF!';
}

function cleanText(v) {
  return isBlankLike(v) ? '' : v.toString().trim();
}

function rowValueByAliases(row, aliases) {
  if (!row) return '';
  const byNorm = new Map(Object.keys(row).map(k => [normalizeHeader(k), k]));
  for (const alias of aliases) {
    const key = byNorm.get(normalizeHeader(alias));
    if (key !== undefined && !isBlankLike(row[key])) return row[key];
  }
  for (const alias of aliases) {
    const normAlias = normalizeHeader(alias);
    if (normAlias.length < 6) continue;
    const match = [...byNorm.keys()].find(k => k.startsWith(normAlias) || normAlias.startsWith(k));
    if (match && !isBlankLike(row[byNorm.get(match)])) return row[byNorm.get(match)];
  }
  return '';
}

function findSheetName(wb, candidates) {
  if (!wb?.SheetNames) return null;
  const byNorm = new Map(wb.SheetNames.map(n => [normalizeHeader(n), n]));
  for (const c of candidates) {
    const exact = byNorm.get(normalizeHeader(c));
    if (exact) return exact;
  }
  return null;
}

function sheetToJsonWithDetectedHeader(ws, requiredAliases, maxScanRows = 30) {
  if (!ws) return [];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  let headerRow = 0, bestScore = -1;
  const required = requiredAliases.map(normalizeHeader);
  const limit = Math.min(matrix.length, maxScanRows);
  for (let i = 0; i < limit; i++) {
    const normalized = (matrix[i] || []).map(normalizeHeader);
    const score = required.filter(req => normalized.some(h => h === req || h.startsWith(req) || req.startsWith(h))).length;
    if (score > bestScore) { bestScore = score; headerRow = i; }
  }
  return XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, range: headerRow });
}

function findColumn(headers, candidates) {
  const normHeaders = headers.map(normalizeHeader);
  // Paso 1: búsqueda exacta (más fiable)
  for (const c of candidates) {
    const normC = normalizeHeader(c);
    const idx = normHeaders.indexOf(normC);
    if (idx !== -1) return headers[idx];
  }
  // Paso 2: búsqueda parcial solo para candidatos largos (≥6 chars) para evitar falsos positivos
  for (const c of candidates) {
    const normC = normalizeHeader(c);
    if (normC.length < 6) continue;
    const idx = normHeaders.findIndex(h => h.startsWith(normC) || normC.startsWith(h));
    if (idx !== -1 && normHeaders[idx].length >= 5) return headers[idx];
  }
  return null;
}

function autoDetectMapping(headers) {
  const mapping = {}, missing = [];
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    // Buscar también en columnas enriquecidas (_area, _patente, etc.)
    const col = findColumn(headers, aliases) ||
                findColumn(headers, aliases.map(a => '_' + a.toLowerCase()));
    if (col) mapping[field] = col;
    else missing.push(field);
  }
  applySavedMappingRules(headers, mapping);
  return { mapping, missing };
}

// Campos opcionales: si faltan, no bloqueamos
const OPTIONAL_FIELDS = new Set(['peso_sistema','peso_real','zona','area','patente',
                                  'perfamilia','marca','familia','subfamilia','costo','codigo','dif_valor']);
const CRITICAL_FIELDS = ['producto','unidades_sistema','unidades_real'];
const LS_MAPPING_RULES_KEY = 'appInv_mapping_rules_v1';

function normalizeInventoryValue(v) {
  if (isBlankLike(v)) return '';
  return v.toString()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSku(v) {
  return normalizeInventoryValue(v)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .toUpperCase();
}

function normalizeProductName(v) {
  return normalizeInventoryValue(v)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function normalizeNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = normalizeInventoryValue(v).replace(/\s/g, '');
  if (!s) return 0;
  const cleaned = s.replace(/[^\d.,\-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === ',' || cleaned === '.') return 0;
  const hasComma = cleaned.includes(',');
  const hasDot   = cleaned.includes('.');
  let normalized = cleaned;
  if (hasComma && hasDot) {
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (hasComma && !hasDot) {
    // SheetJS devuelve miles en formato US: "4,248" o "3,814,704".
    // Si hay exactamente 3 dígitos tras la última coma → separador de miles → quitar comas.
    // Si hay 1 ó 2 dígitos → separador decimal (estilo europeo) → convertir a punto.
    const lastPart = cleaned.split(',').pop();
    normalized = lastPart.length === 3
      ? cleaned.replace(/,/g, '')
      : cleaned.replace(',', '.');
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function _stableHash(input) {
  const s = String(input || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function buildCompositeKey(row) {
  const sku = row._sku_norm || normalizeSku(row.codigo);
  const product = row._producto_norm || normalizeProductName(row.producto);
  const patente = normalizeSku(row.patente);
  return [sku || product, patente, row.unidades_sistema, row.unidades_real].join('|');
}

function buildRowHash(row) {
  return _stableHash([
    row.sourceFile || '',
    row.compositeKey || buildCompositeKey(row),
    row.peso_sistema,
    row.peso_real,
    row.dif_peso,
  ].join('|'));
}

function loadMappingRules() {
  try { return JSON.parse(localStorage.getItem(LS_MAPPING_RULES_KEY) || '{}') || {}; }
  catch { return {}; }
}

function saveMappingRules(mapping) {
  const rules = loadMappingRules();
  for (const [field, col] of Object.entries(mapping || {})) {
    if (col) rules[normalizeHeader(col)] = field;
  }
  try { localStorage.setItem(LS_MAPPING_RULES_KEY, JSON.stringify(rules)); }
  catch {}
}

function applySavedMappingRules(headers, mapping) {
  const rules = loadMappingRules();
  const byNorm = new Map((headers || []).map(h => [normalizeHeader(h), h]));
  for (const [normCol, field] of Object.entries(rules)) {
    if (!FIELD_ALIASES[field] || mapping[field]) continue;
    const realCol = byNorm.get(normCol);
    if (realCol) mapping[field] = realCol;
  }
}

function isInvalidNumericInput(v) {
  if (isBlankLike(v)) return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  const raw = normalizeInventoryValue(v);
  // Guion contable de Excel ("-", "$ -", "$-") = CERO en formato contable chileno → válido.
  // Si tras quitar símbolos/guiones/espacios no queda nada, es un cero contable, no un error.
  if (raw.replace(/[^\dA-Za-z]/g, '') === '') return false;
  const hasDigit = /\d/.test(raw);
  if (!hasDigit) return true;
  return !Number.isFinite(normalizeNumber(raw));
}

function applyRowMapping(rawRow, mapping) {
  const row = {};
  for (const [field, col] of Object.entries(mapping)) {
    row[field] = col ? (rawRow[col] ?? '') : '';
  }
  // Fallback a columnas enriquecidas si el campo está vacío
  if (isBlankLike(row.area)    && rawRow._area)    row.area    = rawRow._area;
  if (isBlankLike(row.patente) && rawRow._patente) row.patente = rawRow._patente;
  if (isBlankLike(row.zona)    && rawRow._zona)    row.zona    = rawRow._zona;
  if (isBlankLike(row.marca)   && rawRow._marca)   row.marca   = rawRow._marca;
  if (isBlankLike(row.perfamilia) && rawRow._hiper)        row.perfamilia = rawRow._hiper;
  if (isBlankLike(row.familia)    && rawRow._familia)      row.familia    = rawRow._familia;
  if (isBlankLike(row.subfamilia) && rawRow._subfamilia)   row.subfamilia = rawRow._subfamilia;
  if (isBlankLike(row.bodega)     && rawRow._bodega)       row.bodega     = rawRow._bodega;

  // Garantizar campos no mapeados
  for (const f of Object.keys(FIELD_ALIASES)) {
    if (!(f in row)) row[f] = '';
  }
  row._num_invalid_fields = ['unidades_sistema','unidades_real','peso_sistema','peso_real','costo','dif_valor']
    .filter(f => isInvalidNumericInput(row[f]));
  // Convertir numéricos
  row.unidades_sistema = parseNum(row.unidades_sistema);
  row.unidades_real    = parseNum(row.unidades_real);
  row.peso_sistema     = parseNum(row.peso_sistema);
  row.peso_real        = parseNum(row.peso_real);
  row.costo            = parseNum(row.costo) || parseNum(rawRow._costo) || 0;
  row.dif_valor_excel  = parseNum(row.dif_valor);
  // Calcular diferencias
  row.dif_unidades     = row.unidades_real - row.unidades_sistema;
  const difValorPorCosto = row.costo ? row.dif_unidades * row.costo : 0;
  const difValorPorTotales = row.peso_real - row.peso_sistema;
  row.dif_peso         = row.costo ? difValorPorCosto : (row.dif_valor_excel || difValorPorTotales);
  row.abs_dif_unidades = Math.abs(row.dif_unidades);
  row.abs_dif_peso     = Math.abs(row.dif_peso);
  // Normalizar strings
  for (const f of ['producto','patente','zona','area','marca','familia','perfamilia','subfamilia','codigo','bodega']) {
    row[f] = normalizeInventoryValue(row[f]);
  }
  row._sku_norm = normalizeSku(row.codigo);
  row._producto_norm = normalizeProductName(row.producto);
  // Fallback "Sin clasificar" para campos de categoría que quedan vacíos
  for (const f of ['marca','familia','perfamilia']) {
    if (!row[f]) row[f] = 'Sin clasificar';
  }
  return row;
}

function isValidInventoryRow(row) {
  return Boolean(cleanText(row.producto) || cleanText(row.codigo));
}

function validateInventoryRows(rows, ctx = {}) {
  const existingHashes = ctx.existingHashes || new Set([...(state.data2025 || []), ...(state.data2026 || [])].map(r => r.rowHash).filter(Boolean));
  const batchHashes = new Set();
  const compositeSeen = new Set();
  const warnings = [];
  const errors = [];
  const validRows = [];
  let emptyRows = 0;
  let duplicates = 0;

  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    if (!isValidInventoryRow(row)) {
      emptyRows++;
      return;
    }

    const rowWarnings = [];
    if (!row._sku_norm) rowWarnings.push('SKU vacio');
    if (row._num_invalid_fields?.length) rowWarnings.push(`tipo numerico invalido: ${row._num_invalid_fields.join('/')}`);
    for (const f of ['unidades_sistema','unidades_real','peso_sistema','peso_real','costo','dif_peso']) {
      if (!Number.isFinite(Number(row[f]))) rowWarnings.push(`${f} invalido`);
    }
    if (row.unidades_sistema < 0 || row.unidades_real < 0) rowWarnings.push('unidades negativas');
    if (row.peso_sistema < 0 || row.peso_real < 0) rowWarnings.push('valor negativo');
    if (row.costo < 0) rowWarnings.push('costo negativo');
    if ((row.peso_sistema || row.peso_real) && !row.costo && !row.dif_valor_excel) rowWarnings.push('valor sin costo/diferencia');

    row.sourceFile = ctx.sourceFile || row.sourceFile || '';
    row.importTimestamp = ctx.importTimestamp || Date.now();
    row.compositeKey = buildCompositeKey(row);
    row.rowHash = buildRowHash(row);

    if (batchHashes.has(row.rowHash) || existingHashes.has(row.rowHash)) {
      duplicates++;
      rowWarnings.push('duplicado exacto omitido');
      warnings.push({ row: rowNum, msg: rowWarnings.join(', ') });
      return;
    }
    batchHashes.add(row.rowHash);

    if (compositeSeen.has(row.compositeKey)) rowWarnings.push('posible duplicado producto/patente');
    compositeSeen.add(row.compositeKey);

    if (!row.producto && !row.codigo) errors.push({ row: rowNum, msg: 'sin producto ni codigo' });
    if (rowWarnings.length) warnings.push({ row: rowNum, msg: rowWarnings.join(', ') });
    existingHashes.add(row.rowHash);
    validRows.push(row);
  });

  return {
    validRows,
    summary: {
      sourceFile: ctx.sourceFile || '',
      valid: validRows.length,
      warnings: warnings.length,
      errors: errors.length,
      emptyRows,
      duplicates,
      warningItems: warnings.slice(0, 5),
      errorItems: errors.slice(0, 5),
    },
  };
}

function mergeValidationSummaries(items) {
  return items.reduce((acc, s) => {
    acc.valid += s.valid || 0;
    acc.warnings += s.warnings || 0;
    acc.errors += s.errors || 0;
    acc.emptyRows += s.emptyRows || 0;
    acc.duplicates += s.duplicates || 0;
    acc.warningItems.push(...(s.warningItems || []));
    acc.errorItems.push(...(s.errorItems || []));
    return acc;
  }, { valid:0, warnings:0, errors:0, emptyRows:0, duplicates:0, warningItems:[], errorItems:[] });
}

function renderValidationSummary(summary) {
  const el = document.getElementById('validation-summary');
  if (!el || !summary) return;
  const details = [];
  if (summary.emptyRows) details.push(`${summary.emptyRows.toLocaleString('es-CL')} filas vacias omitidas`);
  if (summary.duplicates) details.push(`${summary.duplicates.toLocaleString('es-CL')} duplicados exactos omitidos`);
  for (const w of (summary.warningItems || []).slice(0, 3)) details.push(`Fila ${w.row}: ${w.msg}`);
  for (const e of (summary.errorItems || []).slice(0, 3)) details.push(`Error fila ${e.row}: ${e.msg}`);
  el.classList.remove('hidden');
  el.innerHTML = `
    <strong>Validacion de datos</strong>
    <div class="val-ok">Filas validas: ${summary.valid.toLocaleString('es-CL')}</div>
    <div class="val-warn">Advertencias: ${summary.warnings.toLocaleString('es-CL')}</div>
    <div class="val-error">Errores criticos: ${summary.errors.toLocaleString('es-CL')}</div>
    ${details.length ? `<div class="val-detail">${details.map(d => `<div>${d}</div>`).join('')}</div>` : ''}`;
}

function parseNum(v) {
  return normalizeNumber(v);
}

// ── SELECCIÓN INTELIGENTE DE HOJA ─────────────────────────────
// Prioridad: TABLA_ANALISIS > hoja con más columnas reconocidas > primera con datos
const SHEET_PRIORITY = ['TABLA_ANALISIS', 'ANALISIS', 'DATOS', 'INVENTARIO', 'DATA'];
const KEY_COLS = ['CONTEO','STOCK_SISTEMA','DESCRIPCION','PRODUCTOS','FAMILIA','MARCA',
                  'HIPERMALIA','UNIDADES_SISTEMA','UNIDADES_REAL','STOCK SISTEMA'];

function selectBestSheet(wb) {
  for (const name of SHEET_PRIORITY) {
    if (wb.SheetNames.includes(name)) return name;
  }
  // Buscar la hoja con más columnas clave
  let best = wb.SheetNames[0], bestScore = -1;
  for (const name of wb.SheetNames) {
    try {
      const ws = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, range: 1 });
      if (!rows.length) continue;
      const hdrs = Object.keys(rows[0]).map(h => h.toString().toUpperCase().trim());
      const score = KEY_COLS.filter(k => hdrs.some(h => h.includes(k.replace('_',' ')) || h === k)).length;
      if (score > bestScore) { bestScore = score; best = name; }
    } catch { /* skip */ }
  }
  return best;
}

// Construye índice de ubicación leyendo hojas de área/registro
function buildLocationIndex(wb) {
  const locSheets = ['AREA 2','AREA 3','registro2026','busqueda','SALA','PATIO','EXHIBICION'];
  const index = {}; // codigo_tecnico → { area, patente, zona, bodega }
  for (const name of locSheets) {
    if (!wb.SheetNames.includes(name)) continue;
    try {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: false });
      for (const r of rows) {
        const cod = (r.CODIGO || r.Codigo_tecnico || r.Codigo_Tecnico || r.codigo_tecnico || '').toString().trim();
        if (!cod || index[cod]) continue;
        index[cod] = {
          area:    (r.AREA    || '').toString().trim(),
          patente: (r.PATENTE || '').toString().trim(),
          zona:    (r.ZONA || r.SECTOR || r.Bodega || name.replace('AREA ','Área ') || '').toString().trim(),
        };
      }
    } catch { /* skip */ }
  }
  return index;
}

// Construye índice de familia/marca desde hoja 'familia'
function buildFamiliaIndex(wb) {
  const sheet = findSheetName(wb, ['familia']);
  if (!sheet) return {};
  try {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '', raw: false });
    const index = {};
    for (const r of rows) {
      const cod = cleanText(rowValueByAliases(r, ['Codigo','CODIGO','Codigo_Tecnico','CODIGO_TECNICO']));
      if (!cod) continue;
      index[cod] = {
        marca:        cleanText(rowValueByAliases(r, ['Marca','MARCA'])),
        hiperfamilia: cleanText(rowValueByAliases(r, ['Hiperfamilia','HIPERFAMILIA','HIPERMALIA'])),
        familia:      cleanText(rowValueByAliases(r, ['Familia','FAMILIA'])),
        subfamilia:   cleanText(rowValueByAliases(r, ['SubFamilia','SUBFAMILIA','Subfamilia','SUB_FAMILIA'])),
      };
    }
    return index;
  } catch { return {}; }
}

// Construye índice de datos faltantes (marca/familia/hiperfamilia) desde hoja 'datos_faltantes'
// Permite enriquecer registros que en TABLA_ANALISIS no traen categorización completa.
function buildMissingDataIndex(wb) {
  const sheet = findSheetName(wb, ['datos_faltantes','DATOS_FALTANTES']);
  if (!sheet) return null;
  try {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '', raw: false });
    const index = {};
    for (const r of rows) {
      const cod = cleanText(rowValueByAliases(r, ['CODIGO','Codigo','codigo_tecnico','CODIGO_TECNICO','Codigo_Tecnico']));
      if (!cod) continue;
      index[cod] = {
        marca:      cleanText(rowValueByAliases(r, ['Marca','MARCA','marca','MARCA_','Brand','BRAND'])),
        familia:    cleanText(rowValueByAliases(r, ['Familia','FAMILIA','familia','FAMILY','Family'])),
        perfamilia: cleanText(rowValueByAliases(r, ['Hiperfamilia','HIPERFAMILIA','HIPERMALIA','PERFAMILIA','Perfamilia','Categoria','CATEGORIA','SuperFamilia','SUPERFAMILIA'])),
        subfamilia: cleanText(rowValueByAliases(r, ['SubFamilia','SUBFAMILIA','Subfamilia','subfamilia','SUB_FAMILIA','Sub_Familia','SUBLINEA','SubLinea'])),
        costo:      parseNum(rowValueByAliases(r, ['Costo','COSTO','COSTO_','Costo Promedio','costo','Precio','PRECIO','VALOR_UNIT','PrecioUnitario','PRECIO_UNITARIO'])),
      };
    }
    if (DEBUG) console.debug('[inventario] DATOS_FALTANTES indexado', { sheet, rows: rows.length, codigos: Object.keys(index).length });
    return index;
  } catch { return null; }
}

// Lee catálogo completo desde hojas PEM y SEM (headers en fila 19, range:18).
// Extrae: marca, hiperfamilia, familia, subfamilia, costo promedio, bodega (por Disp>0).
function buildCatalogFromBodegas(wb) {
  const catalog = {}; // cod → {marca, perfamilia, familia, subfamilia, costo, bodega}
  const inPEM = new Set();
  const inSEM = new Set();

  const readSheet = (sheetName) => {
    if (!wb.SheetNames.includes(sheetName)) return;
    try {
      const rows = sheetToJsonWithDetectedHeader(
        wb.Sheets[sheetName],
        ['Codigo_Tecnico','Descripcion','Costo Promedio','Marca','Familia','SubFamilia']
      );
      for (const r of rows) {
        const cod = cleanText(rowValueByAliases(r, ['Codigo_Tecnico','Codigo_tecnico','CODIGO_TECNICO','Codigo_Tecni','codigo_tecnico','Codigo']));
        if (!cod) continue;

        if (sheetName === 'PEM') inPEM.add(cod);
        if (sheetName === 'SEM') inSEM.add(cod);

        const current = catalog[cod] || {};
        const costoVal = rowValueByAliases(r, ['Costo Promedio','Costo_Promedio','CostoPromedio','Costo Promed','Costo_Promed','Costo','COSTO','COSTO_','COSTO $']);
        catalog[cod] = {
          marca:      cleanText(current.marca)      || cleanText(rowValueByAliases(r, ['Marca','MARCA'])),
          perfamilia: cleanText(current.perfamilia) || cleanText(rowValueByAliases(r, ['HiperFamilia','Hiperfamilia','HIPERFAMILIA','HIPERMALIA','HiperFamil'])),
          familia:    cleanText(current.familia)    || cleanText(rowValueByAliases(r, ['Familia','FAMILIA'])),
          subfamilia: cleanText(current.subfamilia) || cleanText(rowValueByAliases(r, ['SubFamilia','Subfamilia','SUBFAMILIA','SubFamil','SUB_FAMILIA'])),
          costo:      parseNum(current.costo) || parseNum(costoVal),
        };
      }
      if (DEBUG) console.debug('[inventario] catálogo bodega indexado', { sheet: sheetName, rows: rows.length });
    } catch { /* skip */ }
  };

  readSheet('PEM');
  readSheet('SEM');

  // Asignar bodega a cada entrada del catálogo
  for (const cod of Object.keys(catalog)) {
    const enPEM = inPEM.has(cod);
    const enSEM = inSEM.has(cod);
    catalog[cod].bodega = enPEM && enSEM ? 'PEM+SEM' : enPEM ? 'PEM' : enSEM ? 'SEM' : '';
  }

  return catalog;
}

// Mantener buildBodegaIndex como wrapper liviano (compatibilidad)
function buildBodegaIndex(wb) {
  const cat = buildCatalogFromBodegas(wb);
  const idx = {};
  for (const [cod, v] of Object.entries(cat)) if (v.bodega) idx[cod] = v.bodega;
  return idx;
}

// ── LECTURA DE ARCHIVOS ────────────────────────────────────────
async function readFileData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      reader.onload = e => {
        const result = Papa.parse(e.target.result, {
          header: true, skipEmptyLines: true, dynamicTyping: false
        });
        resolve({ headers: result.meta.fields || [], rows: result.data, wb: null });
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.onload = e => {
        try {
          const wb       = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          const sheetName = selectBestSheet(wb);
          const rows      = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '', raw: false });
          const headers   = rows.length ? Object.keys(rows[0]) : [];

          // Enriquecer con ubicación y familia si es la hoja TABLA_ANALISIS
          const locIndex     = buildLocationIndex(wb);
          const famIndex     = buildFamiliaIndex(wb);
          const missingIndex = buildMissingDataIndex(wb);
          const catalogIndex = buildCatalogFromBodegas(wb);

          // Extraer patentes contadas desde hoja REGISTROS.
          // CONTEO = unidades físicas encontradas (puede ser 0 si el producto no estaba).
          // CONTO  = flag de visita del inventariador (>0 = producto fue visitado).
          // Una patente se considera "contada" cuando TODOS sus productos tienen CONTO > 0.
          let registrosRows = [];
          const patentesCargadasSet = new Set();
          const registroSheets = ['REGISTROS'];
          for (const sName of registroSheets) {
            if (!wb.SheetNames.includes(sName)) continue;
            try {
              const rRows = XLSX.utils.sheet_to_json(wb.Sheets[sName], { defval: '', raw: false });
              if (rRows.length) registrosRows = rRows;
              // Agrupar por patente: total de filas vs filas con CONTO > 0 (visitadas)
              const grupos = {};
              for (const r of rRows) {
                const pat = String(r.PATENTE || r.Patente || r.patente || '').trim();
                if (!pat) continue;
                const patKey = pat.toUpperCase();
                const conto = parseFloat(String(r.CONTO || r.Conto || r.conto || 0));
                if (!grupos[patKey]) grupos[patKey] = { total: 0, counted: 0 };
                grupos[patKey].total++;
                if (conto > 0) grupos[patKey].counted++;
              }
              // Marcar como contada si TODAS las filas de la patente fueron visitadas (CONTO > 0)
              for (const [patKey, g] of Object.entries(grupos)) {
                if (g.total > 0 && g.counted === g.total) {
                  patentesCargadasSet.add(patKey);
                  const num = patKey.match(/^(\d+)/)?.[1];
                  if (num) patentesCargadasSet.add(num);
                }
              }
            } catch { /* skip */ }
          }
          if (patentesCargadasSet.size > 0) {
            window._patentesCargadas = patentesCargadasSet;
          }

          // Construir mapa patente → inventariador desde REGISTROS
          const inventariadorMap = new Map();
          const invSheets = ['REGISTROS'];
          for (const sName of invSheets) {
            if (!wb.SheetNames.includes(sName)) continue;
            try {
              const rRows = XLSX.utils.sheet_to_json(wb.Sheets[sName], { defval:'', raw:false });
              for (const r of rRows) {
                const pat = String(r.PATENTE || r.Patente || r.patente || '').trim().toUpperCase();
                const inv = String(r.INVENTARIADOR || r.Inventariador || r.inventariador || '').trim();
                const conto = parseFloat(String(r.CONTO || r.Conto || 0));
                if (pat && inv && conto > 0 && !inventariadorMap.has(pat)) {
                  inventariadorMap.set(pat, inv);
                  const num = pat.match(/^(\d+)/)?.[1];
                  if (num && !inventariadorMap.has(num)) inventariadorMap.set(num, inv);
                }
              }
            } catch { /* skip */ }
          }
          window._inventariadorPorPatente = inventariadorMap;

          const bodegaIndex  = Object.fromEntries(Object.entries(catalogIndex).filter(([,v]) => v.bodega).map(([k,v]) => [k, v.bodega]));
          const enriched = rows.map(r => {
            const cod = cleanText(rowValueByAliases(r, ['Codigo_tecnico','CODIGO','Codigo_Tecnico','Codigo','CODIGO_TECNICO']));
            const loc = locIndex[cod] || {};
            const fam = famIndex[cod] || {};
            const mis = (missingIndex && cod && missingIndex[cod]) || {};
            const cat = catalogIndex[cod] || {};
            return {
              ...r,
              _area:    cleanText(rowValueByAliases(r, ['AREA','ÁREA'])) || cleanText(loc.area),
              _patente: cleanText(rowValueByAliases(r, ['PATENTE'])) || cleanText(loc.patente),
              _zona:    cleanText(rowValueByAliases(r, ['ZONA','SECTOR'])) || cleanText(loc.zona),
              _marca:      cleanText(rowValueByAliases(r, ['MARCA','Marca'])) || cleanText(fam.marca) || cleanText(mis.marca) || cleanText(cat.marca),
              _hiper:      cleanText(rowValueByAliases(r, ['HIPERMALIA','HIPERFAMILIA','HiperFamilia'])) || cleanText(fam.hiperfamilia) || cleanText(mis.perfamilia) || cleanText(cat.perfamilia),
              _familia:    cleanText(rowValueByAliases(r, ['FAMILIA','Familia'])) || cleanText(fam.familia) || cleanText(mis.familia) || cleanText(cat.familia),
              _subfamilia: cleanText(rowValueByAliases(r, ['SubFamilia','SUBFAMILIA','Subfamilia','SUB_FAMILIA'])) || cleanText(fam.subfamilia) || cleanText(mis.subfamilia) || cleanText(cat.subfamilia),
              _bodega:     bodegaIndex[cod] || '',
              _costo:      parseNum(rowValueByAliases(r, ['COSTO $','Costo Promedio','COSTO','COSTO_'])) || parseNum(mis.costo) || parseNum(cat.costo) || 0,
            };
          });
          if (DEBUG) console.debug('[inventario] archivo leído', {
            file: file.name,
            sheetName,
            rows: enriched.length,
            headers,
            catalog: Object.keys(catalogIndex).length,
            datosFaltantes: missingIndex ? Object.keys(missingIndex).length : 0,
          });
          resolve({ headers, rows: enriched, wb, sheetName, registros: registrosRows });
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    }
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
  });
}

// ── CARGA DE ARCHIVOS ──────────────────────────────────────────
async function loadFiles(files, year) {
  const fileArr = Array.from(files);
  if (!fileArr.length) return;

  showToast('Leyendo archivos…', 'info');
  let allRows = [];
  let sharedMapping = null;
  const validationSummaries = [];
  const importHashes = new Set([...(state.data2025 || []), ...(state.data2026 || [])].map(r => r.rowHash).filter(Boolean));

  for (let i = 0; i < fileArr.length; i++) {
    const file = fileArr[i];
    let data;
    try { data = await readFileData(file); }
    catch (e) { showToast(`Error en ${file.name}: ${e.message}`, 'error'); continue; }
    if (year === '2026' && data.registros && data.registros.length) {
      state.registros2026 = state.registros2026.concat(data.registros);
    }
    if (!data.rows.length) continue;

    if (!sharedMapping) {
      const { mapping, missing } = autoDetectMapping(data.headers);

      // Solo los campos críticos bloquean; los opcionales se dejan en null
      const critMissing = CRITICAL_FIELDS.filter(f => !mapping[f]);

      if (critMissing.length > 0) {
        // Antes de rendirnos: intentar mapeo por posición para archivos sin header claro
        const fallback = tryPositionalMapping(data.headers, data.rows);
        if (fallback) {
          sharedMapping = fallback;
        } else {
          // Último recurso: mostrar diálogo solo con los campos faltantes
          renderValidationSummary({
            valid: 0,
            warnings: 0,
            errors: critMissing.length,
            emptyRows: 0,
            duplicates: 0,
            warningItems: [],
            errorItems: critMissing.map((f, idx) => ({ row: idx + 1, msg: `columna requerida no detectada: ${FIELD_LABELS[f] || f}` })),
          });
          state.pendingLoad = { files: fileArr.slice(i), year, partialMapping: mapping };
          showMappingDialog(data.headers, mapping, year);
          return;
        }
      } else {
        for (const f of missing) if (!mapping[f]) mapping[f] = null;
        sharedMapping = mapping;
        saveMappingRules(sharedMapping);
      }
    }

    const normalized = data.rows
      .map(r => applyRowMapping(r, sharedMapping))
      .filter(isValidInventoryRow);
    const checked = validateInventoryRows(normalized, { sourceFile: file.name, importTimestamp: Date.now(), existingHashes: importHashes });
    validationSummaries.push(checked.summary);
    debugValidateRecountRows(checked.validRows, `${year} · ${file.name}`);
    allRows = allRows.concat(checked.validRows);
  }

  const validationSummary = mergeValidationSummaries(validationSummaries);
  renderValidationSummary(validationSummary);
  if (validationSummary.errors > 0 && !allRows.length) {
    showToast('Carga bloqueada: errores críticos en los datos.', 'error');
    return;
  }
  if (!allRows.length) { showToast('Sin datos válidos en los archivos.', 'error'); return; }

  if (year === '2025') state.data2025 = state.data2025.concat(allRows);
  else                 state.data2026 = state.data2026.concat(allRows);

  saveDataToIDB(year, year === '2025' ? state.data2025 : state.data2026);
  renderCoverageZonas(year);
  // Refrescar estados del plano hardcodeado si ya está renderizado
  if (document.querySelector('#planos-content .plano-patente')) {
    applyPatenteCellStates();
    Object.keys(PLANO_SHEETS || {}).forEach(renderPlanoZonaProgress);
  }
  updateSidebarStatus(year);
  _showLoadedYearCoverage(year);
  saveStateToLS();
  const n = allRows.length.toLocaleString('es-CL');
  showToast(`✓ ${n} registros cargados (${year})`, 'ok');
}

// Intenta mapear por posición si los headers no son reconocibles
function tryPositionalMapping(headers, rows) {
  if (!rows.length) return null;
  // Detectar si hay columnas numéricas que podrían ser unidades
  const numericCols = headers.filter(h => {
    const vals = rows.slice(0, 10).map(r => parseNum(r[h])).filter(v => v > 0);
    return vals.length >= 3;
  });
  if (numericCols.length < 2) return null;
  // Heurística: buscar col con nombre más textual para producto
  const textCols = headers.filter(h => {
    const vals = rows.slice(0, 5).map(r => (r[h] || '').toString());
    return vals.some(v => v.length > 5 && isNaN(parseFloat(v)));
  });
  if (!textCols.length || numericCols.length < 2) return null;
  return {
    producto:         textCols[0],
    unidades_sistema: numericCols[0],
    unidades_real:    numericCols[1],
    peso_sistema: null, peso_real: null,
    patente: null, zona: null, area: null,
    marca: null, familia: null, perfamilia: null, codigo: null,
  };
}

// ── MODAL DE MAPEO ─────────────────────────────────────────────
function showMappingDialog(headers, partialMapping, year) {
  const modal = document.getElementById('mapping-modal');
  document.getElementById('mapping-info').textContent =
    `No se detectaron automáticamente todas las columnas para el año ${year}. Asigna las columnas requeridas (marcadas con *):`;

  const options = ['— no disponible —', ...headers]
    .map(h => `<option value="${h}">${h}</option>`).join('');

  document.getElementById('mapping-fields').innerHTML =
    Object.entries(FIELD_LABELS).map(([field, label]) => {
      const cur = partialMapping[field] || '';
      return `
        <div class="mapping-row">
          <label class="${['producto','unidades_sistema','unidades_real'].includes(field) ? 'req' : ''}">${label}</label>
          <select id="map-${field}">
            ${['— no disponible —', ...headers].map(h =>
              `<option value="${h}"${h === cur ? ' selected' : ''}>${h}</option>`
            ).join('')}
          </select>
        </div>`;
    }).join('');

  modal.dataset.year = year;
  modal.classList.remove('hidden');

  document.getElementById('btn-apply-mapping').onclick = applyMapping;
}

async function applyMapping() {
  const modal = document.getElementById('mapping-modal');
  const year  = modal.dataset.year;

  const mapping = {};
  for (const field of Object.keys(FIELD_LABELS)) {
    const val = document.getElementById(`map-${field}`)?.value;
    mapping[field] = (val && val !== '— no disponible —') ? val : null;
  }

  const critical = ['producto','unidades_sistema','unidades_real'];
  const missingCrit = critical.filter(f => !mapping[f]);
  if (missingCrit.length) {
    showToast(`Debes asignar: ${missingCrit.map(f => FIELD_LABELS[f]).join(', ')}`, 'error');
    return;
  }

  cancelMapping();
  showToast('Aplicando mapeo…', 'info');

  const { files } = state.pendingLoad;
  let allRows = [];
  const validationSummaries = [];
  const importHashes = new Set([...(state.data2025 || []), ...(state.data2026 || [])].map(r => r.rowHash).filter(Boolean));
  saveMappingRules(mapping);
  for (const file of files) {
    let data;
    try { data = await readFileData(file); }
    catch { continue; }
    const rows = data.rows
      .map(r => applyRowMapping(r, mapping))
      .filter(isValidInventoryRow);
    const checked = validateInventoryRows(rows, { sourceFile: file.name, importTimestamp: Date.now(), existingHashes: importHashes });
    validationSummaries.push(checked.summary);
    debugValidateRecountRows(checked.validRows, `${year} · ${file.name} · mapping manual`);
    allRows = allRows.concat(checked.validRows);
  }

  const validationSummary = mergeValidationSummaries(validationSummaries);
  renderValidationSummary(validationSummary);
  if (validationSummary.errors > 0 && !allRows.length) {
    showToast('Carga bloqueada: errores críticos en los datos.', 'error');
    return;
  }
  if (!allRows.length) { showToast('Sin datos válidos en los archivos.', 'error'); return; }

  if (year === '2025') state.data2025 = state.data2025.concat(allRows);
  else                 state.data2026 = state.data2026.concat(allRows);

  state.pendingLoad = null;
  saveDataToIDB(year, year === '2025' ? state.data2025 : state.data2026);
  updateSidebarStatus(year);
  _showLoadedYearCoverage(year);
  saveStateToLS();
  showToast(`${allRows.length.toLocaleString('es-CL')} registros cargados (${year})`, 'ok');
}

function cancelMapping() {
  document.getElementById('mapping-modal').classList.add('hidden');
  state.pendingLoad = null;
}

function debugValidateRecountRows(rows, context = '') {
  const sample = [];
  let missingMarca = 0, missingSubfamilia = 0, moneyMismatches = 0;
  for (const r of rows) {
    if (!cleanText(r.marca)) missingMarca++;
    if (!cleanText(r.subfamilia)) missingSubfamilia++;
    const expected = (Number(r.dif_unidades) || 0) * (Number(r.costo) || 0);
    if (Number(r.costo) && Math.abs((Number(r.dif_peso) || 0) - expected) > 0.5) {
      moneyMismatches++;
      if (sample.length < 5) {
        sample.push({
          codigo: r.codigo,
          producto: r.producto,
          dif_unidades: r.dif_unidades,
          costo: r.costo,
          dif_peso_ui: r.dif_peso,
          dif_peso_esperado: expected,
        });
      }
    }
  }
  if (DEBUG) console.debug('[inventario] validación reconteo', {
    context,
    rows: rows.length,
    missingMarca,
    missingSubfamilia,
    moneyMismatches,
    sample,
  });
}

// ── ESTADO SIDEBAR ─────────────────────────────────────────────
function updateSidebarStatus(year, extra) {
  const count = year === '2025' ? state.data2025.length : state.data2026.length;
  const el = document.getElementById(`status-${year}`);
  el.innerHTML = `<strong>${count.toLocaleString('es-CL')}</strong> registros cargados`;
  el.className = 'upload-status ok';

  // Info resumen
  const info = document.getElementById('sidebar-info');
  const c25  = state.data2025.length;
  const c26  = state.data2026.length;
  const lines = [];
  if (c25) lines.push(`✓ 2025: <strong>${c25.toLocaleString('es-CL')}</strong>`);
  if (c26) lines.push(`✓ 2026: <strong>${c26.toLocaleString('es-CL')}</strong>`);
  info.innerHTML = lines.join('<br>');
}

// ── REGISTROS 2026 ─────────────────────────────────────────────
function renderRegistros2026() {
  const section = document.getElementById('registros-2026-section');
  if (!section) return;
  const rows = state.registros2026 || [];
  if (!rows.length) { section.style.display = 'none'; return; }
  section.style.display = '';

  const codQ     = (document.getElementById('reg-search-cod')?.value      || '').toLowerCase();
  const descQ    = (document.getElementById('reg-search-desc')?.value     || '').toLowerCase();
  const patenteQ = (document.getElementById('reg-filter-patente')?.value  || '').trim();
  const showDif  = document.getElementById('reg-show-dif')?.checked;

  let filtered = rows;
  if (codQ)     filtered = filtered.filter(r => String(r.CODIGO    || r.Codigo    || r.codigo    || '').toLowerCase().includes(codQ));
  if (descQ)    filtered = filtered.filter(r => String(r.PRODUCTOS || r.Productos || r.productos || '').toLowerCase().includes(descQ));
  if (patenteQ) filtered = filtered.filter(r => String(r.PATENTE   || r.Patente   || r.patente   || '') === patenteQ);

  // Resumen por código cuando hay búsqueda de código exacto
  const resEl = document.getElementById('reg-resumen-cod');
  if (resEl) {
    if (codQ && filtered.length) {
      const patentes = new Set(filtered.map(r => String(r.PATENTE || r.Patente || '')));
      const areas    = new Set(filtered.map(r => String(r.AREA || r.Area || '')));
      const totalConteo = filtered.reduce((s, r) => s + (Number(r.CONTEO || r.Conteo || 0) || 0), 0);
      resEl.textContent = `Código "${codQ.toUpperCase()}" — contado en ${patentes.size} patentes / ${areas.size} áreas / total CONTEO = ${totalConteo} uds`;
      resEl.classList.add('visible');
    } else {
      resEl.textContent = '';
      resEl.classList.remove('visible');
    }
  }

  // Lookup DIFERENCIA $ (dif_peso) desde TABLA_ANALISIS por código — un valor por código
  const difMap = {};
  for (const row of (state.data2026 || [])) {
    const cod = String(row.codigo || '').trim().toUpperCase();
    if (cod && !(cod in difMap)) difMap[cod] = row.dif_peso ?? 0;
  }

  const cols = ['FOLIO','CODIGO','PRODUCTOS','AREA','PATENTE','CONTEO','CONTO','INVENTARIADOR','FECHA'];
  if (showDif) cols.push('DIFERENCIA $');

  const thead = `<thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>`;
  const tbody = filtered.map(r => {
    const cells = cols.map(c => {
      if (c === 'DIFERENCIA $') {
        const cod = String(r.CODIGO || r.Codigo || r.codigo || '').trim().toUpperCase();
        const dif = cod in difMap ? difMap[cod] : null;
        if (dif === null) return `<td class="num">—</td>`;
        const cls = dif < 0 ? 'loss-cell' : dif > 0 ? 'gain-cell' : '';
        return `<td class="num ${cls}">${fmtMoney(dif)}</td>`;
      }
      const keys = [c, c.toLowerCase(), c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()];
      const val  = keys.reduce((v, k) => v !== undefined ? v : r[k], undefined) ?? '';
      return `<td>${val}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const table = document.getElementById('registros-2026-table');
  if (table) table.innerHTML = thead + `<tbody>${tbody}</tbody>`;
}

function exportRegistros2026Excel() {
  const rows = state.registros2026 || [];
  if (!rows.length) { showToast('Sin datos de REGISTROS para exportar.', 'error'); return; }

  const showDif = document.getElementById('reg-show-dif')?.checked;
  const cols = ['FOLIO','CODIGO','PRODUCTOS','AREA','PATENTE','CONTEO','CONTO','INVENTARIADOR','FECHA'];
  if (showDif) cols.push('DIFERENCIA $');

  // Mismo lookup desde TABLA_ANALISIS para el export
  const difMapExp = {};
  for (const row of (state.data2026 || [])) {
    const cod = String(row.codigo || '').trim().toUpperCase();
    if (cod && !(cod in difMapExp)) difMapExp[cod] = row.dif_peso ?? 0;
  }

  const header = cols;
  const data   = [header, ...rows.map(r => cols.map(c => {
    if (c === 'DIFERENCIA $') {
      const cod = String(r.CODIGO || r.Codigo || r.codigo || '').trim().toUpperCase();
      return cod in difMapExp ? difMapExp[cod] : '';
    }
    const keys = [c, c.toLowerCase(), c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()];
    return keys.reduce((v, k) => v !== undefined ? v : r[k], undefined) ?? '';
  }))];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const HDR = { font: { bold: true, color: { rgb: 'FFFFFFFF' } }, fill: { fgColor: { rgb: 'FF1E40AF' }, patternType: 'solid' }, alignment: { horizontal: 'center' }, border: { top:{style:'thin',color:{rgb:'FF000000'}}, bottom:{style:'thin',color:{rgb:'FF000000'}}, left:{style:'thin',color:{rgb:'FF000000'}}, right:{style:'thin',color:{rgb:'FF000000'}} } };
  const CEL = { border: { top:{style:'thin',color:{rgb:'FF000000'}}, bottom:{style:'thin',color:{rgb:'FF000000'}}, left:{style:'thin',color:{rgb:'FF000000'}}, right:{style:'thin',color:{rgb:'FF000000'}} }, fill: { patternType:'none' } };
  const widths = [8,12,50,8,10,10,10,20,20,14];
  ws['!cols'] = widths.map(w => ({ wch: w }));
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const hAddr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (ws[hAddr]) ws[hAddr].s = HDR;
  }
  for (let R = 1; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[addr]) ws[addr].s = CEL;
    }
  }
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'REGISTROS');
  XLSX.writeFile(wb, 'REGISTROS_2026.xlsx');
}

// ── FIN REGISTROS 2026 ─────────────────────────────────────────

function clearAllData() {
  if (!confirm('¿Limpiar todos los datos cargados?')) return;
  state.data2025 = [];
  state.data2026 = [];
  state.registros2026 = [];
  state.sortState = {};
  state.filters['2025']      = { bodega:'', marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'' };
  state.filters['2026']      = { bodega:'', marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'' };
  state.filters.comparative  = { marca:'', familia:'', perfamilia:'', zona:'', area:'' };
  state.searchText = { '2025': '', '2026': '' };
  state.chartMode  = { '2025': 'unidades', '2026': 'unidades' };
  state.drilldown = {
    '2025': { hiperfamilia:'', familia:'', marca:'' },
    '2026': { hiperfamilia:'', familia:'', marca:'' }
  };
  state.ddState = {
    '2025': { groupBy: 'familia', filterField: null, filterValue: null },
    '2026': { groupBy: 'familia', filterField: null, filterValue: null },
  };
  state.compCategoria = 'perfamilia';
  state.compDrill = { field: null, value: null };

  ['2025','2026'].forEach(y => {
    const el = document.getElementById(`status-${y}`);
    el.textContent = 'Sin archivos';
    el.className = 'upload-status';
    document.getElementById(`input-${y}`).value = '';
  });
  document.getElementById('sidebar-info').innerHTML = '';
  const vs = document.getElementById('validation-summary');
  if (vs) { vs.innerHTML = ''; vs.classList.add('hidden'); }

  Object.values(state.charts).forEach(c => c.destroy());
  state.charts = {};

  localStorage.removeItem(LS_STATE_KEY);
  clearIDB().catch(()=>{});

  const regSec = document.getElementById('registros-2026-section');
  if (regSec) regSec.style.display = 'none';

  showWelcome();
}

function clearAllApp() {
  if (!confirm('¿Borrar TODOS los datos cargados, caché y memoria?\n\nEsto limpia IndexedDB, localStorage y todos los datos en memoria.')) return;
  state.data2025 = [];
  state.data2026 = [];
  state.registros2026 = [];
  state.sortState = {};
  state.filters['2025']      = { bodega:'', marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'' };
  state.filters['2026']      = { bodega:'', marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'' };
  state.filters.comparative  = { marca:'', familia:'', perfamilia:'', zona:'', area:'' };
  state.searchText = { '2025': '', '2026': '' };
  state.chartMode  = { '2025': 'unidades', '2026': 'unidades' };
  state.drilldown = { '2025': { hiperfamilia:'', familia:'', marca:'' }, '2026': { hiperfamilia:'', familia:'', marca:'' } };
  state.ddState   = { '2025': { groupBy:'familia', filterField:null, filterValue:null }, '2026': { groupBy:'familia', filterField:null, filterValue:null } };
  state.ddFilters = { '2026': { cod:'', desc:'', sortByDif:false } };
  state.compCategoria = 'perfamilia';
  state.compDrill = { field:null, value:null };

  Object.values(state.charts).forEach(c => c.destroy());
  state.charts = {};

  window._patentesCargadas       = new Set();
  window._inventariadorPorPatente = new Map();

  ['2025','2026'].forEach(y => {
    const el = document.getElementById(`status-${y}`);
    if (el) { el.textContent = 'Sin archivos'; el.className = 'upload-status'; }
    const inp = document.getElementById(`input-${y}`);
    if (inp) inp.value = '';
  });
  document.getElementById('sidebar-info').innerHTML = '';
  const vs = document.getElementById('validation-summary');
  if (vs) { vs.innerHTML = ''; vs.classList.add('hidden'); }

  localStorage.removeItem(LS_STATE_KEY);
  clearIDB().catch(() => {});

  const regSec = document.getElementById('registros-2026-section');
  if (regSec) regSec.style.display = 'none';

  showWelcome();
  showToast('App limpiada — recargá para empezar de cero', 'ok');
}

// ── FILTRADO ───────────────────────────────────────────────────
function getFilteredData(year) {
  const src = year === '2025' ? state.data2025 : state.data2026;
  const f   = state.filters[year];
  const dd  = state.drilldown[year] || {};
  const q   = (state.searchText[year] || '').toLowerCase().trim();
  return src.filter(r => {
    // Embudo jerárquico (hiperfamilia → familia → marca)
    if (dd.hiperfamilia && r.perfamilia !== dd.hiperfamilia) return false;
    if (dd.familia      && r.familia    !== dd.familia)      return false;
    if (dd.marca        && r.marca      !== dd.marca)        return false;
    // Filtros del drawer (solo ubicación)
    if (f.bodega  && r.bodega  !== f.bodega)  return false;
    if (f.zona    && r.zona    !== f.zona)    return false;
    if (f.area    && r.area    !== f.area)    return false;
    if (f.patente && r.patente !== f.patente) return false;
    if (q) {
      const hayProd = (r.producto || '').toLowerCase().includes(q);
      const hayCod  = (r.codigo   || '').toLowerCase().includes(q);
      if (!hayProd && !hayCod) return false;
    }
    return true;
  });
}

let _searchDebounce;
function setSearch(year, text) {
  state.searchText[year] = text;
  clearTimeout(_searchDebounce);
  _searchDebounce = setTimeout(refreshView, 200);
}

function clearFilters(mode) {
  state.filters[mode] = { bodega:'', marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'' };
  state.searchText[mode] = '';
  const inp = document.getElementById(`search-${mode}`);
  if (inp) inp.value = '';
  if (mode === '2025' || mode === '2026') {
    state.drilldown[mode] = { hiperfamilia:'', familia:'', marca:'' };
    state.ddState[mode]   = { groupBy: 'familia', filterField: null, filterValue: null };
  }
  if (mode === 'comparative') {
    state.compDrill = { field: null, value: null };
    const bc = document.getElementById('comp-drill-breadcrumb');
    if (bc) bc.innerHTML = '';
    const dp = document.getElementById('comp-drill-products');
    if (dp) dp.innerHTML = '';
  }
  closeFilterPanel(mode);
  updateFilterBadge(mode);
  refreshView();
}

function getFilteredDataComp() {
  const f = state.filters.comparative;
  const fn = r =>
    (!f.marca      || r.marca      === f.marca)      &&
    (!f.familia    || r.familia    === f.familia)    &&
    (!f.perfamilia || r.perfamilia === f.perfamilia) &&
    (!f.zona       || r.zona       === f.zona)       &&
    (!f.area       || r.area       === f.area);
  return { d25: state.data2025.filter(fn), d26: state.data2026.filter(fn) };
}

// ── KPIs ───────────────────────────────────────────────────────
function calcKPIs(data) {
  let us=0, ur=0, ps=0, pr=0, adu=0, adp=0, du=0, dp=0;
  for (const r of data) {
    us += r.unidades_sistema; ur += r.unidades_real;
    ps += r.peso_sistema;     pr += r.peso_real;
    adu += r.abs_dif_unidades; adp += r.abs_dif_peso;
    du  += r.dif_unidades;    dp  += r.dif_peso;
  }
  return {
    us, ur, ps, pr, adu, adp, du, dp,
    count: data.length,
    exact_unid: Math.max(0, Math.min(100, (1 - adu / (us + 1e-6)) * 100)),
    exact_peso: Math.max(0, Math.min(100, (1 - adp / (ps + 1e-6)) * 100)),
  };
}

// ── RESUMEN MONETARIO ──────────────────────────────────────────
// Replica la lógica de TABLA_ANALISIS:
//   peso_sistema / peso_real son los valores en $ por producto.
//   DISPERSIÓN = |dif+| + |dif-|   (no es lo mismo que |dif total|)
function calcMonetarySummary(data) {
  let totalSistema = 0, totalConteo = 0, difPos = 0, difNeg = 0;
  for (const r of data) {
    const d = r.dif_peso || 0;
    totalSistema += r.peso_sistema || 0;
    totalConteo  += r.peso_real    || 0;
    if (d > 0) difPos += d;
    else if (d < 0) difNeg += d;
  }
  const difTotal   = totalConteo - totalSistema;
  const dispersion = Math.abs(difPos) + Math.abs(difNeg);
  const base       = totalSistema || 1;
  return {
    totalSistema, totalConteo, difTotal, difPos, difNeg, dispersion,
    pctDifTotal:   (difTotal   / base) * 100,
    pctDifPos:     (difPos     / base) * 100,
    pctDifNeg:     (difNeg     / base) * 100,
    pctDispersion: (dispersion / base) * 100,
  };
}

// ── COBERTURA DE CONTEO (banner informativo — no altera cálculos) ──────────────
const COUNT_EN_CURSO_PCT = 90;  // < 90% = inventario "en curso"
window._coverageModo = {};
window._coverageData = {};

/* Mide cuánto del inventario YA se contó (detecta conteo parcial). No cambia cálculos.
   'unidades': contados=Σ unidades_real / total=Σ unidades_sistema
   'valor'   : contados=Σ peso_real / total=Σ peso_sistema $
   pct = contados/total*100 */
function getCountCoverage(data, modo) {
  modo = modo || 'unidades';
  let contados = 0, total = 0;
  if (modo === 'valor') {
    for (const r of data) { total += r.peso_sistema || 0; contados += r.peso_real || 0; }
  } else {
    for (const r of data) { total += r.unidades_sistema || 0; contados += r.unidades_real || 0; }
  }
  const pct = total > 0 ? contados / total * 100 : 0;
  return { modo, contados, total, pct };
}

function _renderCoverageBanner(data, ctx) {
  const el = document.getElementById('inv-coverage-banner-' + ctx);
  if (!el) return;
  window._coverageData[ctx] = data;
  const modo = window._coverageModo[ctx] || 'unidades';
  const cov  = getCountCoverage(data, modo);
  if (cov.pct >= COUNT_EN_CURSO_PCT) { el.innerHTML = ''; return; }
  const fmtC  = modo === 'valor' ? fmtMoney(cov.contados) : fmt(cov.contados);
  const fmtT  = modo === 'valor' ? fmtMoney(cov.total)    : fmt(cov.total);
  const label = modo === 'valor' ? '$ contados' : 'unidades contadas';
  const prodContados = data.filter(r => (r.unidades_real || 0) > 0).length;
  const prodTotal    = data.length;
  const pctProd      = prodTotal > 0 ? (prodContados / prodTotal * 100) : 0;
  el.innerHTML = `
    <div class="inv-en-curso">
      <div class="inv-en-curso-icon">⏳</div>
      <div class="inv-en-curso-body">
        <div class="inv-en-curso-title">Inventario EN CURSO</div>
        <div class="inv-en-curso-main">Conteo parcial: <strong>${fmt(prodContados)}</strong> de <strong>${fmt(prodTotal)}</strong> productos contados <strong>(${pctProd.toFixed(1)}%)</strong>.</div>
        <div class="inv-en-curso-main" style="font-size:0.85em;color:#666">Unidades: <strong>${fmtC}</strong> de <strong>${fmtT}</strong> ${label} <strong>(${cov.pct.toFixed(1)}%)</strong>.</div>
        <div class="inv-en-curso-note">Los % de diferencia y dispersión aún <strong>NO son definitivos</strong>.</div>
      </div>
      <span class="inv-en-curso-toggle">
        <button onclick="_toggleCoverage('${ctx}','unidades')" class="${modo==='unidades'?'active':''}">Unidades</button>
        <button onclick="_toggleCoverage('${ctx}','valor')"    class="${modo==='valor'?'active':''}">Valor</button>
      </span>
    </div>`;
}

function _toggleCoverage(ctx, modo) {
  window._coverageModo[ctx] = modo;
  const data = window._coverageData[ctx];
  if (data) _renderCoverageBanner(data, ctx);
}

function _coveragePatenteKey(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  return s.match(/^(\d+)/)?.[1] || s.toUpperCase();
}

function _coverageHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

// Fuente 1: Set de patentes contadas desde hojas de registro (readFileData).
// Fuente 2: fallback desde row.patente si no existe Fuente 1.
// Devuelve null si no hay datos cargados.
function getPlanoContados() {
  const f1 = window._patentesCargadas;
  if (f1 instanceof Set && f1.size > 0) return f1;
  const all = [...(state.data2025 || []), ...(state.data2026 || [])];
  if (!all.length) return null;
  const s = new Set();
  all.forEach(r => {
    const p = String(r.patente || '').trim();
    if (!p) return;
    s.add(p.toUpperCase());
    const num = p.match(/^(\d+)/)?.[1];
    if (num) s.add(num);
  });
  return s.size > 0 ? s : null;
}

function _buildCoverageZonas() {
  const universo = Array.isArray(planosPatentes) ? planosPatentes : [];
  const contados = getPlanoContados();
  if (!universo.length) return { ready: false, groups: [], total: 0, counted: 0, pct: 0 };
  const bySala = new Map();

  universo.forEach(p => {
    const sala = p.zona || p.area || 'Sin sala';
    const patente = String(p.patente || '').trim();
    if (!patente) return;
    if (!bySala.has(sala)) bySala.set(sala, { sala, total: 0, counted: 0, missing: [] });
    const g = bySala.get(sala);
    const key = _coveragePatenteKey(patente);
    const full = patente.toUpperCase();
    const isCounted = !!contados && (contados.has(full) || (key && contados.has(key)));
    g.total++;
    if (isCounted) g.counted++;
    else g.missing.push(patente);
  });

  const groups = [...bySala.values()].map(g => ({
    ...g,
    pct: g.total ? Math.round(g.counted / g.total * 100) : 0,
    missing: g.missing.sort((a, b) => parseInt(a) - parseInt(b)),
  }));
  const total = groups.reduce((s, g) => s + g.total, 0);
  const counted = groups.reduce((s, g) => s + g.counted, 0);
  const pct = total ? Math.round(counted / total * 100) : 0;
  return { ready: !!contados, groups, total, counted, pct };
}

function renderCoverageZonas(year) {
  const el = document.getElementById('inv-coverage-zonas-' + year);
  if (!el) return;
  const cov = _buildCoverageZonas();
  if (!cov.total) {
    el.innerHTML = `
      <div class="inv-zonas-card inv-zonas-empty">
        <div class="inv-zonas-head">
          <div class="inv-zonas-icon">📍</div>
          <div>
            <h3>Avance de conteo: Patentes y Zonas</h3>
            <p>Carga el archivo de Planos para cruzar el universo total de patentes con lo contado en REGISTROS.</p>
          </div>
        </div>
      </div>`;
    return;
  }

  const dot = cov.pct >= 90 ? 'ok' : cov.pct >= 70 ? 'warn' : 'bad';
  const detail = cov.groups.map(g => {
    const cls = g.pct >= 90 ? 'ok' : g.pct >= 70 ? 'warn' : 'bad';
    const missing = g.missing.length
      ? g.missing.slice(0, 36).map(p => `<span>${_coverageHtml(p)}</span>`).join('')
      : '<em>Sin pendientes</em>';
    const more = g.missing.length > 36 ? `<small>+${g.missing.length - 36} más</small>` : '';
    return `
      <div class="inv-zona-row">
        <div class="inv-zona-row-top">
          <strong>${_coverageHtml(g.sala)}</strong>
          <span class="inv-zona-pill ${cls}">${g.counted}/${g.total} · ${g.pct}%</span>
        </div>
        <div class="inv-zona-missing">${missing}${more}</div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="inv-zonas-card">
      <div class="inv-zonas-head">
        <div class="inv-zonas-icon">📍</div>
        <div class="inv-zonas-title">
          <h3>Avance de conteo: Patentes y Zonas</h3>
          <p>Terminar conteo → pasar a reconteo con base completa.</p>
        </div>
        <div class="inv-zonas-total">
          <span class="inv-zonas-dot ${dot}"></span>
          <strong>${cov.counted} de ${cov.total}</strong>
          <small>patentes contadas (${cov.pct}%)</small>
        </div>
      </div>
      <div class="inv-zonas-grid">${detail}</div>
    </div>`;
}

function _highlightCoveragePanels(year) {
  setTimeout(() => {
    const panels = [
      document.querySelector(`#inv-coverage-banner-${year} .inv-en-curso`),
      document.querySelector(`#inv-coverage-zonas-${year} .inv-zonas-card`),
    ].filter(Boolean);
    if (!panels.length) return;
    panels.forEach(p => p.classList.add('coverage-pulse'));
    panels[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => panels.forEach(p => p.classList.remove('coverage-pulse')), 2200);
  }, 250);
}

// ── AGREGACIÓN ─────────────────────────────────────────────────
function aggregateBy(data, ...fields) {
  const map = new Map();
  for (const r of data) {
    const key = fields.map(f => r[f] || '—').join('\x00');
    if (!map.has(key)) {
      const fd = Object.fromEntries(fields.map(f => [f, r[f] || '—']));
      map.set(key, { key, fd, us:0, ur:0, ps:0, pr:0, adu:0, adp:0, du:0, dp:0, count:0 });
    }
    const g = map.get(key);
    g.us  += r.unidades_sistema; g.ur  += r.unidades_real;
    g.ps  += r.peso_sistema;     g.pr  += r.peso_real;
    g.adu += r.abs_dif_unidades; g.adp += r.abs_dif_peso;
    g.du  += r.dif_unidades;     g.dp  += r.dif_peso;
    g.count++;
  }
  return Array.from(map.values()).map(g => ({
    ...g,
    exact_unid: Math.max(0, Math.min(100, (1 - g.adu / (g.us + 1e-6)) * 100)),
    exact_peso: Math.max(0, Math.min(100, (1 - g.adp / (g.ps + 1e-6)) * 100)),
  }));
}

// ── RENDER KPIs ────────────────────────────────────────────────
function renderKPIs(year, data) {
  const k = calcKPIs(data);
  const semU = semaforo(k.exact_unid);
  const semP = semaforo(k.exact_peso);
  document.getElementById(`kpi-${year}`).innerHTML = `
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">TOTAL UNID. SISTEMA</div>
      <div class="kpi-value">${fmt(k.us)}</div>
      <div class="kpi-sub">stock en sistema</div>
    </div>
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">TOTAL UNID. FÍSICO</div>
      <div class="kpi-value">${fmt(k.ur)}</div>
      <div class="kpi-sub">conteo físico real</div>
    </div>
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">DIFERENCIA UNIDADES</div>
      <div class="kpi-value">${k.adu >= 0 ? '+' : ''}${fmt(k.adu)}</div>
      <div class="kpi-sub">STOCK SISTEMA: ${fmt(k.us)} / CONTEO: ${fmt(k.ur)}</div>
    </div>
    <div class="kpi-card ${semU}">
      <div class="kpi-label">EXACTITUD UNIDADES</div>
      <div class="kpi-value">${fmtPct(k.exact_unid)}%</div>
      <div class="kpi-sub">${semLabel(semU)}</div>
    </div>
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">DIFERENCIA $</div>
      <div class="kpi-value">${k.adp >= 0 ? '+' : ''}${fmt(k.adp)}</div>
      <div class="kpi-sub">VALOR SISTEMA: $${fmt(k.ps)} / VALOR CONTEO: $${fmt(k.pr)}</div>
    </div>
    <div class="kpi-card ${semP}">
      <div class="kpi-label">EXACTITUD $</div>
      <div class="kpi-value">${fmtPct(k.exact_peso)}%</div>
      <div class="kpi-sub">${semLabel(semP)}</div>
    </div>`;
}

function renderKPIsComp(d25, d26) {
  const k25 = calcKPIs(d25);
  const k26 = calcKPIs(d26);
  const dU  = k26.exact_unid - k25.exact_unid;
  const dP  = k26.exact_peso - k25.exact_peso;
  document.getElementById('kpi-comparative').innerHTML = `
    <div class="kpi-card ${semaforo(k25.exact_unid)}">
      <div class="kpi-label">Exactitud Unid. 2025</div>
      <div class="kpi-value">${fmtPct(k25.exact_unid)}%</div>
      <div class="kpi-sub">${fmt(k25.count)} registros</div>
    </div>
    <div class="kpi-card ${semaforo(k26.exact_unid)}">
      <div class="kpi-label">Exactitud Unid. 2026</div>
      <div class="kpi-value">${fmtPct(k26.exact_unid)}%</div>
      <div class="kpi-sub">Δ <span class="${dU>=0?'delta-pos':'delta-neg'}">${dU>=0?'+':''}${fmtPct(dU)} pp</span></div>
    </div>
    <div class="kpi-card ${semaforo(k25.exact_peso)}">
      <div class="kpi-label">Exactitud Peso 2025</div>
      <div class="kpi-value">${fmtPct(k25.exact_peso)}%</div>
      <div class="kpi-sub">${fmt(k25.count)} registros</div>
    </div>
    <div class="kpi-card ${semaforo(k26.exact_peso)}">
      <div class="kpi-label">Exactitud Peso 2026</div>
      <div class="kpi-value">${fmtPct(k26.exact_peso)}%</div>
      <div class="kpi-sub">Δ <span class="${dP>=0?'delta-pos':'delta-neg'}">${dP>=0?'+':''}${fmtPct(dP)} pp</span></div>
    </div>`;
}

// ── CONTEO CORRECTOS / FALTANTES / SOBRANTES ──────────────────
function calcCountSummary(data) {
  let correctos = 0, faltantes = 0, sobrantes = 0;
  for (const r of data) {
    const d = r.dif_unidades || 0;
    if (d === 0)      correctos++;
    else if (d < 0)   faltantes++;
    else              sobrantes++;
  }
  const total = data.length || 1;
  return { total: data.length, correctos, faltantes, sobrantes,
           pctCorr: (correctos / total) * 100,
           pctFalt: (faltantes / total) * 100,
           pctSobr: (sobrantes / total) * 100 };
}

function renderCountKPIs(year, data) {
  const el = document.getElementById(`kpi-count-${year}`);
  if (!el) return;
  if (!data.length) { el.innerHTML = ''; return; }
  const c = calcCountSummary(data);
  el.innerHTML = `
    <div class="kpi-count-header">📦 Conteo Total: <strong>${fmt(c.total)}</strong> productos</div>
    <div class="kpi-count-grid">
      <div class="kpi-count-card count-corr">
        <div class="kpi-count-label">PRODUCTOS EXACTOS</div>
        <div class="kpi-count-value">${fmt(c.correctos)}</div>
        <div class="kpi-count-pct">${fmtPct(c.pctCorr)}%</div>
      </div>
      <div class="kpi-count-card count-falt" style="background:#fff0f0">
        <div class="kpi-count-label">PRODUCTOS FALTANTES</div>
        <div class="kpi-count-value">${fmt(c.faltantes)}</div>
        <div class="kpi-count-pct">${fmtPct(c.pctFalt)}%</div>
      </div>
      <div class="kpi-count-card count-sobr" style="background:#f0fff4">
        <div class="kpi-count-label">PRODUCTOS SOBRANTES</div>
        <div class="kpi-count-value">${fmt(c.sobrantes)}</div>
        <div class="kpi-count-pct">${fmtPct(c.pctSobr)}%</div>
      </div>
    </div>`;
}

// ── RENDER KPIs MONETARIOS ─────────────────────────────────────
// Muestra el bloque de dispersión en pesos usando peso_sistema/pesoreal como valores $.
// Si no hay datos de peso (todos en 0) el bloque no se muestra para no confundir.
function renderMonetaryKPIs(year, data) {
  const el = document.getElementById(`kpi-monetary-${year}`);
  if (!el) return;

  const m = calcMonetarySummary(data);
  if (!m.totalSistema && !m.totalConteo) { el.innerHTML = ''; return; }

  const pctSign = v => `${v >= 0 ? '+' : ''}${fmtPct(v)}%`;
  const pctCls  = v => v <= 0 ? '' : 'mon-warn';  // para diferencia negativa es "normal"

  el.innerHTML = `
    <div class="kpi-monetary-header">💰 Dispersión en $ (Peso monetario)</div>
    <div class="kpi-monetary-grid">
      <div class="kpi-mon-card">
        <div class="kpi-mon-label">TOTAL $ SISTEMA</div>
        <div class="kpi-mon-value">${fmtMoney(m.totalSistema)}</div>
        <div class="kpi-mon-pct">valor en sistema</div>
      </div>
      <div class="kpi-mon-card">
        <div class="kpi-mon-label">TOTAL $ FÍSICO</div>
        <div class="kpi-mon-value">${fmtMoney(m.totalConteo)}</div>
        <div class="kpi-mon-pct">valor físico real</div>
      </div>
      <div class="kpi-mon-card ${m.difTotal < 0 ? 'mon-neg' : 'mon-pos'}">
        <div class="kpi-mon-label">DIFERENCIA $</div>
        <div class="kpi-mon-value">${fmtMoney(m.difTotal)}</div>
        <div class="kpi-mon-pct">${pctSign(m.pctDifTotal)} sobre sistema</div>
      </div>
      <div class="kpi-mon-card mon-pos">
        <div class="kpi-mon-label">DIFERENCIAS + SOBRANTES</div>
        <div class="kpi-mon-value">${fmtMoney(m.difPos)}</div>
        <div class="kpi-mon-pct">${pctSign(m.pctDifPos)} sobre sistema</div>
      </div>
      <div class="kpi-mon-card mon-neg">
        <div class="kpi-mon-label">DIFERENCIAS − FALTANTES</div>
        <div class="kpi-mon-value">${fmtMoney(m.difNeg)}</div>
        <div class="kpi-mon-pct">${fmtPct(m.pctDifNeg)}% sobre sistema</div>
      </div>
      <div class="kpi-mon-card mon-disp">
        <div class="kpi-mon-label">DISPERSIÓN TOTAL</div>
        <div class="kpi-mon-value">${fmtMoney(m.dispersion)}</div>
        <div class="kpi-mon-pct">dispersión: $${fmt(m.dispersion)}</div>
      </div>
    </div>`;
}

// ── RENDER FILTROS (segmentación) ─────────────────────────────
function renderFilters(mode) {
  const data = mode === 'comparative'
    ? [...state.data2025, ...state.data2026]
    : (mode === '2025' ? state.data2025 : state.data2026);

  const uniq = field => [...new Set(data.map(r => r[field]).filter(Boolean))].sort();
  const f    = state.filters[mode];
  const q    = state.searchText[mode] || '';

  // Modos year: solo filtros de ubicación (embudo maneja la jerarquía)
  const groups = mode === 'comparative'
    ? [['perfamilia','Hiperfamilia'],['marca','Marca'],['familia','Familia'],['zona','Zona'],['area','Área']]
    : [['zona','Zona'],['area','Área'],['patente','Patente'],['bodega','Bodega EM']];

  const anyActive = groups.some(([field]) => f[field]) || q;

  const searchRow = mode !== 'comparative' ? `
    <div class="seg-search-row">
      <span class="seg-search-icon">🔍</span>
      <input class="seg-search-input" id="search-${mode}" type="text"
             placeholder="Buscar por descripción o código..."
             value="${q.replace(/"/g,'&quot;')}"
             oninput="setSearch('${mode}',this.value)">
      ${anyActive ? `<button class="btn btn-xs seg-clear-btn" onclick="clearFilters('${mode}')">✕ Limpiar</button>` : ''}
    </div>` : (anyActive ? `<div class="seg-search-row" style="justify-content:flex-end">
      <button class="btn btn-xs seg-clear-btn" onclick="clearFilters('${mode}')">✕ Limpiar filtros</button>
    </div>` : '');

  const groupsHtml = groups.map(([field, label]) => {
    const values = uniq(field);
    if (!values.length) return '';
    const chips = ['',...values].map(v => {
      const isAll  = v === '';
      const active = isAll ? !f[field] : f[field] === v;
      const lbl    = isAll ? 'Todos' : v;
      // Escapar comillas simples para onclick seguro
      const safeV  = v.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      return `<span class="seg-chip${active?' seg-active':''}"
                onclick="setFilter('${mode}','${field}','${safeV}')"
                title="${lbl}">${lbl}</span>`;
    }).join('');
    return `<div class="seg-group">
      <div class="seg-group-label">${label}</div>
      <div class="seg-chips">${chips}</div>
    </div>`;
  }).join('');

  document.getElementById(`filters-${mode}`).innerHTML = `${searchRow}${groupsHtml}`;
  updateFilterBadge(mode);

  // Espejo en vista v2 (sin input de búsqueda para evitar IDs duplicados)
  const v2el = document.getElementById(`filters-${mode}v2`);
  if (v2el) {
    const clearBtn = anyActive
      ? `<div class="seg-search-row" style="justify-content:flex-end">
           <button class="btn btn-xs seg-clear-btn" onclick="clearFilters('${mode}')">✕ Limpiar filtros</button>
         </div>` : '';
    v2el.innerHTML = clearBtn + groupsHtml;
  }
}

function setFilter(mode, field, value) {
  // Toggle: clic en chip activo → desactiva
  state.filters[mode][field] = (state.filters[mode][field] === value && value !== '') ? '' : value;
  refreshView();
}

// ── CHARTS ─────────────────────────────────────────────────────
const COLORS = ['#E85D04','#1A56DB','#16a34a','#d97706','#9333ea',
                '#06b6d4','#ec4899','#84cc16','#f97316','#6366f1',
                '#0891b2','#7c3aed','#059669','#b45309','#db2777'];

function destroyChart(id) {
  if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
}

function makeChart(id, config) {
  destroyChart(id);
  const ctx = document.getElementById(id);
  if (!ctx) return;
  state.charts[id] = new Chart(ctx, config);
}

function barChart(id, labels, values, label, color, onClickCb) {
  const colors = values.map(v => v < 0 ? '#dc2626' : v > 0 ? (color || COLORS[0]) : '#94a3b8');
  const opts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false },
      tooltip: { callbacks: { label: ctx => `${label}: ${fmt(ctx.raw)}` } }
    },
    scales: { y: { beginAtZero: true, ticks: { font: { size: 11 } } },
              x: { ticks: { font: { size: 10 }, maxRotation: 40 } } }
  };
  if (onClickCb) {
    opts.onClick = (evt, elements) => { if (elements.length) onClickCb(labels[elements[0].index]); };
  }
  makeChart(id, {
    type: 'bar',
    data: {
      labels: labels.map(l => truncate(l, 18)),
      datasets: [{ label, data: values.map(Math.abs), backgroundColor: colors, borderRadius: 4, borderSkipped: false }]
    },
    options: opts
  });
}

function groupedBarChart(id, labels, datasets) {
  makeChart(id, {
    type: 'bar',
    data: {
      labels: labels.map(l => truncate(l, 16)),
      datasets: datasets.map((d, i) => ({
        ...d, backgroundColor: COLORS[i % COLORS.length],
        borderRadius: 3, borderSkipped: false
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
      scales: { y: { beginAtZero: true, ticks: { font: { size: 11 } } },
                x: { ticks: { font: { size: 10 }, maxRotation: 40 } } }
    }
  });
}

function fmtCompact(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return `$${(v/1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(v/1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function donutChart(id, labels, values, title) {
  const filtered = labels.map((l, i) => ({ l, v: Math.abs(values[i]) })).filter(x => x.v > 0);
  if (!filtered.length) { destroyChart(id); return; }
  makeChart(id, {
    type: 'doughnut',
    data: {
      labels: filtered.map(x => truncate(x.l || '(sin cat.)', 18)),
      datasets: [{ data: filtered.map(x => x.v),
        backgroundColor: COLORS.slice(0, filtered.length),
        borderWidth: 2, borderColor: '#fff',
        hoverOffset: 8 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: { size: 10 }, padding: 6, boxWidth: 12,
            generateLabels: (chart) => {
              const ds = chart.data.datasets[0];
              const tot = ds.data.reduce((a,b) => a+b, 0);
              return chart.data.labels.map((lbl, i) => {
                const val = ds.data[i];
                const pct = tot ? ((val/tot)*100).toFixed(0) : 0;
                return {
                  text: `${lbl}: ${fmtCompact(val)} (${pct}%)`,
                  fillStyle: ds.backgroundColor[i],
                  strokeStyle: '#fff', lineWidth: 2, hidden: false, index: i, datasetIndex: 0
                };
              });
            }
          }
        },
        tooltip: { callbacks: { label: ctx => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const pct   = total ? ((ctx.raw / total) * 100).toFixed(1) : 0;
          return `${ctx.label}: ${fmtMoney(ctx.raw)} (${pct}%)`;
        }}}
      },
      cutout: '55%',
    }
  });
}

// Modo de gráficos: unidades | pesos
function setChartMode(year, mode) {
  state.chartMode[year] = mode;
  const data = getFilteredData(year);
  renderChartModeBar(year);
  renderCharts(year, data);
}

function renderChartModeBar(year) {
  const el = document.getElementById(`charts-mode-bar-${year}`);
  if (!el) return;
  const m = state.chartMode[year] || 'unidades';
  el.innerHTML = `
    <span class="charts-mode-label">Ver gráficos en:</span>
    <button class="mode-tog-btn${m==='unidades'?' mode-tog-active':''}"
            onclick="setChartMode('${year}','unidades')">📦 Unidades</button>
    <button class="mode-tog-btn${m==='pesos'?' mode-tog-active':''}"
            onclick="setChartMode('${year}','pesos')">💰 Valor $</button>`;
}

function renderCharts(year, data) {
  const m = state.chartMode[year] || 'unidades';
  renderChartModeBar(year);

  if (m === 'pesos') {
    // ── MODO $ ────────────────────────────────────────────────
    // Gráfico 1: Hiperfamilia vs dispersión $
    const byHiper = aggregateBy(data, 'perfamilia').sort((a,b) => b.adp - a.adp).slice(0,10);
    const h4fam = document.querySelector(`#chart-familia-unid-${year}`)?.closest('.chart-card')?.querySelector('h4');
    if (h4fam) h4fam.textContent = 'Dispersión $ por Hiperfamilia (Top 10)';
    barChart(`chart-familia-unid-${year}`,
      byHiper.map(r => r.fd.perfamilia || '(sin cat.)'), byHiper.map(r => r.dp),
      'Dif. $ (abs)', COLORS[0],
      (lbl) => drillIntoGroup(year, 'perfamilia', lbl));

    // Gráfico 2: Marca vs dispersión $
    const byMarca = aggregateBy(data, 'marca').sort((a,b) => b.adp - a.adp).slice(0,10);
    const h4marca = document.querySelector(`#chart-marca-peso-${year}`)?.closest('.chart-card')?.querySelector('h4');
    if (h4marca) h4marca.textContent = 'Dispersión $ por Marca (Top 10)';
    barChart(`chart-marca-peso-${year}`,
      byMarca.map(r => r.fd.marca || '(sin marca)'), byMarca.map(r => r.dp),
      'Dif. $ (abs)', COLORS[1],
      (lbl) => drillIntoGroup(year, 'marca', lbl));

    // Gráfico 3: Donut Hiperfamilia $
    const byHiperD = aggregateBy(data, 'perfamilia').sort((a,b) => b.adp - a.adp).slice(0,12);
    const h4pie1 = document.querySelector(`#chart-pie-hiper-${year}`)?.closest('.chart-card')?.querySelector('h4');
    if (h4pie1) h4pie1.textContent = 'Dispersión $ por Hiperfamilia';
    donutChart(`chart-pie-hiper-${year}`, byHiperD.map(r => r.fd.perfamilia), byHiperD.map(r => r.adp), 'Dispersión $');

    // Gráfico 5: Donut Marca $
    const byMarcaD = aggregateBy(data, 'marca').sort((a,b) => b.adp - a.adp).slice(0,12);
    const h4pie2 = document.querySelector(`#chart-pie-marca-${year}`)?.closest('.chart-card')?.querySelector('h4');
    if (h4pie2) h4pie2.textContent = 'Dispersión $ por Marca';
    donutChart(`chart-pie-marca-${year}`, byMarcaD.map(r => r.fd.marca), byMarcaD.map(r => r.adp), 'Dispersión $');

  } else {
    // ── MODO UNIDADES ─────────────────────────────────────────
    // Gráfico 1: Familia vs dif unidades
    const byFam = aggregateBy(data, 'familia').sort((a,b) => b.adu - a.adu).slice(0,10);
    const h4fam = document.querySelector(`#chart-familia-unid-${year}`)?.closest('.chart-card')?.querySelector('h4');
    if (h4fam) h4fam.textContent = 'Diferencia Unidades por Familia (Top 10)';
    barChart(`chart-familia-unid-${year}`,
      byFam.map(r => r.fd.familia || '(sin familia)'), byFam.map(r => r.du),
      'Dif. Unidades', COLORS[0],
      (lbl) => drillIntoGroup(year, 'familia', lbl));

    // Gráfico 2: Marca vs dif unidades
    const byMarca = aggregateBy(data, 'marca').sort((a,b) => b.adu - a.adu).slice(0,10);
    const h4marca = document.querySelector(`#chart-marca-peso-${year}`)?.closest('.chart-card')?.querySelector('h4');
    if (h4marca) h4marca.textContent = 'Diferencia Unidades por Marca (Top 10)';
    barChart(`chart-marca-peso-${year}`,
      byMarca.map(r => r.fd.marca || '(sin marca)'), byMarca.map(r => r.du),
      'Dif. Unidades', COLORS[1],
      (lbl) => drillIntoGroup(year, 'marca', lbl));

    // Gráfico 3: Donut Hiperfamilia unidades
    const byHiperD = aggregateBy(data, 'perfamilia').sort((a,b) => b.adu - a.adu).slice(0,12);
    const h4pie1 = document.querySelector(`#chart-pie-hiper-${year}`)?.closest('.chart-card')?.querySelector('h4');
    if (h4pie1) h4pie1.textContent = 'Diferencia Unidades por Hiperfamilia';
    donutChart(`chart-pie-hiper-${year}`, byHiperD.map(r => r.fd.perfamilia), byHiperD.map(r => r.adu), 'Dif. Unidades');

    // Gráfico 5: Donut Marca unidades
    const byMarcaD = aggregateBy(data, 'marca').sort((a,b) => b.adu - a.adu).slice(0,12);
    const h4pie2 = document.querySelector(`#chart-pie-marca-${year}`)?.closest('.chart-card')?.querySelector('h4');
    if (h4pie2) h4pie2.textContent = 'Diferencia Unidades por Marca';
    donutChart(`chart-pie-marca-${year}`, byMarcaD.map(r => r.fd.marca), byMarcaD.map(r => r.adu), 'Dif. Unidades');
  }
}

function renderChartsComp(d25, d26) {
  const idx25 = toIndex(aggregateBy(d25, 'familia'), 'familia');
  const idx26 = toIndex(aggregateBy(d26, 'familia'), 'familia');
  const allFam = [...new Set([...Object.keys(idx25), ...Object.keys(idx26)])];
  const top = allFam
    .sort((a,b) => ((idx25[b]?.adu||0)+(idx26[b]?.adu||0)) - ((idx25[a]?.adu||0)+(idx26[a]?.adu||0)))
    .slice(0, 12);

  groupedBarChart('chart-comp-familia-unid', top, [
    { label: 'Dif. Unid 2025', data: top.map(f => idx25[f]?.adu || 0) },
    { label: 'Dif. Unid 2026', data: top.map(f => idx26[f]?.adu || 0) },
  ]);

  groupedBarChart('chart-comp-familia-exact', top, [
    { label: '% Exactitud 2025', data: top.map(f => idx25[f]?.exact_unid || 0) },
    { label: '% Exactitud 2026', data: top.map(f => idx26[f]?.exact_unid || 0) },
  ]);
}

function toIndex(arr, field) {
  return Object.fromEntries(arr.map(r => [r.fd[field], r]));
}

// ── RENDER TABLAS ──────────────────────────────────────────────
function buildTable(tableId, headers, rows) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const ths = headers.map((h, i) =>
    `<th data-col="${i}" onclick="sortTable('${tableId}',${i})">${h}</th>`).join('');
  const trs = rows.map(row =>
    `<tr>${row.map(cell => {
      if (cell && typeof cell === 'object') {
        return `<td class="${cell.cls||''}" title="${cell.v??''}">${cell.v??''}</td>`;
      }
      return `<td title="${cell??''}">${cell??''}</td>`;
    }).join('')}</tr>`).join('');
  table.innerHTML = `<thead><tr>${ths}</tr></thead><tbody>${trs}</tbody>`;
}

const cNum  = (v, cls='num') => ({ v: fmt(v), cls });
const cPct  = v => ({ v: `${fmtPct(v)}%`, cls: `num ${semaforo(v).replace('kpi-','pct-')}` });
const cDelta = v => ({ v: `${v>=0?'+':''}${fmtPct(v)} pp`, cls: `num ${v>=0?'delta-pos':'delta-neg'}` });
const trunc = (s, n=40) => (s||'').length > n ? s.substring(0,n)+'…' : (s||'');

// ── DESGLOSE INTERACTIVO ───────────────────────────────────────
const DD_GROUPS = [
  { key: 'familia',    label: 'Familia' },
  { key: 'marca',      label: 'Marca' },
  { key: 'perfamilia', label: 'Hiperfamilia' },
  { key: 'subfamilia', label: 'Subfamilia' },
];

function renderDrilldown(year, data) {
  const el = document.getElementById(`drilldown-${year}`);
  if (!el) return;
  const dd = state.ddState[year];

  const levelBtns = DD_GROUPS.map(g =>
    `<button class="dd-level-btn${!dd.filterField && dd.groupBy === g.key ? ' dd-active' : ''}"
     onclick="setDrilldownGroup('${year}','${g.key}')">${g.label}</button>`
  ).join('');

  let controlsHtml, tableHtml;

  if (dd.filterField) {
    const gLabel   = DD_GROUPS.find(g => g.key === dd.filterField)?.label || dd.filterField;
    const filtered = data.filter(r => (r[dd.filterField] || '—') === dd.filterValue);
    const sorted   = [...filtered].sort((a,b) => b.abs_dif_peso - a.abs_dif_peso);
    controlsHtml = `
      <div class="dd-breadcrumb">
        <button class="dd-back-btn" onclick="clearDrilldownFilter('${year}')">← Volver al resumen</button>
        <span class="dd-crumb-sep">›</span>
        <span class="dd-crumb-current">${gLabel}: <strong>${dd.filterValue}</strong></span>
        <span class="dd-crumb-count">${sorted.length} productos</span>
      </div>`;
    tableHtml = buildDDProductTable(sorted, year);
  } else {
    const gLabel  = DD_GROUPS.find(g => g.key === dd.groupBy)?.label || dd.groupBy;
    const groups  = aggregateBy(data, dd.groupBy).sort((a,b) => b.adp - a.adp);
    controlsHtml = `
      <div class="dd-level-selector">
        <span class="dd-level-label">Agrupar por:</span>
        ${levelBtns}
      </div>
      <div class="dd-help">Haz clic en una fila o en una barra del gráfico para ver los productos de ese grupo</div>`;
    tableHtml = buildDDGroupTable(year, groups, dd.groupBy, gLabel);
  }

  el.innerHTML = `
    <div class="dd-section">
      <div class="dd-section-header">
        <h3 class="dd-title">📊 Desglose por diferencias</h3>
        <button class="btn btn-xs" onclick="exportDrilldownTable('${year}')">⬇ xlsx</button>
      </div>
      ${controlsHtml}
      <div class="table-scroll" id="dd-tbl-${year}">${tableHtml}</div>
    </div>`;
}

function buildDDGroupTable(year, groups, groupBy, groupLabel) {
  if (!groups.length) return '<p class="no-data">Sin datos para mostrar.</p>';
  const df = (state.ddFilters && state.ddFilters[year]) || {};
  const descQ = (df.desc || '').toLowerCase();
  let filtered = groups;
  if (descQ) filtered = filtered.filter(g => (g.fd[groupBy] || '').toLowerCase().includes(descQ));
  if (df.sortByDif === 'desc') filtered = [...filtered].sort((a, b) => b.adp - a.adp);
  else if (df.sortByDif === 'asc') filtered = [...filtered].sort((a, b) => a.adp - b.adp);
  const rows = filtered.map(g => {
    const val    = g.fd[groupBy] || '(sin clasificar)';
    const valEsc = val.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const signU  = g.du >= 0 ? '+' : '';
    const signP  = g.dp >= 0 ? '+' : '';
    const clsU   = g.du < 0 ? 'loss-cell' : g.du > 0 ? 'gain-cell' : '';
    const clsP   = g.dp < 0 ? 'loss-cell' : g.dp > 0 ? 'gain-cell' : '';
    return `<tr style="cursor:pointer" onclick="drillIntoGroup('${year}','${groupBy}','${valEsc}')">
      <td class="dd-group-name">${val}</td>
      <td class="num">${g.count}</td>
      <td class="num">${fmt(g.ur)}</td>
      <td class="num">${fmtMoney(g.pr)}</td>
      <td class="num">${fmt(g.us)}</td>
      <td class="num">${fmtMoney(g.ps)}</td>
      <td class="num ${clsU}">${signU}${fmt(g.du)}</td>
      <td class="num ${clsP}">${signP}${fmtMoney(g.dp)}</td>
    </tr>`;
  }).join('');
  const empty = filtered.length === 0 ? '<tr><td colspan="8" class="no-data" style="text-align:center;padding:16px">Sin resultados para el filtro aplicado.</td></tr>' : '';
  return `<table class="data-table dd-table">
    <thead><tr>
      <th>${groupLabel}</th>
      <th class="num">Productos</th>
      <th class="num">CONTEO</th>
      <th class="num">VALOR CONTEO</th>
      <th class="num">STOCK SISTEMA</th>
      <th class="num">VALOR SISTEMA $</th>
      <th class="num">DIFERENCIA</th>
      <th class="num">DIFERENCIA $</th>
    </tr></thead>
    <tbody>${rows || empty}</tbody>
  </table>`;
}

function buildDDProductTable(data, year) {
  if (!data.length) return '<p class="no-data">Sin productos en esta categoría.</p>';
  const df = (state.ddFilters && state.ddFilters[year]) || {};
  const codQ  = (df.cod  || '').toLowerCase();
  const descQ = (df.desc || '').toLowerCase();
  let filtered = data;
  if (codQ)  filtered = filtered.filter(r => (r.codigo  || '').toLowerCase().includes(codQ));
  if (descQ) filtered = filtered.filter(r => (r.producto || '').toLowerCase().includes(descQ));
  if (df.sortByDif === 'desc') filtered = [...filtered].sort((a, b) => b.abs_dif_peso - a.abs_dif_peso);
  else if (df.sortByDif === 'asc') filtered = [...filtered].sort((a, b) => a.abs_dif_peso - b.abs_dif_peso);
  const rows = filtered.map(r => {
    const signU = r.dif_unidades >= 0 ? '+' : '';
    const signP = r.dif_peso     >= 0 ? '+' : '';
    const clsU  = r.dif_unidades < 0 ? 'loss-cell' : r.dif_unidades > 0 ? 'gain-cell' : '';
    const clsP  = r.dif_peso     < 0 ? 'loss-cell' : r.dif_peso     > 0 ? 'gain-cell' : '';
    return `<tr>
      <td class="mono-sm">${r.codigo || '—'}</td>
      <td title="${(r.producto||'').replace(/"/g,'&quot;')}">${trunc(r.producto, 45)}</td>
      <td class="num">${fmt(r.unidades_real)}</td>
      <td class="num">${r.costo > 0 ? fmtMoney(r.costo) : '—'}</td>
      <td class="num">${fmtMoney(r.peso_real)}</td>
      <td class="num">${fmt(r.unidades_sistema)}</td>
      <td class="num">${fmtMoney(r.peso_sistema)}</td>
      <td class="num ${clsU}">${signU}${fmt(r.dif_unidades)}</td>
      <td class="num ${clsP}">${signP}${fmtMoney(r.dif_peso)}</td>
      <td>${trunc(r.familia || '—', 28)}</td>
    </tr>`;
  }).join('');
  const empty = filtered.length === 0 ? '<tr><td colspan="10" class="no-data" style="text-align:center;padding:16px">Sin resultados para el filtro aplicado.</td></tr>' : '';
  return `<table class="data-table dd-table">
    <thead><tr>
      <th>Codigo_tecnico</th>
      <th>Descripcion</th>
      <th class="num">CONTEO</th>
      <th class="num">COSTO $</th>
      <th class="num">VALOR CONTEO</th>
      <th class="num">STOCK SISTEMA</th>
      <th class="num">VALOR SISTEMA $</th>
      <th class="num">DIFERENCIA</th>
      <th class="num">DIFERENCIA $</th>
      <th>FAMILIA</th>
    </tr></thead>
    <tbody>${rows || empty}</tbody>
  </table>`;
}

function setDrilldownGroup(year, groupBy) {
  state.ddState[year] = { groupBy, filterField: null, filterValue: null };
  renderDrilldown(year, getFilteredData(year));
}

function drillIntoGroup(year, field, value) {
  state.ddState[year].filterField = field;
  state.ddState[year].filterValue = value;
  renderDrilldown(year, getFilteredData(year));
  document.getElementById(`drilldown-${year}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearDrilldownFilter(year) {
  state.ddState[year].filterField = null;
  state.ddState[year].filterValue = null;
  renderDrilldown(year, getFilteredData(year));
}

function ddFilterDrilldown(year) {
  if (!state.ddFilters[year]) state.ddFilters[year] = { cod: '', desc: '', sortByDif: false };
  state.ddFilters[year].cod  = document.getElementById(`dd-${year}-search-cod`)?.value  || '';
  state.ddFilters[year].desc = document.getElementById(`dd-${year}-search-desc`)?.value || '';
  renderDrilldown(year, getFilteredData(year));
}

function ddToggleSortDif(year) {
  if (!state.ddFilters[year]) state.ddFilters[year] = { cod: '', desc: '', sortByDif: false };
  const cur = state.ddFilters[year].sortByDif;
  state.ddFilters[year].sortByDif = cur === false || cur === '' ? 'desc' : cur === 'desc' ? 'asc' : false;
  const next = state.ddFilters[year].sortByDif;
  const btn = document.getElementById(`dd-${year}-sort-btn`);
  if (btn) btn.textContent = next === 'desc' ? '⬇ DIFERENCIA (mayor → menor)'
                           : next === 'asc'  ? '⬆ DIFERENCIA (menor → mayor)'
                           :                   '⬆⬇ Ordenar por DIFERENCIA';
  renderDrilldown(year, getFilteredData(year));
}

/* ── HELPER: estilador genérico para cualquier hoja xlsx-js-style ─
   Aplica header #002060/blanco/negrita, bordes finos, anchos auto,
   formato $ / #,##0 según encabezado, condicional rojo/azul en cols
   DIFERENCIA/DIF, freeze fila 1. Celdas de datos con fondo blanco.
──────────────────────────────────────────────────────────────────── */
function styleSimpleSheet(ws, rows) {
  if (!rows || !rows.length) return ws;
  const HDR_FILL = { patternType:'solid', fgColor:{ rgb:'FF002060' } };
  const HDR_FONT = { color:{ rgb:'FFFFFFFF' }, bold:true, sz:10 };
  const HDR_ALIGN = { horizontal:'center', vertical:'center', wrapText:true };
  const THIN_BDR = { style:'thin', color:{ rgb:'FFBBBBBB' } };
  const CELL_BDR = { top:THIN_BDR, bottom:THIN_BDR, left:THIN_BDR, right:THIN_BDR };

  const nCols = rows[0]?.length || 1;
  const hdr = rows[0] || [];
  const isMoneyCol = hdr.map(h => /\$|VALOR|COSTO|PRECIO|IMPACTO|NETO/i.test(String(h)));
  const isNumCol = hdr.map((_, ci) => {
    const vals = rows.slice(1).filter(r => typeof r[ci] === 'number' || (!isNaN(parseFloat(r[ci])) && r[ci] !== '' && r[ci] !== null));
    return vals.length > 0 && vals.length >= rows.slice(1).length * 0.4;
  });

  ws['!cols'] = hdr.map((_, ci) => {
    const maxLen = Math.max(...rows.map(r => (r[ci]?.toString() || '').length));
    return { wch: Math.min(Math.max(maxLen + 2, 8), 45) };
  });
  ws['!views'] = [{ state:'frozen', xSplit:0, ySplit:1, topLeftCell:'A2' }];

  rows.forEach((row, rIdx) => {
    const isHeader = rIdx === 0;
    row.forEach((val, cIdx) => {
      const addr = XLSX.utils.encode_cell({ r:rIdx, c:cIdx });
      if (!ws[addr]) ws[addr] = { t:'s', v: val ?? '' };
      const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.\-]/g,''));
      const isNum = !isHeader && isNumCol[cIdx] && !isNaN(num);
      if (isNum) { ws[addr].t = 'n'; ws[addr].v = num; ws[addr].z = isMoneyCol[cIdx] ? '$ #,##0' : '#,##0'; }
      const isDif = /DIFERENCIA|DIF\b|DIFF/i.test(String(hdr[cIdx] || ''));
      const fontRgb = isHeader ? 'FFFFFFFF' : (isDif && isNum ? (num < 0 ? 'FFC00000' : num > 0 ? 'FF0000FF' : 'FF1F2937') : 'FF1F2937');
      ws[addr].s = {
        fill:  isHeader ? HDR_FILL : { patternType:'none' },
        font:  { color:{ rgb: fontRgb }, bold: isHeader, sz: isHeader ? 10 : 9 },
        alignment: isHeader ? HDR_ALIGN : { horizontal: isNum ? 'right' : 'left' },
        border: CELL_BDR,
      };
    });
  });

  ws['!ref'] = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:rows.length-1,c:nCols-1} });
  return ws;
}

/* ── HELPER: estilos para TABLA_ANALISIS (xlsx-js-style) ────────
   Aplica header #002060/blanco/negrita, anchos, formatos numéricos,
   condicional rojo/azul en columnas H e I, bordes finos, freeze A2.
   Recibe hoja vacía (wb) y array de filas [[val,...], ...] con encabezado
   en la primera fila.
──────────────────────────────────────────────────────────────── */
function styleAnalisisSheet(ws, rows) {
  const HDR_FILL  = { patternType: 'solid', fgColor: { rgb: 'FF002060' } };
  const HDR_FONT  = { color: { rgb: 'FFFFFFFF' }, bold: true, sz: 10 };
  const HDR_ALIGN = { horizontal: 'center', vertical: 'center', wrapText: true };
  const THIN_BDR  = { style: 'thin', color: { rgb: 'FFBBBBBB' } };
  const CELL_BDR  = { top: THIN_BDR, bottom: THIN_BDR, left: THIN_BDR, right: THIN_BDR };

  // Formatos por columna (índice 0-basado): A=0..L=11
  const COL_FMT = {
    2: '#,##0',         // C: CONTEO
    3: '$ #,##0',       // D: COSTO $
    4: '$ #,##0',       // E: VALOR CONTEO
    5: '#,##0',         // F: STOCK SISTEMA
    6: '$ #,##0',       // G: VALOR SISTEMA $
    7: '#,##0',         // H: DIFERENCIA
    8: '$ #,##0',       // I: DIFERENCIA $
  };

  // Anchos de columna (Excel width units): A17 B42 C10 D14 E18 F14 G15 H10 I15 J14 K26 L11
  ws['!cols'] = [
    { wch:17 },{ wch:42 },{ wch:10 },{ wch:14 },{ wch:18 },
    { wch:14 },{ wch:15 },{ wch:10 },{ wch:15 },{ wch:14 },
    { wch:26 },{ wch:11 },
  ];

  // Freeze fila 1 (encabezados) → datos desde A2
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2' }];

  const nCols = rows[0]?.length || 12;
  rows.forEach((row, rIdx) => {
    row.forEach((val, cIdx) => {
      const addr = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
      if (!ws[addr]) ws[addr] = { t: 's', v: val ?? '' };

      const isHeader = rIdx === 0;
      const isMoney  = COL_FMT[cIdx]?.startsWith('$');
      const isNum    = COL_FMT[cIdx] !== undefined;
      const num      = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.\-]/g,''));

      // Tipo de celda
      if (!isHeader && isNum && !isNaN(num)) {
        ws[addr].t = 'n';
        ws[addr].v = num;
        ws[addr].z = COL_FMT[cIdx];
      }

      // Estilos
      const fontColor = !isHeader && isNum && !isNaN(num)
        ? (num < 0 ? 'FFC00000' : num > 0 && (cIdx === 7 || cIdx === 8) ? 'FF0000FF' : 'FF1F2937')
        : (isHeader ? 'FFFFFFFF' : 'FF1F2937');

      ws[addr].s = {
        fill:      isHeader ? HDR_FILL : { patternType: 'none' },
        font:      { color: { rgb: fontColor }, bold: isHeader, sz: 10 },
        alignment: isHeader ? HDR_ALIGN : { horizontal: isNum ? 'right' : 'left' },
        border:    CELL_BDR,
      };
    });
  });

  // Rango de la hoja
  ws['!ref'] = XLSX.utils.encode_range({ s:{ r:0, c:0 }, e:{ r: rows.length-1, c: nCols-1 } });
  return ws;
}

function exportDrilldownTable(year) {
  const data = getFilteredData(year);
  if (!data.length) { showToast('Sin datos para exportar.', 'error'); return; }

  const headers = [
    'Codigo_tecnico','Descripcion','CONTEO','COSTO $',
    'VALOR CONTEO','STOCK SISTEMA','VALOR SISTEMA $',
    'DIFERENCIA','DIFERENCIA $','FAMILIA','MARCA',
  ];

  const rows = [headers, ...data.map(r => [
    r.codigo         || '',
    r.producto       || '',
    r.unidades_real  ?? 0,
    r.costo          ?? 0,
    r.peso_real      ?? 0,
    r.unidades_sistema ?? 0,
    r.peso_sistema   ?? 0,
    r.dif_unidades   ?? 0,
    r.dif_peso       ?? 0,
    r.familia        || '',
    r.marca          || '',
  ])];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  styleSimpleSheet(ws, rows);

  // Hoja RESULTADOS (cuadro resumen)
  const k  = calcKPIs(data);
  const m  = calcMonetarySummary(data);
  const resultRows = [
    ['Concepto', 'Unidades', 'Valor $', '%'],
    ['Total Sistema',   Math.round(k.us), Math.round(k.ps), ''],
    ['Total Conteo',    Math.round(k.ur), Math.round(k.pr), ''],
    ['Diferencia',      Math.round(k.du), Math.round(m.difTotal), ''],
    ['Diferencias (+)', data.filter(r=>r.dif_unidades>0).length,
                        Math.round(data.reduce((s,r)=>s+(r.dif_peso>0?r.dif_peso:0),0)), ''],
    ['Diferencias (−)', data.filter(r=>r.dif_unidades<0).length,
                        Math.round(data.reduce((s,r)=>s+(r.dif_peso<0?r.dif_peso:0),0)), ''],
    ['Dispersión',      Math.round(k.adu), Math.round(m.dispersion),
                        (m.pctDispersion||0).toFixed(2)+'%'],
  ];
  const wsR = XLSX.utils.aoa_to_sheet(resultRows);
  styleSimpleSheet(wsR, resultRows);

  XLSX.utils.book_append_sheet(wb, ws,  'TABLA_ANALISIS');
  XLSX.utils.book_append_sheet(wb, wsR, 'RESULTADOS');
  XLSX.writeFile(wb, `AnalisisInventario_${year}_${today()}.xlsx`);
  showToast(`Excel ${year} generado con formato ✓`, 'ok');
}

function renderResumen(id, groups, keyLabel) {
  const sorted = [...groups].sort((a,b) => b.adu - a.adu);
  buildTable(id,
    [keyLabel, 'STOCK SISTEMA', 'CONTEO', 'VALOR SISTEMA $', 'VALOR CONTEO',
     '|DIFERENCIA|', '|DIFERENCIA $|', '% Exact Unid', '% Exact Peso'],
    sorted.map(g => [
      trunc(g.key.replace(/\x00/g, ' / '), 35),
      cNum(g.us), cNum(g.ur), cNum(g.ps), cNum(g.pr),
      cNum(g.adu), cNum(g.adp),
      cPct(g.exact_unid), cPct(g.exact_peso),
    ]));
}

function renderTables(year, data) {
  renderDrilldown(year, data);
  renderResumen(`resumen-marca-${year}`, aggregateBy(data, 'marca'), 'Marca');
  renderResumen(`resumen-familia-${year}`, aggregateBy(data, 'familia', 'perfamilia'), 'Familia / Hiperfamilia');
  renderResumen(`resumen-zona-${year}`, aggregateBy(data, 'zona', 'area'), 'Zona / Área');
}

function renderComparativeTable(d25, d26) {
  const agg25 = toIndex(aggregateBy(d25, 'marca','familia','producto'), 'marca'); // keys by key string
  const make25 = toIndexByKey(aggregateBy(d25, 'marca','familia','producto'));
  const make26 = toIndexByKey(aggregateBy(d26, 'marca','familia','producto'));
  const allKeys = [...new Set([...Object.keys(make25), ...Object.keys(make26)])];

  const rows = allKeys.map(k => {
    const r25 = make25[k] || {};
    const r26 = make26[k] || {};
    const [marca='', familia='', producto=''] = k.split('\x00');
    const dU = (r26.exact_unid||0) - (r25.exact_unid||0);
    const dP = (r26.exact_peso||0) - (r25.exact_peso||0);
    return { marca, familia, producto, r25, r26, dU, dP };
  }).sort((a,b) => a.dU - b.dU); // peor empeoramiento primero

  buildTable('table-comparative',
    ['Marca','Familia','Descripcion',
     'STOCK SISTEMA 25','STOCK SISTEMA 26','DIFERENCIA 25','DIFERENCIA 26',
     'VALOR SISTEMA $ 25','VALOR SISTEMA $ 26',
     '% Exact Unid 25','% Exact Unid 26','Δ Exact Unid',
     '% Exact Peso 25','% Exact Peso 26','Δ Exact Peso'],
    rows.map(r => [
      trunc(r.marca,20), trunc(r.familia,20), trunc(r.producto,35),
      cNum(r.r25.us||0), cNum(r.r26.us||0),
      cNum(r.r25.du||0), cNum(r.r26.du||0),
      cNum(r.r25.ps||0), cNum(r.r26.ps||0),
      cPct(r.r25.exact_unid||0), cPct(r.r26.exact_unid||0), cDelta(r.dU),
      cPct(r.r25.exact_peso||0), cPct(r.r26.exact_peso||0), cDelta(r.dP),
    ]));
}

function toIndexByKey(arr) {
  return Object.fromEntries(arr.map(r => [r.key, r]));
}

// ── INSIGHTS ───────────────────────────────────────────────────
function renderInsights(year, data) {
  const el = document.getElementById(`insights-${year}`);
  if (!data.length) { el.innerHTML = ''; return; }

  const k      = calcKPIs(data);
  const m      = calcMonetarySummary(data);
  const byFam  = aggregateBy(data, 'familia').sort((a,b) => b.adu - a.adu);
  const byFamP = aggregateBy(data, 'familia').sort((a,b) => b.adp - a.adp);
  const byZona = aggregateBy(data, 'zona').sort((a,b) => a.exact_unid - b.exact_unid);
  const byMarca= aggregateBy(data, 'marca').sort((a,b) => b.adp - a.adp);
  const items  = [];

  if (byFam[0]) {
    const pct = k.adu > 0 ? (byFam[0].adu / k.adu * 100).toFixed(1) : '0';
    items.push(`La familia <strong>${byFam[0].fd.familia || '(sin familia)'}</strong> concentra el <strong>${pct}%</strong> de la diferencia total en unidades — priorizar para el próximo inventario.`);
  }
  if (byFamP[0] && m.dispersion > 0) {
    const pctP = (byFamP[0].adp / m.dispersion * 100).toFixed(1);
    items.push(`En valor monetario, la familia <strong>${byFamP[0].fd.familia || '(sin familia)'}</strong> representa el <strong>${pctP}%</strong> de la dispersión total (${fmtMoney(byFamP[0].adp)}).`);
  }
  if (byZona[0] && byZona[0].exact_unid < 95) {
    items.push(`La zona <strong>${byZona[0].fd.zona || '(sin zona)'}</strong> tiene exactitud de <strong>${fmtPct(byZona[0].exact_unid)}%</strong> en unidades — priorizar reconteo.`);
  }
  if (byMarca[0] && byMarca[0].adp > 0) {
    items.push(`La marca <strong>${byMarca[0].fd.marca || '(sin marca)'}</strong> tiene mayor impacto monetario: <strong>${fmtMoney(byMarca[0].adp)}</strong> de dispersión en valor.`);
  }
  if (m.totalSistema > 0) {
    const signo = m.difTotal < 0 ? 'faltante neto' : 'sobrante neto';
    items.push(`Resultado global: <strong>${fmtMoney(m.difTotal)}</strong> de ${signo} · Dispersión total: <strong>${fmtMoney(m.dispersion)}</strong> (${fmtPct(m.pctDispersion)}% del stock en sistema).`);
  }
  if (k.exact_unid < 85) {
    items.push(`⚠️ Exactitud global <strong>crítica</strong> (${fmtPct(k.exact_unid)}% en unidades). Se recomienda reconteo general.`);
  } else if (k.exact_unid >= 95) {
    items.push(`✅ Exactitud global <strong>excelente</strong> en unidades (${fmtPct(k.exact_unid)}%).`);
  }

  el.innerHTML = items.map(t => `<div class="insight-item">${t}</div>`).join('');
}

function renderInsightsComp(d25, d26) {
  const el  = document.getElementById('insights-comparative');
  const k25 = calcKPIs(d25);
  const k26 = calcKPIs(d26);
  const dU  = k26.exact_unid - k25.exact_unid;

  const idx25 = toIndex(aggregateBy(d25, 'familia'), 'familia');
  const idx26 = toIndex(aggregateBy(d26, 'familia'), 'familia');
  const allFam = [...new Set([...Object.keys(idx25), ...Object.keys(idx26)])];

  const deltas = allFam.map(f => ({
    f,
    dU: (idx26[f]?.exact_unid||0) - (idx25[f]?.exact_unid||0)
  })).sort((a,b) => a.dU - b.dU);

  const worse  = deltas.filter(d => d.dU < -2).slice(0,3);
  const better = [...deltas].reverse().filter(d => d.dU > 2).slice(0,3);
  const items  = [];

  items.push(`Exactitud unidades: <strong>${fmtPct(k25.exact_unid)}%</strong> (2025) → <strong>${fmtPct(k26.exact_unid)}%</strong> (2026) (<span class="${dU>=0?'delta-pos':'delta-neg'}">${dU>=0?'+':''}${fmtPct(dU)} pp</span>).`);
  if (worse.length)  items.push(`Familias que <strong>empeoraron</strong>: ${worse.map(d=>`${d.f} (${fmtPct(d.dU)} pp)`).join(', ')}.`);
  if (better.length) items.push(`Familias que <strong>mejoraron</strong>: ${better.map(d=>`${d.f} (+${fmtPct(d.dU)} pp)`).join(', ')} — replicar método.`);
  if (d25.length === 0) items.push('ℹ️ No hay datos de 2025. Carga archivos 2025 para la comparación completa.');
  if (d26.length === 0) items.push('ℹ️ No hay datos de 2026. Carga archivos 2026 para la comparación completa.');

  el.innerHTML = items.map(t => `<div class="insight-item">${t}</div>`).join('');
}

// ── ORDENAMIENTO DE TABLAS ─────────────────────────────────────
function sortTable(tableId, colIdx) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const key = `${tableId}:${colIdx}`;
  const dir = state.sortState[key] === 'asc' ? 'desc' : 'asc';
  state.sortState[key] = dir;

  table.querySelectorAll('th').forEach(th => th.classList.remove('sort-asc','sort-desc'));
  table.querySelectorAll('th')[colIdx]?.classList.add(`sort-${dir}`);

  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr'));

  rows.sort((a, b) => {
    const aRaw = a.cells[colIdx]?.textContent.trim() || '';
    const bRaw = b.cells[colIdx]?.textContent.trim() || '';
    const aNum = parseFloat(aRaw.replace(/[^0-9,.\-]/g, '').replace(',', '.'));
    const bNum = parseFloat(bRaw.replace(/[^0-9,.\-]/g, '').replace(',', '.'));
    if (!isNaN(aNum) && !isNaN(bNum)) return dir === 'asc' ? aNum - bNum : bNum - aNum;
    return dir === 'asc' ? aRaw.localeCompare(bRaw, 'es') : bRaw.localeCompare(aRaw, 'es');
  });
  rows.forEach(r => tbody.appendChild(r));
}

// ── EXPORTAR ───────────────────────────────────────────────────
function exportResumenGlobalExcel(year) {
  const isComp = year === 'comparative';
  const d25 = isComp ? getFilteredDataComp().d25 : (year === '2025' ? getFilteredData('2025') : []);
  const d26 = isComp ? getFilteredDataComp().d26 : (year === '2026' ? getFilteredData('2026') : []);
  const data = isComp ? null : (year === '2025' ? d25 : d26);

  const wb = XLSX.utils.book_new();

  const ri  = Math.round;  // entero (unidades)
  const rm  = v => Math.round(v || 0);  // entero (montos CLP)
  const rp  = v => +((v || 0).toFixed(2));  // 2 decimales (porcentajes)

  if (!isComp) {
    if (!data.length) { showToast('Sin datos para exportar.', 'error'); return; }
    const k = calcKPIs(data);
    const m = calcMonetarySummary(data);
    let falt = 0, sobr = 0;
    for (const r of data) { if (r.dif_unidades < 0) falt++; else if (r.dif_unidades > 0) sobr++; }
    const rows = [
      ['KPI', 'Valor'],
      ['Total Unidades Sistema',     ri(k.us)],
      ['Total Unidades Físico',      ri(k.ur)],
      ['Diferencia Unidades',        ri(k.du)],
      ['Dispersión Unidades (abs)',   ri(k.adu)],
      ['% Exactitud Unidades',       rp(k.exact_unid)],
      ['Total $ Sistema',            rm(k.ps)],
      ['Total $ Físico',             rm(k.pr)],
      ['Diferencia $',               rm(m.difTotal)],
      ['Dispersión $ (|dif+|+|dif-|)', rm(m.dispersion)],
      ['% Exactitud $',              rp(k.exact_peso)],
      ['Productos Faltantes',        falt],
      ['Productos Sobrantes',        sobr],
      ['Total Productos',            data.length],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `KPIs_${year}`);
  } else {
    if (!d25.length && !d26.length) { showToast('Sin datos para exportar.', 'error'); return; }
    const k25 = calcKPIs(d25), k26 = calcKPIs(d26);
    const m25 = calcMonetarySummary(d25), m26 = calcMonetarySummary(d26);
    let f25 = 0, s25 = 0, f26 = 0, s26 = 0;
    for (const r of d25) { if (r.dif_unidades < 0) f25++; else if (r.dif_unidades > 0) s25++; }
    for (const r of d26) { if (r.dif_unidades < 0) f26++; else if (r.dif_unidades > 0) s26++; }
    const rows = [
      ['KPI',                        '2025',              '2026',              'Delta'],
      ['Total Unidades Sistema',     ri(k25.us),          ri(k26.us),          ri(k26.us - k25.us)],
      ['Total Unidades Físico',      ri(k25.ur),          ri(k26.ur),          ri(k26.ur - k25.ur)],
      ['Diferencia Unidades',        ri(k25.du),          ri(k26.du),          ri(k26.du - k25.du)],
      ['% Exactitud Unidades',       rp(k25.exact_unid),  rp(k26.exact_unid),  rp(k26.exact_unid - k25.exact_unid)],
      ['Total $ Sistema',            rm(k25.ps),          rm(k26.ps),          rm(k26.ps - k25.ps)],
      ['Total $ Físico',             rm(k25.pr),          rm(k26.pr),          rm(k26.pr - k25.pr)],
      ['Diferencia $',               rm(m25.difTotal),    rm(m26.difTotal),    rm(m26.difTotal - m25.difTotal)],
      ['Dispersión $',               rm(m25.dispersion),  rm(m26.dispersion),  rm(m26.dispersion - m25.dispersion)],
      ['% Exactitud $',              rp(k25.exact_peso),  rp(k26.exact_peso),  rp(k26.exact_peso - k25.exact_peso)],
      ['Productos Faltantes',        f25,                 f26,                 f26 - f25],
      ['Productos Sobrantes',        s25,                 s26,                 s26 - s25],
      ['Total Productos',            d25.length,          d26.length,          d26.length - d25.length],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'KPIs_Comparativo');
  }

  XLSX.writeFile(wb, `Resumen_KPIs_${year}_${today()}.xlsx`);
  showToast('Excel de KPIs generado ✓', 'ok');
}

function exportTableToExcel(tableId, fileName) {
  const table = document.getElementById(tableId);
  if (!table?.rows.length) { showToast('Sin datos para exportar.', 'error'); return; }

  // Extraer datos crudos de la tabla (thead + tbody + tfoot)
  const allRows = [];
  table.querySelectorAll('tr').forEach(tr => {
    const cells = [...tr.querySelectorAll('th,td')].map(c => {
      const txt = c.textContent.trim();
      // Intentar convertir a número: quitar $, puntos miles, espacios
      const clean = txt.replace(/[$\s]/g,'').replace(/\./g,'').replace(',','.');
      const n = parseFloat(clean);
      return (!isNaN(n) && txt !== '' && /[\d]/.test(txt)) ? n : txt;
    });
    if (cells.length) allRows.push(cells);
  });

  const nCols = allRows[0]?.length || 1;

  // Estilado unificado via styleSimpleSheet
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  styleSimpleSheet(ws, allRows);

  // Override footer TOTAL en azul claro (después de styleSimpleSheet)
  const lastR = allRows.length - 1;
  if (typeof allRows[lastR]?.[0] === 'string' && /total/i.test(String(allRows[lastR][0]))) {
    for (let ci = 0; ci < nCols; ci++) {
      const addr = XLSX.utils.encode_cell({ r: lastR, c: ci });
      if (ws[addr]) ws[addr].s = { ...ws[addr].s,
        fill: { patternType:'solid', fgColor:{ rgb:'FFDBEAFE' } },
        font: { ...(ws[addr].s?.font || {}), bold:true },
      };
    }
  }

  // Hoja LEYENDA
  const HDR_FILL = { patternType:'solid', fgColor:{ rgb:'FF002060' } };
  const HDR_FONT = { color:{ rgb:'FFFFFFFF' }, bold:true, sz:10 };
  const THIN_BDR = { style:'thin', color:{ rgb:'FFBBBBBB' } };
  const CELL_BDR = { top:THIN_BDR, bottom:THIN_BDR, left:THIN_BDR, right:THIN_BDR };
  const headers = allRows[0] || [];
  const legendRows = [
    ['Columna', 'Descripción'],
    ['DIFERENCIA / DIF UNID', 'Conteo físico − Stock sistema (negativo = faltante, positivo = sobrante)'],
    ['DIFERENCIA $ / DIF $', 'Diferencia en unidades × Costo unitario'],
    ['DISPERSIÓN', '|Faltantes| + |Sobrantes| en $ — mide cuánto se aleja del sistema'],
    ['CONTEO', 'Unidades físicamente contadas en el inventario'],
    ['STOCK SISTEMA / UNID SISTEMA', 'Unidades registradas en el sistema (ERP)'],
    ['VALOR CONTEO / VALOR SISTEMA', 'Unidades × Costo unitario'],
    ['% EXACTITUD', '(1 − |Dif| / Sistema) × 100 — 100% = sin diferencias'],
    ...headers.filter(h => h && !['DIFERENCIA','DIF','CONTEO','STOCK','VALOR','EXACTITUD'].some(k => String(h).toUpperCase().includes(k)))
              .map(h => [String(h), 'Columna descriptiva / clasificación del producto']),
    ['', ''],
    ['Generado', `${new Date().toLocaleString('es-CL')} — Ferretería Oviedo · El Manzano`],
  ];
  const wsL = XLSX.utils.aoa_to_sheet(legendRows);
  wsL['!cols'] = [{ wch:32 }, { wch:70 }];
  ['A1','B1'].forEach(addr => {
    if (wsL[addr]) wsL[addr].s = { fill: HDR_FILL, font: HDR_FONT, border: CELL_BDR };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.utils.book_append_sheet(wb, wsL, 'LEYENDA');
  XLSX.writeFile(wb, `${fileName || tableId}_${today()}.xlsx`);
  showToast('Excel generado con estilos profesionales ✓', 'ok');
}

function generateReport(mode) {
  const titles = {
    '2025': 'Análisis Inventario 2025',
    '2026': 'Análisis Inventario 2026',
    comparative: 'Comparativo 2025 vs 2026'
  };
  const kpiHtml      = document.getElementById(`kpi-${mode}`)?.innerHTML || '';
  const monetaryHtml = document.getElementById(`kpi-monetary-${mode}`)?.innerHTML || '';
  const insightHtml  = document.getElementById(`insights-${mode}`)?.innerHTML || '';

  // Incluir: Top diferencias, Pérdidas unid, Sobrantes unid, Pérdidas $, Sobrantes $
  const TABLE_IDS_POR_MODE = {
    '2025': [
      ['Top 20 · Mayor diferencia absoluta (Unidades)',    `top-unid-2025`],
      ['Top 20 · Mayores Pérdidas en Unidades',           `top-perdida-unid-2025`],
      ['Top 20 · Mayores Sobrantes en Unidades',          `top-sobrante-unid-2025`],
      ['Top 20 · Mayores Faltantes en $ (Peso)',          `top-perdida-peso-2025`],
      ['Top 20 · Mayores Sobrantes en $ (Peso)',          `top-sobrante-peso-2025`],
    ],
    '2026': [
      ['Top 20 · Mayor diferencia absoluta (Unidades)',    `top-unid-2026`],
      ['Top 20 · Mayores Pérdidas en Unidades',           `top-perdida-unid-2026`],
      ['Top 20 · Mayores Sobrantes en Unidades',          `top-sobrante-unid-2026`],
      ['Top 20 · Mayores Faltantes en $ (Peso)',          `top-perdida-peso-2026`],
      ['Top 20 · Mayores Sobrantes en $ (Peso)',          `top-sobrante-peso-2026`],
    ],
    comparative: [['Tabla Comparativa 2025 vs 2026', 'table-comparative']],
  };

  let tablesHtml = '';
  const tableList = TABLE_IDS_POR_MODE[mode] || [];
  for (const [title, id] of tableList) {
    const el = document.getElementById(id);
    if (el && el.rows.length > 1) {
      tablesHtml += `<h3 style="margin:20px 0 8px;font-size:14px">${title}</h3>${el.outerHTML}`;
    }
  }
  // Fallback para otros modos sin tabla específica
  if (!tablesHtml) {
    const view = document.getElementById(`view-${mode}`);
    if (view) {
      const tables = view.querySelectorAll('.data-table');
      for (let i = 0; i < Math.min(3, tables.length); i++) {
        const h = view.querySelectorAll('h3')[i]?.textContent || '';
        tablesHtml += `<h3 style="margin:20px 0 8px;font-size:14px">${h}</h3>${tables[i].outerHTML}`;
      }
    }
  }

  const monetarySection = monetaryHtml
    ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 16px;margin:16px 0">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#E85D04;letter-spacing:.05em;margin-bottom:10px">💰 Dispersión en $ (Peso monetario)</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px">${monetaryHtml}</div>
       </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>${titles[mode]} · El Manzano</title>
<style>
  body{font-family:system-ui,sans-serif;color:#0f172a;margin:32px 40px;font-size:13px}
  h1{color:#E85D04;border-bottom:2px solid #E85D04;padding-bottom:8px;margin-bottom:6px}
  h3{color:#1e293b;margin:18px 0 6px}
  p.sub{color:#64748b;font-size:12px;margin-bottom:20px}
  .kpi-grid{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
  .kpi-card{border:1px solid #e2e8f0;border-left:4px solid #e2e8f0;border-radius:8px;padding:12px 14px;min-width:150px}
  .kpi-label{font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:4px}
  .kpi-value{font-size:22px;font-weight:800}
  .kpi-sub{font-size:11px;color:#64748b;margin-top:3px}
  .kpi-verde{border-left-color:#16a34a}.kpi-verde .kpi-value{color:#16a34a}
  .kpi-amarillo{border-left-color:#d97706}.kpi-amarillo .kpi-value{color:#d97706}
  .kpi-rojo{border-left-color:#dc2626}.kpi-rojo .kpi-value{color:#dc2626}
  .kpi-neutral{border-left-color:#1A56DB}.kpi-neutral .kpi-value{color:#1A56DB}
  .insights-card{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 14px;margin:14px 0;font-size:13px;line-height:1.8}
  .insight-item::before{content:'💡 '}
  .insight-item{margin-bottom:4px}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px}
  th{background:#f8fafc;padding:6px 9px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid #e2e8f0;color:#64748b}
  td{padding:5px 9px;border-bottom:1px solid #f1f5f9}
  tr:nth-child(even) td{background:#fafafa}
  .num{text-align:right;font-family:monospace}
  .pct-verde{color:#16a34a;font-weight:700}
  .pct-amarillo{color:#d97706;font-weight:700}
  .pct-rojo{color:#dc2626;font-weight:700}
  .delta-pos{color:#16a34a;font-weight:600}
  .delta-neg{color:#dc2626;font-weight:600}
  footer{margin-top:40px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}
</style></head><body>
<h1>${titles[mode]}</h1>
<p class="sub">Ferretería Oviedo · El Manzano &nbsp;|&nbsp; Generado: ${new Date().toLocaleString('es-CL')}</p>
<div class="kpi-grid">${kpiHtml}</div>
${monetarySection}
<div class="insights-card">${insightHtml}</div>
${tablesHtml}
<footer>Generado con App Inventario El Manzano · Ferretería Oviedo</footer>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href:url, download:`Reporte_${mode}_${today()}.html` });
  a.click();
  URL.revokeObjectURL(url);
  showToast('Reporte HTML generado.', 'ok');
}

// ── GESTIÓN DE VISTAS ──────────────────────────────────────────
function showWelcome() {
  document.getElementById('welcome-screen').style.display = '';
  ['2025','2026','comparative'].forEach(m =>
    document.getElementById(`view-${m}`)?.classList.add('hidden'));
}

function getCurrentMode() {
  return document.querySelector('.tab-btn.active')?.dataset.mode || '2025';
}

function _showLoadedYearCoverage(year) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === year));
  refreshView();
  renderCoverageZonas(year);
  _highlightCoveragePanels(year);
}

function refreshView() {
  const has25 = state.data2025.length > 0;
  const has26 = state.data2026.length > 0;
  const mode  = getCurrentMode();

  // Modos especiales: no dependen de data2025/2026
  if (mode === 'checklist' || mode === 'planos') return;

  if (!has25 && !has26) { showWelcome(); return; }
  document.getElementById('welcome-screen').style.display = 'none';

  const allViews = ['2025','2026','comparative','checklist','planos','2025v2','reconteo','mejoras','final'];
  allViews.forEach(m => document.getElementById(`view-${m}`)?.classList.add('hidden'));

  if (mode === '2025') {
    if (has25) renderMode('2025');
    else showToast('Carga datos de 2025 primero.', 'info');
  } else if (mode === '2026') {
    if (has26) renderMode('2026');
    else showToast('Carga datos de 2026 primero.', 'info');
  } else {
    renderModeComp();
  }
}

function renderMode(year) {
  ['2025','2026','comparative'].forEach(m =>
    document.getElementById(`view-${m}`)?.classList.add('hidden'));

  const view = document.getElementById(`view-${year}`);
  view.classList.remove('hidden');

  const data = getFilteredData(year);
  _renderCoverageBanner(data, year);
  renderCoverageZonas(year);
  renderResumenGlobal(year);
  renderEmbudo(year);
  renderFilters(year);
  renderKPIs(year, data);
  renderCountKPIs(year, data);
  renderMonetaryKPIs(year, data);
  renderInsights(year, data);
  renderTables(year, data);
  renderChartModeBar(year);
  renderCharts(year, data);
  if (year === '2026') renderRegistros2026();
}

function renderModeComp() {
  ['2025','2026','comparative'].forEach(m =>
    document.getElementById(`view-${m}`)?.classList.add('hidden'));

  document.getElementById('view-comparative').classList.remove('hidden');
  const { d25, d26 } = getFilteredDataComp();
  renderCompKPIs(d25, d26);
  renderCompCategoria(d25, d26);
  renderFilters('comparative');
  renderKPIsComp(d25, d26);
  renderInsightsComp(d25, d26);
  renderComparativeTable(d25, d26);
  renderChartsComp(d25, d26);
}

// ── UTILIDADES ─────────────────────────────────────────────────
function fmt(n)      { return (n||0).toLocaleString('es-CL', { maximumFractionDigits: 1 }); }
function fmtPct(n)   { return (+n||0).toFixed(1); }
function fmtMoney(n) { return '$ ' + Math.round(n || 0).toLocaleString('es-CL'); }
function truncate(s, n) { s = s||''; return s.length > n ? s.substring(0,n)+'…' : s; }
function today()   { return new Date().toISOString().slice(0,10); }
function semaforo(pct) {
  if (pct >= 95) return 'kpi-verde';
  if (pct >= 85) return 'kpi-amarillo';
  return 'kpi-rojo';
}
function semLabel(cls) {
  return cls === 'kpi-verde' ? '✅ Excelente' : cls === 'kpi-amarillo' ? '⚠️ Aceptable' : '🔴 Crítico';
}

let toastTimer;
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
}

// ── DRAG & DROP + FILE INPUT ───────────────────────────────────
function setupDragDrop(dropId, inputId, btnId, year) {
  const zone = document.getElementById(dropId);
  const input= document.getElementById(inputId);
  const btn  = document.getElementById(btnId);

  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', ()=> zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files, year);
  });

  input.addEventListener('change', () => {
    if (input.files.length) { loadFiles(input.files, year); input.value = ''; }
  });

  btn.addEventListener('click', () => input.click());
}

function setupTabs() {
  // Solo los tabs de análisis usan refreshView; checklist/planos tienen su propio handler en DOMContentLoaded
  document.querySelectorAll('.tab-btn[data-mode="2025"], .tab-btn[data-mode="2026"], .tab-btn[data-mode="comparative"]')
    .forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        refreshView();
      });
    });
}

// ── REPORTE FINAL INTERACTIVO ──────────────────────────────────
function generateReporteFinal(mode) {
  mode = mode || getActiveViewMode();
  const data = (state.data2026?.length ? state.data2026 : state.data2025) || [];
  if (!data.length) { showToast('No hay datos cargados para generar el reporte.', 'error'); return; }

  const year = state.data2026?.length ? '2026' : '2025';
  const k = calcKPIs(data);
  const m = calcMonetarySummary(data);
  let falt = 0, sobr = 0, faltV = 0, sobrV = 0;
  for (const r of data) {
    if (r.dif_unidades < 0) { falt++; faltV += Math.abs(r.dif_peso || 0); }
    else if (r.dif_unidades > 0) { sobr++; sobrV += Math.abs(r.dif_peso || 0); }
  }
  // Helper local: formato porcentaje chileno con signo, base monetaria (NO redefinir fmtPct global)
  const _pct = (val, decimals) => {
    if (!isFinite(val)) return '—';
    return (val >= 0 ? '+' : '') + val.toFixed(decimals === undefined ? 2 : decimals).replace('.', ',') + '%';
  };
  const _pctBase = m.totalSistema || 1;
  const pctDif   = m.totalSistema > 0 ? m.difTotal   / _pctBase * 100 : null;
  const pctDifP  = m.totalSistema > 0 ? m.difPos      / _pctBase * 100 : null;
  const pctDifN  = m.totalSistema > 0 ? m.difNeg      / _pctBase * 100 : null;
  const pctDisp  = m.totalSistema > 0 ? m.dispersion  / _pctBase * 100 : null;
  // Estos se usan solo en el texto sub de cards (base unidades — conservar para no romper)
  const pctFalt = k.us > 0 ? (Math.abs(data.reduce((s,r)=>s+(r.dif_unidades<0?r.dif_unidades:0),0))/k.us*100).toFixed(2) : '0.00';
  const pctSobr = k.us > 0 ? (data.reduce((s,r)=>s+(r.dif_unidades>0?r.dif_unidades:0),0)/k.us*100).toFixed(2) : '0.00';

  // Agrupar por hiperfamilia para gráficos
  const byHiper = aggregateBy(data, 'perfamilia').sort((a,b)=>b.adp-a.adp);
  const byMarca = aggregateBy(data, 'marca').sort((a,b)=>b.adp-a.adp).slice(0,12);
  const byFam   = aggregateBy(data, 'familia').sort((a,b)=>b.adp-a.adp).slice(0,12);

  // Tops
  const topFalt = [...data].filter(r=>r.dif_peso<0).sort((a,b)=>a.dif_peso-b.dif_peso).slice(0,15);
  const topSobr = [...data].filter(r=>r.dif_peso>0).sort((a,b)=>b.dif_peso-a.dif_peso).slice(0,15);

  // Opciones únicas para filtros en cascada
  const hipers  = [...new Set(data.map(r=>r.perfamilia||'').filter(Boolean))].sort();
  const fams    = [...new Set(data.map(r=>r.familia||'').filter(Boolean))].sort();
  const subfams = [...new Set(data.map(r=>r.subfamilia||'').filter(Boolean))].sort();
  const marcas  = [...new Set(data.map(r=>r.marca||'').filter(Boolean))].sort();

  // Serializar dataset completo embebido en HTML
  const dataJSON = JSON.stringify(data);

  const mkTopRows = (arr, colorHex) => arr.map(r =>
    `<tr>
      <td class="mono">${r.codigo||'—'}</td>
      <td class="prod">${(r.producto||'—').substring(0,45)}</td>
      <td class="num" style="color:${colorHex}">${r.dif_unidades>=0?'+':''}${Math.round(r.dif_unidades||0).toLocaleString('es-CL')}</td>
      <td class="num" style="color:${colorHex}">$ ${Math.round(r.dif_peso||0).toLocaleString('es-CL')}</td>
    </tr>`).join('');

  const hiperOpts  = hipers.map(v=>`<option value="${v.replace(/"/g,'&quot;')}">${v}</option>`).join('');
  const famOpts    = fams.map(v=>`<option value="${v.replace(/"/g,'&quot;')}">${v}</option>`).join('');
  const subfamOpts = subfams.map(v=>`<option value="${v.replace(/"/g,'&quot;')}">${v}</option>`).join('');
  const marcaOpts  = marcas.map(v=>`<option value="${v.replace(/"/g,'&quot;')}">${v}</option>`).join('');

  const hiperBarrasSobr = byHiper.slice(0,10).map(g=>Math.round(g.pr>g.ps?g.pr-g.ps:0));
  const hiperBarrasFalt = byHiper.slice(0,10).map(g=>Math.round(g.ps>g.pr?g.ps-g.pr:0));

  const fecha = new Date().toLocaleDateString('es-CL', {day:'2-digit',month:'long',year:'numeric'});

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reporte Final Inventario ${year} · El Manzano</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"><\/script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Segoe UI,Arial,sans-serif;font-size:11px;color:#1a1a2e;background:#f5f7fa}
.page{max-width:1100px;margin:0 auto;padding:24px 20px}
h1{font-size:20px;color:#002060;margin-bottom:4px}
h2{font-size:14px;color:#002060;border-bottom:2px solid #002060;padding-bottom:4px;margin:24px 0 12px}
h3{font-size:12px;color:#002060;margin-bottom:8px}
.subtitle{color:#666;font-size:11px;margin-bottom:20px}
.toc{background:#eef2ff;border:1px solid #c7d2fe;border-radius:6px;padding:12px 16px;margin-bottom:24px;display:inline-block}
.toc a{color:#3730a3;text-decoration:none;display:block;margin:2px 0;font-size:11px}
.toc a:hover{text-decoration:underline}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:18px}
.kpi-card{background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;text-align:center}
.kpi-label{font-size:10px;color:#64748b;margin-bottom:4px}
.kpi-value{font-size:18px;font-weight:700;color:#002060}
.kpi-sub{font-size:10px;color:#94a3b8}
.kpi-card.red .kpi-value{color:#dc2626}
.kpi-card.green .kpi-value{color:#16a34a}
.res-table{width:100%;border-collapse:collapse;max-width:680px;margin-bottom:18px;background:#fff}
.res-table th,.res-table td{border:1px solid #cbd5e1;padding:5px 10px;font-size:11px}
.res-table thead th{background:#002060;color:#fff;font-weight:600;text-align:left}
.res-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.charts-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
.chart-card{background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:12px}
.chart-card h3{margin-bottom:8px}
.chart-wrap{height:200px;position:relative}
.tops-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
.top-card{background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:12px;overflow:auto}
.data-table{width:100%;border-collapse:collapse;font-size:10.5px}
.data-table thead th{background:#002060;color:#fff;padding:5px 8px;text-align:left;position:sticky;top:0;white-space:nowrap}
.data-table tbody tr:nth-child(even){background:#f8fafc}
.data-table tbody td{padding:4px 8px;border-bottom:1px solid #f1f5f9}
td.mono{font-family:monospace;font-size:10px;white-space:nowrap}
td.prod{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
td.num{text-align:right;font-variant-numeric:tabular-nums}
tfoot td{font-weight:700;background:#dbeafe;padding:5px 8px;border-top:2px solid #002060}
.table-scroll{max-height:400px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:4px}
.filters-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;margin-bottom:12px}
.filters-bar label{font-size:10px;color:#64748b;margin-right:2px}
.filters-bar select{font-size:11px;border:1px solid #cbd5e1;border-radius:4px;padding:3px 6px;color:#1a1a2e;background:#fff}
.filters-bar button{font-size:11px;padding:4px 10px;border:1px solid #cbd5e1;border-radius:4px;background:#f1f5f9;cursor:pointer}
.filters-bar button:hover{background:#e2e8f0}
.dif-neg{color:#dc2626;font-weight:600}
.dif-pos{color:#16a34a;font-weight:600}
#badge{font-size:10px;color:#64748b;margin-left:auto}
.section-divider{margin:32px 0 8px;padding-top:8px;border-top:1px solid #e2e8f0}
@media print{
  .filters-bar,.no-print{display:none!important}
  body{background:#fff}
  h2{page-break-before:auto}
  .data-table tbody tr:nth-child(n+13){display:none!important}
  .chart-wrap{height:160px!important}
  .charts-grid,.tops-grid{grid-template-columns:1fr 1fr!important}
  @page{size:letter;margin:12mm}
}
</style>
</head>
<body>
<div class="page">

  <h1>📋 Análisis Final · Inventario ${year}</h1>
  <p class="subtitle">Ferretería Oviedo · El Manzano — ${fecha}</p>

  <!-- ÍNDICE -->
  <div class="toc">
    <strong style="font-size:11px;color:#002060">Índice</strong><br>
    <a href="#resumen">▸ Resumen Ejecutivo</a>
    <a href="#tops">▸ Top Faltantes y Sobrantes</a>
    <a href="#graficos">▸ Gráficos</a>
    <a href="#detalle">▸ Detalle Completo (${data.length.toLocaleString('es-CL')} filas)</a>
    <a href="#por-hiper">▸ Resumen por Hiperfamilia</a>
  </div>

  <!-- ══ SECCIÓN 1: RESUMEN EJECUTIVO ══ -->
  <h2 id="resumen">1 · Resumen Ejecutivo</h2>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total Productos</div>
      <div class="kpi-value">${data.length.toLocaleString('es-CL')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Unidades Sistema</div>
      <div class="kpi-value">${Math.round(k.us).toLocaleString('es-CL')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Unidades Conteo</div>
      <div class="kpi-value">${Math.round(k.ur).toLocaleString('es-CL')}</div>
    </div>
    <div class="kpi-card red">
      <div class="kpi-label">Faltantes</div>
      <div class="kpi-value">${falt.toLocaleString('es-CL')}</div>
      <div class="kpi-sub">$ ${Math.round(faltV).toLocaleString('es-CL')}</div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-label">Sobrantes</div>
      <div class="kpi-value">${sobr.toLocaleString('es-CL')}</div>
      <div class="kpi-sub">$ ${Math.round(sobrV).toLocaleString('es-CL')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Dispersión Total</div>
      <div class="kpi-value">${pctDisp !== null ? pctDisp.toFixed(2).replace('.',',') + '%' : '—'}</div>
      <div class="kpi-sub">$ ${Math.round(m.dispersion).toLocaleString('es-CL')}</div>
    </div>
  </div>

  <table class="res-table">
    <thead><tr><th>Concepto</th><th>Unidades</th><th>Valor $</th><th>EN %</th></tr></thead>
    <tbody>
      <tr><td><strong>Total Sistema</strong></td><td class="num">${Math.round(k.us).toLocaleString('es-CL')}</td><td class="num">$ ${Math.round(k.ps).toLocaleString('es-CL')}</td><td class="num">—</td></tr>
      <tr><td><strong>Total Conteo</strong></td><td class="num">${Math.round(k.ur).toLocaleString('es-CL')}</td><td class="num">$ ${Math.round(k.pr).toLocaleString('es-CL')}</td><td class="num">—</td></tr>
      <tr><td><strong>Diferencias</strong></td><td class="num">${k.du>=0?'+':''}${Math.round(k.du).toLocaleString('es-CL')}</td><td class="num">$ ${Math.round(m.difTotal).toLocaleString('es-CL')}</td><td class="num" style="text-align:right;font-weight:600;color:#dc2626">${pctDif !== null ? _pct(pctDif) : '—'}</td></tr>
      <tr><td><strong>Diferencias (+) sobrantes</strong></td><td class="num">${sobr.toLocaleString('es-CL')} prods</td><td class="num">$ ${Math.round(sobrV).toLocaleString('es-CL')}</td><td class="num" style="text-align:right;font-weight:600;color:#1d4ed8">${pctDifP !== null ? _pct(pctDifP) : '—'}</td></tr>
      <tr><td><strong>Diferencias (−) faltantes</strong></td><td class="num">${falt.toLocaleString('es-CL')} prods</td><td class="num">$ ${Math.round(faltV).toLocaleString('es-CL')}</td><td class="num" style="text-align:right;font-weight:600;color:#dc2626">${pctDifN !== null ? _pct(pctDifN) : '—'}</td></tr>
      <tr style="font-weight:700"><td><strong>Dispersión</strong></td><td class="num">${Math.round(k.adu).toLocaleString('es-CL')} unid</td><td class="num">$ ${Math.round(m.dispersion).toLocaleString('es-CL')}</td><td class="num" style="text-align:right;font-weight:600;color:#334155">${pctDisp !== null ? _pct(pctDisp) : '—'}</td></tr>
    </tbody>
  </table>

  <!-- ══ TOPS ══ -->
  <h2 id="tops">2 · Top Faltantes y Sobrantes</h2>
  <div class="tops-grid">
    <div class="top-card">
      <h3 style="color:#dc2626">Top 15 Faltantes — mayor impacto $</h3>
      <table class="data-table">
        <thead><tr><th>Codigo_tecnico</th><th>Descripcion</th><th class="num">DIFERENCIA</th><th class="num">DIFERENCIA $</th></tr></thead>
        <tbody>${mkTopRows(topFalt,'#dc2626')}</tbody>
      </table>
    </div>
    <div class="top-card">
      <h3 style="color:#16a34a">Top 15 Sobrantes — mayor impacto $</h3>
      <table class="data-table">
        <thead><tr><th>Codigo_tecnico</th><th>Descripcion</th><th class="num">DIFERENCIA</th><th class="num">DIFERENCIA $</th></tr></thead>
        <tbody>${mkTopRows(topSobr,'#16a34a')}</tbody>
      </table>
    </div>
  </div>

  <!-- ══ GRÁFICOS ══ -->
  <h2 id="graficos">3 · Gráficos</h2>
  <div class="charts-grid">
    <div class="chart-card"><h3>Dispersión $ por Marca</h3><div class="chart-wrap"><canvas id="rf-marca"></canvas></div></div>
    <div class="chart-card"><h3>Dispersión $ por Familia</h3><div class="chart-wrap"><canvas id="rf-familia"></canvas></div></div>
    <div class="chart-card"><h3>Unidades por Hiperfamilia</h3><div class="chart-wrap"><canvas id="rf-hiper"></canvas></div></div>
    <div class="chart-card"><h3>Faltantes vs Sobrantes por Hiperfamilia</h3><div class="chart-wrap"><canvas id="rf-barras"></canvas></div></div>
  </div>

  <!-- ══ SECCIÓN 2: DETALLE COMPLETO ══ -->
  <h2 id="detalle" class="section-divider">4 · Detalle Completo</h2>

  <!-- Filtros en cascada -->
  <div class="filters-bar no-print" id="rf-filters">
    <label>Hiperfamilia</label>
    <select id="rf-hiper-sel" onchange="rfCascada()">
      <option value="">Todas</option>${hiperOpts}
    </select>
    <label>Familia</label>
    <select id="rf-fam-sel" onchange="rfCascada()">
      <option value="">Todas</option>${famOpts}
    </select>
    <label>Subfamilia</label>
    <select id="rf-sub-sel" onchange="rfCascada()">
      <option value="">Todas</option>${subfamOpts}
    </select>
    <label>Marca</label>
    <select id="rf-marca-sel" onchange="rfCascada()">
      <option value="">Todas</option>${marcaOpts}
    </select>
    <button onclick="rfLimpiarFiltros()">Limpiar</button>
    <span id="badge"></span>
  </div>

  <div class="table-scroll" id="rf-tabla-wrap">
    <table class="data-table" id="rf-tabla">
      <thead>
        <tr>
          <th>Codigo_tecnico</th><th>Descripcion</th>
          <th class="num">CONTEO</th><th class="num">STOCK SISTEMA</th>
          <th class="num">DIFERENCIA</th><th class="num">DIFERENCIA $</th>
          <th>FAMILIA</th><th>HIPERFAMILIA</th><th>MARCA</th>
          <th>SUBFAMILIA</th><th>ZONA</th><th>ÁREA</th>
        </tr>
      </thead>
      <tbody id="rf-tbody"></tbody>
      <tfoot><tr id="rf-tfoot"></tr></tfoot>
    </table>
  </div>

  <!-- ══ POR HIPERFAMILIA ══ -->
  <h2 id="por-hiper" class="section-divider">5 · Resumen por Hiperfamilia</h2>
  <div class="table-scroll">
    <table class="data-table">
      <thead><tr>
        <th>Hiperfamilia</th>
        <th class="num">STOCK SISTEMA</th><th class="num">CONTEO</th><th class="num">DIFERENCIA</th>
        <th class="num">% Exactitud Unid</th>
        <th class="num">VALOR SISTEMA $</th><th class="num">VALOR CONTEO</th><th class="num">DIFERENCIA $</th>
        <th class="num">% Exactitud $</th>
      </tr></thead>
      <tbody>
        ${byHiper.map(g=>`<tr>
          <td>${g.fd?.perfamilia||g.key||'(sin cat.)'}</td>
          <td class="num">${Math.round(g.us).toLocaleString('es-CL')}</td>
          <td class="num">${Math.round(g.ur).toLocaleString('es-CL')}</td>
          <td class="num ${g.du<0?'dif-neg':g.du>0?'dif-pos':''}">${g.du>=0?'+':''}${Math.round(g.du).toLocaleString('es-CL')}</td>
          <td class="num">${(+g.exact_unid||0).toFixed(1)}%</td>
          <td class="num">$ ${Math.round(g.ps).toLocaleString('es-CL')}</td>
          <td class="num">$ ${Math.round(g.pr).toLocaleString('es-CL')}</td>
          <td class="num ${g.dp<0?'dif-neg':g.dp>0?'dif-pos':''}">$ ${Math.round(g.dp).toLocaleString('es-CL')}</td>
          <td class="num">${(+g.exact_peso||0).toFixed(1)}%</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

</div><!-- /page -->

<script>
// Dataset completo embebido
const RF_DATA = ${dataJSON};

// Render inicial de la tabla de detalle
function rfRenderTabla(rows) {
  const tbody = document.getElementById('rf-tbody');
  const tfoot = document.getElementById('rf-tfoot');
  if (!tbody) return;
  let totCo=0,totSis=0,totDifU=0,totDifP=0;
  tbody.innerHTML = rows.map(r => {
    totCo  += +(r.unidades_real||0);
    totSis += +(r.unidades_sistema||0);
    totDifU+= +(r.dif_unidades||0);
    totDifP+= +(r.dif_peso||0);
    const dc = r.dif_unidades<0?'dif-neg':r.dif_unidades>0?'dif-pos':'';
    const dp = r.dif_peso<0?'dif-neg':r.dif_peso>0?'dif-pos':'';
    return \`<tr>
      <td class="mono">\${r.codigo||''}</td>
      <td class="prod" title="\${(r.producto||'').replace(/"/g,'&quot;')}">\${(r.producto||'').substring(0,45)}</td>
      <td class="num">\${Math.round(r.unidades_real||0).toLocaleString('es-CL')}</td>
      <td class="num">\${Math.round(r.unidades_sistema||0).toLocaleString('es-CL')}</td>
      <td class="num \${dc}">\${r.dif_unidades>=0?'+':''}\${Math.round(r.dif_unidades||0).toLocaleString('es-CL')}</td>
      <td class="num \${dp}">$ \${Math.round(r.dif_peso||0).toLocaleString('es-CL')}</td>
      <td>\${r.familia||''}</td>
      <td>\${r.perfamilia||''}</td>
      <td>\${r.marca||''}</td>
      <td>\${r.subfamilia||''}</td>
      <td>\${r.zona||''}</td>
      <td>\${r.area||''}</td>
    </tr>\`;
  }).join('');
  const dc = totDifU<0?'dif-neg':totDifU>0?'dif-pos':'';
  const dp = totDifP<0?'dif-neg':totDifP>0?'dif-pos':'';
  tfoot.innerHTML = \`
    <td colspan="2">TOTAL (\${rows.length.toLocaleString('es-CL')} filas)</td>
    <td class="num">\${Math.round(totCo).toLocaleString('es-CL')}</td>
    <td class="num">\${Math.round(totSis).toLocaleString('es-CL')}</td>
    <td class="num \${dc}">\${totDifU>=0?'+':''}\${Math.round(totDifU).toLocaleString('es-CL')}</td>
    <td class="num \${dp}">$ \${Math.round(totDifP).toLocaleString('es-CL')}</td>
    <td colspan="6"></td>\`;
  document.getElementById('badge').textContent = \`\${rows.length.toLocaleString('es-CL')} / \${RF_DATA.length.toLocaleString('es-CL')} filas\`;
}

function rfGetFiltrado() {
  const h = document.getElementById('rf-hiper-sel')?.value || '';
  const f = document.getElementById('rf-fam-sel')?.value || '';
  const s = document.getElementById('rf-sub-sel')?.value || '';
  const m = document.getElementById('rf-marca-sel')?.value || '';
  return RF_DATA.filter(r =>
    (!h || (r.perfamilia||'') === h) &&
    (!f || (r.familia||'') === f) &&
    (!s || (r.subfamilia||'') === s) &&
    (!m || (r.marca||'') === m)
  );
}

function rfCascada() {
  const filtered = rfGetFiltrado();
  rfRenderTabla(filtered);
  rfRenderGraficos(filtered);
}

function rfLimpiarFiltros() {
  ['rf-hiper-sel','rf-fam-sel','rf-sub-sel','rf-marca-sel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  rfRenderTabla(RF_DATA);
  rfRenderGraficos(RF_DATA);
}

// Gráficos
const rfCharts = {};
function rfMkChart(id, type, labels, datasets, opts) {
  if (rfCharts[id]) { try { rfCharts[id].destroy(); } catch(e){} }
  const ctx = document.getElementById(id)?.getContext('2d');
  if (!ctx) return;
  rfCharts[id] = new Chart(ctx, { type, data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, ...opts } });
}

function rfRenderGraficos(rows) {
  // Agrupa por campo, suma adp (dispersión $)
  function agg(field, n) {
    const m = {};
    for (const r of rows) {
      const k = r[field] || '(sin cat.)';
      if (!m[k]) m[k] = 0;
      m[k] += Math.abs(r.dif_peso || 0);
    }
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,n||10);
  }
  const marca  = agg('marca', 12);
  const fam    = agg('familia', 12);
  const hiper  = agg('perfamilia', 12);

  rfMkChart('rf-marca', 'bar',
    marca.map(e=>e[0]), [{ data: marca.map(e=>Math.round(e[1])), backgroundColor: 'rgba(220,38,38,0.75)' }],
    { indexAxis:'y', scales:{ x:{ ticks:{ font:{size:9} } }, y:{ ticks:{ font:{size:9} } } } });

  rfMkChart('rf-familia', 'bar',
    fam.map(e=>e[0]), [{ data: fam.map(e=>Math.round(e[1])), backgroundColor: 'rgba(59,130,246,0.75)' }],
    { indexAxis:'y', scales:{ x:{ ticks:{ font:{size:9} } }, y:{ ticks:{ font:{size:9} } } } });

  rfMkChart('rf-hiper', 'doughnut',
    hiper.map(e=>e[0]),
    [{ data: hiper.map(e=>Math.round(e[1])), backgroundColor: ['#3b82f6','#ef4444','#10b981','#f59e0b','#6366f1','#ec4899','#14b8a6','#f97316','#8b5cf6','#84cc16','#06b6d4','#a855f7'] }],
    { plugins:{ legend:{ display:true, position:'right', labels:{font:{size:9}} } } });

  // Barras faltantes vs sobrantes por hiperfamilia
  const mF = {}, mS = {};
  for (const r of rows) {
    const k = r.perfamilia || '(sin cat.)';
    if (!mF[k]) { mF[k]=0; mS[k]=0; }
    if (r.dif_peso < 0) mF[k] += Math.abs(r.dif_peso);
    else if (r.dif_peso > 0) mS[k] += r.dif_peso;
  }
  const hiperKeys = Object.keys(mF).sort((a,b)=>(mF[b]+mS[b])-(mF[a]+mS[a])).slice(0,10);
  rfMkChart('rf-barras', 'bar', hiperKeys,
    [
      { label:'Faltantes $', data: hiperKeys.map(k=>Math.round(mF[k])), backgroundColor:'rgba(220,38,38,0.7)' },
      { label:'Sobrantes $', data: hiperKeys.map(k=>Math.round(mS[k])), backgroundColor:'rgba(22,163,74,0.7)' },
    ],
    { plugins:{ legend:{ display:true, labels:{font:{size:9}} } }, scales:{ x:{ ticks:{font:{size:8}} }, y:{ ticks:{font:{size:9}} } } });
}

// Inicializar
rfRenderTabla(RF_DATA);
rfRenderGraficos(RF_DATA);
<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { showToast('El navegador bloqueó la ventana emergente. Permite ventanas emergentes para esta app.', 'error'); return; }
  win.document.write(html);
  win.document.close();
}

// ── PRINT MODE ─────────────────────────────────────────────────
// Devuelve el data-mode de la vista visible actualmente
function getActiveViewMode() {
  const visible = document.querySelector('.view:not(.hidden)');
  if (visible) {
    const m = visible.getAttribute('data-mode');
    if (m) return m;
    // Fallback: extraer desde el id (view-2025 → '2025')
    const id = visible.id || '';
    if (id.startsWith('view-')) return id.replace('view-', '');
  }
  return null;
}

function printMode(mode) {
  const m = mode || getActiveViewMode();
  document.querySelectorAll('.view').forEach(v => v.classList.remove('print-active'));
  const el = document.getElementById(`view-${m}`);
  if (el) el.classList.add('print-active');
  window.print();
}

// ── EMAIL REPORT ───────────────────────────────────────────────
function emailReport(mode) {
  mode = mode || getActiveViewMode();
  const titles = {
    '2025': 'Análisis Inventario 2025',
    '2026': 'Análisis Inventario 2026',
    comparative: 'Comparativo 2025 vs 2026',
    checklist: 'CheckList Inventario',
    planos: 'Planos de Patentes',
    mejoras: 'Plan de Mejoras 2026',
    final: 'Análisis Final Inventario',
    reconteo: 'Centro de Reconteo',
  };

  // Modo final: leer cuadro RESULTADOS desde #final-resultados (no #kpi-final que no existe)
  if (mode === 'final') {
    const data = (state.data2026?.length ? state.data2026 : state.data2025) || [];
    if (!data.length) { showToast('No hay datos cargados para el informe final.', 'error'); return; }

    const k = calcKPIs(data);
    const m = calcMonetarySummary(data);
    let falt = 0, sobr = 0, faltV = 0, sobrV = 0;
    for (const r of data) {
      if (r.dif_unidades < 0) { falt++; faltV += Math.abs(r.dif_peso || 0); }
      else if (r.dif_unidades > 0) { sobr++; sobrV += Math.abs(r.dif_peso || 0); }
    }
    const year = state.data2026?.length ? '2026' : '2025';
    const pctDisp = m.totalSistema > 0 ? (m.dispersion / m.totalSistema * 100).toFixed(2) : '0.00';

    const resumen =
      `== RESULTADOS · Inventario ${year} ==\n` +
      `Total Sistema:            ${fmt(k.us)} unid  /  ${fmtMoney(k.ps)}\n` +
      `Total Conteo:             ${fmt(k.ur)} unid  /  ${fmtMoney(k.pr)}\n` +
      `Diferencia neta:          ${k.du>=0?'+':''}${fmt(k.du)} unid  /  ${fmtMoney(m.difTotal)}\n` +
      `Diferencias (+) sobrantes:${fmt(sobr)} prods  /  ${fmtMoney(sobrV)}\n` +
      `Diferencias (−) faltantes:${fmt(falt)} prods  /  ${fmtMoney(faltV)}\n` +
      `Dispersión total (|+|+|−|):${fmt(k.adu)} unid  /  ${fmtMoney(m.dispersion)}  (${pctDisp}% del sistema)\n`;

    const fecha = new Date().toLocaleDateString('es-CL');
    const subject = encodeURIComponent(`Análisis Final · El Manzano — ${fecha}`);
    const body = encodeURIComponent(
      `Análisis Final Inventario — Ferretería Oviedo · El Manzano\n` +
      `Fecha: ${new Date().toLocaleString('es-CL')}\n\n` +
      resumen +
      `\n— Adjuntar PDF —\n` +
      `Para adjuntar gráficos y cuadro final: usa el botón 🖨 Imprimir / PDF → Guardar como PDF, y adjunta el PDF aquí.\n` +
      `(Los navegadores no permiten adjuntar archivos vía mailto:)`
    );

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    return;
  }

  const kpiEl = document.getElementById(`kpi-${mode}`);
  let resumen = '';
  if (kpiEl) {
    kpiEl.querySelectorAll('.kpi-card').forEach(c => {
      const lbl = c.querySelector('.kpi-label')?.textContent || '';
      const val = c.querySelector('.kpi-value')?.textContent || '';
      resumen += `${lbl}: ${val}\n`;
    });
  }
  const subject = encodeURIComponent(`${titles[mode]} · El Manzano — ${new Date().toLocaleDateString('es-CL')}`);
  const body = encodeURIComponent(
    `Resumen ${titles[mode]} — Ferretería Oviedo · El Manzano\n` +
    `Fecha: ${new Date().toLocaleString('es-CL')}\n\n` +
    `${resumen || 'Ver reporte adjunto.'}\n\n` +
    `(Descarga el reporte HTML desde la app y adjúntalo a este correo)`
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

/* ═══════════════════════════════════════════════════════════════
   CHECKLIST / GANTT
   ═══════════════════════════════════════════════════════════════ */

// ── CARGA CHECKLIST ─────────────────────────────────────────────
async function loadChecklist(file) {
  showToast('Leyendo CheckList…', 'info');
  try {
    const data = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Leer como array 2D (con headers en fila)
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        res(raw);
      };
      reader.onerror = rej;
      reader.readAsArrayBuffer(file);
    });
    renderGantt(data);
    switchToMode('checklist');
    document.getElementById('status-checklist').textContent = 'Cargado';
    document.getElementById('status-checklist').className = 'upload-status ok';
    showToast('CheckList cargado ✓', 'ok');
  } catch (e) {
    showToast('Error al leer CheckList: ' + e.message, 'error');
  }
}

// ── RENDER GANTT ────────────────────────────────────────────────
function renderGantt(raw) {
  // Buscar fila de encabezados (contiene TAREAS)
  let headerRowIdx = raw.findIndex(r => r.some(c => /TAREAS/i.test(String(c))));
  if (headerRowIdx < 0) headerRowIdx = 0;
  const dayRowIdx = headerRowIdx + 1; // fila con números de días

  const dayRow = raw[dayRowIdx] || [];

  // Columnas fijas: task (col 0), responsable (col 1)
  // Columnas Gantt: desde col 2 en adelante (días -30,-29,...,0,1,...)
  const GANTT_START = 2;
  const ganttCols = dayRow.slice(GANTT_START).map((d, i) => ({ idx: i + GANTT_START, label: d }))
    .filter(col => {
      const v = String(col.label).trim();
      return v !== '' && v !== 'dias';
    });

  const table       = document.getElementById('gantt-table');
  const ganttSection= document.getElementById('gantt-section');

  // Clasificar día: negativo=pre, 0=hoy(inventario), positivo=post, SAB/DOM=fin semana
  const dayClass = v => {
    const s = String(v).trim();
    if (/sab|dom/i.test(s)) return 'col-weekend';
    const n = Number(s);
    if (!isNaN(n) && n === 0)  return 'col-today';
    if (!isNaN(n) && n > 0)    return 'col-pos';
    return 'col-neg';
  };

  // Contar tareas no vacías
  let taskCount = 0;
  for (let i = dayRowIdx + 1; i < raw.length; i++) {
    if (String(raw[i]?.[0] || '').trim()) taskCount++;
  }

  // HEAD
  let thead = '<thead>';
  // Fila con día 0 marcado especialmente
  const todayIdx = ganttCols.findIndex(c => String(c.label).trim() === '0');
  if (todayIdx >= 0) {
    thead += `<tr><td colspan="2" style="background:#0f172a"></td>`;
    ganttCols.forEach((col, i) => {
      thead += i === todayIdx
        ? `<th class="col-today" colspan="1" style="font-size:9px">DÍA 0</th>`
        : `<td style="background:#0f172a"></td>`;
    });
    thead += '</tr>';
  }
  thead += '<tr>';
  thead += `<th class="col-task">Tarea (${taskCount})</th>`;
  thead += `<th class="col-resp">Responsable</th>`;
  ganttCols.forEach(col => {
    const v = String(col.label).trim();
    thead += `<th class="${dayClass(v)}" title="Día ${v}">${v}</th>`;
  });
  thead += '</tr></thead>';

  // BODY — filas de datos (desde dayRowIdx+1)
  let tbody = '<tbody>';
  for (let i = dayRowIdx + 1; i < raw.length; i++) {
    const row  = raw[i];
    const task = String(row[0] || '').trim();
    const resp = String(row[1] || '').trim();
    if (!task) continue;

    tbody += `<tr>`;
    tbody += `<td class="td-task" title="${task}">${task}</td>`;
    tbody += `<td class="td-resp">${resp || '—'}</td>`;
    ganttCols.forEach(col => {
      const val  = row[col.idx];
      const dayV = String(dayRow[col.idx] || '').trim();
      const hasVal = val !== '' && val !== null && val !== undefined && String(val).trim() !== '';
      const isWknd = /sab|dom/i.test(dayV);
      if (isWknd)   tbody += `<td class="td-weekend"></td>`;
      else if (hasVal) tbody += `<td class="td-active" title="Día ${dayV}: ${val}"></td>`;
      else          tbody += `<td></td>`;
    });
    tbody += `</tr>`;
  }
  tbody += '</tbody>';

  table.innerHTML = thead + tbody;
  ganttSection.style.display = '';
}

// ── EXPORT CHECKLIST ────────────────────────────────────────────
function exportChecklistExcel() {
  const tables = ['gantt-table', 'table-correlativo'].filter(id => {
    const t = document.getElementById(id);
    return t && t.rows.length > 1;
  });
  if (!tables.length) { showToast('Sin datos para exportar', 'error'); return; }
  const wb = XLSX.utils.book_new();
  tables.forEach(id => {
    const ws = XLSX.utils.table_to_sheet(document.getElementById(id));
    XLSX.utils.book_append_sheet(wb, ws, id === 'gantt-table' ? 'Cronograma' : 'Correlativo');
  });
  XLSX.writeFile(wb, `CheckList_${today()}.xlsx`);
  showToast('Excel generado ✓', 'ok');
}

/* ═══════════════════════════════════════════════════════════════
   CORRELATIVO DE PATENTES
   ═══════════════════════════════════════════════════════════════ */

const corrState = {
  rows: [],         // [{area, zona, patente, responsable, correlativo, estado}]
  nextCorr: 1,
};

function initCorrelativoFromPlanos(patentes) {
  // patentes = [{area, zona, patente}]
  if (!patentes.length) return;
  // Solo agregar las que no existan ya
  patentes.forEach(p => {
    if (!corrState.rows.find(r => String(r.patente) === String(p.patente))) {
      corrState.rows.push({ ...p, responsable: '', correlativo: 0, estado: 'pending' });
    }
  });
  renderCorrelativo();
}

function renderCorrelativo() {
  const tbody = document.getElementById('corr-tbody');
  if (!tbody) return; // vista correlativo eliminada (V5.3) — evita TypeError que aborta DOMContentLoaded
  const empty = document.getElementById('corr-empty');
  if (!corrState.rows.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = corrState.rows.map((r, i) => {
    const corrDisp = r.correlativo ? `<span class="corr-num">${r.correlativo}</span>` : '—';
    const estadoMap = { pending: 'estado-pending', active: 'estado-active', done: 'estado-done' };
    const estadoLbl = { pending: 'Pendiente', active: 'En proceso', done: 'Completado' };
    return `<tr id="corr-row-${i}">
      <td class="num">${corrDisp}</td>
      <td>${r.zona || r.area || '—'}</td>
      <td><strong>${r.patente}</strong></td>
      <td><input type="text" value="${r.responsable}" placeholder="Responsable"
           style="border:1px solid var(--border);border-radius:5px;padding:3px 6px;font-size:11px;width:90px"
           onchange="corrState.rows[${i}].responsable=this.value"></td>
      <td><span class="estado-chip ${estadoMap[r.estado]}">${estadoLbl[r.estado]}</span></td>
      <td style="text-align:center">
        <input type="number" min="0" max="1" placeholder="0"
               value="${r.estado !== 'pending' ? 1 : ''}"
               onchange="handleCorrInput(${i}, this.value)"
               ${r.estado !== 'pending' ? 'disabled' : ''}>
      </td>
      <td style="text-align:center">
        ${r.estado === 'active'
          ? `<button class="btn btn-xs" style="background:var(--green);color:#fff" onclick="finalizarPatente(${i})">✓ Fin</button>`
          : r.estado === 'done' ? '<span style="color:var(--green);font-size:16px">✓</span>' : ''}
      </td>
    </tr>`;
  }).join('');

  const activas = corrState.rows.filter(r => r.estado !== 'pending').length;
  const el = document.getElementById('corr-counter');
  if (el) el.textContent = `${activas} iniciadas · ${corrState.rows.filter(r => r.estado === 'done').length} completadas`;
}

function handleCorrInput(idx, val) {
  const v = parseInt(val, 10);
  if (v !== 1) return;
  const r = corrState.rows[idx];
  if (r.estado !== 'pending') return;
  r.correlativo = corrState.nextCorr++;
  r.estado = 'active';
  renderCorrelativo();
  showToast(`Patente ${r.patente} → Correlativo ${r.correlativo}`, 'ok');
}

function finalizarPatente(idx) {
  corrState.rows[idx].estado = 'done';
  renderCorrelativo();
}

function resetCorrelativo() {
  if (!confirm('¿Reiniciar todos los correlativos?')) return;
  corrState.rows.forEach(r => { r.correlativo = 0; r.estado = 'pending'; });
  corrState.nextCorr = 1;
  renderCorrelativo();
}

function addCorrelatjvoRow() {
  corrState.rows.push({ zona: '', area: '', patente: '', responsable: '', correlativo: 0, estado: 'pending' });
  renderCorrelativo();
  // Editar la nueva fila
  const idx  = corrState.rows.length - 1;
  const row  = document.getElementById(`corr-row-${idx}`);
  if (row) {
    const cells = row.querySelectorAll('td');
    // Patente editable
    cells[2].innerHTML = `<input type="text" placeholder="N° patente" autofocus
      style="width:60px;border:1px solid var(--orange);border-radius:5px;padding:3px 6px;font-size:12px"
      onblur="corrState.rows[${idx}].patente=this.value;renderCorrelativo()">`;
    cells[2].querySelector('input').focus();
  }
}

function exportCorrelatjvoExcel() {
  const t = document.getElementById('table-correlativo');
  if (!t || t.rows.length < 2) { showToast('Sin datos', 'error'); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(t), 'Correlativo');
  XLSX.writeFile(wb, `Correlativo_Patentes_${today()}.xlsx`);
  showToast('Excel exportado ✓', 'ok');
}

/* ═══════════════════════════════════════════════════════════════
   PLANOS DE PATENTES — HTML HARDCODEADO
   ═══════════════════════════════════════════════════════════════ */

let planosPatentes = []; // [{patente, zona, area}] — poblado desde DOM al cargar

// ── PLANOS HARDCODEADOS (generado automáticamente) ──────────────

function _planoHtml_Sala_EXHIBICION() {
  return `<table class="plano-table"><colgroup><col style="width:50px"><col style="width:39px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:39px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:39px"><col style="width:26px"><col style="width:54px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:62px"><col style="width:26px"><col style="width:39px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:48px"><col style="width:26px"><col style="width:26px"><col style="width:45px"><col style="width:26px"><col style="width:39px"><col style="width:44px"><col style="width:26px"><col style="width:39px"><col style="width:64px"></colgroup><tbody><tr style="height:20px"><td colspan="49" style="background:#bfbfbf">Plano_patentes_Sala_EM</td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td colspan="10" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000">JARDIN</td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000">SMART</td><td style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000">CORDEL</td><td style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000"></td><td colspan="5" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000">HERRAMIENTAS</td><td colspan="5" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000">HERRAMIENTAS</td><td colspan="6" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000">BARRA CORTINA</td><td style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000"></td><td colspan="6" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000">MODULOS</td></tr><tr style="height:20px"><td rowspan="4" style="background:#FFFFFF;border-left:1px solid #000;border-right:1px solid #000">PPR</td><td rowspan="9" class="plano-patente" data-patente="4" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">4</td><td rowspan="2" colspan="12" class="plano-patente" data-patente="5" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">5</td><td rowspan="2" colspan="9" class="plano-patente" data-patente="6" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">6</td><td rowspan="2" colspan="2" class="plano-patente" data-patente="7" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">7</td><td rowspan="2" colspan="16" class="plano-patente" data-patente="8" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">8</td><td rowspan="2" colspan="2" class="plano-patente" data-patente="9" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">9</td><td rowspan="2" colspan="6" class="plano-patente" data-patente="10" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">10</td></tr><tr style="height:20px"></tr><tr style="height:20px"><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="6" style="background:#FF0000;border-top:1px solid #000;border-bottom:1px solid #000">RICARDO - VANESSA</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="2" style="background:#FFFFFF;border-top:1px solid #000">EINHEL</td><td></td><td></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td rowspan="10" class="plano-patente" data-patente="11" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">11</td></tr><tr style="height:20px"><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td rowspan="3" colspan="6" class="plano-patente" data-patente="55" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">55</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="6" style="background:#FFFFFF;border-right:1px solid #000">SHOWER</td></tr><tr style="height:20px"><td rowspan="4" style="background:#FFFFFF;border-left:1px solid #000;border-right:1px solid #000">HIDRA</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td colspan="4" style="background:#FFFFFF;border-bottom:1px solid #000">SIKA</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:25.8px"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="4" colspan="4" class="plano-patente" data-patente="50" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">50</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="64" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">64</td><td rowspan="2" colspan="6" class="plano-patente" data-patente="63" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">63</td><td rowspan="4" class="plano-patente" data-patente="54" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">54</td><td rowspan="4" style="background:#FFFFFF;border-left:1px solid #000">HOYADOR</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td rowspan="2" colspan="3" class="plano-patente" data-patente="62" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">62</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="61" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">61</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="60" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">60</td><td rowspan="4" colspan="2" class="plano-patente" data-patente="59" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">59</td><td rowspan="4" style="background:#FFFFFF;border-left:1px solid #000">MIXA</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:20px"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:20px"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="2" colspan="3" class="plano-patente" data-patente="51" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">51</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="52" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">52</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="53" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">53</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td rowspan="2" colspan="3" class="plano-patente" data-patente="56" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">56</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="57" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">57</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="58" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">58</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:20px"><td rowspan="9" style="background:#FFFFFF;border-left:1px solid #000;border-right:1px solid #000">EMPAQUE</td><td rowspan="9" class="plano-patente" data-patente="3" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">3</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="2" style="background:#FFFFFF;border-top:1px solid #000">FAS</td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:25.8px"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="6" style="background:#FFFFFF;border-bottom:1px solid #000">MEGABRIGTH</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:31.8px"><td></td><td></td><td></td><td></td><td rowspan="5" style="background:#FFFFFF"></td><td rowspan="5" style="background:#FFFFFF"></td><td rowspan="4" style="background:#FFFFFF;border-right:1px solid #000">WEBER</td><td rowspan="4" class="plano-patente" data-patente="33" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">33</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="49" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">49</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="48" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">48</td><td rowspan="2" colspan="6" class="plano-patente" data-patente="47" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">47</td><td rowspan="4" class="plano-patente" data-patente="38" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">38</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="2" style="background:#FFFFFF">BLACK</td><td rowspan="4" class="plano-patente" data-patente="39" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">39</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="46" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">46</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="45" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">45</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="44" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">44</td><td rowspan="4" colspan="2" class="plano-patente" data-patente="43" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">43</td><td rowspan="4" style="background:#FFFFFF;border-left:1px solid #000">MUEBLES</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="9" style="background:#FFFFFF;border-right:1px solid #000">BAÑO  ESPEJO</td><td rowspan="9" class="plano-patente" data-patente="12" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">12</td></tr><tr style="height:20px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="2" style="background:#FFFFFF">DECKER</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:20px"><td></td><td></td><td></td><td></td><td rowspan="2" colspan="3" class="plano-patente" data-patente="34" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">34</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="35" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">35</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="36" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">36</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="37" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">37</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="2" colspan="3" class="plano-patente" data-patente="40" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">40</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="41" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">41</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="42" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">42</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:20px"><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td style="background:#FFFFFF"></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:21px"><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td colspan="9" style="background:#FFFFFF;border-top:1px solid #000">PINTURA</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:20px"><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td rowspan="4" style="background:#FFFFFF"></td><td rowspan="4" style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:20px"><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td rowspan="5" style="background:#FFFFFF">SOQUINA</td><td colspan="12" style="background:#FFFFFF;border-bottom:1px solid #000">EINHEL - HYUNDAI</td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="3" style="background:#FFFFFF">ESTANTE</td><td rowspan="4" class="plano-patente" data-patente="24" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">24</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="32" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">32</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="31" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">31</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="30" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">30</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="29" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">29</td><td rowspan="4" style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:21px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td rowspan="2" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000"></td><td rowspan="2" colspan="3" style="background:#FFFFFF;border-left:1px solid #000">CAJA</td><td></td><td></td><td rowspan="3" colspan="12" class="plano-patente" data-patente="21" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">21</td><td rowspan="3" class="plano-patente" data-patente="22" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">22</td><td colspan="3" style="background:#FFFFFF;border-left:1px solid #000">ESTANTE</td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:21.600000000000005px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="2" colspan="3" class="plano-patente" data-patente="25" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">25</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="26" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">26</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="27" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">27</td><td rowspan="2" colspan="3" class="plano-patente" data-patente="28" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">28</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:21.600000000000005px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FF0000;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">B</td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="9" class="plano-patente" data-patente="13" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">13</td></tr><tr style="height:30px"><td style="background:#FFFFFF;border-left:1px solid #000">OF</td><td rowspan="2" colspan="2" class="plano-patente" data-patente="2" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">2</td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td style="background:#FFFFFF"></td><td rowspan="3" colspan="6" class="plano-patente" data-patente="23" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">23</td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="6" style="background:#FFFFFF;border-right:1px solid #000">BILDER</td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:20px"><td rowspan="5" style="background:#FFFFFF;border-left:1px solid #000;border-right:1px solid #000">TECLE</td><td rowspan="5" colspan="3" class="plano-patente" data-patente="1" style="background:#FFFFFF;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">1</td><td colspan="3" style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:20px"><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="6" style="background:#FF0000;border-top:1px solid #000">RAFA - GREGORIO</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:20px"><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:28.2px"><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:19.2px"><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="7" style="background:#FFFFFF;border-bottom:1px solid #000">GENERADOR</td><td colspan="7" style="background:#FFFFFF;border-bottom:1px solid #000">PARLANTES</td><td colspan="7" style="background:#FFFFFF;border-bottom:1px solid #000">HIDROLAVADORA</td><td colspan="7" style="background:#FFFFFF;border-bottom:1px solid #000">COMPRESOR</td><td></td><td colspan="4" style="background:#FFFFFF;border-bottom:1px solid #000">BOMBAS</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:19.2px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="2" colspan="3" class="plano-patente" data-patente="20" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">20</td><td rowspan="3" colspan="7" class="plano-patente" data-patente="19" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">19</td><td rowspan="3" colspan="7" class="plano-patente" data-patente="18" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">18</td><td rowspan="3" colspan="7" class="plano-patente" data-patente="17" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">17</td><td rowspan="3" colspan="7" class="plano-patente" data-patente="16" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">16</td><td rowspan="3" colspan="6" class="plano-patente" data-patente="15" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">15</td><td style="background:#FFFFFF;border-left:1px solid #000"></td></tr><tr style="height:19.2px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="2" colspan="2" class="plano-patente" data-patente="14" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">14</td></tr><tr style="height:28.2px"><td style="background:#FFFFFF;border-bottom:1px solid #000;border-left:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td colspan="6" style="background:#FFFFFF;border-bottom:1px solid #000">ENTRADA</td><td colspan="3" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000"></td></tr></tbody></table>`;
}

function _planoHtml_BODEGA_SALA() {
  return `<table class="plano-table"><colgroup><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:34px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:51px"><col style="width:26px"><col style="width:16px"><col style="width:16px"><col style="width:16px"><col style="width:16px"><col style="width:13px"><col style="width:19px"><col style="width:18px"><col style="width:18px"><col style="width:16px"><col style="width:16px"><col style="width:22px"><col style="width:22px"><col style="width:22px"><col style="width:22px"><col style="width:22px"><col style="width:22px"><col style="width:22px"><col style="width:22px"><col style="width:22px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:34px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:21px"><col style="width:31px"><col style="width:31px"><col style="width:31px"><col style="width:31px"><col style="width:31px"></colgroup><tbody><tr style="height:21px"><td colspan="93" style="background:#a6a6a6">Plano_patentes_1er.piso_bodega_A</td></tr><tr style="height:16.2px"><td style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td colspan="26" class="plano-patente" data-patente="100" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">100</td><td style="background:#FFFFFF;border-top:1px solid #000;border-left:3px double #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000;border-right:3px double #000"></td><td colspan="34" class="plano-patente" data-patente="106" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000">106</td><td rowspan="15" class="plano-patente" data-patente="107" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">107</td><td rowspan="15" class="plano-patente" data-patente="108" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">108</td><td rowspan="15" class="plano-patente" data-patente="109" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">109</td><td rowspan="15" class="plano-patente" data-patente="110" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">110</td><td rowspan="15" class="plano-patente" data-patente="111" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">111</td></tr><tr style="height:16.2px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:1px dashed #000;border-bottom:1px dashed #000;border-left:1px dashed #000;border-right:1px dashed #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="26" class="plano-patente" data-patente="99" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">99</td><td style="background:#FFFFFF;border-left:3px double #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:3px double #000"></td><td colspan="34" class="plano-patente" data-patente="105" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000">105</td></tr><tr style="height:16.2px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="26" class="plano-patente" data-patente="98" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">98</td><td style="background:#FFFFFF;border-left:3px double #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:3px double #000"></td><td colspan="34" class="plano-patente" data-patente="104" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000">104</td></tr><tr style="height:16.2px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="26" class="plano-patente" data-patente="97" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">97</td><td style="background:#FFFFFF;border-left:3px double #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:3px double #000"></td><td colspan="34" class="plano-patente" data-patente="103" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000">103</td></tr><tr style="height:16.2px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="26" class="plano-patente" data-patente="96" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">96</td><td rowspan="2" colspan="6" style="background:#FFFFFF">ENTRADA PEM</td><td colspan="34" class="plano-patente" data-patente="102" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">102</td></tr><tr style="height:16.2px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="26" class="plano-patente" data-patente="95" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">95</td><td colspan="34" class="plano-patente" data-patente="101" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">101</td></tr><tr style="height:11.4px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="7" class="plano-patente" data-patente="94" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">94</td><td rowspan="7" class="plano-patente" data-patente="93" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">93</td><td rowspan="7" class="plano-patente" data-patente="92" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">92</td><td rowspan="7" class="plano-patente" data-patente="91" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">91</td><td rowspan="7" class="plano-patente" data-patente="90" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">90</td><td rowspan="7" class="plano-patente" data-patente="89" style="background:#FFFF00;border-left:1px solid #000;border-right:1px solid #000">89</td><td rowspan="7" class="plano-patente" data-patente="88" style="background:#FFFF00;border-left:1px solid #000;border-right:1px solid #000">88</td><td rowspan="7" style="background:#FFFFFF;border-left:1px solid #000">CLAVOS</td><td></td><td></td><td></td><td style="background:#FFFFFF">FRAGUES Y TORNILLO</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="9" style="background:#FFFFFF;border-top:1px solid #000;border-right:1px solid #000">CLAVOS </td></tr><tr style="height:15px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="8" style="background:#FFFFFF">smart tools</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="8" style="background:#FFFFFF">smart tools</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr style="height:14.4px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr style="height:14.4px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="9" style="background:#FFFFFF;border-bottom:1px solid #000">CADENAS</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="8" style="background:#FFFFFF">LIJAS</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="10" style="background:#FFFFFF">PALAS/RASTRILLO</td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="2" colspan="14" class="plano-patente" data-patente="181" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">181</td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="2" colspan="8" class="plano-patente" data-patente="147" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">147</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td rowspan="2" colspan="10" class="plano-patente" data-patente="123" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">123</td><td style="background:#FFFF00"></td><td rowspan="12" style="background:#FFFFFF">LATEX - TECLE</td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="5" colspan="2" style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td rowspan="5" style="background:#FFFFFF">HOFFENS</td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFF00"></td><td></td><td></td></tr><tr style="height:15px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="6" class="plano-patente" data-patente="73" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">73</td><td colspan="15" class="plano-patente" data-patente="81" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">81</td><td rowspan="4" class="plano-patente" data-patente="87" style="background:#FFFF00;border-left:1px solid #000;border-right:1px solid #000">87</td><td rowspan="4" class="plano-patente" data-patente="86" style="background:#FFFF00;border-left:1px solid #000;border-right:1px solid #000">86</td><td rowspan="4" class="plano-patente" data-patente="85" style="background:#FFFF00;border-left:1px solid #000;border-right:1px solid #000">85</td><td rowspan="4" class="plano-patente" data-patente="84" style="background:#FFFF00;border-left:1px solid #000;border-right:1px solid #000">84</td><td rowspan="4" class="plano-patente" data-patente="83" style="background:#FFFF00;border-left:1px solid #000;border-right:1px solid #000">83</td><td rowspan="4" class="plano-patente" data-patente="82" style="background:#FFFF00;border-left:1px solid #000;border-right:1px solid #000">82</td><td rowspan="4" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">LISTEL</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="4" style="background:#FFFFFF;border-right:1px solid #000">HELLA</td><td rowspan="4" class="plano-patente" data-patente="182" style="background:#FFFF00;border-left:1px solid #000;border-right:1px solid #000">182</td><td rowspan="4" class="plano-patente" data-patente="183" style="background:#FFFF00;border-left:1px solid #000;border-right:1px solid #000">183</td><td rowspan="4" class="plano-patente" data-patente="184" style="background:#FFFF00;border-left:1px solid #000;border-right:1px solid #000">184</td><td rowspan="4" class="plano-patente" data-patente="185" style="background:#FFFF00;border-left:1px solid #000;border-right:1px solid #000">185</td><td rowspan="4" class="plano-patente" data-patente="186" style="background:#FFFF00;border-left:1px solid #000;border-right:1px solid #000">186</td><td rowspan="4" class="plano-patente" data-patente="187" style="background:#FFFF00;border-left:1px solid #000;border-right:1px solid #000">187</td><td rowspan="4" class="plano-patente" data-patente="188" style="background:#FFFF00;border-left:1px solid #000">188</td><td rowspan="4" class="plano-patente" data-patente="212" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">212</td><td rowspan="4" class="plano-patente" data-patente="211" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">211</td><td rowspan="4" class="plano-patente" data-patente="210" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">210</td><td rowspan="4" class="plano-patente" data-patente="209" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">209</td><td rowspan="4" class="plano-patente" data-patente="208" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">208</td><td rowspan="4" class="plano-patente" data-patente="207" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">207</td><td rowspan="4" class="plano-patente" data-patente="206" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">206</td><td rowspan="4" style="background:#FFFFFF">FERRO</td><td></td><td></td><td></td><td rowspan="16" class="plano-patente" data-patente="148" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">148</td><td rowspan="16" class="plano-patente" data-patente="149" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">149</td><td rowspan="16" class="plano-patente" data-patente="150" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">150</td><td rowspan="16" class="plano-patente" data-patente="151" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">151</td><td rowspan="16" class="plano-patente" data-patente="152" style="background:#FFFF00">152</td><td rowspan="4" class="plano-patente" data-patente="180" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">180</td><td rowspan="4" class="plano-patente" data-patente="179" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">179</td><td rowspan="4" class="plano-patente" data-patente="178" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">178</td><td rowspan="4" class="plano-patente" data-patente="177" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">177</td><td rowspan="4" class="plano-patente" data-patente="176" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">176</td><td rowspan="4" class="plano-patente" data-patente="175" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">175</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td rowspan="10">TAJAMAR</td><td rowspan="10" class="plano-patente" data-patente="124" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">124</td><td rowspan="10" class="plano-patente" data-patente="125" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">125</td><td rowspan="10" class="plano-patente" data-patente="126" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">126</td><td rowspan="10" class="plano-patente" data-patente="127" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">127</td><td rowspan="10" class="plano-patente" data-patente="128" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">128</td><td rowspan="10" class="plano-patente" data-patente="122" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">122</td><td rowspan="10" class="plano-patente" data-patente="121" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">121</td><td rowspan="10" class="plano-patente" data-patente="120" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">120</td><td rowspan="10" class="plano-patente" data-patente="119" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">119</td><td rowspan="10" class="plano-patente" data-patente="118" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">118</td><td rowspan="10" class="plano-patente" data-patente="117" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">117</td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="6" class="plano-patente" data-patente="72" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">72</td><td colspan="15" class="plano-patente" data-patente="80" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">80</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td rowspan="14" style="background:#FFFFFF;border-right:1px solid #000">ODIS</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td></tr><tr style="height:14.4px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="4" class="plano-patente" data-patente="71" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">71</td><td rowspan="2" colspan="2" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">CAJA</td><td colspan="13" class="plano-patente" data-patente="79" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">79</td><td rowspan="2" colspan="2" style="background:#FF0000;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">BAÑO</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td rowspan="7" style="background:#FFFFFF;border-right:1px solid #000">MANGUERA</td><td rowspan="8" class="plano-patente" data-patente="112" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">112</td><td rowspan="8" class="plano-patente" data-patente="113" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">113</td><td rowspan="8" class="plano-patente" data-patente="114" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">114</td><td rowspan="8" class="plano-patente" data-patente="115" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">115</td><td rowspan="8" class="plano-patente" data-patente="116" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">116</td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="4" class="plano-patente" data-patente="70" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">70</td><td colspan="13" class="plano-patente" data-patente="78" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">78</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td></tr><tr style="height:15.6px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="4" class="plano-patente" data-patente="69" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">69</td><td></td><td></td><td colspan="13" class="plano-patente" data-patente="77" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">77</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="24" class="plano-patente" data-patente="189" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">189</td><td rowspan="24" class="plano-patente" data-patente="190" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">190</td><td rowspan="24" class="plano-patente" data-patente="191" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">191</td><td rowspan="24" class="plano-patente" data-patente="192" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">192</td><td rowspan="24" class="plano-patente" data-patente="193" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">193</td><td rowspan="24" class="plano-patente" data-patente="194" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">194</td><td rowspan="24" class="plano-patente" data-patente="195" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">195</td><td rowspan="24" class="plano-patente" data-patente="196" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">196</td><td rowspan="24" class="plano-patente" data-patente="197" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">197</td><td rowspan="24" class="plano-patente" data-patente="205" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">205</td><td rowspan="24" class="plano-patente" data-patente="204" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">204</td><td rowspan="24" class="plano-patente" data-patente="203" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">203</td><td rowspan="24" class="plano-patente" data-patente="202" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">202</td><td rowspan="24" class="plano-patente" data-patente="201" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">201</td><td rowspan="24" class="plano-patente" data-patente="200" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">200</td><td rowspan="24" class="plano-patente" data-patente="199" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">199</td><td></td><td></td><td></td><td></td><td></td><td rowspan="12" class="plano-patente" data-patente="174" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">174</td><td rowspan="12" class="plano-patente" data-patente="173" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">173</td><td rowspan="12" class="plano-patente" data-patente="172" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">172</td><td rowspan="12" class="plano-patente" data-patente="171" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">171</td><td rowspan="12" class="plano-patente" data-patente="170" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">170</td><td rowspan="12" class="plano-patente" data-patente="169" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">169</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="4" class="plano-patente" data-patente="68" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">68</td><td></td><td></td><td colspan="13" class="plano-patente" data-patente="76" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">76</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td rowspan="5" style="background:#FFFFFF">PASSOL</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr style="height:15.6px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="4" class="plano-patente" data-patente="67" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">67</td><td></td><td></td><td colspan="13" class="plano-patente" data-patente="75" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">75</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="20" colspan="2" style="background:#FFFFFF">FULL SELLO - SIKA</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr style="height:15px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="4" class="plano-patente" data-patente="66" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">66</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="13" class="plano-patente" data-patente="74" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">74</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="4" class="plano-patente" data-patente="65" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">65</td><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="4" style="background:#FFFFFF;border-top:1px solid #000">HIDRA</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:15px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="16" style="background:#FFFFFF">COBRE</td><td></td><td></td><td></td><td></td><td rowspan="5" style="background:#FFFFFF">SIKA</td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="18" class="plano-patente" data-patente="129" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">129</td><td rowspan="18" class="plano-patente" data-patente="130" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">130</td><td rowspan="18" class="plano-patente" data-patente="131" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">131</td><td rowspan="18" class="plano-patente" data-patente="132" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">132</td><td rowspan="18" class="plano-patente" data-patente="133" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">133</td><td rowspan="18" class="plano-patente" data-patente="134" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">134</td><td rowspan="18" class="plano-patente" data-patente="135" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">135</td><td rowspan="18" class="plano-patente" data-patente="136" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">136</td><td rowspan="18" class="plano-patente" data-patente="137" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">137</td><td rowspan="18" class="plano-patente" data-patente="146" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">146</td><td rowspan="18" class="plano-patente" data-patente="145" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">145</td><td rowspan="18" class="plano-patente" data-patente="144" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">144</td><td rowspan="18" class="plano-patente" data-patente="143" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">143</td><td rowspan="18" class="plano-patente" data-patente="142" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">142</td><td rowspan="18" class="plano-patente" data-patente="141" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">141</td><td rowspan="18" class="plano-patente" data-patente="140" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">140</td><td rowspan="18" class="plano-patente" data-patente="139" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">139</td><td rowspan="18" class="plano-patente" data-patente="138" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">138</td><td rowspan="2" colspan="2" style="background:#FFFFFF;border-bottom:3px solid #000;border-right:3px solid #000"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="4" style="background:#FFFFFF">TORNILLOS</td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="12" class="plano-patente" data-patente="213" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">213</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td colspan="12" class="plano-patente" data-patente="214" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">214</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td colspan="12" class="plano-patente" data-patente="215" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">215</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="6" style="background:#FFFFFF">PPR</td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td colspan="12" class="plano-patente" data-patente="216" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">216</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td rowspan="12" style="background:#FFFFFF">STANLEY - CAL</td><td rowspan="12" class="plano-patente" data-patente="153" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">153</td><td rowspan="12" class="plano-patente" data-patente="154" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">154</td><td rowspan="12" class="plano-patente" data-patente="155" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">155</td><td rowspan="12" class="plano-patente" data-patente="156" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">156</td><td rowspan="12" class="plano-patente" data-patente="157" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">157</td><td rowspan="12" class="plano-patente" data-patente="158" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">158</td><td rowspan="12" class="plano-patente" data-patente="168" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">168</td><td rowspan="12" class="plano-patente" data-patente="167" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">167</td><td rowspan="12" class="plano-patente" data-patente="166" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">166</td><td rowspan="12" class="plano-patente" data-patente="165" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">165</td><td rowspan="12" class="plano-patente" data-patente="164" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">164</td><td rowspan="12" class="plano-patente" data-patente="163" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">163</td><td rowspan="12" class="plano-patente" data-patente="162" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">162</td><td rowspan="12" class="plano-patente" data-patente="161" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">161</td><td rowspan="12" class="plano-patente" data-patente="160" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">160</td><td rowspan="12" class="plano-patente" data-patente="159" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">159</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="3" style="background:#FFFFFF">SCHNEIDER</td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td colspan="4" style="background:#FFFFFF">HEMIC</td><td colspan="12" class="plano-patente" data-patente="220" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">220</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td rowspan="2" colspan="2" class="plano-patente" data-patente="224" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">224</td><td colspan="12" class="plano-patente" data-patente="221" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">221</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td colspan="12" class="plano-patente" data-patente="222" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">222</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td colspan="12" class="plano-patente" data-patente="223" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">223</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td rowspan="6" style="background:#FFFFFF">MTS</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td rowspan="12" colspan="2" class="plano-patente" data-patente="241" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">241</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td colspan="6" class="plano-patente" data-patente="232" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000">232</td><td colspan="11" class="plano-patente" data-patente="239" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">239</td><td rowspan="7" class="plano-patente" data-patente="240" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">240</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td rowspan="10" style="background:#FFFFFF;border-left:1px solid #000">DISCO LIJA</td><td style="background:#FFFFFF"></td><td></td><td colspan="6" class="plano-patente" data-patente="231" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">231</td><td colspan="11" class="plano-patente" data-patente="238" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">238</td><td rowspan="5" style="background:#FFFFFF;border-left:1px solid #000">MIX</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td></td><td colspan="6" class="plano-patente" data-patente="230" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">230</td><td colspan="11" class="plano-patente" data-patente="237" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">237</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td></td><td colspan="6" class="plano-patente" data-patente="229" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">229</td><td colspan="11" class="plano-patente" data-patente="236" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">236</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td></td><td colspan="6" class="plano-patente" data-patente="228" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">228</td><td colspan="11" class="plano-patente" data-patente="235" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">235</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td></td><td colspan="6" class="plano-patente" data-patente="227" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">227</td><td colspan="11" class="plano-patente" data-patente="234" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">234</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td></td><td colspan="6" class="plano-patente" data-patente="226" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">226</td><td colspan="11" class="plano-patente" data-patente="233" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">233</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td></td><td colspan="6" class="plano-patente" data-patente="225" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">225</td><td></td><td></td><td colspan="7" style="background:#FFFFFF;border-top:1px solid #000">GUANTES</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="16" class="plano-patente" data-patente="198" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">198</td><td></td><td></td><td></td><td></td><td></td><td colspan="12" style="background:#FFFFFF;border-right:2px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="18" style="background:#FFFFFF"></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td></td><td colspan="6" style="background:#FFFFFF;border-top:1px solid #000">CABLE</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="7" style="background:#FFFFFF">MIX</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="8" style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="7" style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="249" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">249</td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="6" style="background:#FFFFFF">PERFILES</td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="16" style="background:#FFFFFF;border-bottom:1px solid #000">BARNIZ - CERSTAIN - VITROLUX</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="20" class="plano-patente" data-patente="242" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">242</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="9" style="background:#FFFFFF;border-bottom:1px solid #000">DILUYENTE</td><td></td><td></td><td></td><td></td><td colspan="6" style="background:#FFFFFF;border-bottom:1px solid #000">SPRAY</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="20" class="plano-patente" data-patente="243" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">243</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="7" style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="14" class="plano-patente" data-patente="265" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">265</td><td colspan="9" class="plano-patente" data-patente="272" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">272</td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="20" class="plano-patente" data-patente="244" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">244</td><td colspan="11" style="background:#FFFFFF;border-bottom:1px solid #000;border-left:1px solid #000">ESM. SINTETICO</td><td style="background:#FFFFFF"></td><td colspan="9" style="background:#FFFFFF;border-bottom:1px solid #000">ANTICORROSIVO</td><td colspan="8" style="background:#FFFFFF;border-bottom:1px solid #000">STAIN PASSOL</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="15" style="background:#FFFFFF;border-bottom:1px solid #000">MIX PINTURA</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="14" class="plano-patente" data-patente="266" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">266</td><td colspan="9" class="plano-patente" data-patente="273" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">273</td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="20" class="plano-patente" data-patente="245" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">245</td><td colspan="11" class="plano-patente" data-patente="250" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000">250</td><td colspan="19" class="plano-patente" data-patente="255" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">255</td><td colspan="19" class="plano-patente" data-patente="260" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">260</td><td colspan="14" class="plano-patente" data-patente="267" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">267</td><td colspan="9" class="plano-patente" data-patente="274" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">274</td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="20" class="plano-patente" data-patente="246" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">246</td><td colspan="11" class="plano-patente" data-patente="251" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000">251</td><td colspan="19" class="plano-patente" data-patente="256" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">256</td><td colspan="19" class="plano-patente" data-patente="261" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">261</td><td colspan="14" class="plano-patente" data-patente="268" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000">268</td><td colspan="9" class="plano-patente" data-patente="275" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">275</td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="20" class="plano-patente" data-patente="247" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">247</td><td colspan="11" class="plano-patente" data-patente="252" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000">252</td><td colspan="19" class="plano-patente" data-patente="257" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">257</td><td colspan="19" class="plano-patente" data-patente="262" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">262</td><td colspan="14" class="plano-patente" data-patente="269" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000">269</td><td colspan="9" class="plano-patente" data-patente="276" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">276</td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td colspan="20" class="plano-patente" data-patente="248" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">248</td><td colspan="11" class="plano-patente" data-patente="253" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000">253</td><td colspan="19" class="plano-patente" data-patente="258" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">258</td><td colspan="19" class="plano-patente" data-patente="263" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">263</td><td colspan="14" class="plano-patente" data-patente="270" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000">270</td><td colspan="9" class="plano-patente" data-patente="277" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">277</td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-bottom:1px solid #000;border-left:1px solid #000"></td><td colspan="20" class="plano-patente" data-patente="248" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">248</td><td colspan="11" class="plano-patente" data-patente="254" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000">254</td><td colspan="19" class="plano-patente" data-patente="259" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">259</td><td colspan="19" class="plano-patente" data-patente="264" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">264</td><td colspan="14" class="plano-patente" data-patente="271" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000">271</td><td colspan="9" class="plano-patente" data-patente="278" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">278</td></tr></tbody></table>`;
}

function _planoHtml_BODEGA_2DO_PISO_SALA() {
  return `<table class="plano-table"><colgroup><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:40px"><col style="width:40px"><col style="width:40px"><col style="width:40px"><col style="width:40px"><col style="width:40px"><col style="width:40px"><col style="width:40px"><col style="width:40px"><col style="width:40px"><col style="width:40px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:40px"><col style="width:40px"><col style="width:40px"><col style="width:40px"><col style="width:40px"><col style="width:40px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"><col style="width:24px"></colgroup><tbody><tr style="height:15.6px"><td colspan="47" style="background:#a6a6a6;border-bottom:1px solid #000">Plano_patentes_2do.piso_bodega_A</td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:27px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td></td><td></td><td colspan="11" style="background:#FFFFFF;border-bottom:1px solid #000">ZAPATOS SEGURIDAD</td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="20" class="plano-patente" data-patente="342" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">342</td><td rowspan="7" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-right:1px solid #000"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:15.6px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="3" colspan="5" class="plano-patente" data-patente="376" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">376</td><td rowspan="3" colspan="5" class="plano-patente" data-patente="377" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">377</td><td rowspan="3" colspan="5" class="plano-patente" data-patente="378" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">378</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:15.6px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="4" style="background:#FFFFFF">REP. SANITARIO</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF">MIX MOLDURAS, BARRA CORTINA, CARRO TOLVA</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="4" style="background:#FFFFFF">PASTO SINTETICO</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:11.4px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:28.2px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="2" colspan="20" class="plano-patente" data-patente="342" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">342</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:28.2px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="3" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000">SERVIDOR</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="375" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">375</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="12" style="background:#FFFFFF;border-right:1px solid #000">SANITARIOS</td><td rowspan="12" class="plano-patente" data-patente="336" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">336</td><td rowspan="12" class="plano-patente" data-patente="337" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">337</td><td rowspan="12" class="plano-patente" data-patente="338" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">338</td><td rowspan="12" class="plano-patente" data-patente="339" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">339</td><td rowspan="12" class="plano-patente" data-patente="340" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">340</td><td rowspan="12" class="plano-patente" data-patente="341" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">341</td><td rowspan="12" class="plano-patente" data-patente="313" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">313</td><td rowspan="12" class="plano-patente" data-patente="312" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">312</td><td rowspan="12" class="plano-patente" data-patente="311" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">311</td><td rowspan="12" class="plano-patente" data-patente="310" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">310</td><td rowspan="12" class="plano-patente" data-patente="309" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">309</td><td style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000;border-right:1px solid #000"></td><td rowspan="12" class="plano-patente" data-patente="303" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">303</td><td rowspan="12" class="plano-patente" data-patente="304" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">304</td><td rowspan="12" class="plano-patente" data-patente="305" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">305</td><td rowspan="12" class="plano-patente" data-patente="306" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">306</td><td rowspan="12" class="plano-patente" data-patente="307" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">307</td><td rowspan="12" class="plano-patente" data-patente="308" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">308</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="7" style="background:#FFFFFF;border-left:1px solid #000">STHILL</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="10" style="background:#FFFFFF;border-right:1px solid #000">DEWALT</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="8" style="background:#FFFFFF;border-left:1px solid #000">BLIK</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="374" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">374</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="8" style="background:#FFFFFF;border-right:1px solid #000">HOFFENS</td><td rowspan="3" colspan="4" class="plano-patente" data-patente="363" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">363</td><td rowspan="3" colspan="4" class="plano-patente" data-patente="343" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">343</td><td rowspan="12" style="background:#FFFFFF;border-left:1px solid #000">SANITARIOS</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="373" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">373</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="362" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">362</td><td rowspan="3" colspan="4" class="plano-patente" data-patente="344" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">344</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="372" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">372</td><td rowspan="6" style="background:#FFFFFF;border-left:1px solid #000">SOLMAQ</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="361" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">361</td><td rowspan="3" colspan="4" class="plano-patente" data-patente="345" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">345</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="371" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">371</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="360" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">360</td><td rowspan="3" colspan="4" class="plano-patente" data-patente="346" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">346</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="11" style="background:#FFFFFF;border-right:1px solid #000">FAS - TEBI</td><td rowspan="12" class="plano-patente" data-patente="330" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">330</td><td rowspan="12" class="plano-patente" data-patente="331" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">331</td><td rowspan="12" class="plano-patente" data-patente="332" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">332</td><td rowspan="12" class="plano-patente" data-patente="333" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">333</td><td rowspan="12" class="plano-patente" data-patente="334" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">334</td><td rowspan="12" class="plano-patente" data-patente="335" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">335</td><td rowspan="12" class="plano-patente" data-patente="317" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">317</td><td rowspan="12" class="plano-patente" data-patente="316" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">316</td><td rowspan="12" class="plano-patente" data-patente="315" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">315</td><td rowspan="12" class="plano-patente" data-patente="314" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">314</td><td rowspan="5" style="background:#FFFFFF">HYUNDAI</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="12" class="plano-patente" data-patente="298" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">298</td><td rowspan="12" class="plano-patente" data-patente="299" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">299</td><td rowspan="12" class="plano-patente" data-patente="300" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">300</td><td rowspan="12" class="plano-patente" data-patente="301" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">301</td><td rowspan="12" class="plano-patente" data-patente="302" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">302</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="8" style="background:#FFFFFF;border-right:1px solid #000">AMESTY</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="5" style="background:#FFFFFF">BOSCH</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:14.4px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="370" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">370</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="359" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">359</td><td rowspan="3" colspan="4" class="plano-patente" data-patente="347" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">347</td><td rowspan="5" style="background:#FFFFFF;border-left:1px solid #000">DUCA</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="6" style="background:#FFFFFF;border-left:1px solid #000">ALBALUX</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="369" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">369</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="358" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">358</td><td rowspan="3" colspan="4" class="plano-patente" data-patente="348" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">348</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="5" style="background:#FFFFFF">REDBO</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="5" style="background:#FFFFFF">APOWER</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="368" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">368</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="357" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">357</td><td rowspan="3" colspan="4" class="plano-patente" data-patente="349" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">349</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="11" style="background:#FFFFFF;border-right:1px solid #000">RIEGO</td><td rowspan="11" style="background:#FFFFFF;border-left:1px solid #000">ILUMINACION</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="367" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">367</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="356" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">356</td><td rowspan="3" colspan="4" class="plano-patente" data-patente="350" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">350</td><td style="background:#FFFFFF"></td><td rowspan="12" colspan="2" style="background:#FFFFFF">MIXA HOFFENS</td><td rowspan="12" class="plano-patente" data-patente="324" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">324</td><td rowspan="12" class="plano-patente" data-patente="325" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">325</td><td rowspan="12" class="plano-patente" data-patente="326" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">326</td><td rowspan="12" class="plano-patente" data-patente="327" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">327</td><td rowspan="12" class="plano-patente" data-patente="328" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">328</td><td rowspan="12" class="plano-patente" data-patente="329" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">329</td><td rowspan="12" class="plano-patente" data-patente="322" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">322</td><td rowspan="12" class="plano-patente" data-patente="321" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">321</td><td rowspan="12" class="plano-patente" data-patente="320" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">320</td><td rowspan="12" class="plano-patente" data-patente="319" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">319</td><td rowspan="12" class="plano-patente" data-patente="318" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">318</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="10" class="plano-patente" data-patente="293" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">293</td><td rowspan="10" class="plano-patente" data-patente="294" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">294</td><td rowspan="10" class="plano-patente" data-patente="295" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">295</td><td rowspan="10" class="plano-patente" data-patente="296" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">296</td><td rowspan="10" class="plano-patente" data-patente="297" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">297</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="10" style="background:#FFFFFF">EINHELL</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="8" style="background:#FFFFFF">BLACK DECKER</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:14.4px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="366" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">366</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="355" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">355</td><td rowspan="3" colspan="4" class="plano-patente" data-patente="351" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">351</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="365" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">365</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="354" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">354</td><td rowspan="3" colspan="4" class="plano-patente" data-patente="352" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">352</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="4" style="background:#FFFFFF;border-left:1px solid #000">CASCO</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="3" colspan="4" class="plano-patente" data-patente="364" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">364</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="3" colspan="8" class="plano-patente" data-patente="353" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">353</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="12" class="plano-patente" data-patente="289" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">289</td><td rowspan="12" class="plano-patente" data-patente="290" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">290</td><td rowspan="12" class="plano-patente" data-patente="291" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">291</td><td rowspan="12" colspan="2" class="plano-patente" data-patente="292" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">292</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="6" style="background:#FFFFFF">CALEFONT</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td rowspan="2" colspan="4" class="plano-patente" data-patente="364" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">364</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="8" style="background:#FFFFFF;border-top:1px solid #000">MIX REPOSICION </td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="2" colspan="11" class="plano-patente" data-patente="323" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">323</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="6" style="background:#FFFFFF">ESPEJOS</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="7" style="background:#FFFFFF;border-bottom:1px solid #000">RUEDAS</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FF0000;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="5" colspan="2" class="plano-patente" data-patente="279" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">279</td><td colspan="7" class="plano-patente" data-patente="279" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-right:1px solid #000">279</td><td colspan="22" class="plano-patente" data-patente="284" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">284</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FF0000;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="7" class="plano-patente" data-patente="280" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-right:1px solid #000">280</td><td colspan="22" class="plano-patente" data-patente="285" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">285</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FF0000;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="7" class="plano-patente" data-patente="281" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-right:1px solid #000">281</td><td colspan="22" class="plano-patente" data-patente="286" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">286</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td style="background:#FF0000;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="7" class="plano-patente" data-patente="282" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-right:1px solid #000">282</td><td colspan="22" class="plano-patente" data-patente="287" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">287</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FF0000;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000"></td><td rowspan="2" colspan="8" style="background:#FFFFFF">ESCALERA ACCESO</td><td colspan="7" class="plano-patente" data-patente="283" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-right:1px solid #000">283</td><td colspan="22" class="plano-patente" data-patente="288" style="background:#92D050;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">288</td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="8" style="background:#FFFFFF">TERMO</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="7" style="background:#FFFFFF">CALEFONT</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-bottom:1px solid #000;border-left:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000;border-right:1px solid #000"></td><td></td><td></td><td></td><td></td></tr></tbody></table>`;
}

function _planoHtml_PATIO_CONSTRUCTOR() {
  return `<table class="plano-table"><colgroup><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:36px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:33px"><col style="width:36px"><col style="width:36px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:36px"><col style="width:36px"><col style="width:35px"><col style="width:37px"><col style="width:45px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"><col style="width:26px"></colgroup><tbody><tr style="height:15.75px"><td colspan="48" style="background:#a6a6a6">Plano_patentes_Patio_2</td></tr><tr style="height:15px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-bottom:3px double #000"></td><td rowspan="32" colspan="2" class="plano-patente" data-patente="397" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">397 MIX</td><td rowspan="2" colspan="5" class="plano-patente" data-patente="399" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">399 CD</td><td rowspan="37" colspan="2" class="plano-patente" data-patente="398" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">398 MIX</td><td rowspan="3" colspan="2" class="plano-patente" data-patente="411" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">411 MIX</td><td></td><td rowspan="3" colspan="13" class="plano-patente" data-patente="412" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">412 VOLCAN- SACOS Y AISLAPOL</td><td rowspan="3" colspan="3" style="background:#FF0000;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">GENERADOR</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="410" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">410</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td rowspan="5" colspan="2" style="background:#FFFFFF">POLI</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="3" colspan="8" class="plano-patente" data-patente="413" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">413  MADERA</td><td rowspan="4" colspan="3" class="plano-patente" data-patente="445" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">445 CARR -TAMBOR</td><td></td><td></td><td></td><td rowspan="4" style="background:#FFFFFF;border-right:1px solid #000">CERA</td><td rowspan="4" class="plano-patente" data-patente="447" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">447</td><td rowspan="4" class="plano-patente" data-patente="446" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">446</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="409" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">409</td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="3" colspan="8" class="plano-patente" data-patente="414" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">414 OSB - TERC</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td colspan="8" style="background:#FFFFFF;border-bottom:1px solid #000">TINETA - CERAMICA</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="14" class="plano-patente" data-patente="442" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">442</td><td rowspan="14" class="plano-patente" data-patente="443" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">443</td><td rowspan="14" class="plano-patente" data-patente="444" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">444</td><td rowspan="16" style="background:#FFFFFF;border-left:1px solid #000">CERAMICA</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="448" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">448</td><td rowspan="3" colspan="2" class="plano-patente" data-patente="451" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">451</td><td rowspan="3" colspan="2" class="plano-patente" data-patente="452" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">452</td><td rowspan="3" colspan="2" class="plano-patente" data-patente="453" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">453</td><td rowspan="3" colspan="2" class="plano-patente" data-patente="454" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">454</td><td rowspan="3" colspan="2" class="plano-patente" data-patente="455" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">455</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:14.4px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="408" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">408</td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="3" style="background:#FFFFFF">SIDING</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="5" class="plano-patente" data-patente="415" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">415 PUER Y AMES</td><td style="background:#FFFFFF"></td><td rowspan="5" colspan="2" class="plano-patente" data-patente="430" style="background:#FFFF00;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">430 META</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="449" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">449</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:14.4px"><td></td><td rowspan="8" colspan="3" style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="407" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">407</td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="416" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">416</td><td rowspan="9" colspan="2" class="plano-patente" data-patente="429" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">429 PUER</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="2" style="background:#FFFFFF">POLI</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="7" style="background:#FFFFFF;border-right:1px solid #000">TINETA</td><td rowspan="7" colspan="2" class="plano-patente" data-patente="456" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">456</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="450" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">450</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="406" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">406</td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="417" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">417</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="6" colspan="2" class="plano-patente" data-patente="431" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">431 PUER</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td colspan="2" style="background:#FFFFFF;border-top:1px solid #000">SIMPLISIMA</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="405" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">405</td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="418" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">418</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="7" style="background:#FFFFFF;border-right:1px solid #000">TINETA</td><td rowspan="7" colspan="2" class="plano-patente" data-patente="457" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">457</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="404" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">404</td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="419" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">419</td><td rowspan="7" colspan="2" class="plano-patente" data-patente="428" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">428 MALLA</td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="432" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">432 MOLD</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="2" colspan="3" class="plano-patente" data-patente="441" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">441</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td rowspan="4" colspan="2" class="plano-patente" data-patente="403" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">403</td><td></td><td></td><td rowspan="4" colspan="2" class="plano-patente" data-patente="420" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">420</td><td></td><td></td><td rowspan="4" colspan="2" class="plano-patente" data-patente="433" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">433 SLA BAÑO</td><td rowspan="4" colspan="2" class="plano-patente" data-patente="440" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">440</td><td rowspan="13" style="background:#FFFFFF;border-top:1px solid #000;border-left:1px solid #000">MUEBLE - SACOS</td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="9" style="background:#FFFFFF;border-bottom:1px solid #000">CERAMICAS</td><td></td><td></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="2" colspan="4" class="plano-patente" data-patente="460" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">460</td><td rowspan="2" colspan="4" class="plano-patente" data-patente="459" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">459</td><td rowspan="2" colspan="4" class="plano-patente" data-patente="458" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">458</td><td rowspan="2" colspan="3" style="background:#FF0000;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">GENERADOR</td></tr><tr style="height:14.4px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="402" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">402</td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="421" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">421</td><td rowspan="3" colspan="2" class="plano-patente" data-patente="426" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">426</td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="434" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">434 VOLCAN</td><td rowspan="3" colspan="2" class="plano-patente" data-patente="439" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">439</td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td></tr><tr style="height:15.6px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="462" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">462 TINETA</td><td rowspan="3" colspan="2" class="plano-patente" data-patente="461" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">461 MUEBLE</td><td rowspan="25" colspan="10" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">SALA DE VENTAS</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000;border-bottom:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td rowspan="7" style="background:#FFFFFF;border-left:1px solid #000">PLACA PVC</td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:14.4px"><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-top:3px double #000"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="401" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">401</td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="422" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">422</td><td rowspan="3" colspan="2" class="plano-patente" data-patente="425" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">425</td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="435" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">435 VOLCAN</td><td rowspan="3" colspan="2" class="plano-patente" data-patente="438" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">438</td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:14.4px"><td></td><td rowspan="2" colspan="3" style="background:#FF0000">GAS GRUA</td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="464" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">464 TINETA</td><td rowspan="3" colspan="2" class="plano-patente" data-patente="463" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">463 MUEBLE</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:14.4px"><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="400" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">400</td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="423" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">423</td><td rowspan="3" colspan="2" class="plano-patente" data-patente="424" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">424</td><td></td><td></td><td rowspan="3" colspan="2" class="plano-patente" data-patente="436" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">436 ONEPIECE</td><td rowspan="3" colspan="2" class="plano-patente" data-patente="437" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">437</td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:14.4px"><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="2" colspan="6" style="background:#FFFFFF">ENTRADA BOEGA SALA</td><td rowspan="2" class="plano-patente" data-patente="466" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">466</td><td rowspan="2" class="plano-patente" data-patente="465" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">465</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:14.4px"><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:14.4px"><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="3" style="background:#FFFFFF">CANAL</td><td></td><td rowspan="5" colspan="4" style="background:#FF0000;border-top:2px solid #000;border-left:2px solid #000">DESPACHO</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td rowspan="3" class="plano-patente" data-patente="471" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">471</td><td rowspan="3" class="plano-patente" data-patente="470" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">470</td><td rowspan="3" class="plano-patente" data-patente="469" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">469</td><td rowspan="3" class="plano-patente" data-patente="468" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">468</td><td rowspan="3" class="plano-patente" data-patente="467" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">467</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td colspan="3" style="background:#000000;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000">CASILLERO</td><td style="background:#FFFFFF"></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15.6px"><td rowspan="4" colspan="3" style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">COMEDOR</td><td style="background:#FFFFFF"></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td style="border-bottom:3px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="3" style="background:#FFFFFF;border-top:1px solid #000">BAÑO</td><td style="background:#FF0000;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">B</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="3" style="background:#FFFFFF">BODEGA</td><td colspan="3" class="plano-patente" data-patente="472" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">472</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td rowspan="2" colspan="3" class="plano-patente" data-patente="396" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">396</td><td colspan="3" style="background:#FFFFFF;border-left:1px solid #000">PILAR</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="7" class="plano-patente" data-patente="473" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">473</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td rowspan="2" colspan="3" class="plano-patente" data-patente="395" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">395</td><td colspan="3" style="background:#FFFFFF;border-left:1px solid #000">CADENA</td><td></td><td></td><td></td><td></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="4" style="background:#FFFFFF">BETONERA</td><td></td><td colspan="3" style="background:#FFFFFF">BASURERO</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="9" style="background:#FFFFFF">EXHIBICIONES</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15px"><td rowspan="2" colspan="3" class="plano-patente" data-patente="394" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">394</td><td colspan="3" style="background:#FFFFFF;border-left:1px solid #000">PILAR</td><td></td><td rowspan="5" style="background:#FFFFFF;border-right:1px solid #000">MALLA</td><td rowspan="5" class="plano-patente" data-patente="392" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">392</td><td rowspan="3" colspan="2" class="plano-patente" data-patente="391" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">391</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td></td><td></td><td></td><td></td><td colspan="3" style="background:#FFFFFF;border-left:1px solid #000">CADENA</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td style="background:#FFFFFF;border-left:1px solid #000"></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td rowspan="19" colspan="3" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">FOSAS 387</td><td></td><td></td><td></td><td></td><td rowspan="2" colspan="2" class="plano-patente" data-patente="390" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">390</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td></td><td></td><td></td><td></td><td rowspan="5" style="background:#FFFFFF;border-right:1px solid #000">MALLA</td><td rowspan="5" class="plano-patente" data-patente="393" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">393</td><td rowspan="3" colspan="2" class="plano-patente" data-patente="389" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">389</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:14.4px"><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td colspan="6" style="background:#FFFFFF;border-left:1px solid #000">MALLA 15X15 LISA</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="3" style="background:#FFFFFF;border-bottom:1px solid #000">ZINC ACA.</td><td colspan="3" style="background:#FFFFFF;border-bottom:1px solid #000">ZINC 5V</td><td colspan="4" style="background:#FFFFFF;border-bottom:1px solid #000">METALCOM</td><td colspan="4" style="background:#FFFFFF;border-bottom:1px solid #000">CABALLETE</td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td></td><td></td><td></td><td></td><td rowspan="2" colspan="2" class="plano-patente" data-patente="388" style="background:#FFFF00;border-top:1px solid #000;border-left:1px solid #000">388</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="3" class="plano-patente" data-patente="474" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">474</td><td colspan="3" class="plano-patente" data-patente="475" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">475</td><td></td><td colspan="4" class="plano-patente" data-patente="476" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">476</td><td colspan="4" class="plano-patente" data-patente="477" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">477</td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:20px"><td></td><td></td><td></td><td></td><td colspan="3" style="background:#FFFFFF;border-left:1px solid #000">MIX</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15px"><td colspan="5" style="background:#FFFFFF;border-bottom:1px solid #000;border-left:1px solid #000">ESTRIADO</td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="7" colspan="3" class="plano-patente" data-patente="478" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">478</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td colspan="6" class="plano-patente" data-patente="385" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">385</td><td style="background:#FFFFFF"></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td rowspan="6" colspan="2" class="plano-patente" data-patente="427" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">427 FISITERM</td><td rowspan="3" colspan="4" class="plano-patente" data-patente="384" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">384 2MM</td><td></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="3" style="background:#FFFFFF">TUBERIA</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="3" style="background:#FFFFFF">FIERRO</td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td rowspan="2" colspan="4" class="plano-patente" data-patente="383" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">383 3MM</td><td></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td rowspan="3" colspan="4" class="plano-patente" data-patente="382" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">382 MIX</td><td style="background:#FFFFFF"></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td rowspan="3" colspan="2" class="plano-patente" data-patente="386" style="background:#FFFF00;border-top:1px solid #000">386 tubo</td><td style="background:#FFFFFF"></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td></td><td colspan="9" style="background:#FFFFFF;border-bottom:1px solid #000">MALLAS CERCO 3MT Y 15X15</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td colspan="4" style="background:#FFFFFF;border-bottom:1px solid #000">METALCOM</td><td></td><td></td><td></td><td></td><td></td><td colspan="5" style="background:#FFFFFF">METALCOM</td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td style="background:#FFFFFF"></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td rowspan="2" colspan="10" class="plano-patente" data-patente="380" style="background:#FFFF00;border-top:1px solid #000;border-left:3px solid #000">380</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="2" colspan="15" class="plano-patente" data-patente="379" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">379</td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:16.8px"><td colspan="4" class="plano-patente" data-patente="381" style="background:#FFFF00;border-top:1px solid #000;border-bottom:1px solid #000;border-left:1px solid #000;border-right:1px solid #000">381</td><td style="background:#FFFFFF"></td><td style="background:#FFFF00;border-top:3px solid #000;border-bottom:3px solid #000;border-left:3px solid #000;border-right:3px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="background:#FFFFFF;border-right:1px solid #000"></td></tr><tr style="height:15px"><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000">PLETINA - LAMINADO</td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-top:1px solid #000;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td colspan="6" style="background:#FFFFFF;border-bottom:1px solid #000">ACCESO LOCAL</td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000"></td><td style="background:#FFFFFF;border-bottom:1px solid #000;border-right:1px solid #000"></td></tr></tbody></table>`;
}


function limpiarCachePlanos() {
  window._inventariadorPorPatente = new Map();
  window._patentesCargadas = new Set();
  applyPatenteCellStates();
  Object.keys(PLANO_SHEETS || {}).forEach(renderPlanoZonaProgress);
  showToast('Inventariador limpiado — plano reiniciado', 'ok');
}

const PLANO_SHEETS = {
  'Sala EXHIBICION':      _planoHtml_Sala_EXHIBICION,
  'BODEGA SALA':          _planoHtml_BODEGA_SALA,
  'BODEGA 2DO PISO SALA': _planoHtml_BODEGA_2DO_PISO_SALA,
  'PATIO CONSTRUCTOR':    _planoHtml_PATIO_CONSTRUCTOR
};

function renderPlanos() {
  const tabsEl    = document.getElementById('plano-tabs');
  const contentEl = document.getElementById('planos-content');
  const emptyEl   = document.getElementById('planos-empty');
  if (emptyEl) emptyEl.style.display = 'none';

  const sheetNames = Object.keys(PLANO_SHEETS);

  // Tabs
  tabsEl.innerHTML = sheetNames.map((name, i) =>
    `<button class="plano-tab-btn${i===0?' active':''}" data-sheet="${name}"
      onclick="switchPlanoTab('${name}')">${name}</button>`
  ).join('');

  // Contenido
  contentEl.innerHTML = sheetNames.map((name, i) =>
    `<div class="plano-sheet-wrap${i===0?'':' hidden'}" id="plano-sheet-${safeName(name)}" data-sheet="${name}">
      <div class="plano-zona-progress-bar" id="plano-prog-${safeName(name)}"></div>
      <div class="plano-overflow-wrap">${PLANO_SHEETS[name]()}</div>
    </div>`
  ).join('');

  // Poblar planosPatentes desde DOM para _buildCoverageZonas()
  planosPatentes = [...document.querySelectorAll('#planos-content .plano-patente')]
    .map(td => ({
      patente: td.dataset.patente,
      zona: td.closest('.plano-sheet-wrap')?.dataset.sheet || '',
      area: td.closest('.plano-sheet-wrap')?.dataset.sheet || '',
    }));

  applyPatenteCellStates();
  sheetNames.forEach(renderPlanoZonaProgress);
}

function switchPlanoTab(name) {
  document.querySelectorAll('.plano-tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.sheet === name));
  document.querySelectorAll('.plano-sheet-wrap').forEach(el =>
    el.classList.toggle('hidden', el.dataset.sheet !== name));
}

// ── CARGA DINÁMICA DE PLANOS (para actualización 2027+) ────────
async function loadPlanosFromFile(file) {
  showToast('Leyendo planos…', 'info');
  try {
    const buf = await file.arrayBuffer();
    const wb  = XLSX.read(new Uint8Array(buf), { type:'array', cellStyles:true });
    const SKIP_SHEETS = new Set(['REGISTROS','BUSQUEDA','busqueda','registro2026','SALA','PATIO','AREA 2','AREA 3','FAMILIA']);
    const sheets = wb.SheetNames.filter(n => !SKIP_SHEETS.has(n));
    if (!sheets.length) { showToast('Sin hojas de plano en el archivo', 'error'); return; }

    const tabsEl    = document.getElementById('plano-tabs');
    const contentEl = document.getElementById('planos-content');

    tabsEl.innerHTML = sheets.map((name, i) =>
      `<button class="plano-tab-btn${i===0?' active':''}" data-sheet="${name}"
         onclick="switchPlanoTab('${name}')">${name}</button>`
    ).join('');

    contentEl.innerHTML = sheets.map((name, i) => {
      const ws = wb.Sheets[name];
      if (!ws) return '';
      return `<div class="plano-sheet-wrap${i===0?'':' hidden'}"
                   id="plano-sheet-${safeName(name)}" data-sheet="${name}">
        <div class="plano-zona-progress-bar" id="plano-prog-${safeName(name)}"></div>
        <div class="plano-overflow-wrap">${_wsToPlanoHtml(ws)}</div>
      </div>`;
    }).join('');

    planosPatentes = [...document.querySelectorAll('#planos-content .plano-patente')]
      .map(td => ({
        patente: td.dataset.patente,
        zona: td.closest('.plano-sheet-wrap')?.dataset.sheet || '',
        area: td.closest('.plano-sheet-wrap')?.dataset.sheet || '',
      }));

    applyPatenteCellStates();
    sheets.forEach(renderPlanoZonaProgress);
    showToast(`Planos actualizados · ${sheets.length} hojas · ${planosPatentes.length} patentes ✓`, 'ok');
  } catch(e) {
    showToast('Error leyendo planos: ' + e.message, 'error');
  }
}

// Convierte una hoja xlsx a tabla HTML preservando merges, colores y bordes.
function _wsToPlanoHtml(ws) {
  if (!ws || !ws['!ref']) return '<p class="no-data">Hoja vacía</p>';
  const range  = XLSX.utils.decode_range(ws['!ref']);
  const merges = ws['!merges'] || [];

  // Construir mapa de spans y celdas a omitir
  const spanMap = {};
  const skipSet = new Set();
  merges.forEach(m => {
    spanMap[`${m.s.r},${m.s.c}`] = { rs: m.e.r - m.s.r + 1, cs: m.e.c - m.s.c + 1 };
    for (let r = m.s.r; r <= m.e.r; r++)
      for (let c = m.s.c; c <= m.e.c; c++)
        if (r !== m.s.r || c !== m.s.c) skipSet.add(`${r},${c}`);
  });

  // Columnas
  const cols = ws['!cols'] || [];
  const nCols = range.e.c - range.s.c + 1;
  const colgroup = Array.from({length: nCols}, (_, i) => {
    const col = cols[range.s.c + i] || {};
    const w = col.wpx || Math.round((col.wch || 5) * 7);
    return `<col style="width:${w}px">`;
  }).join('');

  let rows = '';
  for (let r = range.s.r; r <= range.e.r; r++) {
    const rowH = ws['!rows']?.[r]?.hpx || ws['!rows']?.[r]?.hpt || 15;
    let cells = '';
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (skipSet.has(`${r},${c}`)) continue;
      const addr = XLSX.utils.encode_cell({r, c});
      const cell = ws[addr];
      const v    = cell ? (cell.w !== undefined ? cell.w : String(cell.v ?? '')) : '';
      const sp   = spanMap[`${r},${c}`] || {};
      const rs   = sp.rs && sp.rs > 1 ? ` rowspan="${sp.rs}"` : '';
      const cs   = sp.cs && sp.cs > 1 ? ` colspan="${sp.cs}"` : '';

      // Color de fondo desde fill del archivo
      let style = '';
      const fg = cell?.s?.fill?.fgColor;
      if (fg) {
        const hex = (fg.rgb || '').replace(/^FF/i,'');
        if (hex && hex.length === 6 && hex.toUpperCase() !== 'FFFFFF' && hex.toUpperCase() !== '000000')
          style += `background:#${hex};`;
      }
      // Bordes
      const bd = cell?.s?.border || {};
      if (bd.top?.style)    style += 'border-top:1px solid #555;';
      if (bd.bottom?.style) style += 'border-bottom:1px solid #555;';
      if (bd.left?.style)   style += 'border-left:1px solid #555;';
      if (bd.right?.style)  style += 'border-right:1px solid #555;';

      // Detectar patente: celda empieza con 2-4 dígitos
      const patMatch = String(v).match(/^(\d{2,4})(\s|$)/);
      const patAttr  = patMatch ? ` class="plano-patente" data-patente="${patMatch[1]}"` : '';

      cells += `<td${rs}${cs}${patAttr}${style ? ` style="${style}"` : ''}>${v}</td>`;
    }
    rows += `<tr style="height:${rowH}px">${cells}</tr>`;
  }
  return `<table class="plano-table"><colgroup>${colgroup}</colgroup><tbody>${rows}</tbody></table>`;
}

function applyPatenteCellStates() {
  const contadas = window._patentesCargadas;
  const invMap   = window._inventariadorPorPatente;

  document.querySelectorAll('#planos-content .plano-patente').forEach(td => {
    const pat  = String(td.dataset.patente || td.textContent || '').trim();
    if (!pat) return;
    const norm = pat.toUpperCase();
    const num  = norm.match(/^(\d+)/)?.[1];
    const lista = contadas?.has(norm) || (num && contadas?.has(num));
    const inv   = invMap?.get(norm) || (num ? invMap?.get(num) : null);

    td.classList.remove('plano-patente-lista', 'plano-patente-pendiente');
    const oldBadge = td.querySelector('.plano-inv-badge');
    if (oldBadge) oldBadge.remove();

    if (lista) {
      td.classList.add('plano-patente-lista');
      if (inv) {
        const badge = document.createElement('div');
        badge.className = 'plano-inv-badge';
        badge.textContent = inv.split(' ')[0];
        td.appendChild(badge);
      }
    } else if (contadas) {
      td.classList.add('plano-patente-pendiente');
    }
  });
}

function renderPlanoZonaProgress(sheetName) {
  const container = document.querySelector(`#planos-content [data-sheet="${sheetName}"]`);
  if (!container) return;

  const patentes = [...container.querySelectorAll('.plano-patente')]
    .map(td => String(td.dataset.patente || '').trim()).filter(Boolean);
  const total = patentes.length;
  if (!total) return;

  const contadas = window._patentesCargadas;
  const listas = patentes.filter(p => {
    const norm = p.toUpperCase();
    const num  = norm.match(/^(\d+)/)?.[1];
    return contadas?.has(norm) || (num && contadas?.has(num));
  }).length;

  const pct   = Math.round(listas / total * 100);
  const color = pct === 100 ? '#059669' : pct >= 50 ? '#f59e0b' : '#ef4444';

  const progEl = document.getElementById(`plano-prog-${safeName(sheetName)}`);
  if (!progEl) return;
  progEl.innerHTML = `
    <div class="plano-prog-inner">
      <div class="plano-prog-stats">
        <span style="color:#059669;font-weight:700">✓ ${listas} contadas</span>
        <span style="color:#64748b">${total - listas} pendientes</span>
        <span style="color:${color};font-size:16px;font-weight:800;margin-left:auto">${pct}%</span>
      </div>
      <div class="plano-prog-track">
        <div class="plano-prog-fill" style="width:${pct}%;background:${color}"></div>
      </div>
    </div>`;
}

function exportPlanosExcel() {
  showToast('Los planos están hardcodeados — usa el archivo Excel original', 'info');
}
function exportSheetExcel() { exportPlanosExcel(); }
function countPatentesInSheet() { return 0; }

// ── UTILS PLANOS ────────────────────────────────────────────────
function safeName(s) { return s.replace(/[^a-zA-Z0-9]/g, '_'); }
function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ═══════════════════════════════════════════════════════════════
   ANÁLISIS AVANZADO 2025 · v2
   Ideas basadas en estructura real del proceso de inventario:
   - Resumen por Patente (equivalente a resumen por bodega SLC/PLC)
   - Segmentación por rango de costo unitario
   - Top 30 riesgo $ (base de datos ordenada por |diferencia $|)
   - Productos sin encontrar + fantasmas
   ═══════════════════════════════════════════════════════════════ */

function renderModeV2() {
  if (!state.data2025.length) {
    ['v2-patente-table','v2-costo-rangos','v2-riesgo-table','v2-especiales'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<p class="no-data">Carga datos 2025 para ver este análisis.</p>';
    });
    return;
  }
  renderFilters('2025');           // sincroniza chips en filters-2025v2
  const data = getFilteredData('2025');
  renderV2PatenteTable(data);
  renderV2CostoRangos(data);
  renderV2Riesgo(data);
  renderV2Especiales(data);
}

function renderV2PatenteTable(data) {
  const map = new Map();
  for (const r of data) {
    const key = r.patente || '—';
    if (!map.has(key)) map.set(key, { patente: key, total:0, corr:0, falt:0, sobr:0, vs:0, vc:0, dp:0, dn:0 });
    const g = map.get(key);
    g.total++;
    const du = r.dif_unidades || 0;
    if (du === 0) g.corr++; else if (du < 0) g.falt++; else g.sobr++;
    g.vs += r.peso_sistema || 0;
    g.vc += r.peso_real    || 0;
    const dp = r.dif_peso  || 0;
    if (dp > 0) g.dp += dp; else g.dn += dp;
  }

  const rows = [...map.values()].sort((a,b) => b.vs - a.vs);
  const el   = document.getElementById('v2-patente-table');
  if (!rows.length) { el.innerHTML = '<p class="no-data">Sin datos de patente.</p>'; return; }

  const cols = ['Patente','Prods','Correctos','%Exactos','Faltantes','%','Sobrantes','%','VALOR SISTEMA $','VALOR CONTEO','DIFERENCIA $','Dispersion $'];
  const numCols = new Set([1,2,3,4,5,6,7,8,9,10,11]);
  let html = `<div class="table-scroll"><table class="data-table" id="v2-pat-tbl">
    <thead><tr>${cols.map((c,i)=>`<th${numCols.has(i)?' class="num"':''}>${c}</th>`).join('')}</tr></thead><tbody>`;

  for (const g of rows) {
    const dif  = g.vc - g.vs;
    const disp = Math.abs(g.dp) + Math.abs(g.dn);
    html += `<tr>
      <td><strong>${g.patente}</strong></td>
      <td class="num">${fmt(g.total)}</td>
      <td class="num delta-pos">${fmt(g.corr)}</td><td class="num">${fmtPct(g.corr/g.total*100)}%</td>
      <td class="num delta-neg">${fmt(g.falt)}</td><td class="num">${fmtPct(g.falt/g.total*100)}%</td>
      <td class="num" style="color:#f59e0b">${fmt(g.sobr)}</td><td class="num">${fmtPct(g.sobr/g.total*100)}%</td>
      <td class="num">${fmtMoney(g.vs)}</td>
      <td class="num">${fmtMoney(g.vc)}</td>
      <td class="num ${dif<0?'delta-neg':'delta-pos'}">${fmtMoney(dif)}</td>
      <td class="num">${fmtMoney(disp)}</td>
    </tr>`;
  }
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function renderV2CostoRangos(data) {
  const conCosto = data.filter(r => (r.costo || 0) > 0);
  const el = document.getElementById('v2-costo-rangos');
  if (!conCosto.length) {
    el.innerHTML = '<p class="no-data">No hay datos de costo unitario en el archivo 2025.</p>';
    return;
  }

  const rangos = [
    { label: 'Bajo · < $1.000',            min: 0,      max: 1000 },
    { label: 'Medio · $1.000 – $10.000',   min: 1000,   max: 10000 },
    { label: 'Alto · $10.000 – $50.000',   min: 10000,  max: 50000 },
    { label: 'Caro · $50.000 – $100.000',  min: 50000,  max: 100000 },
    { label: 'Premium · > $100.000',        min: 100000, max: Infinity },
  ];

  const buckets = rangos.map(rng => {
    const items = conCosto.filter(r => r.costo >= rng.min && r.costo < rng.max);
    let corr=0, falt=0, sobr=0, vs=0, adp=0;
    for (const r of items) {
      const du = r.dif_unidades || 0;
      if (du === 0) corr++; else if (du < 0) falt++; else sobr++;
      vs  += r.peso_sistema  || 0;
      adp += r.abs_dif_peso  || 0;
    }
    return { ...rng, total: items.length, corr, falt, sobr, vs, adp,
             exact: items.length ? corr / items.length * 100 : 0 };
  }).filter(b => b.total > 0);

  const cols = ['Segmento Precio Unitario','Prods','Correctos','% Exactos','Faltantes','Sobrantes','Valor Sist.','Dispersión $'];
  const numCols2 = new Set([1,2,3,4,5,6,7]);
  let html = `<div class="table-scroll"><table class="data-table">
    <thead><tr>${cols.map((c,i)=>`<th${numCols2.has(i)?' class="num"':''}>${c}</th>`).join('')}</tr></thead><tbody>`;

  for (const b of buckets) {
    const sem = b.exact >= 95 ? 'delta-pos' : b.exact >= 85 ? '' : 'delta-neg';
    html += `<tr>
      <td><strong>${b.label}</strong></td>
      <td class="num">${fmt(b.total)}</td>
      <td class="num delta-pos">${fmt(b.corr)}</td>
      <td class="num ${sem}">${fmtPct(b.exact)}%</td>
      <td class="num delta-neg">${fmt(b.falt)}</td>
      <td class="num" style="color:#f59e0b">${fmt(b.sobr)}</td>
      <td class="num">${fmtMoney(b.vs)}</td>
      <td class="num">${fmtMoney(b.adp)}</td>
    </tr>`;
  }
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function renderV2Riesgo(data) {
  const enriched = data
    .map(r => ({
      ...r,
      riesgo: r.abs_dif_peso > 0 ? r.abs_dif_peso
        : (r.costo || 0) * (r.abs_dif_unidades || 0)
    }))
    .filter(r => r.riesgo > 0)
    .sort((a,b) => b.riesgo - a.riesgo)
    .slice(0, 30);

  const el = document.getElementById('v2-riesgo-table');
  if (!enriched.length) { el.innerHTML = '<p class="no-data">Sin diferencias monetarias registradas.</p>'; return; }

  const cols = ['#','Código','Producto','Hiperfamilia','Patente','Área','STOCK SISTEMA','CONTEO','DIFERENCIA','Costo Unit.','DIFERENCIA $'];
  const numColsR = new Set([0,6,7,8,9,10]);
  let html = `<div class="table-scroll"><table class="data-table" id="v2-riesgo-tbl">
    <thead><tr>${cols.map((c,i)=>`<th${numColsR.has(i)?' class="num"':''}>${c}</th>`).join('')}</tr></thead><tbody>`;

  enriched.forEach((r, i) => {
    const dCls = r.dif_unidades < 0 ? 'delta-neg' : 'delta-pos';
    html += `<tr>
      <td class="num">${i+1}</td>
      <td style="font-family:monospace;font-size:11px">${r.codigo || '—'}</td>
      <td title="${r.producto||''}">${(r.producto || '—').substring(0,40)}</td>
      <td>${r.perfamilia || '—'}</td>
      <td>${r.patente || '—'}</td>
      <td>${r.area || '—'}</td>
      <td class="num">${fmt(r.unidades_sistema)}</td>
      <td class="num">${fmt(r.unidades_real)}</td>
      <td class="num ${dCls}">${r.dif_unidades >= 0 ? '+':''}${fmt(r.dif_unidades)}</td>
      <td class="num">${r.costo > 0 ? fmtMoney(r.costo) : '—'}</td>
      <td class="num delta-neg"><strong>${fmtMoney(r.riesgo)}</strong></td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function renderV2Especiales(data) {
  const perdidos  = data
    .filter(r => (r.unidades_sistema || 0) > 0 && (r.unidades_real || 0) === 0)
    .sort((a,b) => (b.peso_sistema || 0) - (a.peso_sistema || 0));
  const fantasmas = data
    .filter(r => (r.unidades_sistema || 0) <= 0 && (r.unidades_real || 0) > 0)
    .sort((a,b) => (b.unidades_real || 0) - (a.unidades_real || 0));

  const makeBlock = (rows, title, cls, tblId) => {
    let html = `<div class="v2-especial-block">
      <div class="v2-especial-header ${cls}">
        ${title} <span class="v2-especial-count">${rows.length} productos</span>
      </div>`;
    if (!rows.length) {
      return html + '<p class="no-data" style="margin:8px 0 16px">No hay registros en esta categoría.</p></div>';
    }
    const cols = ['#','Código','Producto','Hiperfamilia','Marca','Patente','Área','STOCK SISTEMA','CONTEO','VALOR SISTEMA $'];
    html += `<div class="tbl-wrap"><table class="tbl" id="${tblId}">
      <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>`;
    rows.slice(0, 50).forEach((r, i) => {
      html += `<tr>
        <td>${i+1}</td>
        <td>${r.codigo || '—'}</td>
        <td>${r.producto || '—'}</td>
        <td>${r.perfamilia || '—'}</td>
        <td>${r.marca || '—'}</td>
        <td>${r.patente || '—'}</td>
        <td>${r.area || '—'}</td>
        <td>${fmt(r.unidades_sistema)}</td>
        <td>${fmt(r.unidades_real)}</td>
        <td>${fmtMoney(r.peso_sistema)}</td>
      </tr>`;
    });
    if (rows.length > 50)
      html += `<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:8px">... y ${rows.length - 50} productos más</td></tr>`;
    html += '</tbody></table></div></div>';
    return html;
  };

  document.getElementById('v2-especiales').innerHTML =
    makeBlock(perdidos,  '🔴 Sin Encontrar — stock en sistema, conteo = 0', 'v2-esp-neg',  'v2-perdidos-tbl') +
    makeBlock(fantasmas, '👻 Fantasmas — sin stock en sistema, fueron contados', 'v2-esp-warn', 'v2-fantasmas-tbl');
}

/* ═══════════════════════════════════════════════════════════════
   ANÁLISIS FINAL — informe para el dueño
   ═══════════════════════════════════════════════════════════════ */
function renderAnalisisFinal() {
  const data = (state.data2026?.length ? state.data2026 : state.data2025) || [];
  const year = state.data2026?.length ? '2026' : '2025';
  const emptyEl = document.getElementById('final-empty');

  if (!data.length) {
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  _renderCoverageBanner(data, 'final');

  const k = calcKPIs(data);
  const m = calcMonetarySummary(data);
  let falt = 0, sobr = 0, faltV = 0, sobrV = 0;
  for (const r of data) {
    if (r.dif_unidades < 0) { falt++; faltV += Math.abs(r.dif_peso || 0); }
    else if (r.dif_unidades > 0) { sobr++; sobrV += Math.abs(r.dif_peso || 0); }
  }

  // ── Cuadro RESULTADOS ──────────────────────────────────────────
  const resEl = document.getElementById('final-resultados');
  if (resEl) {
    const pctDisp = m.totalSistema > 0 ? (m.dispersion / m.totalSistema * 100).toFixed(2) : '0.00';
    const pctFalt = k.us > 0 ? (Math.abs(data.reduce((s,r)=>s+(r.dif_unidades<0?r.dif_unidades:0),0))/k.us*100).toFixed(2) : '0.00';
    const pctSobr = k.us > 0 ? (data.reduce((s,r)=>s+(r.dif_unidades>0?r.dif_unidades:0),0)/k.us*100).toFixed(2) : '0.00';
    resEl.innerHTML = `
      <div class="section-card">
        <div class="section-card-header">
          <h3>📊 Resumen RESULTADOS · Inventario ${year}</h3>
        </div>
        <table class="data-table" style="max-width:680px">
          <thead><tr><th>Concepto</th><th class="num">Unidades</th><th class="num">Valor $</th><th class="num">%</th></tr></thead>
          <tbody>
            <tr><td><strong>Total Sistema</strong></td><td class="num">${fmt(k.us)}</td><td class="num">${fmtMoney(k.ps)}</td><td class="num">—</td></tr>
            <tr><td><strong>Total Conteo</strong></td><td class="num">${fmt(k.ur)}</td><td class="num">${fmtMoney(k.pr)}</td><td class="num">—</td></tr>
            <tr><td><strong>Diferencias</strong></td><td class="num">${k.du>=0?'+':''}${fmt(k.du)}</td><td class="num">${fmtMoney(m.difTotal)}</td><td class="num">—</td></tr>
            <tr style="color:var(--green)"><td><strong>Diferencias (+) sobrantes</strong></td><td class="num">${fmt(sobr)} prods</td><td class="num">${fmtMoney(sobrV)}</td><td class="num">${pctSobr}%</td></tr>
            <tr style="color:var(--red)"><td><strong>Diferencias (−) faltantes</strong></td><td class="num">${fmt(falt)} prods</td><td class="num">${fmtMoney(faltV)}</td><td class="num">${pctFalt}%</td></tr>
            <tr style="font-weight:700"><td><strong>Dispersion</strong></td><td class="num">${fmt(k.adu)} unid</td><td class="num">${fmtMoney(m.dispersion)}</td><td class="num">${pctDisp}%</td></tr>
          </tbody>
        </table>
      </div>`;
  }

  // ── Top sobrantes y faltantes ──────────────────────────────────
  const topsEl = document.getElementById('final-tops-grid');
  if (topsEl) {
    const topFalt = [...data].filter(r=>r.dif_peso<0).sort((a,b)=>a.dif_peso-b.dif_peso).slice(0,15);
    const topSobr = [...data].filter(r=>r.dif_peso>0).sort((a,b)=>b.dif_peso-a.dif_peso).slice(0,15);
    const mkRows = (arr, colorStyle) => arr.map(r => `
      <tr>
        <td class="mono-sm">${r.codigo||'—'}</td>
        <td>${trunc(r.producto||'—',35)}</td>
        <td class="num" style="color:${colorStyle}">${r.dif_unidades>=0?'+':''}${fmt(r.dif_unidades)}</td>
        <td class="num" style="color:${colorStyle}">${fmtMoney(r.dif_peso)}</td>
      </tr>`).join('');
    topsEl.innerHTML = `
      <div class="chart-card">
        <h4 style="color:var(--red)">Top 15 Faltantes (mayor impacto $)</h4>
        <div class="table-scroll" style="max-height:320px">
          <table class="data-table"><thead><tr><th>Código</th><th>Producto</th><th class="num">DIFERENCIA</th><th class="num">DIFERENCIA $</th></tr></thead>
          <tbody>${mkRows(topFalt,'var(--red)')}</tbody></table>
        </div>
      </div>
      <div class="chart-card">
        <h4 style="color:var(--green)">Top 15 Sobrantes (mayor impacto $)</h4>
        <div class="table-scroll" style="max-height:320px">
          <table class="data-table"><thead><tr><th>Código</th><th>Producto</th><th class="num">DIFERENCIA</th><th class="num">DIFERENCIA $</th></tr></thead>
          <tbody>${mkRows(topSobr,'var(--green)')}</tbody></table>
        </div>
      </div>`;
  }

  // ── Gráficos ──────────────────────────────────────────────────
  _renderFinalChart('chart-final-marca',   data, 'marca',      false);
  _renderFinalChart('chart-final-familia', data, 'familia',    false);
  _renderFinalChart('chart-final-hiper',   data, 'perfamilia', true);
  _renderFinalBarras('chart-final-barras', data);

  // ── Tabla DATOS_FALTANTES ─────────────────────────────────────
  const faltantes = [...data].filter(r=>r.dif_unidades<0 || r.dif_peso<0)
    .sort((a,b)=>(a.dif_peso||0)-(b.dif_peso||0));
  buildTable('final-faltantes-tbl',
    ['Codigo_tecnico','Descripcion','CONTEO','STOCK SISTEMA','DIFERENCIA','DIFERENCIA $','FAMILIA','MARCA'],
    faltantes.slice(0,200).map(r=>[
      r.codigo||'', trunc(r.producto||'',40),
      cNum(r.unidades_real), cNum(r.unidades_sistema),
      cNum(r.dif_unidades), cNum(r.dif_peso),
      r.familia||'', r.perfamilia||'', r.marca||'',
    ]));

  // ── Tabla dinamica_HIPER ───────────────────────────────────────
  const byHiper = aggregateBy(data, 'perfamilia').sort((a,b)=>b.adp-a.adp);
  buildTable('final-hiper-tbl',
    ['FAMILIA','STOCK SISTEMA','CONTEO','DIFERENCIA','% Exactitud Unid',
     'VALOR SISTEMA $','VALOR CONTEO','DIFERENCIA $','% Exactitud $'],
    byHiper.map(g=>[
      g.fd?.perfamilia||g.key||'(sin cat.)',
      cNum(g.us), cNum(g.ur), cNum(g.du),
      cPct(g.exact_unid),
      cNum(g.ps), cNum(g.pr), cNum(g.dp),
      cPct(g.exact_peso),
    ]));
}

function _renderFinalChart(canvasId, data, field, isPie) {
  const old = state.charts[canvasId];
  if (old) { try { old.destroy(); } catch(e){} }

  const byField = aggregateBy(data, field).sort((a,b)=>b.adp-a.adp).slice(0,10);
  if (!byField.length) return;

  const labels = byField.map(g=>trunc(g.fd?.[field]||g.key||'(sin cat.)',20));
  const vals   = byField.map(g=>Math.round(g.adp));
  const colors = vals.map(() => 'rgba(220,38,38,0.75)');

  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  state.charts[canvasId] = new Chart(ctx, {
    type: isPie ? 'doughnut' : 'bar',
    data: {
      labels,
      datasets: [{
        data: vals,
        backgroundColor: isPie
          ? ['#3b82f6','#ef4444','#f59e0b','#10b981','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1']
          : colors,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: isPie } },
      ...(isPie ? {} : { indexAxis: 'y', scales: { x: { ticks: { callback: v => '$'+Math.abs(v/1000).toFixed(0)+'K' } } } }),
    },
  });
}

function _renderFinalBarras(canvasId, data) {
  const old = state.charts[canvasId];
  if (old) { try { old.destroy(); } catch(e){} }

  const byFam = aggregateBy(data, 'familia').sort((a,b)=>b.adp-a.adp).slice(0,10);
  if (!byFam.length) return;

  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  const labels = byFam.map(g=>trunc(g.fd?.familia||g.key||'(sin cat.)',20));
  state.charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Faltante $', data: byFam.map(g=>Math.round(Math.abs(g.dp<0?g.dp:0))), backgroundColor: 'rgba(220,38,38,0.75)' },
        { label: 'Sobrante $', data: byFam.map(g=>Math.round(g.dp>0?g.dp:0)),            backgroundColor: 'rgba(37,99,235,0.65)' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: { y: { ticks: { callback: v => '$'+Math.abs(v/1000).toFixed(0)+'K' } } },
    },
  });
}

function exportFinalExcel() {
  const data = (state.data2026?.length ? state.data2026 : state.data2025) || [];
  const year = state.data2026?.length ? '2026' : '2025';
  if (!data.length) { showToast('Sin datos para exportar.', 'error'); return; }

  const wb = XLSX.utils.book_new();

  // Hoja 1 — TABLA_ANALISIS (12 columnas, estilizada)
  const headers = ['Codigo_tecnico','Descripcion','CONTEO','COSTO $','VALOR CONTEO',
                   'STOCK SISTEMA','VALOR SISTEMA $','DIFERENCIA','DIFERENCIA $',
                   'FAMILIA','HIPERFAMILIA','MARCA'];
  const rows = [headers, ...data.map(r=>[
    r.codigo||'', r.producto||'',
    r.unidades_real??0, r.costo??0, r.peso_real??0,
    r.unidades_sistema??0, r.peso_sistema??0,
    r.dif_unidades??0, r.dif_peso??0,
    r.familia||'', r.perfamilia||'', r.marca||'',
  ])];
  const ws1 = XLSX.utils.aoa_to_sheet(rows);
  styleAnalisisSheet(ws1, rows);
  XLSX.utils.book_append_sheet(wb, ws1, 'TABLA_ANALISIS');

  // Hoja 2 — RESULTADOS
  const k = calcKPIs(data);
  const m = calcMonetarySummary(data);
  let f2=0, s2=0, fV2=0, sV2=0;
  for(const r of data){ if(r.dif_unidades<0){f2++;fV2+=Math.abs(r.dif_peso||0);}else if(r.dif_unidades>0){s2++;sV2+=Math.abs(r.dif_peso||0);} }
  const pctD = m.totalSistema>0?(m.dispersion/m.totalSistema*100).toFixed(2)+'%':'0%';
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['Concepto','Unidades','Valor $','%'],
    ['Total Sistema',   Math.round(k.us),  Math.round(k.ps),  ''],
    ['Total Conteo',    Math.round(k.ur),  Math.round(k.pr),  ''],
    ['Diferencias', Math.round(k.du),  Math.round(m.difTotal), ''],
    ['Diferencias (+)', s2,                Math.round(sV2), ''],
    ['Diferencias (−)', f2,                Math.round(fV2), ''],
    ['Dispersión',      Math.round(k.adu), Math.round(m.dispersion), pctD],
  ]);
  XLSX.utils.book_append_sheet(wb, ws2, 'RESULTADOS');

  // Hoja 3 — DATOS_FALTANTES
  const faltantes = [...data].filter(r=>r.dif_unidades<0||r.dif_peso<0)
    .sort((a,b)=>(a.dif_peso||0)-(b.dif_peso||0));
  const ws3 = XLSX.utils.aoa_to_sheet([
    ['Codigo_tecnico','Descripcion','CONTEO','STOCK SISTEMA','DIFERENCIA','DIFERENCIA $','FAMILIA','HIPERFAMILIA','MARCA'],
    ...faltantes.map(r=>[r.codigo||'',r.producto||'',r.unidades_real??0,r.unidades_sistema??0,r.dif_unidades??0,r.dif_peso??0,r.familia||'',r.perfamilia||'',r.marca||'']),
  ]);
  XLSX.utils.book_append_sheet(wb, ws3, 'DATOS_FALTANTES');

  // Hoja 4 — dinamica_HIPER
  const byHiper = aggregateBy(data, 'perfamilia').sort((a,b)=>b.adp-a.adp);
  const ws4 = XLSX.utils.aoa_to_sheet([
    ['FAMILIA','STOCK SISTEMA','CONTEO','DIFERENCIA','% Exact Unid','VALOR SISTEMA $','VALOR CONTEO','DIFERENCIA $','% Exact $'],
    ...byHiper.map(g=>[g.fd?.perfamilia||g.key||'',Math.round(g.us),Math.round(g.ur),Math.round(g.du),(g.exact_unid||0).toFixed(2)+'%',Math.round(g.ps),Math.round(g.pr),Math.round(g.dp),(g.exact_peso||0).toFixed(2)+'%']),
  ]);
  XLSX.utils.book_append_sheet(wb, ws4, 'dinamica_HIPER');

  XLSX.writeFile(wb, `AnalisisFinal_${year}_${today()}.xlsx`);
  showToast('Excel Final con 4 hojas generado ✓', 'ok');
}

/* ═══════════════════════════════════════════════════════════════
   GESTIÓN DE MODOS (actualizada para 5 modos)
   ═══════════════════════════════════════════════════════════════ */
function switchToMode(mode) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const allViews = ['2025','2026','comparative','checklist','planos','2025v2','reconteo','mejoras','final'];
  allViews.forEach(m => document.getElementById(`view-${m}`)?.classList.add('hidden'));
  document.getElementById(`view-${mode}`)?.classList.remove('hidden');
}

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupDragDrop('drop-2025', 'input-2025', 'btn-load-2025', '2025');
  setupDragDrop('drop-2026', 'input-2026', 'btn-load-2026', '2026');
  setupTabs();
  showWelcome();

  // Planos hardcodeados — renderizar en arranque
  renderPlanos();

  // Tab de checklist y planos (modos extra)
  document.querySelectorAll('.tab-btn[data-mode="checklist"]').forEach(btn => {
    btn.onclick = () => {
      switchToMode('checklist');
      document.getElementById('welcome-screen').style.display = 'none';
    };
  });
  document.querySelectorAll('.tab-btn[data-mode="planos"]').forEach(btn => {
    btn.onclick = () => {
      switchToMode('planos');
      document.getElementById('welcome-screen').style.display = 'none';
      // Re-aplicar estados si datos ya cargados
      if (document.querySelector('#planos-content .plano-patente')) {
        applyPatenteCellStates();
        Object.keys(PLANO_SHEETS || {}).forEach(renderPlanoZonaProgress);
      }
    };
  });

  renderCorrelativo();

  document.querySelectorAll('.tab-btn[data-mode="2025v2"]').forEach(btn => {
    btn.onclick = () => {
      switchToMode('2025v2');
      document.getElementById('welcome-screen').style.display = 'none';
      renderModeV2();
    };
  });

  document.querySelectorAll('.tab-btn[data-mode="mejoras"]').forEach(btn => {
    btn.onclick = () => {
      if (!state.data2025.length && !state.data2026.length) {
        showToast('Carga datos de inventario 2025 o 2026 primero.', 'info');
        return;
      }
      switchToMode('mejoras');
      document.getElementById('welcome-screen').style.display = 'none';
    };
  });

  document.querySelectorAll('.tab-btn[data-mode="final"]').forEach(btn => {
    btn.onclick = () => {
      switchToMode('final');
      document.getElementById('welcome-screen').style.display = 'none';
      renderAnalisisFinal();
    };
  });
});


/* ===== CENTRO RECONTEO ===== */
function getSeverity(value){
  const v=Math.abs(value||0);
  if(v>500000) return ['critica','🔴 Crítica'];
  if(v>100000) return ['alta','🟠 Alta'];
  if(v>25000) return ['media','🟡 Media'];
  return ['baja','🟢 Baja'];
}

function getRecountRows(){
  const data = state.data2026?.length ? state.data2026 : state.data2025;
  return (data||[]).map((r,idx)=>{
    const dif   = Number(r.dif_unidades ?? ((Number(r.unidades_real)||0) - (Number(r.unidades_sistema)||0)));
    const costo = Number(r.costo) || 0;
    const money = costo ? (dif * costo) : (Number(r.dif_peso)||0);
    const sev   = getSeverity(money);
    return {...r, dif, money, severity:sev[0], severityLabel:sev[1], rowId:idx};
  }).filter(r=>r.dif!==0 || r.money!==0).sort((a,b)=>Math.abs(b.money)-Math.abs(a.money));
}

// Calcula prioridad de una fila: confirmados al fondo, resto por |money|
function _recountPriority(r) {
  const status = localStorage.getItem('recount-status-' + r.rowId) || 'Pendiente';
  if (status === 'Confirmado') return -1;            // al fondo
  return Math.abs(r.money || 0);
}

// Color semáforo por impacto $ relativo al máximo del conjunto
function _recountSemaforoColor(r, maxImpacto) {
  const status = localStorage.getItem('recount-status-' + r.rowId) || 'Pendiente';
  if (status === 'Confirmado') return '#16a34a';     // verde — ya resuelto
  if (status === 'Recontado')  return '#2563eb';     // azul — en proceso
  const pct = maxImpacto > 0 ? Math.abs(r.money || 0) / maxImpacto : 0;
  if (pct >= 0.5) return '#dc2626';                  // rojo — alto impacto
  if (pct >= 0.2) return '#ea580c';                  // naranja — medio
  return '#ca8a04';                                  // amarillo — bajo
}

function renderRecount(){
  const rows=getRecountRows();
  const search=(document.getElementById('recount-search')?.value||'').toLowerCase();
  const type=document.getElementById('recount-type')?.value||'all';
  const sev=document.getElementById('recount-severity')?.value||'all';
  const filtered=rows.filter(r=>{
    const txt=`${r.producto} ${r.marca} ${r.familia} ${r.subfamilia}`.toLowerCase();
    if(search && !txt.includes(search)) return false;
    if(type==='faltantes' && r.dif>=0) return false;
    if(type==='sobrantes' && r.dif<=0) return false;
    if(sev !== 'all' && String(r.severity).trim().toLowerCase() !== String(sev).trim().toLowerCase()) return false;
    return true;
  });

  const faltantes=filtered.filter(r=>r.dif<0).length;
  const sobrantes=filtered.filter(r=>r.dif>0).length;
  const criticos=filtered.filter(r=>r.severity==='critica').length;
  const confirmados=filtered.filter(r=>localStorage.getItem('recount-status-'+r.rowId)==='Confirmado').length;
  const impacto=filtered.reduce((a,b)=>a+Math.abs(b.money||0),0);

  document.getElementById('recount-summary').innerHTML=`
    <div class="recount-card"><span>Diferencias</span><strong>${filtered.length}</strong></div>
    <div class="recount-card"><span>Faltantes</span><strong style="color:#fca5a5">${faltantes}</strong></div>
    <div class="recount-card"><span>Sobrantes</span><strong style="color:#93c5fd">${sobrantes}</strong></div>
    <div class="recount-card"><span>Críticos</span><strong style="color:#fca5a5">${criticos}</strong></div>
    <div class="recount-card"><span>Confirmados</span><strong style="color:#86efac">${confirmados}</strong></div>
    <div class="recount-card"><span>Impacto Total</span><strong>$${Math.round(impacto).toLocaleString('es-CL')}</strong></div>`;

  // Rankings (todos los rows, no filtrados — visión completa)
  renderRecountRankings(rows);

  // Ordenar: mayor impacto primero (confirmados al fondo)
  const sorted = [...filtered].sort((a, b) => _recountPriority(b) - _recountPriority(a));
  const maxImpacto = sorted.length ? Math.abs(sorted[0].money || 0) : 1;

  const tbody=document.querySelector('#recount-table tbody');
  const highlightId = window._recountHighlightId || null;
  tbody.innerHTML=sorted.slice(0,500).map(r=>{
    const key='recount-status-'+r.rowId;
    const status=localStorage.getItem(key)||'Pendiente';
    const statusColor={Confirmado:'#16a34a',Recontado:'#2563eb',Pendiente:''}[status]||'';
    const semColor = _recountSemaforoColor(r, maxImpacto);
    const isHighlighted = highlightId !== null && r.rowId === highlightId;
    const rowStyle = isHighlighted ? 'background:#fef9c3;outline:2px solid #ca8a04' : '';
    return `<tr id="recount-row-${r.rowId}" style="${rowStyle}">
      <td style="text-align:center">
        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${semColor};vertical-align:middle;margin-right:4px" title="Prioridad impacto $"></span>
        <span class="state-pill" style="${statusColor?'background:'+statusColor+';color:#fff':''}" onclick="toggleRecountStatus(${r.rowId})">${status}</span>
      </td>
      <td title="${r.producto||''}">${(r.producto||'—').substring(0,45)}</td>
      <td>${r.marca||'—'}</td>
      <td>${r.familia||'—'}</td>
      <td>${r.subfamilia||'—'}</td>
      <td style="font-weight:700;color:${r.dif<0?'#dc2626':'#16a34a'}">${r.dif>0?'+':''}${r.dif}</td>
      <td style="font-weight:700;color:${r.money<0?'#dc2626':'#16a34a'}">$${Math.round(Math.abs(r.money)).toLocaleString('es-CL')}</td>
      <td><span class="badge-severity sev-${r.severity}">${r.severityLabel}</span></td>
    </tr>`;
  }).join('');

  // Si hay highlight, hacer scroll hasta la fila
  if (highlightId !== null) {
    setTimeout(() => {
      const el = document.getElementById('recount-row-' + highlightId);
      if (el) el.scrollIntoView({ behavior:'smooth', block:'center' });
    }, 80);
  }
}

// Clic en ranking: filtra y destaca esa fila en la tabla principal
function recountFiltrarPorFila(rowId) {
  window._recountHighlightId = rowId;
  // Limpiar filtro de búsqueda para no ocultar la fila
  const searchEl = document.getElementById('recount-search');
  if (searchEl) searchEl.value = '';
  renderRecount();
  // Scroll a la tabla principal
  const tbl = document.getElementById('recount-table');
  if (tbl) tbl.scrollIntoView({ behavior:'smooth', block:'start' });
}

function recountLimpiarFiltro() {
  window._recountHighlightId = null;
  renderRecount();
}

function renderRecountRankings(rows) {
  const rankEl = document.getElementById('recount-rankings');
  if (!rankEl || !rows.length) { if (rankEl) rankEl.style.display = 'none'; return; }
  rankEl.style.display = '';

  const fmtMoney = v => '$' + Math.round(Math.abs(v)).toLocaleString('es-CL');
  const trunc    = (s, n) => s && s.length > n ? s.substring(0, n) + '…' : (s || '—');

  const allImpactos = rows.map(r => Math.abs(r.money || 0));
  const globalMax   = allImpactos.length ? Math.max(...allImpactos) : 1;

  const buildRows = (sorted, maxAbsVal, keyFn, valFn) =>
    sorted.slice(0, 20).map((r, i) => {
      const key    = 'recount-status-' + r.rowId;
      const status = localStorage.getItem(key) || 'Pendiente';
      const v      = valFn(r);
      const semColor = _recountSemaforoColor(r, globalMax);
      const statusColor = {Confirmado:'#16a34a',Recontado:'#2563eb'}[status] || '#94a3b8';
      return `<tr style="cursor:pointer" onclick="recountFiltrarPorFila(${r.rowId})" title="Clic para destacar en la tabla principal">
        <td class="rank-num">${i+1}</td>
        <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${semColor};margin-right:4px;vertical-align:middle"></span></td>
        <td class="rank-prod" title="${r.producto||''}">${trunc(r.producto, 38)}</td>
        <td style="color:var(--muted);font-size:11px">${r.marca||'—'}</td>
        <td style="font-weight:700;color:${r.dif<0?'#dc2626':'#2563eb'};white-space:nowrap">${r.dif>0?'+':''}${r.dif} ud</td>
        <td class="rank-val" style="color:${semColor};font-weight:700;white-space:nowrap">${fmtMoney(v)}</td>
        <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor}" title="${status}"></span></td>
      </tr>`;
    }).join('');

  // Ranking 1 — por |$|
  const byMoney  = [...rows].sort((a,b) => Math.abs(b.money) - Math.abs(a.money));
  const maxMoney = byMoney[0] ? Math.abs(byMoney[0].money) : 1;
  const tMoney   = document.querySelector('#rank-money-table tbody');
  const cMoney   = document.getElementById('rank-money-count');
  if (tMoney)  tMoney.innerHTML  = buildRows(byMoney, maxMoney, r=>r.rowId, r=>r.money);
  if (cMoney)  cMoney.textContent = byMoney.length + ' difs';

  // Ranking 2 — por |unidades|
  const byUnits  = [...rows].sort((a,b) => Math.abs(b.dif) - Math.abs(a.dif));
  const maxUnits = byUnits[0] ? Math.abs(byUnits[0].dif) : 1;
  const tUnits   = document.querySelector('#rank-units-table tbody');
  const cUnits   = document.getElementById('rank-units-count');
  if (tUnits)  tUnits.innerHTML  = buildRows(byUnits, maxUnits, r=>r.rowId, r=>r.money);
  if (cUnits)  cUnits.textContent = byUnits.length + ' difs';
}

function exportRecountExcel() {
  const rows = getRecountRows();
  if (!rows.length) { showToast('Sin datos de reconteo', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const headers = ['#','Estado','Producto','Marca','Familia','Subfamilia','DIFERENCIA','DIFERENCIA $','Severidad'];
  const data = rows.map((r, i) => [
    i + 1,
    localStorage.getItem('recount-status-' + r.rowId) || 'Pendiente',
    r.producto || '',
    r.marca    || '',
    r.familia  || '',
    r.subfamilia || '',
    r.dif,
    Math.round(r.money),
    r.severityLabel,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws['!cols'] = [{wch:4},{wch:12},{wch:45},{wch:18},{wch:18},{wch:18},{wch:10},{wch:14},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ws, 'Reconteo');

  // Hoja ranking $
  const byMoney = [...rows].sort((a,b)=>Math.abs(b.money)-Math.abs(a.money)).slice(0,50);
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['#','Producto','Marca','DIFERENCIA','DIFERENCIA $','Severidad'],
    ...byMoney.map((r,i)=>[i+1, r.producto||'', r.marca||'', r.dif, Math.round(r.money), r.severityLabel]),
  ]);
  XLSX.utils.book_append_sheet(wb, ws2, 'Ranking_$');

  XLSX.writeFile(wb, `Reconteo_${today()}.xlsx`);
  showToast('Excel de reconteo generado ✓', 'ok');
}

function toggleRecountStatus(id){
  const key='recount-status-'+id;
  const current=localStorage.getItem(key)||'Pendiente';
  const order=['Pendiente','Recontado','Confirmado'];
  const next=order[(order.indexOf(current)+1)%order.length];
  localStorage.setItem(key,next);
  renderRecount();
}

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.tab-btn[data-mode="reconteo"]').forEach(btn=>{
    btn.onclick=()=>{
      switchToMode('reconteo');
      document.getElementById('welcome-screen').style.display='none';
      renderRecount();
    };
  });
  ['recount-search','recount-type','recount-severity'].forEach(id=>{
    document.addEventListener('input',e=>{ if(e.target.id===id) renderRecount();});
    document.addEventListener('change',e=>{ if(e.target.id===id) renderRecount();});
  });
});

/* ═══════════════════════════════════════════════════════════════
   ACORDEONES (mejoras view)
   ═══════════════════════════════════════════════════════════════ */
function toggleAcc(btn) {
  const content = btn.nextElementSibling;
  if (!content) return;
  const opening = !content.classList.contains('open');
  btn.classList.toggle('open', opening);
  content.classList.toggle('open', opening);
  const arrowEl = btn.querySelector('.mej-acc-arrow');
  if (arrowEl) {
    arrowEl.textContent = opening ? '▴' : '▾';
  } else {
    btn.innerHTML = btn.innerHTML.replace(opening ? '▾' : '▴', opening ? '▴' : '▾');
  }
}

function initAccordions() {
  document.querySelectorAll('.acc-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { toggleAcc(this); });
  });
}
document.addEventListener('DOMContentLoaded', initAccordions);

/* ═══════════════════════════════════════════════════════════════
   FILTER DRAWER
   ═══════════════════════════════════════════════════════════════ */
function openFilterPanel(mode) {
  document.getElementById(`filter-drawer-${mode}`)?.classList.add('open');
  document.getElementById(`filter-overlay-${mode}`)?.classList.add('open');
}
function closeFilterPanel(mode) {
  document.getElementById(`filter-drawer-${mode}`)?.classList.remove('open');
  document.getElementById(`filter-overlay-${mode}`)?.classList.remove('open');
}
function updateFilterBadge(mode) {
  const f     = state.filters[mode] || {};
  const q     = state.searchText[mode] || '';
  const dd    = state.drilldown[mode] || {};
  const drillCount = (mode === '2025' || mode === '2026')
    ? [dd.hiperfamilia, dd.familia, dd.marca].filter(Boolean).length
    : 0;
  const filterCount = Object.values(f).filter(Boolean).length + (q ? 1 : 0);
  const total = filterCount + drillCount;
  const badge = document.getElementById(`filter-badge-${mode}`);
  if (badge) badge.textContent = total > 0 ? total : '';
}

/* ═══════════════════════════════════════════════════════════════
   RESUMEN GLOBAL — 8 KPIs grandes + conteo faltantes/sobrantes
   ═══════════════════════════════════════════════════════════════ */
function renderResumenGlobal(year) {
  const el = document.getElementById(`resumen-global-${year}`);
  if (!el) return;
  const data = getFilteredData(year);
  if (!data.length) { el.innerHTML = ''; return; }

  const k = calcKPIs(data);
  const m = calcMonetarySummary(data);

  let faltantes = 0, sobrantes = 0;
  for (const r of data) {
    if (r.dif_unidades < 0)      faltantes++;
    else if (r.dif_unidades > 0) sobrantes++;
  }

  const exactUCls = k.exact_unid >= 95 ? 'kpi-exact-ok' : k.exact_unid >= 85 ? 'kpi-exact-warn' : 'kpi-exact-bad';
  const exactPCls = k.exact_peso >= 95 ? 'kpi-exact-ok' : k.exact_peso >= 85 ? 'kpi-exact-warn' : 'kpi-exact-bad';
  const difUCls   = k.du < 0 ? 'kpi-loss' : k.du > 0 ? 'kpi-gain' : 'kpi-unid-row';
  const difPCls   = m.difTotal < 0 ? 'kpi-loss' : m.difTotal > 0 ? 'kpi-gain' : 'kpi-peso-row';
  const pct = n => data.length ? fmtPct(n / data.length * 100) : '0.0';

  el.innerHTML = `
    <div class="global-kpi-grid">
      <div class="global-kpi-card kpi-unid-row">
        <div class="kpi-label">Total Unid. Sistema</div>
        <div class="kpi-value">${fmt(k.us)}</div>
        <div class="kpi-sub">stock en sistema</div>
      </div>
      <div class="global-kpi-card kpi-unid-row">
        <div class="kpi-label">Total Unid. Físico</div>
        <div class="kpi-value">${fmt(k.ur)}</div>
        <div class="kpi-sub">conteo físico real</div>
      </div>
      <div class="global-kpi-card ${difUCls}">
        <div class="kpi-label">Diferencia Unidades</div>
        <div class="kpi-value">${k.du >= 0 ? '+' : ''}${fmt(k.du)}</div>
        <div class="kpi-sub">dispersión abs: ${fmt(k.adu)}</div>
      </div>
      <div class="global-kpi-card ${exactUCls}">
        <div class="kpi-label">% Exactitud Unidades</div>
        <div class="kpi-value">${fmtPct(k.exact_unid)}%</div>
        <div class="kpi-sub">${semLabel(semaforo(k.exact_unid))}</div>
      </div>
    </div>
    <div class="global-kpi-grid" style="margin-bottom:0">
      <div class="global-kpi-card kpi-peso-row">
        <div class="kpi-label">Total $ Sistema</div>
        <div class="kpi-value">${fmtCompact(k.ps)}</div>
        <div class="kpi-sub">${fmtMoney(k.ps)}</div>
      </div>
      <div class="global-kpi-card kpi-peso-row">
        <div class="kpi-label">Total $ Físico</div>
        <div class="kpi-value">${fmtCompact(k.pr)}</div>
        <div class="kpi-sub">${fmtMoney(k.pr)}</div>
      </div>
      <div class="global-kpi-card ${difPCls}">
        <div class="kpi-label">Diferencia $</div>
        <div class="kpi-value">${fmtCompact(m.difTotal)}</div>
        <div class="kpi-sub">dispersión: ${fmtCompact(m.dispersion)}</div>
      </div>
      <div class="global-kpi-card ${exactPCls}">
        <div class="kpi-label">% Exactitud $</div>
        <div class="kpi-value">${fmtPct(k.exact_peso)}%</div>
        <div class="kpi-sub">${semLabel(semaforo(k.exact_peso))}</div>
      </div>
    </div>
    <div class="count-kpi-row" style="margin-top:12px">
      <div class="count-kpi-card card-faltantes">
        <div class="count-kpi-label">Productos Faltantes</div>
        <div class="count-kpi-value">${fmt(faltantes)}</div>
        <div class="count-kpi-sub" style="color:var(--red)">${pct(faltantes)}% del total · unid. reales &lt; sistema</div>
      </div>
      <div class="count-kpi-card card-sobrantes">
        <div class="count-kpi-label">Productos Sobrantes</div>
        <div class="count-kpi-value">${fmt(sobrantes)}</div>
        <div class="count-kpi-sub" style="color:var(--green)">${pct(sobrantes)}% del total · unid. reales &gt; sistema</div>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   EMBUDO — navegador jerárquico hiperfamilia → familia → marca
   ═══════════════════════════════════════════════════════════════ */
function renderEmbudo(year) {
  const el = document.getElementById(`embudo-${year}`);
  if (!el) return;
  const data = getFilteredData(year);
  if (!data.length) { el.innerHTML = ''; return; }

  const dd = state.drilldown[year];

  const uniqueHiper = [...new Set(data.map(r => r.perfamilia).filter(Boolean))].sort();
  const filtByHiper = dd.hiperfamilia ? data.filter(r => r.perfamilia === dd.hiperfamilia) : data;
  const uniqueFam   = [...new Set(filtByHiper.map(r => r.familia).filter(Boolean))].sort();
  const filtByFam   = dd.familia ? filtByHiper.filter(r => r.familia === dd.familia) : filtByHiper;
  const uniqueMarca = [...new Set(filtByFam.map(r => r.marca).filter(Boolean))].sort();

  const mkOpts = (vals, cur, placeholder) =>
    `<option value="">${placeholder}</option>` +
    vals.map(v => `<option value="${v.replace(/"/g,'&quot;')}"${cur===v?' selected':''}>${v}</option>`).join('');

  const hiperOpts = mkOpts(uniqueHiper, dd.hiperfamilia, '— Todas las hiperfamilias —');
  const famOpts   = mkOpts(uniqueFam,   dd.familia,      '— Todas las familias —');
  const marcaOpts = mkOpts(uniqueMarca, dd.marca,        '— Todas las marcas —');

  const chips = [];
  if (dd.hiperfamilia) chips.push(`<span class="embudo-chip">${dd.hiperfamilia}<button class="embudo-chip-x" onclick="clearDrillevel('${year}','hiperfamilia')">✕</button></span>`);
  if (dd.familia)      chips.push(`<span class="embudo-chip">${dd.familia}<button class="embudo-chip-x" onclick="clearDrillevel('${year}','familia')">✕</button></span>`);
  if (dd.marca)        chips.push(`<span class="embudo-chip">${dd.marca}<button class="embudo-chip-x" onclick="clearDrillevel('${year}','marca')">✕</button></span>`);

  const breadcrumb = chips.length
    ? `<div class="embudo-breadcrumb">${chips.join('<span class="embudo-crumb-sep">›</span>')}</div>`
    : '';

  const navParts = [dd.hiperfamilia, dd.familia, dd.marca].filter(Boolean);
  const navHeader = navParts.length
    ? `<div class="embudo-nav-header">Viendo: <strong>${navParts.join(' / ')}</strong></div>`
    : `<div class="embudo-nav-header">Mostrando todos los datos — usa los filtros para navegar</div>`;

  let tableHtml;
  if (dd.hiperfamilia && dd.familia && dd.marca) {
    const prods = filtByFam.filter(r => r.marca === dd.marca).sort((a,b) => b.abs_dif_peso - a.abs_dif_peso);
    tableHtml = buildEmbudoProductTable(prods);
  } else if (dd.hiperfamilia && dd.familia) {
    tableHtml = buildEmbudoGroupTable(year, aggregateBy(filtByFam,'marca').sort((a,b)=>b.adp-a.adp), 'marca', 'Marca');
  } else if (dd.hiperfamilia) {
    tableHtml = buildEmbudoGroupTable(year, aggregateBy(filtByHiper,'familia').sort((a,b)=>b.adp-a.adp), 'familia', 'Familia');
  } else {
    tableHtml = buildEmbudoGroupTable(year, aggregateBy(data,'perfamilia').sort((a,b)=>b.adp-a.adp), 'perfamilia', 'Hiperfamilia');
  }

  el.innerHTML = `
    <div class="embudo-section">
      <div class="embudo-section-title">🔍 Navegador Jerárquico</div>
      <div class="embudo-bar">
        <select class="embudo-select" onchange="setEmbudoLevel('${year}','hiperfamilia',this.value)">${hiperOpts}</select>
        <select class="embudo-select" onchange="setEmbudoLevel('${year}','familia',this.value)"${!dd.hiperfamilia?' disabled':''}>${famOpts}</select>
        <select class="embudo-select" onchange="setEmbudoLevel('${year}','marca',this.value)"${!dd.familia?' disabled':''}>${marcaOpts}</select>
      </div>
      ${breadcrumb}
      ${navHeader}
      <div class="table-scroll">${tableHtml}</div>
    </div>`;
}

function setEmbudoLevel(year, nivel, value) {
  const dd = state.drilldown[year];
  if (nivel === 'hiperfamilia') { dd.hiperfamilia = value; dd.familia = ''; dd.marca = ''; }
  else if (nivel === 'familia') { dd.familia = value; dd.marca = ''; }
  else                          { dd.marca = value; }
  renderEmbudo(year);
}

function clearDrillevel(year, nivel) {
  const dd = state.drilldown[year];
  if (nivel === 'hiperfamilia') { dd.hiperfamilia = ''; dd.familia = ''; dd.marca = ''; }
  else if (nivel === 'familia') { dd.familia = ''; dd.marca = ''; }
  else                          { dd.marca = ''; }
  renderEmbudo(year);
}

function buildEmbudoGroupTable(year, groups, groupField, groupLabel) {
  if (!groups.length) return '<p class="no-data">Sin datos.</p>';
  const destNivel = { perfamilia:'hiperfamilia', familia:'familia', marca:'marca' }[groupField] || groupField;
  const rows = groups.map(g => {
    const val  = g.fd[groupField] || '(sin clasificar)';
    const vEsc = val.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const clsU = g.du < 0 ? 'loss-cell' : g.du > 0 ? 'gain-cell' : '';
    const clsP = g.dp < 0 ? 'loss-cell' : g.dp > 0 ? 'gain-cell' : '';
    return `<tr style="cursor:pointer" onclick="setEmbudoLevel('${year}','${destNivel}','${vEsc}')">
      <td><strong>${val}</strong></td>
      <td class="num">${g.count}</td>
      <td class="num">${fmt(g.us)}</td>
      <td class="num">${fmt(g.ur)}</td>
      <td class="num ${clsU}">${g.du>=0?'+':''}${fmt(g.du)}</td>
      <td class="num">${fmtMoney(g.ps)}</td>
      <td class="num">${fmtMoney(g.pr)}</td>
      <td class="num ${clsP}">${g.dp>=0?'+':''}${fmtMoney(g.dp)}</td>
      <td class="num">${fmtPct(g.exact_unid)}%</td>
    </tr>`;
  }).join('');
  return `<table class="data-table dd-table">
    <thead><tr>
      <th>${groupLabel}</th>
      <th class="num">N° Items</th>
      <th class="num">STOCK SISTEMA</th>
      <th class="num">CONTEO</th>
      <th class="num">DIFERENCIA</th>
      <th class="num">VALOR SISTEMA $</th>
      <th class="num">VALOR CONTEO</th>
      <th class="num">DIFERENCIA $</th>
      <th class="num">% Exactitud</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildEmbudoProductTable(data) {
  if (!data.length) return '<p class="no-data">Sin productos en este filtro.</p>';
  const rows = data.map(r => {
    const clsU = r.dif_unidades < 0 ? 'loss-cell' : r.dif_unidades > 0 ? 'gain-cell' : '';
    const clsP = r.dif_peso < 0     ? 'loss-cell' : r.dif_peso > 0     ? 'gain-cell' : '';
    return `<tr>
      <td class="mono-sm">${r.codigo||'—'}</td>
      <td title="${(r.producto||'').replace(/"/g,'&quot;')}">${trunc(r.producto,45)}</td>
      <td class="num">${fmt(r.unidades_sistema)}</td>
      <td class="num">${fmt(r.unidades_real)}</td>
      <td class="num ${clsU}">${r.dif_unidades>=0?'+':''}${fmt(r.dif_unidades)}</td>
      <td class="num">${fmtMoney(r.peso_sistema)}</td>
      <td class="num">${fmtMoney(r.peso_real)}</td>
      <td class="num ${clsP}">${r.dif_peso>=0?'+':''}${fmtMoney(r.dif_peso)}</td>
    </tr>`;
  }).join('');
  return `<table class="data-table dd-table">
    <thead><tr>
      <th>Código</th><th>Descripción</th>
      <th class="num">STOCK SISTEMA</th><th class="num">CONTEO</th>
      <th class="num">DIFERENCIA</th>
      <th class="num">VALOR SISTEMA $</th><th class="num">VALOR CONTEO</th>
      <th class="num">DIFERENCIA $</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/* ═══════════════════════════════════════════════════════════════
   COMPARATIVO — KPIs lado a lado + tabla por categoría
   ═══════════════════════════════════════════════════════════════ */
function _buildCompColKPIs(data, yearLabel) {
  if (!data.length) return `<p style="color:var(--muted);font-size:13px;padding:8px">Sin datos ${yearLabel}. Carga un archivo primero.</p>`;
  const k = calcKPIs(data);
  const m = calcMonetarySummary(data);
  let falt = 0, sobr = 0;
  for (const r of data) { if (r.dif_unidades < 0) falt++; else if (r.dif_unidades > 0) sobr++; }
  const exactU = k.exact_unid >= 95 ? 'kpi-exact-ok' : k.exact_unid >= 85 ? 'kpi-exact-warn' : 'kpi-exact-bad';
  const exactP = k.exact_peso >= 95 ? 'kpi-exact-ok' : k.exact_peso >= 85 ? 'kpi-exact-warn' : 'kpi-exact-bad';
  const difU = k.du < 0 ? 'kpi-loss' : 'kpi-unid-row';
  const difP = m.difTotal < 0 ? 'kpi-loss' : 'kpi-peso-row';
  const g2 = 'grid-template-columns:repeat(2,1fr)';
  return `
    <div class="global-kpi-grid" style="${g2};margin-bottom:8px">
      <div class="global-kpi-card kpi-unid-row" style="min-height:70px">
        <div class="kpi-label">Unid. Sistema</div>
        <div class="kpi-value" style="font-size:1.5rem">${fmt(k.us)}</div>
      </div>
      <div class="global-kpi-card kpi-unid-row" style="min-height:70px">
        <div class="kpi-label">Unid. Físico</div>
        <div class="kpi-value" style="font-size:1.5rem">${fmt(k.ur)}</div>
      </div>
      <div class="global-kpi-card ${difU}" style="min-height:70px">
        <div class="kpi-label">Diferencia Unid.</div>
        <div class="kpi-value" style="font-size:1.5rem">${k.du>=0?'+':''}${fmt(k.du)}</div>
      </div>
      <div class="global-kpi-card ${exactU}" style="min-height:70px">
        <div class="kpi-label">% Exactitud Unid.</div>
        <div class="kpi-value" style="font-size:1.5rem">${fmtPct(k.exact_unid)}%</div>
      </div>
      <div class="global-kpi-card kpi-peso-row" style="min-height:70px">
        <div class="kpi-label">VALOR SISTEMA $</div>
        <div class="kpi-value" style="font-size:1.5rem">${fmtCompact(k.ps)}</div>
      </div>
      <div class="global-kpi-card kpi-peso-row" style="min-height:70px">
        <div class="kpi-label">VALOR CONTEO</div>
        <div class="kpi-value" style="font-size:1.5rem">${fmtCompact(k.pr)}</div>
      </div>
      <div class="global-kpi-card ${difP}" style="min-height:70px">
        <div class="kpi-label">Diferencia $</div>
        <div class="kpi-value" style="font-size:1.5rem">${fmtCompact(m.difTotal)}</div>
      </div>
      <div class="global-kpi-card ${exactP}" style="min-height:70px">
        <div class="kpi-label">% Exactitud $</div>
        <div class="kpi-value" style="font-size:1.5rem">${fmtPct(k.exact_peso)}%</div>
      </div>
    </div>
    <div class="count-kpi-row" style="${g2};gap:8px;margin-bottom:0">
      <div class="count-kpi-card card-faltantes">
        <div class="count-kpi-label">Faltantes</div>
        <div class="count-kpi-value" style="font-size:1.6rem">${fmt(falt)}</div>
      </div>
      <div class="count-kpi-card card-sobrantes">
        <div class="count-kpi-label">Sobrantes</div>
        <div class="count-kpi-value" style="font-size:1.6rem">${fmt(sobr)}</div>
      </div>
    </div>`;
}

function renderCompKPIs(d25, d26) {
  const el = document.getElementById('comp-kpis');
  if (!el) return;
  el.innerHTML = `
    <div class="comp-kpi-columns">
      <div>
        <div class="comp-kpi-col-header y2025">📊 Inventario 2025 · <strong>${d25.length.toLocaleString('es-CL')} registros</strong></div>
        ${_buildCompColKPIs(d25,'2025')}
      </div>
      <div>
        <div class="comp-kpi-col-header y2026">📈 Inventario 2026 · <strong>${d26.length.toLocaleString('es-CL')} registros</strong></div>
        ${_buildCompColKPIs(d26,'2026')}
      </div>
    </div>`;
}

function renderCompCategoria(d25, d26) {
  const el = document.getElementById('comp-categoria');
  if (!el) return;

  const gf    = state.compCategoria || 'perfamilia';
  const gLbl  = { perfamilia:'Hiperfamilia', familia:'Familia', marca:'Marca' }[gf] || gf;

  const agg25  = toIndex(aggregateBy(d25, gf), gf);
  const agg26  = toIndex(aggregateBy(d26, gf), gf);
  const allK   = [...new Set([...Object.keys(agg25),...Object.keys(agg26)])].sort();

  const rows = allK.map(k => {
    const r25 = agg25[k] || { du:0, dp:0, exact_unid:0, exact_peso:0, adp:0, ps:0 };
    const r26 = agg26[k] || { du:0, dp:0, exact_unid:0, exact_peso:0, adp:0, ps:0 };
    return { k, r25, r26,
      mejora:  r26.adp < r25.adp && r25.adp > 0,
      empeora: r26.adp > r25.adp };
  }).sort((a,b) => ((b.r25.adp||0)+(b.r26.adp||0)) - ((a.r25.adp||0)+(a.r26.adp||0)));

  const selOpts = [
    { v:'perfamilia', l:'Hiperfamilia' },
    { v:'familia',    l:'Familia' },
    { v:'marca',      l:'Marca' },
  ].map(o=>`<option value="${o.v}"${gf===o.v?' selected':''}>${o.l}</option>`).join('');

  const trows = rows.map(r => {
    const cls = r.mejora ? 'row-mejora' : r.empeora ? 'row-empeora' : '';
    const dU  = r.r26.exact_unid - r.r25.exact_unid;
    const dP  = r.r26.exact_peso - r.r25.exact_peso;
    const kE  = r.k.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const clU25 = r.r25.du<0?'loss-cell':r.r25.du>0?'gain-cell':'';
    const clU26 = r.r26.du<0?'loss-cell':r.r26.du>0?'gain-cell':'';
    return `<tr class="${cls}" style="cursor:pointer" onclick="drillCompProduct('${gf}','${kE}')">
      <td><strong>${r.k||'(sin cat.)'}</strong></td>
      <td class="num ${clU25}">${r.r25.du>=0?'+':''}${fmt(r.r25.du)}</td>
      <td class="num ${clU26}">${r.r26.du>=0?'+':''}${fmt(r.r26.du)}</td>
      <td class="num ${r.r25.dp<0?'loss-cell':r.r25.dp>0?'gain-cell':''}">${r.r25.dp>=0?'+':''}${fmtMoney(r.r25.dp)}</td>
      <td class="num ${r.r26.dp<0?'loss-cell':r.r26.dp>0?'gain-cell':''}">${r.r26.dp>=0?'+':''}${fmtMoney(r.r26.dp)}</td>
      <td class="num ${dU>=0?'gain-cell':'loss-cell'}">${dU>=0?'+':''}${fmtPct(dU)} pp</td>
      <td class="num ${dP>=0?'gain-cell':'loss-cell'}">${dP>=0?'+':''}${fmtPct(dP)} pp</td>
      <td class="num">${fmtPct(r.r25.exact_unid)}%</td>
      <td class="num">${fmtPct(r.r26.exact_unid)}%</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="table-block">
      <div class="table-header">
        <h3>Comparativo por ${gLbl} <span style="font-weight:400;color:var(--muted);font-size:11px">· haz clic en una fila para ver productos</span></h3>
        <div class="comp-cat-bar">
          <span class="comp-cat-label">Agrupar por:</span>
          <select class="comp-cat-select" onchange="setCompCategoria(this.value)">${selOpts}</select>
          <button class="btn btn-xs" onclick="exportTableToExcel('_comp-cat-tbl','Comparativo_${gLbl}')">⬇ xlsx</button>
        </div>
      </div>
      <div class="table-scroll">
        <table class="comp-table" id="_comp-cat-tbl">
          <thead><tr>
            <th>${gLbl}</th>
            <th class="num">DIFERENCIA 2025</th>
            <th class="num">DIFERENCIA 2026</th>
            <th class="num">DIFERENCIA $ 2025</th>
            <th class="num">DIFERENCIA $ 2026</th>
            <th class="num">Δ Exact Unid</th>
            <th class="num">Δ Exact $</th>
            <th class="num">% Exact 2025</th>
            <th class="num">% Exact 2026</th>
          </tr></thead>
          <tbody>${trows}</tbody>
        </table>
      </div>
    </div>
    <div id="comp-drill-products"></div>`;
}

function setCompCategoria(val) {
  state.compCategoria = val;
  renderModeComp();
}

function clearCompDrill() {
  state.compDrill = { field: null, value: null };
  const bc = document.getElementById('comp-drill-breadcrumb');
  if (bc) bc.innerHTML = '';
  const dp = document.getElementById('comp-drill-products');
  if (dp) dp.innerHTML = '';
}

function drillCompProduct(field, value) {
  state.compDrill = { field, value };
  const gLbl = { perfamilia:'Hiperfamilia', familia:'Familia', marca:'Marca' }[field] || field;
  const bc = document.getElementById('comp-drill-breadcrumb');
  if (bc) bc.innerHTML = `
    <button class="comp-drill-back" onclick="clearCompDrill()">← Volver</button>
    <span class="comp-drill-sep">›</span>
    <span>${gLbl}:</span>
    <span class="comp-drill-current">${value}</span>`;
  const { d25, d26 } = getFilteredDataComp();
  const r25 = d25.filter(r => (r[field]||'') === value).sort((a,b) => b.abs_dif_peso - a.abs_dif_peso);
  const r26 = d26.filter(r => (r[field]||'') === value).sort((a,b) => b.abs_dif_peso - a.abs_dif_peso);

  const allCodes = [...new Set([
    ...r25.map(r => r.codigo||r.producto),
    ...r26.map(r => r.codigo||r.producto),
  ])];
  const i25 = Object.fromEntries(r25.map(r => [r.codigo||r.producto, r]));
  const i26 = Object.fromEntries(r26.map(r => [r.codigo||r.producto, r]));

  const el = document.getElementById('comp-drill-products');
  if (!el) return;

  const trows = allCodes.slice(0, 120).map(cod => {
    const a = i25[cod] || {};
    const b = i26[cod] || {};
    const dU25 = a.dif_unidades ?? null;
    const dU26 = b.dif_unidades ?? null;
    const dP25 = a.dif_peso     ?? null;
    const dP26 = b.dif_peso     ?? null;
    const cell = (v, isMoney) => v === null ? '<td class="num">—</td>'
      : `<td class="num ${v<0?'loss-cell':v>0?'gain-cell':''}">${v>=0?'+':''}${isMoney ? fmtMoney(v) : fmt(v)}</td>`;
    return `<tr>
      <td class="mono-sm">${cod||'—'}</td>
      <td title="${(a.producto||b.producto||'').replace(/"/g,'&quot;')}">${trunc(a.producto||b.producto||'—',40)}</td>
      <td class="num">${a.unidades_sistema!==undefined ? fmt(a.unidades_sistema) : '—'}</td>
      <td class="num">${b.unidades_sistema!==undefined ? fmt(b.unidades_sistema) : '—'}</td>
      ${cell(dU25,false)}${cell(dU26,false)}
      ${cell(dP25,true)} ${cell(dP26,true)}
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="table-block" style="margin-top:16px">
      <div class="table-header">
        <h3>${value} · <span style="font-weight:400;color:var(--muted)">detalle 2025 vs 2026</span></h3>
        <button class="btn btn-xs" onclick="document.getElementById('comp-drill-products').innerHTML=''">✕ Cerrar</button>
      </div>
      <div class="table-scroll">
        <table class="comp-table">
          <thead><tr>
            <th>Código</th><th>Producto</th>
            <th class="num">STOCK SIS. 25</th><th class="num">STOCK SIS. 26</th>
            <th class="num">DIFERENCIA 25</th><th class="num">DIFERENCIA 26</th>
            <th class="num">DIFERENCIA $ 25</th><th class="num">DIFERENCIA $ 26</th>
          </tr></thead>
          <tbody>${trows}</tbody>
        </table>
      </div>
    </div>`;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ═══════════════════════════════════════════════════════════════
   PERSISTENCIA LOCAL — autosave + restore (TAREA 4)
   localStorage: estado pequeño (filtros, drilldowns, modo activo)
   IndexedDB:    datasets grandes (data2025, data2026 — 9000+ filas)
   Punto de extensión Firebase (futuro): buscar "// FUTURE:FIREBASE"
   ═══════════════════════════════════════════════════════════════ */

const LS_STATE_KEY = 'appInv_v3_state';
const IDB_NAME     = 'appInvDB';
const IDB_STORE    = 'datasets';
const IDB_VER      = 1;

let _saveTimer = null;

function _openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
    req.onsuccess  = e => resolve(e.target.result);
    req.onerror    = e => reject(e.target.error);
  });
}

function saveDataToIDB(year, rows) {
  if (!rows?.length) return;
  _openIDB().then(db => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put({ id: `data${year}`, rows, savedAt: Date.now() });
    tx.oncomplete = () => db.close();
  }).catch(() => {});
  // FUTURE:FIREBASE — aquí se podría añadir respaldo en Firebase Firestore
}

function loadDataFromIDB(year) {
  return _openIDB().then(db => new Promise((resolve, reject) => {
    const tx  = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(`data${year}`);
    req.onsuccess = e => { db.close(); resolve(e.target.result?.rows || null); };
    req.onerror   = e => { db.close(); reject(e.target.error); };
  })).catch(() => null);
}

function clearIDB() {
  return _openIDB().then(db => new Promise(resolve => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
  })).catch(() => {});
}

function saveStateToLS() {
  try {
    const snapshot = {
      filters:       JSON.parse(JSON.stringify(state.filters)),
      searchText:    JSON.parse(JSON.stringify(state.searchText)),
      chartMode:     JSON.parse(JSON.stringify(state.chartMode)),
      drilldown:     JSON.parse(JSON.stringify(state.drilldown)),
      ddState:       JSON.parse(JSON.stringify(state.ddState)),
      compCategoria: state.compCategoria,
      compDrill:     JSON.parse(JSON.stringify(state.compDrill)),
      activeMode:    getCurrentMode(),
      savedAt:       Date.now(),
    };
    localStorage.setItem(LS_STATE_KEY, JSON.stringify(snapshot));
  } catch(e) {}
}

function scheduleSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveStateToLS, 800);
}

function clearSavedSession() {
  localStorage.removeItem(LS_STATE_KEY);
  clearIDB().then(() => {
    state.data2025 = [];
    state.data2026 = [];
    state.filters  = {
      '2025':      { marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'', bodega:'' },
      '2026':      { marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'', bodega:'' },
      comparative: { marca:'', familia:'', perfamilia:'', zona:'', area:'' },
    };
    state.drilldown = { '2025':{ hiperfamilia:'', familia:'', marca:'' }, '2026':{ hiperfamilia:'', familia:'', marca:'' } };
    state.ddState   = { '2025':{ groupBy:'familia', filterField:null, filterValue:null }, '2026':{ groupBy:'familia', filterField:null, filterValue:null } };
    document.getElementById('status-2025').textContent = 'Sin archivos';
    document.getElementById('status-2025').className   = 'upload-status';
    document.getElementById('status-2026').textContent = 'Sin archivos';
    document.getElementById('status-2026').className   = 'upload-status';
    document.getElementById('session-restore-banner').style.display = 'none';
    showWelcome();
    showToast('Sesión limpia. Carga los archivos nuevamente.', 'info');
  });
}

async function restoreSession() {
  const raw = localStorage.getItem(LS_STATE_KEY);
  if (!raw) return false;

  let snap;
  try { snap = JSON.parse(raw); } catch(e) { return false; }

  const [rows25, rows26] = await Promise.all([
    loadDataFromIDB('2025'),
    loadDataFromIDB('2026'),
  ]);

  if (!rows25?.length && !rows26?.length) return false;

  // Restaurar datasets
  if (rows25?.length) { state.data2025 = rows25; document.getElementById('status-2025').textContent = `${rows25.length} filas (guardado)`; document.getElementById('status-2025').className = 'upload-status ok'; }
  if (rows26?.length) { state.data2026 = rows26; document.getElementById('status-2026').textContent = `${rows26.length} filas (guardado)`; document.getElementById('status-2026').className = 'upload-status ok'; }

  // Restaurar estado
  if (snap.filters)       Object.assign(state.filters,       snap.filters);
  if (snap.searchText)    Object.assign(state.searchText,    snap.searchText);
  if (snap.chartMode)     Object.assign(state.chartMode,     snap.chartMode);
  if (snap.drilldown)     Object.assign(state.drilldown,     snap.drilldown);
  if (snap.ddState)       Object.assign(state.ddState,       snap.ddState);
  if (snap.compCategoria) state.compCategoria = snap.compCategoria;
  if (snap.compDrill)     Object.assign(state.compDrill,     snap.compDrill);

  // Mostrar banner
  const fecha = snap.savedAt ? new Date(snap.savedAt).toLocaleString('es-CL') : '';
  const banner = document.getElementById('session-restore-banner');
  document.getElementById('session-restore-msg').textContent = `Sesión restaurada · ${fecha} · ${(rows25?.length||0)+(rows26?.length||0)} registros`;
  if (banner) banner.style.display = 'flex';

  // Ir a la última vista activa
  if (snap.activeMode && ['2025','2026','comparative'].includes(snap.activeMode)) {
    document.getElementById('welcome-screen').style.display = 'none';
    // Activar tab antes de renderizar (getCurrentMode() lo necesita)
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === snap.activeMode));
    if (snap.activeMode === 'comparative') renderModeComp();
    else renderMode(snap.activeMode);
  }

  return true;
}

// ── Hooks de guardado automático ───────────────────────────────
// Se inyectan en las funciones que mutan state sin romper su firma.

const _origSetEmbudoLevel = typeof setEmbudoLevel === 'function' ? setEmbudoLevel : null;
if (_origSetEmbudoLevel) {
  window.setEmbudoLevel = function(year, nivel, value) {
    _origSetEmbudoLevel(year, nivel, value);
    scheduleSave();
  };
}

const _origClearFilters = typeof clearFilters === 'function' ? clearFilters : null;
if (_origClearFilters) {
  window.clearFilters = function(mode) {
    _origClearFilters(mode);
    scheduleSave();
  };
}

// ── Init de persistencia al cargar ────────────────────────────
// Auto-restore deshabilitado: la app siempre parte limpia. restoreSession()
// conservada como función pero no se llama automáticamente.
document.addEventListener('DOMContentLoaded', () => {
  clearIDB().catch(() => {});
  localStorage.removeItem(LS_STATE_KEY);
});

// ── Hook en parseFile para guardar datasets en IDB ───────────
// parseFile llama a onComplete(data, year) al terminar.
// Encadenamos sin romper la función original.
const _origParseFile = typeof parseFile === 'function' ? parseFile : null;
if (_origParseFile) {
  window.parseFile = function(file, year) {
    return _origParseFile(file, year);
  };
}
