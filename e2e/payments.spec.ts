import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { MOCK_SIGNATURE_HEADER, signMockWebhook } from "../src/lib/payments/mock";

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const WEBHOOK_SECRET = process.env.COMPADRES_PAYMENT_WEBHOOK_SECRET ?? "";
const PASSWORD = `${crypto.randomUUID()}Aa1!`;   // test-only, generated per run
const run = Date.now();
const staff = { owner: `pay-owner-${run}@example.com`, fulfillment: `pay-ful-${run}@example.com` };
const APPROVE = "4242 4242 4242 4242";
const DECLINE = "4000 0000 0000 0002";

async function makeStaff(email: string, role: string) {
  const c = db();
  const { data, error } = await c.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  await c.from("staff").insert({ user_id: data.user.id, role });
}
async function login(page: Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}
async function allowMissouri() {
  const c = db();
  await c.from("restriction_rules").update({ status: "blocked" }).neq("state", "--");
  await c.from("restriction_rules").update({ status: "allowed" }).in("state", ["MO"]);
}
async function passGate(page: Page) {
  await page.goto("/age-gate");
  await page.getByLabel("I confirm I am 21 years of age or older").check();
  await page.getByRole("button", { name: "Enter site" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/age-gate"));
}
async function fillCard(page: Page, number: string) {
  await page.getByLabel("Name on card").fill("Test Buyer");
  await page.getByLabel("Card number").fill(number);
  await page.getByLabel("Expiry (MM/YY)").fill("12/34");
  await page.getByLabel("Security code").fill("123");
}
async function fillCheckout(page: Page, email: string) {
  await page.goto("/products/the-plug-box-of-10");
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Full name").fill("Test Buyer");
  await page.getByLabel("Address", { exact: true }).fill("1111 E 73rd St");
  await page.getByLabel("City").fill("Kansas City");
  await page.getByLabel("State").selectOption("MO");
  await page.getByLabel("ZIP code").fill("64131");
  await page.getByRole("button", { name: "Get shipping rates" }).click();
  await expect(page.getByRole("radio").first()).toBeVisible();
  await page.getByLabel("I confirm I am 21 years of age or older").check();
}
const orderFor = async (email: string) => (await db().from("orders").select("id, status, paid_at, total_cents").eq("email", email)).data ?? [];
const paymentsFor = async (orderId: string) => (await db().from("payments").select("status, amount_cents, refunded_cents, provider, mode, charge_ref").eq("order_id", orderId).order("attempt")).data ?? [];

/** Places a fully paid order through the real UI and returns its id. */
async function paidOrder(page: Page, email: string): Promise<string> {
  await fillCheckout(page, email);
  await fillCard(page, APPROVE);
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByText("Payment received")).toBeVisible();
  return (await orderFor(email))[0].id as string;
}

test.beforeAll(async () => { await makeStaff(staff.owner, "owner"); await makeStaff(staff.fulfillment, "fulfillment"); });
test.beforeEach(async ({ page }) => { await allowMissouri(); await passGate(page); });

test("a sandbox payment succeeds: captured once, order moves pending -> processing with paid_at", async ({ page }) => {
  const email = `pay-ok-${run}@example.com`;
  const id = await paidOrder(page, email);
  const [o] = await orderFor(email);
  expect(o.status).toBe("processing");
  expect(o.paid_at).not.toBeNull();
  const pays = await paymentsFor(id);
  expect(pays).toHaveLength(1);
  expect(pays[0]).toMatchObject({ status: "captured", provider: "mock", mode: "mock", amount_cents: o.total_cents });
  const { data: audit } = await db().from("audit_log").select("action, detail").eq("entity_id", id).like("action", "payment.%");
  expect((audit ?? []).map((a) => a.action)).toEqual(expect.arrayContaining(["payment.authorized", "payment.captured"]));
  expect(JSON.stringify(audit)).not.toMatch(/mock_tok|4242 ?4242 ?4242/);   // no card data or tokens in the audit log
});

test("a declined card leaves the order pending with a clear message, then a good card pays it", async ({ page }) => {
  const email = `pay-decline-${run}@example.com`;
  await fillCheckout(page, email);
  await fillCard(page, DECLINE);
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "declined" })).toBeVisible();
  const [o] = await orderFor(email);
  expect(o.status).toBe("pending");
  expect(o.paid_at).toBeNull();
  expect((await paymentsFor(o.id as string)).map((p) => p.status)).toEqual(["declined"]);
  const { data: audit } = await db().from("audit_log").select("action").eq("entity_id", o.id).eq("action", "payment.declined");
  expect(audit).toHaveLength(1);

  await fillCard(page, APPROVE);
  await page.getByRole("button", { name: "Pay now" }).click();
  await expect(page.getByText("Payment received")).toBeVisible();
  expect((await paymentsFor(o.id as string)).map((p) => p.status)).toEqual(["declined", "captured"]);
  expect((await orderFor(email))[0].status).toBe("processing");
});

test("a card number is never posted to the server", async ({ page }) => {
  const email = `pay-nopan-${run}@example.com`;
  const bodies: string[] = [];
  page.on("request", (r) => { if (r.method() === "POST") bodies.push((r.postData() ?? "") + r.url()); });
  await fillCheckout(page, email);
  await fillCard(page, APPROVE);
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByText("Payment received")).toBeVisible();
  expect(bodies.join("\n")).not.toMatch(/4242 ?4242 ?4242|(^|\r?\n)123(\r?\n|$)/m);
});

test("double submit creates one order and ONE charge", async ({ page }) => {
  const email = `pay-dup-${run}@example.com`;
  await fillCheckout(page, email);
  await fillCard(page, APPROVE);
  await page.evaluate(() => { const f = document.querySelector("form.form-grid") as HTMLFormElement; f.requestSubmit(); f.requestSubmit(); });
  await expect.poll(async () => (await orderFor(email))[0]?.status, { timeout: 20_000 }).toBe("processing");
  await page.waitForTimeout(3000);
  const orders = await orderFor(email);
  expect(orders).toHaveLength(1);
  const pays = await paymentsFor(orders[0].id as string);
  expect(pays.filter((p) => p.status === "captured")).toHaveLength(1);
  expect(pays.filter((p) => ["authorizing", "authorized", "captured"].includes(p.status as string))).toHaveLength(1);
});

test("paying an already-paid order again is refused (no second charge)", async ({ page }) => {
  const email = `pay-twice-${run}@example.com`;
  const id = await paidOrder(page, email);
  await page.goto(`/order/${id}`);
  await expect(page.getByRole("button", { name: "Pay now" })).toHaveCount(0);
  expect((await paymentsFor(id)).filter((p) => p.status === "captured")).toHaveLength(1);
});

test("refunds: staff-only, validated, partial then full; order becomes refunded", async ({ page, browser }) => {
  const email = `pay-refund-${run}@example.com`;
  const id = await paidOrder(page, email);
  const total = (await orderFor(email))[0].total_cents as number;

  // fulfillment staff can see the order but not refund it
  const ful = await (await browser.newContext()).newPage();
  await login(ful, staff.fulfillment);
  await ful.goto(`/admin/orders/${id}`);
  await expect(ful.getByRole("button", { name: "Issue refund" })).toHaveCount(0);

  await login(page, staff.owner);
  await page.goto(`/admin/orders/${id}`);
  const refund = async (amount: string, reason = "Customer request") => {
    await page.getByLabel(/Refund amount/).fill(amount);
    await page.getByLabel("Reason").fill(reason);
    await page.getByRole("button", { name: "Issue refund" }).click();
  };
  await refund("5.00");
  await expect(page.getByText("Refund issued.")).toBeVisible();
  expect((await orderFor(email))[0].status).toBe("processing");
  expect((await paymentsFor(id))[0].refunded_cents).toBe(500);

  await refund("0");
  await expect(page.locator(".adm-alert")).toContainText("Refund not issued");
  await refund(((total - 500) / 100 + 1).toFixed(2));
  await expect(page.locator(".adm-alert")).toContainText("more than what remains");
  expect((await paymentsFor(id))[0].refunded_cents).toBe(500);

  await refund(((total - 500) / 100).toFixed(2), "Order cancelled");
  await expect(page.getByText("Refund issued.")).toBeVisible();
  expect((await orderFor(email))[0].status).toBe("refunded");
  const { data: rows } = await db().from("refunds").select("amount_cents, status").eq("order_id", id);
  expect((rows ?? []).filter((r) => r.status === "completed").reduce((n, r) => n + r.amount_cents, 0)).toBe(total);
  const { data: audit } = await db().from("audit_log").select("action").eq("entity_id", id).like("action", "refund.%");
  expect((audit ?? []).map((a) => a.action)).toEqual(expect.arrayContaining(["refund.requested", "refund.completed", "refund.rejected"]));
});

test.describe("webhook", () => {
  const post = (page: Page, body: string, sig?: string) =>
    page.request.post("/api/webhooks/payments", { data: body, headers: { "content-type": "application/json", ...(sig ? { [MOCK_SIGNATURE_HEADER]: sig } : {}) } });

  test("rejects missing and bad signatures, accepts a valid one once, ignores replays", async ({ page }) => {
    test.skip(WEBHOOK_SECRET.length < 16, "no webhook secret in this environment");
    const body = JSON.stringify({ id: `evt_${run}_a`, type: "charge.captured", chargeRef: "mock_ch_unknown" });
    expect((await post(page, body)).status()).toBe(401);
    expect((await post(page, body, "0".repeat(64))).status()).toBe(401);
    expect((await post(page, body, signMockWebhook(WEBHOOK_SECRET, body + " "))).status()).toBe(401);
    const good = signMockWebhook(WEBHOOK_SECRET, body);
    const first = await post(page, body, good);
    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ processed: 1, duplicates: 0 });
    expect(await (await post(page, body, good)).json()).toMatchObject({ processed: 0, duplicates: 1 });
    const { data } = await db().from("payment_events").select("event_id").eq("event_id", `evt_${run}_a`);
    expect(data).toHaveLength(1);
  });

  test("a refund made at the processor is recorded once", async ({ page }) => {
    test.skip(WEBHOOK_SECRET.length < 16, "no webhook secret in this environment");
    const id = await paidOrder(page, `pay-hook-${run}@example.com`);
    const ref = (await paymentsFor(id))[0].charge_ref as string;
    const body = JSON.stringify({ id: `evt_${run}_r`, type: "charge.refunded", chargeRef: ref, refundRef: `mock_rf_ext_${run}`, amountCents: 700 });
    const sig = signMockWebhook(WEBHOOK_SECRET, body);
    expect((await post(page, body, sig)).status()).toBe(200);
    expect((await post(page, body, sig)).status()).toBe(200);
    const { data } = await db().from("refunds").select("amount_cents, status").eq("order_id", id);
    expect(data).toEqual([{ amount_cents: 700, status: "completed" }]);
    expect((await paymentsFor(id))[0].refunded_cents).toBe(700);
  });
});

test("axe: checkout payment fields, pending order pay form, admin payments page", async ({ page }) => {
  const email = `pay-axe-${run}@example.com`;
  await fillCheckout(page, email);
  const check = async () => expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  await check();
  await fillCard(page, DECLINE);
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("button", { name: "Pay now" })).toBeVisible();
  await check();
  await login(page, staff.owner);
  await page.goto("/admin/payments");
  await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
  await check();
});
