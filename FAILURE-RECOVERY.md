# Checkout and failure recovery

The public Hostinger store currently uses demo orders. Google sign-in, Razorpay,
Resend and Shiprocket remain disabled until the merchant supplies and verifies
those integrations. Demo success does not verify real charges or payouts.

| Failure                                                          | Store behavior                                                                               | Operator action                                                                                                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing page, product URL or API route                           | Branded page 404 or JSON 404. Wrong API method returns 405 with Allow.                       | Fix the referring link if it is a supported page; do not redirect every missing route to home.                                                            |
| Stock sold out, removed jar, invalid quantity, coupon or address | Server recomputes the basket and rejects the order. Removed sizes have a removal control.    | Update stock or coupon configuration; customer corrects the basket.                                                                                       |
| Double click or checkout response lost                           | Same checkout key replays the existing order; the browser keeps it for a reload in that tab. | Review orders before starting a different checkout. Restricted browser storage limits persistence to the open page.                                       |
| Provider order creation times out or returns incomplete data     | Order stays pending with reserved stock; same-key retries return a reconciliation warning.   | Match the merchant order receipt and amount to the provider order before attaching its reference in admin. Do not blindly create a second provider order. |
| Provider explicitly rejects order creation                       | Order is cancelled and stock restored transactionally.                                       | Correct gateway settings and start a new checkout after reviewing orders.                                                                                 |
| Payment script blocked, offline, or too slow                     | Bounded loading, single shared script request, orders link, retry available.                 | Check browser/network and gateway availability.                                                                                                           |
| Payment dismissed, declined or only authorized                   | No paid flag, fulfillment or invoice is produced from the browser failure event.             | Check the authoritative gateway payment and subsequent captured webhook. A failed event can precede a later capture.                                      |
| Signature, order, amount, currency or capture status mismatch    | Verification rejected. Replay of a valid confirmation creates one invoice.                   | Reconcile the order before accepting another payment or fulfilling it.                                                                                    |
| Customer session expires                                         | Protected APIs reject access. Orders refresh checks the session.                             | Sign in again; never expose another customer's order or invoice.                                                                                          |
| Temporary server or database failure                             | Safe API error, checkout recovery guidance, route/global fallback with retry.                | Check deployment logs and database health, then review any uncertain write before retrying.                                                               |
| Invoice email outage                                             | Invoice stays available as a PDF; durable jobs retain retries and leases.                    | Configure the authenticated invoice worker and examine jobs needing review.                                                                               |
| Shipping/refund response lost                                    | Durable provider operation guards prevent duplicate bookings/payouts.                        | Reconcile or sync the provider result, then resolve the customer case.                                                                                    |

## Verification

Run the CI workflow against a disposable local MySQL/MariaDB database. It checks
single-admin access, customer isolation, checkout/inventory races, signatures,
mocked payment declines/authorization/wrong amounts, uncertain provider results,
invoice retry leases, shipment/refund idempotency and storage/script/404 failures.
`npm run test:failures` and `npm run test:providers` must never target production.

Before accepting real sales, verify real gateway sandbox flows, webhook delivery
and replay, capture settings, email worker scheduling, courier setup, merchant
catalog and address, and a merchant-approved abandoned-order reconciliation
process. The application does not automatically release stock for an uncertain
online payment, since late payment confirmation must be reconciled first.

Payment event reference:
https://github.com/razorpay/markdown-docs/blob/master/webhooks/payments.md
