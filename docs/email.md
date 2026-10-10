# Email (order, shipping, refund and staff alerts) and customer emails for marketing

## What gets sent
| Email | When | To |
|---|---|---|
| Order confirmation | payment captured | the customer |
| Shipped + FedEx tracking | staff save the tracking number on the order (a corrected number sends a new one) | the customer |
| Refund issued | a refund completes | the customer |
| New paid order | payment captured | staff (`COMPADRES_ADMIN_ALERT_EMAILS`) |
| Low / out of stock | an order drops a published product to or below its alert level (once per product, state and day) | staff |
| Needs review | a captured payment or a refund could not be recorded | staff |

No email contains card data or payment tokens.

## How it works
Every email is first written to the `email_outbox` table with a **dedupe key** (one per business event, so a repeated code path never double-sends), then sent right after the response (`after()`), with a **daily cron** (`/api/cron/email`, needs `CRON_SECRET`) as a retry net. Failures back off (5, 10, 15... minutes) and go `dead` after 5 attempts or on a permanent error; staff can retry from Admin > Emails. A failed or unconfigured email **never blocks or fails an order**. Admin > Emails shows status, the recent list, and "Send a test email to me" (always to your own address).

## Provider selection and gating (`src/lib/email/gate.ts`)
| `COMPADRES_EMAIL_PROVIDER` | Result |
|---|---|
| unset / `mock` | Mock (sends nothing). **Refused when `APP_ENV=production`.** |
| `resend`, not configured (key + valid From) | **Unavailable.** Emails stay queued; never mocked. |
| `resend`, configured | **Sandbox**: only staff addresses and `COMPADRES_EMAIL_TEST_ALLOWLIST` get real email; every other recipient is marked `skipped`. **Live** (customers get real email) only if `APP_ENV=production` AND `COMPADRES_EMAIL_PRODUCTION_APPROVED=true`. |

Resend setup: create an account, **verify your sending domain** (add the DNS records Resend shows), create an API key restricted to sending, then set the variables in `.env.example` (`node scripts/set-email.mjs .env.staging` prompts for the key without echo). The provider interface (`EmailProvider`) lets another service (Postmark, SES) be added without touching the callers.

## Customer emails for marketing
Every buyer's email is saved in `customers` when the order is placed (even if payment then fails). Marketing needs consent, so checkout has an **unticked** "Email me news and offers" box; ticking it stores `marketing_opt_in`, the time and the source. Admin > Customers shows the counts, a search, and a CSV export (owner/manager only, audited) with the consent columns. **Not built yet:** an unsubscribe link/page and any marketing sending. Before the first marketing email: add an unsubscribe flow (sets `marketing_opt_out_at`), include a postal address and unsubscribe link, and check that the marketing service and the law allow tobacco marketing (many services ban it). Order emails above are transactional and are separate from this.

## Not verified
Delivery through Resend has not been tested from this codebase (the provider is tested with a fake transport). Inbox placement depends on the domain's DNS records (SPF, DKIM) being set up correctly.
