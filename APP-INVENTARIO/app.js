'use strict';

/* ═══════════════════════════════════════════════════════════════
   INVENTARIO EL MANZANO · app.js
   ═══════════════════════════════════════════════════════════════ */

// ── ESTADO GLOBAL ──────────────────────────────────────────────
const state = {
  data2025: [],
  data2026: [],
  charts: {},
  sortState: {},
  pendingLoad: null,
  filters: {
    '2025':       { marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'', bodega:'' },
    '2026':       { marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'', bodega:'' },
    comparative:  { marca:'', familia:'', zona:'', area:'' }
  },
  searchText: { '2025': '', '2026': '' },
  chartMode:  { '2025': 'unidades', '2026': 'unidades' },
};

// ── MAPEO DE COLUMNAS ──────────────────────────────────────────
// Incluye columnas específicas de archivos El Manzano:
//   TABLA_ANALISIS: Descripcion, CONTEO (físico), STOCK SISTEMA, FAMILIA, MARCA, HIPERMALIA
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
  bodega:           'Bodega EM',
};

function normalizeHeader(h) {
  return (h || '').toString().toUpperCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar tildes
    .replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
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
  return { mapping, missing };
}

// Campos opcionales: si faltan, no bloqueamos
const OPTIONAL_FIELDS = new Set(['peso_sistema','peso_real','zona','area','patente',
                                  'perfamilia','marca','familia','subfamilia','costo','codigo']);
const CRITICAL_FIELDS = ['producto','unidades_sistema','unidades_real'];

function applyRowMapping(rawRow, mapping) {
  const row = {};
  for (const [field, col] of Object.entries(mapping)) {
    row[field] = col ? (rawRow[col] ?? '') : '';
  }
  // Fallback a columnas enriquecidas si el campo está vacío
  if (!row.area    && rawRow._area)    row.area    = rawRow._area;
  if (!row.patente && rawRow._patente) row.patente = rawRow._patente;
  if (!row.zona    && rawRow._zona)    row.zona    = rawRow._zona;
  if (!row.marca   && rawRow._marca)   row.marca   = rawRow._marca;
  if (!row.perfamilia && rawRow._hiper)        row.perfamilia = rawRow._hiper;
  if (!row.familia    && rawRow._familia)      row.familia    = rawRow._familia;
  if (!row.subfamilia && rawRow._subfamilia)   row.subfamilia = rawRow._subfamilia;
  if (!row.bodega     && rawRow._bodega)       row.bodega     = rawRow._bodega;

  // Garantizar campos no mapeados
  for (const f of Object.keys(FIELD_ALIASES)) {
    if (!(f in row)) row[f] = '';
  }
  // Convertir numéricos
  row.unidades_sistema = parseNum(row.unidades_sistema);
  row.unidades_real    = parseNum(row.unidades_real);
  row.peso_sistema     = parseNum(row.peso_sistema);
  row.peso_real        = parseNum(row.peso_real);
  row.costo            = parseNum(row.costo);
  // Calcular diferencias
  row.dif_unidades     = row.unidades_real - row.unidades_sistema;
  row.dif_peso         = row.peso_real    - row.peso_sistema;
  row.abs_dif_unidades = Math.abs(row.dif_unidades);
  row.abs_dif_peso     = Math.abs(row.dif_peso);
  // Normalizar strings
  for (const f of ['producto','patente','zona','area','marca','familia','perfamilia','subfamilia','codigo','bodega']) {
    row[f] = (row[f] || '').toString().trim();
  }
  return row;
}

function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const s = v.toString().replace(/\s/g, '');
  // Manejar formato europeo (1.234,56) y americano (1,234.56)
  const cleaned = s.replace(/[^\d.,\-]/g, '');
  const hasComma = cleaned.includes(',');
  const hasDot   = cleaned.includes('.');
  let normalized = cleaned;
  if (hasComma && hasDot) {
    // Detectar cuál es separador decimal (el último)
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (hasComma && !hasDot) {
    normalized = cleaned.replace(',', '.');
  }
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
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
  if (!wb.SheetNames.includes('familia')) return {};
  try {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['familia'], { defval: '', raw: false });
    const index = {};
    for (const r of rows) {
      const cod = (r.Codigo || r.CODIGO || '').toString().trim();
      if (!cod) continue;
      index[cod] = {
        marca:        (r.Marca || r.MARCA || '').toString().trim(),
        hiperfamilia: (r.Hiperfamilia || r.HIPERFAMILIA || '').toString().trim(),
        familia:      (r.Familia || r.FAMILIA || '').toString().trim(),
      };
    }
    return index;
  } catch { return {}; }
}

// Construye índice de datos faltantes (marca/familia/hiperfamilia) desde hoja 'datos_faltantes'
// Permite enriquecer registros que en TABLA_ANALISIS no traen categorización completa.
function buildMissingDataIndex(wb) {
  if (!wb || !wb.SheetNames.includes('datos_faltantes')) return null;
  try {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['datos_faltantes'], { defval: '', raw: false });
    const index = {};
    for (const r of rows) {
      const cod = (r.CODIGO || r.Codigo || r.codigo_tecnico || r.CODIGO_TECNICO || '').toString().trim();
      if (!cod) continue;
      index[cod] = {
        marca:      (r.Marca      || r.MARCA      || '').toString().trim(),
        familia:    (r.Familia    || r.FAMILIA    || '').toString().trim(),
        perfamilia: (r.Hiperfamilia || r.HIPERFAMILIA || r.HIPERMALIA || r.PERFAMILIA || r.Perfamilia || '').toString().trim(),
        subfamilia: (r.SubFamilia  || r.SUBFAMILIA  || r.Subfamilia  || '').toString().trim(),
      };
    }
    return index;
  } catch { return null; }
}

// Construye índice de bodega desde hojas PEM y SEM.
// Usa columna Disp > 0 para determinar si un producto está físicamente en esa bodega.
// Un código puede aparecer en ambas (stock físico en PEM y en SEM simultáneamente).
// Solo indica PERTENENCIA — ningún número de stock/físico pasa al análisis.
function buildBodegaIndex(wb) {
  const inPEM = new Set();
  const inSEM = new Set();

  if (wb.SheetNames.includes('PEM')) {
    try {
      // Encabezados en fila 19 (range:18 en base 0)
      const rows = XLSX.utils.sheet_to_json(wb.Sheets['PEM'], { defval: '', raw: true, range: 18 });
      for (const r of rows) {
        const cod  = (r['Codigo_Tecnico'] || r['Codigo_tecnico'] || r['CODIGO_TECNICO'] || '').toString().trim();
        const disp = parseFloat(r['Disp']) || 0;
        if (cod && disp > 0) inPEM.add(cod);
      }
    } catch { /* skip */ }
  }

  if (wb.SheetNames.includes('SEM')) {
    try {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets['SEM'], { defval: '', raw: true, range: 18 });
      for (const r of rows) {
        const cod  = (r['Codigo_Tecnico'] || r['Codigo_tecnico'] || r['CODIGO_TECNICO'] || '').toString().trim();
        const disp = parseFloat(r['Disp']) || 0;
        if (cod && disp > 0) inSEM.add(cod);
      }
    } catch { /* skip */ }
  }

  const index = {};
  for (const cod of inPEM) index[cod] = inSEM.has(cod) ? 'PEM+SEM' : 'PEM';
  for (const cod of inSEM) if (!index[cod]) index[cod] = 'SEM';
  return index;
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
          const bodegaIndex  = buildBodegaIndex(wb);
          const enriched = rows.map(r => {
            const cod = (r.Codigo_tecnico || r.CODIGO || r.Codigo_Tecnico || '').toString().trim();
            const loc = locIndex[cod] || {};
            const fam = famIndex[cod] || {};
            const mis = (missingIndex && cod && missingIndex[cod]) || {};
            return {
              ...r,
              _area:    r.AREA    || loc.area    || '',
              _patente: r.PATENTE || loc.patente || '',
              _zona:    r.ZONA    || loc.zona    || '',
              _marca:      r.MARCA   || fam.marca   || mis.marca || '',
              _hiper:      r.HIPERMALIA || r.HIPERFAMILIA || fam.hiperfamilia || mis.perfamilia || '',
              _familia:    r.FAMILIA || fam.familia || mis.familia || '',
              _subfamilia: r.SubFamilia || r.SUBFAMILIA || mis.subfamilia || '',
              _bodega:     bodegaIndex[cod] || '',
            };
          });
          resolve({ headers, rows: enriched, wb, sheetName });
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

  for (let i = 0; i < fileArr.length; i++) {
    const file = fileArr[i];
    let data;
    try { data = await readFileData(file); }
    catch (e) { showToast(`Error en ${file.name}: ${e.message}`, 'error'); continue; }
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
          state.pendingLoad = { files: fileArr.slice(i), year, partialMapping: mapping };
          showMappingDialog(data.headers, mapping, year);
          return;
        }
      } else {
        for (const f of missing) if (!mapping[f]) mapping[f] = null;
        sharedMapping = mapping;
      }
    }

    const normalized = data.rows
      .map(r => applyRowMapping(r, sharedMapping))
      .filter(r => r.producto !== '' || r.unidades_sistema !== 0 || r.unidades_real !== 0);
    allRows = allRows.concat(normalized);
  }

  if (!allRows.length) { showToast('Sin datos válidos en los archivos.', 'error'); return; }

  if (year === '2025') state.data2025 = state.data2025.concat(allRows);
  else                 state.data2026 = state.data2026.concat(allRows);

  updateSidebarStatus(year);
  refreshView();
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
  for (const file of files) {
    let data;
    try { data = await readFileData(file); }
    catch { continue; }
    const rows = data.rows
      .map(r => applyRowMapping(r, mapping))
      .filter(r => r.producto !== '' || r.unidades_sistema !== 0 || r.unidades_real !== 0);
    allRows = allRows.concat(rows);
  }

  if (year === '2025') state.data2025 = state.data2025.concat(allRows);
  else                 state.data2026 = state.data2026.concat(allRows);

  state.pendingLoad = null;
  updateSidebarStatus(year);
  refreshView();
  showToast(`${allRows.length.toLocaleString('es-CL')} registros cargados (${year})`, 'ok');
}

function cancelMapping() {
  document.getElementById('mapping-modal').classList.add('hidden');
  state.pendingLoad = null;
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

function clearAllData() {
  if (!confirm('¿Limpiar todos los datos cargados?')) return;
  state.data2025 = [];
  state.data2026 = [];
  state.sortState = {};
  state.filters['2025']      = { marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'' };
  state.filters['2026']      = { marca:'', familia:'', perfamilia:'', zona:'', area:'', patente:'' };
  state.filters.comparative  = { marca:'', familia:'', zona:'', area:'' };
  state.searchText = { '2025': '', '2026': '' };
  state.chartMode  = { '2025': 'unidades', '2026': 'unidades' };

  ['2025','2026'].forEach(y => {
    const el = document.getElementById(`status-${y}`);
    el.textContent = 'Sin archivos';
    el.className = 'upload-status';
    document.getElementById(`input-${y}`).value = '';
  });
  document.getElementById('sidebar-info').innerHTML = '';

  Object.values(state.charts).forEach(c => c.destroy());
  state.charts = {};

  showWelcome();
}

// ── FILTRADO ───────────────────────────────────────────────────
function getFilteredData(year) {
  const src = year === '2025' ? state.data2025 : state.data2026;
  const f   = state.filters[year];
  const q   = (state.searchText[year] || '').toLowerCase().trim();
  return src.filter(r => {
    if (f.bodega     && r.bodega     !== f.bodega)      return false;
    if (f.marca      && r.marca      !== f.marca)       return false;
    if (f.familia    && r.familia    !== f.familia)      return false;
    if (f.perfamilia && r.perfamilia !== f.perfamilia)  return false;
    if (f.zona       && r.zona       !== f.zona)        return false;
    if (f.area       && r.area       !== f.area)        return false;
    if (f.patente    && r.patente    !== f.patente)     return false;
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
  refreshView();
}

function getFilteredDataComp() {
  const f = state.filters.comparative;
  const fn = r =>
    (!f.marca   || r.marca   === f.marca)   &&
    (!f.familia || r.familia === f.familia) &&
    (!f.zona    || r.zona    === f.zona)    &&
    (!f.area    || r.area    === f.area);
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
    <div class="kpi-card ${semU}">
      <div class="kpi-label">Exactitud Unidades</div>
      <div class="kpi-value">${fmtPct(k.exact_unid)}%</div>
      <div class="kpi-sub">${semLabel(semU)}</div>
    </div>
    <div class="kpi-card ${semP}">
      <div class="kpi-label">Exactitud Peso</div>
      <div class="kpi-value">${fmtPct(k.exact_peso)}%</div>
      <div class="kpi-sub">${semLabel(semP)}</div>
    </div>
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">Σ Dif. Unidades (abs)</div>
      <div class="kpi-value">${fmt(k.adu)}</div>
      <div class="kpi-sub">Sist: ${fmt(k.us)} / Real: ${fmt(k.ur)}</div>
    </div>
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">Σ Dif. Peso (abs)</div>
      <div class="kpi-value">${fmt(k.adp)}</div>
      <div class="kpi-sub">Sist: ${fmt(k.ps)} / Real: ${fmt(k.pr)}</div>
    </div>
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">Registros</div>
      <div class="kpi-value">${fmt(k.count)}</div>
      <div class="kpi-sub">productos analizados</div>
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
        <div class="kpi-count-label">Correctos</div>
        <div class="kpi-count-value">${fmt(c.correctos)}</div>
        <div class="kpi-count-pct">${fmtPct(c.pctCorr)}%</div>
      </div>
      <div class="kpi-count-card count-falt">
        <div class="kpi-count-label">Faltantes</div>
        <div class="kpi-count-value">${fmt(c.faltantes)}</div>
        <div class="kpi-count-pct">${fmtPct(c.pctFalt)}%</div>
      </div>
      <div class="kpi-count-card count-sobr">
        <div class="kpi-count-label">Sobrantes</div>
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
        <div class="kpi-mon-label">Total Sistema</div>
        <div class="kpi-mon-value">${fmtMoney(m.totalSistema)}</div>
        <div class="kpi-mon-pct">valor en sistema</div>
      </div>
      <div class="kpi-mon-card">
        <div class="kpi-mon-label">Total Conteo</div>
        <div class="kpi-mon-value">${fmtMoney(m.totalConteo)}</div>
        <div class="kpi-mon-pct">valor físico real</div>
      </div>
      <div class="kpi-mon-card ${m.difTotal < 0 ? 'mon-neg' : 'mon-pos'}">
        <div class="kpi-mon-label">Diferencia Global</div>
        <div class="kpi-mon-value">${fmtMoney(m.difTotal)}</div>
        <div class="kpi-mon-pct">${pctSign(m.pctDifTotal)} sobre sistema</div>
      </div>
      <div class="kpi-mon-card mon-pos">
        <div class="kpi-mon-label">Diferencias + (sobrantes)</div>
        <div class="kpi-mon-value">${fmtMoney(m.difPos)}</div>
        <div class="kpi-mon-pct">${pctSign(m.pctDifPos)} sobre sistema</div>
      </div>
      <div class="kpi-mon-card mon-neg">
        <div class="kpi-mon-label">Diferencias − (faltantes)</div>
        <div class="kpi-mon-value">${fmtMoney(m.difNeg)}</div>
        <div class="kpi-mon-pct">${fmtPct(m.pctDifNeg)}% sobre sistema</div>
      </div>
      <div class="kpi-mon-card mon-disp">
        <div class="kpi-mon-label">Dispersión total</div>
        <div class="kpi-mon-value">${fmtMoney(m.dispersion)}</div>
        <div class="kpi-mon-pct">${fmtPct(m.pctDispersion)}% del sistema · |dif+|+|dif−|</div>
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

  // Grupos de segmentación — orden: las más discriminantes primero
  const groups = mode === 'comparative'
    ? [['perfamilia','Hiperfamilia'],['marca','Marca'],['familia','Familia'],['zona','Zona']]
    : [['bodega','Bodega EM'],['perfamilia','Hiperfamilia'],['marca','Marca'],['familia','Familia'],['zona','Zona'],['area','Área']];

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

    // Gráfico 3: Zona — Valor Sistema vs Conteo
    const byZona = aggregateBy(data, 'zona').sort((a,b) => b.ps - a.ps).slice(0,12);
    const h4zona = document.querySelector(`#chart-zona-${year}`)?.closest('.chart-card')?.querySelector('h4');
    if (h4zona) h4zona.textContent = 'Valor $ Sistema vs Conteo por Zona';
    groupedBarChart(`chart-zona-${year}`, byZona.map(r => r.fd.zona || '(sin zona)'), [
      { label: '$ Sistema', data: byZona.map(r => r.ps) },
      { label: '$ Conteo',  data: byZona.map(r => r.pr) },
    ]);

    // Gráfico 4: Donut Hiperfamilia $
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

    // Gráfico 3: Zona — Sistema vs Real
    const byZona = aggregateBy(data, 'zona').sort((a,b) => b.us - a.us).slice(0,12);
    const h4zona = document.querySelector(`#chart-zona-${year}`)?.closest('.chart-card')?.querySelector('h4');
    if (h4zona) h4zona.textContent = 'Unidades Sistema vs Real por Zona';
    groupedBarChart(`chart-zona-${year}`, byZona.map(r => r.fd.zona || '(sin zona)'), [
      { label: 'Unidades Sistema', data: byZona.map(r => r.us) },
      { label: 'Unidades Real',    data: byZona.map(r => r.ur) },
    ]);

    // Gráfico 4: Donut Hiperfamilia unidades
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
state.drilldown = {
  '2025': { groupBy: 'familia', filterField: null, filterValue: null },
  '2026': { groupBy: 'familia', filterField: null, filterValue: null },
};

function renderDrilldown(year, data) {
  const el = document.getElementById(`drilldown-${year}`);
  if (!el) return;
  const dd = state.drilldown[year];

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
    tableHtml = buildDDProductTable(sorted);
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
  const rows = groups.map(g => {
    const val    = g.fd[groupBy] || '(sin clasificar)';
    const valEsc = val.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const signU  = g.du >= 0 ? '+' : '';
    const signP  = g.dp >= 0 ? '+' : '';
    const clsU   = g.du < 0 ? 'loss-cell' : g.du > 0 ? 'gain-cell' : '';
    const clsP   = g.dp < 0 ? 'loss-cell' : g.dp > 0 ? 'gain-cell' : '';
    return `<tr style="cursor:pointer" onclick="drillIntoGroup('${year}','${groupBy}','${valEsc}')">
      <td class="dd-group-name">${val}</td>
      <td class="num">${g.count}</td>
      <td class="num">${fmt(g.us)}</td>
      <td class="num">${fmt(g.ur)}</td>
      <td class="num ${clsU}">${signU}${fmt(g.du)}</td>
      <td class="num">${fmtMoney(g.ps)}</td>
      <td class="num">${fmtMoney(g.pr)}</td>
      <td class="num ${clsP}">${signP}${fmtMoney(g.dp)}</td>
      <td class="num">${fmtPct(g.exact_unid)}%</td>
    </tr>`;
  }).join('');
  return `<table class="data-table dd-table">
    <thead><tr>
      <th>${groupLabel}</th>
      <th class="num">Productos</th>
      <th class="num">En Sistema (unid)</th>
      <th class="num">Contado (unid)</th>
      <th class="num">Diferencia (unid)</th>
      <th class="num">Valor Sistema ($)</th>
      <th class="num">Valor Contado ($)</th>
      <th class="num">Diferencia ($)</th>
      <th class="num">% Exactitud</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildDDProductTable(data) {
  if (!data.length) return '<p class="no-data">Sin productos en esta categoría.</p>';
  const rows = data.map(r => {
    const signU = r.dif_unidades >= 0 ? '+' : '';
    const signP = r.dif_peso     >= 0 ? '+' : '';
    const clsU  = r.dif_unidades < 0 ? 'loss-cell' : r.dif_unidades > 0 ? 'gain-cell' : '';
    const clsP  = r.dif_peso     < 0 ? 'loss-cell' : r.dif_peso     > 0 ? 'gain-cell' : '';
    return `<tr>
      <td class="mono-sm">${r.codigo || '—'}</td>
      <td title="${(r.producto||'').replace(/"/g,'&quot;')}">${trunc(r.producto, 45)}</td>
      <td class="num">${fmt(r.unidades_sistema)}</td>
      <td class="num">${fmt(r.unidades_real)}</td>
      <td class="num ${clsU}">${signU}${fmt(r.dif_unidades)}</td>
      <td class="num">${fmtMoney(r.peso_sistema)}</td>
      <td class="num">${fmtMoney(r.peso_real)}</td>
      <td class="num ${clsP}">${signP}${fmtMoney(r.dif_peso)}</td>
    </tr>`;
  }).join('');
  return `<table class="data-table dd-table">
    <thead><tr>
      <th>Código</th>
      <th>Descripción del Producto</th>
      <th class="num">En Sistema (unid)</th>
      <th class="num">Contado (unid)</th>
      <th class="num">Diferencia (unid)</th>
      <th class="num">Valor Sistema ($)</th>
      <th class="num">Valor Contado ($)</th>
      <th class="num">Diferencia ($)</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function setDrilldownGroup(year, groupBy) {
  state.drilldown[year] = { groupBy, filterField: null, filterValue: null };
  renderDrilldown(year, getFilteredData(year));
}

function drillIntoGroup(year, field, value) {
  state.drilldown[year].filterField = field;
  state.drilldown[year].filterValue = value;
  renderDrilldown(year, getFilteredData(year));
  document.getElementById(`drilldown-${year}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearDrilldownFilter(year) {
  state.drilldown[year].filterField = null;
  state.drilldown[year].filterValue = null;
  renderDrilldown(year, getFilteredData(year));
}

function exportDrilldownTable(year) {
  const tbl = document.querySelector(`#dd-tbl-${year} table`);
  if (!tbl) return;
  if (!tbl.id) tbl.id = `_dd_export_${year}`;
  exportTableToExcel(tbl.id, `Desglose_${year}`);
}

function renderResumen(id, groups, keyLabel) {
  const sorted = [...groups].sort((a,b) => b.adu - a.adu);
  buildTable(id,
    [keyLabel, 'Unid Sist', 'Unid Real', 'Peso Sist', 'Peso Real',
     'Abs Dif Unid', 'Abs Dif Peso', '% Exact Unid', '% Exact Peso'],
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
    ['Marca','Familia','Producto',
     'Unid 25','Unid 26','Dif Unid 25','Dif Unid 26',
     'Peso 25','Peso 26',
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
function exportTableToExcel(tableId, fileName) {
  const table = document.getElementById(tableId);
  if (!table?.rows.length) { showToast('Sin datos para exportar.', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.table_to_sheet(table);
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, `${fileName || tableId}_${today()}.xlsx`);
  showToast('Archivo Excel generado.', 'ok');
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

function refreshView() {
  const has25 = state.data2025.length > 0;
  const has26 = state.data2026.length > 0;
  const mode  = getCurrentMode();

  // Modos especiales: no dependen de data2025/2026
  if (mode === 'checklist' || mode === 'planos') return;

  if (!has25 && !has26) { showWelcome(); return; }
  document.getElementById('welcome-screen').style.display = 'none';

  const allViews = ['2025','2026','comparative','checklist','planos'];
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
  renderFilters(year);
  renderKPIs(year, data);
  renderCountKPIs(year, data);
  renderMonetaryKPIs(year, data);
  renderInsights(year, data);
  renderTables(year, data);
  renderChartModeBar(year);
  renderCharts(year, data); // después de visible
}

function renderModeComp() {
  ['2025','2026','comparative'].forEach(m =>
    document.getElementById(`view-${m}`)?.classList.add('hidden'));

  document.getElementById('view-comparative').classList.remove('hidden');
  const { d25, d26 } = getFilteredDataComp();
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

// ── PRINT MODE ─────────────────────────────────────────────────
function printMode(mode) {
  // Marca la vista activa y lanza print
  document.querySelectorAll('.view').forEach(v => v.classList.remove('print-active'));
  const el = document.getElementById(`view-${mode}`);
  if (el) el.classList.add('print-active');
  window.print();
}

// ── EMAIL REPORT ───────────────────────────────────────────────
function emailReport(mode) {
  const titles = {
    '2025': 'Análisis Inventario 2025',
    '2026': 'Análisis Inventario 2026',
    comparative: 'Comparativo 2025 vs 2026',
    checklist: 'CheckList Inventario',
    planos: 'Planos de Patentes',
  };
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

  const headerRow = raw[headerRowIdx] || [];
  const dayRow    = raw[dayRowIdx]    || [];

  // Columnas fijas: task (col 0), responsable (col 1), dias (col 2)
  // Columnas Gantt: col 3 en adelante
  const ganttCols = dayRow.slice(3).map((d, i) => ({ idx: i + 3, label: d }));

  const table  = document.getElementById('gantt-table');
  const ganttSection = document.getElementById('gantt-section');

  // HEAD
  let thead = '<thead><tr>';
  thead += `<th class="col-task">Tarea</th>`;
  thead += `<th class="col-resp">Responsable</th>`;
  ganttCols.forEach(col => {
    const v   = String(col.label).trim();
    const num = parseFloat(v);
    let cls = 'col-neg';
    if (/sab|dom/i.test(v))    cls = 'col-weekend';
    else if (!isNaN(num) && num > 0) cls = 'col-pos';
    else if (v === '1' || v === '0') cls = 'col-today';
    thead += `<th class="${cls}">${v || ''}</th>`;
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
    tbody += `<td class="td-resp">${resp}</td>`;
    ganttCols.forEach(col => {
      const val  = row[col.idx];
      const dayV = String(dayRow[col.idx] || '').trim();
      const hasVal = val !== '' && val !== null && val !== undefined;
      const isWknd = /sab|dom/i.test(dayV);
      if (isWknd) tbody += `<td class="td-weekend"></td>`;
      else if (hasVal) tbody += `<td class="td-active" title="${val}"></td>`;
      else tbody += `<td></td>`;
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
   PLANOS DE PATENTES
   ═══════════════════════════════════════════════════════════════ */

// Solo las 4 hojas visibles del archivo de planos
const PLANO_ZONES = {
  'Sala 1':    { label: 'Sala 1',          color: '#1e40af', numBg: '#dbeafe', numColor: '#1e3a8a' },
  '1erPiso_A': { label: '1er Piso Bod. A', color: '#166534', numBg: '#dcfce7', numColor: '#14532d' },
  '2doPiso_A': { label: '2do Piso Bod. A', color: '#6b21a8', numBg: '#ede9fe', numColor: '#4c1d95' },
  'Patio_2':   { label: 'Patio 2',         color: '#92400e', numBg: '#fef3c7', numColor: '#78350f' },
};

const PLANO_NUM_COLORS = [
  '#dbeafe','#dcfce7','#ede9fe','#ffedd5','#fef3c7','#d1fae5','#fce7f3','#e0f2fe',
];

let planosData  = {}; // { sheetName: rows2d }
let planosPatentes = []; // [{patente, zona, area}]

async function loadPlanos(file) {
  showToast('Leyendo planos…', 'info');
  try {
    const wb = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => {
        try { res(XLSX.read(new Uint8Array(e.target.result), { type: 'array' })); }
        catch (err) { rej(err); }
      };
      reader.onerror = rej;
      reader.readAsArrayBuffer(file);
    });

    planosData = {};
    wb.SheetNames.forEach(name => {
      planosData[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    });

    // Extraer patentes de las 4 hojas visibles (escanea la cuadrícula)
    planosPatentes = extractPatentesFromGridSheets(planosData);

    renderPlanos(wb.SheetNames);
    // Sincronizar con correlativo
    if (planosPatentes.length) initCorrelativoFromPlanos(planosPatentes);

    switchToMode('planos');
    const visibleCount = ['Sala 1','1erPiso_A','2doPiso_A','Patio_2'].filter(n => wb.SheetNames.includes(n)).length;
    document.getElementById('status-planos').textContent = `${visibleCount} hojas · ${planosPatentes.length} patentes`;
    document.getElementById('status-planos').className = 'upload-status ok';
    showToast(`Planos cargados · ${planosPatentes.length} patentes detectadas ✓`, 'ok');
  } catch (e) {
    showToast('Error al leer Planos: ' + e.message, 'error');
  }
}

// Extrae patentes únicas escaneando las 4 hojas visibles de la cuadrícula
function extractPatentesFromGridSheets(allData) {
  const VISIBLE = ['Sala 1','1erPiso_A','2doPiso_A','Patio_2'];
  const seen = new Set();
  const result = [];
  const isPatenteNum = (v) => {
    if (v === '' || v === null || v === undefined) return false;
    const s = String(v).trim();
    const m = s.match(/^(\d{2,4})(\s+\S+)?$/);
    return m && parseInt(m[1], 10) > 1;
  };
  for (const sheetName of VISIBLE) {
    const rows = allData[sheetName];
    if (!rows) continue;
    const z = PLANO_ZONES[sheetName];
    for (const row of rows) {
      for (const cell of row) {
        const s = String(cell || '').trim();
        if (isPatenteNum(s) && !seen.has(s)) {
          seen.add(s);
          result.push({ patente: s, zona: z ? z.label : sheetName, area: sheetName });
        }
      }
    }
  }
  return result.sort((a, b) => parseInt(a.patente) - parseInt(b.patente));
}

// Render principal — solo las 4 hojas visibles
function renderPlanos(allSheetNames) {
  // Filtrar solo las hojas conocidas/visibles, en orden
  const ordered   = ['Sala 1','1erPiso_A','2doPiso_A','Patio_2'];
  const sheetNames = ordered.filter(n => allSheetNames.includes(n));

  const content = document.getElementById('planos-content');
  const tabsEl  = document.getElementById('plano-tabs');
  const legendEl= document.getElementById('plano-legend');
  const emptyEl = document.getElementById('planos-empty');
  if (emptyEl) emptyEl.style.display = 'none';

  // Leyenda simple
  legendEl.innerHTML = sheetNames.map(name => {
    const z = PLANO_ZONES[name];
    return `<span class="legend-chip" style="background:${hexToRgba(z.color,.1)};color:${z.color}">
      <span class="dot" style="background:${z.color}"></span>${z.label}
    </span>`;
  }).join('');

  // Tabs
  tabsEl.innerHTML = sheetNames.map((name, i) => {
    const z = PLANO_ZONES[name];
    return `<button class="plano-tab-btn${i===0?' active':''}"
              onclick="showPlanoSheet('${name}')"
              style="${i===0?`border-color:${z.color};background:${z.color};color:#fff`:''}">
              ${z.label}
            </button>`;
  }).join('');

  // Una sección por hoja — layout FIEL al Excel
  content.innerHTML = sheetNames.map((name, i) => {
    const z     = PLANO_ZONES[name];
    const rows  = planosData[name] || [];
    const count = countPatentesInSheet(rows);
    const inner = renderPlanoGrid(rows, z);

    return `<div class="plano-sheet${i>0?' hidden':''}" id="plano-sheet-${safeName(name)}">
      <div class="plano-sheet-header" style="background:${z.color}">
        <div>
          <div class="plano-sheet-title">${z.label}</div>
          <div class="plano-sheet-sub">~${count} patentes detectadas</div>
        </div>
        <button class="btn btn-xs"
          style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.3)"
          onclick="exportSheetExcel('${name}')">⬇ Excel</button>
      </div>
      <div class="plano-raw-wrap">${inner}</div>
    </div>`;
  }).join('');
}

function showPlanoSheet(name) {
  document.querySelectorAll('.plano-sheet').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(`plano-sheet-${safeName(name)}`);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.plano-tab-btn').forEach(btn => {
    const active = btn.textContent.trim() === PLANO_ZONES[name]?.label;
    btn.classList.toggle('active', active);
    const z = PLANO_ZONES[name];
    btn.style.borderColor = active ? z.color : '';
    btn.style.background  = active ? z.color : '';
    btn.style.color       = active ? '#fff'  : '';
  });
}

// ── RENDER GRID FIEL AL EXCEL ─────────────────────────────────
// Convierte la matriz 2D directamente a tabla HTML, preservando
// posiciones exactas. Solo agrega color de fondo a celdas con
// número de patente — no mueve ni restructura nada.
function renderPlanoGrid(rows, zone) {
  if (!rows.length) return '<p style="padding:20px;color:var(--muted)">Sin datos en esta hoja.</p>';

  // Recortar filas vacías al final
  let lastRow = 0;
  rows.forEach((r, i) => { if (r.some(c => c !== '' && c !== null && c !== undefined)) lastRow = i; });
  const trimmed = rows.slice(0, lastRow + 1);

  // Ancho máximo de columnas
  const maxCols = Math.max(...trimmed.map(r => r.length), 1);

  // Detectar si una celda es número de patente:
  // entero > 1 que puede venir solo o con sufijo texto (ej: "397 MIX", "73")
  const isPatenteNum = (v) => {
    if (v === '' || v === null || v === undefined) return false;
    const s = String(v).trim();
    const m = s.match(/^(\d{2,4})(\s+\S+)?$/); // 2-4 dígitos, opcionalmente texto
    return m && parseInt(m[1], 10) > 1;
  };

  let html = `<table class="plano-raw-table">`;
  trimmed.forEach(row => {
    html += '<tr>';
    for (let ci = 0; ci < maxCols; ci++) {
      const v   = row[ci];
      const raw = (v !== null && v !== undefined) ? String(v).trim() : '';

      if (raw === '') {
        html += '<td></td>';
      } else if (isPatenteNum(raw)) {
        // Número de patente → color de zona + negrita
        html += `<td class="cell-num"
                    style="background:${zone.numBg};color:${zone.numColor}"
                    title="Patente ${raw}">${raw}</td>`;
      } else {
        // Texto (etiqueta de zona, nombre, dibujo) → tal cual, sin alterar
        const isLong = raw.length > 3;
        html += `<td class="${isLong ? 'cell-label' : ''}" title="${raw}">${raw}</td>`;
      }
    }
    html += '</tr>';
  });
  html += '</table>';
  return html;
}

function countPatentesInSheet(rows) {
  let count = 0;
  rows.forEach(r => r.forEach(c => {
    const s = String(c || '').trim();
    if (s && !isNaN(parseFloat(s)) && parseFloat(s) > 10) count++;
  }));
  return count;
}

function exportPlanosExcel() {
  if (!Object.keys(planosData).length) { showToast('Carga el archivo de Planos primero', 'error'); return; }
  const wb = XLSX.utils.book_new();
  Object.entries(planosData).forEach(([name, rows]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
  });
  XLSX.writeFile(wb, `Planos_Patentes_${today()}.xlsx`);
  showToast('Excel de planos generado ✓', 'ok');
}

function exportSheetExcel(sheetName) {
  const rows = planosData[sheetName];
  if (!rows) return;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName.substring(0, 31));
  XLSX.writeFile(wb, `Plano_${safeName(sheetName)}_${today()}.xlsx`);
  showToast(`Excel "${sheetName}" generado ✓`, 'ok');
}

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

  const cols = ['Patente','Productos','Correctos','%','Faltantes','%','Sobrantes','%','Valor Sistema','Valor Conteo','Dif $','Dispersión $'];
  let html = `<div class="tbl-wrap"><table class="tbl" id="v2-pat-tbl">
    <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>`;

  for (const g of rows) {
    const dif  = g.vc - g.vs;
    const disp = Math.abs(g.dp) + Math.abs(g.dn);
    html += `<tr>
      <td><strong>${g.patente}</strong></td>
      <td>${fmt(g.total)}</td>
      <td class="delta-pos">${fmt(g.corr)}</td><td>${fmtPct(g.corr/g.total*100)}%</td>
      <td class="delta-neg">${fmt(g.falt)}</td><td>${fmtPct(g.falt/g.total*100)}%</td>
      <td style="color:#f59e0b">${fmt(g.sobr)}</td><td>${fmtPct(g.sobr/g.total*100)}%</td>
      <td>${fmtMoney(g.vs)}</td>
      <td>${fmtMoney(g.vc)}</td>
      <td class="${dif<0?'delta-neg':'delta-pos'}">${fmtMoney(dif)}</td>
      <td>${fmtMoney(disp)}</td>
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

  const cols = ['Segmento Precio Unitario','Productos','Correctos','% Exactos','Faltantes','Sobrantes','Valor Sistema','Dispersión $'];
  let html = `<div class="tbl-wrap"><table class="tbl">
    <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>`;

  for (const b of buckets) {
    const sem = b.exact >= 95 ? 'delta-pos' : b.exact >= 85 ? '' : 'delta-neg';
    html += `<tr>
      <td><strong>${b.label}</strong></td>
      <td>${fmt(b.total)}</td>
      <td class="delta-pos">${fmt(b.corr)}</td>
      <td class="${sem}">${fmtPct(b.exact)}%</td>
      <td class="delta-neg">${fmt(b.falt)}</td>
      <td style="color:#f59e0b">${fmt(b.sobr)}</td>
      <td>${fmtMoney(b.vs)}</td>
      <td>${fmtMoney(b.adp)}</td>
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

  const cols = ['#','Código','Producto','Hiperfamilia','Patente','Área','Stock Sist.','Conteo','Dif. Unid.','Costo Unit.','Riesgo $'];
  let html = `<div class="tbl-wrap"><table class="tbl" id="v2-riesgo-tbl">
    <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>`;

  enriched.forEach((r, i) => {
    const dCls = r.dif_unidades < 0 ? 'delta-neg' : 'delta-pos';
    html += `<tr>
      <td>${i+1}</td>
      <td>${r.codigo || '—'}</td>
      <td>${r.producto || '—'}</td>
      <td>${r.perfamilia || '—'}</td>
      <td>${r.patente || '—'}</td>
      <td>${r.area || '—'}</td>
      <td>${fmt(r.unidades_sistema)}</td>
      <td>${fmt(r.unidades_real)}</td>
      <td class="${dCls}">${r.dif_unidades >= 0 ? '+':''}${fmt(r.dif_unidades)}</td>
      <td>${r.costo > 0 ? fmtMoney(r.costo) : '—'}</td>
      <td class="delta-neg"><strong>${fmtMoney(r.riesgo)}</strong></td>
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
    const cols = ['#','Código','Producto','Hiperfamilia','Marca','Patente','Área','Stock Sist.','Conteo','Valor Sistema'];
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
   GESTIÓN DE MODOS (actualizada para 5 modos)
   ═══════════════════════════════════════════════════════════════ */
function switchToMode(mode) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const allViews = ['2025','2026','comparative','checklist','planos','2025v2'];
  allViews.forEach(m => document.getElementById(`view-${m}`)?.classList.add('hidden'));
  document.getElementById(`view-${mode}`)?.classList.remove('hidden');
}

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupDragDrop('drop-2025', 'input-2025', 'btn-load-2025', '2025');
  setupDragDrop('drop-2026', 'input-2026', 'btn-load-2026', '2026');
  setupTabs();
  showWelcome();

  // CheckList drag & drop
  const clInput = document.getElementById('input-checklist');
  document.getElementById('btn-load-checklist').onclick = () => clInput.click();
  clInput.onchange = () => { if (clInput.files[0]) loadChecklist(clInput.files[0]); };
  const clZone = document.getElementById('drop-checklist');
  clZone.ondragover = e => { e.preventDefault(); clZone.classList.add('drag-over'); };
  clZone.ondragleave = () => clZone.classList.remove('drag-over');
  clZone.ondrop = e => {
    e.preventDefault(); clZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) loadChecklist(e.dataTransfer.files[0]);
  };

  // Planos drag & drop
  const plInput = document.getElementById('input-planos');
  document.getElementById('btn-load-planos').onclick = () => plInput.click();
  plInput.onchange = () => { if (plInput.files[0]) loadPlanos(plInput.files[0]); };
  const plZone = document.getElementById('drop-planos');
  plZone.ondragover = e => { e.preventDefault(); plZone.classList.add('drag-over'); };
  plZone.ondragleave = () => plZone.classList.remove('drag-over');
  plZone.ondrop = e => {
    e.preventDefault(); plZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) loadPlanos(e.dataTransfer.files[0]);
  };

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
});
