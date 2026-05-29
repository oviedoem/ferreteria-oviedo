/**
 * generar_planos.js
 * Genera las 4 funciones _planoHtml_X() desde "Planos patentes 2026 EM.xlsx"
 * con merges, colores de fill, bordes por celda y patentes detectadas.
 *
 * Uso:  node generar_planos.js
 * Output: planos_generated.js  (fragmento listo para pegar en app.js)
 */

'use strict';
const XLSX = require('./node_modules/xlsx');
const fs   = require('fs');
const zlib = require('zlib');

// ── 1. Leer el archivo Excel ────────────────────────────────────────────────
const FILE = 'datos SOLO EJEMPLOS/Planos patentes 2026 EM.xlsx';
const rawBuf = fs.readFileSync(FILE);
const wb = XLSX.read(rawBuf, { cellStyles: true, sheetStubs: true, WTF: true });

// ── 2. Parsear borders desde styles.xml (ZIP raw) ───────────────────────────
function readZipEntry(buf, nameSubstr) {
  let offset = 0;
  while (offset < buf.length - 4) {
    if (buf[offset]===0x50 && buf[offset+1]===0x4b &&
        buf[offset+2]===0x03 && buf[offset+3]===0x04) {
      const fnLen    = buf.readUInt16LE(offset + 26);
      const extraLen = buf.readUInt16LE(offset + 28);
      const compSize = buf.readUInt32LE(offset + 18);
      const method   = buf.readUInt16LE(offset + 8);
      const fname    = buf.slice(offset + 30, offset + 30 + fnLen).toString('utf8');
      const dataStart = offset + 30 + fnLen + extraLen;
      if (fname.includes(nameSubstr)) {
        if (method === 0) return buf.slice(dataStart, dataStart + buf.readUInt32LE(offset + 22)).toString('utf8');
        if (method === 8) return zlib.inflateRawSync(buf.slice(dataStart, dataStart + compSize)).toString('utf8');
      }
      offset = dataStart + compSize;
    } else { offset++; }
  }
  return null;
}

function parseBordersFromStylesXml(xml) {
  const borders = [];
  // Extract <borders count="N">...</borders>
  const bMatch = xml.match(/<borders[^>]*>([\s\S]*?)<\/borders>/);
  if (!bMatch) return borders;
  const inner = bMatch[1];
  // Each <border ...>...</border>
  const bRe = /<border[^/]*?>([\s\S]*?)<\/border>/g;
  let m;
  while ((m = bRe.exec(inner)) !== null) {
    const bXml = m[1];
    const def = {};
    ['left','right','top','bottom'].forEach(side => {
      const re = new RegExp(`<${side}(?:\\s+style="([^"]+)")?[^/]*?(?:/>|>.*?<\\/${side}>)`, 's');
      const sm = bXml.match(re);
      if (sm && sm[1]) def[side] = sm[1];  // 'thin' | 'medium' | 'thick' | etc.
    });
    borders.push(def);
  }
  return borders;
}

const stylesXml  = readZipEntry(rawBuf, 'styles.xml');
const borderDefs = parseBordersFromStylesXml(stylesXml || '');
console.log(`Borders parsed: ${borderDefs.length}`);

// ── 3. Parsear xf-index por celda desde sheetN.xml ──────────────────────────
// SheetJS expone cell.s con fill pero no el xf-index crudo.
// Lo extraemos del XML de la hoja directamente.
function parseCellXfIndex(sheetXml) {
  // returns Map<addr, xfIndex>
  const map = new Map();
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(sheetXml)) !== null) {
    const rowContent = rm[1];
    const cellRe = /<c\s+r="([A-Z]+\d+)"[^>]*>/g;
    let cm;
    while ((cm = cellRe.exec(rowContent)) !== null) {
      const addr = cm[0];
      const addrMatch = addr.match(/r="([A-Z]+\d+)"/);
      const sMatch    = addr.match(/\bs="(\d+)"/);
      if (addrMatch && sMatch) {
        map.set(addrMatch[1], parseInt(sMatch[1]));
      }
    }
  }
  return map;
}

const CellXf = wb.Styles.CellXf;  // array of { borderId, ... }

// ── 4. CSS helper ───────────────────────────────────────────────────────────
const BORDER_CSS = { thin: '1px solid #000', medium: '2px solid #000', thick: '3px solid #000',
                     dashed: '1px dashed #000', dotted: '1px dotted #000',
                     double: '3px double #000', hair: '1px solid #ccc',
                     mediumDashed: '2px dashed #000', dashDot: '1px dashed #000',
                     slantDashDot: '1px dashed #000', mediumDashDot: '2px dashed #000',
                     mediumDashDotDot: '2px dashed #000', dashDotDot: '1px dashed #000' };

function borderCss(def) {
  if (!def || Object.keys(def).length === 0) return '';
  const parts = [];
  if (def.top)    parts.push(`border-top:${BORDER_CSS[def.top]||'1px solid #000'}`);
  if (def.bottom) parts.push(`border-bottom:${BORDER_CSS[def.bottom]||'1px solid #000'}`);
  if (def.left)   parts.push(`border-left:${BORDER_CSS[def.left]||'1px solid #000'}`);
  if (def.right)  parts.push(`border-right:${BORDER_CSS[def.right]||'1px solid #000'}`);
  return parts.join(';');
}

function getBorderCssForCell(addr, xfMap) {
  const xfIdx = xfMap.get(addr);
  if (xfIdx === undefined) return '';
  const xf = CellXf[xfIdx];
  if (!xf) return '';
  const bId = parseInt(xf.borderId || xf.borderid || 0);
  if (!bId || !borderDefs[bId]) return '';
  return borderCss(borderDefs[bId]);
}

// ── 5. Colores de fill ──────────────────────────────────────────────────────
function themeColor(theme, tint) {
  // Approximate theme colors for Office 2016 default theme
  const THEME_COLORS = ['FFFFFF','000000','EEECE1','1F497D','4F81BD','C0504D','9BBB59','8064A2','4BACC6','F79646'];
  const base = THEME_COLORS[theme] || 'FFFFFF';
  if (tint === undefined || tint === 0) return '#'+base;
  // Apply tint approximation
  const r = parseInt(base.substr(0,2),16);
  const g = parseInt(base.substr(2,2),16);
  const b = parseInt(base.substr(4,2),16);
  const t = parseFloat(tint);
  const mix = (v) => Math.round(t < 0 ? v*(1+t) : v + (255-v)*t);
  return '#'+[mix(r),mix(g),mix(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
}

function getFillColor(cell) {
  if (!cell || !cell.s) return '';
  const s = cell.s;
  if (s.patternType === 'none' || !s.patternType) return '';
  const fg = s.fgColor;
  if (!fg) return '';
  if (fg.rgb) return '#'+fg.rgb;
  if (fg.theme !== undefined) return themeColor(fg.theme, fg.tint);
  if (fg.indexed !== undefined && fg.indexed !== 64 && fg.indexed !== 65) {
    // Indexed colors (very rare in modern files) - skip
  }
  return '';
}

// ── 6. Detección de patente ─────────────────────────────────────────────────
function extractPatente(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{2,4})(\s|$)/);
  return m ? m[1] : null;
}

// ── 7. Generador de función HTML para una hoja ──────────────────────────────
function generateSheetFunction(sheetName, sheetIdx) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return '';

  // 7a. Parsear xf indices de la hoja
  const sheetXml = readZipEntry(rawBuf, `sheet${sheetIdx+1}.xml`);
  const xfMap = sheetXml ? parseCellXfIndex(sheetXml) : new Map();
  console.log(`  Sheet "${sheetName}": xfMap size=${xfMap.size}`);

  // 7b. Dimensiones
  const ref = ws['!ref'];
  if (!ref) return '';
  const range = XLSX.utils.decode_range(ref);
  const R1 = range.s.r, C1 = range.s.c;
  const R2 = range.e.r, C2 = range.e.c;

  // 7c. Merges → skipSet y spanMap
  const merges = ws['!merges'] || [];
  const skipSet = new Set();
  const spanMap = {};
  merges.forEach(m => {
    const key = `${m.s.r},${m.s.c}`;
    spanMap[key] = { rowspan: m.e.r - m.s.r + 1, colspan: m.e.c - m.s.c + 1 };
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r !== m.s.r || c !== m.s.c) skipSet.add(`${r},${c}`);
      }
    }
  });

  // 7d. Colgroup — anchos de columna
  const cols = ws['!cols'] || [];
  let colgroup = '<colgroup>';
  for (let c = C1; c <= C2; c++) {
    const col = cols[c];
    // Excel col width en "chars" → px approximation (1 char ≈ 7px, default 8 chars)
    const w = col && col.wpx ? col.wpx : (col && col.wch ? Math.round(col.wch * 7) : 26);
    colgroup += `<col style="width:${w}px">`;
  }
  colgroup += '</colgroup>';

  // 7e. Filas
  const rows = ws['!rows'] || [];
  let tbody = '<tbody>';

  // Conteo de patentes para verificación
  let patenteCount = 0;

  for (let r = R1; r <= R2; r++) {
    const rowInfo = rows[r];
    const hStyle = rowInfo && rowInfo.hpx ? ` style="height:${rowInfo.hpx}px"` : (rowInfo && rowInfo.hpt ? ` style="height:${Math.round(rowInfo.hpt/0.75)}px"` : ' style="height:20px"');
    tbody += `<tr${hStyle}>`;

    for (let c = C1; c <= C2; c++) {
      const key = `${r},${c}`;
      if (skipSet.has(key)) continue;

      const addr  = XLSX.utils.encode_cell({ r, c });
      const cell  = ws[addr];
      const span  = spanMap[key] || {};
      const rsAttr = span.rowspan && span.rowspan > 1 ? ` rowspan="${span.rowspan}"` : '';
      const csAttr = span.colspan && span.colspan > 1 ? ` colspan="${span.colspan}"` : '';

      // Valor
      const rawVal = cell ? (cell.v !== undefined ? cell.v : '') : '';
      const text   = rawVal !== '' ? String(rawVal) : '';

      // Patente
      const pat = extractPatente(text);
      const isPat = !!pat;
      if (isPat) patenteCount++;

      // Fill color
      const fillColor = getFillColor(cell);

      // Borders
      const bCss = getBorderCssForCell(addr, xfMap);

      // Estilo inline
      const styleparts = [];
      if (fillColor) styleparts.push(`background:${fillColor}`);
      if (bCss)      styleparts.push(bCss);
      const styleAttr = styleparts.length ? ` style="${styleparts.join(';')}"` : '';

      // Clase y atributo patente
      const classAttr = isPat ? ` class="plano-patente"` : '';
      const patAttr   = isPat ? ` data-patente="${pat}"` : '';

      tbody += `<td${rsAttr}${csAttr}${classAttr}${patAttr}${styleAttr}>${text}</td>`;
    }
    tbody += '</tr>';
  }
  tbody += '</tbody>';

  // Nombre de función seguro
  const fnName = `_planoHtml_${sheetName.replace(/[^a-zA-Z0-9]/g,'_')}`;

  console.log(`  → ${fnName}: ${patenteCount} patentes`);

  return `function ${fnName}() {\n  return \`<table class="plano-table">${colgroup}${tbody}</table>\`;\n}`;
}

// ── 8. Generar todas las hojas ──────────────────────────────────────────────
let output = '// ── PLANOS HARDCODEADOS (generado automáticamente) ──────────────\n\n';

wb.SheetNames.forEach((name, idx) => {
  console.log(`\nGenerando hoja ${idx+1}/${wb.SheetNames.length}: "${name}"...`);
  output += generateSheetFunction(name, idx) + '\n\n';
});

// ── 9. PLANO_SHEETS mapping ─────────────────────────────────────────────────
output += 'const PLANO_SHEETS = {\n';
wb.SheetNames.forEach(name => {
  const fnName = `_planoHtml_${name.replace(/[^a-zA-Z0-9]/g,'_')}`;
  output += `  '${name}': ${fnName},\n`;
});
output += '};\n';

// ── 10. Escribir output ─────────────────────────────────────────────────────
fs.writeFileSync('planos_generated.js', output, 'utf8');
console.log(`\n✅ planos_generated.js escrito (${Math.round(output.length/1024)}KB)`);
