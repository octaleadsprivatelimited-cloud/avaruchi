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
5. Open that database in phpMyAdmin and import `database/001_store.sql` followed by `database/002_customer_service.sql`. The schema creates InnoDB tables and preserves existing table data. Alternatively, from an authenticated shell with the app's environment loaded, run `npm run db:migrate`. Schema migration is deliberately separate from the build; the build succeeds without a database connection.
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

Courier booking and live courier updates are not integrated. The administrator records packing, shipping, tracking reference and delivery. Captured or Razorpay-linked payment cancellation/refunds require reconciliation in Razorpay. Invoice email can be retried from administration; there is no background email retry scheduler. PDFs are order invoices; a complete GST accounting integration is not included.

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

`lib/server.ts` handles the store API. `lib/database.ts` provides parameterized MySQL queries, upserts and atomic InnoDB transactions. `lib/invoice.ts` renders branded A4 PDFs without filesystem storage. `database/001_store.sql` is the initial schema and `database/002_customer_service.sql` adds shipment and return/refund records. For an existing store, import the second file before deploying this update. The migration script runs both files and preserves existing data.

Product data and photography are illustrative concepts. `public/images/hero.png` and `public/images/pickles.png` were generated for this brand concept and are not photos of verified production stock. Replace them with the merchant's real product photographs before live sales.

## Responsive navigation and motion

The opaque header stays pinned as the announcement scrolls away. At 1000 px and below it uses two rows with 44 px navigation targets. Fluid gutters, type, two-column phone catalogs, stacked checkout forms, contained admin tables, dynamic viewport dialogs, and safe-area spacing cover narrow screens through wide desktops. Browser checks passed at 320, 390, 768, 1024 and 1440 CSS px; the 320 px cart and checkout stayed within the viewport.

Motion uses staged hero entrances, scroll reveals, product staggering, route fades, and cart/dialog entrance and exit transitions. Content remains visible in server HTML. All Motion components respect the operating system reduced-motion preference; no hover animations were added.

## Administrator security and verification

Admin routes require a valid server session and an explicit Google subject allowlist. Private demo administration additionally requires DEMO_MODE=true, DEMO_ADMIN_ENABLED=true and an exact ADMIN_DEMO_USER_ID. Missing configuration denies access. Disable both demo flags for a public live store. Admin inventory and order forms submit their original values so stale updates return 409 rather than overwriting a purchase or another administrator. Invoice PDFs require customer ownership or separately authorized administration. Invoice email errors are reported; the setup panel requires complete credential pairs.

Automated checks cover authorization denial, session revocation, foreign-origin requests, customer invoice isolation, input validation, stale updates, stock concurrency and order transitions. These checks do not establish the absence of all vulnerabilities. Live Google, Razorpay and Resend flows and the final Hostinger configuration still require deployment verification.

## Customer panel update

The account page has Overview, Orders, Address & mobile, Returns & refunds, Invoices and Account help sections, with a familiar marketplace sidebar and task shortcuts. Address saving waits for the database response and validates the contact details on the server. Existing order addresses remain immutable. Customers can search/filter their orders, see their full delivery contact, download invoices, reorder, and use eligible cancellation.

Courier name, AWB/tracking reference, HTTPS tracking link and estimated delivery are entered by the administrator. Shiprocket remains unconnected: no bookings, pickup requests, courier webhooks or live carrier updates run yet. Shipment records have a provider field for the later integration; Shiprocket credentials must stay server-side.

After delivery, customers can open one return/refund case per order for damaged, incorrect, missing or quality-affected jars. Admin review, return transit/receipt, refund pending, resolution and rejection updates are saved with a dated customer-visible history. Duplicate submissions and stale updates return 409. Requests, invoices and shipment data are restricted to their owner or authorized administrator.

Refund controls only record progress. The merchant processes and verifies payouts in Razorpay or its COD refund process before recording a reference. The completed amount cannot exceed the order total or change from the approved amount. No automatic bank transfer, refund API, food restocking, photo upload or background notification is included. Reporting windows and real refund timing still need merchant confirmation.

Run tests/customer-panel.mjs only against disposable local demo storage. The new flow passed 63 checks on MySQL and D1, including contact validation, account isolation, unsafe link denial, concurrent submissions, return stages and refund record limits.

## Marketplace panel design

The account overview links to working order, address, invoice, wishlist and support tools. Order cards show product imagery, purchase metadata, shipment status and direct order/reorder/invoice actions. Administration starts with actual store counts, attention items and recent orders. Its sidebar opens orders, returns, inventory, products, coupons and settings; orders include search, status filters and 25-row pagination, and inventory includes search. Both panels use square borders, warm paper and forest green, custom icons, skeleton loading, responsive navigation and reduced-motion support.
