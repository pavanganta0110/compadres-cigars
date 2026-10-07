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
- Phases 2-6: see the project brief (cart/compliance, payments, admin, FedEx/email, hardening).

## Warnings
- The 21+ gate is a notice, not identity verification. Checkout self-attestation (phase 2) carries regulatory and underwriting risk; confirm with the processor before launch.
- Legal pages are placeholders marked "Legal review required".
- Prices and Sugarhill story copy are drafts pending owner approval. Unknown cigar specs are intentionally blank.
- Nothing here is approved for production; provider gating arrives with the integrations.
