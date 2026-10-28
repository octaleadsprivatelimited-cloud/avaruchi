import { useRef, useState } from "react";
import { Upload, Download, X } from "lucide-react";
import { commerceApi } from "@/lib/commerce-api";
import { catalogCsvHeaders, parseCatalogCsv, type CatalogImportProduct } from "@/lib/catalog-csv";
import { money } from "@/data/commerce";
import { catalogImportUpdate, type ExistingImportProduct } from "@/lib/catalog-import-update";

export function CatalogCsvImport({ onComplete }: { onComplete: () => void }) {
  const [open, setOpen] = useState(false), [products, setProducts] = useState<CatalogImportProduct[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false), [progress, setProgress] = useState("");
  const importing = useRef(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const template = () => {
    const row = ["Mango Pickle", "mango-pickle", "A tangy mango pickle for the everyday table.", "Pickles", "Aavaruchi", "DRAFT", "0", "250 g", "AVA-MANGO-250", "199", "199", "0", "250", "", ""];
    const url = URL.createObjectURL(new Blob([catalogCsvHeaders.join(",") + "\n" + row.join(",") + "\n"], { type: "text/csv" }));
    const link = document.createElement("a"); link.href = url; link.download = "avaruchi-product-template.csv"; link.click(); URL.revokeObjectURL(url);
  };
  const read = async (file?: File) => {
    setProducts([]); setError(""); setProgress(""); if (!file) return;
    try { if (file.size > 1000000) throw new Error("Use a CSV file smaller than 1 MB."); setProducts(parseCatalogCsv(await file.text())); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The CSV could not be read."); }
  };
  const create = async () => {
    if (importing.current || !products.length) return;
    importing.current = true; setBusy(true); setError(""); let created = 0, updated = 0, skipped = 0;
    try {
      for (const [index, product] of products.entries()) {
        setProgress(`Importing ${index + 1} of ${products.length}: ${product.name}`);
        const existing = await commerceApi<{ items: Array<{ id: string; slug: string }> }>(`/api/v1/admin/products?search=${encodeURIComponent(product.slug)}&limit=100`);
        const match = existing.items.find(item => item.slug === product.slug);
        if (match) {
          if (!updateExisting) { skipped++; continue; }
          const detail = await commerceApi<ExistingImportProduct>(`/api/v1/admin/products/${match.id}`);
          await commerceApi(`/api/v1/admin/products/${match.id}`, { method: "PUT", body: JSON.stringify(catalogImportUpdate(product, detail)) });
          updated++; continue;
        }
        await commerceApi("/api/v1/admin/products", { method: "POST", body: JSON.stringify(product) }); created++;
      }
      setProgress(`Import complete: ${created} products created; ${updated} products updated; ${skipped} existing URL handles skipped.`); onComplete();
    } catch (reason) { setError(`${reason instanceof Error ? reason.message : "Import stopped"}. ${created} products created and ${updated} updated so far. Retry to continue.`); onComplete(); }
    finally { importing.current = false; setBusy(false); }
  };
  return <section className="catalog-csv-import">
    <button type="button" className="secondary" onClick={() => setOpen(current => !current)} disabled={busy}><Upload /> Import CSV</button>
    {open && <div className="panel catalog-import-panel">
      <header><div><h3>Import products</h3><p>One CSV row per jar size. Review the products before importing. Existing URL handles are skipped.</p></div><button type="button" aria-label="Close product import" onClick={() => setOpen(false)} disabled={busy}><X /></button></header>
      <div className="catalog-import-controls"><label>Choose product CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={event => void read(event.target.files?.[0])} /></label><button type="button" className="secondary" onClick={template}><Download /> Download template</button></div>
      <label className="catalog-import-update"><input type="checkbox" checked={updateExisting} disabled={busy} onChange={event => setUpdateExisting(event.target.checked)} /> Update matching URL handles with these prices, sizes, categories and images</label>
      {updateExisting && <p>Existing inventory and variant IDs are retained. Sizes missing from the file become inactive and remain in order history. Product images are replaced by the imported image.</p>}
      {error && <p className="catalog-alert" role="alert">{error}</p>}
      {products.length > 0 && <><p>{products.length} products · {products.reduce((sum, product) => sum + product.variants.length, 0)} jar variants. Prices below exclude GST. Zero-stock jars display as sold out.</p><div className="catalog-table-wrap"><table className="catalog-table"><thead><tr><th>Product</th><th>Status</th><th>Jar sizes</th><th>Prices</th><th>Stock</th></tr></thead><tbody>{products.map(product => <tr key={product.slug}><td>{product.name}</td><td>{product.status}</td><td>{product.variants.map(variant => variant.title).join(", ")}</td><td>{product.variants.map(variant => money(variant.price)).join(" / ")}</td><td>{product.variants.reduce((sum, variant) => sum + variant.stock, 0)}</td></tr>)}</tbody></table></div><button type="button" className="primary" disabled={busy} onClick={() => void create()}>{busy ? "Importing…" : `Import ${products.length} products`}</button></>}
      {progress && <p role="status">{progress}</p>}
    </div>}
  </section>;
}
