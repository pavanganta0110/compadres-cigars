import Link from "next/link";
import { messageFor } from "@/lib/domain/messages";
import { formatUsd } from "@/lib/domain/money";
import { readCart, resolveLines } from "@/lib/server/cart-store";
import { CheckoutForm } from "./CheckoutForm";

export const metadata = { title: "Checkout" };

export default async function Checkout({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const lines = await resolveLines(await readCart());
  if (lines.length === 0) return <main id="main" className="section"><h1>Checkout</h1><p>Your cart is empty. <Link href="/shop">Browse the collection</Link>.</p></main>;
  const subtotal = lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0);
  return (
    <main id="main" className="section">
      <h1>Checkout</h1>
      <p className="notice" role="note">Payment is not connected yet. This sandbox step runs every compliance check and records the order as pending. No card is charged.</p>
      <div className="summary">
        {lines.map((l) => <div key={l.productId}><span>{l.name} × {l.quantity}</span><span>{formatUsd(l.unitPriceCents * l.quantity)}</span></div>)}
        <div><span>Subtotal</span><strong>{formatUsd(subtotal)}</strong></div>
        <p className="fine">Shipping and estimated sales tax are added when you place the order. Tax is an estimate based on your destination state.</p>
      </div>
      <CheckoutForm error={messageFor(error)} />
    </main>
  );
}
