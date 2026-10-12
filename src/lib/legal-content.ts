/**
 * DRAFT legal text, written from how this site actually behaves. It is NOT legal advice and has not been reviewed by a lawyer:
 * every page keeps its "Legal review required" notice until one approves it. Business facts that only the owner knows live in
 * LEGAL_FACTS so they can be changed in one place.
 */
export const LEGAL_UPDATED = "October 11, 2026";

export type Contact = { name: string; address: string; email: string | null; phone: string | null };
export function contactFromEnv(env: Record<string, string | undefined> = process.env): Contact {
  const t = (v: string | undefined) => (v ?? "").trim() || null;
  return { name: t(env.COMPADRES_BUSINESS_NAME) ?? "Lion Cigars", address: t(env.COMPADRES_BUSINESS_ADDRESS) ?? "1111 E. 73rd St, Kansas City, MO 64131", email: t(env.COMPADRES_CONTACT_EMAIL), phone: t(env.COMPADRES_CONTACT_PHONE) };
}
/** Business choices stated in the policies. Change them here (and have counsel confirm) rather than in the prose. */
export const LEGAL_FACTS = { reportWindowDays: 7, shipTargetBusinessDays: 1, governingState: "Missouri" } as const;

export type Block = { h: string; p?: string[]; ul?: string[] };
export type LegalDoc = { intro: string; blocks: (c: Contact) => Block[] };

const how = (c: Contact) => [c.email ? `email ${c.email}` : null, c.phone ? `call ${c.phone}` : null, `write to ${c.name}, ${c.address}`].filter(Boolean).join(", or ");
const contactBlock = (c: Contact): Block => ({ h: "Contact us", p: [`Questions about this page or your order? You can ${how(c)}.`] });
const WARNINGS = ["SURGEON GENERAL WARNING: Cigars Are Not A Safe Alternative To Cigarettes.", "SURGEON GENERAL WARNING: Cigar Smoking Can Cause Cancers Of The Mouth And Throat, Even If You Do Not Inhale."];

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  privacy: {
    intro: "This policy explains what personal information Lion Cigars collects when you use this website or buy from us, why we collect it, who we share it with, and the choices you have.",
    blocks: (c) => [
      { h: "Who we are", p: [`${c.name} (“we”, “us”) operates this website and sells premium cigars by the box to adults aged 21 and over. Our address is ${c.address}.`] },
      { h: "What we collect", ul: [
        "Order details you give us: your name, email address, shipping address (street, city, state, ZIP code), the items you order and the shipping option you choose.",
        "Age confirmation: that you confirmed you are 21 or older, with the date and time and a reference number. We do not collect your date of birth or images of your ID.",
        "Payment information: you type your card details into fields that send them directly to our payment processor. We never receive, see or store your full card number, expiry date or security code. We keep only a processor reference, the amount and the status of the payment (approved, declined, refunded).",
        "Delivery information: the tracking number and delivery status of your shipment.",
        "Your preferences: whether you chose to receive marketing email (optional, and never pre-selected).",
        "Technical data: our servers record routine security logs such as your IP address and browser type.",
      ] },
      { h: "Cookies", p: ["We use only the cookies the site needs to work: one that remembers you confirmed you are 21 or older (signed so it cannot be altered), one that holds your shopping cart, and one that identifies your checkout session so an order is never placed twice. Staff sign-in cookies are used only by our team. We do not currently use advertising or analytics cookies."] },
      { h: "How we use your information", ul: [
        "To process, pay for, ship and, if needed, refund your order, and to email you an order confirmation, a shipping notice with your tracking number, and any refund notice.",
        "To check that an order can lawfully be shipped to your address and to confirm the age requirement.",
        "To prevent fraud and duplicate orders and to keep the site secure.",
        "To answer your questions and resolve problems with an order.",
        "To send marketing email, but only if you chose to receive it.",
        "To keep records and meet our tax, legal and regulatory obligations.",
      ] },
      { h: "Who we share it with", p: ["We share information only with the companies that help us run the store, and only what they need:"], ul: [
        "Our payment processor, which handles your card details and the payment.",
        "FedEx, which receives your name, delivery address and package details to deliver your order, including the adult signature requirement.",
        "Our email delivery provider, which sends the emails described above.",
        "Our website hosting and database providers (Vercel and Supabase), which store the information in this policy on our behalf.",
        "Tax authorities, regulators, courts or law enforcement when the law requires it.",
      ] },
      { h: "We do not sell your information", p: ["We do not sell your personal information and we do not share it with third parties for their own advertising."] },
      { h: "How long we keep it", p: ["We keep order, payment-reference and age-confirmation records for as long as we need them for tax, legal, regulatory and dispute purposes. Marketing preferences are kept until you unsubscribe. When we no longer need information we delete or anonymize it."] },
      { h: "Your choices and rights", ul: [
        "You can stop marketing email at any time by contacting us, and we will stop.",
        "You can ask what information we hold about you, ask us to correct it, or ask us to delete it. We may have to keep some records (for example orders) to meet legal duties.",
        "Depending on where you live, state law may give you additional rights over your personal information. We will honor valid requests as the law requires.",
      ], p: ["To make a request, contact us using the details at the bottom of this page. We may need to confirm your identity first."] },
      { h: "Security", p: ["The site uses encrypted connections, access controls and logging, and your card details never reach our servers. No system is perfectly secure, so we cannot guarantee absolute security."] },
      { h: "Adults only", p: ["This site is for adults aged 21 and over. We do not knowingly collect information from anyone under 21."] },
      { h: "Changes", p: [`We may update this policy. The date at the top shows when it last changed (${LEGAL_UPDATED}).`] },
      contactBlock(c),
    ],
  },

  terms: {
    intro: "These terms apply when you buy from Lion Cigars through this website. By placing an order you agree to them.",
    blocks: (c) => [
      { h: "Who can buy", ul: ["You must be at least 21 years old.", "It must be legal for you to buy and receive tobacco products at your delivery address.", "Orders are for your own personal use. You may not buy to resell, and you may not provide tobacco products to anyone under 21.", "The information you give us must be accurate and complete."] },
      { h: "Products and prices", p: ["Cigars are sold by the box only. Descriptions and photographs are provided in good faith, and natural tobacco varies in color and appearance. Prices are in US dollars and may change at any time before you place an order. If a price or description is wrong, we may correct it and give you the choice to proceed or cancel. We may limit quantities."] },
      { h: "Your order", p: ["Your order is an offer to buy. We accept it when your payment is approved and we have confirmed the order can lawfully be shipped. We may refuse or cancel an order, in whole or in part, if:"], ul: ["the delivery address is in a place where we cannot ship (see Shipping Restrictions);", "we cannot confirm the age requirement;", "an item is out of stock or a price was shown in error;", "we suspect fraud or misuse."], },
      { h: "If we cancel", p: ["If we cancel an order after you have paid, we will refund the full amount you paid for it."] },
      { h: "Payment", p: ["We accept the payment methods shown at checkout. Your card details go directly to our payment processor and are not stored on our servers. Payment is taken when you place your order. If your payment is declined, no order is completed and you are not charged; you can try again with another card."] },
      { h: "Taxes", p: ["Estimated sales tax is calculated from your delivery state and shown before you pay; it is an estimate based on a state-level rate. Shipping is shown separately. You are responsible for any other tax or duty that applies where you live, if the law requires you to pay it."] },
      { h: "Shipping and delivery", p: ["We ship by FedEx and every package requires an adult signature. See our Shipping Policy and Age Policy for how delivery works. Risk of loss passes to you when the package is delivered and signed for."] },
      { h: "Returns and refunds", p: ["Because cigars are perishable tobacco products, returns are limited. See our Returns Policy."] },
      { h: "Health notice", p: ["Tobacco use is dangerous to your health.", ...WARNINGS] },
      { h: "Our content", p: ["The brand names, logos, photographs and text on this site belong to Lion Cigars or its licensors. You may not copy or use them without our written permission."] },
      { h: "Our responsibility", p: ["To the fullest extent the law allows, our liability for any claim about an order is limited to the amount you paid for that order, and we are not liable for indirect or consequential losses. Nothing in these terms limits any right you have under law that cannot be limited."] },
      { h: "Governing law", p: [`These terms are governed by the laws of the State of ${LEGAL_FACTS.governingState}, without regard to its conflict-of-laws rules, and the courts located in ${LEGAL_FACTS.governingState} will handle disputes, except where the law of your state requires otherwise.`] },
      { h: "Changes", p: [`We may update these terms. The version that applies to your order is the one shown when you placed it. Last updated ${LEGAL_UPDATED}.`] },
      contactBlock(c),
    ],
  },

  "age-policy": {
    intro: "You must be 21 or older to enter this site, buy from it or receive a delivery from us. This is the law and it is our rule.",
    blocks: (c) => [
      { h: "Where we check", ul: [
        "When you enter the site: you must confirm that you are 21 or older before you can browse.",
        "At checkout: you must confirm again that you are 21 or older before you can place an order. We check this on our server, so it cannot be skipped.",
        "At delivery: every order ships with a FedEx adult signature requirement. The person who receives the package must be 21 or older, must show a valid government-issued photo ID, and must sign. This is the step where the carrier checks age against ID.",
      ] },
      { h: "What you are confirming", p: ["The confirmations on the site are your own statement that you are 21 or older. Giving false information to buy tobacco, or buying tobacco for someone under 21, may be a crime and will lead to the order being cancelled."] },
      { h: "If no adult is available at delivery", p: ["FedEx may try again or return the package to us. See the Shipping Policy for what happens next. We cannot leave a package without a signature."] },
      { h: "If we have doubts", p: ["We may cancel and refund any order if we have reason to believe the buyer or recipient is under 21."] },
      { h: "What we keep", p: ["We keep a record that you confirmed your age, with the date, time and a reference number, as part of your order. We do not collect your date of birth or a copy of your ID."] },
      { h: "Future changes", p: ["We may add identity-based age verification in the future. If we do, this page will be updated."] },
      { h: "Health notice", p: ["Tobacco use is dangerous to your health.", ...WARNINGS] },
      contactBlock(c),
    ],
  },

  shipping: {
    intro: "How and where we ship, what to expect at delivery, and what happens when a delivery does not go as planned.",
    blocks: (c) => [
      { h: "Carrier and adult signature", p: ["We ship with FedEx. Every order requires an adult signature (21 or older, with valid government-issued photo ID). There are no exceptions and we cannot leave a package at the door. Please make sure an adult will be available to sign."] },
      { h: "Where we ship", ul: ["To street addresses in the United States where we are permitted to ship (see Shipping Restrictions).", "We do not ship to P.O. boxes, military (APO/FPO) addresses, or outside the United States.", "We may decline to ship to any address where we believe shipment is not lawful."] },
      { h: "Processing time", p: [`We pack your order after your payment is approved and our compliance checks pass. We aim to ship within ${LEGAL_FACTS.shipTargetBusinessDays} business day (Monday to Friday, excluding holidays). Orders can take longer in busy periods or extreme weather.`] },
      { h: "Shipping cost", p: ["Your shipping options and price are calculated from FedEx rates for your address and your order, and shown before you pay. Shipping is added to your order total."] },
      { h: "Tracking", p: ["When your order ships we email you a FedEx tracking number and link."] },
      { h: "Delivery attempts, refusals and returns to us", ul: [
        "If no adult is available to sign, or the recipient cannot show valid ID, FedEx will follow its own rules, which may include further attempts or holding the package.",
        "If a package is refused or returned to us, we will contact you. Once it is back with us unopened, we will refund the price of the cigars less the original shipping charge and any carrier return charges.",
        "Please give a correct and complete address. We cannot change an address after a package has shipped.",
      ] },
      { h: "Damaged or lost packages", p: [`If your package arrives damaged, or does not arrive, contact us within ${LEGAL_FACTS.reportWindowDays} days. See the Returns Policy.`] },
      contactBlock(c),
    ],
  },

  returns: {
    intro: "Cigars are perishable tobacco products, so our return rules are different from most stores. Here is exactly what we will and will not do.",
    blocks: (c) => [
      { h: "What we will fix", p: [`If your order arrives damaged, is not what you ordered, or has a defect, contact us within ${LEGAL_FACTS.reportWindowDays} days of delivery with your order number and photos. We will replace the item or refund it.`] },
      { h: "What we cannot accept", ul: ["Change of mind after an order has shipped.", "Boxes that have been opened, and cigars that have been smoked or stored improperly.", "Packages refused at delivery or undeliverable because no adult 21 or older could sign (see the Shipping Policy)."] },
      { h: "Cancelling an order", p: ["If you need to cancel, contact us right away. If your order has not been packed we will cancel it and refund you in full. Once an order has shipped it cannot be cancelled."] },
      { h: "How refunds work", ul: ["Refunds go back to the card you paid with, through our payment processor, for the full or partial amount we agree.", "We email you when a refund is issued. It can take several business days to appear on your statement, depending on your bank.", "Shipping charges are refunded only when the problem was our mistake."] },
      { h: "Sending items back", p: ["Please do not ship tobacco back to us without our approval. If we ask for an item to be returned, we will give you instructions and, where the problem is our error, cover the return cost."] },
      { h: "Before you dispute a charge", p: ["Please contact us first. We are happy to put things right and it is usually faster than a bank dispute."] },
      contactBlock(c),
    ],
  },

  restrictions: {
    intro: "Tobacco shipping laws differ by state and sometimes by city or county. This page lists where we can and cannot ship. It is maintained by our team and is not a complete statement of the law.",
    blocks: (c) => [
      { h: "Rules that apply everywhere", ul: [
        "We ship only within the United States, to street addresses, with an adult signature (21 or older).",
        "We do not ship to P.O. boxes, military (APO/FPO) addresses, the District of Columbia, U.S. territories, or other countries.",
        "Some states and localities restrict or prohibit internet sales of tobacco, require licences, limit quantities, or tax tobacco differently. You are responsible for knowing and following the laws that apply where you live.",
      ] },
      { h: "If we cannot ship to you", p: ["If your address is in a place where we cannot ship, checkout will tell you before you pay. If an order is placed in error to a restricted destination, we may cancel it at any time, including after payment, and we will refund you in full."] },
      { h: "Changes", p: ["We update this list as laws and our shipping arrangements change, and we may do so without notice. The state lists below reflect our current settings."] },
      contactBlock(c),
    ],
  },
};

export const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
