import assert from 'node:assert/strict';
import { catalogCsvHeaders, parseCatalogCsv } from '../src/lib/catalog-csv.ts';

const row = { name: 'Mango Pickle', slug: 'mango-pickle', description: 'Tangy mango, with a bold finish.', category: 'All pickles', brand: 'Avaruchi', status: 'ACTIVE', taxRate: '18', jarSize: '250 g', sku: 'AVA-MANGO-250', price: '199', mrp: '199', stock: '0', weightGrams: '250', imageUrl: 'https://aavaruchi.in/images/pickles/mango.svg', imageAlt: 'Jar illustration' };
const csv = rows => '\uFEFF' + catalogCsvHeaders.join(',') + '\r\n' + rows.map(item => catalogCsvHeaders.map(key => '"' + String(item[key]).replaceAll('"', '""') + '"').join(',')).join('\r\n');
const grouped = parseCatalogCsv(csv([row, { ...row, jarSize: '500 g', sku: 'AVA-MANGO-500', price: '349', mrp: '349', weightGrams: '500' }]));
assert.equal(grouped.length, 1);
assert.equal(grouped[0].description, row.description);
assert.deepEqual(grouped[0].variants.map(variant => [variant.title, variant.stock, variant.weightGrams]), [['250 g', 0, 250], ['500 g', 0, 500]]);
assert.equal(grouped[0].status, 'ACTIVE');
assert.equal(parseCatalogCsv(csv([{ ...row, description: 'Tangy "mango"\nwith a bold finish.' }]))[0].description, 'Tangy "mango"\nwith a bold finish.');
for (const patch of [{ stock: '-1' }, { stock: '1.5' }, { price: '' }, { price: '0xFF' }, { price: 'Infinity' }, { mrp: '198' }, { weightGrams: '0' }, { imageUrl: 'javascript:alert(1)' }, { imageUrl: 'https://secret@example.com/x' }, { status: 'PUBLISHED' }])
  assert.throws(() => parseCatalogCsv(csv([{ ...row, ...patch }])));
assert.throws(() => parseCatalogCsv(csv([row, { ...row, jarSize: '500 g' }])), /SKU .*repeated/);
assert.throws(() => parseCatalogCsv(csv([row, { ...row, sku: 'AVA-MANGO-OTHER' }])), /jar size .*repeated/);
assert.throws(() => parseCatalogCsv(csv([row, { ...row, sku: 'AVA-MANGO-500', name: 'Different product', jarSize: '500 g' }])), /product details must agree/);
assert.throws(() => parseCatalogCsv('name,name\nMango,Mango'), /template columns/);
assert.throws(() => parseCatalogCsv(catalogCsvHeaders.join(',') + '\n"unfinished'), /unfinished/);
assert.throws(() => parseCatalogCsv('x'.repeat(1000001)), /smaller than/);
console.log('Catalog CSV checks passed: quoted/multiline fields, grouped jar variants, zero stock, numeric validation, duplicate protection and unsafe image URLs.');
