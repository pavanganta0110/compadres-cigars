# Brand royalties

Admin > **Royalties** (owner sets rates and records payouts; managers can view; the dashboard shows a "Brand royalties" panel).

## How a royalty is calculated
`royalty = brand rate x net product sales`
- **Net product sales** = item subtotal of **paid** orders (the single `PAID_STATUSES` definition) for that brand's products. **No tax, no shipping.** Pending and cancelled orders never count.
- **Refunds** reduce an order's royalty in proportion (a half refund halves it; a full refund removes it).
- **Rate in effect when the order was paid.** Rates are stored as a history (`brand_royalty_rates`), so changing a rate only affects later sales. The owner can pick an earlier "effective from" date to include sales already made.
- Rounding happens once per order and brand, half up, in cents.
- A line whose product was deleted has no brand and is not attributed.

## Paying brands
The system records what is earned, what has been paid (`royalty_payouts`) and what is **owed now** (earned all time minus paid). **It does not move money.** After paying a brand by check, ACH or wire, the owner records the payout (amount, date, reference); it cannot exceed what is owed. Rate changes and payouts are audited by database triggers (who, what, when). Export the period as CSV for statements.

## Limits and decisions to confirm
- The royalty base (net product sales, excluding tax and shipping) is an assumption: confirm it matches each brand's contract. It is one function (`src/lib/domain/royalties.ts`) if the contract differs (for example a flat amount per box or royalties on gross).
- Sales tax and shipping are excluded; payment-processor fees are not deducted.
- Per-brand statements by email and automatic payouts are not built.
