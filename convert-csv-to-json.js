const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'CATALOGO PRODUCTOS', 'Datos.csv');
const jsonPath = path.join(__dirname, 'CATALOGO PRODUCTOS', 'Datos.json');

const csvContent = fs.readFileSync(csvPath, 'utf8');
const lines = csvContent.split('\n').filter(line => line.trim());

if (lines.length < 2) {
  console.error('CSV no válido');
  process.exit(1);
}

const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase().replace(/[^a-z]/g, ''));

const products = [];
for (let i = 1; i < lines.length; i++) {
  const values = parseCSVLine(lines[i]);
  if (values.length >= headers.length) {
    const product = {};
    headers.forEach((header, index) => {
      let value = values[index] || '';
      if (header.includes('costo') || header.includes('precio') || header.includes('socio')) {
        value = parseFloat(value.replace(/,/g, '')) || 0;
      }
      product[header] = value;
    });
    if (product.codigo && (product.precioiva || product.socioiva)) {
      products.push(product);
    }
  }
}

fs.writeFileSync(jsonPath, JSON.stringify(products, null, 2));
console.log(`Convertido ${products.length} productos a JSON`);

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}