# Avaruchi Node.js deployment

Create a new Node.js 24 app for Avaruchi with this project root as its app directory. Use [Avaruchi's source repository](https://github.com/octaleadsprivatelimited-cloud/avaruchi) and Avaruchi's own hosting resources. No deployment workflow is configured.

| Setting | Value |
| --- | --- |
| Install | `pnpm install --frozen-lockfile` |
| Build | `pnpm build:hostinger` |
| Entry point | `hostinger.mjs` |
| Start | `pnpm start` |
| Output directory | `.` |

The process serves React and Express on the hosting platform's `PORT`. It needs both `.output/` and `commerce-api/`. Browser API requests use the same domain; leave `VITE_COMMERCE_API_URL` empty. MySQL is required. Redis is optional and is not used for authentication or inventory correctness.

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

After verified admin sign-in, configure Cashfree and signed webhooks for online payments, delivery settings/shipping providers, and Resend for order emails through Admin → Integrations. Production checkout retains its readiness requirements. Set accurate business identity and support details before accepting orders. Analytics are optional and require provider IDs and customer consent.

The production notification worker sends persisted order confirmations after an accepted COD order or verified online payment. Missing email configuration defers delivery. Verify real delivery in the email provider; a queued notification is not evidence that a message arrived.

## Release checks

Run `pnpm verify` and `pnpm verify:db` before uploading a release. These commands check lint, types, API tests, production builds, public assets and compiled startup/rendering behavior. There is no connected CI or automatic deployment.

After deployment, verify `/ready`, the home/shop/product pages, Google sign-in, cart/checkout, uploads, `/sitemap.xml`, `/robots.txt` and `/merchant-feed.xml`. Confirm the hosting deployment uses the intended release files. Keep database/uploads backups and preserve compatible schema migrations when rolling back application code.
