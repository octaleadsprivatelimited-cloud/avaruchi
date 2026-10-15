import { Link } from "@/lib/navigation";
import { useInitialCatalog } from "@/lib/store-data";
import { useStoreProducts } from "@/lib/store-products";
import { useStorefrontConfig } from "@/lib/storefront-config";
import { deliveryAnnouncement } from "@/lib/delivery-policy";
import { useCommerceImpression } from "@/lib/commerce-analytics-hooks";
import { analyticsItemsForProducts } from "@/lib/commerce-analytics";
import { CampaignSlot } from "@/lib/promotions";
import { BRAND } from "@/lib/brand";
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
              Avaruchi brings familiar tang and bold spice to the meals you
              love. Explore mango, gongura, tomato and more, choose your jar
              size, and find a new favourite for your table.
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
        <CollectionRow
          title="pickles"
          category="All pickles"
          products={products}
        />
        {products.some(product => product.category.toLowerCase() === "andhra favourites") && <CollectionRow
          title="Andhra favourites"
          category="Andhra favourites"
          products={products.filter(
            (product) => product.category.toLowerCase() === "andhra favourites",
          )}
        />}
        {products.some(product => product.category.toLowerCase() === "bold flavours") && <CollectionRow
          title="bold flavours"
          category="Bold flavours"
          products={products.filter(
            (product) => product.category.toLowerCase() === "bold flavours",
          )}
        />}
        <Reveal as="section" className="reference-story wrap">
          <div>
            <span className="eyebrow">ESTABLISHED {BRAND.established}</span>
            <h2>Avaruchi. A familiar ritual.</h2>
            <p>
              Avaruchi is the pickle brand of{" "}
              {store.legalName || BRAND.legalName}, based in{" "}
              {store.businessAddress || BRAND.address}. Find pairing notes for
              warm rice, breakfast and everyday lunches.
            </p>
            <Link className="collection-view" to="/journal">
              Read our pairing notes
            </Link>
          </div>
          <img
            className="brand-story-art"
            src={BRAND.logo}
            width={640}
            height={640}
            loading="lazy"
            alt="Avaruchi supplied brand artwork"
          />
        </Reveal>
        <ReferenceFaq />
      </main>
    </StorePage>
  );
}
