import { Link, useNavigate } from "@/lib/navigation";
import { BRAND } from "@/lib/brand";
import { aboutAavaruchi, productInformation } from "@/data/brand-content";
import { useInitialCatalog } from "@/lib/store-data";
import { useStoreProducts } from "@/lib/store-products";
import { useCommerceWishlist } from "@/lib/commerce-wishlist";
import { StorePage } from "./StoreHeader";
import {
  Reveal,
  PickleArtwork,
  ReferenceProductCard,
} from "./ReferencePrimitives";
function StoryContent({ onShop }: { onShop: () => void }) {
  return (
    <section className="story-page wrap">
      <div className="story-page-intro">
        <span className="eyebrow">ABOUT US</span>
        <h1>The warmth of home.<br /><em>The taste of Aavaruchi.</em></h1>
        <p className="lead">Food, memories, and Amma chethi ruchi.</p>
        <p className="story-business-line">{BRAND.legalName} · {BRAND.address}</p>
      </div>
      <Reveal as="figure" className="story-wide-photo">
        <img src="/images/hero.png" alt="Aavaruchi mango pickle with raw mango and traditional spices" />
        <figcaption>FAMILY RECIPES. SMALL BATCHES. MADE WITH LOVE.</figcaption>
      </Reveal>
      <div className="story-chapters">
        <Reveal as="article">
          <h2>From Amma’s kitchen<br />to your family table.</h2>
          <div>{aboutAavaruchi.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            <a className="link-button" href={`mailto:${BRAND.email}`}>Share a recipe or feedback ↗</a>
          </div>
        </Reveal>
        <Reveal as="article" id="product-information">
          <span className="eyebrow">PRODUCT INFORMATION</span>
          <h2>Homemade goodness.<br />Care in every batch.</h2>
          <div>{productInformation.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            <button className="button outline" onClick={onShop}>Find your flavour <span>↗</span></button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function StoryPage() {
  const navigate = useNavigate();
  return (
    <StorePage>
      <main id="main">
        <StoryContent onShop={() => void navigate({ to: "/shop" })} />
      </main>
    </StorePage>
  );
}
export function WishlistPage() {
  const products = useStoreProducts(useInitialCatalog());
  const wishlist = useCommerceWishlist();
  const saved = products.filter((product) =>
    wishlist.saved.includes(product.id),
  );
  return (
    <StorePage>
      <main id="main">
        <section className="shop-section wrap">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR FAVOURITES</span>
              <h1>Your saved flavours.</h1>
            </div>
          </div>
          {saved.length ? (
            <div className="product-grid">
              {saved.map((product, index) => (
                <ReferenceProductCard
                  key={product.id}
                  product={product}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>A place for your favourites.</h3>
              <p>Tap the heart on any pickle to save it here.</p>
              <Link className="button" to="/shop">
                Browse pickles
              </Link>
            </div>
          )}
        </section>
      </main>
    </StorePage>
  );
}
export function JournalPage() {
  return (
    <StorePage>
      <main id="main">
        <section className="journal wrap">
          <span className="eyebrow">AT THE TABLE</span>
          <h1>A spoonful of possibility.</h1>
          <p className="lead">
            Three everyday pairings to give your pickle a place at the table.
          </p>
          {[
            {
              number: "01",
              title: "The comforting rice plate",
              copy: "Start with warm rice and dal. Add a small spoon of mango pickle at the side, and adjust to the heat you like. Keep the pickle separate until the first bite.",
              query: "mango",
              image: 0,
            },
            {
              number: "02",
              title: "The breakfast companion",
              copy: "Serve a little tomato pickle with dosa or idli. Its rich tang makes an easy companion to coconut chutney and sambar.",
              query: "tomato",
              image: 2,
            },
            {
              number: "03",
              title: "The cool and tangy bowl",
              copy: "A small spoon of lemon pickle brings a bright contrast to cool curd rice. Add it at the table so everyone can choose their own amount.",
              query: "lemon",
              image: 3,
            },
          ].map((item) => (
            <Reveal as="article" className="journal-entry" key={item.number}>
              <PickleArtwork
                index={item.image}
                label={`${item.query} pickle pairing`}
              />
              <div>
                <span className="eyebrow">
                  {item.number} / A SIMPLE PAIRING
                </span>
                <h2>{item.title}</h2>
                <p>{item.copy}</p>
                <Link
                  className="link-button"
                  to="/shop"
                  search={{ q: item.query }}
                >
                  Explore the pickle <span>↗</span>
                </Link>
              </div>
            </Reveal>
          ))}
        </section>
      </main>
    </StorePage>
  );
}
