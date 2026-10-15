# Avaruchi Node.js deployment

Create a new Node.js 24 app for Avaruchi with this project root as its app directory. Use [Avaruchi's source repository](https://github.com/octaleadsprivatelimited-cloud/avaruchi) and Avaruchi's own hosting resources. Vite builds the React UI and server-rendering entry; the existing Express backend runs alongside it.

The deployed storefront is [aavaruchi.in](https://aavaruchi.in). Its frontend and API share this origin, and `/ready` verifies MySQL persistence. Hostinger's GitHub connection deploys `main`; GitHub Actions runs the checks in `.github/workflows/ci.yml` independently of deployment. The custom domain replaces the original temporary hostname. Keep the existing absolute `UPLOAD_DIR` unchanged when renaming a site, so media stays in the same persistent directory.

| Setting | Value |
| --- | --- |
| Install | `pnpm install --frozen-lockfile` |
| Build | `pnpm build:hostinger` |
| Entry point | `hostinger.mjs` |
| Start | `pnpm start` |
| Output directory | `.` |

The process serves React and Express on the hosting platform's `PORT`. It needs both `.output/` and `commerce-api/`. Browser API requests use the same domain; leave `VITE_COMMERCE_API_URL` empty. MySQL is required. Redis is optional and is not used for authentication or inventory correctness.

The Express preset may show no build command. The root production `postinstall` hook then runs `build:hostinger` before publishing the entry file. It reads `NODE_ENV` from the process or Hostinger's `.env`; development and test installs skip this hook. API build dependencies are installed explicitly even when the deployment environment is production.

Hostinger serves the frontend, API, uploads and background worker together. Set `APP_URL`, `CORS_ORIGINS`, `VITE_PUBLIC_SITE_URL` and `PUBLIC_UPLOAD_BASE_URL` to the Hostinger site's HTTPS hostname. Leave `COMMERCE_BACKEND_URL` and `AVARUCHI_PROXY_SECRET` unset. MySQL remains local to the hosting account; no remote database access rule is needed. Automatic Vercel deployments are disabled in the repository.

## Hosting environment

Use `.env.production.example` as the template. Enter live values in hosting settings and keep credentials out of shared source:

- `NODE_ENV=production`, `USE_DATABASE=true`, and `APP_URL=https://<Avaruchi-domain>`.
- All four `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`; `DATABASE_PORT` defaults to 3306. Enter the password unchanged in its dedicated field. These fields take precedence over `DATABASE_URL` and must be supplied together.
- Alternatively use `DATABASE_URL=mysql://USER:URL_ENCODED_PASSWORD@HOST:3306/DATABASE` and omit all four discrete fields.
- Unique random `JWT_SECRET` and `JWT_REFRESH_SECRET`, at least 32 characters each, and a separate random `INTEGRATION_ENCRYPTION_KEY`. Keep the encryption key stable across releases so saved provider credentials remain readable.
- `CORS_ORIGINS` must list explicit HTTPS storefront origins. It defaults to `APP_URL`. `PUBLIC_UPLOAD_BASE_URL` defaults to `APP_URL/uploads`.
- Configure `TRUST_PROXY` only for the actual hosting proxy chain. Trusted proxies must replace forwarded headers and direct access to the API must be restricted accordingly.

Uploads must remain writable and persistent across deployments. The default production location is `~/.local/share/avaruchi/<domain>/uploads`, outside the checkout. Supply `UPLOAD_DIR` if hosting requires a different durable directory; back it up with the database.

The entry point opens its port promptly, then applies committed MySQL migrations before serving customer requests. `/health` and `/ready` return uncached `503 SERVICE_STARTING` until initialization finishes. Customer requests wait briefly during startup. Migration failures stop startup with sanitized diagnostics; the process never resets the database or falls back to memory storage.

Keep `SEED_CATALOG=false` for an empty new store. For an intentional sample preview, optionally set `SEED_CATALOG=true` once, then remove it. It initializes the sample catalog and role permissions only when no products or orders exist. Replace sample products with approved Avaruchi products before launch.

## Authentication and providers

Firebase defaults are empty. Supply Avaruchi's `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN` and `FIREBASE_APP_ID` together. Enable Google in Firebase and authorize the storefront hostname. Set `STORE_ADMIN_EMAIL` to Avaruchi's verified admin Google account. `/api/v1/auth/providers` reports the public configuration and enabled state. Sign-in remains disabled until configured; no local login bypass exists.

After verified admin sign-in, use Admin → Products → Pickle jars to edit jar labels, prices, MRP, stock and shipping weight in grams. New gram/kg jar labels suggest a weight; each variant's weight remains editable. Products stay draft until the merchant publishes them.

Configure Razorpay in Admin → Integrations as PAYMENT / razorpay / LIVE with credentials `keyId`, `keySecret` and a separate `webhookSecret`. Production requires an `rzp_live_` public key. Configure the signed webhook at `https://aavaruchi.in/webhooks/razorpay` for payment captured, payment failed and refund events. Checkout creates the order on the server, verifies the callback HMAC and checks the captured amount/currency with Razorpay before marking it paid. Closing the payment window leaves a saved, retryable order.

Use Store settings for manual delivery charges, free-shipping threshold, delivery days and COD availability, or configure a shipping provider. Set accurate business identity and support details before accepting orders. Analytics are optional and require provider IDs and customer consent.

For Resend, verify `aavaruchi.in` in the Resend dashboard using its exact DKIM/SPF records, then save an EMAIL / resend / LIVE integration with credential `apiKey` and public settings `fromEmail` (for example `orders@aavaruchi.in`) and `fromName` (`Avaruchi`). Do not invent DNS values or place the API key in frontend settings. Add the domain's exact DNS records only after Resend supplies them.

The production notification worker sends persisted customer confirmations and merchant new-order alerts after an accepted COD order or verified online payment. Merchant alerts go to `STORE_ORDER_ALERT_EMAIL`, falling back to `STORE_ADMIN_EMAIL`. Each recipient gets a separate durable, deduplicated outbox entry. Missing email configuration defers delivery. Verify real delivery in the email provider; a queued notification is not evidence that a message arrived.

## Release checks

Run `pnpm verify` and `pnpm verify:db` before uploading a release. These commands check lint, types, API tests, production builds, public assets and compiled startup/rendering behavior. GitHub Actions validates `main` and pull requests using an isolated MySQL service. Hostinger's GitHub connection deploys the full application from `main`.

After deployment, verify `/ready`, the home/shop/product pages, Google sign-in, cart/checkout, uploads, `/sitemap.xml`, `/robots.txt` and `/merchant-feed.xml`. Confirm the hosting deployment uses the intended release files. Keep database/uploads backups and preserve compatible schema migrations when rolling back application code.
