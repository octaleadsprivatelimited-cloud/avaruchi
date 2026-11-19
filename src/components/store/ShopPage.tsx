import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "@/lib/navigation";
import { useInitialCatalog } from "@/lib/store-data";
import { useStoreProducts } from "@/lib/store-products";
import { useCommerceImpression } from "@/lib/commerce-analytics-hooks";
import { analyticsItemsForProducts } from "@/lib/commerce-analytics";
import { priceIncludingTax } from "@/lib/catalog-price";
import { CampaignSlot } from "@/lib/promotions";
import { ReferenceIcon, ReferenceProductCard } from "./ReferencePrimitives";
import { StorePage } from "./StoreHeader";
import { ALL_PRODUCTS, catalogCategories, catalogCategoryTree, categoryParts, matchesCategory } from "@/lib/catalog-categories";
import { matchesProductSearch } from "@/lib/product-search";
import { matchesDiet, normalizeDietFilter, type DietFilter } from "@/lib/catalog-diet";
import "@/catalog-diet.css";

export function ShopPage() {
  const products = useStoreProducts(useInitialCatalog());
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.searchStr);
  const [category, setCategory] = useState(
    categoryParts(params.get("category") || ALL_PRODUCTS).join(" > "),
  );
  const [query, setQuery] = useState(
    params.get("q") || params.get("search") || "",
  );
  const [sort, setSort] = useState("featured");
  const [diet, setDiet] = useState<DietFilter>(normalizeDietFilter(params.get("diet")));
  useEffect(() => {
    const params = new URLSearchParams(location.searchStr);
    setCategory(categoryParts(params.get("category") || ALL_PRODUCTS).join(" > "));
    setQuery(params.get("q") || params.get("search") || "");
    setDiet(normalizeDietFilter(params.get("diet")));
  }, [location.searchStr]);
  const dietProducts = useMemo(() => products.filter(product => matchesDiet(product, diet)), [products, diet]);
  const categories = catalogCategories(dietProducts);
  const subcategories = catalogCategoryTree(dietProducts).find(root => matchesCategory({ category }, root.path))?.children || [];
  const chooseCategory = (value: string) => {
    setCategory(value);
    void navigate({ to: "/shop", search: { category: value, q: query, diet: diet === "all" ? undefined : diet }, resetScroll: false });
  };
  const chooseDiet = (value: DietFilter) => {
    setDiet(value);
    setCategory(ALL_PRODUCTS);
    void navigate({ to: "/shop", search: { diet: value === "all" ? undefined : value, q: query }, resetScroll: false });
  };
  const shown = useMemo(
    () =>
      dietProducts
        .filter(
          (product) =>
            matchesCategory(product, category) &&
            matchesProductSearch(product, query),
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
    [dietProducts, category, query, sort],
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
              <h1>{category === ALL_PRODUCTS ? "The Aavaruchi pantry" : categoryParts(category).at(-1)}</h1>
            </div>
            <div className="section-intro">
              <p>
                Pickles, flavourful podis and crisp fryums.
                <br className="desktop" /> Find a little taste of home.
              </p>
            </div>
          </div>
          <div className="catalog-diet-filter" role="group" aria-label="Filter by diet">
            <span>Food preference</span>
            {([{ value: "all", label: "All" }, { value: "veg", label: "Veg" }, { value: "non-veg", label: "Non-Veg" }] as const).map(item => (
              <button type="button" key={item.value} aria-pressed={diet === item.value} onClick={() => chooseDiet(item.value)}>
                {item.value !== "all" && <i className={`diet-marker ${item.value}`} aria-hidden="true" />}
                {item.label}
              </button>
            ))}
          </div>
          <div className="catalog-tools">
            <div className="search-field">
              <ReferenceIcon name="search" />
              <input
                aria-label="Search products"
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
          {subcategories.length > 0 && <div className="subcategory-row" aria-label="Subcategories">{subcategories.map(item => <button type="button" key={item.path} aria-pressed={category.toLowerCase() === item.path.toLowerCase()} onClick={() => chooseCategory(item.path)}>{item.name} <small>{item.count}</small></button>)}</div>}
          <div className="category-row">
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                className={category === item || item !== ALL_PRODUCTS && matchesCategory({ category }, item) ? "active" : ""}
                aria-pressed={category === item || item !== ALL_PRODUCTS && matchesCategory({ category }, item)}
                onClick={() => chooseCategory(item)}
              >
                {item}
              </button>
            ))}
            <span>
              {shown.length} {shown.length === 1 ? "product" : "products"}
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
              <h3>No products found.</h3>
              <p>
                {products.length
                  ? "Try another flavour, ingredient, food preference, or category."
                  : "Our collection is coming together. Check back for fresh flavours."}
              </p>
              {(query || category !== ALL_PRODUCTS || diet !== "all") && (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setQuery("");
                    setCategory(ALL_PRODUCTS);
                    setDiet("all");
                    setSort("featured");
                    void navigate({ to: "/shop", resetScroll: false });
                  }}
                >
                  Browse all products
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </StorePage>
  );
}
