import { describe, expect, it } from "vitest";
import { parseList, recipientAllowed, selectEmail } from "./gate";
import { MockEmailProvider } from "./mock";
import { fromAddressOk, RESEND_URL, ResendEmailProvider, type HttpRequest, type HttpResponse } from "./resend";
import { renderEmail, type OrderPayload, type ShippedPayload } from "./templates";

const base = { appEnv: "local", provider: undefined, approved: undefined, resendConfigured: false };
describe("email gating", () => {
  it("unset/mock is the mock outside production only", () => {
    expect(selectEmail(base)).toEqual({ kind: "mock", mode: "mock" });
    expect(selectEmail({ ...base, provider: "mock", appEnv: "staging" })).toEqual({ kind: "mock", mode: "mock" });
    expect(selectEmail({ ...base, appEnv: "production" })).toMatchObject({ kind: "unavailable" });
    expect(selectEmail({ ...base, provider: "mock", appEnv: "production", approved: "true" })).toMatchObject({ kind: "unavailable" });
  });
  it("resend not configured is UNAVAILABLE, never mocked", () => {
    for (const appEnv of ["local", "staging", "production"]) expect(selectEmail({ ...base, provider: "resend", appEnv })).toMatchObject({ kind: "unavailable", mode: "disabled" });
  });
  it("live ONLY when production AND approved=true; otherwise sandbox", () => {
    const r = { ...base, provider: "resend", resendConfigured: true };
    expect(selectEmail({ ...r, appEnv: "production", approved: "true" })).toEqual({ kind: "resend", mode: "live" });
    for (const [appEnv, approved] of [["production", "false"], ["production", undefined], ["production", "TRUE"], ["staging", "true"], ["local", "true"]] as const)
      expect(selectEmail({ ...r, appEnv, approved })).toEqual({ kind: "resend", mode: "sandbox" });
  });
  it("sandbox mode only emails allowlisted people; live emails anyone", () => {
    const allow = parseList("Owner@Shop.com; ops@shop.com, bad, owner@shop.com");
    expect(allow).toEqual(["owner@shop.com", "ops@shop.com"]);
    expect(recipientAllowed("sandbox", "OWNER@shop.com", allow)).toBe(true);
    expect(recipientAllowed("sandbox", "customer@gmail.com", allow)).toBe(false);
    expect(recipientAllowed("live", "customer@gmail.com", allow)).toBe(true);
    expect(recipientAllowed("mock", "customer@gmail.com", allow)).toBe(true);
  });
});

const email = { to: "buyer@example.com", subject: "Hi", html: "<p>x</p>", text: "x", idempotencyKey: "order_confirmation:abc" };
function resend(status: number, body: unknown, calls: HttpRequest[] = []) {
  return new ResendEmailProvider("re_test_key_value", "Compadres Cigars <orders@example.com>", async (r): Promise<HttpResponse> => { calls.push(r); return { status, text: typeof body === "string" ? body : JSON.stringify(body) }; });
}
describe("ResendEmailProvider", () => {
  it("posts one email with the key in the Authorization header and an idempotency key", async () => {
    const calls: HttpRequest[] = [];
    expect(await resend(200, { id: "em_1" }, calls).send(email)).toEqual({ ok: true, id: "em_1" });
    expect(calls[0].url).toBe(RESEND_URL);
    expect(calls[0].headers.Authorization).toBe("Bearer re_test_key_value");
    expect(calls[0].headers["Idempotency-Key"]).toBe("order_confirmation:abc");
    expect(JSON.parse(calls[0].body)).toMatchObject({ from: "Compadres Cigars <orders@example.com>", to: ["buyer@example.com"], subject: "Hi" });
    expect(calls[0].body).not.toContain("re_test_key_value");
  });
  it("classifies failures: validation/auth are permanent; 429/5xx/network are retryable; text is never echoed", async () => {
    const bad = await resend(422, { name: "validation_error", message: "secret detail buyer@example.com" }).send(email);
    expect(bad).toEqual({ ok: false, retryable: false, code: "validation_error" });
    expect(await resend(401, { name: "restricted_api_key" }).send(email)).toMatchObject({ ok: false, retryable: false });
    expect(await resend(429, { name: "rate_limit_exceeded" }).send(email)).toMatchObject({ ok: false, retryable: true });
    expect(await resend(503, "<html>down</html>").send(email)).toEqual({ ok: false, retryable: true, code: "http_503" });
    const net = new ResendEmailProvider("k", "a@b.co", async () => { throw new Error("socket hang up"); });
    expect(await net.send(email)).toEqual({ ok: false, retryable: true, code: "network" });
    expect(await resend(200, { nope: 1 }).send(email)).toMatchObject({ ok: false });
  });
  it("validates the From address", () => {
    expect(fromAddressOk("Compadres Cigars <orders@example.com>")).toBe(true);
    expect(fromAddressOk("orders@example.com")).toBe(true);
    for (const v of ["", "orders", "a@b", "x <y@z.co>\r\nBcc: evil@e.com"]) expect(fromAddressOk(v)).toBe(false);
  });
  it("mock provider accepts good addresses and rejects bad ones", async () => {
    expect(await new MockEmailProvider().send(email)).toMatchObject({ ok: true });
    expect(await new MockEmailProvider().send({ ...email, to: "nope" })).toMatchObject({ ok: false, retryable: false });
  });
});

const order: OrderPayload = {
  orderId: "11111111-1111-4111-8111-111111111111", number: 1042, name: 'Pat <script>alert(1)</script>', siteUrl: "https://shop.example.com/",
  items: [{ name: 'The Plug "Box" & more', quantity: 2, unit_price_cents: 14900 }], subtotal_cents: 29800, shipping_cents: 1450, tax_cents: 2515, total_cents: 33765,
  address: { recipient: "Pat <b>Lee</b>", line1: "1 Main St", line2: "Apt 2", city: "Kansas City", state: "MO", postal_code: "64131" },
};
describe("templates", () => {
  it("order confirmation: totals, adult-signature notice, link, and escaped HTML", () => {
    const r = renderEmail("order_confirmation", order);
    expect(r.subject).toBe("Your Compadres Cigars order #1042 is confirmed");
    for (const s of ["$298.00", "$14.50", "$25.15", "$337.65", "21 or older", "https://shop.example.com/order/11111111-1111-4111-8111-111111111111", "Kansas City, MO 64131"]) expect(r.text).toContain(s);
    expect(r.html).not.toContain("<script>");
    expect(r.html).not.toContain("<b>Lee</b>");
    expect(r.html).toContain("&lt;script&gt;");
    expect(r.html).toContain("The Plug &quot;Box&quot; &amp; more");
  });
  it("shipped email carries the tracking number and FedEx link; unsafe site URLs are dropped", () => {
    const r = renderEmail("order_shipped", { ...order, tracking: "794600000000", service: "Ground", siteUrl: "javascript:alert(1)" } as ShippedPayload);
    expect(r.text).toContain("794600000000");
    expect(r.text).toContain("https://www.fedex.com/fedextrack/?trknbr=794600000000");
    expect(r.html).toContain("fedextrack");
    expect(renderEmail("admin_new_order", { orderId: "x", number: 1, total_cents: 100, items: [], siteUrl: "javascript:alert(1)" }).html).not.toContain("javascript:");
  });
  it("refund, admin and low-stock emails say what happened", () => {
    expect(renderEmail("refund_issued", { orderId: "x", number: 7, amount_cents: 500, fully: false }).text).toContain("partial refund of $5.00");
    expect(renderEmail("admin_low_stock", { name: "Plug", sku: "P1", stock: 0, threshold: 5, state: "out" }).subject).toBe("OUT OF STOCK: Plug");
    expect(renderEmail("admin_low_stock", { name: "Plug", sku: "P1", stock: 3, threshold: 5, state: "low" }).text).toContain("3 left");
    expect(renderEmail("admin_needs_review", { what: "A captured payment could not be recorded", number: 9 }).subject).toContain("Needs review");
    expect(renderEmail("admin_test", { sentBy: "a@b.co" }).text).toContain("a@b.co");
  });
  it("no template can leak card-like numbers from normal payloads", () => {
    for (const k of ["order_confirmation", "order_shipped"] as const) expect(JSON.stringify(renderEmail(k, { ...order, tracking: "794600000000" }))).not.toMatch(/\b\d{13,19}\b/);
  });
});
