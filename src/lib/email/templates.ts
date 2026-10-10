import { fedexTrackUrl } from "../domain/operations";
import { formatUsd } from "../domain/money";
import type { EmailKind } from "./types";

/** Pure templates: payload in, {subject, text, html} out. Everything interpolated into HTML is escaped. Never put card data here. */
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const safeUrl = (u: unknown) => (typeof u === "string" && /^https?:\/\/[^\s"'<>]+$/.test(u) ? u : null);

export type Address = { recipient?: string; line1?: string; line2?: string; city?: string; state?: string; postal_code?: string };
export type OrderLine = { name: string; quantity: number; unit_price_cents: number };
export type OrderPayload = {
  orderId: string; number: number; name?: string; items: OrderLine[]; subtotal_cents: number; shipping_cents: number; tax_cents: number; total_cents: number;
  address: Address; siteUrl?: string;
};
export type ShippedPayload = OrderPayload & { tracking: string; service?: string };
export type RefundPayload = { orderId: string; number: number; name?: string; amount_cents: number; fully: boolean; siteUrl?: string };
export type AdminOrderPayload = { orderId: string; number: number; total_cents: number; state?: string; items: OrderLine[]; siteUrl?: string };
export type LowStockPayload = { name: string; sku: string; stock: number; threshold: number; state: "low" | "out"; siteUrl?: string };
export type ReviewPayload = { what: string; number?: number; orderId?: string; siteUrl?: string };
export type TestPayload = { sentBy: string };

export type Rendered = { subject: string; text: string; html: string };
const shell = (title: string, body: string) => `<!doctype html><html><body style="margin:0;background:#f4f0e9;font-family:Arial,Helvetica,sans-serif;color:#1f1612"><div style="max-width:600px;margin:0 auto;padding:24px"><div style="background:#1f1612;color:#d6ad68;padding:18px 24px;font-size:20px;letter-spacing:.04em">Compadres Cigars</div><div style="background:#ffffff;padding:24px;border:1px solid #e3dccf"><h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>${body}</div><p style="font-size:12px;color:#5f554b;margin:16px 0 0">Compadres Cigars. For adults 21 and older.</p></div></body></html>`;
const linesHtml = (items: OrderLine[]) => `<table style="width:100%;border-collapse:collapse;font-size:14px">${items.map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(i.name)} &times; ${i.quantity}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${formatUsd(i.unit_price_cents * i.quantity)}</td></tr>`).join("")}</table>`;
const linesText = (items: OrderLine[]) => items.map((i) => `  ${i.name} x ${i.quantity}: ${formatUsd(i.unit_price_cents * i.quantity)}`).join("\n");
const addrLines = (a: Address) => [a.recipient, [a.line1, a.line2].filter(Boolean).join(" "), [a.city, a.state].filter(Boolean).join(", ") + (a.postal_code ? ` ${a.postal_code}` : "")].filter((s) => s && s.trim());
const totalsHtml = (p: OrderPayload) => `<p style="font-size:14px;line-height:1.7;margin:12px 0">Subtotal ${formatUsd(p.subtotal_cents)}<br>Shipping (adult signature) ${formatUsd(p.shipping_cents)}<br>Estimated sales tax ${formatUsd(p.tax_cents)}<br><strong>Total ${formatUsd(p.total_cents)}</strong></p>`;
const totalsText = (p: OrderPayload) => `Subtotal: ${formatUsd(p.subtotal_cents)}\nShipping (adult signature): ${formatUsd(p.shipping_cents)}\nEstimated sales tax: ${formatUsd(p.tax_cents)}\nTotal: ${formatUsd(p.total_cents)}`;
const SIGNATURE = "An adult 21 or older must be present with a valid photo ID to sign for this delivery.";
const link = (url: string | null, label: string) => (url ? `<p><a href="${esc(url)}" style="color:#7a4f0c">${esc(label)}</a></p>` : "");
const at = (siteUrl: string | undefined, path: string) => safeUrl(siteUrl ? `${siteUrl.replace(/\/+$/, "")}${path}` : null);

export function renderEmail(kind: EmailKind, payload: unknown): Rendered {
  switch (kind) {
    case "order_confirmation": {
      const p = payload as OrderPayload;
      const url = at(p.siteUrl, `/order/${p.orderId}`);
      return {
        subject: `Your Compadres Cigars order #${p.number} is confirmed`,
        text: `Thank you${p.name ? `, ${p.name}` : ""}! We received your payment for order #${p.number}.\n\n${linesText(p.items)}\n\n${totalsText(p)}\n\nShip to:\n${addrLines(p.address).map((l) => `  ${l}`).join("\n")}\n\n${SIGNATURE}\nWe will email you again with a FedEx tracking number when your order ships.${url ? `\n\nView your order: ${url}` : ""}\n`,
        html: shell(`Thank you${p.name ? `, ${p.name}` : ""}! Order #${p.number} is confirmed`, `<p>We received your payment.</p>${linesHtml(p.items)}${totalsHtml(p)}<p style="font-size:14px"><strong>Ship to</strong><br>${addrLines(p.address).map(esc).join("<br>")}</p><p style="font-size:14px">${esc(SIGNATURE)}</p><p style="font-size:14px">We will email you again with a FedEx tracking number when your order ships.</p>${link(url, "View your order")}`),
      };
    }
    case "order_shipped": {
      const p = payload as ShippedPayload;
      const track = fedexTrackUrl(p.tracking);
      return {
        subject: `Your Compadres Cigars order #${p.number} has shipped`,
        text: `Good news${p.name ? `, ${p.name}` : ""}: order #${p.number} is on its way by FedEx${p.service ? ` (${p.service})` : ""}.\n\nTracking number: ${p.tracking}\nTrack it: ${track}\n\nShipping to:\n${addrLines(p.address).map((l) => `  ${l}`).join("\n")}\n\n${SIGNATURE}\n`,
        html: shell(`Order #${p.number} has shipped`, `<p>Your order is on its way by FedEx${p.service ? ` (${esc(p.service)})` : ""}.</p><p style="font-size:16px"><strong>Tracking number: ${esc(p.tracking)}</strong></p>${link(track, "Track your package")}<p style="font-size:14px"><strong>Shipping to</strong><br>${addrLines(p.address).map(esc).join("<br>")}</p><p style="font-size:14px">${esc(SIGNATURE)}</p>`),
      };
    }
    case "refund_issued": {
      const p = payload as RefundPayload;
      return {
        subject: `Refund issued for order #${p.number}`,
        text: `We issued a ${p.fully ? "full" : "partial"} refund of ${formatUsd(p.amount_cents)} for order #${p.number}. It can take several business days to appear on your card statement.\n`,
        html: shell(`Refund issued for order #${p.number}`, `<p>We issued a ${p.fully ? "full" : "partial"} refund of <strong>${formatUsd(p.amount_cents)}</strong>.</p><p style="font-size:14px">It can take several business days to appear on your card statement.</p>`),
      };
    }
    case "admin_new_order": {
      const p = payload as AdminOrderPayload;
      const url = at(p.siteUrl, `/admin/orders/${p.orderId}`);
      return {
        subject: `New paid order #${p.number}: ${formatUsd(p.total_cents)}${p.state ? ` (${p.state})` : ""}`,
        text: `Order #${p.number} was paid: ${formatUsd(p.total_cents)}${p.state ? `, ship to ${p.state}` : ""}.\n\n${linesText(p.items)}\n\nPack it, then record the FedEx tracking number on the order.${url ? `\n${url}` : ""}\n`,
        html: shell(`New paid order #${p.number}`, `<p><strong>${formatUsd(p.total_cents)}</strong>${p.state ? ` to ${esc(p.state)}` : ""}</p>${linesHtml(p.items)}<p style="font-size:14px">Pack it, then record the FedEx tracking number on the order.</p>${link(url, "Open the order")}`),
      };
    }
    case "admin_low_stock": {
      const p = payload as LowStockPayload;
      const url = at(p.siteUrl, "/admin/products?filter=low");
      const out = p.state === "out";
      return {
        subject: `${out ? "OUT OF STOCK" : "Low stock"}: ${p.name}`,
        text: `${p.name} (${p.sku}) is ${out ? "out of stock" : `low: ${p.stock} left (alert level ${p.threshold})`}.${url ? `\nRestock: ${url}` : ""}\n`,
        html: shell(`${out ? "Out of stock" : "Low stock"}: ${p.name}`, `<p>${esc(p.name)} (${esc(p.sku)}) is ${out ? "<strong>out of stock</strong>" : `low: <strong>${p.stock}</strong> left (alert level ${p.threshold})`}.</p>${link(url, "Open products needing restock")}`),
      };
    }
    case "admin_needs_review": {
      const p = payload as ReviewPayload;
      const url = at(p.siteUrl, p.orderId ? `/admin/orders/${p.orderId}` : "/admin/payments");
      return {
        subject: `Needs review: ${p.what}${p.number ? ` (order #${p.number})` : ""}`,
        text: `${p.what}${p.number ? ` on order #${p.number}` : ""} needs a person to check the payment processor. Nothing further will happen automatically.${url ? `\n${url}` : ""}\n`,
        html: shell("Needs review", `<p>${esc(p.what)}${p.number ? ` on order #${p.number}` : ""} needs a person to check the payment processor. Nothing further will happen automatically.</p>${link(url, "Open in the admin")}`),
      };
    }
    case "admin_test": {
      const p = payload as TestPayload;
      return { subject: "Compadres Cigars test email", text: `This is a test email requested by ${p.sentBy}. If you can read it, email is working.\n`, html: shell("Test email", `<p>This is a test email requested by ${esc(p.sentBy)}. If you can read it, email is working.</p>`) };
    }
  }
}
