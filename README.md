# Aavaruchi — Pickles

Independent storefront and backend for **Aavaruchi**. Source: [octaleadsprivatelimited-cloud/avaruchi](https://github.com/octaleadsprivatelimited-cloud/avaruchi). The cloned project's history was removed; Aavaruchi's existing repository history is retained. The storefront retains the supplied brand artwork and product illustrations, with illustration disclosures on product pages.

React 19, TypeScript, React Router, Vite, Tailwind, Node.js 24, Express and Prisma with MySQL 8.4. Vite builds the browser app and a plain React server-rendering entry; there are no TanStack dependencies. Includes catalog/search, selectable product variants, cart, wishlist, coupons, checkout, customer orders/support and an admin portal for products, inventory, combos, marketing and settings. The Express API provides authentication, persistent storage and payment verification. Google authentication, payments, shipping and transactional email require Aavaruchi's own provider settings.

## Run locally

Install **Node.js 24**, **pnpm 11** and **Docker Desktop**, then start Docker.

```sh
pnpm setup:local
pnpm dev:local
```

Setup generates a private `.env` with fresh credentials if it is missing, installs locked dependencies, starts Aavaruchi's MySQL/Redis containers, applies migrations and initializes role permissions. The catalog starts empty: no sample products, coupons, customers, orders, sessions or provider integrations are created. Setup preserves subsequent local configuration and refuses to use a database outside Aavaruchi's local configuration. Keep `.env` private.

Open **http://localhost:5180/**. The API runs at **http://localhost:4010/**; `/ready` checks database connectivity. MySQL uses port **3310**, database **avaruchi**; optional Redis uses **6390**. Docker project: **avaruchi**.

On macOS, double-click `START-WEBSITE.command` to set up and open the website, or `OPEN-WEBSITE.command` to open an already running website. The launcher waits for both the API and storefront before opening the browser. Press Control-C to stop services started by the launcher.

To run the processes separately:

```sh
pnpm dev:api
# Another terminal
pnpm dev
```

## Verify

```sh
pnpm verify
# Database integration tests, using an isolated seeded test database:
pnpm verify:db
```

`verify` runs lint, TypeScript, API tests, the combined production build, a public asset secret scan and compiled storefront/startup smoke checks. `verify:db` creates and seeds `avaruchi_test` in the local Aavaruchi container, then runs the entire API suite with database coverage. It temporarily changes test inventory while preserving the storefront database.

## Hostinger deployment

Hostinger runs the complete React storefront, Express API, persistent uploads and notification worker in one Node.js 24 application. MySQL runs locally in the hosting account. Use `pnpm build:hostinger`, entry file `hostinger.mjs`, and output directory `.`. All browser API requests use the same Hostinger domain; leave `VITE_COMMERCE_API_URL`, `COMMERCE_BACKEND_URL` and `AVARUCHI_PROXY_SECRET` unset. [HOSTINGER.md](HOSTINGER.md) documents the production environment and release checks. Vercel automatic deployments are disabled in `vercel.json`.

## CI/CD

GitHub Actions runs `.github/workflows/ci.yml` for pushes to `main` and `codex/**`, and pull requests to `main`. It starts an isolated MySQL 8.4 service, applies migrations, runs database persistence tests, checks lint/types, builds the production release, and exercises the rendering and deployment adapters. The workflow uses disposable test credentials and never connects to production storage. Hostinger uses its native GitHub connection for continuous deployment from `main`; hosting credentials stay in its platform settings.

The backend catalog is the source of products and prices. The reference site's demo products, coupons and checkout state are not imported into the new database.

## Combo packages

Admin → Combos groups packs from at least two existing products into a named package. Save a draft, publish it on `/combos`, or archive it when it is no longer offered. Package totals and availability come from the current component prices and stock; creating a package does not change either. An optional existing coupon is checked using the normal cart and checkout eligibility rules.

Adding a package puts its component packs into the bag together. They remain individual order and inventory items, using the existing checkout, payment, cancellation and notification flows. No packages or discounts are published automatically.

## Production setup

Use [`.env.production.example`](.env.production.example) as a hosting configuration checklist; replace placeholders in the hosting secret manager. Keep local `.env` and live provider keys out of shared source. [HOSTINGER.md](HOSTINGER.md) describes the combined Node.js storefront/API deployment; [CLIENT-SETUP.md](CLIENT-SETUP.md) lists Aavaruchi's resources and remaining business configuration.

Before launch, provide Aavaruchi's domain, hosted MySQL database, persistent uploads, Firebase project and verified admin Google email (`STORE_ADMIN_EMAIL`). Set actual business/support details, approved products, photos, prices, stock, tax and delivery settings. Configure payment, shipping, email and optional analytics providers as needed. Blank Firebase/admin configuration keeps sign-in disabled. Production checkout enforces provider readiness.

## Optional sample catalog

Sample product code and packaging illustrations are retained for development and tests. To explicitly load the eight sample oils and WELCOME10 coupon into the configured local database:

```sh
SEED_CATALOG=true pnpm --dir commerce-api seed
```

Keep `SEED_CATALOG=false` for an empty new store. The isolated database verification command enables fixtures only in `avaruchi_test`. Products marked `Catalog purpose: Sample` are excluded from search and merchant feeds. Authentication, payments, shipping, email and analytics code remain available; configure Aavaruchi's own accounts before enabling them. Optional tracking starts disconnected and requires customer consent after provider configuration.
