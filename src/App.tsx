import { Component, Suspense, useEffect, type ReactNode } from "react";
import { Route, Routes, useLocation, useParams } from "react-router";
import {
  StorefrontProvider,
  useStorefrontConfig,
} from "./lib/storefront-config";
import { StoreDataContext, type StoreBootstrap } from "./lib/store-data";
import { PromotionsProvider } from "./lib/promotions";
import { AnalyticsConsent } from "./components/store/AnalyticsConsent";
import { EcommerceHome } from "./components/store/EcommerceHome";
import { ShopPage } from "./components/store/ShopPage";
import { ProductDetailPage } from "./components/store/ProductDetailPage";
import {
  CartPage,
  CheckoutPage,
  LoginPage,
  TrackPage,
} from "./components/store/CommerceFlowPages";
import { InformationPage } from "./components/store/InformationPage";
import { TransactionPage } from "./components/store/TransactionPage";
import { CustomerPortal } from "./components/portal/CustomerPortal";
import { AdminPortal } from "./components/portal/AdminPortal";
import { StorePage } from "./components/store/StoreHeader";
import { Link, Navigate } from "./lib/navigation";
import {
  JournalPage,
  StoryPage,
  WishlistPage,
} from "./components/store/EditorialPages";
import { pageMetadata } from "./lib/page-metadata";

export class StoreErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app-error">
        <h1>This page didn’t load.</h1>
        <p>Please refresh the page and try again.</p>
        <button onClick={() => window.location.reload()}>Refresh page</button>
        <a href="/">Back to home</a>
      </main>
    );
  }
}

export function NotFoundPage() {
  return (
    <StorePage>
      <main id="main" className="reference-not-found wrap">
        <span className="eyebrow">A LITTLE OFF THE PANTRY PATH</span>
        <h1>We couldn’t find this page.</h1>
        <p>
          This link may have changed, or the product may no longer be available.
        </p>
        <Link className="button" to="/shop">
          Explore the shop <span>↗</span>
        </Link>
        <Link className="link-button" to="/">
          Back to home
        </Link>
      </main>
    </StorePage>
  );
}

function Metadata() {
  const location = useLocation();
  const store = useStorefrontConfig();
  useEffect(() => {
    const meta = pageMetadata(location.pathname, store);
    document.title = meta.title;
    for (const [name, content] of [
      ["description", meta.description],
      ["robots", meta.private ? "noindex, nofollow" : "index, follow"],
    ]) {
      let element = document.querySelector<HTMLMetaElement>(
        `meta[name="${name}"]`,
      );
      if (!element) {
        element = document.createElement("meta");
        element.name = name!;
        document.head.append(element);
      }
      element.content = content!;
    }
    let canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = new URL(
      location.pathname,
      import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin,
    ).href;
    if (location.hash)
      document
        .getElementById(decodeURIComponent(location.hash.slice(1)))
        ?.scrollIntoView();
  }, [location.pathname, location.hash, store]);
  return null;
}

function TransactionRoute() {
  const { orderNumber = "" } = useParams();
  return <TransactionPage orderNumber={orderNumber} />;
}

export default function App({
  bootstrap = { products: [] },
}: {
  bootstrap?: StoreBootstrap;
}) {
  return (
    <StoreErrorBoundary>
      <StorefrontProvider initialConfig={bootstrap.storefront}>
        <StoreDataContext.Provider value={bootstrap.products}>
          <PromotionsProvider>
            <Metadata />
            <Suspense
              fallback={
                <div className="app-loading" role="status">
                  Opening Avaruchi…
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<EcommerceHome />} />
                <Route path="/shop" element={<ShopPage />} />
                <Route path="/shop/:slug" element={<ProductDetailPage />} />
                <Route
                  path="/product/:productId"
                  element={<ProductDetailPage />}
                />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/track" element={<TrackPage />} />
                <Route path="/account" element={<CustomerPortal />} />
                <Route path="/admin/*" element={<AdminPortal />} />
                <Route
                  path="/transaction/:orderNumber"
                  element={<TransactionRoute />}
                />
                <Route
                  path="/contact"
                  element={<InformationPage kind="contact" />}
                />
                <Route
                  path="/privacy"
                  element={<InformationPage kind="privacy" />}
                />
                <Route
                  path="/terms"
                  element={<InformationPage kind="terms" />}
                />
                <Route
                  path="/shipping"
                  element={<InformationPage kind="shipping" />}
                />
                <Route
                  path="/returns"
                  element={<InformationPage kind="shipping" />}
                />
                <Route
                  path="/shipping-returns"
                  element={<InformationPage kind="shipping" />}
                />
                <Route path="/journal" element={<JournalPage />} />
                <Route path="/our-story" element={<StoryPage />} />
                <Route path="/wishlist" element={<WishlistPage />} />
                <Route
                  path="/admin/reviews"
                  element={<Navigate to="/admin" replace />}
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
            <AnalyticsConsent />
          </PromotionsProvider>
        </StoreDataContext.Provider>
      </StorefrontProvider>
    </StoreErrorBoundary>
  );
}
