import { notFound } from "next/navigation";
import { messageFor } from "@/lib/domain/messages";
import { formatUsd } from "@/lib/domain/money";
import { isPaid } from "@/lib/domain/operations";
import { serviceClient } from "@/lib/server/db";
import { paymentSetup } from "@/lib/server/providers";
import { PayForm } from "./PayForm";

export const metadata = { title: "Order received", robots: { index: false } };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = serviceClient();
  const { data: order } = await db.from("orders").select("id, number, status, subtotal_cents, shipping_cents, tax_cents, total_cents, order_items(name, quantity, unit_price_cents)").eq("id", id).maybeSingle();
  if (!order) notFound();
  const paid = isPaid(order.status);
  const { tokenizer } = await paymentSetup();
  return (
    <main id="main" className="section">
      <h1>Order #{order.number} received</h1>
      <p className="notice" role="note">Status: <strong>{order.status}</strong>. {paid ? "Payment received. Thank you." : "Payment has not been received yet, and nothing ships until it is."}</p>
      <div className="summary">
        {(order.order_items as { name: string; quantity: number; unit_price_cents: number }[]).map((i) => (
          <div key={i.name}><span>{i.name} × {i.quantity}</span><span>{formatUsd(i.unit_price_cents * i.quantity)}</span></div>
        ))}
        <div><span>Shipping (adult signature)</span><span>{formatUsd(order.shipping_cents)}</span></div>
        <div><span>Estimated sales tax</span><span>{formatUsd(order.tax_cents)}</span></div>
        <div><strong>Total</strong><strong>{formatUsd(order.total_cents)}</strong></div>
      </div>
      {!paid && order.status === "pending" && (tokenizer
        ? <PayForm orderId={order.id} tokenizer={tokenizer} error={messageFor(error)} />
        : <p className="notice notice-error" role="alert">{messageFor(error) ?? messageFor("payment_unavailable")}</p>)}
    </main>
  );
}
