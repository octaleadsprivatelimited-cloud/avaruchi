# Aavaruchi configuration

Brand: **Aavaruchi**. Category: **cold-pressed edible oils**.

| Resource | Aavaruchi configuration |
| --- | --- |
| Storefront | http://localhost:5180 |
| API | http://localhost:4010 |
| MySQL | localhost:3310 / avaruchi |
| Redis, optional | localhost:6390 |
| Docker project | avaruchi |
| Docker volumes | avaruchi_mysql / avaruchi_redis, project scoped |
| Browser storage and sessions | Aavaruchi namespaces and token issuers |
| Production uploads | ~/.local/share/avaruchi/<domain>/uploads, or explicit UPLOAD_DIR |
| Source repository | https://github.com/octaleadsprivatelimited-cloud/avaruchi |
| Version control | Destination repository history retained; clone history removed; no GitHub workflows |
| Client integrations | Pending Aavaruchi provider configuration |

Run `pnpm setup:local` for dependency installation, a private local environment, migrations and role permissions. A fresh setup has an empty catalog, with no inherited customers, orders, sessions, coupons or integrations. Sample catalog code is retained and loads only with `SEED_CATALOG=true`. No customer or administrator account is seeded; `STORE_ADMIN_EMAIL` grants administrator access only after that Google identity is verified.

Production settings belong in the hosting secret manager. Use `.env.production.example`, then follow `HOSTINGER.md` and `commerce-api/DEPLOYMENT.md`. Required launch inputs include the real domain/database, Firebase project, verified admin email, business and support details, approved catalog, and required payment/shipping/email settings. Optional analytics remain disconnected until configured.

The project contains the complete storefront/backend source, MySQL migrations, tests and oil assets. Its private `.env` uses fresh local credentials and blank provider settings. `.gitignore` excludes private environments, dependencies, runtime data and generated builds. Prior build output, QA artifacts and deployment metadata were removed.
