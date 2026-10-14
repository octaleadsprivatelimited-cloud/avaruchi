# Avaruchi — Cold Pressed Oils

Independent storefront and backend for **Avaruchi**. Source: [octaleadsprivatelimited-cloud/avaruchi](https://github.com/octaleadsprivatelimited-cloud/avaruchi). The cloned project's history was removed; Avaruchi's existing repository history is retained. No automated deployment is configured.

React 19, TypeScript, TanStack Start/Router, Vite, Tailwind, Node.js 24, Express and Prisma with MySQL 8.4. Includes catalog/search, volume and oil-combo variants, cart, wishlist, coupons, checkout, customer orders/support and an admin portal for products, inventory, marketing and settings. Google authentication, payments, shipping and transactional email require Avaruchi's own provider settings.

## Run locally

Install **Node.js 24**, **pnpm 11** and **Docker Desktop**, then start Docker.

```sh
pnpm setup:local
pnpm dev:local
```

Setup generates a private `.env` with fresh credentials if it is missing, installs locked dependencies, starts Avaruchi's MySQL/Redis containers, applies migrations and initializes role permissions. The catalog starts empty: no sample products, coupons, customers, orders, sessions or provider integrations are created. Setup preserves subsequent local configuration and refuses to use a database outside Avaruchi's local configuration. Keep `.env` private.

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

`verify` runs lint, TypeScript, API tests, the combined production build, a public asset secret scan and compiled storefront/startup smoke checks. `verify:db` creates and seeds `avaruchi_test` in the local Avaruchi container, then runs the entire API suite with database coverage. It temporarily changes test inventory while preserving the storefront database.

## Production setup

Use [`.env.production.example`](.env.production.example) as a hosting configuration checklist; replace placeholders in the hosting secret manager. Keep local `.env` and live provider keys out of shared source. [HOSTINGER.md](HOSTINGER.md) describes the combined Node.js storefront/API deployment; [CLIENT-SETUP.md](CLIENT-SETUP.md) lists Avaruchi's resources and remaining business configuration.

Before launch, provide Avaruchi's domain, hosted MySQL database, persistent uploads, Firebase project and verified admin Google email (`STORE_ADMIN_EMAIL`). Set actual business/support details, approved products, photos, prices, stock, tax and delivery settings. Configure payment, shipping, email and optional analytics providers as needed. Blank Firebase/admin configuration keeps sign-in disabled. Production checkout enforces provider readiness.

## Optional sample catalog

Sample product code and packaging illustrations are retained for development and tests. To explicitly load the eight sample oils and WELCOME10 coupon into the configured local database:

```sh
SEED_CATALOG=true pnpm --dir commerce-api seed
```

Keep `SEED_CATALOG=false` for an empty new store. The isolated database verification command enables fixtures only in `avaruchi_test`. Products marked `Catalog purpose: Sample` are excluded from search and merchant feeds. Authentication, payments, shipping, email and analytics code remain available; configure Avaruchi's own accounts before enabling them. Optional tracking starts disconnected and requires customer consent after provider configuration.
