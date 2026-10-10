// Provider requests never accept a destination URL from a customer or administrator.
export class ProviderError extends Error {
  status = 502;
  constructor(
    public provider: string,
    public uncertain = false,
  ) {
    super(
      uncertain
        ? provider +
            " did not return a verified result. Reconcile this action before retrying."
        : provider + " rejected the request. Check the provider settings.",
    );
  }
}
export async function providerJson(
  url: string,
  init: RequestInit = {},
  transport: typeof fetch = fetch,
  timeout = 12000,
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const provider = new URL(url).hostname;
  try {
    const response = await transport(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new ProviderError(provider, response.status >= 500);
    const reader = response.body?.getReader();
    if (!reader) throw new ProviderError(provider, true);
    let size = 0,
      raw = "";
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 300000) {
          await reader.cancel();
          throw new ProviderError(provider, true);
        }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new ProviderError(provider, true);
    return value;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(provider, true);
  } finally {
    clearTimeout(timer);
  }
}
type Settings = Record<string, any>;
const error = (message: string, status = 400): never => {
  throw Object.assign(new Error(message), { status });
};
export const shippingReady = (c: Settings) =>
  c.SHIPROCKET_ENABLED === "true" &&
  !!(
    c.SHIPROCKET_EMAIL &&
    c.SHIPROCKET_PASSWORD &&
    c.SHIPROCKET_PICKUP_LOCATION &&
    c.SHIPROCKET_WEBHOOK_TOKEN?.length >= 32
  );
export function parcelInput(b: any) {
  const result = {
    length: Number(b.length),
    breadth: Number(b.breadth),
    height: Number(b.height),
    weight: Number(b.weight),
  };
  if (
    Object.values(result).some((x) => !Number.isFinite(x) || x <= 0) ||
    result.weight > 50 ||
    Math.max(result.length, result.breadth, result.height) > 200
  )
    error("Enter the measured parcel dimensions in cm and weight in kg.");
  return result;
}
export function shipmentPayload(
  o: any,
  email: string,
  c: Settings,
  parcel: any,
) {
  const data = typeof o.data === "string" ? JSON.parse(o.data) : o.data,
    a = data.address;
  if (
    data.demo ||
    !["cod", "paid"].includes(o.payment) ||
    o.status !== "packed"
  )
    error(
      "Only a packed live order with COD or captured payment can be booked.",
      409,
    );
  const contentsKg = data.items.reduce(
    (n: number, x: any) => n + (x.weight * x.quantity) / 1000,
    0,
  );
  if (parcel.weight < contentsKg)
    error("Parcel weight must include all jars and packaging.");
  return {
    order_id: o.id,
    order_date: new Date(o.created + 19800000)
      .toISOString()
      .slice(0, 16)
      .replace("T", " "),
    pickup_location: c.SHIPROCKET_PICKUP_LOCATION,
    billing_customer_name: a.name,
    billing_last_name: "",
    billing_address: a.line1,
    billing_address_2: a.line2 || "",
    billing_city: a.city,
    billing_pincode: a.pincode,
    billing_state: a.state,
    billing_country: "India",
    billing_email: email,
    billing_phone: a.phone,
    shipping_is_billing: true,
    order_items: data.items.map((x: any) => ({
      name: x.name + " " + x.weight + "g",
      sku: x.variantId,
      units: x.quantity,
      selling_price: x.price / 100,
    })),
    payment_method: o.payment === "cod" ? "COD" : "Prepaid",
    shipping_charges: data.shipping / 100,
    total_discount: data.discount / 100,
    sub_total: data.subtotal / 100,
    ...parcel,
  };
}
export function safeTrackingUrl(value: any) {
  if (typeof value !== "string" || value.length > 500) return "";
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : "";
  } catch {
    return "";
  }
}
export function deliveryStatus(value: any) {
  const status = String(value || "").toUpperCase();
  if (status === "DELIVERED") return "delivered";
  if (
    ["SHIPPED", "IN TRANSIT", "PICKED UP", "OUT FOR DELIVERY"].includes(status)
  )
    return "shipped";
  return null; // RTO, lost, cancellation and exceptions need merchant review, never imply delivery.
}
export function createOperations(
  database: () => any,
  config: () => Settings,
  transport: typeof fetch = fetch,
) {
  let auth: { token: string; expires: number; key: string } | undefined;
  async function ship(path: string, data?: any) {
    const c = config();
    if (!shippingReady(c) || c.DEMO_MODE === "true")
      error(
        "Shiprocket is disabled until live credentials and pickup details are configured.",
        503,
      );
    const key = c.SHIPROCKET_EMAIL + "\n" + c.SHIPROCKET_PASSWORD;
    if (!auth || auth.key !== key || auth.expires < Date.now()) {
      const result = await providerJson(
        "https://apiv2.shiprocket.in/v1/external/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: c.SHIPROCKET_EMAIL,
            password: c.SHIPROCKET_PASSWORD,
          }),
        },
        transport,
      );
      if (typeof result.token !== "string" || !result.token.length)
        throw new ProviderError("Shiprocket", true);
      auth = { token: result.token, expires: Date.now() + 86400000, key };
    }
    return providerJson(
      "https://apiv2.shiprocket.in/v1/external/" + path,
      {
        method: data ? "POST" : "GET",
        headers: {
          Authorization: "Bearer " + auth.token,
          "Content-Type": "application/json",
        },
        body: data ? JSON.stringify(data) : undefined,
      },
      transport,
    );
  }
  async function once(
    id: string,
    orderId: string,
    kind: string,
    payload: any,
    action: () => Promise<any>,
    validate: (result: any) => any,
    guard?: { sql: string; values: any[] },
  ) {
    const db = database(),
      serialized = JSON.stringify(payload);
    const inserted = guard
      ? await db
          .prepare(
            "INSERT OR IGNORE INTO provider_operations (id,order_id,kind,status,payload,data,updated) SELECT ?,?,?, 'running',?,'{}',? WHERE " +
              guard.sql,
          )
          .bind(id, orderId, kind, serialized, Date.now(), ...guard.values)
          .run()
      : await db
          .prepare(
            "INSERT OR IGNORE INTO provider_operations (id,order_id,kind,status,payload,data,updated) VALUES (?,?,?,'running',?,'{}',?)",
          )
          .bind(id, orderId, kind, serialized, Date.now())
          .run();
    const saved = await db
      .prepare("SELECT * FROM provider_operations WHERE id=?")
      .bind(id)
      .first();
    if (!saved)
      error("The approved operation changed. Refresh before continuing.", 409);
    if (saved.payload !== serialized)
      error(
        "This operation has a different saved request. Reconcile it before making changes.",
        409,
      );
    if (inserted.meta.changes !== 1) {
      if (saved.status === "complete") return JSON.parse(saved.data);
      error(
        "This provider action is in progress or needs reconciliation. A second request was blocked.",
        409,
      );
    }
    try {
      const result = validate(await action());
      await db
        .prepare(
          "UPDATE provider_operations SET status='complete',data=?,updated=? WHERE id=? AND status='running'",
        )
        .bind(JSON.stringify(result), Date.now(), id)
        .run();
      return result;
    } catch (e) {
      await db
        .prepare(
          "UPDATE provider_operations SET status='uncertain',updated=? WHERE id=? AND status='running'",
        )
        .bind(Date.now(), id)
        .run();
      throw e;
    }
  }
  async function createShipment(o: any, email: string, parcel: any) {
    const c = config();
    if (!shippingReady(c) || c.DEMO_MODE === "true")
      error("Shiprocket is not configured for live orders.", 503);
    const payload = shipmentPayload(o, email, c, parcelInput(parcel));
    return once(
      "shipping-create-" + o.id,
      o.id,
      "shipping-create",
      payload,
      () => ship("orders/create/adhoc", payload),
      (r) => {
        if (
          !Number.isSafeInteger(r.order_id) ||
          r.order_id <= 0 ||
          !Number.isSafeInteger(r.shipment_id) ||
          r.shipment_id <= 0
        )
          throw new ProviderError("Shiprocket", true);
        return { orderId: r.order_id, shipmentId: r.shipment_id };
      },
    );
  }
  async function shippingRecord(orderId: string) {
    const s = await database()
      .prepare("SELECT data,status FROM provider_operations WHERE id=?")
      .bind("shipping-create-" + orderId)
      .first();
    if (s?.status !== "complete")
      error("Create or reconcile the Shiprocket shipment first.", 409);
    return JSON.parse(s.data);
  }
  async function assignAwb(orderId: string) {
    const s = await shippingRecord(orderId),
      payload = { shipment_id: s.shipmentId };
    return once(
      "shipping-awb-" + orderId,
      orderId,
      "shipping-awb",
      payload,
      () => ship("courier/assign/awb", payload),
      (r) => {
        const a = r.response?.data;
        if (
          r.awb_assign_status !== 1 ||
          !a ||
          String(a.shipment_id) !== String(s.shipmentId) ||
          !/^[A-Za-z0-9-]{4,100}$/.test(String(a.awb_code))
        )
          throw new ProviderError("Shiprocket", true);
        return {
          awb: String(a.awb_code),
          courier: String(a.courier_name || "Shiprocket").slice(0, 100),
        };
      },
    );
  }
  async function pickup(orderId: string) {
    const s = await shippingRecord(orderId),
      a = await database()
        .prepare("SELECT status FROM provider_operations WHERE id=?")
        .bind("shipping-awb-" + orderId)
        .first();
    if (a?.status !== "complete")
      error("Assign the courier and AWB before requesting pickup.", 409);
    const payload = { shipment_id: [s.shipmentId] };
    return once(
      "shipping-pickup-" + orderId,
      orderId,
      "shipping-pickup",
      payload,
      () => ship("courier/generate/pickup", payload),
      (r) => {
        if (r.pickup_status !== 1) throw new ProviderError("Shiprocket", true);
        return {
          scheduled: String(r.response?.pickup_scheduled_date || "").slice(
            0,
            60,
          ),
        };
      },
    );
  }
  async function reconcileShipment(o: any, remoteId: number) {
    if (!Number.isSafeInteger(remoteId) || remoteId <= 0)
      error("Enter the Shiprocket order ID.");
    const r = await ship("orders/show/" + remoteId),
      d = r.data,
      s = d?.shipments;
    if (
      !d ||
      d.channel_order_id !== o.id ||
      Number(d.id) !== remoteId ||
      !Number.isSafeInteger(Number(s?.id)) ||
      Number(s.id) <= 0
    )
      error("Shiprocket order does not match this store order.", 409);
    const result = { orderId: remoteId, shipmentId: Number(s.id) };
    const changed = await database()
      .prepare(
        "UPDATE provider_operations SET status='complete',data=?,updated=? WHERE id=? AND status IN ('running','uncertain')",
      )
      .bind(JSON.stringify(result), Date.now(), "shipping-create-" + o.id)
      .run();
    if (changed.meta.changes !== 1)
      error("No unresolved shipment creation exists.", 409);
    // Reconcile only creation. Uncertain AWB/pickup must be verified in Shiprocket before importing.
    return result;
  }
  async function tracking(orderId: string, awb: string) {
    await shippingRecord(orderId);
    if (!/^[A-Za-z0-9-]{4,100}$/.test(awb))
      error("Tracking reference is unavailable.", 409);
    const r = await ship("courier/track/awb/" + encodeURIComponent(awb)),
      d = r.tracking_data,
      t = d?.shipment_track?.[0];
    const s = await shippingRecord(orderId);
    if (
      !t ||
      String(t.awb_code) !== awb ||
      String(t.shipment_id) !== String(s.shipmentId)
    )
      throw new ProviderError("Shiprocket", true);
    return {
      status: deliveryStatus(t.current_status),
      courier: String(t.courier_name || "Shiprocket").slice(0, 100),
      trackingUrl: safeTrackingUrl(d.track_url),
      eta: /^\d{4}-\d{2}-\d{2}/.test(String(d.etd || ""))
        ? String(d.etd).slice(0, 10)
        : "",
    };
  }

  async function payment(
    path: string,
    data?: any,
    headers: Record<string, string> = {},
  ) {
    const c = config();
    if (
      c.DEMO_MODE === "true" ||
      c.RAZORPAY_REFUNDS_ENABLED !== "true" ||
      !c.RAZORPAY_KEY_ID ||
      !c.RAZORPAY_KEY_SECRET
    )
      error("Online refund processing is not enabled.", 503);
    return providerJson(
      "https://api.razorpay.com/v1/" + path,
      {
        method: data ? "POST" : "GET",
        headers: {
          Authorization:
            "Basic " + btoa(c.RAZORPAY_KEY_ID + ":" + c.RAZORPAY_KEY_SECRET),
          "Content-Type": "application/json",
          ...headers,
        },
        body: data ? JSON.stringify(data) : undefined,
      },
      transport,
    );
  }
  const refundResult = (r: any, payload: any) => {
    if (
      typeof r.id !== "string" ||
      !/^rfnd_[A-Za-z0-9]+$/.test(r.id) ||
      r.payment_id !== payload.paymentId ||
      r.amount !== payload.amount ||
      r.currency !== "INR" ||
      !["pending", "processed", "failed"].includes(r.status)
    )
      throw new ProviderError("Razorpay", true);
    return {
      id: r.id,
      status: r.status,
      amount: r.amount,
      paymentId: r.payment_id,
    };
  };
  async function refund(x: any, o: any) {
    if (
      JSON.parse(o.data).demo ||
      o.payment !== "paid" ||
      !/^pay_[A-Za-z0-9]+$/.test(o.payment_id || "") ||
      x.status !== "refund_pending" ||
      !Number.isInteger(x.refund_amount) ||
      x.refund_amount < 100 ||
      x.refund_amount > o.total
    )
      error(
        "Use a captured live payment and an approved refund of at least INR 1.",
        409,
      );
    const payload = {
      paymentId: o.payment_id,
      amount: x.refund_amount,
      receipt: x.id.replace("CASE-", "CASE").slice(0, 40),
    };
    return once(
      "refund-" + x.id,
      o.id,
      "refund",
      payload,
      async () => {
        const p = await payment("payments/" + encodeURIComponent(o.payment_id));
        if (
          p.id !== o.payment_id ||
          p.order_id !== o.razorpay_id ||
          p.status !== "captured" ||
          p.currency !== "INR" ||
          p.amount !== o.total ||
          Number(p.amount_refunded || 0) + x.refund_amount > p.amount
        )
          error(
            "The captured payment no longer supports this refund. Reconcile it in Razorpay.",
            409,
          );
        return payment(
          "payments/" + encodeURIComponent(o.payment_id) + "/refund",
          { amount: payload.amount, speed: "normal", receipt: payload.receipt },
          { "X-Refund-Idempotency": "avaruchi-" + x.id },
        );
      },
      (r) => refundResult(r, payload),
      {
        sql: "EXISTS (SELECT 1 FROM service_requests WHERE id=? AND version=? AND status='refund_pending' AND refund_amount=?)",
        values: [x.id, x.version, x.refund_amount],
      },
    );
  }
  async function syncRefund(x: any, o: any) {
    const db = database(),
      op = await db
        .prepare("SELECT * FROM provider_operations WHERE id=?")
        .bind("refund-" + x.id)
        .first();
    if (!op) error("No online refund has been requested.", 409);
    const payload = JSON.parse(op.payload),
      saved = JSON.parse(op.data);
    if (
      payload.paymentId !== o.payment_id ||
      payload.amount !== x.refund_amount
    )
      error("Refund record no longer matches this order.", 409);
    let r;
    if (saved.id) r = await payment("refunds/" + encodeURIComponent(saved.id));
    else {
      // Reconcile uncertain responses by the immutable receipt. Never start a second payout.
      const list = await payment(
        "payments/" + encodeURIComponent(o.payment_id) + "/refunds?count=100",
      );
      const matches = list.items?.filter(
        (a: any) =>
          a.receipt === payload.receipt && a.amount === payload.amount,
      );
      if (matches?.length !== 1)
        error(
          "No unique matching refund was found. Verify the payment in Razorpay before another action.",
          409,
        );
      r = matches[0];
    }
    const result = refundResult(r, payload);
    await db
      .prepare(
        "UPDATE provider_operations SET status=?,data=?,updated=? WHERE id=?",
      )
      .bind(
        result.status === "failed" ? "failed" : "complete",
        JSON.stringify(result),
        Date.now(),
        op.id,
      )
      .run();
    return result;
  }

  return {
    createShipment,
    assignAwb,
    pickup,
    reconcileShipment,
    tracking,
    refund,
    syncRefund,
  };
}
