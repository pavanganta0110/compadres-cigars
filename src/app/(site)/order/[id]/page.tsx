import { notFound } from "next/navigation";
import { formatUsd } from "@/lib/domain/money";
import { serviceClient } from "@/lib/server/db";

export const metadata = { title: "Order received", robots: { index: false } };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = serviceClient();
  const { data: order } = await db.from("orders").select("id, number, status, subtotal_cents, shipping_cents, tax_cents, total_cents, order_items(name, quantity, unit_price_cents)").eq("id", id).maybeSingle();
  if (!order) notFound();
  return (
    <main id="main" className="section">
      <h1>Order #{order.number} received</h1>
      <p className="notice" role="note">Status: <strong>{order.status}</strong>. Payment is not connected yet, so no card was charged.</p>
      <div className="summary">
        {(order.order_items as { name: string; quantity: number; unit_price_cents: number }[]).map((i) => (
          <div key={i.name}><span>{i.name} × {i.quantity}</span><span>{formatUsd(i.unit_price_cents * i.quantity)}</span></div>
        ))}
        <div><span>Shipping (adult signature)</span><span>{formatUsd(order.shipping_cents)}</span></div>
        <div><span>Estimated sales tax</span><span>{formatUsd(order.tax_cents)}</span></div>
        <div><strong>Total</strong><strong>{formatUsd(order.total_cents)}</strong></div>
      </div>
    </main>
  );
}
