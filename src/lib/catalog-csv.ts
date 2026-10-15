import { z } from "zod";

export const catalogCsvHeaders = ["name", "slug", "description", "category", "brand", "status", "taxRate", "jarSize", "sku", "price", "mrp", "stock", "weightGrams", "imageUrl", "imageAlt"] as const;
const decimal = z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/).transform(Number).pipe(z.number().finite().positive().max(100000000).multipleOf(0.01));
const integer = (min: number, max: number) => z.string().trim().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(min).max(max));
const csvRow = z.object({
  name: z.string().trim().min(2).max(200), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(20000), category: z.string().trim().min(2).max(100),
  brand: z.string().trim().max(100), status: z.enum(["DRAFT", "ACTIVE"]),
  taxRate: z.string().trim().min(1).transform(Number).pipe(z.number().finite().min(0).max(100)),
  jarSize: z.string().trim().min(1).max(100), sku: z.string().trim().min(3).max(80),
  price: decimal, mrp: decimal, stock: integer(0, 1000000), weightGrams: integer(1, 100000),
  imageUrl: z.union([z.literal(""), z.string().url().max(2000).refine(value => { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }, "Use a public HTTPS image URL")]),
  imageAlt: z.string().trim().max(200),
}).refine(row => row.mrp >= row.price, { path: ["mrp"], message: "MRP cannot be below price" });

export type CatalogImportProduct = {
  name: string; slug: string; description: string; category: string; brand: string; status: "DRAFT" | "ACTIVE"; taxRate: number;
  specifications: Record<string, string>;
  media: Array<{ url: string; alt: string; type: "IMAGE"; position: number }>;
  variants: Array<{ sku: string; title: string; price: number; mrp: number; stock: number; reserved: number; active: boolean; weightGrams: number; attributes: Record<string, string> }>;
};

function csvCells(source: string) {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false, closed = false;
  for (let i = 0; i < source.length; i++) {
    const character = source[i];
    if (quoted) {
      if (character === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (character === '"') { quoted = false; closed = true; }
      else cell += character;
    } else if (character === ',' || character === '\n' || character === '\r') {
      row.push(cell); cell = ""; closed = false;
      if (character !== ',') { if (row.some(value => value.trim())) rows.push(row); row = []; if (character === '\r' && source[i + 1] === '\n') i++; }
    } else if (character === '"' && !cell && !closed) quoted = true;
    else { if (closed || character === '"') throw new Error("Malformed CSV quotation. Export the file as CSV again."); cell += character; }
  }
  if (quoted) throw new Error("The CSV contains an unfinished quoted field.");
  row.push(cell); if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

export function parseCatalogCsv(source: string): CatalogImportProduct[] {
  if (source.length > 1000000) throw new Error("Use a CSV file smaller than 1 MB.");
  const rows = csvCells(source.replace(/^\uFEFF/, ""));
  const headers = rows.shift()?.map(value => value.trim());
  if (!headers || catalogCsvHeaders.some(header => !headers.includes(header)) || new Set(headers).size !== headers.length)
    throw new Error(`Use the template columns: ${catalogCsvHeaders.join(", ")}.`);
  if (!rows.length || rows.length > 1000) throw new Error("Import between 1 and 1,000 jar rows at a time.");
  const products = new Map<string, CatalogImportProduct>(), metadata = new Map<string, string>(), skus = new Set<string>();
  rows.forEach((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`Row ${index + 2}: the number of columns does not match the header.`);
    const parsed = csvRow.safeParse(Object.fromEntries(headers.map((header, column) => [header, cells[column]])));
    if (!parsed.success) { const issue = parsed.error.issues[0]; throw new Error(`Row ${index + 2}, ${issue.path.join(".")}: ${issue.message}`); }
    const { jarSize, sku, price, mrp, stock, weightGrams, imageUrl, imageAlt, ...details } = parsed.data;
    const fingerprint = JSON.stringify({ ...details, imageUrl, imageAlt });
    if (metadata.has(details.slug) && metadata.get(details.slug) !== fingerprint) throw new Error(`Row ${index + 2}: product details must agree for URL handle ${details.slug}.`);
    if (skus.has(sku.toLowerCase())) throw new Error(`Row ${index + 2}: SKU ${sku} is repeated.`);
    skus.add(sku.toLowerCase()); metadata.set(details.slug, fingerprint);
    const product = products.get(details.slug) || { ...details, specifications: {}, media: imageUrl ? [{ url: imageUrl, alt: imageAlt || details.name, type: "IMAGE" as const, position: 0 }] : [], variants: [] };
    if (product.variants.some(variant => variant.title.toLowerCase() === jarSize.toLowerCase())) throw new Error(`Row ${index + 2}: jar size ${jarSize} is repeated for ${details.name}.`);
    product.variants.push({ sku, title: jarSize, price, mrp, stock, reserved: 0, active: true, weightGrams, attributes: { "Jar size": jarSize } });
    if (product.variants.length > 200) throw new Error("A product can have up to 200 jar variants.");
    products.set(details.slug, product);
  });
  if (products.size > 100) throw new Error("Import up to 100 products at a time.");
  return [...products.values()];
}
