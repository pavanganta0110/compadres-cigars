import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
// Test-only credentials for the local/CI database, generated per run and never written anywhere.
const PASSWORD = `${crypto.randomUUID()}Aa1!`;
const run = Date.now();
const users = { owner: `owner-${run}@example.com`, fulfillment: `ful-${run}@example.com` };

async function makeStaff(email: string, role: string) {
  const c = db();
  const { data, error } = await c.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  await c.from("staff").insert({ user_id: data.user.id, role });
}
async function login(page: Page, email: string, password = PASSWORD, expectSuccess = true) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (expectSuccess) await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  else await expect(page.locator(".adm-alert")).toBeVisible();
}
async function makeOrder(status: string, hoursAgo: number, state = "MO") {
  const at = new Date(Date.now() - hoursAgo * 3600_000).toISOString();
  const { data, error } = await db().from("orders").insert({
    email: `adm-${run}-${Math.random().toString(36).slice(2, 8)}@example.com`, status, subtotal_cents: 10000, shipping_cents: 1000, tax_cents: 844, total_cents: 11844,
    shipping_address: { state, line1: "1 Main", city: "KC", postal_code: "64131" }, created_at: at, paid_at: status === "pending" ? null : at,
  }).select("id, number").single();
  if (error) throw error;
  return data;
}

test.beforeAll(async () => { await makeStaff(users.owner, "owner"); await makeStaff(users.fulfillment, "fulfillment"); });

test("anonymous visitors are sent to the login page, not the age gate, and cannot export", async ({ page, request }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  const r = await request.get("/admin/sales-tax/export", { maxRedirects: 0 });
  expect([302, 307]).toContain(r.status());
  expect(r.headers().location).toContain("/admin/login");
});

test("wrong password gives one generic message", async ({ page }) => {
  await login(page, users.owner, "not-the-password-123", false);
  await expect(page.locator(".adm-alert")).toContainText("did not work");
  await login(page, `nobody-${run}@example.com`, "whatever-12345", false);
  await expect(page.locator(".adm-alert")).toContainText("did not work");
});

test("owner sees the branded dashboard with the full sidebar and no vendor chrome", async ({ page }) => {
  await login(page, users.owner);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  const text = await page.locator("body").innerText();
  expect(text).toContain("Compadres Cigars Admin Portal");
  for (const item of ["Dashboard", "Store", "Products", "Payments", "Operations", "Analytics", "Sales & Tax", "Audit Log", "Restrictions", "Users", "Settings"]) {
    await expect(page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: item, exact: true })).toBeVisible();
  }
  for (const vendor of ["WooCommerce", "WordPress", "Automattic", "Jetpack"]) expect(text).not.toContain(vendor);
  await expect(page.getByText("Integration health")).toBeVisible();
  await expect(page.getByText("not production-ready").first()).toBeVisible();
});

test("packed workflow: alert, bulk mark packed, audit, dashboard counts and tax report", async ({ page }) => {
  const late = await makeOrder("processing", 30);
  const fresh = await makeOrder("processing", 1);
  await login(page, users.owner);
  await expect(page.getByText("Unpacked over 24 hours")).toBeVisible();
  const lateRow = page.getByRole("row").filter({ hasText: `#${late.number}` });
  await expect(lateRow).toContainText("(late)");
  await page.getByLabel(`Select order ${late.number}`).check();
  await page.getByLabel(`Select order ${fresh.number}`).check();
  await page.getByRole("button", { name: "Mark selected as packed" }).click();
  await expect.poll(async () => {
    const { data } = await db().from("orders").select("status, packed_at").in("id", [late.id, fresh.id]);
    return data!.every((r) => r.status === "packed" && r.packed_at);
  }).toBe(true);
  await expect.poll(async () => (await db().from("audit_log").select("id").eq("action", "orders.marked_packed")).data!.length).toBeGreaterThan(0);
  const { data: audit } = await db().from("audit_log").select("detail").eq("action", "orders.marked_packed").order("id", { ascending: false }).limit(1);
  expect((audit![0].detail as { packed: number }).packed).toBe(2);
  await page.goto(`/admin/orders/${late.id}`);
  await page.getByLabel(/Tracking number/).fill("bad!");
  await page.getByRole("button", { name: "Save tracking" }).click();
  await expect(page.locator(".adm-alert")).toContainText("6 to 34");
  await page.getByLabel(/Tracking number/).fill("794644790132");
  await page.getByRole("button", { name: "Save tracking" }).click();
  await expect(page.getByRole("link", { name: "794644790132" })).toHaveAttribute("href", /fedex\.com\/fedextrack\/\?trknbr=794644790132/);
  // packed orders count as finalized sales
  const today = new Date().toISOString().slice(0, 10);
  await page.goto(`/admin/sales-tax?from=${today}&to=${today}`);
  await expect(page.getByText(/Estimates only/)).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: /^MO/ }).first()).toBeVisible();
});

test("sales-tax CSV export is audited and carries the estimate disclaimer", async ({ page }) => {
  await login(page, users.owner);
  const res = await page.request.get("/admin/sales-tax/export");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(await res.text()).toContain("estimates");
  const { data } = await db().from("audit_log").select("id").eq("action", "report.sales_tax_exported").limit(1);
  expect(data!.length).toBe(1);
});

test("restrictions: owner must confirm to allow a state, and the change is audited", async ({ page }) => {
  await db().from("restriction_rules").update({ status: "blocked" }).eq("state", "KS");
  await login(page, users.owner);
  await page.goto("/admin/restrictions");
  const row = page.getByRole("row").filter({ has: page.getByRole("button", { name: "Allow KS" }) });
  await row.getByRole("button", { name: "Allow KS" }).click();
  await expect(page.locator(".adm-alert")).toContainText("confirmation");
  const { data: still } = await db().from("restriction_rules").select("status").eq("state", "KS").single();
  expect(still!.status).toBe("blocked");
  await page.getByRole("row").filter({ has: page.getByRole("button", { name: "Allow KS" }) }).getByLabel("We are permitted to ship here").check();
  await page.getByRole("button", { name: "Allow KS" }).click();
  await expect(page.getByText("Saved KS")).toBeVisible();
  const { data: now } = await db().from("restriction_rules").select("status, updated_by").eq("state", "KS").single();
  expect(now!.status).toBe("allowed");
  expect(now!.updated_by).toBeTruthy();
  const { data: audit } = await db().from("audit_log").select("detail").eq("action", "restriction.changed").eq("entity_id", "KS").order("id", { ascending: false }).limit(1);
  expect((audit![0].detail as { to: string }).to).toBe("allowed");
  await db().from("restriction_rules").update({ status: "blocked" }).eq("state", "KS");
});

test("fulfillment role cannot reach restrictions, users, reports or the export", async ({ page }) => {
  await login(page, users.fulfillment);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Admin" });
  for (const hidden of ["Restrictions", "Users", "Sales & Tax", "Audit Log"]) await expect(nav.getByRole("link", { name: hidden, exact: true })).toHaveCount(0);
  for (const path of ["/admin/restrictions", "/admin/users", "/admin/sales-tax", "/admin/audit"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\?denied=1/);
  }
  const r = await page.request.get("/admin/sales-tax/export", { maxRedirects: 0 });
  expect([302, 307]).toContain(r.status());
});

test("the last owner cannot be demoted", async ({ page }) => {
  const c = db();
  const { data: owners } = await c.from("staff").select("user_id").eq("role", "owner");
  test.skip(owners!.length !== 1, "other owners exist in this database");
  await login(page, users.owner);
  await page.goto("/admin/users");
  const row = page.getByRole("row").filter({ hasText: users.owner });
  await row.getByLabel("Role").selectOption("viewer");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".adm-alert")).toContainText("at least one owner");
});

for (const path of ["/admin/login", "/admin"]) {
  test(`axe: ${path}`, async ({ page }) => {
    if (path === "/admin") await login(page, users.owner);
    await page.goto(path);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });
}
