# WebSocket driver security update

The root storefront and commerce API lockfiles contained `websocket-driver` 0.7.5 through Firebase's Realtime Database dependencies. Both installs now resolve **0.8.0**, with its required `websocket-extensions` 0.2.0. No Firebase SDK version, authentication configuration or application data is changed.

## Advisories addressed

| Upstream advisory | Fix |
| --- | --- |
| [GHSA-v36f-rjg3-3v46](https://github.com/faye/websocket-driver-node/security/advisories/GHSA-v36f-rjg3-3v46): draft75/76 message corruption and denial of service | Fixed parser; legacy drafts disabled by default. |
| [GHSA-c4gv-fww2-jp3r](https://github.com/faye/websocket-driver-node/security/advisories/GHSA-c4gv-fww2-jp3r): overflowing draft76 handshake keys | Invalid key values rejected; legacy drafts disabled by default. |
| [GHSA-9g4r-f5gq-qjrr](https://github.com/faye/websocket-driver-node/security/advisories/GHSA-9g4r-f5gq-qjrr): unsolicited pong callback crash | Fixed by the same release. |

All three upstream advisories identify versions below 0.8.0 as affected. See the [0.8.0 release notes](https://github.com/faye/websocket-driver-node/blob/main/CHANGELOG.md). The package's earlier 0.7.5 security fixes do not cover these November advisories.

## Dependency scope and exposure

- Storefront: `firebase` → `@firebase/database` → `faye-websocket` → `websocket-driver`.
- API: `firebase-admin` → `@firebase/database-compat` → `@firebase/database` → `faye-websocket` → `websocket-driver`.

Application imports use Firebase Auth, and no inbound WebSocket upgrade handler or legacy driver server was found in the application. Firebase's database transport uses Faye's modern outbound client. This limits the demonstrated application exposure; it does not make retaining an affected dependency appropriate.

Both `pnpm-workspace.yaml` files contain a scoped override from driver versions below 0.8.0 to 0.8.0. The lockfile changes replace only the driver and its extensions dependency. Faye's declared driver range permits the patched release. Legacy protocols remain disabled: no application configuration enables `allowDrafts`.

## Verification

`commerce-api/tests/websocket-driver-security.test.ts` resolves the real Firebase/Faye dependency chain independently in each install. Twelve checks cover:

- Default rejection of draft75 and draft76 handshakes.
- Correct legacy parser recovery without duplicate messages, tested with explicit opt-in only inside isolated tests.
- Rejection of overflowing draft76 keys even under that test-only opt-in.
- Modern client/server handshakes, bidirectional messages, ping callbacks and unsolicited pong handling.

The tests exchange bytes through in-memory streams. They do not open a listening port, connect to a remote host, use credentials or send attack traffic to production. Independent review verified Faye's client API, extensions option validation and Firebase Auth imports against the installed packages.

Local validation passed 406 tests; 16 database-only tests were skipped locally and require the isolated MySQL CI job. Lint, frontend/API TypeScript, the production build, public-secret scan, SSR rendering, Hostinger startup and commerce proxy checks also passed.

The first CI run exposed an existing test-data assumption: a payment test selected an arbitrary catalogue product, which could now be an intentionally zero-stock item. The payment, final-unit reservation and coupon persistence tests now create their own products with known stock and unique order numbers. Cleanup is scoped to their own records. Their financial assertions and production inventory rules are unchanged.

On 19 November 2026, npm audit did not yet report these newly published driver advisories. Audit results alone therefore do not establish this fix; installed resolutions and parser behavior were checked directly. The root audit reported zero findings. The API audit retained two moderate and one low finding in separate optional Firestore/Storage dependency paths; those were not changed by this targeted patch.

## Release scope

The update is intended for the GitHub review branch `codex/veg-nonveg-filter`. Remote `main` and Hostinger deployment remain unchanged at the owner's request. A live installation will retain its previous dependencies until a later approved deployment.
