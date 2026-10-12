# Legal pages (drafts)

All six pages are written from how the site actually behaves, **but they are drafts and have not been reviewed by a lawyer.** Each page shows a visible "Legal review required" notice, which should stay until counsel approves the text.

| Page | Source |
|---|---|
| Privacy Policy, Terms of Sale, Age Policy, Shipping Policy, Returns Policy, Shipping Restrictions | `src/lib/legal-content.ts` (text), `src/lib/legal.ts` (titles for the footer) |

- **Shipping Restrictions** lists the allowed and blocked states live from the `restriction_rules` table (Admin > Restrictions), so it never disagrees with checkout.
- **Contact details** come from `COMPADRES_CONTACT_EMAIL` (required before launch), `COMPADRES_CONTACT_PHONE`, `COMPADRES_BUSINESS_NAME`, `COMPADRES_BUSINESS_ADDRESS`. The page never invents an email address; Admin > Settings warns while the email is unset.
- **Business choices stated in the text** (`LEGAL_FACTS`): report damage within 7 days, aim to ship within 1 business day, Missouri governing law. Change them in one place and have counsel confirm.

## Things for the owner and a lawyer to confirm
- Return policy (no change-of-mind returns; 7-day damage window; refund of cigars less shipping and carrier charges for refused or returned packages).
- Governing law and venue (Missouri assumed from the business address).
- That the sales tax wording ("estimate based on a state-level rate") matches what your tax professional approves, and whether excise taxes apply.
- The age wording: the site collects a self-confirmation, and the carrier's ID check at delivery is the verification step. This carries regulatory and payment-processor risk and should be reviewed.
- Privacy rights language for the states you ship to, and the unsubscribe process (an unsubscribe link/page is not built yet; people are told to contact you).
- The two FTC cigar health warnings included on the Terms and Age pages.
