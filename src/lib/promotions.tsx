import { productPath } from "./product-url";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "@/lib/navigation";
import { X } from "lucide-react";
import { commerceApi } from "./commerce-api";
import { canShowOfferOnPath, popupFrequencyAllows } from "./promotion-visibility";

export type CampaignBase = { id: string; name: string; enabled: boolean; startsAt: string; endsAt: string; audience: "ALL" | "NEW_VISITORS" | "RETURNING_VISITORS" };
export type Banner = CampaignBase & { eyebrow: string; headline: string; body: string; buttonLabel: string; buttonUrl: string; imageUrl: string; placement: "HOME_HERO" | "HOME_INLINE" | "SHOP_TOP"; backgroundColor: string };
export type Popup = CampaignBase & { headline: string; body: string; couponCode: string; buttonLabel: string; buttonUrl: string; delaySeconds: number; frequency: "ONCE" | "DAILY" | "EVERY_VISIT" };
export type Announcement = CampaignBase & { message: string; buttonLabel: string; buttonUrl: string; backgroundColor: string; textColor: string };
export type PromotionConfig = { welcomePopupEnabled: boolean; announcementBars: Announcement[]; banners: Banner[]; popups: Popup[] };
// No popup is eligible until the site's persisted configuration has loaded.
export const emptyPromotions: PromotionConfig = { welcomePopupEnabled: false, announcementBars: [], banners: [], popups: [] };
const Context = createContext(emptyPromotions);
function readStorage(kind: "localStorage" | "sessionStorage", key: string) {
  try { return window[kind].getItem(key); } catch { return null; }
}
function writeStorage(kind: "localStorage" | "sessionStorage", key: string, value: string) {
  try { window[kind].setItem(key, value); } catch { /* Campaigns remain optional when browser storage is unavailable. */ }
}

export function PromotionsProvider({ children }: { children: ReactNode }) {
  const pathname = useLocation().pathname;
  const [config, setConfig] = useState(emptyPromotions);
  const [popup, setPopup] = useState<Popup | null>(null);
  const returning = useRef<boolean | null>(null);
  const shownThisVisit = useRef(new Set<string>());
  useEffect(() => {
    if (returning.current === null) {
      returning.current = readStorage("localStorage", "avaruchi-commerce-visited") === "1";
      writeStorage("localStorage", "avaruchi-commerce-visited", "1");
    }
    let cancelled = false;
    let requestSequence = 0;
    const load = async () => {
      const sequence = ++requestSequence;
      try {
        const value = await commerceApi<PromotionConfig>(`/api/v1/storefront/promotions?returning=${returning.current}`, { cache: "no-store" });
        if (!cancelled && sequence === requestSequence) {
          // The cloned oil template is not part of the Avaruchi pickle design.
          // Keep all merchant-created or edited campaigns available.
          const banners = value.banners.filter(item => !(item.id === "5d2fb2ae-609d-43d7-b744-b19fd207db56" && item.name === "Oil collection preview" && item.headline === "Your everyday oil collection."));
          setConfig({ ...value, banners });
        }
      } catch { /* Keep the latest known settings if an optional promotion request fails. */ }
    };
    void load();
    window.addEventListener("focus", load);
    window.addEventListener("avaruchi_commerce:promotions-updated", load);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", load);
      window.removeEventListener("avaruchi_commerce:promotions-updated", load);
    };
  }, [pathname]);
  useEffect(() => {
    setPopup(null);
    if (!config.welcomePopupEnabled || !canShowOfferOnPath(pathname)) return;
    // The homepage welcome banner takes priority over a second overlapping dialog.
    if (pathname === "/" && config.banners.some(item => item.placement === "HOME_HERO" && item.enabled)) return;
    const candidate = config.popups.find(item => item.enabled && !shownThisVisit.current.has(item.id) && popupFrequencyAllows(item.frequency, readStorage("localStorage", `avaruchi-campaign:${item.id}`)));
    if (!candidate) return;
    const timer = window.setTimeout(() => {
      shownThisVisit.current.add(candidate.id);
      writeStorage("localStorage", `avaruchi-campaign:${candidate.id}`, String(Date.now()));
      setPopup(candidate);
    }, candidate.delaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [config, pathname]);
  const close = useCallback(() => setPopup(null), []);
  useEffect(() => {
    if (!popup) return;
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [popup, close]);
  const claim = () => {
    if (popup?.couponCode) writeStorage("sessionStorage", "avaruchi_commerce_coupon", popup.couponCode.trim().toUpperCase());
    close();
  };
  const visiblePopup = config.welcomePopupEnabled && canShowOfferOnPath(pathname) ? popup : null;
  return <Context.Provider value={config}>{children}<PersonalizedRecommendations />{visiblePopup && <>
    <button className="promo-backdrop" aria-label="Close offer" onClick={close} />
    <section className="promo-popup" role="dialog" aria-modal="true" aria-label={visiblePopup.headline}>
      <button aria-label="Close offer" onClick={close}><X /></button><small>Special offer</small><h2>{visiblePopup.headline}</h2><p>{visiblePopup.body}</p>{visiblePopup.couponCode && <strong>{visiblePopup.couponCode}</strong>}<a href={visiblePopup.buttonUrl} onClick={claim}>{visiblePopup.buttonLabel}</a>
    </section>
  </>}</Context.Provider>;
}

function CampaignBanner({ item, modal }: { item: Banner; modal: boolean }) {
  const storageKey = `avaruchi-campaign-banner:${item.id}`;
  const [open, setOpen] = useState(!modal);
  useEffect(() => { setOpen(!modal || readStorage("sessionStorage", storageKey) !== "closed"); }, [modal, storageKey]);
  const close = useCallback(() => { writeStorage("sessionStorage", storageKey, "closed"); setOpen(false); }, [storageKey]);
  useEffect(() => {
    if (!modal || !open) return;
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [modal, open, close]);
  if (!open) return null;
  const banner = <section className={`campaign-banner${modal ? " campaign-popup" : ""}`} style={{ backgroundColor: item.backgroundColor, backgroundImage: item.imageUrl ? `linear-gradient(90deg,#0008,#0002),url(${item.imageUrl})` : undefined }} role={modal ? "dialog" : undefined} aria-modal={modal || undefined} aria-label={modal ? item.headline : undefined}>
    {modal && <button className="campaign-popup-close" aria-label="Close offer" onClick={close}><X /></button>}
    <div><small>{item.eyebrow}</small><h2>{item.headline}</h2><p>{item.body}</p><a href={item.buttonUrl} onClick={modal ? close : undefined}>{item.buttonLabel}</a></div>
  </section>;
  return modal ? <><button className="promo-backdrop campaign-popup-backdrop" aria-label="Close offer" onClick={close} />{banner}</> : banner;
}
export function CampaignSlot({ placement }: { placement: Banner["placement"] }) {
  const config = useContext(Context);
  if (placement === "HOME_HERO" && !config.welcomePopupEnabled) return null;
  const banners = config.banners.filter(item => item.enabled && item.placement === placement);
  return <>{(placement === "HOME_HERO" ? banners.slice(0, 1) : banners).map(item => <CampaignBanner item={item} modal={placement === "HOME_HERO"} key={item.id} />)}</>;
}
export function recordProductSignal(productId:string,category:string){try{const ids=JSON.parse(localStorage.getItem("avaruchi-commerce-viewed-products")||"[]") as string[],cats=JSON.parse(localStorage.getItem("avaruchi-commerce-viewed-categories")||"[]") as string[];localStorage.setItem("avaruchi-commerce-viewed-products",JSON.stringify([productId,...ids.filter(x=>x!==productId)].slice(0,30)));localStorage.setItem("avaruchi-commerce-viewed-categories",JSON.stringify([category,...cats].slice(0,30)))}catch{/* Browsing signals are optional when storage is unavailable. */}}
export function useRecommendations(limit=4){const [items,setItems]=useState<Array<{product:{id:string;slug:string;name:string;category:string;variants:Array<{price:number}>};reason:string}>>([]);useEffect(()=>{let viewedProductIds:string[]=[],categories:string[]=[];try{viewedProductIds=JSON.parse(localStorage.getItem("avaruchi-commerce-viewed-products")||"[]");const current=window.location.pathname.match(/^\/product\/(.+)$/)?.[1];if(current&&!viewedProductIds.includes(current)){viewedProductIds=[current,...viewedProductIds];localStorage.setItem("avaruchi-commerce-viewed-products",JSON.stringify(viewedProductIds.slice(0,30)))}categories=JSON.parse(localStorage.getItem("avaruchi-commerce-viewed-categories")||"[]")}catch{/* Recommendations continue without local browsing history. */}commerceApi<typeof items>("/api/v1/storefront/recommendations",{method:"POST",body:JSON.stringify({viewedProductIds,cartProductIds:[],categories,limit})}).then(setItems).catch(()=>undefined)},[limit]);return useMemo(()=>items,[items])}
export function PersonalizedRecommendations(){const items=useRecommendations(4),show=typeof window!=="undefined"&&window.location.pathname.startsWith("/product/");if(!show||!items.length)return null;return <section className="personalized-products"><small>Picked for you</small><h2>Inspired by what you viewed</h2><div>{items.map(item=><a href={productPath(item.product)} key={item.product.id}><span>{item.product.category}</span><strong>{item.product.name}</strong><small>{item.reason}</small><b>{new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(item.product.variants[0]?.price||0)}</b></a>)}</div></section>}
