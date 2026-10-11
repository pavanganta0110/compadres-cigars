import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const PASSWORD = `${crypto.randomUUID()}Aa1!`;   // test-only, generated per run
const run = Date.now();
const users = { owner: `roy-owner-${run}@example.com`, manager: `roy-mgr-${run}@example.com`, fulfillment: `roy-ful-${run}@example.com` };
const BRAND = `E2E Royalty ${run}`;
const SLUG = `e2e-brand-roy-${run}`;
let brandId = "";

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
const rateForm = (page: Page) => page.locator("form", { has: page.getByLabel(`${BRAND}: royalty rate (%)`) });
const payoutForm = (page: Page) => page.locator("form", { has: page.getByLabel(new RegExp(`${BRAND}: amount paid`)) });
const brandRow = (page: Page) => page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: BRAND }) }).first();

async function order(c: ReturnType<typeof db>, productId: string, o: { status: string; items: { qty: number; price: number }[]; shipping?: number; tax?: number }) {
  const subtotal = o.items.reduce((n, i) => n + i.qty * i.price, 0);
  const total = subtotal + (o.shipping ?? 0) + (o.tax ?? 0);
  const paid = o.status === "pending" ? null : new Date().toISOString();
  const { data, error } = await c.from("orders").insert({ email: `roy-${run}-${Math.random().toString(36).slice(2, 7)}@example.com`, status: o.status, subtotal_cents: subtotal, shipping_cents: o.shipping ?? 0, tax_cents: o.tax ?? 0, total_cents: total, paid_at: paid }).select("id").single();
  if (error) throw error;
  await c.from("order_items").insert(o.items.map((i) => ({ order_id: data.id, product_id: productId, sku: `E2E-ROY-${run}`, name: "E2E royalty cigar", quantity: i.qty, unit_price_cents: i.price })));
  return { id: data.id as string, total };
}

test.beforeAll(async () => {
  await makeStaff(users.owner, "owner"); await makeStaff(users.manager, "manager"); await makeStaff(users.fulfillment, "fulfillment");
  const c = db();
  const { data: b, error } = await c.from("brands").insert({ slug: SLUG, name: BRAND, active: false, display_order: 9999 }).select("id").single();
  if (error) throw error;
  brandId = b.id;
  const { data: p } = await c.from("products").insert({ brand_id: brandId, slug: `e2e-roy-${run}`, sku: `E2E-ROY-${run}`, name: "E2E royalty cigar", price_cents: 14900, stock: 10, active: false, placeholder_price: false }).select("id").single();
  // paid: 2 x $149.00 (royalty base $298.00; shipping and tax are NOT part of it)
  await order(c, p!.id, { status: "processing", items: [{ qty: 2, price: 14900 }], shipping: 1450, tax: 2515 });
  // fully refunded: earns nothing
  const refunded = await order(c, p!.id, { status: "refunded", items: [{ qty: 1, price: 10000 }] });
  await c.from("refunds").insert({ order_id: refunded.id, amount_cents: refunded.total, status: "completed", reason: "e2e" });
  // pending: never counts
  await order(c, p!.id, { status: "pending", items: [{ qty: 5, price: 14900 }] });
});
test.afterAll(async () => {
  const c = db();
  const { data: orders } = await c.from("orders").select("id").like("email", `roy-${run}-%`);
  const ids = (orders ?? []).map((o) => o.id);
  if (ids.length) { await c.from("refunds").delete().in("order_id", ids); await c.from("orders").delete().in("id", ids); }
  await c.from("royalty_payouts").delete().eq("brand_id", brandId);
  await c.from("products").delete().like("sku", `E2E-ROY-${run}`);
  await c.from("brands").delete().eq("id", brandId);
});

test("the owner sets a rate; royalty = rate x net product sales (no tax or shipping, paid orders only, refunds excluded)", async ({ page }) => {
  await login(page, users.owner);
  await page.goto("/admin/royalties");
  await expect(brandRow(page)).toContainText("0.00%");
  await page.getByLabel(`${BRAND}: royalty rate (%)`).fill("101");
  await page.getByRole("button", { name: `Save royalty rate for ${BRAND}` }).click();
  await expect(page.locator(".adm-alert")).toContainText("0 to 100");

  await page.getByLabel(`${BRAND}: royalty rate (%)`).fill("10");
  await page.getByRole("button", { name: `Save royalty rate for ${BRAND}` }).click();
  await expect(page.getByText("Rate saved.")).toBeVisible();
  await expect(brandRow(page)).toContainText("10.00%");
  await expect(brandRow(page)).toContainText("$298.00");   // net sales: 2 x $149.00 only
  await expect(brandRow(page)).toContainText("$29.80");    // 10% royalty earned and owed
  const { data: audit } = await db().from("audit_log").select("detail").eq("action", "royalty.rate_set").eq("entity_id", brandId);
  expect(audit).toHaveLength(1);
});

test("payouts lower what is owed, cannot exceed it, and are listed; a future rate change does not rewrite past sales", async ({ page }) => {
  await login(page, users.owner);
  await page.goto("/admin/royalties");
  await page.getByLabel(`${BRAND}: royalty rate (%)`).fill("10");
  await page.getByRole("button", { name: `Save royalty rate for ${BRAND}` }).click();
  await expect(page.getByText("Rate saved.")).toBeVisible();

  const payout = async (amount: string) => {
    await page.getByLabel(new RegExp(`${BRAND}: amount paid`)).fill(amount);
    await payoutForm(page).getByLabel("Reference (check or transfer number)").fill("ACH 1001");
    await page.getByRole("button", { name: `Record payout to ${BRAND}` }).click();
  };
  await payout("100.00");
  await expect(page.locator(".adm-alert")).toContainText("more than the brand is currently owed");
  await payout("10.00");
  await expect(page.getByText("Payout recorded.")).toBeVisible();
  await expect(brandRow(page)).toContainText("$10.00");    // paid out
  await expect(brandRow(page)).toContainText("$19.80");    // still owed
  await expect(page.getByRole("row").filter({ hasText: "ACH 1001" })).toContainText("$10.00");

  // a higher rate that starts tomorrow leaves today's sales alone
  const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  await page.getByLabel(`${BRAND}: royalty rate (%)`).fill("20");
  await rateForm(page).getByLabel("Effective from (optional)").fill(tomorrow);
  await page.getByRole("button", { name: `Save royalty rate for ${BRAND}` }).click();
  await expect(page.getByText("Rate saved.")).toBeVisible();
  await expect(brandRow(page)).toContainText("$29.80");
  await expect(brandRow(page)).toContainText("10.00%");    // today's rate is still 10%
});

test("dashboard shows the royalty panel; CSV export has the figures; managers view but cannot change; others have no access", async ({ page, browser }) => {
  await login(page, users.owner);
  await expect(page.getByRole("heading", { name: "Brand royalties" })).toBeVisible();
  await expect(page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: BRAND }) }).first()).toBeVisible();
  const csv = await (await page.request.get("/admin/royalties/export")).text();
  expect(csv).toContain(BRAND);
  expect(csv.split("\r\n").find((l) => l.includes(BRAND))).toContain("29.80");

  const mgr = await (await browser.newContext()).newPage();
  await login(mgr, users.manager);
  await mgr.goto("/admin/royalties");
  await expect(brandRow(mgr)).toBeVisible();
  await expect(mgr.getByRole("button", { name: /Save royalty rate/ })).toHaveCount(0);
  await expect(mgr.getByRole("button", { name: /Record payout/ })).toHaveCount(0);

  const ful = await (await browser.newContext()).newPage();
  await login(ful, users.fulfillment);
  await ful.goto("/admin/royalties");
  await expect(ful).toHaveURL(/denied=1/);
  await expect(ful.getByRole("heading", { name: "Brand royalties" })).toHaveCount(0);
});

test("axe: royalties page", async ({ page }) => {
  await login(page, users.owner);
  await page.goto("/admin/royalties");
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
});
