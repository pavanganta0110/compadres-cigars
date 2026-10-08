# Admin portal: tax, products, inventory, sales

## Tax rates (owner only, `manage_tax`)
Admin > Tax Rates edits the `tax_rates` table, which is the authority at checkout: the browser-facing quote, the pre-charge re-check and the SQL order function all read it. A change applies to new checkouts immediately; placed orders keep the rate they were charged (stored in each order's tax snapshot, marked `admin_override`). Every change is audited by a database trigger (before/after, who) plus an app event. Rates are 0 to 30 percent with two decimals. "Reset" restores the business-approved matrix value. Rates remain estimates and need tax-professional review.

## Products and inventory (`manage_products`)
- **Add product** creates a **draft**; drafts never appear in the store. Publish with the Published checkbox.
- Publishing requires a price above $0 and a box weight (FedEx cannot rate without one; checkout fails closed).
- Stock and the per-product **alert level** are edited inline. Unpublished products never alert.
- **Photos:** upload JPEG/PNG/WebP (max 4 MB) when adding a product or later from the list (add more, remove). Files are checked by their actual bytes (SVG and anything else is refused), stored in Postgres (`media` table) and served publicly at `/media/<id>` with a one-year immutable cache.

## Low-stock alerts
A published product at or below its alert level shows "Low stock", at 0 "Out of stock". They appear as a sidebar badge on Products, an "Inventory alerts" panel on the dashboard, and a "Needs restocking" filter. These are in-app alerts only: **email/SMS notifications are not built** (no email provider is connected yet).

## Sales dashboard
Dashboard and Analytics show sales today / 7 / 30 days, average order, a daily chart (with a table alternative) and best sellers, all from paid orders only (`PAID_STATUSES`). Figures are gross: refunds are shown in Sales & Tax, not subtracted here.

## Brands
Admin > Brands adds and edits brands (name, tagline, description, story, accent color, banner and logo images). New brands are **drafts**; an unpublished brand hides itself and all its products from the store. Brands use the default page template (the two custom templates are specific to Ronald Isley and Sugarhill).
