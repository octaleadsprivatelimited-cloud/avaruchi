import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@/lib/navigation";
import { AnimatePresence, MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { useStorefrontConfig } from "@/lib/storefront-config";
import { StoreCommerceProvider, useStoreCommerce } from "@/lib/store-commerce";
import { money } from "@/data/commerce";
import { priceIncludingTax } from "@/lib/catalog-price";
import {
  additionalAnnouncement,
  deliveryAnnouncement,
} from "@/lib/delivery-policy";
import { openAnalyticsPreferences } from "@/lib/analytics";
import { BRAND } from "@/lib/brand";
import {
  BrandMark,
  ProductPhoto,
  ReferenceIcon,
  ReferenceModal,
} from "./ReferencePrimitives";
import { AccountLink } from "./AccountLink";

export function StoreHeader() {
  const store = useStorefrontConfig();
  const { cart } = useStoreCommerce();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [bagOpen, setBagOpen] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    setBagOpen(false);
    setSearchOpen(false);
    menu.current?.removeAttribute("open");
  }, [location.pathname, location.searchStr]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        menu.current?.removeAttribute("open");
      }
    };
    const outside = (event: MouseEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node))
        menu.current.removeAttribute("open");
    };
    document.addEventListener("keydown", close);
    document.addEventListener("click", outside);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("click", outside);
    };
  }, []);
  const announcement =
    additionalAnnouncement(store.announcement) ||
    (store.manualDeliveryEnabled
      ? `Bring home your favourite pickle. ${deliveryAnnouncement(store)}.`
      : "Bring home your favourite pickle. A little taste of home.");
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="header-shell">
        <div className="announcement">
          <span>{announcement}</span>
        </div>
        <header className="site-header wrap">
          <Link
            className="wordmark reference-brand"
            to="/"
            aria-label="Avaruchi home"
          >
            <BrandMark />
          </Link>
          <nav aria-label="Main navigation">
            <Link className={location.pathname === "/" ? "current" : ""} to="/">
              Home
            </Link>
            <details className="products-menu" ref={menu}>
              <summary
                className={
                  location.pathname === "/shop" ||
                  /\/(product|shop)\//.test(location.pathname)
                    ? "current"
                    : ""
                }
              >
                Products <span aria-hidden="true">⌄</span>
              </summary>
              <div className="products-dropdown">
                {[
                  "All pickles",
                  "Classics",
                  "Andhra favourites",
                  "Bold flavours",
                ].map((category) => (
                  <Link
                    key={category}
                    to="/shop"
                    search={{ category }}
                    onClick={() => menu.current?.removeAttribute("open")}
                  >
                    {category}
                  </Link>
                ))}
              </div>
            </details>
            <Link
              className={location.pathname === "/journal" ? "current" : ""}
              to="/journal"
            >
              Stories
            </Link>
          </nav>
          <div className="header-actions">
            <button
              type="button"
              className="icon-button search-toggle"
              aria-label="Search"
              aria-expanded={searchOpen}
              aria-controls="header-search"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <ReferenceIcon name="search" />
            </button>
            <button
              type="button"
              className="bag-button"
              aria-label={`Open bag, ${cart.count} jars`}
              onClick={() => setBagOpen(true)}
            >
              <ReferenceIcon name="bag" />
              <span className="bag-count">{cart.count}</span>
            </button>
            <AccountLink className="icon-button" ariaLabel="Your account">
              <ReferenceIcon name="user" />
            </AccountLink>
          </div>
        </header>
        {searchOpen && (
          <form
            className="header-search wrap"
            id="header-search"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchOpen(false);
              void navigate({ to: "/shop", search: { q: query.trim() } });
            }}
          >
            <label className="sr-only" htmlFor="header-query">
              Search pickles
            </label>
            <input
              id="header-query"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a flavour or ingredient"
            />
            <button type="submit">Search</button>
            <button
              type="button"
              aria-label="Close search"
              onClick={() => setSearchOpen(false)}
            >
              ×
            </button>
          </form>
        )}
      </div>
      <AnimatePresence>
        {bagOpen && (
          <ReferenceModal
            drawer
            title={`Your bag (${cart.count})`}
            onClose={() => setBagOpen(false)}
          >
            {!cart.lines.length ? (
              <div className="empty-state">
                <h3>A jar would look good here.</h3>
                <p>Find a flavour you love and add it to your bag.</p>
                <Link
                  className="button"
                  to="/shop"
                  onClick={() => setBagOpen(false)}
                >
                  Browse pickles
                </Link>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.lines.map((line) => (
                    <div
                      className="cart-item"
                      key={`${line.entry.productId}:${line.entry.variantId || line.index}`}
                    >
                      <ProductPhoto product={line.product} />
                      <div>
                        <h3>{line.product.name}</h3>
                        <p>
                          {line.variant?.title ||
                            Object.values(line.variant?.options || {}).join(
                              " / ",
                            )}
                          {line.unresolved
                            ? " · Unavailable"
                            : ` · ${money(priceIncludingTax(line.unitPrice, line.product.taxRate))}`}
                        </p>
                        <div className="quantity">
                          <button
                            type="button"
                            aria-label={`Decrease ${line.product.name}`}
                            onClick={() =>
                              cart.update(line.index, line.entry.quantity - 1)
                            }
                          >
                            −
                          </button>
                          <span>{line.entry.quantity}</span>
                          <button
                            type="button"
                            aria-label={`Increase ${line.product.name}`}
                            disabled={
                              line.unresolved ||
                              line.entry.quantity >= line.available ||
                              line.entry.quantity >= 20
                            }
                            onClick={() =>
                              cart.update(line.index, line.entry.quantity + 1)
                            }
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="remove-link"
                          onClick={() => cart.update(line.index, 0)}
                        >
                          Remove
                        </button>
                      </div>
                      <strong>
                        {money(
                          priceIncludingTax(
                            line.unitPrice,
                            line.product.taxRate,
                          ) * line.entry.quantity,
                        )}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="reference-bag-summary">
                  <p>Review your bag for taxes, offers and delivery.</p>
                  <Link
                    className="button"
                    to="/cart"
                    onClick={() => setBagOpen(false)}
                  >
                    View bag &amp; checkout <span>↗</span>
                  </Link>
                  <button
                    className="link-button"
                    type="button"
                    onClick={() => setBagOpen(false)}
                  >
                    Continue shopping
                  </button>
                </div>
              </>
            )}
          </ReferenceModal>
        )}
      </AnimatePresence>
    </>
  );
}

export function StoreFooter() {
  const store = useStorefrontConfig();
  const phone = store.supportPhone || BRAND.phone;
  return (
    <footer>
      <div className="footer-main wrap">
        <div className="footer-brand">
          <Link
            className="wordmark reference-brand"
            to="/"
            aria-label="Avaruchi home"
          >
            <BrandMark />
          </Link>
          <p className="business-footer">
            <strong>{store.legalName || BRAND.legalName}</strong>
            <span>{store.businessAddress || BRAND.address}</span>
            <span>Established {BRAND.established}</span>
            <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{phone}</a>
          </p>
        </div>
        <div className="footer-links">
          <h3>At the table</h3>
          <Link to="/our-story">Our story</Link>
          <Link to="/shop">Shop all pickles</Link>
          <Link to="/journal">Pairing notes</Link>
          <Link to="/wishlist">Saved flavours</Link>
        </div>
        <div className="footer-links">
          <h3>Here to help</h3>
          <AccountLink customerTab="My orders">
            Orders &amp; invoices
          </AccountLink>
          <Link to="/shipping">Shipping policy</Link>
          <Link to="/returns">Returns &amp; refunds</Link>
          <Link to="/contact">Contact us</Link>
        </div>
        <div className="footer-links footer-policy-links">
          <h3>The fine print</h3>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy policy</Link>
          <span className="footer-location">
            <a
              href={`https://wa.me/${phone.replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp the store
            </a>
          </span>
          <button
            type="button"
            className="reference-cookie-link"
            onClick={openAnalyticsPreferences}
          >
            Cookie preferences
          </button>
        </div>
      </div>
      <div className="footer-bottom wrap">
        <span>
          © {new Date().getFullYear()} {store.legalName || BRAND.legalName}.
          Avaruchi.
        </span>
        <Link to="/track">Track your order</Link>
      </div>
    </footer>
  );
}

export function StorePage({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <StoreCommerceProvider>
        <div className="reference-store avaruchi-ui">
          <StoreHeader />
          {children}
          <StoreFooter />
          <Toaster position="bottom-center" richColors />
        </div>
      </StoreCommerceProvider>
    </MotionConfig>
  );
}
