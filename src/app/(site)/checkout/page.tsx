import Link from "next/link";
import { messageFor } from "@/lib/domain/messages";
import { formatUsd } from "@/lib/domain/money";
import { readCart, resolveLines } from "@/lib/server/cart-store";
import { loadTaxRates } from "@/lib/server/checkout-service";
import { paymentSetup } from "@/lib/server/providers";
import { CheckoutForm } from "./CheckoutForm";

export const metadata = { title: "Checkout" };

export default async function Checkout({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const lines = await resolveLines(await readCart());
  if (lines.length === 0) return <main id="main" className="section"><h1>Checkout</h1><p>Your cart is empty. <Link href="/#brands">Browse the brands</Link>.</p></main>;
  const { tokenizer } = await paymentSetup();
  const taxRates = [...(await loadTaxRates()).entries()].map(([state, r]) => ({ state, ...r }));
  const subtotal = lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0);
  return (
    <main id="main" className="section">
      <h1>Checkout</h1>
      <div className="summary">
        {lines.map((l) => <div key={l.productId}><span>{l.name} × {l.quantity}</span><span>{formatUsd(l.unitPriceCents * l.quantity)}</span></div>)}
        <div><span>Subtotal</span><strong>{formatUsd(subtotal)}</strong></div>
        <p className="fine">Choose your shipping below to see shipping, estimated sales tax and your total. Tax is an estimate based on your destination state.</p>
      </div>
      <CheckoutForm error={messageFor(error)} tokenizer={tokenizer} subtotalCents={subtotal} taxRates={taxRates} />
    </main>
  );
}
