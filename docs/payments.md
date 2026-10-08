# Payments (Phase 3: sandbox + refunds)

Nothing here is approved for production. Live payments need (1) `APP_ENV=production`, (2) `COMPADRES_PAYMENT_PRODUCTION_APPROVED=true`, and (3) the processor's written approval to process tobacco sales. The code can only check (1) and (2).

## How a payment works
1. The browser collects the card and sends it **directly to the processor's tokenization endpoint** (the mock tokenizes in the browser). Card inputs have no `name`, so they are never posted to us. Our server receives only an opaque, single-use token. `payOrder` also refuses anything shaped like a card number.
2. `placeOrder` runs the compliance pipeline and creates the order (`pending`, stock reserved, 60 s idempotency lease).
3. `payOrder` (src/lib/server/payment-service.ts) then:
   - re-runs the **full** pipeline against the stored order (current restrictions, recorded unexpired age verification, live Adult Signature eligibility, tax, and that totals still match). Any failure: nothing is charged, the order stays `pending`, audit event `payment.blocked`;
   - claims the order in SQL (`begin_payment`). A unique index allows one authorizing/authorized/captured payment per order, so a double submit charges once;
   - authorizes, then captures. If capture fails the authorization is voided;
   - `complete_payment` moves the order `pending -> processing` and sets `paid_at` in one transaction.
4. A declined/failed payment leaves the order `pending`; the order page shows the message and a form to retry (a new attempt, same order).

"Paid" statuses are defined only in `src/lib/domain/operations.ts` (`PAID_STATUSES`, `STATUS_AFTER_PAYMENT`); a PGlite test pins the SQL to it.

## Provider selection (`src/lib/payments/gate.ts`)
| `COMPADRES_PAYMENT_PROVIDER` | Result |
|---|---|
| unset / `mock` | Mock processor. **Refused when `APP_ENV=production`** (payments unavailable). |
| `quickbooks`, not configured | **Unavailable.** Never silently mocked. |
| `quickbooks`, configured | Intuit **sandbox**, unless `APP_ENV=production` AND `COMPADRES_PAYMENT_PRODUCTION_APPROVED=true` (then live API host). |

Mock test cards: `4242 4242 4242 4242` approves, `4000 0000 0000 0002` declines.

## Refunds
Owner/manager only (`refund` permission) from the admin order page. The amount is validated in the action and again in SQL (`begin_refund` reserves it, so two clicks cannot exceed the captured total). The processor performs the refund, then `finish_refund` records it; the order becomes `refunded` when fully refunded. A refund can only go through the processor and mode that took the payment. Every step is audited (`refund.requested/completed/failed/rejected`). Refunds do not restock inventory.

## Webhooks
`POST /api/webhooks/payments`. The signature is verified over the raw body before parsing (mock: HMAC-SHA256 hex in `x-compadres-signature` using `COMPADRES_PAYMENT_WEBHOOK_SECRET`; QuickBooks: base64 HMAC in `intuit-signature` using the verifier token). Bad or missing signature: 401 and nothing is stored. Each event id is claimed in `payment_events` first, so replays are ignored. Only `charge.refunded` events change data (a refund made directly at the processor is recorded once); everything else is recorded in the audit log.

## QuickBooks Payments (Intuit)
OAuth2 authorization-code flow with scope `com.intuit.quickbooks.payment`. The owner clicks **Connect QuickBooks** on Admin > Payments. Refresh tokens rotate, so they are stored in `payment_credentials`, AES-256-GCM encrypted with `COMPADRES_TOKEN_ENCRYPTION_KEY` (never stored in the database). Set the variables with `node scripts/set-quickbooks.mjs .env.staging` (prompts, prints nothing) and in Vercel.

**Not yet verified against Intuit's sandbox from this codebase:** the provider is tested only with a fake transport built from Intuit's public API reference. Still to confirm in the sandbox: the browser can call the tokenization endpoint (CORS), the void-by-refund behaviour on an uncaptured charge, and what webhook events Intuit sends for Payments activity (today they are only recorded, never acted on).

## Audit and redaction
Audit actions: `payment.authorized`, `payment.declined`, `payment.authorize_failed`, `payment.capture_failed`, `payment.voided`, `payment.captured`, `payment.blocked`, `payment.reconcile_needed`, `refund.*`, `webhook.*`. `redact()` removes card-like numbers and any key matching card/pan/cvv/token/secret/key/authorization before insert.

## Known gaps
- No expiry/restock job for abandoned `pending` orders (stock stays reserved).
- A payment stuck in `authorizing`/`authorized` keeps blocking a second charge on that order by design; the Payments page lists them under "Needs review".
- Rejected webhooks are logged to the server console, not the database (to avoid unauthenticated writes).
