import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@/lib/navigation";
import { AnimatePresence, MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { useStorefrontConfig } from "@/lib/storefront-config";
import { StoreCommerceProvider, useStoreCommerce } from "@/lib/store-commerce";
import { money } from "@/data/commerce";
import { priceIncludingTax } from "@/lib/catalog-price";
import { openAnalyticsPreferences } from "@/lib/analytics";
import { BRAND } from "@/lib/brand";
import {
  BrandMark,
  ProductPhoto,
  ReferenceIcon,
  ReferenceModal,
} from "./ReferencePrimitives";
import { AccountLink } from "./AccountLink";
import { useInitialCatalog } from "@/lib/store-data";
import { useStoreProducts } from "@/lib/store-products";
import { catalogCategoryTree } from "@/lib/catalog-categories";
import { matchesProductSearch } from "@/lib/product-search";
import { productPath } from "@/lib/product-url";

export function StoreHeader() {
  const products = useStoreProducts(useInitialCatalog());
  const categories = catalogCategoryTree(products);
  const [expandedCategory, setExpandedCategory] = useState("");
  const { cart } = useStoreCommerce();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matchingProducts = products.filter(product => matchesProductSearch(product, query));
  const inStock = (product: (typeof products)[number]) => product.variants?.some(variant => variant.stock > 0) || false;
  const searchResults = (query.trim() ? matchingProducts : products.filter(inStock))
    .sort((a, b) => Number(inStock(b)) - Number(inStock(a))).slice(0, 6);
  const [bagOpen, setBagOpen] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const menuPointer = useRef("");
  useEffect(() => {
    setBagOpen(false);
    setSearchOpen(false);
    setExpandedCategory("");
    menu.current?.removeAttribute("open");
  }, [location.pathname, location.searchStr]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        if (menu.current?.open && menu.current.contains(document.activeElement))
          menu.current.querySelector("summary")?.focus();
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
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="header-shell">
        <header className="site-header wrap">
          <Link
            className="wordmark reference-brand"
            to="/"
            aria-label="Aavaruchi home"
          >
            <BrandMark />
          </Link>
          <nav aria-label="Main navigation">
            <Link className={location.pathname === "/" ? "current" : ""} to="/">
              Home
            </Link>
            <details
              className="products-menu"
              ref={menu}
              onPointerEnter={event => {
                menuPointer.current = event.pointerType;
                if (event.pointerType === "mouse") event.currentTarget.open = true;
              }}
              onPointerLeave={event => {
                if (event.pointerType === "mouse" && (!event.currentTarget.contains(document.activeElement) || document.activeElement === event.currentTarget.querySelector("summary")))
                  event.currentTarget.open = false;
              }}
              onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                  event.currentTarget.open = false;
              }}
            >
              <summary
                onPointerDown={event => { menuPointer.current = event.pointerType; }}
                onClick={event => {
                  // Hover already opened it; a following mouse click must not close it again.
                  if (event.detail > 0 && menuPointer.current === "mouse") {
                    event.preventDefault();
                    if (menu.current) menu.current.open = true;
                  }
                }}
                className={
                  location.pathname === "/shop" ||
                  /\/(product|shop)\//.test(location.pathname)
                    ? "current"
                    : ""
                }
              >
                Products <span aria-hidden="true">⌄</span>
              </summary>
              <div className="products-dropdown category-mega-menu">
                <div className="category-menu-intro"><span>THE AAVARUCHI PANTRY</span><Link to="/shop" onClick={() => menu.current?.removeAttribute("open")}>Shop all products <span aria-hidden="true">↗</span></Link></div>
                <div className="category-menu-columns">
                  {categories.map((category, index) => (
                    <section className="category-menu-group" key={category.path}>
                      <div className="category-menu-heading">
                        <Link to="/shop" search={{ category: category.path }} onClick={() => menu.current?.removeAttribute("open")}><span>{category.name}</span><small>{category.count}</small></Link>
                        {category.children.length > 0 && <button type="button" aria-label={`${expandedCategory === category.path ? "Collapse" : "Expand"} ${category.name} categories`} aria-expanded={expandedCategory === category.path} aria-controls={`category-submenu-${index}`} onClick={() => setExpandedCategory(current => current === category.path ? "" : category.path)}><span aria-hidden="true">{expandedCategory === category.path ? "−" : "+"}</span></button>}
                      </div>
                      {category.children.length > 0 && <ul id={`category-submenu-${index}`} className={`category-submenu ${expandedCategory === category.path ? "expanded" : ""}`}>
                        {category.children.map(child => <li key={child.path}><Link to="/shop" search={{ category: child.path }} onClick={() => menu.current?.removeAttribute("open")}>{child.name}<span>{child.count}</span></Link></li>)}
                      </ul>}
                      <Link className="category-browse" to="/shop" search={{ category: category.path }} onClick={() => menu.current?.removeAttribute("open")}>Explore {category.name.toLowerCase()} <span aria-hidden="true">→</span></Link>
                    </section>
                  ))}
                </div>
              </div>
            </details>
            <Link className={location.pathname === "/combos" ? "current" : ""} to="/combos">
              Combos
            </Link>
            <Link
              className={location.pathname === "/our-story" ? "current" : ""}
              to="/our-story"
            >
              About us
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
              aria-label={`Open bag, ${cart.count} ${cart.count === 1 ? "item" : "items"}`}
              onClick={() => setBagOpen(true)}
            >
              <ReferenceIcon name="bag" />
              <span className="bag-count">{cart.count}</span>
            </button>
            <AccountLink className="account-access" ariaLabel="Your account or sign in">
              <ReferenceIcon name="user" />
              <span>Account</span>
            </AccountLink>
          </div>
        </header>
        {searchOpen && (
          <section className="header-search-panel" id="header-search" aria-label="Product search">
          <form
            className="header-search wrap"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchOpen(false);
              void navigate({ to: "/shop", search: { q: query.trim() } });
            }}
          >
            <label className="sr-only" htmlFor="header-query">
              Search products
            </label>
            <input
              id="header-query"
              type="search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a flavour or ingredient"
              aria-controls="header-search-results"
              onKeyDown={event => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  document.querySelector<HTMLAnchorElement>("#header-search-results a")?.focus();
                }
              }}
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
          <div className="header-search-results wrap" id="header-search-results">
            <p className="header-search-caption" role="status">{query.trim() ? `${matchingProducts.length} ${matchingProducts.length === 1 ? "product matches" : "products match"} your search` : "Available now"}</p>
            {searchResults.length ? <ul aria-label="Matching products">{searchResults.map(product => <li key={product.id}>
              <Link className="header-search-product" to={productPath(product)} onClick={() => setSearchOpen(false)}>
                <ProductPhoto product={product} />
                <span><strong>{product.name}</strong><small>{product.category.split(">").at(-1)?.trim()}</small><span className={inStock(product) ? "search-stock available" : "search-stock"}>{inStock(product) ? "In stock" : "Sold out"} · {money(priceIncludingTax(product.price, product.taxRate))}</span></span>
                <span className="search-product-arrow" aria-hidden="true">↗</span>
              </Link>
            </li>)}</ul> : <p className="header-search-empty">{query.trim() ? "No matching products. Try another name, flavour or category." : "Explore the collection to find your favourites and check stock."}</p>}
            <Link className="header-search-all" to="/shop" search={query.trim() ? { q: query.trim() } : undefined} onClick={() => setSearchOpen(false)}>{query.trim() ? "View all search results" : "Browse the collection"} <span aria-hidden="true">→</span></Link>
          </div>
          </section>
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
                <h3>Your next favourite belongs here.</h3>
                <p>Find a flavour you love and add it to your bag.</p>
                <Link
                  className="button"
                  to="/shop"
                  onClick={() => setBagOpen(false)}
                >
                  Browse products
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
  return (
    <footer>
      <div className="footer-main wrap">
        <div className="footer-brand">
          <Link
            className="wordmark reference-brand"
            to="/"
            aria-label="Aavaruchi home"
          >
            <BrandMark />
          </Link>
          <p className="business-footer">
            <Link className="merchant-brand-button" to="/our-story">{store.legalName || BRAND.legalName}</Link>
            <span>{store.businessAddress || BRAND.address}</span>
            <span>Established {BRAND.established}</span>
            {store.fssaiLicense && <span>FSSAI Reg. No. {store.fssaiLicense}</span>}
            <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
          </p>
        </div>
        <div className="footer-links">
          <h3>At the table</h3>
          <Link to="/our-story">About us</Link>
          <a href="/our-story#product-information">Product information</a>
          <Link to="/shop">Shop all products</Link>
          <Link to="/combos">Shop combos</Link>
          <Link to="/journal">Pairing notes</Link>
          <Link to="/wishlist">Saved flavours</Link>
        </div>
        <div className="footer-links">
          <h3>Here to help</h3>
          <AccountLink customerTab="My orders">
            Orders &amp; invoices
          </AccountLink>
          <Link to="/shipping">Shipping policy</Link>
          <Link to="/returns">Cancellation, refunds &amp; exchanges</Link>
          <Link to="/contact">Contact us</Link>
        </div>
        <div className="footer-links footer-policy-links">
          <h3>The fine print</h3>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy policy</Link>
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
          Aavaruchi.
        </span>
        <span className="developer-credit">
          Developed by{" "}
          <a href="https://www.octaleads.com/" target="_blank" rel="noopener noreferrer">
            Octaleads
          </a>
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
