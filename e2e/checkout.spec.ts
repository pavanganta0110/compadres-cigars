import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ISLEY = "ISLEY-PLUG-60X675-10";

async function setStates(allowed: string[]) {
  const c = db();
  await c.from("restriction_rules").update({ status: "blocked" }).neq("state", "--");
  if (allowed.length) await c.from("restriction_rules").update({ status: "allowed" }).in("state", allowed);
}
async function ordersFor(email: string) {
  const { data } = await db().from("orders").select("id,status,total_cents,tax_cents,compliance_snapshot,order_items(quantity)").eq("email", email);
  return data ?? [];
}
async function stock() {
  const { data } = await db().from("products").select("stock").eq("sku", ISLEY).single();
  return data!.stock as number;
}
async function passGate(page: Page) {
  await page.goto("/age-gate");
  await page.getByLabel("I confirm I am 21 years of age or older").check();
  await page.getByRole("button", { name: "Enter site" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/age-gate"));
}
async function fillCheckout(page: Page, email: string, state: string) {
  await page.goto("/products/the-plug-box-of-10");
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page).toHaveURL(/\/cart/);
  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Full name").fill("Test Buyer");
  await page.getByLabel("Address", { exact: true }).fill("1111 E 73rd St");
  await page.getByLabel("City").fill("Kansas City");
  await page.getByLabel("State").selectOption(state);
  await page.getByLabel("ZIP code").fill("64131");
}
async function fillCard(page: Page, number = "4242 4242 4242 4242") {
  await page.getByLabel("Name on card").fill("Test Buyer");
  await page.getByLabel("Card number").fill(number);
  await page.getByLabel("Expiry (MM/YY)").fill("12/34");
  await page.getByLabel("Security code").fill("123");
}
async function getRates(page: Page) {
  await page.getByRole("button", { name: "Get shipping rates" }).click();
  await expect(page.getByRole("radio").first()).toBeVisible();
}

test.beforeEach(async ({ page }) => { await passGate(page); });

test("a blocked state is refused and nothing is created", async ({ page }) => {
  await setStates([]);
  const email = `blocked-${Date.now()}@example.com`;
  const before = await stock();
  await fillCheckout(page, email, "TX");
  await page.getByRole("button", { name: "Get shipping rates" }).click();
  await expect(page.locator(".notice-error")).toContainText("cannot ship tobacco products");
  await expect(page.getByRole("button", { name: /Place order/ })).toBeDisabled();
  expect(await ordersFor(email)).toHaveLength(0);
  expect(await stock()).toBe(before);
});

test("checkout is blocked without the age confirmation, even if the client forges a passed value", async ({ page }) => {
  await setStates(["MO"]);
  const email = `noage-${Date.now()}@example.com`;
  await fillCheckout(page, email, "MO");
  await getRates(page);
  await page.evaluate(() => {
    const box = document.querySelector<HTMLInputElement>('input[name="ageAttest"]')!;
    box.required = false; box.checked = false;
    for (const [n, v] of [["ageVerified", "passed"], ["age_status", "passed"], ["verified", "true"]]) {
      const h = document.createElement("input"); h.type = "hidden"; h.name = n; h.value = v; box.form!.appendChild(h);
    }
  });
  await fillCard(page);
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.locator(".notice-error")).toContainText("21 years of age or older");
  expect(await ordersFor(email)).toHaveLength(0);
});

test("a sandbox order is paid, with Adult Signature, estimated tax and a compliance snapshot", async ({ page }) => {
  await setStates(["MO"]);
  const email = `ok-${Date.now()}@example.com`;
  const before = await stock();
  await fillCheckout(page, email, "MO");
  await getRates(page);
  await page.getByLabel("I confirm I am 21 years of age or older").check();
  await fillCard(page);
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: /received/ })).toBeVisible();
  await expect(page.getByText("Payment received")).toBeVisible();
  const [order] = await ordersFor(email);
  expect(order.status).toBe("processing");
  expect(order.tax_cents).toBe(1258);
  expect((order.compliance_snapshot as { shipping: { adult_signature_required: boolean } }).shipping.adult_signature_required).toBe(true);
  expect(await stock()).toBe(before - 1);
});

test("double submit creates one order", async ({ page }) => {
  await setStates(["MO"]);
  const email = `dup-${Date.now()}@example.com`;
  await fillCheckout(page, email, "MO");
  await getRates(page);
  await page.getByLabel("I confirm I am 21 years of age or older").check();
  await fillCard(page);
  await page.evaluate(() => { const f = document.querySelector("form.form-grid") as HTMLFormElement; f.requestSubmit(); f.requestSubmit(); });
  await page.waitForTimeout(3000);
  expect(await ordersFor(email)).toHaveLength(1);
});

test("cart cookie cannot change prices", async ({ page, context }) => {
  await setStates(["MO"]);
  await context.addCookies([{ name: "cc_cart", value: JSON.stringify([{ p: "00000000-0000-4000-8000-000000000000", q: 1, price: 1 }]), url: "http://localhost:3100" }]);
  await page.goto("/cart");
  await expect(page.getByText("Your cart is empty")).toBeVisible();
});
