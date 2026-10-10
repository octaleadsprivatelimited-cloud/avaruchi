# Avaruchi for Hostinger

A multipage pickle store using Next.js, React, Motion and MySQL. This is the portable Node.js edition of the Avaruchi concept website, prepared for Hostinger Node.js web application hosting.

## What works

- Home, shop, eight individual product pages, our story, pairing journal, account, wishlist, checkout, administration, contact and four policy pages.
- Search, category filters, sorting, jar sizes, favourites, persistent basket, delivery address and coupons.
- Google OAuth as the only live customer login. No SMS or email/password login.
- Server-authoritative checkout totals, transactional stock reservation and idempotent order creation.
- Razorpay orders, signed payment verification and captured-payment webhooks when credentials are configured.
- Order history, manual shipment status/tracking, reorder and eligible order cancellation with stock restoration.
- Automatic numbered PDF invoices after confirmation, plus invoice emails through Resend when configured.
- Administration for orders, prices, stock, product descriptions, coupons and connection status.
- Restrained page, photo, section and cart motion. Reduced-motion preference support. No hover animation.
- Square edges, warm paper, forest green and rust; Fraunces and DM Sans. Custom SVG icons, static skeletons and no shadows or gradients.

## Deploy through Hostinger hPanel

The app requires a Hostinger plan with **Node.js web application hosting**, plus a MySQL database. It is a server application, so use the Node.js Web App flow rather than uploading files to a static website directory.

1. Sign in to Hostinger and choose **Websites → Add website → Node.js Web App**. Select file upload and upload `avaruchi-hostinger.zip`. `package.json` is at the ZIP root. Alternatively, choose GitHub and connect `octaleadsprivatelimited-cloud/avaruchi`, branch `main`, with the repository root as the app root.
2. Choose **Next.js**, **Node.js 22.x**, the project root containing `package.json`, installation `npm ci`, build `npm run build` and start `npm start` if these fields are presented. Let Hostinger detect the framework. The Next.js build directory is `.next`; do not choose a static export. The start script binds to `0.0.0.0` and respects Hostinger's `PORT` environment variable.
3. Select Hostinger's **temporary domain**. The avaruchi.com brand domain has not yet been purchased. Domain purchase is separate from deploying this code.
4. Create a MySQL database using **Website Dashboard → Databases → Management**. Save its password securely and enter the database connection values directly in Hostinger's environment settings. Use the exact database host shown by Hostinger.
5. Open that database in phpMyAdmin and import `database/001_store.sql` followed by `database/002_customer_service.sql` and `database/003_provider_security.sql`. The schema creates InnoDB tables and preserves existing table data. Alternatively, from an authenticated shell with the app's environment loaded, run `npm run db:migrate`. Schema migration is deliberately separate from the build; the build succeeds without a database connection.
6. Set these environment values for the first demonstration deployment:

```text
DB_HOST=<Hostinger database host>
DB_PORT=3306
DB_NAME=<database name>
DB_USER=<database username>
DB_PASSWORD=<database password>
DEMO_MODE=true
DEMO_ADMIN_ENABLED=false
SITE_URL=https://<actual temporary domain>
CATALOG_APPROVED=false
```

7. Deploy or redeploy. Open `/shop`, a product such as `/shop/mango`, `/checkout`, `/terms` and `/privacy`. Place a demonstration order with a sample address and download its invoice. The database must be imported before these API-backed actions work.

Environment values stay in Hostinger and do not belong in the source ZIP. `.env.example` lists every supported setting. After environment changes, redeploy/restart the application as required by hPanel.

Official Hostinger references:

- [Node.js hosting options](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/)
- [MySQL connection setup](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/)
- [Environment variables](https://www.hostinger.com/support/how-to-add-environment-variables-during-node-js-application-deployment/)
- [Temporary and custom domains](https://www.hostinger.com/support/how-to-connect-a-custom-domain-to-a-node-js-application/)

## Activate the live store

In Google Cloud, create a **Web application OAuth client**, with the actual site origin and this exact callback:

```text
https://<actual domain>/api/auth/google/callback
```

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` privately in Hostinger. Choose the administrator's Google subject ID and set `ADMIN_GOOGLE_SUB`. Admin access never trusts a request header. If you later connect avaruchi.com, update `SITE_URL` and Google's allowed origin/callback together.

Set Razorpay's key ID, key secret and webhook secret. Configure the signed `payment.captured` webhook at:

```text
https://<actual domain>/api/webhook
```

For emailed invoice attachments, configure `RESEND_API_KEY` and `INVOICE_FROM_EMAIL` using a verified sender. Set business address, support email and GSTIN if applicable. Confirm final recipes, allergens, prices, shelf life, labels, business details and policies before setting `CATALOG_APPROVED=true` and `DEMO_MODE=false`. Keep `DEMO_ADMIN_ENABLED=false` in public environments.

Live orders are blocked until the merchant's business address and catalog approval are supplied. Missing Google, payment or email credentials are shown honestly in the application. No successful live provider connection is claimed by this package.

Manual courier details remain available. The optional Shiprocket adapter creates measured parcel orders, assigns AWBs, requests pickup and verifies delivery updates when enabled. Razorpay refunds submit the previously approved amount when explicitly enabled. Uncertain payment or shipment creation requires reconciliation instead of another booking. Invoice emails have a durable retry queue and a protected worker endpoint that must be scheduled by the hosting owner. PDFs are order invoices; complete GST accounting integration is not included.

## Local development

Use Node.js 22.x (Hostinger target). Copy `.env.example` to ignored `.env.local`, then fill in a test MySQL database. For local demonstration work set `DEMO_MODE=true`, `DEMO_ADMIN_ENABLED=true`, `ADMIN_DEMO_USER_ID` set to one exact preview account ID and `SITE_URL=http://127.0.0.1:5173`. All other demo accounts remain ordinary customers.

```sh
npm ci
npm run db:migrate
npm run dev
```

The development server uses port 5173. Production:

```sh
npm run build
npm start
```

Do not run development and production builds against the same `.next` directory simultaneously.

## Verification

`npm run test:integration` runs against port 5173 by default. Set `TEST_ORIGIN` to test a separate local production server. Run this **only against a disposable demo database with demo administration enabled**. It creates sample users/orders and adjusts test inventory.

Checks cover origin validation, exact coupon totals, account isolation, invoice PDFs, transactional stock limits, duplicate checkout, simultaneous duplicate requests/cancellation, saved data upserts, tracking transitions, payment rejection, OAuth rejection, real route metadata, product content and 404 pages. Actual Google OAuth, Razorpay capture and invoice email delivery require the owner's provider credentials and a live HTTPS domain for end-to-end verification.

Verified for this delivery: Node.js 22.23.3 on Linux, a successful production build, and the complete demo integration suite against MariaDB 11.4 using the MySQL adapter. Desktop browser checkout and narrow product/checkout layouts at 480 CSS pixels were checked.

## Source and assets

`app/storefront.tsx` holds the shared store state and page content. Each `app/**/page.tsx` renders that content through the persistent store context, with its own metadata and URL. Navigation uses Next.js links and router transitions, while basket state persists across pages.

`lib/server.ts` handles the store API. `lib/database.ts` provides parameterized MySQL queries, upserts and atomic InnoDB transactions. `lib/invoice.ts` renders branded A4 PDFs without filesystem storage. `database/001_store.sql` is the initial schema and `database/002_customer_service.sql` adds shipment and return/refund records. For an existing store, import all subsequent numbered SQL files before deploying this update. The migration script runs all numbered files and preserves existing data.

Product data and photography are illustrative concepts. `public/images/hero.png` and `public/images/pickles.png` were generated for this brand concept and are not photos of verified production stock. Replace them with the merchant's real product photographs before live sales.

## Responsive navigation and motion

The opaque header stays pinned as the announcement scrolls away. At 1000 px and below it uses two rows with 44 px navigation targets. Fluid gutters, type, two-column phone catalogs, stacked checkout forms, contained admin tables, dynamic viewport dialogs, and safe-area spacing cover narrow screens through wide desktops. Browser checks passed at 320, 390, 768, 1024 and 1440 CSS px; the 320 px cart and checkout stayed within the viewport.

Motion uses staged hero entrances, scroll reveals, product staggering, route fades, and cart/dialog entrance and exit transitions. Content remains visible in server HTML. All Motion components respect the operating system reduced-motion preference; no hover animations were added.

## Administrator security and verification

Admin routes require a valid server session and an single configured Google subject. Private demo administration additionally requires DEMO_MODE=true, DEMO_ADMIN_ENABLED=true and an exact ADMIN_DEMO_USER_ID. Missing configuration denies access. Disable both demo flags for a public live store. Admin inventory and order forms submit their original values so stale updates return 409 rather than overwriting a purchase or a second browser session. Invoice PDFs require customer ownership or separately authorized administration. Invoice email errors are reported; the setup panel requires complete credential pairs.

Automated checks cover authorization denial, session revocation, foreign-origin requests, customer invoice isolation, input validation, stale updates, stock concurrency and order transitions. These checks do not establish the absence of all vulnerabilities. Live Google, Razorpay and Resend flows and the final Hostinger configuration still require deployment verification.

## Customer panel update

The account page has Overview, Orders, Address & mobile, Returns & refunds, Invoices and Account help sections, with a familiar marketplace sidebar and task shortcuts. Address saving waits for the database response and validates the contact details on the server. Existing order addresses remain immutable. Customers can search/filter their orders, see their full delivery contact, download invoices, reorder, and use eligible cancellation.

Courier name, AWB, tracking link and delivery estimates are either saved manually or synchronized from the enabled Shiprocket adapter. Live Shiprocket access remains disabled until merchant credentials, pickup location and webhook token are configured. Credentials stay server-side.

After delivery, customers can open one return/refund case per order for damaged, incorrect, missing or quality-affected jars. Admin review, return transit/receipt, refund pending, resolution and rejection updates are saved with a dated customer-visible history. Duplicate submissions and stale updates return 409. Requests, invoices and shipment data are restricted to their owner or authorized administrator.

Refunds use a reviewed case and an approved amount capped at the order total. When RAZORPAY_REFUNDS_ENABLED=true, an administrator can submit that exact amount against the verified captured payment; stable idempotency and a durable operation record prevent a second submission. Signed refund events and administrator sync verify provider results before resolving the case. COD refunds use a separately verified merchant payment and reference. Returned food is never automatically restocked. Return courier pickups, photo uploads and complete GST credit-note accounting are not included. Reporting windows and real refund timing need merchant confirmation.

Run tests/customer-panel.mjs only against disposable local demo storage. The new flow passed 63 checks on MySQL and D1, including contact validation, account isolation, unsafe link denial, concurrent submissions, return stages and refund record limits.

## Marketplace panel design

The account overview links to working order, address, invoice, wishlist and support tools. Order cards show product imagery, purchase metadata, shipment status and direct order/reorder/invoice actions. Administration starts with actual store counts, attention items and recent orders. Its sidebar opens orders, returns, inventory, products, coupons and settings; orders include search, status filters and 25-row pagination, and inventory includes search. Both panels use square borders, warm paper and forest green, custom icons, skeleton loading, responsive navigation and reduced-motion support.

## Provider setup and recovery

All new shipping and payout switches default to false. The preview stays in demonstration mode, with live actions disabled. The provider tests use simulated responses and do not establish live credentials, delivery or payout success.

For Shiprocket, set SHIPROCKET_ENABLED=true, the API user's SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD, the exact configured SHIPROCKET_PICKUP_LOCATION and a random SHIPROCKET_WEBHOOK_TOKEN of at least 32 characters. In Shiprocket, configure the webhook at `https://<domain>/api/delivery-events` with that token in x-api-key. The store verifies each courier event by re-reading tracking from Shiprocket, matches its saved shipment and AWB, and never regresses a delivered order. Pack the order, enter the actual parcel dimensions/weight, create the shipment, assign the AWB and request pickup in that sequence. Failed/uncertain creation is reconciled against an existing Shiprocket order; unresolved AWB/pickup actions must be checked in Shiprocket and must not be repeated blindly. Reverse logistics still needs the merchant's food-return workflow.

For approved Razorpay refunds set RAZORPAY_REFUNDS_ENABLED=true. Enable payment.captured, refund.processed and refund.failed signed events at `/api/webhook`. Only captured online payments can be submitted to the refund API; demo and COD orders cannot. The merchant approves the amount before submission. A provider timeout leaves the case frozen until sync finds the matching refund. A confirmed failure permits manual reconciliation; the same action never starts another payout. Uncertain payment-order creation keeps inventory reserved and the order pending. The admin reconciliation form verifies its Razorpay receipt, amount and currency before attaching the original provider order.

Set CRON_SECRET to a unique random token of at least 32 characters. Schedule a POST to `https://<domain>/api/jobs/invoices` every minute using `Authorization: Bearer <CRON_SECRET>` in the request header. Keep the secret in the scheduler's private configuration, never in a URL or repository. Each call processes at most two due invoices. Failures use exponential backoff, a frozen payload and the same Resend idempotency key. After the safe 23-hour retry window, an ambiguous send needs provider review; it is not sent again automatically. The admin Store settings page shows waiting/review jobs and can process due invoices. Schedule installation is a hosting task; this repository does not install an external scheduler.

Run `npm run check:config` before deployment. `npm start` runs it automatically and rejects incomplete live configuration without printing secret values. `/api/health` checks database connectivity; it does not verify provider access or merchant details. Run numbered migrations before starting the updated application. Back up production MySQL before applying migrations; the provided migrations are additive and preserve existing order rows.

## Security regression coverage

The Hostinger edition passes the checkout/inventory/invoice integration suite, 67 admin-security assertions, 63 customer-panel assertions, 75 additional hardening assertions and 97 simulated-provider assertions. Tests cover PKCE and one-use OAuth state, HTTP-only sessions, customer isolation, exact administrator allowlisting, CSRF, bounded bodies and provider responses, persistent request throttles, signature verification, stale updates, stock transactions, payout approval locks, duplicate bookings, authoritative and out-of-order courier events, payment reconciliation and durable invoice retries. GitHub Actions runs these checks on an isolated MariaDB service and Node.js 22.

Security headers restrict framing, object embedding and browser permissions; the CSP allows Next/Motion's inline bootstrap/styles and Razorpay's checkout assets. No arbitrary provider destination URL is accepted. Secrets are excluded from Git and ZIP archives. Test counts and a clean dependency audit do not guarantee the absence of all bugs or vulnerabilities. Production OAuth, capture/refunds, sender verification, pickup serviceability, merchant policy accuracy, HTTPS, backups, hosting access, firewall/rate controls and the external scheduler require verification when the owner's accounts are ready.

Provider API references: [Shiprocket](https://apidocs.shiprocket.in/), [Razorpay idempotent refunds](https://github.com/razorpay/markdown-docs/blob/master/api/refunds/normal-refunds-idempotent.md), [Resend idempotency](https://resend.com/changelog/idempotency-keys).

### Single administrator

The store has one administrator identity. Set ADMIN_GOOGLE_SUB to exactly one verified Google subject ID. It takes precedence over preview administration, even when demo flags remain enabled. Comma-separated IDs, spaces, prefixed IDs and malformed values fail closed. When no Google administrator is configured, the owner-private demonstration can use the one exact ADMIN_DEMO_USER_ID with both demo flags enabled. Platform headers, matching email addresses, customer profiles and client-supplied roles cannot grant administrator rights. Changing the configured subject immediately removes the former account's admin authorization, including existing sessions. No customer or in-app admin invitation can create a second administrator.

Run `node tests/admin-access.mjs` to verify exclusive access and account replacement.
