import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Package, Plus, RefreshCw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/data/commerce";
import { commerceApi } from "@/lib/commerce-api";
import type { ComboPackage } from "@/lib/combo-packages";
import "@/combo-packages.css";

type Component = { variantId: string; quantity: number };
type Draft = { name: string; description: string; status: "DRAFT" | "ACTIVE" | "ARCHIVED"; couponCode: string; components: Component[] };
type SavedCombo = Draft & { id: string; updatedAt: string; preview: ComboPackage };
type CatalogProduct = { id: string; name: string; status: string; taxRate: number; variants: Array<{ id: string; title: string; price: number; available: number }> };
type Coupon = { code: string; enabled: boolean; startsAt: number; endsAt: number };
const emptyDraft = (): Draft => ({ name: "", description: "", status: "DRAFT", couponCode: "", components: [{ variantId: "", quantity: 1 }, { variantId: "", quantity: 1 }] });

export function AdminCombosWorkspace({ canCreate = false, canUpdate = false }: { canCreate?: boolean; canUpdate?: boolean }) {
  const [combos, setCombos] = useState<SavedCombo[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [items, products, offers] = await Promise.all([
        commerceApi<SavedCombo[]>("/api/v1/admin/combos"),
        commerceApi<CatalogProduct[]>("/api/v1/admin/combos/catalog"),
        commerceApi<Coupon[]>("/api/v1/admin/combos/coupons"),
      ]);
      setCombos(items); setCatalog(products); setCoupons(offers);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Combo packages could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const options = useMemo(() => catalog.flatMap(product => product.variants.map(variant => ({ ...variant, productId: product.id, product: product.name, productStatus: product.status, taxRate: product.taxRate, unitPrice: Math.round(variant.price * (1 + product.taxRate / 100) * 100) / 100 }))), [catalog]);
  const included = draft.components.map(component => ({ ...component, option: options.find(item => item.id === component.variantId) }));
  const distinctProducts = new Set(included.map(item => item.option?.productId).filter(Boolean));
  const duplicatePack = new Set(draft.components.map(item => item.variantId).filter(Boolean)).size !== draft.components.filter(item => item.variantId).length;
  const invalid = draft.name.trim().length < 2 || (draft.status !== "ARCHIVED" && (included.some(item => !item.option || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) || distinctProducts.size < 2 || duplicatePack || (draft.status === "ACTIVE" && included.some(item => item.option?.productStatus !== "ACTIVE"))));
  const subtotal = included.reduce((sum, item) => sum + (item.option?.price || 0) * (item.quantity || 0), 0);
  const tax = included.reduce((sum, item) => sum + (item.option?.price || 0) * (item.quantity || 0) * (item.option?.taxRate || 0) / 100, 0);
  const total = Math.round((subtotal + Math.round(tax * 100) / 100) * 100) / 100;
  const available = included.some(item => !item.option) ? 0 : Math.min(...included.map(item => Math.floor(item.option!.available / (item.quantity || 1))));
  const select = (combo?: SavedCombo) => {
    setError(""); setSelected(combo?.id || "");
    setDraft(combo ? { name: combo.name, description: combo.description, status: combo.status, couponCode: combo.couponCode, components: combo.components.map(item => ({ ...item })) } : emptyDraft());
  };
  const component = (index: number, patch: Partial<Component>) => setDraft(current => ({ ...current, components: current.components.map((item, position) => position === index ? { ...item, ...patch } : item) }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (invalid) return;
    setBusy(true); setError("");
    try {
      const saved = await commerceApi<SavedCombo>(selected ? `/api/v1/admin/combos/${selected}` : "/api/v1/admin/combos", { method: selected ? "PUT" : "POST", body: JSON.stringify(draft) });
      setCombos(current => [saved, ...current.filter(item => item.id !== saved.id)]); select(saved);
      toast.success(draft.status === "ACTIVE" ? "Combo package published" : "Combo package saved");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The package could not be saved."); }
    finally { setBusy(false); }
  };
  return <div className="combo-admin"><div className="combo-admin-heading"><div><h2>Combo packages</h2><p>Group existing product packs. Prices and stock stay connected to the original products.</p></div><button type="button" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={17} /> Refresh</button></div>
    {error && <p className="settings-error" role="alert"><AlertTriangle size={18} />{error}</p>}
    <div className="combo-admin-layout"><section className="panel combo-admin-list" aria-label="Saved combo packages"><button type="button" className="combo-new" onClick={() => select()} disabled={!canCreate || busy}><Plus size={18} /> New package</button>{loading ? <p role="status">Loading packages…</p> : !combos.length ? <div className="combo-admin-empty"><Package size={28} /><p>No packages yet. Create one with products from your catalogue.</p></div> : combos.map(combo => <button type="button" className={selected === combo.id ? "combo-selected" : ""} key={combo.id} onClick={() => select(combo)} disabled={busy}><strong>{combo.name}</strong><span>{combo.status.toLowerCase()} · {combo.components.length} packs</span><small>{money(combo.preview.total)} · {combo.preview.available > 0 ? "Available" : "Sold out or unpublished items"}</small></button>)}</section>
    <form className="panel combo-editor" onSubmit={event => void save(event)}><header><h3>{selected ? "Edit package" : "Create a package"}</h3><p>Add at least two different products. Publishing never changes their prices or inventory.</p></header><fieldset disabled={busy || loading || (selected ? !canUpdate : !canCreate)}><div className="combo-editor-fields"><label>Package name<input value={draft.name} maxLength={120} required minLength={2} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="Name your product selection" /></label><label>Status<select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as Draft["status"] }))}><option value="DRAFT">Draft</option><option value="ACTIVE">Published</option><option value="ARCHIVED">Archived</option></select></label></div><label>Description<textarea value={draft.description} maxLength={1000} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} placeholder="Describe the included flavours or occasion" /></label><h4>Included product packs</h4>
      {draft.components.map((item, index) => <div className="combo-component-editor" key={index}><label>Product and pack<select aria-label={`Product pack ${index + 1}`} value={item.variantId} onChange={event => component(index, { variantId: event.target.value })} required><option value="">Choose a product pack</option>{item.variantId && !options.some(option => option.id === item.variantId) && <option value={item.variantId}>Unavailable pack — choose a replacement</option>}{options.map(option => <option key={option.id} value={option.id} disabled={draft.components.some((entry, other) => other !== index && entry.variantId === option.id)}>{option.product} · {option.title} · {money(option.unitPrice)} · {option.available} available{option.productStatus !== "ACTIVE" ? " · Draft product" : ""}</option>)}</select></label><label>Quantity<input type="number" min={1} max={20} step={1} required aria-label={`Pack quantity ${index + 1}`} value={item.quantity} onChange={event => component(index, { quantity: Number(event.target.value) })} /></label><button type="button" aria-label={`Remove pack ${index + 1}`} disabled={draft.components.length <= 2} onClick={() => setDraft(current => ({ ...current, components: current.components.filter((_, position) => position !== index) }))}><X size={17} /></button></div>)}
      <button type="button" className="combo-add-component" disabled={draft.components.length >= 10} onClick={() => setDraft(current => ({ ...current, components: [...current.components, { variantId: "", quantity: 1 }] }))}><Plus size={17} /> Add another product pack</button>
      <label>Optional existing offer code<select value={draft.couponCode} onChange={event => setDraft(current => ({ ...current, couponCode: event.target.value }))}><option value="">No offer code</option>{draft.couponCode && !coupons.some(coupon => coupon.code === draft.couponCode) && <option value={draft.couponCode}>{draft.couponCode} — unavailable, remove or replace</option>}{coupons.map(coupon => <option value={coupon.code} key={coupon.code}>{coupon.code}{!coupon.enabled || coupon.endsAt < Date.now() ? " · Inactive" : coupon.startsAt > Date.now() ? " · Scheduled" : ""}</option>)}</select><small>Create or edit discounts under Marketing → Coupons. Only currently valid offers for the included products are shown to customers. Checkout applies all eligibility and usage rules.</small></label>
      <div className="combo-editor-preview"><strong>Current product total: {money(total)}</strong><span>{available > 0 ? `${available} complete packages available` : "Currently sold out"}</span><small>Calculated from the selected pack prices, including applicable tax. It updates when you change the underlying products. Individual packs remain separate items in orders and inventory.</small></div>
      {invalid && <p className="combo-editor-help">Enter a name and select packs from at least two different products. Each quantity must be 1–20. Published packages require published products.</p>}<button className="primary" type="submit" disabled={invalid}><Save size={17} />{busy ? "Saving…" : draft.status === "ACTIVE" ? "Save and publish" : "Save package"}</button></fieldset></form></div>
  </div>;
}
