"use client";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  checkoutAttempt,
  loadPaymentScript,
  readStored,
  safeBasket,
  writeStored,
} from "@/lib/browser-recovery";
import { pagePath, pageView } from "@/lib/routes";
import {
  requestReasons,
  requestStatus,
  requestTransitions,
} from "@/lib/customer";
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  sampleProducts,
  rupees,
  weightLabel,
  type Product,
  type CartItem,
} from "@/lib/catalog";
const accountDate = (value: string | number) =>
  new Date(value).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
function RequestRecord({ request: x, demo }: { request: any; demo: boolean }) {
  return (
    <article className="request-card">
      <div className="request-heading">
        <div>
          <span className="eyebrow">{x.order_id}</span>
          <h3>{x.kind === "return" ? "Return request" : "Refund request"}</h3>
        </div>
        <span className="status">{requestStatus[x.status]}</span>
      </div>
      <p>
        {requestReasons[x.reason]} · Submitted {accountDate(x.created)}
      </p>
      <p className="request-description">{x.details}</p>
      {!!x.refund_amount && (
        <div className="refund-summary">
          <strong>{rupees(x.refund_amount)}</strong>
          <span>
            {x.refund_reference
              ? demo
                ? "Preview refund record"
                : "Refund recorded by the store"
              : "Refund pending"}
          </span>
          {x.refund_reference && <span>Reference: {x.refund_reference}</span>}
        </div>
      )}
      {demo && (
        <p className="muted">
          Preview request. No real collection or refund is processed.
        </p>
      )}
      <ol className="request-history" aria-label="Request updates">
        {x.history.map((h: any, i: number) => (
          <li key={i}>
            <time>{accountDate(h.at)}</time>
            <div>
              <strong>{requestStatus[h.status]}</strong>
              <p>{h.note}</p>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
function PortalIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="34"
      height="34"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {name === "orders" ? (
        <>
          <path d="M5 10 16 5l11 5v15l-11 5-11-5V10Z" />
          <path d="m5 10 11 5 11-5M16 15v15M11 7l11 5v6" />
        </>
      ) : name === "address" ? (
        <>
          <path d="M25 13c0 7-9 15-9 15S7 20 7 13a9 9 0 0 1 18 0Z" />
          <circle cx="16" cy="13" r="3" />
        </>
      ) : name === "returns" ? (
        <>
          <path d="M9 9h12a8 8 0 0 1 0 16h-7M9 9l5-5M9 9l5 5" />
          <path d="M5 19h8v9H5z" />
        </>
      ) : name === "invoices" ? (
        <>
          <path d="M8 4h16v24l-4-2-4 2-4-2-4 2V4Z" />
          <path d="M12 10h8M12 15h8M12 20h4" />
        </>
      ) : name === "wishlist" ? (
        <path d="m16 27-11-11A7 7 0 0 1 16 6a7 7 0 0 1 11 10L16 27Z" />
      ) : name === "help" ? (
        <>
          <circle cx="16" cy="16" r="12" />
          <path d="M12 12a4 4 0 1 1 7 3c-2 1-3 2-3 4M16 23v1" />
        </>
      ) : (
        <>
          <path d="M5 5h9v9H5zM18 5h9v9h-9zM5 18h9v9H5zM18 18h9v9h-9z" />
        </>
      )}
    </svg>
  );
}

const StorePageContext = createContext<ReactNode>(null);
export function StorePage() {
  return useContext(StorePageContext);
}

type Address = {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
};
const blankAddress: Address = {
  name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};
const initialConfig = {
  keyId: "",
  demo: true,
  google: false,
  payments: false,
  cod: true,
  address: BRAND.address,
  gst: "",
  support: "",
  shippingFee: 5900,
  freeShipping: 69900,
};
async function api(path: string, data?: any) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const r = await fetch("/api/" + path, {
      method: data === undefined ? "GET" : "POST",
      headers:
        data === undefined ? undefined : { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: controller.signal,
    });
    let b: any;
    try {
      b = await r.json();
    } catch {
      throw new Error(
        "The store returned an unavailable response. Please retry shortly.",
      );
    }
    if (!r.ok)
      throw Object.assign(new Error(b.error || "Please try again."), {
        status: r.status,
      });
    return b;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        data === undefined
          ? "The store is taking too long to respond. Please retry shortly."
          : "The response timed out. Refresh orders or the saved record before trying the action again.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function Icon({ name }: { name: string }) {
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
function ProductPhoto({
  p,
  className = "",
}: {
  p: Product;
  className?: string;
}) {
  return (
    <div
      className={"product-photo " + className}
      role="img"
      aria-label={p.name + " pickle, Avaruchi packaging concept"}
      style={{
        backgroundImage: "url(/images/pickles.png)",
        backgroundPosition:
          ((p.image % 4) * 100) / 3 + "% " + (p.image < 4 ? 0 : 100) + "%",
      }}
    />
  );
}
const motionEase = [0.22, 1, 0.36, 1] as const;
// Content stays visible in server-rendered HTML and when JavaScript is unavailable.
function Reveal({
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
function Modal({
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
  const reduced = useReducedMotion();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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
            <Icon name="close" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
function Skeleton() {
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
function ProductCard({
  p,
  onAdd,
  wished,
  onWish,
  index: cardIndex = 0,
}: {
  p: Product;
  index?: number;
  onAdd: (id: string) => void;
  wished: boolean;
  onWish: () => void;
}) {
  const [index, setIndex] = useState(0);
  const selectId = useId();
  const v = p.variants[index] || p.variants[0];
  return (
    <Reveal
      as="article"
      className="product-card"
      delay={(cardIndex % 4) * 0.045}
    >
      <div className="photo-wrap">
        <Link
          className="photo-button"
          href={"/shop/" + p.id}
          aria-label={"View " + p.name}
        >
          <ProductPhoto p={p} />
        </Link>
        <button
          className={"wish-button " + (wished ? "chosen" : "")}
          aria-label={(wished ? "Remove " : "Save ") + p.name}
          aria-pressed={wished}
          onClick={onWish}
        >
          <Icon name="heart" />
        </button>
        <span className="product-tag">
          {p.heat >= 4
            ? "EXTRA HOT"
            : p.category === "Andhra favourites"
              ? "ANDHRA FAVOURITE"
              : p.category === "Bold flavours"
                ? "BOLD FLAVOUR"
                : "PANTRY CLASSIC"}
        </span>
      </div>
      <div className="product-heading">
        <Link className="text-button" href={"/shop/" + p.id}>
          <h3>{p.name}</h3>
        </Link>
        <span>{rupees(v.price)}</span>
      </div>
      <p className="product-subtitle">{p.subtitle}</p>
      <div className="product-actions">
        <label className="sr-only" htmlFor={selectId}>
          Jar size for {p.name}
        </label>
        <select
          id={selectId}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
        >
          {p.variants.map((v, i) => (
            <option key={v.id} value={i}>
              {weightLabel(v.weight)}
            </option>
          ))}
        </select>
        <button
          className="add-button"
          disabled={!v.stock}
          onClick={() => onAdd(v.id)}
        >
          {v.stock ? "Add to cart" : "Sold out"}
        </button>
      </div>
    </Reveal>
  );
}
function BrandMark() {
  return (
    <>
      <img
        className="brand-logo"
        src={BRAND.logoSmall}
        width={192}
        height={192}
        alt=""
      />
      <span className="brand-name">
        avaruchi<small lang="te">{BRAND.tagline}</small>
      </span>
    </>
  );
}
// Keep query-only Next.js navigation in sync without hiding the server-rendered storefront.
function UrlStateSync({ onChange }: { onChange: (query: string) => void }) {
  const params = useSearchParams();
  const query = params.toString();
  useEffect(() => onChange(query), [query, onChange]);
  return null;
}
function ReferenceHero({ products }: { products: Product[] }) {
  const [slide, setSlide] = useState(0);
  const reduced = useReducedMotion();
  const slides = [
    {
      id: "mango",
      title: "The taste of home, in every jar.",
      copy: "Classic mango. Familiar tang. A place at your table.",
      photo: true,
    },
    {
      id: "gongura",
      title: "An Andhra favourite.",
      copy: "Discover the distinctive, leafy tang of gongura.",
      photo: false,
    },
    {
      id: "chilli",
      title: "A little more fire.",
      copy: "Bold red chilli pickle for the heat seekers.",
      photo: false,
    },
  ];
  const item = slides[slide];
  const product =
    products.find((p) => p.id === item.id) ||
    sampleProducts.find((p) => p.id === item.id)!;
  return (
    <section
      className="reference-hero"
      aria-label="Featured pickles"
      aria-roledescription="carousel"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={item.id}
          className={
            "reference-slide " + (item.photo ? "photo-slide" : "jar-slide")
          }
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.3 }}
        >
          {item.photo ? (
            <img
              src="/images/hero.png"
              alt="Avaruchi mango pickle jar with a bowl of spiced mango and chillies"
              fetchPriority="high"
            />
          ) : (
            <ProductPhoto p={product} className="hero-jar" />
          )}
          <div className="reference-hero-copy">
            <h1>{item.title}</h1>
            <p>{item.copy}</p>
            <Link className="hero-shop-link" href={"/shop/" + item.id}>
              Shop {product.name.toLowerCase()}
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>
      <div
        className="slide-controls"
        role="group"
        aria-label="Choose a featured pickle"
      >
        {slides.map((s, i) => (
          <button
            key={s.id}
            aria-label={"Show " + s.id + " pickle slide"}
            aria-pressed={slide === i}
            onClick={() => setSlide(i)}
          >
            <span />
          </button>
        ))}
      </div>
    </section>
  );
}
function CollectionRow({
  title,
  category,
  products,
  loading,
  onAdd,
  wishlist,
  onWish,
}: {
  title: string;
  category: string;
  products: Product[];
  loading: boolean;
  onAdd: (id: string) => void;
  wishlist: string[];
  onWish: (id: string) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [edges, setEdges] = useState({ start: true, end: false });
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
  }, [loading, products.length]);
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
        <Link
          className="collection-view"
          href={"/shop?category=" + encodeURIComponent(category)}
        >
          View all
        </Link>
      </div>
      {loading ? (
        <Skeleton />
      ) : (
        <div className="collection-rail">
          <button
            className="collection-arrow"
            disabled={edges.start}
            aria-label={"Previous " + title}
            onClick={() => scroll(-1)}
          >
            ‹
          </button>
          <div
            className="collection-track"
            ref={track}
            onScroll={measure}
            tabIndex={0}
            aria-label={title + " products"}
          >
            {products.map((p, i) => (
              <ProductCard
                key={p.id}
                p={p}
                index={i}
                onAdd={onAdd}
                wished={wishlist.includes(p.id)}
                onWish={() => onWish(p.id)}
              />
            ))}
          </div>
          <button
            className="collection-arrow"
            disabled={edges.end}
            aria-label={"Next " + title}
            onClick={() => scroll(1)}
          >
            ›
          </button>
        </div>
      )}
    </section>
  );
}

export default function Storefront({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const view = pageView(pathname);
  const reduceMotion = useReducedMotion();
  const [products, setProducts] = useState<Product[]>(sampleProducts),
    [loading, setLoading] = useState(true),
    [category, setCategory] = useState("All pickles"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("featured");
  const [cart, setCart] = useState<CartItem[]>([]),
    [wishlist, setWishlist] = useState<string[]>([]),
    [address, setAddress] = useState<Address>(blankAddress),
    [ready, setReady] = useState(false),
    [user, setUser] = useState<any>(null),
    [isAdmin, setIsAdmin] = useState(false),
    [config, setConfig] = useState(initialConfig);
  const [panel, setPanel] = useState<"cart" | "checkout" | null>(null),
    [productWeight, setProductWeight] = useState(0),
    [productQty, setProductQty] = useState(1),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [orders, setOrders] = useState<any[]>([]),
    [ordersLoading, setOrdersLoading] = useState(false),
    [requests, setRequests] = useState<any[]>([]),
    [accountTab, setAccountTab] = useState("overview"),
    [orderFilter, setOrderFilter] = useState("all"),
    [orderSearch, setOrderSearch] = useState(""),
    [requestOrder, setRequestOrder] = useState<string | null>(null),
    [success, setSuccess] = useState<any>(null);
  const [couponInput, setCouponInput] = useState(""),
    [appliedCoupon, setAppliedCoupon] = useState(""),
    [quoted, setQuoted] = useState<any>(null),
    [method, setMethod] = useState("demo"),
    [adminData, setAdminData] = useState<any>(null),
    [adminTab, setAdminTab] = useState("overview"),
    [adminSearch, setAdminSearch] = useState(""),
    [adminFilter, setAdminFilter] = useState("all"),
    [adminPage, setAdminPage] = useState(0),
    [inventorySearch, setInventorySearch] = useState(""),
    [expanded, setExpanded] = useState<string | null>(null);
  const checkoutRef = useRef<any>(null);
  const submissionRef = useRef(false);
  const [historyPages, setHistoryPages] = useState<any>({});
  const mergeHistory = (previous: any[], incoming: any[]) => [
    ...new Map([...previous, ...incoming].map((row) => [row.id, row])).values(),
  ];
  const [headerSearch, setHeaderSearch] = useState(false);
  const [headerQuery, setHeaderQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const notify = (message: string) => setToast(message);
  const selected =
    view === "product"
      ? products.find((p) => p.id === pathname.split("/")[2]) || null
      : null;
  const navigate = (next: string, query: Record<string, string> = {}) => {
    setError("");
    setPanel(null);
    const params = new URLSearchParams(query);
    if (next === "checkout" && appliedCoupon)
      params.set("coupon", appliedCoupon);
    const suffix = params.toString();
    router.push(pagePath(next) + (suffix ? "?" + suffix : ""));
  };
  const syncQuery = useCallback(
    (query: string) => {
      const params = new URLSearchParams(query);
      if (view === "account") {
        const tab = params.get("tab");
        if (
          tab &&
          [
            "overview",
            "orders",
            "address",
            "returns",
            "invoices",
            "help",
          ].includes(tab)
        )
          setAccountTab(tab);
        else setAccountTab("overview");
        const order = params.get("order");
        if (order && /^AVR-[A-F0-9]{16}$/.test(order)) {
          setAccountTab("orders");
          setExpanded(order);
          setOrderFilter("all");
          setOrderSearch("");
        }
      }
      if (view === "checkout") {
        const coupon = params.get("coupon") || "";
        setAppliedCoupon(coupon);
        setCouponInput(coupon);
      }
      if (view === "wishlist") {
        setCategory("All pickles");
        setSearch("");
      }
      if (view === "shop") {
        const selectedCategory = params.get("category");
        if (
          selectedCategory &&
          [
            "All pickles",
            "Classics",
            "Andhra favourites",
            "Bold flavours",
          ].includes(selectedCategory)
        )
          setCategory(selectedCategory);
        else setCategory("All pickles");
        setSearch(params.get("search") || "");
      }
    },
    [view],
  );
  useEffect(() => {
    setPanel(null);
    setHeaderSearch(false);
    setError("");
    setProductWeight(0);
    setProductQty(1);
    window.scrollTo(0, 0);
  }, [pathname]);
  async function loadSession() {
    const s = await api("session");
    setUser(s.user);
    setIsAdmin(s.admin);
    setConfig(s.config);
    setMethod(s.config.demo ? "demo" : s.config.payments ? "online" : "cod");
    return s;
  }
  async function refreshProducts() {
    const b = await api("catalog");
    setProducts(b.products);
  }
  async function loadOrders(section?: "orders" | "requests") {
    setOrdersLoading(true);
    try {
      const params = new URLSearchParams();
      if (section === "orders" && historyPages.orders?.next)
        params.set("before", historyPages.orders.next);
      if (section === "requests" && historyPages.requests?.next)
        params.set("requestsBefore", historyPages.requests.next);
      const focus =
        new URLSearchParams(window.location.search).get("order") || expanded;
      if (focus && !section) params.set("focus", focus);
      const b = await api("orders" + (params.size ? "?" + params : ""));
      if (section !== "requests")
        setOrders((prev) =>
          section === "orders" ? mergeHistory(prev, b.orders) : b.orders,
        );
      setRequests((prev) =>
        section
          ? mergeHistory(prev, [...b.requests, ...(b.orderRequests || [])])
          : mergeHistory(b.requests, b.orderRequests || []),
      );
      setHistoryPages((prev: any) =>
        section ? { ...prev, [section]: b.pagination[section] } : b.pagination,
      );
      if (view === "account") clearCheckout();
    } catch (e: any) {
      setError(e.message);
      if (e.status === 401) void loadSession().catch(() => {});
    } finally {
      setOrdersLoading(false);
    }
  }
  async function loadAdmin(section?: "orders" | "requests", focus?: string) {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (section && adminData?.pagination?.[section]?.next)
        params.set(section + "Before", adminData.pagination[section].next);
      if (focus)
        params.set(focus.startsWith("CASE-") ? "case" : "order", focus);
      const b = await api("admin" + (params.size ? "?" + params : ""));
      setAdminData((prev: any) =>
        section && prev
          ? {
              ...b,
              orders:
                section === "orders"
                  ? mergeHistory(prev.orders, b.orders)
                  : prev.orders,
              requests:
                section === "requests"
                  ? mergeHistory(prev.requests, b.requests)
                  : prev.requests,
              operations: mergeHistory(
                prev.operations || [],
                b.operations || [],
              ),
              pagination: {
                ...prev.pagination,
                [section]: b.pagination[section],
              },
            }
          : b,
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let [s, c] = await Promise.all([api("session"), api("catalog")]);
        if (s.config.demo && !s.user) {
          await api("auth/demo", {});
          s = await api("session");
        }
        if (!active) return;
        setUser(s.user);
        setIsAdmin(s.admin);
        setConfig(s.config);
        setMethod(
          s.config.demo ? "demo" : s.config.payments ? "online" : "cod",
        );
        setProducts(c.products);
        let local;
        try {
          local = readStored(localStorage, "avaruchi-basket");
        } catch {
          local = null;
        }
        const saved = safeBasket(s.saved || local);
        setCart(saved.cart || []);
        setWishlist(saved.wishlist || []);
        setAddress({ ...blankAddress, ...saved.address });
        setReady(true);
      } catch (e: any) {
        if (active) setError(e.message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const data = { cart, wishlist, address };
    try {
      writeStored(localStorage, "avaruchi-basket", data);
    } catch {
      /* Storage access is optional. */
    }
    if (!user) return;
    const timer = setTimeout(() => api("saved", data).catch(() => {}), 600);
    return () => clearTimeout(timer);
  }, [cart, wishlist, address, user, ready]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (view === "account" && user) void loadOrders();
    if (view === "admin" && isAdmin) void loadAdmin();
  }, [view, user, isAdmin]);
  useEffect(() => {
    setQuoted(null);
  }, [cart]);
  useEffect(() => {
    if ((view !== "checkout" && !appliedCoupon) || !ready || !cart.length)
      return;
    let active = true;
    setQuoted(null);
    api("quote", { items: cart, coupon: appliedCoupon })
      .then((q) => {
        if (active) setQuoted(q);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [view, ready, cart, appliedCoupon]);
  const cartLines = cart
    .map((x) => {
      const p = products.find((p) =>
        p.variants.some((v) => v.id === x.variantId),
      );
      const v = p?.variants.find((v) => v.id === x.variantId);
      return p && v ? { ...x, p, v } : null;
    })
    .filter(Boolean) as {
    variantId: string;
    quantity: number;
    p: Product;
    v: Product["variants"][0];
  }[];
  const unavailableItems = cart.filter(
    (x) => !cartLines.some((line) => line.variantId === x.variantId),
  );
  const unavailableNotice =
    unavailableItems.length > 0 && !loading ? (
      <div className="form-error" role="alert">
        <p>
          {unavailableItems.length} jar sizes in your bag are no longer
          available.
        </p>
        <button
          type="button"
          className="link-button"
          onClick={() =>
            setCart((prev) =>
              prev.filter(
                (x) =>
                  !unavailableItems.some(
                    (item) => item.variantId === x.variantId,
                  ),
              ),
            )
          }
        >
          Remove unavailable jars
        </button>
      </div>
    ) : null;
  const count = cart.reduce((s, x) => s + x.quantity, 0),
    subtotal = cartLines.reduce((s, x) => s + x.quantity * x.v.price, 0),
    shipping = subtotal >= config.freeShipping ? 0 : config.shippingFee;
  const total = quoted?.total ?? subtotal + shipping;
  function add(id: string, quantity = 1) {
    const p = products.find((p) => p.variants.some((v) => v.id === id)),
      v = p?.variants.find((v) => v.id === id);
    if (!v) return;
    const current = cart.find((x) => x.variantId === id)?.quantity || 0;
    if (current + quantity > Math.min(10, v.stock)) {
      notify(
        "Only " + Math.min(10, v.stock) + " jars of this size can be added.",
      );
      return;
    }
    setCart((prev) =>
      prev.some((x) => x.variantId === id)
        ? prev.map((x) =>
            x.variantId === id ? { ...x, quantity: x.quantity + quantity } : x,
          )
        : [...prev, { variantId: id, quantity }],
    );
    notify(p?.name + " added to your bag.");
  }
  function change(id: string, qty: number) {
    const v = products.flatMap((p) => p.variants).find((v) => v.id === id);
    if (qty > Math.min(10, v?.stock || 0)) {
      notify("That quantity is not available.");
      return;
    }
    setCart((prev) =>
      qty < 1
        ? prev.filter((x) => x.variantId !== id)
        : prev.map((x) => (x.variantId === id ? { ...x, quantity: qty } : x)),
    );
  }
  function wish(id: string) {
    setWishlist((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  async function applyCoupon() {
    setBusy(true);
    setError("");
    try {
      const q = await api("quote", { items: cart, coupon: couponInput });
      setQuoted(q);
      setAppliedCoupon(q.coupon);
      notify("Coupon applied.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function checkout() {
    setError("");
    if (!user) {
      setPanel(null);
      navigate("account");
      return;
    }
    setBusy(true);
    try {
      setQuoted(await api("quote", { items: cart, coupon: appliedCoupon }));
      navigate("checkout");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function clearCheckout() {
    checkoutRef.current = null;
    try {
      writeStored(sessionStorage, "avaruchi-checkout", null);
    } catch {
      /* Optional storage. */
    }
  }
  async function complete(order: any) {
    clearCheckout();
    setAppliedCoupon("");
    setSuccess(order);
    navigate("account");
    setCart([]);
    setPanel(null);
    setQuoted(null);
    setError("");
    setBusy(false);
    void refreshProducts();
    void loadOrders();
  }
  async function payOnline(o: any, keyId: string) {
    if (!keyId || !o.razorpay_id)
      throw new Error(
        "Payment is awaiting store reconciliation. Check your orders before retrying.",
      );
    setBusy(true);
    try {
      const latest = (
        await api("orders?focus=" + encodeURIComponent(o.id))
      ).orders.find((order: any) => order.id === o.id);
      if (!latest) throw new Error("Order not found. Refresh your orders.");
      if (latest.payment === "paid") {
        await complete(latest);
        return;
      }
      if (latest.status !== "pending" || latest.payment !== "unpaid")
        throw new Error(
          "This order is no longer awaiting payment. Refresh your orders.",
        );
      await loadPaymentScript();
      let verifying = false;
      const payment = new (window as any).Razorpay({
        key: keyId,
        amount: latest.total,
        currency: "INR",
        name: "Avaruchi",
        description: "Your pickle order",
        order_id: latest.razorpay_id,
        prefill: {
          name: latest.data.address.name,
          email: user?.email,
          contact: latest.data.address.phone,
        },
        theme: { color: "#264936" },
        handler: async (data: any) => {
          verifying = true;
          try {
            const b = await api("payments/verify", {
              ...data,
              orderId: latest.id,
            });
            await complete(b.order);
          } catch (e: any) {
            navigate("account", { tab: "orders", order: latest.id });
            setError(
              e.message + " Check this order before making another payment.",
            );
            void loadOrders();
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            if (verifying) return;
            setBusy(false);
            navigate("account", { tab: "orders", order: latest.id });
            notify(
              "Payment was not completed. Review this order before retrying.",
            );
          },
        },
      });
      payment.on("payment.failed", () => {
        notify(
          "Payment was not confirmed. Check the gateway message and review your order before retrying.",
        );
        void loadOrders();
      });
      payment.open();
    } catch (e: any) {
      setBusy(false);
      navigate("account", { tab: "orders", order: o.id });
      throw e;
    }
  }
  async function placeOrder(e: FormEvent) {
    e.preventDefault();
    if (submissionRef.current || busy) return;
    submissionRef.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = { items: cart, coupon: appliedCoupon, address, method };
      let previous = checkoutRef.current;
      try {
        previous ||= readStored(sessionStorage, "avaruchi-checkout");
      } catch {
        /* Optional storage. */
      }
      const attempt = checkoutAttempt(previous, user?.id || "", payload);
      attempt.submitted = true;
      checkoutRef.current = attempt;
      try {
        writeStored(sessionStorage, "avaruchi-checkout", attempt);
      } catch {
        /* Optional storage. */
      }
      const b = await api("orders", { ...payload, idempotency: attempt.key });
      if (b.order.status === "cancelled") {
        clearCheckout();
        throw new Error(
          "This checkout was cancelled. Review your basket before placing a new order.",
        );
      }
      if (b.order.payment === "unpaid") await payOnline(b.order, b.keyId);
      else await complete(b.order);
    } catch (e: any) {
      // Validation failures happen before an order is written; allow corrections.
      if (e.status >= 400 && e.status < 500 && ![409, 429].includes(e.status))
        clearCheckout();
      setError(e.message);
      setBusy(false);
    } finally {
      submissionRef.current = false;
    }
  }
  async function cancelOrder(id: string) {
    setBusy(true);
    setError("");
    try {
      await api("orders/" + id, {});
      notify("Order cancelled. Stock has been restored.");
      await loadOrders();
      await refreshProducts();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveAddress(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("saved", { cart, wishlist, address, validateAddress: true });
      notify("Address and mobile number saved to your account.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function submitRequest(e: FormEvent<HTMLFormElement>, orderId: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("returns", {
        orderId,
        kind: f.get("kind"),
        reason: f.get("reason"),
        details: f.get("details"),
      });
      await loadOrders();
      setRequestOrder(null);
      setAccountTab("returns");
      notify("Your request has been sent to the store.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function adminSave(path: string, data: any) {
    setBusy(true);
    setError("");
    try {
      await api("admin/" + path, data);
      notify(
        path === "email"
          ? "Invoice email accepted by the delivery provider."
          : "Changes saved.",
      );
      await loadAdmin(
        undefined,
        typeof data.id === "string" && /^(AVR-|CASE-)/.test(data.id)
          ? data.id
          : undefined,
      );
      await refreshProducts();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const list = products
    .filter(
      (p) =>
        (category === "All pickles" || p.category === category) &&
        (!search ||
          (p.name + " " + p.ingredients)
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (view !== "wishlist" || wishlist.includes(p.id)),
    )
    .sort((a, b) =>
      sort === "price-low"
        ? a.variants[0].price - b.variants[0].price
        : sort === "price-high"
          ? b.variants[0].price - a.variants[0].price
          : sort === "heat"
            ? b.heat - a.heat
            : 0,
    );
  const customerOrders = orders.filter(
    (o) =>
      (orderFilter === "all" ||
        (orderFilter === "active"
          ? !["delivered", "cancelled"].includes(o.status)
          : o.status === orderFilter)) &&
      (!orderSearch ||
        (o.id + " " + o.data.items.map((x: any) => x.name).join(" "))
          .toLowerCase()
          .includes(orderSearch.toLowerCase())),
  );
  const openRequestCount = historyPages.requests?.open || 0;
  const adminOrders = (adminData?.orders || []).filter(
    (o: any) =>
      (adminFilter === "all" || o.status === adminFilter) &&
      (!adminSearch ||
        (o.id + " " + o.data.address.name + " " + o.data.address.city)
          .toLowerCase()
          .includes(adminSearch.toLowerCase())),
  );
  const adminStocks = (adminData?.stocks || []).filter(
    (v: any) =>
      !inventorySearch ||
      (v.id + " " + v.product_id + " " + v.weight)
        .toLowerCase()
        .includes(inventorySearch.toLowerCase()),
  );
  const adminPageCount = Math.max(1, Math.ceil(adminOrders.length / 25));
  const currentAdminPage = Math.min(adminPage, adminPageCount - 1);
  function reorder(o: any) {
    o.data.items.forEach((x: any) => add(x.variantId, x.quantity));
    notify("Available jars added to your bag.");
    setPanel("cart");
  }
  const ShopHeading = view === "home" ? "h2" : "h1";
  const shop = (limit?: number) => (
    <section id="shop" className="shop-section wrap">
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE COLLECTION</span>
          <ShopHeading>
            {view === "wishlist" ? (
              "Your saved flavours."
            ) : view === "shop" ? (
              "Pickles"
            ) : (
              <>
                Meet your meal’s
                <br />
                favourite plus-one.
              </>
            )}
          </ShopHeading>
        </div>
        <div className="section-intro">
          <p>
            From the familiar tang of mango to
            <br className="desktop" /> the bold bite of gongura. Find your jar.
          </p>
          {view === "home" && (
            <Link className="link-button" href={pagePath("shop")}>
              Explore all pickles <span>↗</span>
            </Link>
          )}
        </div>
      </div>
      {view !== "home" && (
        <div className="catalog-tools">
          <div className="search-field">
            <Icon name="search" />
            <input
              ref={searchRef}
              aria-label="Search pickles"
              placeholder="Search a flavour or ingredient"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label>
            Sort by{" "}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort products"
            >
              <option value="featured">Our collection</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="heat">Most heat first</option>
            </select>
          </label>
        </div>
      )}
      <div className="category-row">
        {["All pickles", "Classics", "Andhra favourites", "Bold flavours"].map(
          (c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={category === c ? "active" : ""}
            >
              {c}
            </button>
          ),
        )}
        <span>
          {view === "home"
            ? "8 flavours, endless pairings"
            : list.length + (list.length === 1 ? " flavour" : " flavours")}
        </span>
      </div>
      {loading ? (
        <Skeleton />
      ) : list.length ? (
        <div className="product-grid">
          {(limit ? list.slice(0, limit) : list).map((p, i) => (
            <ProductCard
              key={p.id}
              index={i}
              p={p}
              onAdd={add}
              wished={wishlist.includes(p.id)}
              onWish={() => wish(p.id)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>
            {view === "wishlist"
              ? "A place for your favourites."
              : "No jars found."}
          </h3>
          <p>
            {view === "wishlist"
              ? "Tap the heart on any pickle to save it here."
              : "Try another flavour, ingredient, or category."}
          </p>
          <button
            className="button"
            onClick={() => {
              setSearch("");
              setCategory("All pickles");
              navigate("shop");
            }}
          >
            Browse pickles
          </button>
        </div>
      )}
    </section>
  );
  const addressFields = (
    <div className="address-grid">
      {(
        [
          ["name", "Full name", "name"],
          ["phone", "Mobile number", "tel"],
          ["line1", "House / street address", "address-line1"],
          ["line2", "Apartment / landmark (optional)", "address-line2"],
          ["city", "City", "address-level2"],
          ["state", "State", "address-level1"],
          ["pincode", "PIN code", "postal-code"],
        ] as const
      ).map(([key, label, auto]) => (
        <label
          key={key}
          className={key === "line1" || key === "line2" ? "full" : ""}
        >
          {label}
          <input
            required={key !== "line2"}
            type={key === "phone" ? "tel" : "text"}
            autoComplete={auto}
            value={address[key]}
            onChange={(e) => setAddress({ ...address, [key]: e.target.value })}
            pattern={
              key === "phone"
                ? "[6-9][0-9]{9}"
                : key === "pincode"
                  ? "[1-9][0-9]{5}"
                  : undefined
            }
            inputMode={
              key === "phone" || key === "pincode" ? "numeric" : undefined
            }
            maxLength={key === "phone" ? 10 : key === "pincode" ? 6 : 180}
          />
        </label>
      ))}
    </div>
  );
  const summary = (
    <div className="totals">
      <div>
        <span>Subtotal</span>
        <span>{rupees(quoted?.subtotal ?? subtotal)}</span>
      </div>
      {!!quoted?.discount && (
        <div>
          <span>Discount ({appliedCoupon})</span>
          <span>− {rupees(quoted.discount)}</span>
        </div>
      )}
      <div>
        <span>Delivery</span>
        <span>
          {(quoted?.shipping ?? shipping) === 0
            ? "On us"
            : rupees(quoted?.shipping ?? shipping)}
        </span>
      </div>
      <div className="grand-total">
        <span>Total</span>
        <span>{rupees(total)}</span>
      </div>
      <p>Prices shown in INR. Final totals are verified at checkout.</p>
    </div>
  );
  const pageContent = (
    <>
      {error && !panel && (
        <div className="error-banner wrap" role="alert">
          {error}
          {!ready && (
            <button onClick={() => window.location.reload()}>
              Reload store
            </button>
          )}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      {view === "home" && (
        <>
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
                Warm rice, a crisp dosa, a comforting bowl of dal. There is
                always room for a little pickle.
              </p>
              <strong>
                Free delivery on orders from {rupees(config.freeShipping)}.
              </strong>
              {config.demo && (
                <p className="intro-offer">
                  Try the sample checkout with code PICKLE10. Preview orders
                  only.
                </p>
              )}
            </div>
          </Reveal>
          <CollectionRow
            title="pickles"
            category="All pickles"
            products={products}
            loading={loading}
            onAdd={add}
            wishlist={wishlist}
            onWish={wish}
          />
          <CollectionRow
            title="Andhra favourites"
            category="Andhra favourites"
            products={products.filter(
              (p) => p.category === "Andhra favourites",
            )}
            loading={loading}
            onAdd={add}
            wishlist={wishlist}
            onWish={wish}
          />
          <CollectionRow
            title="bold flavours"
            category="Bold flavours"
            products={products.filter((p) => p.category === "Bold flavours")}
            loading={loading}
            onAdd={add}
            wishlist={wishlist}
            onWish={wish}
          />
          <Reveal as="section" className="reference-story wrap">
            <div>
              <span className="eyebrow">ESTABLISHED {BRAND.established}</span>
              <h2>Avaruchi. A familiar ritual.</h2>
              <p>
                Avaruchi is the pickle brand of {BRAND.legalName}, based in{" "}
                {BRAND.address}. Find pairing notes for warm rice, breakfast and
                everyday lunches.
              </p>
              <Link className="collection-view" href="/journal">
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
          <Faq />
        </>
      )}
      {(view === "shop" || view === "wishlist") && shop()}
      {view === "journal" && (
        <section className="journal wrap">
          <span className="eyebrow">AT THE TABLE</span>
          <h1>A spoonful of possibility.</h1>
          <p className="lead">
            Three everyday pairings to give your pickle a place at the table.
          </p>
          {[
            [
              "01",
              "The comforting rice plate",
              "Start with warm rice and dal. Add a small spoon of mango pickle at the side, and adjust to the heat you like. Keep the pickle separate until the first bite.",
              "mango",
            ],
            [
              "02",
              "The breakfast companion",
              "Serve a little tomato pickle with dosa or idli. Its rich tang makes an easy companion to coconut chutney and sambar.",
              "tomato",
            ],
            [
              "03",
              "The cool and tangy bowl",
              "A small spoon of lemon pickle brings a bright contrast to cool curd rice. Add it at the table so everyone can choose their own amount.",
              "lemon",
            ],
          ].map(([n, title, copy, id]) => (
            <Reveal as="article" className="journal-entry" key={id}>
              <ProductPhoto
                p={products.find((p) => p.id === id) || sampleProducts[0]}
              />
              <div>
                <span className="eyebrow">{n} / A SIMPLE PAIRING</span>
                <h2>{title}</h2>
                <p>{copy}</p>
                <Link className="link-button" href={"/shop/" + id}>
                  Explore the pickle <span>↗</span>
                </Link>
              </div>
            </Reveal>
          ))}
        </section>
      )}
      {view === "account" && (
        <section className="account portal wrap">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR AVARUCHI</span>
              <h1>Your account</h1>
              <p className="portal-intro">
                Orders, delivery details and support, all in one place.
              </p>
            </div>
            {user && (
              <button
                className="link-button"
                onClick={async () => {
                  await api("auth/logout", {});
                  setUser(null);
                  setIsAdmin(false);
                  setOrders([]);
                  setRequests([]);
                  setCart([]);
                  setWishlist([]);
                  setAddress(blankAddress);
                  notify("Signed out.");
                }}
              >
                Sign out
              </button>
            )}
          </div>
          {loading ? (
            <Skeleton />
          ) : !user ? (
            <div className="signin-panel">
              <h2>Sign in with Google</h2>
              <p>
                Keep your delivery details, orders, invoices and requests
                together.
              </p>
              <a
                className={
                  "button google-button " + (!config.google ? "disabled" : "")
                }
                href={config.google ? "/api/auth/google" : "#"}
                aria-disabled={!config.google}
                onClick={(e) => {
                  if (!config.google) e.preventDefault();
                }}
                target="_top"
              >
                <span className="google-letter">G</span>Continue with Google
              </a>
              {!config.google && (
                <p className="muted">
                  Google sign-in will be available when the store opens.
                </p>
              )}
              {config.demo && (
                <button
                  className="button outline"
                  onClick={async () => {
                    await api("auth/demo", {});
                    await loadSession();
                    notify("Preview account ready.");
                  }}
                >
                  Explore a preview account
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="portal-shell">
                <aside className="portal-sidebar">
                  <div className="customer-profile">
                    <span className="profile-avatar">
                      <Icon name="user" />
                    </span>
                    <div>
                      <span>Hello,</span>
                      <strong>
                        {user.kind === "demo" ? "Preview customer" : user.name}
                      </strong>
                      <small>
                        {user.kind === "demo"
                          ? "Avaruchi preview account"
                          : user.email}
                      </small>
                    </div>
                  </div>
                  <nav
                    className="account-tabs"
                    aria-label="Customer account sections"
                  >
                    {[
                      ["overview", "Overview"],
                      ["orders", "Orders"],
                      ["address", "Address & mobile"],
                      ["returns", "Returns & refunds"],
                      ["invoices", "Invoices"],
                      ["help", "Account help"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        className={accountTab === id ? "active" : ""}
                        aria-pressed={accountTab === id}
                        onClick={() => {
                          setAccountTab(id);
                          setError("");
                        }}
                      >
                        <PortalIcon name={id} />
                        <span>{label}</span>
                        {id === "returns" && !!openRequestCount && (
                          <b>{openRequestCount}</b>
                        )}
                      </button>
                    ))}
                    <Link href={pagePath("wishlist")}>
                      <PortalIcon name="wishlist" />
                      <span>Saved flavours</span>
                      <b>{wishlist.length}</b>
                    </Link>
                  </nav>
                  <div className="sidebar-links">
                    <Link href={pagePath("contact")}>Contact the store</Link>
                    <Link href={pagePath("privacy")}>Privacy policy</Link>
                    {isAdmin && (
                      <Link href={pagePath("admin")}>
                        Open seller console ↗
                      </Link>
                    )}
                  </div>
                </aside>
                <div className="portal-main">
                  <Reveal key={accountTab} enter className="account-content">
                    {accountTab === "overview" && (
                      <>
                        <div className="account-section-heading">
                          <div>
                            <h2>Your account at a glance</h2>
                            <p>Choose what you would like to manage.</p>
                          </div>
                          <span className="portal-mode">
                            {config.demo ? "Preview account" : "Google account"}
                          </span>
                        </div>
                        <div className="account-shortcuts">
                          {[
                            [
                              "orders",
                              "Your orders",
                              "Track, reorder or manage your purchases",
                            ],
                            [
                              "address",
                              "Your addresses",
                              "Edit your delivery address and mobile",
                            ],
                            [
                              "returns",
                              "Returns & refunds",
                              "Follow requests and refund updates",
                            ],
                            [
                              "invoices",
                              "Your invoices",
                              "Download numbered order invoices",
                            ],
                            [
                              "wishlist",
                              "Saved flavours",
                              "Find the pickles you want to try next",
                            ],
                            [
                              "help",
                              "Sign-in & support",
                              "Google account details and order help",
                            ],
                          ].map(([id, title, description]) =>
                            id === "wishlist" ? (
                              <Link
                                key={id}
                                className="account-shortcut"
                                href={pagePath("wishlist")}
                              >
                                <PortalIcon name={id} />
                                <span>
                                  <strong>{title}</strong>
                                  <small>{description}</small>
                                </span>
                              </Link>
                            ) : (
                              <button
                                key={id}
                                className="account-shortcut"
                                aria-label={title}
                                onClick={() => setAccountTab(id)}
                              >
                                <PortalIcon name={id} />
                                <span>
                                  <strong>{title}</strong>
                                  <small>{description}</small>
                                </span>
                              </button>
                            ),
                          )}
                        </div>
                        <section className="account-activity">
                          <div className="account-section-heading">
                            <h3>Recent activity</h3>
                            <button
                              className="link-button"
                              onClick={() => setAccountTab("orders")}
                            >
                              View all orders
                            </button>
                          </div>
                          {ordersLoading ? (
                            <Skeleton />
                          ) : !orders.length ? (
                            <div className="activity-empty">
                              <PortalIcon name="orders" />
                              <div>
                                <strong>
                                  You haven’t placed an order yet.
                                </strong>
                                <p>
                                  Your orders and delivery updates will appear
                                  here.
                                </p>
                              </div>
                              <Link
                                className="button outline"
                                href={pagePath("shop")}
                              >
                                Shop pickles
                              </Link>
                            </div>
                          ) : (
                            <div className="recent-order">
                              <div>
                                <span className="eyebrow">{orders[0].id}</span>
                                <strong>
                                  {orders[0].data.items
                                    .map((x: any) => x.name)
                                    .join(", ")}
                                </strong>
                                <p>
                                  {accountDate(orders[0].created)} ·{" "}
                                  {rupees(orders[0].total)}
                                </p>
                              </div>
                              <span className={"status " + orders[0].status}>
                                {orders[0].status}
                              </span>
                              <button
                                className="button outline"
                                onClick={() => {
                                  setAccountTab("orders");
                                  setExpanded(orders[0].id);
                                  setOrderFilter("all");
                                  setOrderSearch("");
                                }}
                              >
                                View order
                              </button>
                            </div>
                          )}
                        </section>
                        <div className="account-contact-strip">
                          <div>
                            <strong>Default delivery contact</strong>
                            <p>
                              {address.name && address.phone
                                ? address.name +
                                  " · " +
                                  address.phone +
                                  " · " +
                                  address.city
                                : "Add your address and mobile number for your next checkout."}
                            </p>
                          </div>
                          <button
                            className="link-button"
                            onClick={() => setAccountTab("address")}
                          >
                            Manage address
                          </button>
                        </div>
                      </>
                    )}
                    {accountTab === "invoices" && (
                      <>
                        <div className="account-section-heading">
                          <div>
                            <h2>Your invoices</h2>
                            <p>
                              Order invoices are generated when your purchase is
                              confirmed.
                            </p>
                          </div>
                        </div>
                        {ordersLoading ? (
                          <Skeleton />
                        ) : !orders.some((o) => o.invoice_id) ? (
                          <div className="empty-state">
                            <PortalIcon name="invoices" />
                            <h3>No invoices yet.</h3>
                            <p>
                              Your confirmed orders will have downloadable
                              invoices here.
                            </p>
                            <button
                              className="button outline"
                              onClick={() => setAccountTab("orders")}
                            >
                              View orders
                            </button>
                          </div>
                        ) : (
                          <div className="table-scroll">
                            <table className="invoice-table">
                              <thead>
                                <tr>
                                  <th>Order</th>
                                  <th>Date</th>
                                  <th>Total</th>
                                  <th>Invoice</th>
                                </tr>
                              </thead>
                              <tbody>
                                {orders
                                  .filter((o) => o.invoice_id)
                                  .map((o) => (
                                    <tr key={o.id}>
                                      <td>
                                        <strong>{o.id}</strong>
                                        <small>{o.status}</small>
                                      </td>
                                      <td>{accountDate(o.created)}</td>
                                      <td>{rupees(o.total)}</td>
                                      <td>
                                        <a
                                          className="small-button"
                                          href={
                                            "/api/invoice/" +
                                            encodeURIComponent(o.id)
                                          }
                                        >
                                          Download PDF
                                        </a>
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                    {accountTab === "orders" && (
                      <>
                        <div className="account-section-heading">
                          <div>
                            <h2>Your orders</h2>
                            <p>
                              Track your jars, download invoices and order your
                              favourites again.
                            </p>
                          </div>
                          <button
                            className="link-button"
                            disabled={ordersLoading || busy}
                            onClick={() => void loadOrders()}
                          >
                            Refresh orders
                          </button>
                        </div>
                        <div className="order-filters">
                          <label>
                            Find an order
                            <input
                              type="search"
                              placeholder="Order number or pickle name"
                              value={orderSearch}
                              onChange={(e) => setOrderSearch(e.target.value)}
                            />
                          </label>
                          <label>
                            Show
                            <select
                              value={orderFilter}
                              onChange={(e) => setOrderFilter(e.target.value)}
                            >
                              <option value="all">All orders</option>
                              <option value="active">In progress</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </label>
                        </div>
                        {ordersLoading ? (
                          <Skeleton />
                        ) : !orders.length ? (
                          <div className="empty-state">
                            <h3>Your first jar is waiting.</h3>
                            <p>
                              Your orders, shipment updates and invoices will
                              appear here.
                            </p>
                            <Link className="button" href={pagePath("shop")}>
                              Browse the collection
                            </Link>
                          </div>
                        ) : !customerOrders.length ? (
                          <div className="empty-state">
                            <h3>No matching orders.</h3>
                            <p>Try another name or choose All orders.</p>
                          </div>
                        ) : (
                          <div className="order-list">
                            {customerOrders.map((o) => (
                              <article className="order-card" key={o.id}>
                                <div className="order-meta">
                                  <div>
                                    <span>ORDER PLACED</span>
                                    <strong>{accountDate(o.created)}</strong>
                                  </div>
                                  <div>
                                    <span>TOTAL</span>
                                    <strong>{rupees(o.total)}</strong>
                                  </div>
                                  <div>
                                    <span>SHIP TO</span>
                                    <strong>{o.data.address.name}</strong>
                                  </div>
                                  <div className="order-number">
                                    <span>ORDER NUMBER</span>
                                    <strong>{o.id}</strong>
                                  </div>
                                </div>
                                <div className="order-summary">
                                  <div className="order-summary-products">
                                    <span className={"status " + o.status}>
                                      {o.status}
                                    </span>
                                    {o.data.items.map((x: any) => {
                                      const p = products.find((p) =>
                                        p.variants.some(
                                          (v) => v.id === x.variantId,
                                        ),
                                      );
                                      return (
                                        <div
                                          className="ordered-product"
                                          key={x.variantId}
                                        >
                                          {p && <ProductPhoto p={p} />}
                                          <div>
                                            <strong>{x.name}</strong>
                                            <p>
                                              {weightLabel(x.weight)} · Quantity{" "}
                                              {x.quantity}
                                            </p>
                                            <span>
                                              {rupees(x.price * x.quantity)}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="order-summary-actions">
                                    <button
                                      className="small-button"
                                      aria-expanded={expanded === o.id}
                                      onClick={() =>
                                        setExpanded(
                                          expanded === o.id ? null : o.id,
                                        )
                                      }
                                    >
                                      {expanded === o.id
                                        ? "Hide details"
                                        : "View order"}
                                    </button>
                                    <button
                                      className="small-button primary"
                                      onClick={() => reorder(o)}
                                    >
                                      Buy again
                                    </button>
                                    {o.invoice_id && (
                                      <a
                                        className="link-button"
                                        href={
                                          "/api/invoice/" +
                                          encodeURIComponent(o.id)
                                        }
                                      >
                                        Invoice PDF
                                      </a>
                                    )}
                                  </div>
                                </div>
                                {expanded === o.id && (
                                  <div className="order-details">
                                    {o.data.demo && (
                                      <p className="note">
                                        Demonstration order. No shipment or
                                        payment is scheduled.
                                      </p>
                                    )}
                                    {o.status === "cancelled" ? (
                                      <p>This order was cancelled.</p>
                                    ) : (
                                      <ol
                                        className="tracking-steps"
                                        aria-label="Order progress"
                                      >
                                        {[
                                          "confirmed",
                                          "packed",
                                          "shipped",
                                          "delivered",
                                        ].map((s, i) => (
                                          <li
                                            key={s}
                                            className={
                                              [
                                                "confirmed",
                                                "packed",
                                                "shipped",
                                                "delivered",
                                              ].indexOf(o.status) >= i
                                                ? "done"
                                                : ""
                                            }
                                          >
                                            <span>{i + 1}</span>
                                            {s}
                                          </li>
                                        ))}
                                      </ol>
                                    )}
                                    <div className="shipment-info">
                                      <h3>Delivery updates</h3>
                                      <dl>
                                        <div>
                                          <dt>Courier</dt>
                                          <dd>
                                            {o.shipment?.courier ||
                                              "Awaiting courier assignment"}
                                          </dd>
                                        </div>
                                        <div>
                                          <dt>Tracking / AWB</dt>
                                          <dd>
                                            {o.tracking ||
                                              "Available after dispatch"}
                                          </dd>
                                        </div>
                                        <div>
                                          <dt>Estimated delivery</dt>
                                          <dd>
                                            {o.shipment?.eta
                                              ? accountDate(
                                                  o.shipment.eta +
                                                    "T12:00:00+05:30",
                                                )
                                              : "Awaiting dispatch estimate"}
                                          </dd>
                                        </div>
                                      </dl>
                                      {o.shipment?.tracking_url && (
                                        <a
                                          className="link-button"
                                          href={o.shipment.tracking_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          Open courier tracking ↗
                                        </a>
                                      )}
                                    </div>
                                    {o.data.items.map((x: any) => (
                                      <div
                                        className="order-item"
                                        key={x.variantId}
                                      >
                                        <span>
                                          {x.name} / {weightLabel(x.weight)} ×{" "}
                                          {x.quantity}
                                        </span>
                                        <span>
                                          {rupees(x.price * x.quantity)}
                                        </span>
                                      </div>
                                    ))}
                                    <div className="order-delivery">
                                      <h3>Delivery address & contact</h3>
                                      <p>
                                        {o.data.address.name}
                                        <br />
                                        {o.data.address.line1}
                                        {o.data.address.line2 && (
                                          <>
                                            <br />
                                            {o.data.address.line2}
                                          </>
                                        )}
                                        <br />
                                        {o.data.address.city},{" "}
                                        {o.data.address.state}{" "}
                                        {o.data.address.pincode}
                                        <br />
                                        Mobile: {o.data.address.phone}
                                      </p>
                                      <p>
                                        Payment:{" "}
                                        {o.payment === "demo"
                                          ? "Preview, no payment collected"
                                          : o.payment === "cod"
                                            ? "Cash on delivery"
                                            : o.payment === "paid"
                                              ? "Paid online"
                                              : "Awaiting payment"}
                                      </p>
                                    </div>
                                    <div className="order-buttons">
                                      {o.invoice_id && (
                                        <a
                                          className="button outline"
                                          href={
                                            "/api/invoice/" +
                                            encodeURIComponent(o.id)
                                          }
                                        >
                                          Download invoice PDF
                                        </a>
                                      )}
                                      {o.status === "pending" &&
                                        !o.razorpay_id && (
                                          <p className="muted">
                                            Payment setup is awaiting store
                                            reconciliation. Contact the store
                                            with this order number before
                                            retrying.
                                          </p>
                                        )}
                                      {o.status === "pending" &&
                                        o.razorpay_id && (
                                          <button
                                            className="button"
                                            disabled={busy}
                                            onClick={() =>
                                              payOnline(o, config.keyId).catch(
                                                (e: any) => setError(e.message),
                                              )
                                            }
                                          >
                                            Continue payment
                                          </button>
                                        )}

                                      {["confirmed", "pending"].includes(
                                        o.status,
                                      ) &&
                                        !["paid", "unpaid"].includes(
                                          o.payment,
                                        ) &&
                                        !o.razorpay_id && (
                                          <button
                                            className="link-button"
                                            disabled={busy}
                                            onClick={() =>
                                              void cancelOrder(o.id)
                                            }
                                          >
                                            Cancel order
                                          </button>
                                        )}
                                      {requests.some(
                                        (x) => x.order_id === o.id,
                                      ) ? (
                                        <button
                                          className="link-button"
                                          onClick={() =>
                                            setAccountTab("returns")
                                          }
                                        >
                                          View return / refund request
                                        </button>
                                      ) : (
                                        o.status === "delivered" && (
                                          <button
                                            className="link-button"
                                            aria-expanded={
                                              requestOrder === o.id
                                            }
                                            onClick={() =>
                                              setRequestOrder(
                                                requestOrder === o.id
                                                  ? null
                                                  : o.id,
                                              )
                                            }
                                          >
                                            Request return or refund
                                          </button>
                                        )
                                      )}
                                    </div>
                                    {requestOrder === o.id &&
                                      !requests.some(
                                        (x) => x.order_id === o.id,
                                      ) && (
                                        <form
                                          className="request-form"
                                          onSubmit={(e) =>
                                            void submitRequest(e, o.id)
                                          }
                                        >
                                          <h3>Tell us what happened</h3>
                                          <p>
                                            The store will review your request
                                            and explain the next steps before a
                                            return or refund is arranged.
                                          </p>
                                          <div className="address-grid">
                                            <label>
                                              Request type
                                              <select name="kind" required>
                                                <option value="return">
                                                  Return request
                                                </option>
                                                <option value="refund">
                                                  Refund request
                                                </option>
                                              </select>
                                            </label>
                                            <label>
                                              Reason
                                              <select name="reason" required>
                                                {Object.entries(
                                                  requestReasons,
                                                ).map(([id, label]) => (
                                                  <option key={id} value={id}>
                                                    {label}
                                                  </option>
                                                ))}
                                              </select>
                                            </label>
                                            <label className="full">
                                              Describe the issue
                                              <textarea
                                                name="details"
                                                required
                                                minLength={10}
                                                maxLength={1200}
                                                rows={4}
                                                placeholder="Include the affected jars and the issue. Do not include bank or card details."
                                              />
                                            </label>
                                          </div>
                                          <button
                                            className="button"
                                            disabled={busy}
                                          >
                                            {busy
                                              ? "Submitting…"
                                              : "Submit request"}
                                          </button>
                                        </form>
                                      )}
                                  </div>
                                )}
                              </article>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {accountTab === "address" && (
                      <div className="saved-address">
                        <span className="eyebrow">DELIVERY DETAILS</span>
                        <h2>Address & mobile number</h2>
                        <p>
                          Your saved details fill the next checkout. Existing
                          orders keep the address used when you placed them.
                        </p>
                        <form onSubmit={(e) => void saveAddress(e)}>
                          {addressFields}
                          <button
                            className="button outline"
                            disabled={busy}
                            type="submit"
                          >
                            {busy ? "Saving…" : "Save address & mobile"}
                          </button>
                        </form>
                        <p className="muted">
                          Your mobile number is for delivery contact. Sign-in
                          uses Google.
                        </p>
                      </div>
                    )}
                    {accountTab === "returns" && (
                      <>
                        <div className="account-section-heading">
                          <div>
                            <h2>Returns & refunds</h2>
                            <p>
                              Follow the store’s review, return progress and
                              refund updates.
                            </p>
                          </div>
                          <button
                            className="link-button"
                            disabled={ordersLoading || busy}
                            onClick={() => void loadOrders()}
                          >
                            Refresh requests
                          </button>
                        </div>
                        <p className="note">
                          For a damaged, incorrect, missing or affected jar,
                          open a delivered order and choose Request return or
                          refund. Keep the packaging. The store may ask for
                          photos through its verified support contact.{" "}
                          <Link href={pagePath("returns")}>
                            Read the returns policy.
                          </Link>
                        </p>
                        {ordersLoading ? (
                          <Skeleton />
                        ) : !requests.length ? (
                          <div className="empty-state">
                            <h3>No requests yet.</h3>
                            <p>
                              Any return or refund you request will be saved
                              here.
                            </p>
                            <button
                              className="button outline"
                              onClick={() => {
                                setAccountTab("orders");
                                setOrderFilter("all");
                              }}
                            >
                              View your orders
                            </button>
                          </div>
                        ) : (
                          <div className="request-list">
                            {requests.map((x) => (
                              <RequestRecord
                                key={x.id}
                                request={x}
                                demo={config.demo}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {["orders", "invoices", "returns"].includes(accountTab) && (
                      <div className="history-pagination">
                        <p>
                          {accountTab === "returns"
                            ? requests.length
                            : orders.length}{" "}
                          records loaded.{" "}
                          {historyPages[
                            accountTab === "returns" ? "requests" : "orders"
                          ]?.total ?? 0}{" "}
                          in your history. Search and filters apply to loaded
                          records.
                        </p>
                        {historyPages[
                          accountTab === "returns" ? "requests" : "orders"
                        ]?.next && (
                          <button
                            className="button outline"
                            disabled={ordersLoading || busy}
                            onClick={() =>
                              void loadOrders(
                                accountTab === "returns"
                                  ? "requests"
                                  : "orders",
                              )
                            }
                          >
                            Load older{" "}
                            {accountTab === "returns" ? "requests" : "orders"}
                          </button>
                        )}
                      </div>
                    )}
                    {accountTab === "help" && (
                      <div className="account-help">
                        <h2>A little help for your order.</h2>
                        <details open>
                          <summary>Change an address or mobile number</summary>
                          <p>
                            Save your details under Address & mobile for future
                            checkouts. For an existing order, contact the store
                            before dispatch and include the order number.
                          </p>
                        </details>
                        <details>
                          <summary>Delivery, cancellation and tracking</summary>
                          <p>
                            Open View order to see progress and courier details.
                            Eligible orders show Cancel order before packing.
                            Online payment cancellations need store review.
                          </p>
                        </details>
                        <details>
                          <summary>Returns and refund updates</summary>
                          <p>
                            Open a delivered order to submit a request. The
                            Returns & refunds section shows dated store
                            responses and the refund reference when the store
                            records a verified refund.
                          </p>
                        </details>
                        <div className="order-buttons">
                          <Link
                            className="button outline"
                            href={pagePath("contact")}
                          >
                            Contact the store
                          </Link>
                          <Link
                            className="link-button"
                            href={pagePath("privacy")}
                          >
                            Privacy policy
                          </Link>
                          <Link
                            className="link-button"
                            href={pagePath("terms")}
                          >
                            Terms of service
                          </Link>
                        </div>
                        {config.demo && (
                          <p className="muted">
                            Preview account ID: <code>{user.id}</code>
                          </p>
                        )}
                      </div>
                    )}
                  </Reveal>
                </div>
              </div>
            </>
          )}
        </section>
      )}
      {view === "admin" && (
        <section className="admin portal seller-console wrap">
          <div className="section-heading">
            <div>
              <span className="eyebrow">AVARUCHI / SELLER CONSOLE</span>
              <h1>Store administration</h1>
            </div>
            <div className="portal-top-actions">
              <span className="portal-mode">
                {config.demo ? "Preview store" : "Live store"}
              </span>
              <Link className="link-button" href={pagePath("account")}>
                Back to account
              </Link>
            </div>
          </div>
          {loading ? (
            <Skeleton />
          ) : !isAdmin ? (
            <div className="empty-state">
              <h2>Administrator sign-in required.</h2>
              <p>
                This area is available only to the configured store
                administrator.
              </p>
              <Link className="button" href={pagePath("account")}>
                Open your account
              </Link>
            </div>
          ) : !adminData ? (
            <Skeleton />
          ) : (
            <div className="portal-shell admin-shell">
              <aside className="portal-sidebar admin-sidebar">
                <div className="seller-profile">
                  <span className="eyebrow">AVARUCHI.COM</span>
                  <strong>Seller workspace</strong>
                  <small>
                    {config.demo ? "Private demo store" : "Store operations"}
                  </small>
                </div>
                <nav className="admin-tabs" aria-label="Seller workspaces">
                  {[
                    ["overview", "Overview"],
                    ["orders", "Orders"],
                    ["returns", "Returns & refunds"],
                    ["inventory", "Inventory"],
                    ["products", "Products"],
                    ["coupons", "Coupons"],
                    ["setup", "Store settings"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={adminTab === id ? "active" : ""}
                      aria-pressed={adminTab === id}
                      onClick={() => {
                        setAdminTab(id);
                        setError("");
                      }}
                    >
                      <PortalIcon name={id} />
                      <span>{label}</span>
                      {id === "returns" && !!adminData.summary.openRequests && (
                        <b>{adminData.summary.openRequests}</b>
                      )}
                    </button>
                  ))}
                </nav>
                <div className="sidebar-links">
                  <Link href={pagePath("shop")}>View storefront ↗</Link>
                  <button
                    className="link-button"
                    disabled={busy}
                    onClick={() => void loadAdmin()}
                  >
                    Refresh store data
                  </button>
                </div>
              </aside>
              <div className="portal-main admin-workspace">
                <div className="workspace-heading">
                  <div>
                    <h2>
                      {
                        (
                          {
                            overview: "Store overview",
                            orders: "Manage orders",
                            returns: "Customer requests",
                            inventory: "Manage inventory",
                            products: "Product catalog",
                            coupons: "Manage coupons",
                            setup: "Store settings",
                          } as Record<string, string>
                        )[adminTab]
                      }
                    </h2>
                    <p>
                      {
                        (
                          {
                            overview:
                              "Your latest orders and the tasks that need attention.",
                            orders:
                              "Search orders, manage fulfilment and download invoices.",
                            returns:
                              "Review returns, record decisions and update refund progress.",
                            inventory:
                              "Keep jar availability and prices accurate.",
                            products:
                              "Manage the product information customers see.",
                            coupons: "Create and manage store discounts.",
                            setup:
                              "Review sign-in, payments, invoicing and shipping setup.",
                          } as Record<string, string>
                        )[adminTab]
                      }
                    </p>
                  </div>
                  <button
                    className="small-button"
                    disabled={busy}
                    onClick={() => void loadAdmin()}
                  >
                    {busy ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
                {config.demo && (
                  <p className="console-notice">
                    Preview store. Orders, shipments and refunds are
                    demonstrations.
                  </p>
                )}
                {adminTab === "overview" && (
                  <>
                    <div className="admin-stats">
                      <div>
                        <span>Orders</span>
                        <strong>{adminData.summary.orders}</strong>
                      </div>
                      <div>
                        <span>Order value</span>
                        <strong>{rupees(adminData.summary.orderValue)}</strong>
                      </div>
                      <div>
                        <span>Jars in stock</span>
                        <strong>
                          {adminData.stocks.reduce(
                            (n: number, v: any) => n + v.stock,
                            0,
                          )}
                        </strong>
                      </div>
                      <div>
                        <span>Open requests</span>
                        <strong>{adminData.summary.openRequests}</strong>
                      </div>
                    </div>
                    <div className="seller-task-list">
                      <h3>Needs attention</h3>
                      {[
                        [
                          "orders",
                          "Orders to pack",
                          adminData.summary.toPack,
                          "Review orders",
                        ],
                        [
                          "returns",
                          "Open customer requests",
                          adminData.summary.openRequests,
                          "Review requests",
                        ],
                        [
                          "inventory",
                          "Jar sizes with low stock",
                          adminData.stocks.filter((v: any) => v.stock <= 5)
                            .length,
                          "Manage inventory",
                        ],
                        [
                          "setup",
                          "Connections awaiting configuration",
                          Object.values(adminData.settings).length &&
                            [
                              "google",
                              "payments",
                              "email",
                              "business",
                              "shiprocket",
                            ].filter((k) => !adminData.settings[k]).length,
                          "Review settings",
                        ],
                      ].map(([id, label, count, action]) => (
                        <div className="seller-task" key={String(id)}>
                          <span>{label}</span>
                          <strong>{count}</strong>
                          <button
                            className="link-button"
                            onClick={() => setAdminTab(String(id))}
                          >
                            {action}
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="seller-recent">
                      <div className="account-section-heading">
                        <h3>Recent orders</h3>
                        <button
                          className="link-button"
                          onClick={() => setAdminTab("orders")}
                        >
                          Manage all orders
                        </button>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Order</th>
                              <th>Customer</th>
                              <th>Status</th>
                              <th>Total</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminData.orders.slice(0, 5).map((o: any) => (
                              <tr key={o.id}>
                                <td>
                                  <button
                                    className="link-button"
                                    onClick={() => {
                                      setAdminTab("orders");
                                      setAdminSearch(o.id);
                                      setAdminFilter("all");
                                      setAdminPage(0);
                                    }}
                                  >
                                    {o.id}
                                  </button>
                                </td>
                                <td>{o.data.address.name}</td>
                                <td>
                                  <span className={"status " + o.status}>
                                    {o.status}
                                  </span>
                                </td>
                                <td>{rupees(o.total)}</td>
                                <td>{accountDate(o.created)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!adminData.orders.length && (
                          <p className="empty-state">
                            No orders yet. New purchases will appear here.
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
                {adminTab === "orders" && (
                  <div className="managed-orders">
                    <div
                      className="admin-filter-tabs"
                      aria-label="Filter store orders"
                    >
                      {[
                        "all",
                        "pending",
                        "confirmed",
                        "packed",
                        "shipped",
                        "delivered",
                        "cancelled",
                      ].map((status) => (
                        <button
                          key={status}
                          className={adminFilter === status ? "active" : ""}
                          aria-pressed={adminFilter === status}
                          onClick={() => {
                            setAdminFilter(status);
                            setAdminPage(0);
                          }}
                        >
                          {status === "all" ? "All orders" : status}
                          <span>
                            {status === "all"
                              ? adminData.orders.length
                              : adminData.orders.filter(
                                  (o: any) => o.status === status,
                                ).length}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="admin-order-toolbar">
                      <p>
                        {adminOrders.length}{" "}
                        {adminOrders.length === 1 ? "order" : "orders"}
                      </p>
                      <label>
                        <span>Find an order</span>
                        <input
                          type="search"
                          value={adminSearch}
                          onChange={(e) => {
                            setAdminSearch(e.target.value);
                            setAdminPage(0);
                          }}
                          placeholder="Order number, customer or city"
                        />
                      </label>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Order / customer</th>
                            <th>Amount</th>
                            <th>Payment</th>
                            <th>Status / tracking</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminOrders
                            .slice(
                              currentAdminPage * 25,
                              (currentAdminPage + 1) * 25,
                            )
                            .map((o: any) => (
                              <tr key={o.id + o.status + (o.tracking || "")}>
                                <td>
                                  <strong>{o.id}</strong>
                                  <br />
                                  {o.data.address.name}
                                  <br />
                                  <small>{o.data.address.city}</small>
                                  <details>
                                    <summary>Delivery details</summary>
                                    <p>
                                      {o.data.address.line1}
                                      <br />
                                      {o.data.address.line2}
                                      <br />
                                      {o.data.address.city},{" "}
                                      {o.data.address.state}{" "}
                                      {o.data.address.pincode}
                                      <br />
                                      {o.data.address.phone}
                                    </p>
                                  </details>
                                  {o.status === "pending" &&
                                    o.payment === "unpaid" &&
                                    !o.razorpay_id &&
                                    !o.data.demo && (
                                      <details>
                                        <summary>
                                          Reconcile payment checkout
                                        </summary>
                                        <p className="muted">
                                          Find the original Razorpay order by
                                          this store receipt. Keep inventory
                                          reserved until its payment is
                                          verified.
                                        </p>
                                        <form
                                          className="shipment-form"
                                          onSubmit={(e) => {
                                            e.preventDefault();
                                            const f = new FormData(
                                              e.currentTarget,
                                            );
                                            void adminSave(
                                              "payment/reconcile",
                                              {
                                                id: o.id,
                                                remoteOrderId:
                                                  f.get("remoteOrderId"),
                                              },
                                            );
                                          }}
                                        >
                                          <label>
                                            Razorpay order ID
                                            <input
                                              name="remoteOrderId"
                                              required
                                              pattern="order_[A-Za-z0-9]+"
                                            />
                                          </label>
                                          <button
                                            className="small-button"
                                            disabled={busy}
                                          >
                                            Reconcile existing checkout
                                          </button>
                                        </form>
                                      </details>
                                    )}
                                  {!["pending", "cancelled"].includes(
                                    o.status,
                                  ) && (
                                    <details
                                      key={
                                        o.id +
                                        "-shipment-" +
                                        (o.shipment?.version || 0)
                                      }
                                      className="shipment-admin"
                                    >
                                      <summary>
                                        Courier & delivery estimate
                                      </summary>
                                      <form
                                        onSubmit={(e) => {
                                          e.preventDefault();
                                          const f = new FormData(
                                            e.currentTarget,
                                          );
                                          void adminSave("shipment", {
                                            id: o.id,
                                            expectedVersion:
                                              o.shipment?.version || 0,
                                            courier: f.get("courier"),
                                            trackingUrl: f.get("trackingUrl"),
                                            eta: f.get("eta"),
                                          });
                                        }}
                                      >
                                        <label>
                                          Courier
                                          <input
                                            name="courier"
                                            maxLength={100}
                                            defaultValue={
                                              o.shipment?.courier || ""
                                            }
                                          />
                                        </label>
                                        <label>
                                          HTTPS tracking link
                                          <input
                                            name="trackingUrl"
                                            type="url"
                                            maxLength={500}
                                            defaultValue={
                                              o.shipment?.tracking_url || ""
                                            }
                                          />
                                        </label>
                                        <label>
                                          Estimated delivery
                                          <input
                                            name="eta"
                                            type="date"
                                            defaultValue={o.shipment?.eta || ""}
                                          />
                                        </label>
                                        <button
                                          className="small-button"
                                          disabled={busy}
                                        >
                                          Save courier details
                                        </button>
                                      </form>
                                    </details>
                                  )}
                                  {!["pending", "cancelled"].includes(
                                    o.status,
                                  ) && (
                                    <details className="shipping-tools">
                                      <summary>Shiprocket tools</summary>
                                      <p className="muted">
                                        {adminData.settings.shiprocket
                                          ? "Use measured packaging. Create the shipment, assign a courier, then request pickup."
                                          : "Configure Shiprocket in the hosting environment to enable live shipments."}
                                      </p>
                                      <p className="muted">
                                        {(adminData.operations || [])
                                          .filter(
                                            (a: any) =>
                                              a.order_id === o.id &&
                                              a.kind.startsWith("shipping"),
                                          )
                                          .map(
                                            (a: any) =>
                                              a.kind.replace("shipping-", "") +
                                              ": " +
                                              a.status,
                                          )
                                          .join(" · ") ||
                                          "No Shiprocket booking yet."}
                                      </p>
                                      <form
                                        className="shipment-form"
                                        onSubmit={(e) => {
                                          e.preventDefault();
                                          const f = new FormData(
                                            e.currentTarget,
                                          );
                                          void adminSave("shipping/create", {
                                            id: o.id,
                                            length: Number(f.get("length")),
                                            breadth: Number(f.get("breadth")),
                                            height: Number(f.get("height")),
                                            weight: Number(f.get("weight")),
                                          });
                                        }}
                                      >
                                        <label>
                                          Length (cm)
                                          <input
                                            name="length"
                                            type="number"
                                            min="0.1"
                                            max="200"
                                            step="0.1"
                                            required
                                            disabled={
                                              !adminData.settings.shiprocket
                                            }
                                          />
                                        </label>
                                        <label>
                                          Breadth (cm)
                                          <input
                                            name="breadth"
                                            type="number"
                                            min="0.1"
                                            max="200"
                                            step="0.1"
                                            required
                                            disabled={
                                              !adminData.settings.shiprocket
                                            }
                                          />
                                        </label>
                                        <label>
                                          Height (cm)
                                          <input
                                            name="height"
                                            type="number"
                                            min="0.1"
                                            max="200"
                                            step="0.1"
                                            required
                                            disabled={
                                              !adminData.settings.shiprocket
                                            }
                                          />
                                        </label>
                                        <label>
                                          Packed weight (kg)
                                          <input
                                            name="weight"
                                            type="number"
                                            min="0.1"
                                            max="50"
                                            step="0.01"
                                            required
                                            disabled={
                                              !adminData.settings.shiprocket
                                            }
                                          />
                                        </label>
                                        <button
                                          className="small-button"
                                          disabled={
                                            busy ||
                                            !adminData.settings.shiprocket ||
                                            o.status !== "packed"
                                          }
                                        >
                                          Create shipment
                                        </button>
                                      </form>
                                      <div className="order-actions">
                                        <button
                                          className="small-button"
                                          disabled={
                                            busy ||
                                            !adminData.settings.shiprocket ||
                                            o.status !== "packed"
                                          }
                                          onClick={() =>
                                            void adminSave("shipping/awb", {
                                              id: o.id,
                                            })
                                          }
                                        >
                                          Assign courier / AWB
                                        </button>
                                        <button
                                          className="small-button"
                                          disabled={
                                            busy ||
                                            !adminData.settings.shiprocket ||
                                            o.status !== "packed"
                                          }
                                          onClick={() =>
                                            void adminSave("shipping/pickup", {
                                              id: o.id,
                                            })
                                          }
                                        >
                                          Request pickup
                                        </button>
                                        <button
                                          className="small-button"
                                          disabled={
                                            busy ||
                                            !adminData.settings.shiprocket ||
                                            !o.tracking
                                          }
                                          onClick={() =>
                                            void adminSave("shipping/sync", {
                                              id: o.id,
                                            })
                                          }
                                        >
                                          Sync delivery
                                        </button>
                                      </div>
                                      {(adminData.operations || []).some(
                                        (a: any) =>
                                          a.id === "shipping-create-" + o.id &&
                                          ["running", "uncertain"].includes(
                                            a.status,
                                          ),
                                      ) && (
                                        <form
                                          className="shipment-form"
                                          onSubmit={(e) => {
                                            e.preventDefault();
                                            const f = new FormData(
                                              e.currentTarget,
                                            );
                                            void adminSave(
                                              "shipping/reconcile",
                                              {
                                                id: o.id,
                                                remoteOrderId: Number(
                                                  f.get("remoteOrderId"),
                                                ),
                                              },
                                            );
                                          }}
                                        >
                                          <p className="muted">
                                            Verify the original booking in
                                            Shiprocket. Do not create another
                                            order.
                                          </p>
                                          <label>
                                            Shiprocket order ID
                                            <input
                                              name="remoteOrderId"
                                              type="number"
                                              min="1"
                                              required
                                            />
                                          </label>
                                          <button
                                            className="small-button"
                                            disabled={busy}
                                          >
                                            Reconcile existing shipment
                                          </button>
                                        </form>
                                      )}
                                    </details>
                                  )}
                                </td>
                                <td>{rupees(o.total)}</td>
                                <td>{o.payment}</td>
                                <td>
                                  <form
                                    id={"order-form-" + o.id}
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      const f = new FormData(e.currentTarget);
                                      void adminSave("order", {
                                        id: o.id,
                                        expectedStatus: o.status,
                                        expectedTracking: o.tracking || "",
                                        status: f.get("status"),
                                        tracking: f.get("tracking"),
                                      });
                                    }}
                                  >
                                    <select
                                      name="status"
                                      disabled={
                                        o.shipment?.provider === "shiprocket"
                                      }
                                      aria-label={"Status for " + o.id}
                                      defaultValue={o.status}
                                    >
                                      {[
                                        o.status,
                                        ...((
                                          {
                                            pending:
                                              !["paid", "unpaid"].includes(
                                                o.payment,
                                              ) && !o.razorpay_id
                                                ? ["cancelled"]
                                                : [],
                                            confirmed: [
                                              "packed",
                                              ...(!["paid", "unpaid"].includes(
                                                o.payment,
                                              ) && !o.razorpay_id
                                                ? ["cancelled"]
                                                : []),
                                            ],
                                            packed: ["shipped"],
                                            shipped: ["delivered"],
                                          } as any
                                        )[o.status] || []),
                                      ].map((s: string) => (
                                        <option key={s}>{s}</option>
                                      ))}
                                    </select>
                                    <input
                                      name="tracking"
                                      disabled={
                                        o.shipment?.provider === "shiprocket"
                                      }
                                      aria-label={"Tracking for " + o.id}
                                      placeholder="Tracking reference"
                                      defaultValue={o.tracking || ""}
                                    />
                                  </form>
                                </td>
                                <td>
                                  <button
                                    disabled={
                                      busy ||
                                      o.shipment?.provider === "shiprocket" ||
                                      ["delivered", "cancelled"].includes(
                                        o.status,
                                      ) ||
                                      (o.status === "pending" &&
                                        (["paid", "unpaid"].includes(
                                          o.payment,
                                        ) ||
                                          !!o.razorpay_id))
                                    }
                                    form={"order-form-" + o.id}
                                    className="small-button"
                                  >
                                    Update
                                  </button>
                                  {o.invoice_id && (
                                    <p>
                                      <a
                                        className="link-button"
                                        href={
                                          "/api/admin/invoice/" +
                                          encodeURIComponent(o.id)
                                        }
                                      >
                                        Download invoice
                                      </a>
                                    </p>
                                  )}
                                  {o.invoice_id && (
                                    <button
                                      type="button"
                                      className="small-button"
                                      disabled={
                                        busy ||
                                        !adminData.settings.email ||
                                        !!o.email_sent ||
                                        o.status === "cancelled"
                                      }
                                      onClick={() =>
                                        void adminSave("email", { id: o.id })
                                      }
                                    >
                                      {o.email_sent
                                        ? "Invoice emailed"
                                        : "Email invoice"}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {!adminOrders.length && (
                      <p className="empty-state">
                        {adminData.orders.length
                          ? "No orders match these filters."
                          : "New orders will appear here."}
                      </p>
                    )}
                    <div className="history-pagination">
                      <p>
                        {adminData.orders.length} of{" "}
                        {adminData.pagination.orders.total} orders loaded.
                        Search and filters apply to loaded orders.
                      </p>
                      {adminData.pagination.orders.next && (
                        <button
                          className="button outline"
                          disabled={busy}
                          onClick={() => void loadAdmin("orders")}
                        >
                          Load older orders
                        </button>
                      )}
                    </div>
                    <div className="table-pagination">
                      <span>
                        Page {currentAdminPage + 1} of {adminPageCount}
                      </span>
                      <button
                        className="small-button"
                        disabled={currentAdminPage === 0}
                        onClick={() => setAdminPage(currentAdminPage - 1)}
                      >
                        Previous
                      </button>
                      <button
                        className="small-button"
                        disabled={currentAdminPage >= adminPageCount - 1}
                        onClick={() => setAdminPage(currentAdminPage + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
                {adminTab === "returns" && (
                  <div className="admin-requests">
                    <h2>Returns & refunds</h2>
                    <p className="note">
                      Review customer requests and approve the amount before
                      processing a refund. When online refund processing is
                      enabled, Razorpay confirms the payout result. Otherwise
                      record a verified provider or COD refund reference. Food
                      returns are never restocked automatically.
                    </p>
                    {!adminData.requests.length ? (
                      <div className="empty-state">
                        <h3>No requests to review.</h3>
                        <p>Requests from delivered orders will appear here.</p>
                      </div>
                    ) : (
                      adminData.requests.map((x: any) => (
                        <div className="admin-request" key={x.id + x.version}>
                          <RequestRecord
                            request={x}
                            demo={adminData.settings.demo}
                          />
                          <p className="request-contact">
                            {x.order_data.address.name} · Mobile:{" "}
                            {x.order_data.address.phone} · Order total:{" "}
                            {rupees(x.total)}
                          </p>
                          {(adminData.operations || []).some(
                            (op: any) =>
                              op.id === "refund-" + x.id &&
                              op.status === "failed",
                          ) && (
                            <p className="note">
                              The provider reports a failed refund. Verify the
                              payment and any alternate refund before recording
                              completion. A second online payout is blocked for
                              this case.
                            </p>
                          )}
                          {x.status === "refund_pending" &&
                            x.payment === "paid" &&
                            adminData.settings.refunds && (
                              <div className="refund-tools">
                                <p>
                                  Approved refund: {rupees(x.refund_amount)}.
                                  This action submits the approved amount to
                                  Razorpay.
                                </p>
                                <button
                                  className="small-button"
                                  disabled={
                                    busy ||
                                    (adminData.operations || []).some(
                                      (a: any) => a.id === "refund-" + x.id,
                                    )
                                  }
                                  onClick={() =>
                                    void adminSave("refund/process", {
                                      id: x.id,
                                      expectedVersion: x.version,
                                    })
                                  }
                                >
                                  Process approved online refund
                                </button>
                                <button
                                  className="small-button"
                                  disabled={
                                    busy ||
                                    !(adminData.operations || []).some(
                                      (a: any) => a.id === "refund-" + x.id,
                                    )
                                  }
                                  onClick={() =>
                                    void adminSave("refund/sync", {
                                      id: x.id,
                                      expectedVersion: x.version,
                                    })
                                  }
                                >
                                  Sync refund result
                                </button>
                              </div>
                            )}
                          {!!requestTransitions(x.kind, x.status).length &&
                            !(adminData.operations || []).some(
                              (a: any) =>
                                a.id === "refund-" + x.id &&
                                a.status !== "failed",
                            ) && (
                              <form
                                className="request-form"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const f = new FormData(e.currentTarget);
                                  void adminSave("return", {
                                    id: x.id,
                                    expectedVersion: x.version,
                                    status: f.get("status"),
                                    note: f.get("note"),
                                    refundAmount: Math.round(
                                      Number(f.get("refundAmount")) * 100,
                                    ),
                                    refundReference:
                                      f.get("refundReference") || "",
                                  });
                                }}
                              >
                                <div className="address-grid">
                                  <label>
                                    Next status
                                    <select name="status" required>
                                      {requestTransitions(x.kind, x.status).map(
                                        (s) => (
                                          <option key={s} value={s}>
                                            {requestStatus[s]}
                                          </option>
                                        ),
                                      )}
                                    </select>
                                  </label>
                                  <label>
                                    Refund amount (₹)
                                    <input
                                      name="refundAmount"
                                      type="number"
                                      min={0}
                                      max={x.total / 100}
                                      step="0.01"
                                      required
                                      defaultValue={x.refund_amount / 100}
                                      readOnly={x.status === "refund_pending"}
                                    />
                                  </label>
                                  {x.status === "refund_pending" && (
                                    <label className="full">
                                      Verified refund reference
                                      <input
                                        name="refundReference"
                                        required
                                        maxLength={180}
                                        placeholder={
                                          adminData.settings.demo
                                            ? "Preview reference"
                                            : "Provider refund or bank transfer reference"
                                        }
                                      />
                                    </label>
                                  )}
                                  <label className="full">
                                    Update visible to the customer
                                    <textarea
                                      name="note"
                                      required
                                      minLength={5}
                                      maxLength={1200}
                                      rows={3}
                                      placeholder="Explain the decision, return instructions or verified refund update."
                                    />
                                  </label>
                                </div>
                                <p className="muted">
                                  Enter a positive amount for Refund pending.
                                  Keep the amount at zero for review, return
                                  handling or a resolution without a refund.
                                </p>
                                <button
                                  className="button outline"
                                  disabled={busy}
                                >
                                  Save customer update
                                </button>
                              </form>
                            )}
                        </div>
                      ))
                    )}
                  </div>
                )}
                {adminTab === "returns" && (
                  <div className="history-pagination">
                    <p>
                      {adminData.requests.length} of{" "}
                      {adminData.pagination.requests.total} requests loaded.
                    </p>
                    {adminData.pagination.requests.next && (
                      <button
                        className="button outline"
                        disabled={busy}
                        onClick={() => void loadAdmin("requests")}
                      >
                        Load older requests
                      </button>
                    )}
                  </div>
                )}
                {adminTab === "inventory" && (
                  <div className="inventory-workspace">
                    <div className="admin-order-toolbar">
                      <p>{adminStocks.length} jar sizes</p>
                      <label>
                        <span>Find inventory</span>
                        <input
                          type="search"
                          value={inventorySearch}
                          onChange={(e) => setInventorySearch(e.target.value)}
                          placeholder="Product or jar size"
                        />
                      </label>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Product / size</th>
                            <th>Price (INR)</th>
                            <th>Stock</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminStocks.map((v: any) => (
                            <tr key={v.id + ":" + v.stock + ":" + v.price}>
                              <td>
                                {
                                  products.find((p) => p.id === v.product_id)
                                    ?.name
                                }
                                <br />
                                <small>{weightLabel(v.weight)}</small>
                              </td>
                              <td>
                                <input
                                  form={"stock-" + v.id}
                                  name="price"
                                  type="number"
                                  step="0.01"
                                  min="1"
                                  max="100000"
                                  defaultValue={v.price / 100}
                                  aria-label={"Price for " + v.id}
                                />
                              </td>
                              <td>
                                <input
                                  form={"stock-" + v.id}
                                  name="stock"
                                  type="number"
                                  min="0"
                                  defaultValue={v.stock}
                                  aria-label={"Stock for " + v.id}
                                />
                              </td>
                              <td>
                                <form
                                  id={"stock-" + v.id}
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    const f = new FormData(e.currentTarget);
                                    void adminSave("stock", {
                                      id: v.id,
                                      expectedStock: v.stock,
                                      expectedPrice: v.price,
                                      price: Math.round(
                                        Number(f.get("price")) * 100,
                                      ),
                                      stock: Number(f.get("stock")),
                                    });
                                  }}
                                >
                                  <button
                                    disabled={busy}
                                    className="small-button"
                                  >
                                    Save
                                  </button>
                                </form>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {adminTab === "products" && (
                  <div className="admin-products">
                    {products.map((p) => (
                      <details key={p.id}>
                        <summary>{p.name}</summary>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void adminSave("product", {
                              id: p.id,
                              ...Object.fromEntries(f),
                            });
                          }}
                        >
                          <label>
                            Product name
                            <input name="name" defaultValue={p.name} required />
                          </label>
                          <label>
                            Description
                            <textarea
                              name="description"
                              defaultValue={p.description}
                              required
                            />
                          </label>
                          <label>
                            Ingredients / allergens
                            <textarea
                              name="ingredients"
                              defaultValue={p.ingredients}
                              required
                            />
                          </label>
                          <label>
                            Serving suggestion
                            <textarea name="pairing" defaultValue={p.pairing} />
                          </label>
                          <button className="button outline" disabled={busy}>
                            Save product
                          </button>
                        </form>
                      </details>
                    ))}
                  </div>
                )}
                {adminTab === "coupons" && (
                  <div className="coupon-admin">
                    <h2>Create or update a coupon</h2>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void adminSave("coupon", {
                          code: f.get("code"),
                          percent: Number(f.get("percent")),
                          minimum: Math.round(Number(f.get("minimum")) * 100),
                          active: f.get("active") === "on",
                        });
                      }}
                    >
                      <label>
                        Code
                        <input
                          name="code"
                          placeholder="PICKLE10"
                          required
                          pattern="[A-Za-z0-9]{3,30}"
                        />
                      </label>
                      <label>
                        Discount %
                        <input
                          name="percent"
                          type="number"
                          min="1"
                          max="50"
                          required
                          defaultValue="10"
                        />
                      </label>
                      <label>
                        Minimum spend (INR)
                        <input
                          name="minimum"
                          type="number"
                          min="0"
                          required
                          defaultValue="499"
                        />
                      </label>
                      <label className="checkbox">
                        <input name="active" type="checkbox" defaultChecked />
                        Active
                      </label>
                      <button className="button" disabled={busy}>
                        Save coupon
                      </button>
                    </form>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>Discount</th>
                            <th>Minimum</th>
                            <th>State</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminData.coupons.map((c: any) => (
                            <tr key={c.code}>
                              <td>{c.code}</td>
                              <td>{c.percent}%</td>
                              <td>{rupees(c.minimum)}</td>
                              <td>{c.active ? "Active" : "Disabled"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {adminTab === "setup" && (
                  <div className="setup-panel">
                    <h2>Store connections</h2>
                    <p className="muted">
                      Single administrator account: <code>{user.id}</code>
                    </p>
                    <p className="muted">
                      Only this account can manage orders, inventory and
                      refunds.
                    </p>
                    {[
                      ["Google sign-in", adminData.settings.google],
                      ["Razorpay payments", adminData.settings.payments],
                      ["Invoice email delivery", adminData.settings.email],
                      ["Business address", adminData.settings.business],
                      ["Shiprocket shipping", adminData.settings.shiprocket],
                    ].map(([label, connected]) => (
                      <div className="setup-row" key={String(label)}>
                        <span>{label}</span>
                        <strong>
                          {connected ? "Configured" : "Awaiting configuration"}
                        </strong>
                      </div>
                    ))}
                    <div className="invoice-queue">
                      <h3>Invoice email queue</h3>
                      <p>
                        {(adminData.invoiceJobs || []).length} invoices awaiting
                        delivery or review.
                      </p>
                      {(adminData.invoiceJobs || []).map((j: any) => (
                        <p key={j.order_id}>
                          {j.order_id} · {j.status} · {j.attempts} attempts
                        </p>
                      ))}
                      <button
                        className="small-button"
                        disabled={busy || !adminData.settings.email}
                        onClick={() => void adminSave("invoice-queue", {})}
                      >
                        Process queued invoices
                      </button>
                      <p className="muted">
                        {adminData.settings.invoiceWorker
                          ? "Invoice worker authentication is configured. Schedule the protected worker endpoint in hosting."
                          : "Configure the invoice worker secret to enable scheduled retries."}
                      </p>
                    </div>
                    <p>
                      Configure credentials securely in the hosting environment.
                      Product prices, verified ingredients, business details,
                      final policies, payment capture, and the public domain
                      must be confirmed before enabling live orders.
                    </p>
                    <p>
                      This store currently runs in{" "}
                      {config.demo ? "demonstration" : "live"} mode.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}
      {["terms", "privacy", "shipping", "returns", "contact"].includes(
        view,
      ) && <Policy type={view} config={config} />}
      {view === "checkout" && (
        <section className="checkout-page wrap">
          <div className="page-heading">
            <span className="eyebrow">YOUR NEXT GOOD MEAL</span>
            <h1>
              A few details.
              <br />
              <em>Then, pickle.</em>
            </h1>
          </div>
          {loading ? (
            <Skeleton />
          ) : !user ? (
            <div className="empty-state">
              <h2>Sign in to place your order.</h2>
              <Link href="/account" className="button">
                Continue with Google
              </Link>
            </div>
          ) : !cart.length ? (
            <div className="empty-state">
              <h2>Your bag is waiting for a jar.</h2>
              <Link href="/shop" className="button">
                Browse the collection
              </Link>
            </div>
          ) : (
            <form onSubmit={placeOrder} className="checkout">
              <div>
                {config.demo && (
                  <p className="note">
                    Demo checkout. Use a sample delivery address. No payment is
                    collected.
                  </p>
                )}
                <h3>Delivery address</h3>
                {addressFields}
                <h3>Payment</h3>
                <div className="payment-options">
                  {config.demo ? (
                    <label>
                      <input type="radio" name="method" checked readOnly />
                      Demo checkout <span>Try the complete order journey</span>
                    </label>
                  ) : (
                    <>
                      {config.payments && (
                        <label>
                          <input
                            type="radio"
                            name="method"
                            checked={method === "online"}
                            onChange={() => setMethod("online")}
                          />
                          UPI / card / netbanking{" "}
                          <span>Secure payment through Razorpay</span>
                        </label>
                      )}
                      {config.cod && (
                        <label>
                          <input
                            type="radio"
                            name="method"
                            checked={method === "cod"}
                            onChange={() => setMethod("cod")}
                          />
                          Cash on delivery{" "}
                          <span>Pay when your order arrives</span>
                        </label>
                      )}
                    </>
                  )}
                </div>
                <label className="checkbox terms-consent">
                  <input type="checkbox" required />I agree to the{" "}
                  <a href="/terms" target="_blank" rel="noreferrer">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="/privacy" target="_blank" rel="noreferrer">
                    Privacy policy
                  </a>
                  .
                </label>
              </div>
              <aside>
                <h3>Your jars</h3>
                {unavailableNotice}
                {cartLines.map((x) => (
                  <div className="checkout-line" key={x.variantId}>
                    <span>
                      {x.p.name}
                      <small>
                        {weightLabel(x.v.weight)} × {x.quantity}
                      </small>
                    </span>
                    <strong>{rupees(x.v.price * x.quantity)}</strong>
                  </div>
                ))}
                {summary}
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="button full-width"
                  disabled={
                    busy ||
                    loading ||
                    !quoted ||
                    !user ||
                    !(config.demo || config.payments || config.cod)
                  }
                >
                  {busy
                    ? "Preparing your order…"
                    : config.demo
                      ? "Place demo order"
                      : method === "cod"
                        ? "Place order"
                        : "Pay " + rupees(total)}
                </button>
                {error && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => navigate("account", { tab: "orders" })}
                  >
                    Review your orders
                  </button>
                )}
                <p className="muted">
                  Your invoice is generated automatically when your order is
                  confirmed.
                </p>
              </aside>
            </form>
          )}
        </section>
      )}
      {view === "product" && !loading && !selected && (
        <section className="empty-state wrap">
          <h1>This jar is unavailable.</h1>
          <p>Browse the current collection for available flavours.</p>
          <Link href="/shop" className="button">
            Shop pickles
          </Link>
        </section>
      )}
      {view === "product" && selected && (
        <section className="product-page wrap">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href="/shop">The collection</Link>
            <span>/</span>
            <span>{selected.name}</span>
          </nav>
          <div className="product-detail">
            <ProductPhoto p={selected} />
            <div>
              <span className="eyebrow">{selected.category}</span>
              <h1>{selected.name}</h1>
              <p className="product-page-subtitle">{selected.subtitle}</p>
              <p>{selected.description}</p>
              <div className="heat">
                <span>HEAT LEVEL</span>
                <span>
                  {Array.from({ length: 4 }, (_, i) => (
                    <i key={i} className={i < selected.heat ? "filled" : ""} />
                  ))}{" "}
                  {selected.heat === 4
                    ? "Fiery"
                    : selected.heat === 3
                      ? "Bold"
                      : "Gentle warmth"}
                </span>
              </div>
              <div className="weight-options">
                {selected.variants.map((v, i) => (
                  <button
                    key={v.id}
                    className={productWeight === i ? "active" : ""}
                    onClick={() => setProductWeight(i)}
                  >
                    {weightLabel(v.weight)}
                  </button>
                ))}
              </div>
              <div className="detail-buy">
                <strong>
                  {rupees(selected.variants[productWeight].price)}
                </strong>
                <div className="quantity">
                  <button
                    aria-label="Decrease quantity"
                    disabled={productQty <= 1}
                    onClick={() => setProductQty(productQty - 1)}
                  >
                    −
                  </button>
                  <span>{productQty}</span>
                  <button
                    aria-label="Increase quantity"
                    disabled={
                      productQty >=
                      Math.min(10, selected.variants[productWeight].stock)
                    }
                    onClick={() => setProductQty(productQty + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                className="button full-width"
                disabled={!selected.variants[productWeight].stock}
                onClick={() =>
                  add(selected.variants[productWeight].id, productQty)
                }
              >
                {selected.variants[productWeight].stock
                  ? "Add to bag"
                  : "Sold out"}{" "}
                <span>+</span>
              </button>
              <details open>
                <summary>What’s in the jar</summary>
                <p>
                  {selected.ingredients}. Contains mustard and sesame. Verify
                  the final label before purchase.
                </p>
              </details>
              <details>
                <summary>Make it a meal</summary>
                <p>{selected.pairing}</p>
              </details>
              <details>
                <summary>Storage & care</summary>
                <p>
                  Use a clean, dry spoon. Keep the lid closed after serving.
                  Follow the final product label for shelf life, batch date, and
                  storage.
                </p>
              </details>
              {config.demo && (
                <p className="muted">
                  Illustrative recipe and packaging. Merchant verification is
                  required before live sales.
                </p>
              )}
            </div>
          </div>

          <div className="product-page-footer">
            <span className="eyebrow">A TABLE WITH ROOM FOR MORE</span>
            <Link href="/shop" className="link-button">
              Discover the collection <span>↗</span>
            </Link>
          </div>
        </section>
      )}
      {view === "story" && <StoryPage onShop={() => navigate("shop")} />}
    </>
  );
  return (
    <MotionConfig reducedMotion="user">
      <div className="reference-store">
        <Suspense fallback={null}>
          <UrlStateSync onChange={syncQuery} />
        </Suspense>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="header-shell">
          <div className="announcement">
            <span>
              Bring home your favourite pickle. Free delivery from{" "}
              {rupees(config.freeShipping)}.
            </span>
          </div>
          <header className="site-header wrap">
            <Link
              className="wordmark reference-brand"
              aria-label="Avaruchi home"
              href="/"
            >
              <BrandMark />
            </Link>
            <nav aria-label="Main navigation">
              <Link className={view === "home" ? "current" : ""} href="/">
                Home
              </Link>
              <details className="products-menu">
                <summary
                  className={
                    view === "shop" || view === "product" ? "current" : ""
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
                  ].map((c) => (
                    <Link
                      key={c}
                      onClick={(e) =>
                        e.currentTarget
                          .closest("details")
                          ?.removeAttribute("open")
                      }
                      href={"/shop?category=" + encodeURIComponent(c)}
                    >
                      {c}
                    </Link>
                  ))}
                </div>
              </details>
              <Link
                className={view === "journal" ? "current" : ""}
                href="/journal"
              >
                Stories
              </Link>
            </nav>
            <div className="header-actions">
              <button
                className="icon-button search-toggle"
                aria-label="Search"
                aria-expanded={headerSearch}
                aria-controls="header-search"
                onClick={() => setHeaderSearch(!headerSearch)}
              >
                <Icon name="search" />
              </button>
              <button
                className="bag-button"
                aria-label={"Open bag, " + count + " jars"}
                onClick={() => {
                  setError("");
                  setPanel("cart");
                }}
              >
                <Icon name="bag" />
                <span className="bag-count">{count}</span>
              </button>
              <Link
                className="icon-button"
                aria-label="Your account"
                href="/account"
              >
                <Icon name="user" />
              </Link>
            </div>
          </header>
          {headerSearch && (
            <form
              className="header-search wrap"
              id="header-search"
              onSubmit={(e) => {
                e.preventDefault();
                setHeaderSearch(false);
                router.push(
                  "/shop?search=" + encodeURIComponent(headerQuery.trim()),
                );
              }}
            >
              <label htmlFor="header-query" className="sr-only">
                Search pickles
              </label>
              <input
                id="header-query"
                autoFocus
                value={headerQuery}
                onChange={(e) => setHeaderQuery(e.target.value)}
                placeholder="Search a flavour or ingredient"
              />
              <button type="submit">Search</button>
              <button
                type="button"
                aria-label="Close search"
                onClick={() => setHeaderSearch(false)}
              >
                ×
              </button>
            </form>
          )}
        </div>
        {config.demo && (
          <div className="preview-notice">
            PREVIEW STORE{" "}
            <span>
              Sample products and prices. Demo orders only. No payments
              collected.
            </span>
          </div>
        )}
        <motion.main
          id="main"
          key={pathname}
          initial={false}
          animate={reduceMotion ? { opacity: 1 } : { opacity: [0.8, 1] }}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: motionEase }}
        >
          <StorePageContext.Provider value={pageContent}>
            {children}
          </StorePageContext.Provider>
        </motion.main>
        <footer
          className={["account", "admin"].includes(view) ? "portal-footer" : ""}
        >
          <div className="footer-main wrap">
            <div className="footer-brand">
              <Link
                className="wordmark reference-brand"
                href={pagePath("home")}
                aria-label="Avaruchi home"
              >
                <BrandMark />
              </Link>
              <p className="business-footer">
                <strong>{BRAND.legalName}</strong>
                <span>{BRAND.address}</span>
                <span>Established {BRAND.established}</span>
                <a href={BRAND.telephoneUrl}>{BRAND.phone}</a>
              </p>
            </div>
            <div>
              <h3>At the table</h3>
              <Link href="/our-story">Our story</Link>
              <Link href={pagePath("shop")}>Shop all pickles</Link>
              <Link href={pagePath("journal")}>Pairing notes</Link>
              <Link href={pagePath("wishlist")}>Saved flavours</Link>
            </div>
            <div>
              <h3>Here to help</h3>
              <Link href={pagePath("account")}>Orders & invoices</Link>
              <Link href={pagePath("shipping")}>Shipping policy</Link>
              <Link href={pagePath("returns")}>Returns & refunds</Link>
              <Link href={pagePath("contact")}>Contact us</Link>
            </div>
            <div>
              <h3>The fine print</h3>
              <Link href={pagePath("terms")}>Terms of Service</Link>
              <Link href={pagePath("privacy")}>Privacy policy</Link>
              {isAdmin && (
                <Link href={pagePath("admin")}>Store administration</Link>
              )}
              <span className="footer-location">
                <a
                  href={BRAND.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp the store
                </a>
              </span>
            </div>
          </div>
          <div className="footer-bottom wrap">
            <span>
              © {new Date().getFullYear()} {BRAND.legalName}. Avaruchi.
            </span>
            <span>
              {config.demo
                ? "Concept photography and sample catalog."
                : "Google sign-in · Secure checkout · Automatic invoices"}
            </span>
          </div>
        </footer>
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast}
              className="toast"
              role="status"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.22 }}
            >
              {toast}
              <button
                aria-label="Dismiss notification"
                onClick={() => setToast("")}
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {panel === "cart" && (
            <Modal
              key="cart"
              title={"Your bag (" + count + ")"}
              drawer
              onClose={() => setPanel(null)}
            >
              {!cart.length ? (
                <div className="empty-state">
                  <h3>A jar would look good here.</h3>
                  <p>Find a flavour you love and add it to your bag.</p>
                  <Link className="button" href={pagePath("shop")}>
                    Browse pickles
                  </Link>
                </div>
              ) : (
                <>
                  {unavailableNotice}
                  <p className="bag-note">
                    {(quoted?.subtotal ?? subtotal) - (quoted?.discount ?? 0) >=
                    config.freeShipping
                      ? "Delivery is on us."
                      : "Add " +
                        rupees(
                          config.freeShipping -
                            ((quoted?.subtotal ?? subtotal) -
                              (quoted?.discount ?? 0)),
                        ) +
                        " more for delivery on us."}
                  </p>
                  <div className="cart-items">
                    {cartLines.map((x) => (
                      <div className="cart-item" key={x.variantId}>
                        <ProductPhoto p={x.p} />
                        <div>
                          <h3>{x.p.name}</h3>
                          <p>
                            {weightLabel(x.v.weight)} · {rupees(x.v.price)}
                          </p>
                          <div className="quantity">
                            <button
                              aria-label={"Decrease " + x.p.name}
                              onClick={() =>
                                change(x.variantId, x.quantity - 1)
                              }
                            >
                              −
                            </button>
                            <span>{x.quantity}</span>
                            <button
                              aria-label={"Increase " + x.p.name}
                              onClick={() =>
                                change(x.variantId, x.quantity + 1)
                              }
                            >
                              +
                            </button>
                          </div>
                          <button
                            className="remove-link"
                            onClick={() => change(x.variantId, 0)}
                          >
                            Remove
                          </button>
                        </div>
                        <strong>{rupees(x.quantity * x.v.price)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="coupon-form">
                    <label className="sr-only" htmlFor="coupon">
                      Coupon code
                    </label>
                    <input
                      id="coupon"
                      placeholder="Have a coupon?"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                    />
                    <button
                      className="small-button"
                      disabled={busy}
                      onClick={applyCoupon}
                    >
                      Apply
                    </button>
                  </div>
                  {config.demo && (
                    <p className="muted">
                      Try PICKLE10 on sample baskets of ₹499 or more.
                    </p>
                  )}
                  {summary}
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                  <button
                    className="button full-width"
                    disabled={busy || loading}
                    onClick={checkout}
                  >
                    {busy ? "Checking your basket…" : "Continue to checkout"}{" "}
                    <span>↗</span>
                  </button>
                  <button
                    className="link-button continue-shop"
                    onClick={() => setPanel(null)}
                  >
                    Keep exploring
                  </button>
                </>
              )}
            </Modal>
          )}
          {success && (
            <Modal
              key="success"
              title="Your table is one jar closer."
              onClose={() => setSuccess(null)}
            >
              <div className="success-content">
                <span className="eyebrow">ORDER CONFIRMED / {success.id}</span>
                <h2>
                  Good things
                  <br />
                  are in your bag.
                </h2>
                <p>
                  {success.data.demo
                    ? "Your demo order is saved. No payment was collected and no shipment is scheduled."
                    : "Your order is confirmed. Follow its progress from your account."}
                </p>
                <div className="success-summary">
                  {success.data.items.map((x: any) => (
                    <p key={x.variantId}>
                      <span>
                        {x.name} · {weightLabel(x.weight)} × {x.quantity}
                      </span>
                      <strong>{rupees(x.price * x.quantity)}</strong>
                    </p>
                  ))}
                  <p>
                    <strong>Total</strong>
                    <strong>{rupees(success.total)}</strong>
                  </p>
                </div>
                <div className="order-buttons">
                  <a className="button" href={"/api/invoice/" + success.id}>
                    Download invoice PDF
                  </a>
                  <button
                    className="button outline"
                    onClick={() => {
                      setSuccess(null);
                      navigate("account", { tab: "orders", order: success.id });
                    }}
                  >
                    Track your order
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
function Faq() {
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
            "Choose a 250 g, 500 g or 1 kg jar in this sample collection. Availability is shown for each size.",
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
function Policy({ type, config }: { type: string; config: any }) {
  const titles: Record<string, string> = {
    terms: "Terms of Service",
    privacy: "Privacy policy",
    shipping: "Shipping policy",
    returns: "Returns & refunds",
    contact: "Let’s talk pickle.",
  };
  const sections: Record<string, [string, string][]> = {
    terms: [
      [
        "Using this store",
        "These terms describe purchases from Avaruchi, operated by Lakshmis Tapasi Treats in Ramanthapur, Hyderabad. In preview mode, products, prices and orders are demonstrations and do not create a supply or payment commitment. Final commercial terms and food-business registration details must be confirmed before live sales.",
      ],
      [
        "Accounts",
        "Customer sign-in uses Google. Keep access to your Google account secure. Provide accurate delivery information and do not misuse the store, attempt unauthorised access, or submit fraudulent orders. There is no SMS or email/password login.",
      ],
      [
        "Products and food information",
        "Read the ingredients, allergens, jar size and storage instructions before purchasing. In this preview, recipes, product photography, packaging and prices are illustrative. Final labels, shelf life and food-business details must be verified by the merchant.",
      ],
      [
        "Prices, payment and confirmation",
        "Prices are displayed in Indian rupees. The checkout shows product charges, discounts and delivery charges before submission. A payment is confirmed only after server verification. Cash on delivery is available only when enabled. Orders remain subject to availability.",
      ],
      [
        "Order changes and cancellation",
        "Unshipped unpaid orders may be cancelled through your account when the cancellation action is available. Paid cancellations and refunds require the store’s approval and payment-provider processing. Orders that have already shipped cannot be cancelled through the account.",
      ],
      [
        "Delivery and returns",
        "The shipping and returns policies form part of these terms. Delivery estimates and courier information must be supplied for live orders. Report damaged, incorrect or missing items through the published support contact.",
      ],
      [
        "Service availability and disputes",
        "We may pause the service to maintain or correct it. Applicable consumer rights are not excluded by these draft terms. Final merchant contact details, governing jurisdiction and dispute-handling arrangements must be completed before launch.",
      ],
    ],
    privacy: [
      [
        "Information this store uses",
        "Google sign-in supplies your Google subject ID, name and verified email. The store retains delivery names, addresses and mobile numbers, saved favourites, basket contents, orders, shipment details, return and refund requests, payment references and invoices. Google access tokens are used only during sign-in and are not stored.",
      ],
      [
        "Why information is used",
        "Account data enables sign-in, order history, saved addresses and wishlists. Delivery information is used to fulfil orders. Payment references verify payments. Invoice data is retained to support records and customer service. Mobile numbers are used for delivery contact; this store does not offer SMS login.",
      ],
      [
        "Payments and service providers",
        "Online payment details are handled by Razorpay when configured. Avaruchi does not store card numbers, CVV or UPI credentials. Hosting stores order records; an invoice email provider sends invoice attachments when configured. Provider use follows their own privacy notices.",
      ],
      [
        "Cookies and local storage",
        "An HTTP-only session cookie maintains your account. A short-lived state cookie protects Google sign-in. Local storage retains your basket and favourites on this device. No marketing tracker or analytics SDK is installed in this version.",
      ],
      [
        "Retention and access",
        "Account records remain until removed under the merchant’s retention process. Order and invoice records may need to be retained for applicable record-keeping obligations. Final retention periods must be documented before launch. You may request access, correction or deletion through the store’s published support contact.",
      ],
      [
        "Security",
        "The service checks account ownership for customer orders and invoices, uses secure session cookies on HTTPS, verifies payment signatures and restricts store administration. Avoid entering real personal information into preview orders.",
      ],
      [
        "Your choices and contact",
        "Signing out clears the account session. You can update your saved address or remove saved flavours. For privacy requests, contact Lakshmis Tapasi Treats on 9932433243 or through the published WhatsApp link. This draft must be reviewed with the merchant’s actual contact details and data practices before accepting real orders.",
      ],
    ],
    shipping: [
      [
        "Coverage and charges",
        "The store is prepared for Indian delivery addresses with six-digit PIN codes. In this preview, delivery is " +
          rupees(config.shippingFee) +
          " below " +
          rupees(config.freeShipping) +
          " after discounts and free at or above that amount. Serviceable PIN codes and live courier coverage must be confirmed before launch.",
      ],
      [
        "Dispatch and tracking",
        "The store records packing, shipping and delivery status, the courier, tracking reference and an estimated delivery date when available. Your account shows the latest saved details. When the merchant enables Shiprocket, the store can book a measured parcel and synchronize its courier updates. Otherwise the store records shipment details manually.",
      ],
      [
        "Delivery estimates",
        "Live dispatch times and courier estimates have not been supplied. Preview orders are never shipped. The merchant must publish confirmed delivery estimates before live sales.",
      ],
      [
        "Address changes and delivery issues",
        "Check your shipping address and mobile number before ordering. Contact the store promptly if an address is incorrect, a parcel is delayed, or items are missing. Address changes may not be possible once a shipment has been handed to the courier.",
      ],
    ],
    returns: [
      [
        "Damaged, incorrect or missing jars",
        "Open the delivered order in Your account and choose Request return or refund. Describe the affected jars and keep the packaging. The store may request clear photos through its verified support contact. For a parcel that has not arrived, contact the store with your order number.",
      ],
      [
        "Food returns",
        "Opened food cannot ordinarily be returned for a change of preference. This draft does not limit remedies for defective, unsafe, damaged or incorrectly supplied goods. The merchant’s reporting window and final procedure must be confirmed before live sales.",
      ],
      [
        "Cancellations",
        "Unpaid orders can be cancelled in your account before packing when the action is available. The system restores reserved stock automatically. For paid orders, contact the store so it can assess cancellation and arrange a refund.",
      ],
      [
        "Refund processing",
        "Your account shows request review, approved returns, refund progress and dated store updates. Approved online refunds must be processed by the merchant through Razorpay. The store records the completed refund reference after verification; the enabled Razorpay refund tool submits only the merchant-approved amount and verifies its result. Cash-on-delivery refunds require the merchant’s separate payment process. The merchant must confirm the reporting window, processing time and cash-on-delivery refund procedure before launch.",
      ],
    ],
    contact: [
      [
        "Order help",
        "Find your order and invoice in Your account. Include the order number when contacting the store.",
      ],
    ],
  };
  return (
    <section className="policy wrap">
      <span className="eyebrow">
        AVARUCHI / {type === "contact" ? "HERE TO HELP" : "THE FINE PRINT"}
      </span>
      <h1>{titles[type]}</h1>
      {config.demo && (
        <p className="note">
          Preview document. Final commercial policies must be confirmed before
          live orders.
        </p>
      )}
      <p className="muted">Last updated: 12 October 2026</p>
      {type === "contact" ? (
        <div className="business-contact">
          <figure className="business-artwork">
            <img
              src={BRAND.logo}
              width={640}
              height={640}
              alt="Avaruchi logo with a traditional pickle jar and Telugu slogan"
            />
          </figure>
          <div className="business-details">
            <span className="eyebrow">ESTABLISHED {BRAND.established}</span>
            <h2>{BRAND.legalName}</h2>
            <p className="business-tagline" lang="te">
              {BRAND.tagline}
            </p>
            <dl>
              <div>
                <dt>Business address</dt>
                <dd>{config.address || BRAND.address}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href={BRAND.telephoneUrl}>{BRAND.phone}</a>
                </dd>
              </div>
              <div>
                <dt>WhatsApp</dt>
                <dd>
                  <a
                    href={BRAND.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {BRAND.phone}
                  </a>
                </dd>
              </div>
            </dl>
            <div className="business-actions">
              <a className="button" href={BRAND.telephoneUrl}>
                Call the store
              </a>
              <a
                className="button outline"
                href={BRAND.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="merchant-identity">
          <strong>Avaruchi is operated by {BRAND.legalName}.</strong>
          <p>
            {config.address || BRAND.address} · Established {BRAND.established}
          </p>
          <a href={BRAND.telephoneUrl}>Call {BRAND.phone}</a>
          <a href={BRAND.whatsappUrl} target="_blank" rel="noopener noreferrer">
            WhatsApp {BRAND.phone}
          </a>
        </div>
      )}
      {sections[type].map(([title, copy]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{copy}</p>
        </section>
      ))}
      {type === "contact" && config.support && (
        <a className="button" href={"mailto:" + config.support}>
          Email support
        </a>
      )}
    </section>
  );
}

function StoryPage({ onShop }: { onShop: () => void }) {
  return (
    <section className="story-page wrap">
      <div className="story-page-intro">
        <span className="eyebrow">THE AVARUCHI IDEA</span>
        <h1>
          Some flavours
          <br />
          feel like <em>coming home.</em>
        </h1>
        <p className="lead">
          A jar at the centre of the table. A little rice on your plate. Someone
          saying, “Have a little more.”
        </p>
        <p className="story-business-line">
          Established in {BRAND.established} · {BRAND.legalName} ·{" "}
          {BRAND.address}
        </p>
        <p className="business-tagline" lang="te">
          {BRAND.tagline}
        </p>
      </div>
      <Reveal as="figure" className="story-wide-photo">
        <img
          src="/images/hero.png"
          alt="Avaruchi mango pickle packaging concept, with raw mango and spices"
        />
        <figcaption>A FAMILIAR FLAVOUR. A NEW PLACE AT THE TABLE.</figcaption>
      </Reveal>
      <div className="story-chapters">
        <Reveal as="article">
          <span className="eyebrow">01 / THE FEELING</span>
          <h2>
            A small spoon.
            <br />A generous table.
          </h2>
          <div>
            <p>
              Avaruchi is a pickle company inspired by the everyday Andhra
              table. Familiar tang, a little heat, and a good meal shared with
              the people around you.
            </p>
            <p>
              Our collection makes room for bold gongura, comforting tomato,
              classic mango and the flavours you reach for again and again.
            </p>
          </div>
        </Reveal>
        <Reveal as="article">
          <span className="eyebrow">02 / THE RITUAL</span>
          <h2>
            For your everyday
            <br />
            favourite meals.
          </h2>
          <div>
            <p>
              Warm rice and ghee. A crisp dosa. The last corner of a paratha.
              You don’t need a special occasion to open a jar.
            </p>
            <p>
              Choose your flavour, find a pairing, and make a little room at the
              table.
            </p>
            <button className="button outline" onClick={onShop}>
              Find your flavour <span>↗</span>
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
