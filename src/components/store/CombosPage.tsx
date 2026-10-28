import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Package, RefreshCw, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { StorePage } from "./StoreHeader";
import { Link, useNavigate } from "@/lib/navigation";
import { commerceApi } from "@/lib/commerce-api";
import { useCommerceCart } from "@/lib/commerce-cart";
import type { ComboPackage } from "@/lib/combo-packages";
import { money } from "@/data/commerce";
import "@/combo-packages.css";

export function CombosPage() {
  const [combos, setCombos] = useState<ComboPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState("");
  const cart = useCommerceCart();
  const navigate = useNavigate();
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setCombos(await commerceApi<ComboPackage[]>("/api/v1/combos")); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Combo packages could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const add = async (combo: ComboPackage) => {
    setAdding(combo.id);
    try {
      await cart.addCombo(combo.id);
      toast.success(`${combo.name} added to your bag`);
      void navigate({ to: "/cart" });
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "This combo could not be added. Your bag has not changed.");
      void load();
    } finally { setAdding(""); }
  };
  return <StorePage><main id="main" className="combo-store wrap">
    <header className="combo-page-intro"><span className="eyebrow">A LITTLE OF YOUR FAVOURITES</span><h1>Combo packages</h1><p>Shop selected flavours together. Each package lists the exact products and pack sizes included.</p><p className="combo-pricing-note">Package totals use the current product prices, including applicable tax. Any offer code is checked again at checkout.</p></header>
    {!loading && combos.length > 0 && !cart.hydrated && <div className="combo-bag-status" role={cart.syncError ? "alert" : "status"}><p>{cart.syncError ? `Your saved bag could not be connected: ${cart.syncError}` : "Connecting your saved bag before adding packages…"}</p>{cart.syncError && <button type="button" className="button" disabled={cart.busy} onClick={() => void cart.retryHydration().catch(() => undefined)}>Retry bag connection</button>}<Link to="/cart">Review your bag</Link></div>}
    {loading ? <p role="status" className="combo-empty">Loading combo packages…</p> : error ? <div className="combo-empty" role="alert"><p>{error}</p><button type="button" className="button" onClick={() => void load()}><RefreshCw size={18} /> Try again</button></div> : !combos.length ? <div className="combo-empty"><Package size={38} /><h2>More flavours to choose from</h2><p>There are no published combo packages at the moment. You can choose individual products from the shop.</p><Link className="button" to="/shop">Shop products <ArrowRight size={18} /></Link></div> : <div className="combo-store-grid">{combos.map(combo => <article className="combo-store-card" key={combo.id}>
      <header><h2>{combo.name}</h2>{combo.description && <p>{combo.description}</p>}</header>
      <ul className="combo-components">{combo.components.map(item => <li key={item.variantId}>
        {item.image && <Link to="/product/$id" params={{ id: item.slug }} aria-label={`View ${item.name}`}><img src={item.image} alt={item.imageAlt} loading="lazy" width={96} height={96} /></Link>}
        <span><Link to="/product/$id" params={{ id: item.slug }}>{item.name}</Link><small>{item.pack} × {item.quantity}</small><small>{money(item.unitPrice)} each</small></span>
      </li>)}</ul>
      {combo.couponOffer && <p className="combo-offer-code">Offer code <strong>{combo.couponOffer.code}</strong><small>Added for validation in your bag. Minimum spend, product eligibility and customer usage limits apply.</small></p>}
      <div className="combo-card-bottom"><div><small>Product total</small><strong>{money(combo.total)}</strong><span>{combo.available > 0 ? "Available" : "Currently sold out"}</span></div><button type="button" className="button" disabled={!!adding || !cart.hydrated || cart.busy || combo.available < 1} onClick={() => void add(combo)}><ShoppingBag size={18} />{adding === combo.id ? "Adding…" : combo.available < 1 ? "Sold out" : !cart.hydrated ? "Connect bag to add" : cart.busy ? "Updating bag…" : "Add combo to bag"}</button></div>
    </article>)}</div>}
  </main></StorePage>;
}
