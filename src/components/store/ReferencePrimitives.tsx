import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "@/lib/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { BRAND } from "@/lib/brand";
import { money, type Product } from "@/data/commerce";
import { useStoreCommerce } from "@/lib/store-commerce";
import { productRouteKey } from "@/lib/product-url";
import { priceIncludingTax } from "@/lib/catalog-price";
import { trackCommerceEvent } from "@/lib/analytics";
import { productAnalyticsItem } from "@/lib/commerce-analytics";
import { useStorefrontConfig } from "@/lib/storefront-config";

export function PickleArtwork({
  index,
  label,
  className = "",
}: {
  index: number;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`product-photo ${className}`}
      role="img"
      aria-label={label}
      style={{
        backgroundImage: "url(/images/pickles.png)",
        backgroundPosition: `${((index % 4) * 100) / 3}% ${index < 4 ? 0 : 100}%`,
      }}
    />
  );
}

export function ProductPhoto({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  return (
    <div className={`product-photo catalog-photo ${className}`}>
      {product.image ? (
        <img
          src={product.image}
          alt={product.imageAlt || product.name}
          loading="lazy"
        />
      ) : (
        <span role="img" aria-label={product.name}>
          {product.glyph || "◒"}
        </span>
      )}
    </div>
  );
}

export function ReferenceProductCard({
  product,
  index = 0,
}: {
  product: Product;
  index?: number;
}) {
  const [variantId, setVariantId] = useState("");
  const selectId = useId();
  const { cart, wishlist } = useStoreCommerce();
  const variants = product.variants || [];
  const variant =
    variants.find((item) => item.id === variantId) ||
    variants.find((item) => item.stock > 0) ||
    variants[0];
  const wished = wishlist.saved.includes(product.id);
  const selectProduct = () => {
    const item = productAnalyticsItem(product, variant);
    if (item)
      trackCommerceEvent("select_item", {
        items: [item],
        item_list_name: "Avaruchi collection",
      });
  };
  const save = async () => {
    try {
      const result = await wishlist.toggle(product.id);
      toast.success(
        result.saved ? "Saved to your flavours" : "Removed from saved flavours",
      );
    } catch {
      toast.error(
        "Your saved flavours could not be updated. Please try again.",
      );
    }
  };
  const add = () => {
    if (!variant || !cart.add(product.id, variant.id))
      return toast.error("This jar is currently unavailable.");
    toast.success(`${product.name} added to your bag`);
  };
  const path = productRouteKey(product);
  return (
    <Reveal as="article" className="product-card" delay={(index % 4) * 0.045}>
      <div className="photo-wrap">
        <Link
          className="photo-button"
          to="/product/$productId"
          params={{ productId: path }}
          onClick={selectProduct}
          aria-label={`View ${product.name}`}
        >
          <ProductPhoto product={product} />
        </Link>
        <button
          type="button"
          className={`wish-button ${wished ? "chosen" : ""}`}
          aria-label={`${wished ? "Remove" : "Save"} ${product.name}`}
          aria-pressed={wished}
          onClick={save}
        >
          <ReferenceIcon name="heart" />
        </button>
        <span className="product-tag">{product.badge || product.category}</span>
      </div>
      <div className="product-heading">
        <Link
          className="text-button"
          to="/product/$productId"
          params={{ productId: path }}
          onClick={selectProduct}
        >
          <h3>{product.name}</h3>
        </Link>
        <span>
          {money(
            priceIncludingTax(variant?.price ?? product.price, product.taxRate),
          )}
        </span>
      </div>
      <p className="product-subtitle">
        {product.specifications?.Subtitle ||
          product.description ||
          "A familiar flavour for your table."}
      </p>
      <div className="product-actions">
        <label className="sr-only" htmlFor={selectId}>
          Pack size for {product.name}
        </label>
        <select
          id={selectId}
          value={variant?.id || ""}
          onChange={(event) => setVariantId(event.target.value)}
          disabled={!variants.length}
        >
          {!variants.length && <option value="">Unavailable</option>}
          {variants.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title ||
                Object.values(item.options).join(" / ") ||
                "Standard pack"}
              {item.stock < 1 ? " · Sold out" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="add-button"
          disabled={!variant || variant.stock < 1}
          onClick={add}
        >
          {variant && variant.stock > 0 ? "Add to cart" : "Sold out"}
        </button>
      </div>
    </Reveal>
  );
}

const heroSlides = [
  {
    id: "mango",
    title: "The taste of home, in every jar.",
    copy: "Classic mango. Familiar tang. A place at your table.",
    name: "classic mango",
    image: 0,
  },
  {
    id: "gongura",
    title: "An Andhra favourite.",
    copy: "Discover the distinctive, leafy tang of gongura.",
    name: "gongura",
    image: 1,
  },
  {
    id: "chilli",
    title: "A little more fire.",
    copy: "Bold red chilli pickle for the heat seekers.",
    name: "red chilli",
    image: 5,
  },
];
export function ReferenceHero({ products }: { products: Product[] }) {
  const store = useStorefrontConfig();
  const [slide, setSlide] = useState(0);
  const reduced = useReducedMotion();
  const item = heroSlides[slide]!;
  const product = products.find((product) =>
    `${product.slug || ""} ${product.name}`.toLowerCase().includes(item.id),
  );
  return (
    <section
      className="reference-hero"
      aria-label="Featured pickles"
      aria-roledescription="carousel"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={item.id}
          className={`reference-slide ${slide === 0 ? "photo-slide" : "jar-slide"}`}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.3 }}
        >
          {slide === 0 ? (
            <img
              key={store.heroImageUrl || "default-hero"}
              src={store.heroImageUrl || "/images/hero.png"}
              alt={store.heroImageAlt || (store.heroImageUrl ? `${store.storeName} featured pickles` : "Avaruchi mango pickle jar with a bowl of spiced mango and chillies")}
              fetchPriority="high"
              onError={event => {
                if (store.heroImageUrl && event.currentTarget.getAttribute("src") !== "/images/hero.png") {
                  event.currentTarget.src = "/images/hero.png";
                  event.currentTarget.alt = "Avaruchi mango pickle jar with a bowl of spiced mango and chillies";
                }
              }}
            />
          ) : (
            <PickleArtwork
              index={item.image}
              label={`Avaruchi ${item.name} pickle`}
              className="hero-jar"
            />
          )}
          <div className="reference-hero-copy">
            <h1>{item.title}</h1>
            <p>{item.copy}</p>
            {product ? (
              <Link
                className="hero-shop-link"
                to="/product/$productId"
                params={{ productId: productRouteKey(product) }}
              >
                Shop {item.name}
              </Link>
            ) : (
              <Link
                className="hero-shop-link"
                to="/shop"
                search={{ q: item.id }}
              >
                Shop {item.name}
              </Link>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
      <div
        className="slide-controls"
        role="group"
        aria-label="Choose a featured pickle"
      >
        {heroSlides.map((item, index) => (
          <button
            type="button"
            key={item.id}
            aria-label={`Show ${item.id} pickle slide`}
            aria-pressed={slide === index}
            onClick={() => setSlide(index)}
          >
            <span />
          </button>
        ))}
      </div>
    </section>
  );
}

export function CollectionRow({
  title,
  category,
  products,
}: {
  title: string;
  category: string;
  products: Product[];
}) {
  const track = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [edges, setEdges] = useState({ start: true, end: true });
  const measure = () => {
    const el = track.current;
    if (el)
      setEdges({
        start: el.scrollLeft < 2,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
      });
  };
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [products.length]);
  const scroll = (direction: number) =>
    track.current?.scrollBy({
      left: direction * track.current.clientWidth,
      behavior: reduced ? "auto" : "smooth",
    });
  return (
    <section className="reference-collection wrap" aria-label={title}>
      <div className="reference-collection-heading">
        <h2>
          {title}
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <path
              d="M7 29C7 15 16 8 29 7c0 14-7 21-20 22M5 32 25 11"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </h2>
        <Link className="collection-view" to="/shop" search={{ category }}>
          View all
        </Link>
      </div>
      {products.length ? (
        <div className="collection-rail">
          <button
            type="button"
            className="collection-arrow"
            disabled={edges.start}
            aria-label={`Previous ${title}`}
            onClick={() => scroll(-1)}
          >
            ‹
          </button>
          <div
            className="collection-track"
            ref={track}
            onScroll={measure}
            tabIndex={0}
            aria-label={`${title} products`}
          >
            {products.map((product, index) => (
              <ReferenceProductCard
                key={product.id}
                product={product}
                index={index}
              />
            ))}
          </div>
          <button
            type="button"
            className="collection-arrow"
            disabled={edges.end}
            aria-label={`Next ${title}`}
            onClick={() => scroll(1)}
          >
            ›
          </button>
        </div>
      ) : (
        <div className="collection-empty">
          <span>A little room for your next favourite.</span>
          <p>
            Our collection is coming together. Check back for fresh flavours.
          </p>
        </div>
      )}
    </section>
  );
}
export function ReferenceIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="23"
      height="23"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {name === "bag" ? (
        <>
          <path d="M5 7h14l1 14H4L5 7Z" />
          <path d="M8 8V6a4 4 0 0 1 8 0v2" />
        </>
      ) : name === "user" ? (
        <>
          <circle cx="12" cy="7" r="3.5" />
          <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        </>
      ) : name === "search" ? (
        <>
          <circle cx="10" cy="10" r="6.5" />
          <path d="m15 15 6 6" />
        </>
      ) : name === "heart" ? (
        <path d="M12 20 3.8 12A5 5 0 0 1 12 5.8 5 5 0 0 1 20.2 12L12 20Z" />
      ) : (
        <>
          <path d="m5 5 14 14M19 5 5 19" />
        </>
      )}
    </svg>
  );
}
const motionEase = [0.22, 1, 0.36, 1] as const;
// Content stays visible in server-rendered HTML and when JavaScript is unavailable.
export function Reveal({
  children,
  className,
  as = "div",
  delay = 0,
  enter = false,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "section" | "figure";
  delay?: number;
  enter?: boolean;
}) {
  const reduced = useReducedMotion();
  const Element = motion[as];
  const reveal = reduced
    ? { opacity: 1, y: 0 }
    : { opacity: [0.55, 1], y: [18, 0] };
  return (
    <Element
      className={className}
      initial={false}
      animate={enter ? reveal : undefined}
      whileInView={enter ? undefined : reveal}
      viewport={{ once: true, amount: 0.12, margin: "0px 0px -24px 0px" }}
      transition={{
        duration: reduced ? 0 : 0.6,
        delay: reduced ? 0 : delay,
        ease: motionEase,
      }}
    >
      {children}
    </Element>
  );
}
export function ReferenceModal({
  title,
  children,
  onClose,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const reduced = useReducedMotion();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab") {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),a[href],input:not([disabled]),select,textarea,[tabindex="0"]',
          ) || [],
        ).filter((x) => x.offsetParent !== null);
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = scroll;
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, []);
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
      className={"overlay " + (drawer ? "drawer-overlay" : "")}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={
          reduced ? false : drawer ? { x: "100%" } : { y: 20, opacity: 0 }
        }
        animate={{ x: 0, y: 0, opacity: 1 }}
        exit={
          reduced
            ? { opacity: 0 }
            : drawer
              ? { x: "100%" }
              : { y: 12, opacity: 0 }
        }
        transition={{ duration: reduced ? 0 : 0.36, ease: motionEase }}
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={drawer ? "drawer" : "modal"}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label={"Close " + title}
            onClick={onClose}
          >
            <ReferenceIcon name="close" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
export function Skeleton() {
  return (
    <div className="skeleton-grid" role="status" aria-label="Loading pickles">
      {[0, 1, 2, 3].map((n) => (
        <div key={n}>
          <div className="skeleton-picture" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      ))}
    </div>
  );
}
export function BrandMark() {
  const store = useStorefrontConfig();
  const customLogo = store.logoUrl && store.logoUrl !== "/favicon.svg";
  return (
    <>
      <img
        className="brand-logo"
        src={customLogo ? store.logoUrl : BRAND.logoSmall}
        width={192}
        height={192}
        alt=""
      />
      <span className="brand-name">
        {store.storeName === "Avaruchi" ? "avaruchi" : store.storeName}
        <small lang="te">{BRAND.tagline}</small>
      </span>
    </>
  );
}
export function ReferenceFaq() {
  return (
    <Reveal as="section" className="faq wrap">
      <div>
        <span className="eyebrow">A LITTLE HELP</span>
        <h2>
          Before you
          <br />
          open the jar.
        </h2>
      </div>
      <div>
        {[
          [
            "How do I choose a pickle?",
            "Start with the flavour you love. Mango is bold and tangy, gongura has a leafy sharpness, and tomato is mellow. Each product page includes a heat level and pairing note.",
          ],
          [
            "What sizes can I order?",
            "Choose an available jar size on the product page. Current prices and availability are shown for each option.",
          ],
          [
            "How do I track an order?",
            "Open your account and select View order. Your order moves through confirmed, packed, shipped and delivered, with a tracking reference added by the store.",
          ],
          [
            "Where do I find my invoice?",
            "A numbered PDF invoice is created automatically when an order is confirmed. Download it from the confirmation screen or your order history.",
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </Reveal>
  );
}
