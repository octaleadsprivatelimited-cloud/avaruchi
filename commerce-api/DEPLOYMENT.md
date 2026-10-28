# Aavaruchi backend setup

Run all commands below from the repository root. Use Node.js 24, pnpm 11 and a running Docker daemon.

## Local configuration

```sh
pnpm setup:local
pnpm dev:local
```

Setup generates a private root `.env` only when missing, installs locked dependencies, starts `avaruchi` MySQL/Redis services, applies MySQL migrations and creates role permissions. It preserves subsequent configuration and refuses to target a database outside Aavaruchi's local setup. No business data or login accounts are seeded by default. Sample catalog fixtures require an explicit `SEED_CATALOG=true`.

API: `http://localhost:4010`. `GET /health` checks the process and `GET /ready` checks MySQL persistence. `pnpm --dir commerce-api db:smoke` checks the configured database connection. The root `.env` is ignored by Git and read by development, migration and seed commands.

## Isolated database tests

Create a dedicated local database; these commands only target the Aavaruchi MySQL container:

```sh
pnpm verify:db
```

`verify-database.mjs` validates the local Aavaruchi configuration, changes only the database name to `avaruchi_test`, migrates/seeds that database, then runs all API tests with database coverage enabled. It never resets a database. Tests temporarily change test inventory and clean up their own records. Normal `pnpm test:api` runs unit/API tests with database integration cases skipped.

## Production

Follow [`../HOSTINGER.md`](../HOSTINGER.md) and use root `.env.production.example` in the hosting secret manager. The active schema and migrations target MySQL; there is no alternate database migration tree.

Configure the real Aavaruchi origin, durable MySQL database and uploads, independent JWT/encryption secrets, and exact HTTPS CORS origins. The combined Node entry point applies migrations, waits for persistence and starts the notification worker. Run the local verification commands before deploying. GitHub Actions checks review branches before the Hostinger deployment from `main`.

Supply Aavaruchi's four Firebase web fields together and configure Google/authorized domains in Firebase. Set `STORE_ADMIN_EMAIL` to the verified Google account that should administer Aavaruchi. Check `/api/v1/auth/providers`, then verify customer and administrator sign-in. Email/password and phone OTP are disabled. Application sessions and disabled accounts are checked against MySQL.

Configure Razorpay live credentials and webhook signatures separately, plus shipping/delivery readiness and a verified Resend sender. Cashfree remains an optional alternative. Online payments are accepted only after server verification. Accepted COD orders and verified payments queue separate persisted customer and merchant notifications; the production worker retries eligible email delivery. Complete real business/support details and check provider delivery records before launch.

After a release, verify `/ready`, storefront pages, catalog uploads, authentication, controlled checkout and search feeds. Preserve encrypted backups and the integration encryption key. Roll back only to application code compatible with the deployed schema; never use `migrate dev`, `db push` or a database reset during production deployment.
