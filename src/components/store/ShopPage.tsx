import { useEffect, useMemo, useState } from "react";
import { useLocation } from "@/lib/navigation";
import { useInitialCatalog } from "@/lib/store-data";
import { useStoreProducts } from "@/lib/store-products";
import { useCommerceImpression } from "@/lib/commerce-analytics-hooks";
import { analyticsItemsForProducts } from "@/lib/commerce-analytics";
import { priceIncludingTax } from "@/lib/catalog-price";
import { CampaignSlot } from "@/lib/promotions";
import { ReferenceIcon, ReferenceProductCard } from "./ReferencePrimitives";
import { StorePage } from "./StoreHeader";

export function ShopPage() {
  const products = useStoreProducts(useInitialCatalog());
  const location = useLocation();
  const params = new URLSearchParams(location.searchStr);
  const [category, setCategory] = useState(
    params.get("category") || "All pickles",
  );
  const [query, setQuery] = useState(
    params.get("q") || params.get("search") || "",
  );
  const [sort, setSort] = useState("featured");
  useEffect(() => {
    const params = new URLSearchParams(location.searchStr);
    setCategory(params.get("category") || "All pickles");
    setQuery(params.get("q") || params.get("search") || "");
  }, [location.searchStr]);
  const categories = [
    ...new Set([
      "All pickles",
      "Classics",
      "Andhra favourites",
      "Bold flavours",
      ...products.map((product) => product.category),
    ]),
  ];
  const shown = useMemo(
    () =>
      products
        .filter(
          (product) =>
            (["All", "All pickles"].includes(category) ||
              product.category.toLowerCase() === category.toLowerCase()) &&
            `${product.name} ${product.category} ${product.description || ""}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "price-low"
            ? priceIncludingTax(a.price, a.taxRate) -
              priceIncludingTax(b.price, b.taxRate)
            : sort === "price-high"
              ? priceIncludingTax(b.price, b.taxRate) -
                priceIncludingTax(a.price, a.taxRate)
              : 0,
        ),
    [products, category, query, sort],
  );
  useCommerceImpression(
    "view_item_list",
    analyticsItemsForProducts(shown),
    "Shop collection",
  );
  return (
    <StorePage>
      <main id="main">
        <section id="shop" className="shop-section wrap">
          <CampaignSlot placement="SHOP_TOP" />
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE COLLECTION</span>
              <h1>Pickles</h1>
            </div>
            <div className="section-intro">
              <p>
                From the familiar tang of mango to
                <br className="desktop" /> the bold bite of gongura. Find your
                jar.
              </p>
            </div>
          </div>
          <div className="catalog-tools">
            <div className="search-field">
              <ReferenceIcon name="search" />
              <input
                aria-label="Search pickles"
                placeholder="Search a flavour or ingredient"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <label>
              Sort by{" "}
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                aria-label="Sort products"
              >
                <option value="featured">Our collection</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
              </select>
            </label>
          </div>
          <div className="category-row">
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                className={category === item ? "active" : ""}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
            <span>
              {shown.length} {shown.length === 1 ? "flavour" : "flavours"}
            </span>
          </div>
          {shown.length ? (
            <div className="product-grid">
              {shown.map((product, index) => (
                <ReferenceProductCard
                  key={product.id}
                  product={product}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>No jars found.</h3>
              <p>
                {products.length
                  ? "Try another flavour, ingredient, or category."
                  : "Our collection is coming together. Check back for fresh flavours."}
              </p>
              {(query || category !== "All pickles") && (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setQuery("");
                    setCategory("All pickles");
                  }}
                >
                  Browse pickles
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </StorePage>
  );
}
