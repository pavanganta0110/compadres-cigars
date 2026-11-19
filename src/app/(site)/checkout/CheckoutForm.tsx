"use client";
import { startTransition, useActionState, useState } from "react";
import { formatUsd } from "@/lib/domain/money";
import { calculateTax, type TaxRateRow } from "@/lib/domain/tax";
import { placeOrderAction, quoteAction, type QuoteState } from "./actions";
import { PaymentFields, useTokenizedSubmit, type Tokenizer } from "./PaymentFields";

const STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
const initial: QuoteState = { rates: [], quotedFor: "" };

export function CheckoutForm({ error, tokenizer, subtotalCents, taxRates }: { error?: string; tokenizer: Tokenizer | null; subtotalCents: number; taxRates: ({ state: string } & TaxRateRow)[] }) {
  const pay = useTokenizedSubmit(tokenizer);
  const [quote, quoteForm, quoting] = useActionState(quoteAction, initial);
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [service, setService] = useState("");
  // Call the action directly: submitting the form through formAction makes React 19 reset every field.
  const getRates = () => {
    const fd = new FormData();
    fd.set("state", state);
    fd.set("postalCode", zip);
    startTransition(() => quoteForm(fd));
  };
  const stale = quote.rates.length > 0 && quote.quotedFor !== `${state}|${zip.trim()}`;
  const ready = quote.rates.length > 0 && !stale;
  const chosen = ready ? (quote.rates.find((r) => r.service === service) ?? quote.rates[0]) : undefined;
  // Same pure function and rates table the server uses; the server re-computes it when the order is placed.
  const tax = chosen ? calculateTax(state, subtotalCents, new Map(taxRates.map((r) => [r.state, r]))) : undefined;
  const taxCents = tax && tax.ok ? tax.snapshot.tax_cents : undefined;

  return (
    <form action={placeOrderAction} onSubmit={pay.onSubmit} className="form-grid">
      {error && <p className="notice notice-error wide" role="alert">{error}</p>}
      <label className="wide">Email<input name="email" type="email" autoComplete="email" required /></label>
      <label className="wide">Full name<input name="fullName" autoComplete="name" required /></label>
      <label className="wide">Address<input name="line1" autoComplete="address-line1" required /></label>
      <label className="wide">Apartment, suite (optional)<input name="line2" autoComplete="address-line2" /></label>
      <label>City<input name="city" autoComplete="address-level2" required /></label>
      <label>State
        <select name="state" autoComplete="address-level1" required value={state} onChange={(e) => setState(e.target.value)}>
          <option value="" disabled>Select</option>
          {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label>ZIP code<input name="postalCode" inputMode="numeric" autoComplete="postal-code" required value={zip} onChange={(e) => setZip(e.target.value)} /></label>

      <div className="wide">
        <button className="btn" type="button" onClick={getRates} disabled={quoting}>{quoting ? "Getting rates…" : "Get shipping rates"}</button>
        {quote.error && <p className="notice notice-error" role="alert">{quote.error}</p>}
      </div>

      {ready && (
        <fieldset className="wide" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ color: "var(--brass)" }}>Shipping (adult signature required)</legend>
          {quote.rates.map((r) => (
            <label key={r.service} className="radio">
              <input type="radio" name="shippingService" value={r.service} checked={(chosen?.service ?? "") === r.service} onChange={() => setService(r.service)} required />
              <span>{r.label}: {formatUsd(r.cents)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {chosen && (
        <div className="summary wide" aria-live="polite">
          <div><span>Subtotal</span><span>{formatUsd(subtotalCents)}</span></div>
          <div><span>Shipping ({chosen.label})</span><span>{formatUsd(chosen.cents)}</span></div>
          <div><span>Estimated sales tax</span><span>{taxCents === undefined ? "Calculated at order" : formatUsd(taxCents)}</span></div>
          {taxCents !== undefined && <div><span>Total</span><strong>{formatUsd(subtotalCents + chosen.cents + taxCents)}</strong></div>}
        </div>
      )}
      {stale && <p className="notice wide" role="status">Your destination changed. Get shipping rates again.</p>}

      <label className="wide radio">
        <input type="checkbox" name="ageAttest" value="yes" required />
        <span>I confirm I am 21 years of age or older</span>
      </label>
      <label className="wide radio">
        <input type="checkbox" name="marketingOptIn" value="yes" />
        <span>Email me news and offers from Lion Cigars (optional). You can unsubscribe at any time.</span>
      </label>
      {tokenizer
        ? <PaymentFields tokenizer={tokenizer} error={pay.error} />
        : <p className="notice notice-error wide" role="alert">Payments are not available right now, so orders cannot be placed. Please try again later.</p>}
      <div className="wide"><button className="btn" type="submit" disabled={!ready || !tokenizer}>Place order and pay</button></div>
    </form>
  );
}
