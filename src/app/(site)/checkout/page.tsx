import Link from "next/link";
import { messageFor } from "@/lib/domain/messages";
import { formatUsd } from "@/lib/domain/money";
import { readCart, resolveLines } from "@/lib/server/cart-store";
import { shippingProvider } from "@/lib/server/providers";
import { placeOrderAction } from "./actions";

export const metadata = { title: "Checkout" };

const STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");

export default async function Checkout({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const lines = await resolveLines(await readCart());
  if (lines.length === 0) return <main id="main" className="section"><h1>Checkout</h1><p>Your cart is empty. <Link href="/shop">Browse the collection</Link>.</p></main>;
  const subtotal = lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0);
  const rates = await shippingProvider().provider.rates({ state: "", postalCode: "", totalUnits: lines.reduce((n, l) => n + l.quantity, 0) });
  const msg = messageFor(error);
  return (
    <main id="main" className="section">
      <h1>Checkout</h1>
      <p className="notice" role="note">Payment is not connected yet. This sandbox step runs every compliance check and records the order as pending. No card is charged.</p>
      {msg && <p className="notice notice-error" role="alert">{msg}</p>}
      <form action={placeOrderAction} className="form-grid">
        <label className="wide">Email<input name="email" type="email" autoComplete="email" required /></label>
        <label className="wide">Full name<input name="fullName" autoComplete="name" required /></label>
        <label className="wide">Address<input name="line1" autoComplete="address-line1" required /></label>
        <label className="wide">Apartment, suite (optional)<input name="line2" autoComplete="address-line2" /></label>
        <label>City<input name="city" autoComplete="address-level2" required /></label>
        <label>State
          <select name="state" autoComplete="address-level1" required defaultValue="">
            <option value="" disabled>Select</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>ZIP code<input name="postalCode" inputMode="numeric" autoComplete="postal-code" required /></label>
        <fieldset className="wide" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ color: "var(--brass)" }}>Shipping (adult signature required)</legend>
          {rates.map((r, i) => (
            <label key={r.service} className="radio">
              <input type="radio" name="shippingService" value={r.service} defaultChecked={i === 0} required />
              <span>{r.label}: {formatUsd(r.cents)}</span>
            </label>
          ))}
        </fieldset>
        <label className="wide radio">
          <input type="checkbox" name="ageAttest" value="yes" required />
          <span>I confirm I am 21 years of age or older</span>
        </label>
        <div className="wide summary">
          {lines.map((l) => <div key={l.productId}><span>{l.name} × {l.quantity}</span><span>{formatUsd(l.unitPriceCents * l.quantity)}</span></div>)}
          <div><span>Subtotal</span><strong>{formatUsd(subtotal)}</strong></div>
          <p className="fine">Shipping and estimated sales tax are added when you place the order. Tax is an estimate based on your destination state.</p>
        </div>
        <div className="wide"><button className="btn" type="submit">Place order (sandbox)</button></div>
      </form>
    </main>
  );
}
