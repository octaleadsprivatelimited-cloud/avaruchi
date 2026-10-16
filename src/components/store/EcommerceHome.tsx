import { Link } from "@/lib/navigation";
import { useInitialCatalog } from "@/lib/store-data";
import { useStoreProducts } from "@/lib/store-products";
import { useStorefrontConfig } from "@/lib/storefront-config";
import { deliveryAnnouncement } from "@/lib/delivery-policy";
import { useCommerceImpression } from "@/lib/commerce-analytics-hooks";
import { analyticsItemsForProducts } from "@/lib/commerce-analytics";
import { CampaignSlot } from "@/lib/promotions";
import { BRAND } from "@/lib/brand";
import { catalogCategoryTree, matchesCategory } from "@/lib/catalog-categories";
import { StorePage } from "./StoreHeader";
import {
  CollectionRow,
  ReferenceFaq,
  ReferenceHero,
  Reveal,
} from "./ReferencePrimitives";

export function EcommerceHome() {
  const store = useStorefrontConfig();
  const products = useStoreProducts(useInitialCatalog());
  useCommerceImpression(
    "view_item_list",
    analyticsItemsForProducts(products),
    "Home collection",
  );
  return (
    <StorePage>
      <main id="main" className="reference-home">
        <CampaignSlot placement="HOME_HERO" />
        <ReferenceHero products={products} />
        <Reveal as="section" className="reference-intro wrap">
          <div>
            <h2>Pickles for the everyday Andhra table</h2>
            <p>
              Aavaruchi brings the warmth of Amma’s kitchen to your table.
              Discover homemade pickles, podis and pachadis, prepared in small
              batches with traditional family recipes and carefully selected ingredients.
            </p>
            <p>
              Warm rice, a crisp dosa, a comforting bowl of dal. There is always
              room for a little pickle.
            </p>
            {store.manualDeliveryEnabled && (
              <strong>{deliveryAnnouncement(store)}.</strong>
            )}
          </div>
        </Reveal>
        {catalogCategoryTree(products).map(category => <CollectionRow key={category.path} title={category.name} category={category.path} products={products.filter(product => matchesCategory(product, category.path))} />)}
        {!products.length && <CollectionRow title="The collection" category="All products" products={[]} />}
        <Reveal as="section" className="reference-story wrap">
          <div>
            <span className="eyebrow">ESTABLISHED {BRAND.established}</span>
            <h2>Aavaruchi. Made with love.</h2>
            <p>
              Aavaruchi is the homemade food brand of{" "}
              {store.legalName || BRAND.legalName}, based in{" "}
              {store.businessAddress || BRAND.address}. Our story begins with Amma’s Avakaya and the family recipes
              that make every spoonful feel like home.
            </p>
            <Link className="collection-view" to="/our-story">
              About us
            </Link>
          </div>
          <img
            className="brand-story-art"
            src={BRAND.logo}
            width={640}
            height={640}
            loading="lazy"
            alt="Aavaruchi supplied brand artwork"
          />
        </Reveal>
        <ReferenceFaq />
      </main>
    </StorePage>
  );
}
