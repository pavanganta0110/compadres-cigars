# Compadres Cigars

Regulated tobacco e-commerce on Next.js (App Router) + Supabase. Port of the verified WordPress/WooCommerce build.

## Run locally
```bash
cp .env.example .env.local        # fill from `npx supabase status -o env`
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,mailpit,realtime,storage-api,postgres-meta
npm run dev -- -p 3100
npm test && npm run test:e2e
```
`supabase db reset` re-applies `supabase/migrations` and `supabase/seed.sql`.

## Status
- **Phase 1 (this PR):** schema + RLS on every table, seed (2 products, **placeholder prices**), 21+ signed-cookie gate, storefront, brand pages, placeholder legal pages.
- **Phase 3:** payments sandbox + refunds (mock and QuickBooks Payments providers, webhook, admin refunds). See [docs/payments.md](docs/payments.md).
- Phases 2, 4, 5: checkout compliance, admin portal, FedEx. Remaining: email, hardening.

## Warnings
- The 21+ gate is a notice, not identity verification. Checkout self-attestation (phase 2) carries regulatory and underwriting risk; confirm with the processor before launch.
- Legal pages are placeholders marked "Legal review required".
- Prices and Sugarhill story copy are drafts pending owner approval. Unknown cigar specs are intentionally blank.
- Nothing here is approved for production. Providers go live only if `APP_ENV=production` AND the matching `*_PRODUCTION_APPROVED=true`; payments additionally need the processor's written approval for tobacco.
- Payments are exercised only against the mock and (once connected) Intuit's sandbox. The QuickBooks provider has not yet been run against Intuit's sandbox.
