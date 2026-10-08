import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const PASSWORD = `${crypto.randomUUID()}Aa1!`;   // test-only, generated per run
const run = Date.now();
const users = { owner: `store-owner-${run}@example.com`, manager: `store-mgr-${run}@example.com`, fulfillment: `store-ful-${run}@example.com` };
const SKU = `E2E-${run}`;
const MO_APPROVED = 844;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

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
const productRow = (page: Page, name: string) => page.getByRole("row").filter({ hasText: name });

test.beforeAll(async () => {
  await makeStaff(users.owner, "owner"); await makeStaff(users.manager, "manager"); await makeStaff(users.fulfillment, "fulfillment");
});
test.afterAll(async () => {
  const c = db();
  await c.from("tax_rates").update({ rate_bps: MO_APPROVED, matrix_sha256: "802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3", effective_date: "2026-08-19" }).eq("state", "MO");
  await c.from("products").delete().like("sku", "E2E-%");
  await c.from("brands").delete().like("slug", "e2e-brand-%");
});

test.describe("tax rates", () => {
  test("only the owner can edit; the change is validated, stored, audited and reversible", async ({ page, browser }) => {
    const mgr = await (await browser.newContext()).newPage();
    await login(mgr, users.manager);
    await mgr.goto("/admin/tax-rates");
    await expect(mgr).toHaveURL(/denied=1/);

    await login(page, users.owner);
    await page.goto("/admin/tax-rates");
    const row = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "MO", exact: true }) });
    await row.getByLabel("Rate for MO in percent").fill("31");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(page.locator(".adm-alert")).toContainText("0 to 30");
    expect((await db().from("tax_rates").select("rate_bps").eq("state", "MO").single()).data!.rate_bps).toBe(MO_APPROVED);

    await row.getByLabel("Rate for MO in percent").fill("10");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved the rate for MO.")).toBeVisible();
    const { data } = await db().from("tax_rates").select("rate_bps, matrix_sha256").eq("state", "MO").single();
    expect(data).toMatchObject({ rate_bps: 1000, matrix_sha256: "admin-edit" });
    const { data: audit } = await db().from("audit_log").select("detail").eq("action", "tax.rate_changed").eq("entity_id", "MO").order("id", { ascending: false }).limit(1);
    expect(audit![0].detail).toMatchObject({ from_bps: MO_APPROVED, to_bps: 1000 });

    await page.getByRole("button", { name: "Reset to 8.44%" }).click();
    await expect.poll(async () => (await db().from("tax_rates").select("rate_bps").eq("state", "MO").single()).data!.rate_bps).toBe(MO_APPROVED);
  });
});

test.describe("products and inventory", () => {
  test("launch a product as a draft, publish it, and get low/out-of-stock alerts", async ({ page, browser }) => {
    const name = `E2E Test Cigar ${run}`;
    await login(page, users.owner);

    // fulfillment staff cannot add products
    const ful = await (await browser.newContext()).newPage();
    await login(ful, users.fulfillment);
    await ful.goto("/admin/products");
    await expect(ful.getByRole("link", { name: "Add product" })).toHaveCount(0);

    await page.goto("/admin/products/new");
    await page.getByLabel("Product name").fill(name);
    await page.getByLabel("SKU").fill(SKU);
    await page.getByLabel("Price (USD)").fill("89.50");
    await page.getByLabel("Stock on hand").fill("3");
    await page.getByLabel("Photo (optional)").setInputFiles({ name: "cigar.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    // the uploaded photo is stored, listed, and served publicly with the right type
    const photo = productRow(page, name).locator(".adm-thumb img");
    await expect(photo).toHaveCount(1);
    const src = (await photo.getAttribute("src"))!;
    expect(src).toMatch(/^\/media\/[0-9a-f-]{36}$/);
    const served = await page.request.get(src);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toBe("image/png");
    expect(Buffer.from(await served.body()).equals(PNG)).toBe(true);
    await expect(productRow(page, name).locator(".adm-pill", { hasText: "Draft" })).toBeVisible();
    expect((await db().from("products").select("active").eq("sku", SKU).single()).data!.active).toBe(false);

    // drafts are hidden from the store
    await page.goto("/age-gate");
    await page.getByLabel("I confirm I am 21 years of age or older").check();
    await page.getByRole("button", { name: "Enter site" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/age-gate"));
    await page.goto("/shop");
    await expect(page.getByText(name)).toHaveCount(0);

    // publishing needs a weight (FedEx fails closed without one)
    await page.goto("/admin/products");
    const row = productRow(page, name);
    await row.getByLabel("Published").check();
    await row.getByRole("button", { name: "Save" }).click();
    await expect(page.locator(".adm-alert")).toContainText("weight");
    expect((await db().from("products").select("active").eq("sku", SKU).single()).data!.active).toBe(false);

    await productRow(page, name).getByLabel("Weight (oz)").fill("24");
    await productRow(page, name).getByLabel("Published").check();
    await productRow(page, name).getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await expect(productRow(page, name).locator(".adm-pill", { hasText: "Published" })).toBeVisible();
    await expect(productRow(page, name).locator(".adm-pill", { hasText: "Low stock" })).toBeVisible();   // 3 <= default alert level 5
    await page.goto("/shop");
    await expect(page.getByText(name)).toBeVisible();

    // dashboard alert + sidebar badge
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Inventory alerts" })).toBeVisible();
    await expect(page.locator(".adm-alerts")).toContainText(name);
    await expect(page.getByRole("navigation", { name: "Admin" }).locator(".adm-badge")).toBeVisible();

    // out of stock
    await page.goto("/admin/products");
    await productRow(page, name).getByLabel("Stock", { exact: true }).fill("0");
    await productRow(page, name).getByRole("button", { name: "Save" }).click();
    await expect(productRow(page, name).locator(".adm-pill", { hasText: "Out of stock" })).toBeVisible();
    await page.goto("/admin/products?filter=low");
    await expect(page.getByText(name)).toBeVisible();

    // plenty of stock clears the alert
    await productRow(page, name).getByLabel("Stock", { exact: true }).fill("50");
    await productRow(page, name).getByRole("button", { name: "Save" }).click();
    await expect(productRow(page, name).locator(".adm-pill", { hasText: "Low stock" })).toHaveCount(0);

    const { data: audit } = await db().from("audit_log").select("action").eq("entity", "products").in("action", ["product.created", "product.published"]);
    expect((audit ?? []).map((a) => a.action)).toEqual(expect.arrayContaining(["product.created", "product.published"]));
  });

  test("photos: add another, reject non-images, remove", async ({ page }) => {
    const name = `E2E Photo Cigar ${run}`;
    await login(page, users.owner);
    await page.goto("/admin/products/new");
    await page.getByLabel("Product name").fill(name);
    await page.getByLabel("SKU").fill(`E2E-PH-${run}`);
    await page.getByLabel("Price (USD)").fill("12");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(productRow(page, name).locator(".adm-thumb img")).toHaveCount(0);
    // a script disguised as a picture is refused (type is read from the bytes)
    await productRow(page, name).getByLabel("Add photo").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>") });
    await productRow(page, name).getByRole("button", { name: /Upload photo/ }).click();
    await expect(page.locator(".adm-alert")).toContainText("JPEG, PNG or WebP");
    await productRow(page, name).getByLabel("Add photo").setInputFiles({ name: "ok.png", mimeType: "image/png", buffer: PNG });
    await productRow(page, name).getByRole("button", { name: /Upload photo/ }).click();
    await expect(productRow(page, name).locator(".adm-thumb img")).toHaveCount(1);
    await productRow(page, name).getByRole("button", { name: /Remove photo 1/ }).click();
    await expect(productRow(page, name).locator(".adm-thumb img")).toHaveCount(0);
  });

  test("duplicate SKUs and bad input are rejected", async ({ page }) => {
    await login(page, users.owner);
    await page.goto("/admin/products/new");
    await page.getByLabel("Product name").fill(`E2E Duplicate ${run}`);
    await page.getByLabel("SKU").fill("ISLEY-PLUG-60X675-10");
    await page.getByLabel("Price (USD)").fill("10");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page.locator(".adm-alert")).toContainText("already exists");
    await page.getByLabel("Product name").fill(`E2E Free ${run}`);
    await page.getByLabel("SKU").fill(`E2E-FREE-${run}`);
    await page.getByLabel("Price (USD)").fill("0");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page.locator(".adm-alert")).toContainText("above $0.00");
  });
});

test("brands: add as a draft, publish to show it in the store, unpublish to hide it", async ({ page, browser }) => {
  const name = `E2E Brand ${run}`;
  const slug = `e2e-brand-${run}`;
  await login(page, users.owner);
  const ful = await (await browser.newContext()).newPage();
  await login(ful, users.fulfillment);
  await ful.goto("/admin/brands");
  await expect(ful.getByRole("link", { name: "Add brand" })).toHaveCount(0);

  await page.goto("/admin/brands/new");
  await page.getByLabel("Brand name").fill(name);
  await page.getByLabel("Tagline").fill("Made for the tests");
  await page.getByLabel("Banner image (optional)").setInputFiles({ name: "hero.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Create brand" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  const section = page.locator("section", { has: page.getByRole("heading", { name }) });
  await expect(section.locator(".adm-pill", { hasText: "Draft" })).toBeVisible();
  expect((await db().from("brands").select("hero_path").eq("slug", slug).single()).data!.hero_path).toMatch(/^\/media\//);

  const shop = await (await browser.newContext()).newPage();
  await shop.goto("/age-gate");
  await shop.getByLabel("I confirm I am 21 years of age or older").check();
  await shop.getByRole("button", { name: "Enter site" }).click();
  await shop.waitForURL((u) => !u.pathname.startsWith("/age-gate"));
  expect((await shop.goto(`/brands/${slug}`))!.status()).toBe(404);

  await section.getByLabel("Published").check();
  await section.getByRole("button", { name: `Save ${name}` }).click();
  await expect(page.locator("section", { has: page.getByRole("heading", { name }) }).locator(".adm-pill", { hasText: "Published" })).toBeVisible();
  expect((await shop.goto(`/brands/${slug}`))!.status()).toBe(200);
  await expect(shop.getByRole("heading", { name })).toBeVisible();

  await page.locator("section", { has: page.getByRole("heading", { name }) }).getByLabel("Published").uncheck();
  await page.locator("section", { has: page.getByRole("heading", { name }) }).getByRole("button", { name: `Save ${name}` }).click();
  await expect(page.locator("section", { has: page.getByRole("heading", { name }) }).locator(".adm-pill", { hasText: "Draft" })).toBeVisible();
  expect((await shop.goto(`/brands/${slug}`))!.status()).toBe(404);
});

test("the dashboard shows the sales snapshot", async ({ page }) => {
  await login(page, users.owner);
  for (const t of ["Sales today", "Last 7 days", "Last 30 days", "Average order"]) await expect(page.getByText(t, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Best sellers (30 days)" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Daily sales for the last 14 days/ })).toBeVisible();
  await page.goto("/admin/analytics");
  await expect(page.getByRole("img", { name: /Daily sales for the last 30 days/ })).toBeVisible();
});

for (const path of ["/admin", "/admin/products", "/admin/products/new", "/admin/brands", "/admin/brands/new", "/admin/tax-rates", "/admin/analytics"]) {
  test(`axe: ${path}`, async ({ page }) => {
    await login(page, users.owner);
    await page.goto(path);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });
}
