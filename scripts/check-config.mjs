import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const c = process.env,
  missing = [];
for (const name of ["DB_NAME", "DB_USER"]) if (!c[name]) missing.push(name);
if (c.ADMIN_GOOGLE_SUB && !/^[A-Za-z0-9_-]{1,255}$/.test(c.ADMIN_GOOGLE_SUB))
  missing.push("ADMIN_GOOGLE_SUB must identify exactly one Google account");
if (c.DEMO_MODE !== "true") {
  for (const name of [
    "SITE_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "ADMIN_GOOGLE_SUB",
    "BUSINESS_ADDRESS",
    "SUPPORT_EMAIL",
  ])
    if (!c[name]) missing.push(name);
  if (c.CATALOG_APPROVED !== "true") missing.push("CATALOG_APPROVED=true");
  if (c.DEMO_ADMIN_ENABLED === "true")
    missing.push("DEMO_ADMIN_ENABLED=false for live mode");
  try {
    const url = new URL(c.SITE_URL);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      missing.push("canonical HTTPS SITE_URL");
  } catch {
    missing.push("valid SITE_URL");
  }
  const payments = [
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
  ];
  if (payments.some((k) => !!c[k]))
    for (const k of payments) if (!c[k]) missing.push(k);
  if (c.SHIPROCKET_ENABLED === "true")
    for (const k of [
      "SHIPROCKET_EMAIL",
      "SHIPROCKET_PASSWORD",
      "SHIPROCKET_PICKUP_LOCATION",
      "SHIPROCKET_WEBHOOK_TOKEN",
    ])
      if (!c[k] || (k.endsWith("TOKEN") && c[k].length < 32)) missing.push(k);
  if (c.RESEND_API_KEY || c.INVOICE_FROM_EMAIL)
    for (const k of ["RESEND_API_KEY", "INVOICE_FROM_EMAIL", "CRON_SECRET"])
      if (!c[k] || (k === "CRON_SECRET" && c[k].length < 32)) missing.push(k);
  if (c.RAZORPAY_REFUNDS_ENABLED === "true")
    for (const k of payments) if (!c[k]) missing.push(k);
}
for (const k of ["SHIPPING_FEE", "FREE_SHIPPING_THRESHOLD"])
  if (
    c[k] &&
    (!Number.isSafeInteger(Number(c[k])) ||
      Number(c[k]) < 0 ||
      Number(c[k]) > 10000000)
  )
    missing.push(k + " in non-negative paise");
if (missing.length) {
  console.error(
    "Store configuration is incomplete:",
    [...new Set(missing)].join(", "),
  );
  process.exitCode = 1;
} else
  console.log(
    "Store configuration checks passed (" +
      (c.DEMO_MODE === "true" ? "demo" : "live") +
      "). Provider connectivity and merchant data still require verification.",
  );
