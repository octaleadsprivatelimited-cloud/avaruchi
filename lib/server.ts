import { hasAdministrator } from "./admin-access";
import { storeDatabase, type Statement } from "./database";
import { sampleProducts, type CartItem } from "./catalog";
import { invoicePdf } from "./invoice";
import { requestReasons, requestTransitions } from "./customer";
import { createOperations, shippingReady, providerJson } from "./operations";
const cfg = () => process.env;
const db = storeDatabase;
const demo = () => cfg().DEMO_MODE === "true";
const json = (body: any, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
const fail = (message: string, status = 400): never => {
  throw Object.assign(new Error(message), { status });
};
const now = () => Date.now();
const token = () => crypto.randomUUID() + crypto.randomUUID();
const cookie = (r: Request, k: string) =>
  (r.headers.get("cookie") || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(k + "="))
    ?.slice(k.length + 1);
const setCookie = (r: Request, key: string, value: string, seconds: number) =>
  key +
  "=" +
  value +
  "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" +
  seconds +
  ((cfg().SITE_URL
    ? new URL(cfg().SITE_URL!).protocol
    : new URL(r.url).protocol) === "https:"
    ? "; Secure"
    : "");
const sessionHeaders = (r: Request, value: string) => ({
  "Set-Cookie": setCookie(r, "avr_session", value, 60 * 60 * 24 * 30),
});
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (x) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        x
      ]!,
  );
const b64url = (a: Uint8Array) =>
  btoa(String.fromCharCode(...a))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
let initialized = false;

let lastRateCleanup = 0;
async function rateLimit(scope: string, identity: string, limit: number) {
  const minute = Math.floor(now() / 60000);
  if (lastRateCleanup !== minute) {
    await db().batch([
      db().prepare("DELETE FROM rate_limits WHERE expires<?").bind(now()),
      db().prepare("DELETE FROM sessions WHERE expires<?").bind(now()),
      db().prepare("DELETE FROM oauth_states WHERE expires<?").bind(now()),
    ]);
    lastRateCleanup = minute;
  }
  const hash = b64url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity)),
    ),
  );
  const key = scope + ":" + minute + ":" + hash;
  const r = await db().batch([
    db()
      .prepare(
        "INSERT OR IGNORE INTO rate_limits (id,attempts,expires) VALUES (?,0,?)",
      )
      .bind(key, (minute + 2) * 60000),
    db()
      .prepare("UPDATE rate_limits SET attempts=attempts+1 WHERE id=?")
      .bind(key),
    db().prepare("SELECT attempts FROM rate_limits WHERE id=?").bind(key),
  ]);
  if (r[2].results[0].attempts > limit)
    fail("Too many requests. Please wait a minute and try again.", 429);
}
const operations = createOperations(db, cfg);
async function enqueueInvoice(o: any) {
  if (demo() || JSON.parse(o.data).demo) return;
  await db()
    .prepare(
      "INSERT OR IGNORE INTO invoice_jobs (order_id,status,payload,attempts,first_attempt,next_attempt,lease,updated) SELECT id,'waiting','',0,0,0,'',? FROM orders WHERE id=? AND status!='cancelled' AND EXISTS (SELECT 1 FROM invoices WHERE order_id=orders.id)",
    )
    .bind(now(), o.id)
    .run();
}
async function processInvoiceQueue() {
  if (demo() || !cfg().RESEND_API_KEY || !cfg().INVOICE_FROM_EMAIL)
    fail("Invoice email is not configured for live orders.", 503);
  const due = await db()
    .prepare(
      "SELECT order_id FROM invoice_jobs WHERE status IN ('waiting','sending') AND next_attempt<=? ORDER BY next_attempt LIMIT 2",
    )
    .bind(now())
    .all<any>();
  let sent = 0,
    deferred = 0;
  for (const job of due.results) {
    const o = await db()
      .prepare("SELECT * FROM orders WHERE id=?")
      .bind(job.order_id)
      .first<any>();
    try {
      if (o) {
        await invoiceEmail(o);
        sent++;
      }
    } catch {
      deferred++;
    }
  }
  await db().batch([
    db().prepare("DELETE FROM sessions WHERE expires<?").bind(now()),
    db().prepare("DELETE FROM oauth_states WHERE expires<?").bind(now()),
    db().prepare("DELETE FROM rate_limits WHERE expires<?").bind(now()),
  ]);
  return { sent, deferred };
}
async function completeRefund(x: any, result: any) {
  if (result.status !== "processed") return;
  const history = JSON.parse(x.history);
  history.push({
    status: "resolved",
    note: "Razorpay confirmed the approved refund. Reference: " + result.id,
    at: now(),
  });
  const changed = await db()
    .prepare(
      "UPDATE service_requests SET status='resolved',refund_reference=?,history=?,version=version+1,updated=? WHERE id=? AND version=? AND status='refund_pending' AND refund_amount=?",
    )
    .bind(
      result.id,
      JSON.stringify(history),
      now(),
      x.id,
      x.version,
      result.amount,
    )
    .run();
  if (changed.meta.changes !== 1)
    fail(
      "The case changed while the provider confirmed the refund. Refresh and sync it.",
      409,
    );
}
async function syncShipment(o: any) {
  if (!o.tracking) fail("Assign an AWB before syncing tracking.", 409);
  const details = await operations.tracking(o.id, o.tracking);
  await db().batch([
    db()
      .prepare(
        "UPDATE order_shipments SET courier=?,tracking_url=?,eta=?,version=version+1,updated=? WHERE order_id=? AND provider='shiprocket'",
      )
      .bind(details.courier, details.trackingUrl, details.eta, now(), o.id),
    db()
      .prepare(
        "UPDATE orders SET status=CASE WHEN ?='delivered' AND status IN ('packed','shipped') THEN 'delivered' WHEN ?='shipped' AND status='packed' THEN 'shipped' ELSE status END WHERE id=? AND status!='cancelled'",
      )
      .bind(details.status || "", details.status || "", o.id),
  ]);
}

async function seed() {
  if (initialized) return;
  const statements: Statement[] = [];
  for (const product of sampleProducts) {
    const { variants, ...data } = product;
    statements.push(
      db()
        .prepare(
          "INSERT OR IGNORE INTO products (id,data,active) VALUES (?,?,1)",
        )
        .bind(product.id, JSON.stringify(data)),
    );
    for (const v of variants)
      statements.push(
        db()
          .prepare(
            "INSERT OR IGNORE INTO variants (id,product_id,weight,price,stock) VALUES (?,?,?,?,?)",
          )
          .bind(v.id, product.id, v.weight, v.price, v.stock),
      );
  }
  if (demo())
    statements.push(
      db().prepare(
        "INSERT OR IGNORE INTO coupons (code,percent,minimum,active) VALUES ('PICKLE10',10,49900,1)",
      ),
    );
  await db().batch(statements);
  initialized = true;
}
async function catalog() {
  const [p, v] = await db().batch([
    db().prepare("SELECT * FROM products WHERE active=1"),
    db().prepare("SELECT * FROM variants ORDER BY weight ASC"),
  ]);
  return p.results
    .sort(
      (a: any, b: any) => JSON.parse(a.data).image - JSON.parse(b.data).image,
    )
    .map((x: any) => ({
      ...JSON.parse(x.data),
      variants: v.results.filter((a: any) => a.product_id === x.id),
    }));
}
async function user(r: Request, required = true) {
  const session = cookie(r, "avr_session");
  const found = session
    ? await db()
        .prepare(
          "SELECT users.*,sessions.id session_id FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.id=? AND sessions.expires>?",
        )
        .bind(session, now())
        .first<any>()
    : null;
  if (!found && required) fail("Sign in with Google to continue.", 401);
  return found;
}
function admin(u: any, r: Request) {
  const {
    ADMIN_GOOGLE_SUB,
    ADMIN_DEMO_USER_ID,
    DEMO_MODE,
    DEMO_ADMIN_ENABLED,
  } = cfg();
  return hasAdministrator(u, {
    ADMIN_GOOGLE_SUB,
    ADMIN_DEMO_USER_ID,
    DEMO_MODE,
    DEMO_ADMIN_ENABLED,
  });
}
function csrf(r: Request) {
  const origin = r.headers.get("origin");
  // Hostinger terminates HTTPS at a proxy; Next's internal URL may use a different port.
  // Trust only the configured public origin, never client-supplied forwarding headers.
  const expectedOrigin = cfg().SITE_URL
    ? new URL(cfg().SITE_URL!).origin
    : new URL(r.url).origin;
  if (!origin || origin !== expectedOrigin)
    fail("Request origin rejected.", 403);
}
async function boundedText(r: Request, limit = 30000) {
  if (Number(r.headers.get("content-length") || 0) > limit) {
    await r.body?.cancel().catch(() => {});
    fail("Request too large.", 413);
  }
  const reader = r.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "",
    size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => {});
        fail("Request too large.", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
async function body(r: Request) {
  const text = await boundedText(r);
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    fail("Invalid request body.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("Use a JSON object for this request.");
  return value;
}
function textField(s: any, max = 100) {
  return typeof s === "string" ? s.trim().slice(0, max) : "";
}
async function quote(items: CartItem[], code?: string) {
  if (!Array.isArray(items) || !items.length || items.length > 12)
    fail("Choose between 1 and 12 different jars.");
  const ids = new Set<string>();
  const products = await catalog();
  const lines = [];
  for (const x of items) {
    if (
      !x ||
      typeof x !== "object" ||
      typeof x.variantId !== "string" ||
      ids.has(x.variantId) ||
      !Number.isInteger(x.quantity) ||
      x.quantity < 1 ||
      x.quantity > 10
    )
      fail("Invalid basket quantity.");
    ids.add(x.variantId);
    const p = products.find((p: any) =>
      p.variants.some((v: any) => v.id === x.variantId),
    );
    const v = p?.variants.find((v: any) => v.id === x.variantId);
    if (!p || !v) fail("A product in your basket is no longer available.");
    if (v.stock < x.quantity)
      fail(p.name + " has only " + v.stock + " jars available.");
    lines.push({
      variantId: v.id,
      name: p.name,
      weight: v.weight,
      price: v.price,
      quantity: x.quantity,
    });
  }
  const subtotal = lines.reduce((s, x) => s + x.price * x.quantity, 0);
  const normalized = textField(code, 30).toUpperCase();
  const coupon = normalized
    ? await db()
        .prepare("SELECT * FROM coupons WHERE code=? AND active=1")
        .bind(normalized)
        .first<any>()
    : null;
  if (normalized && !coupon) fail("That coupon is not available.");
  if (coupon && subtotal < coupon.minimum)
    fail(
      "This coupon needs a basket of Rs " + coupon.minimum / 100 + " or more.",
    );
  const discount = coupon ? Math.round((subtotal * coupon.percent) / 100) : 0;
  const shipping =
    subtotal - discount >= Number(cfg().FREE_SHIPPING_THRESHOLD || 69900)
      ? 0
      : Number(cfg().SHIPPING_FEE || 5900);
  return {
    items: lines,
    subtotal,
    discount,
    shipping,
    total: subtotal - discount + shipping,
    coupon: normalized,
  };
}
async function findOrder(id: string, u: any) {
  const o = await db()
    .prepare(
      "SELECT orders.*,invoices.id invoice_id FROM orders LEFT JOIN invoices ON invoices.order_id=orders.id WHERE orders.id=? AND orders.user_id=?",
    )
    .bind(id, u.id)
    .first<any>();
  if (!o) fail("Order not found.", 404);
  return o;
}
function viewOrder(o: any) {
  return { ...o, data: JSON.parse(o.data) };
}

function viewRequest(x: any) {
  return {
    ...x,
    history: JSON.parse(x.history),
    ...(x.order_data ? { order_data: JSON.parse(x.order_data) } : {}),
  };
}
function shipmentInput(b: any) {
  const courier = textField(b.courier, 100),
    trackingUrl = textField(b.trackingUrl, 500),
    eta = textField(b.eta, 10);
  if (trackingUrl) {
    let url: URL;
    try {
      url = new URL(trackingUrl);
    } catch {
      return fail("Use a valid HTTPS courier tracking URL.");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      fail("Use a valid HTTPS courier tracking URL.");
  }
  if (
    eta &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(eta) ||
      !Number.isFinite(Date.parse(eta)) ||
      new Date(eta).toISOString().slice(0, 10) !== eta)
  )
    fail("Enter a valid estimated delivery date.");
  return { courier, trackingUrl, eta };
}

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const a = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)),
  );
  return Array.from(a)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
}
async function razor(path: string, data?: any) {
  const c = cfg();
  return providerJson("https://api.razorpay.com/v1/" + path, {
    method: data ? "POST" : "GET",
    headers: {
      Authorization:
        "Basic " + btoa(c.RAZORPAY_KEY_ID + ":" + c.RAZORPAY_KEY_SECRET),
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}
async function invoiceResponse(o: any) {
  const inv = await db()
    .prepare("SELECT * FROM invoices WHERE order_id=?")
    .bind(o.id)
    .first<any>();
  if (!inv) fail("The invoice is available after order confirmation.", 404);
  return new Response(
    invoicePdf(o, inv, {
      address: cfg().BUSINESS_ADDRESS,
      gst: cfg().GSTIN,
    }) as BodyInit,
    {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="Avaruchi-' + o.id + '.pdf"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
async function invoiceEmail(o: any) {
  if (
    demo() ||
    JSON.parse(o.data).demo ||
    !cfg().RESEND_API_KEY ||
    !cfg().INVOICE_FROM_EMAIL
  )
    fail("Invoice email delivery is not configured for live orders.", 503);
  if (o.email_sent) return { sent: true, alreadySent: true };
  if (o.status === "cancelled")
    fail("Cancelled orders cannot be emailed.", 409);
  await enqueueInvoice(o);
  let job = await db()
    .prepare("SELECT * FROM invoice_jobs WHERE order_id=?")
    .bind(o.id)
    .first<any>();
  if (!job) fail("An invoice is not available for this order yet.", 409);
  if (
    job.status === "review" ||
    (job.first_attempt && now() - job.first_attempt > 23 * 3600000)
  ) {
    await db()
      .prepare(
        "UPDATE invoice_jobs SET status='review',updated=? WHERE order_id=?",
      )
      .bind(now(), o.id)
      .run();
    fail(
      "Email delivery needs provider reconciliation before another send. The safe retry window has elapsed.",
      409,
    );
  }
  if (!job.payload) {
    const u = await db()
      .prepare("SELECT email FROM users WHERE id=?")
      .bind(o.user_id)
      .first<any>();
    const inv = await db()
      .prepare("SELECT * FROM invoices WHERE order_id=?")
      .bind(o.id)
      .first<any>();
    if (!u?.email || !inv)
      fail(
        "A verified customer email and confirmed invoice are required.",
        409,
      );
    const pdf = invoicePdf(o, inv, {
      address: cfg().BUSINESS_ADDRESS,
      gst: cfg().GSTIN,
    });
    const payload = JSON.stringify({
      from: cfg().INVOICE_FROM_EMAIL,
      to: [u.email],
      subject: "Your Avaruchi order " + o.id,
      html: "<h1>Thank you for your order.</h1><p>Your invoice is attached. Track your order in your Avaruchi account.</p>",
      attachments: [
        {
          filename: "Avaruchi-" + o.id + ".pdf",
          content: btoa(String.fromCharCode(...pdf)),
        },
      ],
    });
    await db()
      .prepare(
        "UPDATE invoice_jobs SET payload=? WHERE order_id=? AND payload=''",
      )
      .bind(payload, o.id)
      .run();
  }
  const lease = token();
  const claimed = await db()
    .prepare(
      "UPDATE invoice_jobs SET status='sending',lease=?,first_attempt=CASE WHEN first_attempt=0 THEN ? ELSE first_attempt END,attempts=attempts+1,next_attempt=?,updated=? WHERE order_id=? AND status IN ('waiting','sending') AND next_attempt<=?",
    )
    .bind(lease, now(), now() + 60000, now(), o.id, now())
    .run();
  if (claimed.meta.changes !== 1)
    fail(
      "Invoice email is queued or already being sent. Refresh its status shortly.",
      409,
    );
  job = await db()
    .prepare("SELECT * FROM invoice_jobs WHERE order_id=?")
    .bind(o.id)
    .first<any>();
  try {
    const result = await providerJson("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + cfg().RESEND_API_KEY,
        "Content-Type": "application/json",
        "Idempotency-Key": "invoice-" + o.id,
      },
      body: job.payload,
    });
    if (typeof result.id !== "string" || !result.id)
      fail("Email provider did not confirm an accepted email.", 502);
    await db().batch([
      db().prepare("UPDATE orders SET email_sent=1 WHERE id=?").bind(o.id),
      db()
        .prepare(
          "UPDATE invoice_jobs SET status='sent',lease='',updated=? WHERE order_id=? AND lease=?",
        )
        .bind(now(), o.id, lease),
    ]);
    return { sent: true, alreadySent: false };
  } catch (e) {
    await db()
      .prepare(
        "UPDATE invoice_jobs SET status='waiting',lease='',next_attempt=?,updated=? WHERE order_id=? AND lease=?",
      )
      .bind(
        now() + Math.min(3600000, 60000 * 2 ** Math.min(job.attempts, 6)),
        now(),
        o.id,
        lease,
      )
      .run();
    throw e;
  }
}
async function confirmPayment(o: any, paymentId: string) {
  await db().batch([
    db()
      .prepare(
        "UPDATE orders SET payment='paid',payment_id=?,status=CASE WHEN status='pending' THEN 'confirmed' ELSE status END WHERE id=? AND status!='cancelled' AND (payment_id IS NULL OR payment_id=?)",
      )
      .bind(paymentId, o.id, paymentId),
    db()
      .prepare(
        "INSERT OR IGNORE INTO invoices (order_id,created) SELECT id,? FROM orders WHERE id=? AND payment='paid' AND status!='cancelled'",
      )
      .bind(now(), o.id),
  ]);
  const fresh = await db()
    .prepare("SELECT * FROM orders WHERE id=?")
    .bind(o.id)
    .first<any>();
  await enqueueInvoice(fresh);
  await invoiceEmail(fresh).catch(() => {});
}
async function cancelAndRestore(id: string, allowUnpaid = false) {
  await db().transaction(async (tx) => {
    // Serialize cancellation for the order before touching its inventory.
    const order = await tx
      .prepare(
        "SELECT status,payment,razorpay_id FROM orders WHERE id=? FOR UPDATE",
      )
      .bind(id)
      .first<any>();
    if (!order || !["pending", "confirmed"].includes(order.status))
      fail("This order changed and cannot be cancelled.", 409);
    if (
      order.razorpay_id ||
      !(
        ["cod", "demo"].includes(order.payment) ||
        (allowUnpaid && order.payment === "unpaid")
      )
    )
      fail("Reconcile the online payment before cancelling.", 409);
    await tx
      .prepare(
        "UPDATE variants SET stock=stock+(SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id=? AND variant_id=variants.id) WHERE id IN (SELECT variant_id FROM order_items WHERE order_id=?)",
      )
      .bind(id, id)
      .run();
    await tx
      .prepare("UPDATE orders SET status='cancelled' WHERE id=?")
      .bind(id)
      .run();
  });
}
export async function handle(
  request: Request,
  path: string,
): Promise<Response> {
  try {
    if (!demo()) {
      let publicUrl: URL;
      try {
        publicUrl = new URL(cfg().SITE_URL || "");
      } catch {
        fail("Configure the store's public HTTPS URL before live mode.", 503);
      }
      if (
        publicUrl!.protocol !== "https:" ||
        publicUrl!.username ||
        publicUrl!.password ||
        publicUrl!.pathname !== "/" ||
        publicUrl!.search ||
        publicUrl!.hash
      )
        fail("Configure a canonical HTTPS site origin before live mode.", 503);
      for (const key of ["SHIPPING_FEE", "FREE_SHIPPING_THRESHOLD"])
        if (
          cfg()[key] !== undefined &&
          (!Number.isSafeInteger(Number(cfg()[key])) ||
            Number(cfg()[key]) < 0 ||
            Number(cfg()[key]) > 10000000)
        )
          fail("Store shipping settings need correction.", 503);
    }
    if (!["GET", "POST"].includes(request.method))
      return json({ error: "Method not allowed." }, 405, {
        Allow: "GET, POST",
      });
    if (path === "health" && request.method === "GET") {
      await db().prepare("SELECT 1 healthy").first();
      return json({ ok: true });
    }
    if (path === "jobs/invoices" && request.method === "POST") {
      if (
        !cfg().CRON_SECRET ||
        cfg().CRON_SECRET!.length < 32 ||
        !equal(
          request.headers.get("authorization") || "",
          "Bearer " + cfg().CRON_SECRET,
        )
      )
        fail("Worker authentication required.", 401);
      return json(await processInvoiceQueue());
    }
    if (path === "delivery-events" && request.method === "POST") {
      if (!shippingReady(cfg()) || demo())
        fail("Courier events are not configured.", 503);
      if (
        !equal(
          request.headers.get("x-api-key") || "",
          cfg().SHIPROCKET_WEBHOOK_TOKEN!,
        )
      )
        fail("Courier event authentication failed.", 401);
      const event = await body(request);
      if (
        typeof event.awb !== "string" ||
        !/^[A-Za-z0-9-]{4,100}$/.test(event.awb)
      )
        fail("Invalid courier event.");
      const matches = await db()
        .prepare(
          "SELECT orders.* FROM orders JOIN order_shipments ON order_shipments.order_id=orders.id WHERE orders.tracking=? AND order_shipments.provider='shiprocket'",
        )
        .bind(event.awb)
        .all<any>();
      if (matches.results.length > 1)
        fail(
          "Ambiguous courier reference. Merchant reconciliation required.",
          409,
        );
      if (matches.results[0]) await syncShipment(matches.results[0]); // Re-read authoritative tracking; never trust webhook status or replay ordering.
      return json({ received: true });
    }
    if (path === "webhook" && request.method === "POST") {
      if (!cfg().RAZORPAY_WEBHOOK_SECRET)
        return json({ error: "Webhook is not configured." }, 503);
      const raw = await boundedText(request, 300000);
      if (
        !equal(
          await hmac(cfg().RAZORPAY_WEBHOOK_SECRET!, raw),
          request.headers.get("x-razorpay-signature") || "",
        )
      )
        return json({ error: "Invalid signature." }, 401);
      let event;
      try {
        event = JSON.parse(raw);
      } catch {
        fail("Invalid webhook body.");
      }
      const p = event.payload?.payment?.entity;
      if (event.event === "payment.captured" && p) {
        const o = await db()
          .prepare("SELECT * FROM orders WHERE razorpay_id=?")
          .bind(p.order_id)
          .first<any>();
        if (
          o &&
          typeof p.id === "string" &&
          p.status === "captured" &&
          p.amount === o.total &&
          p.currency === "INR"
        )
          await confirmPayment(o, p.id);
      }
      const refundEvent = event.payload?.refund?.entity;
      if (
        ["refund.processed", "refund.failed"].includes(event.event) &&
        refundEvent &&
        typeof refundEvent.payment_id === "string" &&
        cfg().RAZORPAY_REFUNDS_ENABLED === "true" &&
        !demo()
      ) {
        const rows = await db()
          .prepare(
            "SELECT service_requests.* FROM service_requests JOIN orders ON orders.id=service_requests.order_id WHERE service_requests.status='refund_pending' AND orders.payment_id=?",
          )
          .bind(refundEvent.payment_id)
          .all<any>();
        for (const x of rows.results) {
          const operation = await db()
            .prepare("SELECT data FROM provider_operations WHERE id=?")
            .bind("refund-" + x.id)
            .first<any>();
          if (!operation || JSON.parse(operation.data).id !== refundEvent.id)
            continue;
          const o = await db()
            .prepare("SELECT * FROM orders WHERE id=?")
            .bind(x.order_id)
            .first<any>();
          await completeRefund(x, await operations.syncRefund(x, o));
        }
      }
      return json({ received: true });
    }
    if (request.method !== "GET") csrf(request);
    if (path.startsWith("auth/"))
      await rateLimit("authentication", "store", 120);
    if (path === "quote")
      await rateLimit(
        "quote",
        cookie(request, "avr_session") || "anonymous",
        120,
      );
    await seed();
    if (path === "catalog" && request.method === "GET")
      return json({ products: await catalog() });
    if (path === "session" && request.method === "GET") {
      const u = await user(request, false);
      const c = cfg();
      const saved = u
        ? await db()
            .prepare("SELECT data FROM saved_data WHERE user_id=?")
            .bind(u.id)
            .first<any>()
        : null;
      return json({
        user: u
          ? { id: u.id, name: u.name, email: u.email, kind: u.kind }
          : null,
        admin: admin(u, request),
        saved: saved ? JSON.parse(saved.data) : null,
        config: {
          demo: demo(),
          google: !!(c.GOOGLE_CLIENT_ID && c.GOOGLE_CLIENT_SECRET),
          payments: !!(
            c.RAZORPAY_KEY_ID &&
            c.RAZORPAY_KEY_SECRET &&
            c.RAZORPAY_WEBHOOK_SECRET
          ),
          keyId: c.RAZORPAY_KEY_ID || "",
          cod: c.COD_ENABLED !== "false",
          address: c.BUSINESS_ADDRESS || "",
          gst: c.GSTIN || "",
          support: c.SUPPORT_EMAIL || "",
          shippingFee: Number(c.SHIPPING_FEE || 5900),
          freeShipping: Number(c.FREE_SHIPPING_THRESHOLD || 69900),
        },
      });
    }
    if (path === "auth/demo" && request.method === "POST") {
      if (!demo()) fail("Demo account is disabled.", 403);
      const id = "demo:" + crypto.randomUUID(),
        s = token();
      await db().batch([
        db()
          .prepare(
            "INSERT INTO users (id,name,kind) VALUES (?,'Preview customer','demo')",
          )
          .bind(id),
        db()
          .prepare("INSERT INTO sessions (id,user_id,expires) VALUES (?,?,?)")
          .bind(s, id, now() + 30 * 86400000),
      ]);
      return json({ ok: true }, 200, sessionHeaders(request, s));
    }
    if (path === "auth/logout" && request.method === "POST") {
      await db()
        .prepare("DELETE FROM sessions WHERE id=?")
        .bind(cookie(request, "avr_session") || "")
        .run();
      return json({ ok: true }, 200, {
        "Set-Cookie": setCookie(request, "avr_session", "", 0),
      });
    }
    if (path === "auth/google" && request.method === "GET") {
      const c = cfg();
      if (!c.GOOGLE_CLIENT_ID || !c.GOOGLE_CLIENT_SECRET)
        return Response.redirect(
          new URL("/account?auth=unavailable", cfg().SITE_URL || request.url),
          302,
        );
      const state = token(),
        verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
      const challenge = b64url(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(verifier),
          ),
        ),
      );
      await db().batch([
        db().prepare("DELETE FROM oauth_states WHERE expires<?").bind(now()),
        db()
          .prepare(
            "INSERT INTO oauth_states (id,verifier,expires) VALUES (?,?,?)",
          )
          .bind(state, verifier, now() + 600000),
      ]);
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: c.GOOGLE_CLIENT_ID!,
        redirect_uri:
          (c.SITE_URL || new URL(request.url).origin) +
          "/api/auth/google/callback",
        response_type: "code",
        scope: "openid email profile",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
        prompt: "select_account",
      }).toString();
      return new Response(null, {
        status: 302,
        headers: {
          Location: url.href,
          "Set-Cookie": setCookie(request, "avr_oauth_state", state, 600),
          "Cache-Control": "no-store",
        },
      });
    }
    if (path === "auth/google/callback" && request.method === "GET") {
      const params = new URL(request.url).searchParams,
        state = params.get("state"),
        code = params.get("code");
      if (!state || !code || state !== cookie(request, "avr_oauth_state"))
        fail("Google sign-in was cancelled or expired.", 401);
      const c = cfg();
      if (!c.GOOGLE_CLIENT_ID || !c.GOOGLE_CLIENT_SECRET)
        fail("Google sign-in is not configured.", 503);
      const stored = await db().transaction(async (tx) => {
        const stateRecord = await tx
          .prepare(
            "SELECT verifier FROM oauth_states WHERE id=? AND expires>? FOR UPDATE",
          )
          .bind(state, now())
          .first<any>();
        if (stateRecord)
          await tx
            .prepare("DELETE FROM oauth_states WHERE id=?")
            .bind(state)
            .run();
        return stateRecord;
      });
      if (!stored) fail("Sign-in session expired. Please try again.", 401);
      const tokens = await providerJson("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: c.GOOGLE_CLIENT_ID!,
          client_secret: c.GOOGLE_CLIENT_SECRET!,
          code: code!,
          code_verifier: stored.verifier,
          grant_type: "authorization_code",
          redirect_uri:
            (c.SITE_URL || new URL(request.url).origin) +
            "/api/auth/google/callback",
        }),
      });
      if (typeof tokens.access_token !== "string" || !tokens.access_token)
        fail("Google sign-in failed.", 401);
      const info = await providerJson(
        "https://openidconnect.googleapis.com/v1/userinfo",
        { headers: { Authorization: "Bearer " + tokens.access_token } },
      );
      if (
        typeof info.sub !== "string" ||
        !/^[A-Za-z0-9_-]{1,120}$/.test(info.sub) ||
        info.email_verified !== true ||
        typeof info.email !== "string" ||
        info.email.length > 320
      )
        fail("Use a verified Google account.", 401);
      const uid = "google:" + info.sub,
        s = token();
      await db().batch([
        db()
          .prepare(
            "INSERT INTO users (id,email,name,kind) VALUES (?,?,?,'google') ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name",
          )
          .bind(uid, info.email, textField(info.name || info.email)),
        db()
          .prepare("INSERT INTO sessions (id,user_id,expires) VALUES (?,?,?)")
          .bind(s, uid, now() + 30 * 86400000),
      ]);
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/account",
          "Set-Cookie": setCookie(request, "avr_session", s, 30 * 86400),
          "Cache-Control": "no-store",
        },
      });
    }
    if (path === "quote" && request.method === "POST") {
      const b = await body(request);
      return json(await quote(b.items, b.coupon));
    }
    const u = await user(request);
    if (request.method === "POST")
      await rateLimit(
        path === "orders" ? "checkout" : "write",
        u.id,
        path === "orders" ? 20 : 180,
      );
    if (path === "saved" && request.method === "POST") {
      const b = await body(request);
      const cart = Array.isArray(b.cart)
        ? b.cart
            .slice(0, 12)
            .filter(
              (x: any) =>
                x &&
                typeof x === "object" &&
                typeof x.variantId === "string" &&
                Number.isInteger(x.quantity) &&
                x.quantity > 0 &&
                x.quantity <= 10,
            )
        : [];
      const wishlist = Array.isArray(b.wishlist)
        ? b.wishlist
            .filter((x: any) => sampleProducts.some((p) => p.id === x))
            .slice(0, 20)
        : [];
      const data = {
        cart,
        wishlist,
        address: b.address
          ? {
              name: textField(b.address.name),
              phone: textField(b.address.phone, 15),
              line1: textField(b.address.line1, 180),
              line2: textField(b.address.line2, 180),
              city: textField(b.address.city),
              state: textField(b.address.state),
              pincode: textField(b.address.pincode, 6),
            }
          : null,
      };
      if (b.validateAddress === true) {
        const a = data.address;
        if (
          !a ||
          a.name.length < 2 ||
          a.line1.length < 5 ||
          !a.city ||
          !a.state ||
          !/^[6-9][0-9]{9}$/.test(a.phone) ||
          !/^[1-9][0-9]{5}$/.test(a.pincode)
        )
          fail(
            "Enter a complete address, valid 10-digit mobile number and 6-digit PIN code.",
          );
      }
      await db()
        .prepare(
          "INSERT INTO saved_data (user_id,data) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data",
        )
        .bind(u.id, JSON.stringify(data))
        .run();
      return json({ ok: true });
    }
    if (path === "orders" && request.method === "GET") {
      const result = await db()
        .prepare(
          "SELECT orders.*,invoices.id invoice_id FROM orders LEFT JOIN invoices ON invoices.order_id=orders.id WHERE orders.user_id=? ORDER BY orders.created DESC LIMIT 100",
        )
        .bind(u.id)
        .all<any>();
      const [shipments, requests] = await db().batch([
        db()
          .prepare(
            "SELECT order_shipments.* FROM order_shipments JOIN orders ON orders.id=order_shipments.order_id WHERE orders.user_id=?",
          )
          .bind(u.id),
        db()
          .prepare(
            "SELECT * FROM service_requests WHERE user_id=? ORDER BY created DESC LIMIT 100",
          )
          .bind(u.id),
      ]);
      return json({
        orders: result.results.map((o: any) => ({
          ...viewOrder(o),
          shipment:
            shipments.results.find((s: any) => s.order_id === o.id) || null,
        })),
        requests: requests.results.map(viewRequest),
      });
    }
    if (path === "orders" && request.method === "POST") {
      const b = await body(request);
      if (
        typeof b.idempotency !== "string" ||
        !/^[A-Za-z0-9_-]{8,100}$/.test(b.idempotency)
      )
        fail("Checkout session missing.");
      const old = await db()
        .prepare(
          "SELECT orders.*,invoices.id invoice_id FROM orders LEFT JOIN invoices ON invoices.order_id=orders.id WHERE user_id=? AND idempotency=?",
        )
        .bind(u.id, b.idempotency)
        .first<any>();
      if (old) {
        const previous = JSON.parse(old.data);
        if (
          JSON.stringify(
            previous.items.map((x: any) => ({
              variantId: x.variantId,
              quantity: x.quantity,
            })),
          ) !== JSON.stringify(b.items) ||
          previous.coupon !== textField(b.coupon, 30).toUpperCase() ||
          b.method !==
            (old.payment === "cod"
              ? "cod"
              : old.payment === "demo"
                ? "demo"
                : "online") ||
          JSON.stringify(previous.address) !== JSON.stringify(b.address)
        )
          fail(
            "This checkout key belongs to a different basket, address or payment method. Refresh checkout.",
            409,
          );
        return json({
          order: viewOrder(old),
          keyId: cfg().RAZORPAY_KEY_ID || null,
        });
      }
      const q = await quote(b.items, b.coupon),
        a = b.address || {};
      const address = {
        name: textField(a.name),
        phone: textField(a.phone, 15),
        line1: textField(a.line1, 180),
        line2: textField(a.line2, 180),
        city: textField(a.city),
        state: textField(a.state),
        pincode: textField(a.pincode, 6),
      };
      if (
        !address.name ||
        address.line1.length < 6 ||
        !address.city ||
        !address.state ||
        !/^[1-9][0-9]{5}$/.test(address.pincode) ||
        !/^[6-9][0-9]{9}$/.test(address.phone)
      )
        fail("Enter a full Indian shipping address and a valid mobile number.");
      const method =
        b.method === "cod"
          ? "cod"
          : b.method === "online"
            ? "online"
            : demo() && b.method === "demo"
              ? "demo"
              : null;
      if (!method) fail("Choose a payment method.");
      if (method === "cod" && cfg().COD_ENABLED === "false")
        fail("Cash on delivery is unavailable.");
      if (demo() && method !== "demo")
        fail("Use demo checkout in the preview store.");
      if (!demo() && (u.kind !== "google" || !cfg().BUSINESS_ADDRESS))
        fail("The store is not ready to accept live orders.", 503);
      if (!demo() && cfg().CATALOG_APPROVED !== "true")
        fail("Product details are awaiting merchant approval.", 503);
      if (
        !demo() &&
        method === "online" &&
        (!cfg().RAZORPAY_KEY_ID ||
          !cfg().RAZORPAY_KEY_SECRET ||
          !cfg().RAZORPAY_WEBHOOK_SECRET)
      )
        fail("Online payments are not configured.", 503);
      const id =
          "AVR-" +
          crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase(),
        data = { ...q, address, demo: demo() };
      // The NOT NULL guard aborts the entire database transaction if any stock goes below zero.
      const statements = [
        db()
          .prepare(
            "INSERT INTO orders (id,user_id,idempotency,status,payment,data,total,created) VALUES (?,?,?,?,?,?,?,?)",
          )
          .bind(
            id,
            u.id,
            b.idempotency,
            method === "online" ? "pending" : "confirmed",
            method === "demo" ? "demo" : method === "cod" ? "cod" : "unpaid",
            JSON.stringify(data),
            q.total,
            now(),
          ),
        ...q.items.flatMap((x) => [
          db()
            .prepare("UPDATE variants SET stock=stock-? WHERE id=?")
            .bind(x.quantity, x.variantId),
          db()
            .prepare(
              "INSERT INTO order_items (order_id,variant_id,quantity) VALUES (?,?,CASE WHEN (SELECT stock FROM variants WHERE id=?)>=0 THEN ? ELSE NULL END)",
            )
            .bind(id, x.variantId, x.variantId, x.quantity),
        ]),
      ];
      if (method !== "online")
        statements.push(
          db()
            .prepare("INSERT INTO invoices (order_id,created) VALUES (?,?)")
            .bind(id, now()),
        );
      try {
        await db().batch(statements);
      } catch {
        fail(
          "A jar just sold out, or this checkout was already submitted. Refresh your basket and retry.",
          409,
        );
      }
      if (method === "online") {
        try {
          const payment = await razor("orders", {
            amount: q.total,
            currency: "INR",
            receipt: id,
            notes: { avaruchi_order_id: id },
          });
          await db()
            .prepare("UPDATE orders SET razorpay_id=? WHERE id=?")
            .bind(payment.id, id)
            .run();
        } catch (e) {
          if (!(e as any).uncertain) await cancelAndRestore(id, true);
          // A timeout may have created a provider order. Keep stock reserved until reconciliation.
          throw e;
        }
      }
      const order = await findOrder(id, u);
      if (method !== "online") {
        await enqueueInvoice(order);
        await invoiceEmail(order).catch(() => {});
      }
      return json(
        {
          order: viewOrder(order),
          keyId: method === "online" ? cfg().RAZORPAY_KEY_ID : null,
        },
        201,
      );
    }
    if (path === "payments/verify" && request.method === "POST") {
      const b = await body(request),
        o = await findOrder(textField(b.orderId), u);
      if (o.status === "cancelled") fail("This checkout has been cancelled.");
      if (
        !o.razorpay_id ||
        b.razorpay_order_id !== o.razorpay_id ||
        typeof b.razorpay_payment_id !== "string"
      )
        fail("Payment order mismatch.");
      if (!cfg().RAZORPAY_KEY_SECRET) fail("Payments are not configured.", 503);
      const expected = await hmac(
        cfg().RAZORPAY_KEY_SECRET!,
        o.razorpay_id + "|" + b.razorpay_payment_id,
      );
      if (!equal(expected, b.razorpay_signature || ""))
        fail("Payment signature could not be verified.", 401);
      const p = await razor(
        "payments/" + encodeURIComponent(b.razorpay_payment_id),
      );
      if (
        p.order_id !== o.razorpay_id ||
        p.amount !== o.total ||
        p.currency !== "INR" ||
        p.status !== "captured"
      )
        fail(
          "Your payment is processing. Check your orders for confirmation.",
          409,
        );
      await confirmPayment(o, p.id);
      return json({ order: viewOrder(await findOrder(o.id, u)) });
    }
    if (path.startsWith("invoice/") && request.method === "GET") {
      const o = await findOrder(path.slice(8), u);
      return invoiceResponse(o);
    }
    if (path === "returns" && request.method === "GET") {
      const result = await db()
        .prepare(
          "SELECT * FROM service_requests WHERE user_id=? ORDER BY created DESC LIMIT 100",
        )
        .bind(u.id)
        .all<any>();
      return json({ requests: result.results.map(viewRequest) });
    }
    if (path === "returns" && request.method === "POST") {
      const b = await body(request),
        o = await findOrder(textField(b.orderId), u);
      if (o.status !== "delivered")
        fail(
          "Return and refund requests open after the order is marked delivered. Use order help for a delivery issue.",
          409,
        );
      if (
        !["return", "refund"].includes(b.kind) ||
        !Object.hasOwn(requestReasons, b.reason)
      )
        fail("Choose a request type and reason.");
      if (
        typeof b.details !== "string" ||
        b.details.trim().length < 10 ||
        b.details.length > 1200
      )
        fail("Describe the issue in 10 to 1200 characters.");
      const id = "CASE-" + crypto.randomUUID(),
        created = now();
      const history = [
        {
          status: "requested",
          note: "Your request has been received by the store.",
          at: created,
        },
      ];
      const inserted = await db()
        .prepare(
          "INSERT OR IGNORE INTO service_requests (id,order_id,user_id,kind,reason,details,status,refund_amount,refund_reference,history,version,created,updated) SELECT ?,id,user_id,?,?,?,'requested',0,'',?,1,?,? FROM orders WHERE id=? AND user_id=? AND status='delivered'",
        )
        .bind(
          id,
          b.kind,
          b.reason,
          b.details.trim(),
          JSON.stringify(history),
          created,
          created,
          o.id,
          u.id,
        )
        .run();
      if (inserted.meta.changes !== 1)
        fail(
          "A request already exists for this order, or its status changed. Refresh your account.",
          409,
        );
      return json({ ok: true, id }, 201);
    }
    if (path.startsWith("orders/") && request.method === "POST") {
      const o = await findOrder(path.slice(7), u);
      if (o.status !== "pending" && o.status !== "confirmed")
        fail("This order can no longer be cancelled.");
      if (["paid", "unpaid"].includes(o.payment) || o.razorpay_id)
        fail(
          "Contact the store to reconcile an online payment before cancelling.",
        );
      await cancelAndRestore(o.id);
      return json({ ok: true });
    }
    if (path.startsWith("admin")) {
      if (!admin(u, request)) fail("Store administrator access required.", 403);
      if (path === "admin" && request.method === "GET") {
        const [
          orders,
          stocks,
          coupons,
          shipments,
          requests,
          operationRows,
          mailJobs,
        ] = await db().batch([
          db().prepare(
            "SELECT orders.*,invoices.id invoice_id FROM orders LEFT JOIN invoices ON invoices.order_id=orders.id ORDER BY orders.created DESC LIMIT 200",
          ),
          db().prepare("SELECT * FROM variants ORDER BY product_id,weight"),
          db().prepare("SELECT * FROM coupons"),
          db().prepare("SELECT * FROM order_shipments"),
          db().prepare(
            "SELECT service_requests.*,orders.total,orders.data order_data,orders.payment FROM service_requests JOIN orders ON orders.id=service_requests.order_id ORDER BY service_requests.updated DESC LIMIT 200",
          ),
          db().prepare(
            "SELECT id,order_id,kind,status,data,updated FROM provider_operations ORDER BY updated DESC LIMIT 600",
          ),
          db().prepare(
            "SELECT order_id,status,attempts,next_attempt FROM invoice_jobs WHERE status!='sent' ORDER BY updated DESC LIMIT 100",
          ),
        ]);
        return json({
          operations: operationRows.results,
          invoiceJobs: mailJobs.results,
          orders: orders.results.map((o: any) => ({
            ...viewOrder(o),
            shipment:
              shipments.results.find((s: any) => s.order_id === o.id) || null,
          })),
          requests: requests.results.map(viewRequest),
          stocks: stocks.results,
          coupons: coupons.results,
          products: await catalog(),
          settings: {
            google: !!(cfg().GOOGLE_CLIENT_ID && cfg().GOOGLE_CLIENT_SECRET),
            payments: !!(
              cfg().RAZORPAY_KEY_ID &&
              cfg().RAZORPAY_KEY_SECRET &&
              cfg().RAZORPAY_WEBHOOK_SECRET
            ),
            email:
              !demo() && !!(cfg().RESEND_API_KEY && cfg().INVOICE_FROM_EMAIL),
            business: !!cfg().BUSINESS_ADDRESS,
            demo: demo(),
            shiprocket: shippingReady(cfg()) && !demo(),
            invoiceWorker: !!(
              cfg().CRON_SECRET && cfg().CRON_SECRET!.length >= 32
            ),
            refunds:
              !demo() &&
              cfg().RAZORPAY_REFUNDS_ENABLED === "true" &&
              !!(cfg().RAZORPAY_KEY_ID && cfg().RAZORPAY_KEY_SECRET),
          },
        });
      }

      if (
        ["admin/refund/process", "admin/refund/sync"].includes(path) &&
        request.method === "POST"
      ) {
        const b = await body(request),
          x = await db()
            .prepare("SELECT * FROM service_requests WHERE id=?")
            .bind(textField(b.id))
            .first<any>();
        if (!x) fail("Request not found.", 404);
        if (x.version !== b.expectedVersion || x.status !== "refund_pending")
          fail("Refresh the approved refund before processing.", 409);
        if (demo() || cfg().RAZORPAY_REFUNDS_ENABLED !== "true")
          fail("Online refund processing is disabled.", 503);
        const o = await db()
          .prepare("SELECT * FROM orders WHERE id=?")
          .bind(x.order_id)
          .first<any>();
        const result = path.endsWith("/process")
          ? await operations.refund(x, o)
          : await operations.syncRefund(x, o);
        await completeRefund(x, result);
        return json({ ok: true, refund: result });
      }
      if (path === "admin/payment/reconcile" && request.method === "POST") {
        const b = await body(request),
          o = await db()
            .prepare("SELECT * FROM orders WHERE id=?")
            .bind(textField(b.id))
            .first<any>();
        if (!o) fail("Order not found.", 404);
        if (
          demo() ||
          JSON.parse(o.data).demo ||
          o.status !== "pending" ||
          o.payment !== "unpaid" ||
          o.razorpay_id
        )
          fail("Only an unresolved live checkout can be reconciled.", 409);
        if (
          typeof b.remoteOrderId !== "string" ||
          !/^order_[A-Za-z0-9]+$/.test(b.remoteOrderId)
        )
          fail("Enter the Razorpay order ID.");
        const remote = await razor(
          "orders/" + encodeURIComponent(b.remoteOrderId),
        );
        if (
          remote.id !== b.remoteOrderId ||
          remote.receipt !== o.id ||
          remote.amount !== o.total ||
          remote.currency !== "INR"
        )
          fail("The provider order does not match this checkout.", 409);
        const changed = await db()
          .prepare(
            "UPDATE orders SET razorpay_id=? WHERE id=? AND status='pending' AND payment='unpaid' AND razorpay_id IS NULL",
          )
          .bind(remote.id, o.id)
          .run();
        if (changed.meta.changes !== 1)
          fail("This checkout changed. Refresh before continuing.", 409);
        return json({ ok: true });
      }
      if (path === "admin/invoice-queue" && request.method === "POST")
        return json(await processInvoiceQueue());
      if (path.startsWith("admin/shipping/") && request.method === "POST") {
        const b = await body(request),
          o = await db()
            .prepare(
              "SELECT orders.*,users.email FROM orders JOIN users ON users.id=orders.user_id WHERE orders.id=?",
            )
            .bind(textField(b.id))
            .first<any>();
        if (!o) fail("Order not found.", 404);
        if (demo() || JSON.parse(o.data).demo || !shippingReady(cfg()))
          fail("Shiprocket is unavailable until live setup is complete.", 503);
        if (!["packed", "shipped", "delivered"].includes(o.status))
          fail("Pack this order before using Shiprocket.", 409);
        const action = path.slice("admin/shipping/".length);
        if (
          ["create", "awb", "pickup"].includes(action) &&
          o.status !== "packed"
        )
          fail("Booking actions require a packed order.", 409);
        if (action === "create") {
          await operations.createShipment(o, o.email, b);
          await db()
            .prepare(
              "INSERT OR IGNORE INTO order_shipments (order_id,courier,tracking_url,eta,provider,version,updated) VALUES (?,'Shiprocket','','','shiprocket',0,?)",
            )
            .bind(o.id, now())
            .run();
        } else if (action === "awb") {
          const a = await operations.assignAwb(o.id);
          await db().batch([
            db()
              .prepare(
                "UPDATE orders SET tracking=? WHERE id=? AND status IN ('packed','shipped')",
              )
              .bind(a.awb, o.id),
            db()
              .prepare(
                "UPDATE order_shipments SET provider='shiprocket',courier=?,version=version+1,updated=? WHERE order_id=?",
              )
              .bind(a.courier, now(), o.id),
          ]);
        } else if (action === "pickup") {
          if (o.status !== "packed")
            fail("Pickup can only be requested for a packed order.", 409);
          await operations.pickup(o.id);
        } else if (action === "sync") await syncShipment(o);
        else if (action === "reconcile") {
          await operations.reconcileShipment(o, b.remoteOrderId);
          await db()
            .prepare(
              "INSERT OR IGNORE INTO order_shipments (order_id,courier,tracking_url,eta,provider,version,updated) VALUES (?,'Shiprocket','','','shiprocket',0,?)",
            )
            .bind(o.id, now())
            .run();
        } else fail("Shipping action not found.", 404);
        if (["create", "reconcile"].includes(action))
          await db()
            .prepare(
              "UPDATE order_shipments SET provider='shiprocket',courier='Shiprocket',tracking_url='',eta='',version=version+1,updated=? WHERE order_id=? AND provider='manual'",
            )
            .bind(now(), o.id)
            .run();
        return json({ ok: true });
      }
      if (path === "admin/order" && request.method === "POST") {
        const b = await body(request),
          o = await db()
            .prepare("SELECT * FROM orders WHERE id=?")
            .bind(textField(b.id))
            .first<any>();
        if (!o) fail("Order not found.", 404);
        const managed = await db()
          .prepare("SELECT provider FROM order_shipments WHERE order_id=?")
          .bind(o.id)
          .first<any>();
        if (managed?.provider === "shiprocket")
          fail(
            "Sync Shiprocket to update the managed order status and tracking.",
            409,
          );
        const transitions: Record<string, string[]> = {
          pending: ["cancelled"],
          confirmed: ["packed", "cancelled"],
          packed: ["shipped"],
          shipped: ["delivered"],
          delivered: [],
          cancelled: [],
        };
        if (
          b.expectedStatus !== o.status ||
          b.expectedTracking !== (o.tracking || "")
        )
          fail("This order changed. Refresh it before saving.", 409);
        const trackingOnly =
          b.status === o.status &&
          !["delivered", "cancelled", "pending"].includes(o.status);
        if (!trackingOnly && !transitions[o.status]?.includes(b.status))
          fail("That order status change is unavailable.");
        if (
          b.status === "cancelled" &&
          (["paid", "unpaid"].includes(o.payment) || o.razorpay_id)
        )
          fail(
            "Reconcile this online payment in Razorpay before making inventory or cancellation changes.",
          );
        if (b.status === "cancelled") await cancelAndRestore(o.id);
        else {
          const updated = await db()
            .prepare(
              "UPDATE orders SET status=?,tracking=? WHERE id=? AND status=? AND COALESCE(tracking,'')=?",
            )
            .bind(
              b.status,
              textField(b.tracking, 180),
              o.id,
              o.status,
              o.tracking || "",
            )
            .run();
          if (updated.meta.changes !== 1)
            fail("This order changed. Refresh it before saving.", 409);
        }
        return json({ ok: true });
      }
      if (path === "admin/shipment" && request.method === "POST") {
        const b = await body(request),
          o = await db()
            .prepare("SELECT id,status FROM orders WHERE id=?")
            .bind(textField(b.id))
            .first<any>();
        if (!o) fail("Order not found.", 404);
        if (["pending", "cancelled"].includes(o.status))
          fail("Shipment details are unavailable for this order.", 409);
        const saved = await db()
          .prepare(
            "SELECT version,provider FROM order_shipments WHERE order_id=?",
          )
          .bind(o.id)
          .first<any>();
        if (
          !Number.isInteger(b.expectedVersion) ||
          b.expectedVersion !== (saved?.version || 0)
        )
          fail("Shipment details changed. Refresh before saving.", 409);
        if (saved?.provider === "shiprocket")
          fail("Sync Shiprocket to update managed courier details.", 409);
        const s = shipmentInput(b);
        const results = await db().batch([
          db()
            .prepare(
              "INSERT OR IGNORE INTO order_shipments (order_id,courier,tracking_url,eta,provider,version,updated) VALUES (?,'','','','manual',0,?)",
            )
            .bind(o.id, now()),
          db()
            .prepare(
              "UPDATE order_shipments SET courier=?,tracking_url=?,eta=?,version=version+1,updated=? WHERE order_id=? AND version=? AND EXISTS (SELECT 1 FROM orders WHERE id=? AND status NOT IN ('pending','cancelled'))",
            )
            .bind(
              s.courier,
              s.trackingUrl,
              s.eta,
              now(),
              o.id,
              b.expectedVersion,
              o.id,
            ),
        ]);
        if (results[1].meta.changes !== 1)
          fail("Shipment details changed. Refresh before saving.", 409);
        return json({ ok: true });
      }
      if (path === "admin/return" && request.method === "POST") {
        const b = await body(request),
          x = await db()
            .prepare(
              "SELECT service_requests.*,orders.total,orders.payment FROM service_requests JOIN orders ON orders.id=service_requests.order_id WHERE service_requests.id=?",
            )
            .bind(textField(b.id))
            .first<any>();
        if (!x) fail("Request not found.", 404);
        const payout = await db()
          .prepare("SELECT status FROM provider_operations WHERE id=?")
          .bind("refund-" + x.id)
          .first<any>();
        if (payout && payout.status !== "failed")
          fail(
            "This case has an online refund operation. Sync its provider result before editing it.",
            409,
          );
        if (b.expectedVersion !== x.version)
          fail("This request changed. Refresh before saving.", 409);
        if (!requestTransitions(x.kind, x.status).includes(b.status))
          fail("That request status change is unavailable.");
        if (
          typeof b.note !== "string" ||
          b.note.trim().length < 5 ||
          b.note.length > 1200
        )
          fail("Enter a customer update in 5 to 1200 characters.");
        if (
          !Number.isInteger(b.refundAmount) ||
          b.refundAmount < 0 ||
          b.refundAmount > x.total
        )
          fail(
            "The refund amount must be between zero and the order total, in paise.",
          );
        const reference = textField(b.refundReference, 180);
        if (
          b.status === "refund_pending" &&
          (b.refundAmount === 0 || x.payment === "unpaid")
        )
          fail("A refund requires a collected payment and a positive amount.");
        const completed =
          x.status === "refund_pending" && b.status === "resolved";
        if (completed && (b.refundAmount !== x.refund_amount || !reference))
          fail(
            "Record the verified refund reference and retain the approved refund amount.",
          );
        if (!completed && reference)
          fail(
            "Only record a refund reference after verifying the completed refund.",
          );
        if (
          !["refund_pending", "resolved"].includes(b.status) &&
          b.refundAmount !== 0
        )
          fail("Set the amount when the request reaches Refund pending.");
        if (b.status === "resolved" && !completed && b.refundAmount !== 0)
          fail("Use Refund pending before recording a completed refund.");
        const history = JSON.parse(x.history);
        history.push({ status: b.status, note: b.note.trim(), at: now() });
        const changed = await db()
          .prepare(
            "UPDATE service_requests SET status=?,refund_amount=?,refund_reference=?,history=?,version=version+1,updated=? WHERE id=? AND version=? AND NOT EXISTS (SELECT 1 FROM provider_operations WHERE id=? AND status!='failed')",
          )
          .bind(
            b.status,
            b.refundAmount,
            reference,
            JSON.stringify(history),
            now(),
            x.id,
            x.version,
            "refund-" + x.id,
          )
          .run();
        if (changed.meta.changes !== 1)
          fail("This request changed. Refresh before saving.", 409);
        return json({ ok: true });
      }
      if (path === "admin/stock" && request.method === "POST") {
        const b = await body(request);
        if (
          !Number.isInteger(b.stock) ||
          b.stock < 0 ||
          b.stock > 100000 ||
          !Number.isInteger(b.price) ||
          b.price < 100 ||
          b.price > 10000000
        )
          fail("Enter valid stock and a price in paise.");
        if (
          !Number.isInteger(b.expectedStock) ||
          !Number.isInteger(b.expectedPrice)
        )
          fail("Refresh inventory before saving its current values.", 409);
        const existing = await db()
          .prepare("SELECT id FROM variants WHERE id=?")
          .bind(textField(b.id))
          .first();
        if (!existing) fail("Jar size not found.", 404);
        const updated = await db()
          .prepare(
            "UPDATE variants SET stock=?,price=? WHERE id=? AND stock=? AND price=?",
          )
          .bind(
            b.stock,
            b.price,
            textField(b.id),
            b.expectedStock,
            b.expectedPrice,
          )
          .run();
        if (updated.meta.changes !== 1)
          fail(
            "Inventory changed. Refresh before saving to preserve the latest stock.",
            409,
          );
        return json({ ok: true });
      }
      if (path === "admin/coupon" && request.method === "POST") {
        const b = await body(request),
          code = textField(b.code, 30).toUpperCase();
        if (
          !/^[A-Z0-9]{3,30}$/.test(code) ||
          !Number.isInteger(b.percent) ||
          b.percent < 1 ||
          b.percent > 50 ||
          !Number.isInteger(b.minimum) ||
          b.minimum < 0 ||
          b.minimum > 10000000 ||
          typeof b.active !== "boolean"
        )
          fail(
            "Use a 3-30 character coupon, 1-50% discount and a non-negative minimum.",
          );
        await db()
          .prepare(
            "INSERT INTO coupons (code,percent,minimum,active) VALUES (?,?,?,?) ON CONFLICT(code) DO UPDATE SET percent=excluded.percent,minimum=excluded.minimum,active=excluded.active",
          )
          .bind(code, b.percent, b.minimum, b.active ? 1 : 0)
          .run();
        return json({ ok: true });
      }
      if (path === "admin/product" && request.method === "POST") {
        const b = await body(request),
          p = (await catalog()).find((x: any) => x.id === b.id);
        if (!p) fail("Product not found.", 404);
        const data = {
          ...p,
          name: textField(b.name),
          description: textField(b.description, 1000),
          ingredients: textField(b.ingredients, 1000),
          pairing: textField(b.pairing, 500),
        };
        delete data.variants;
        if (!data.name || !data.ingredients || !data.description)
          fail("Complete the product fields.");
        await db()
          .prepare("UPDATE products SET data=? WHERE id=?")
          .bind(JSON.stringify(data), p.id)
          .run();
        return json({ ok: true });
      }
      if (path.startsWith("admin/invoice/") && request.method === "GET") {
        const o = await db()
          .prepare("SELECT * FROM orders WHERE id=?")
          .bind(path.slice(14))
          .first<any>();
        if (!o) fail("Order not found.", 404);
        return invoiceResponse(o);
      }
      if (path === "admin/email" && request.method === "POST") {
        const b = await body(request),
          o = await db()
            .prepare("SELECT * FROM orders WHERE id=?")
            .bind(textField(b.id))
            .first<any>();
        if (!o) fail("Order not found.", 404);
        return json(await invoiceEmail(o));
      }
    }
    return json({ error: "Route not found." }, 404);
  } catch (e: any) {
    if (!e.status)
      console.error("Avaruchi API failure", {
        path,
        code: e.code || "UNEXPECTED",
      });
    return json(
      {
        error: e.status
          ? e.message
          : "The store could not complete this request. Please try again.",
      },
      e.status || 500,
    );
  }
}
