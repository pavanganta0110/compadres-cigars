"use client";
import { startTransition, useActionState, useState } from "react";
import { formatUsd } from "@/lib/domain/money";
import { placeOrderAction, quoteAction, type QuoteState } from "./actions";
import { PaymentFields, useTokenizedSubmit, type Tokenizer } from "./PaymentFields";

const STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
const initial: QuoteState = { rates: [], quotedFor: "" };

export function CheckoutForm({ error, tokenizer }: { error?: string; tokenizer: Tokenizer | null }) {
  const pay = useTokenizedSubmit(tokenizer);
  const [quote, quoteForm, quoting] = useActionState(quoteAction, initial);
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  // Call the action directly: submitting the form through formAction makes React 19 reset every field.
  const getRates = () => {
    const fd = new FormData();
    fd.set("state", state);
    fd.set("postalCode", zip);
    startTransition(() => quoteForm(fd));
  };
  const stale = quote.rates.length > 0 && quote.quotedFor !== `${state}|${zip.trim()}`;
  const ready = quote.rates.length > 0 && !stale;

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
          {quote.rates.map((r, i) => (
            <label key={r.service} className="radio">
              <input type="radio" name="shippingService" value={r.service} defaultChecked={i === 0} required />
              <span>{r.label}: {formatUsd(r.cents)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {stale && <p className="notice wide" role="status">Your destination changed. Get shipping rates again.</p>}

      <label className="wide radio">
        <input type="checkbox" name="ageAttest" value="yes" required />
        <span>I confirm I am 21 years of age or older</span>
      </label>
      {tokenizer
        ? <PaymentFields tokenizer={tokenizer} error={pay.error} />
        : <p className="notice notice-error wide" role="alert">Payments are not available right now, so orders cannot be placed. Please try again later.</p>}
      <div className="wide"><button className="btn" type="submit" disabled={!ready || !tokenizer}>Place order and pay</button></div>
    </form>
  );
}
