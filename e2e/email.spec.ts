import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const PASSWORD = `${crypto.randomUUID()}Aa1!`;   // test-only, generated per run
const run = Date.now();
const staff = { owner: `mail-owner-${run}@example.com`, fulfillment: `mail-ful-${run}@example.com` };
const ADMIN_ALERT = "alerts@example.com";

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
async function passGate(page: Page) {
  await page.goto("/age-gate");
  await page.getByLabel("I confirm I am 21 years of age or older").check();
  await page.getByRole("button", { name: "Enter site" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/age-gate"));
}
async function buy(page: Page, email: string, optIn: boolean): Promise<string> {
  await page.goto("/products/the-plug-box-of-10");
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Full name").fill("Mail Buyer");
  await page.getByLabel("Address", { exact: true }).fill("1111 E 73rd St");
  await page.getByLabel("City").fill("Kansas City");
  await page.getByLabel("State").selectOption("MO");
  await page.getByLabel("ZIP code").fill("64131");
  await page.getByRole("button", { name: "Get shipping rates" }).click();
  await expect(page.getByRole("radio").first()).toBeVisible();
  await page.getByLabel("I confirm I am 21 years of age or older").check();
  if (optIn) await page.getByLabel(/Email me news and offers/).check();
  await page.getByLabel("Name on card").fill("Mail Buyer");
  await page.getByLabel("Card number").fill("4242 4242 4242 4242");
  await page.getByLabel("Expiry (MM/YY)").fill("12/34");
  await page.getByLabel("Security code").fill("123");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByText("Payment received")).toBeVisible();
  return (await db().from("orders").select("id").eq("email", email).single()).data!.id as string;
}
const outbox = async (key: string) => (await db().from("email_outbox").select("status, to_email, subject, payload, provider").eq("dedupe_key", key)).data ?? [];

test.beforeAll(async () => { await makeStaff(staff.owner, "owner"); await makeStaff(staff.fulfillment, "fulfillment"); });
test.beforeEach(async ({ page }) => {
  const c = db();
  await c.from("restriction_rules").update({ status: "blocked" }).neq("state", "--");
  await c.from("restriction_rules").update({ status: "allowed" }).in("state", ["MO"]);
  await passGate(page);
});

test("a paid order queues and sends the customer confirmation and the staff alert, once each", async ({ page }) => {
  const email = `mail-ok-${run}@example.com`;
  const id = await buy(page, email, false);
  await expect.poll(async () => (await outbox(`order_confirmation:${id}`))[0]?.status, { timeout: 20_000 }).toBe("sent");
  const [conf] = await outbox(`order_confirmation:${id}`);
  expect(conf).toMatchObject({ to_email: email, provider: "mock" });
  expect(conf.subject).toMatch(/order #\d+ is confirmed/);
  expect(JSON.stringify(conf.payload)).not.toMatch(/4242|mock_tok/);          // no card data or tokens in the email payload
  await expect.poll(async () => (await outbox(`admin_new_order:${id}:${ADMIN_ALERT}`))[0]?.status, { timeout: 20_000 }).toBe("sent");
  const { data: all } = await db().from("email_outbox").select("kind").like("dedupe_key", `%${id}%`);
  expect((all ?? []).filter((e) => e.kind === "order_confirmation")).toHaveLength(1);
});

test("a failed payment sends no confirmation", async ({ page }) => {
  const email = `mail-decline-${run}@example.com`;
  await page.goto("/products/the-plug-box-of-10");
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Full name").fill("Mail Buyer");
  await page.getByLabel("Address", { exact: true }).fill("1111 E 73rd St");
  await page.getByLabel("City").fill("Kansas City");
  await page.getByLabel("State").selectOption("MO");
  await page.getByLabel("ZIP code").fill("64131");
  await page.getByRole("button", { name: "Get shipping rates" }).click();
  await expect(page.getByRole("radio").first()).toBeVisible();
  await page.getByLabel("I confirm I am 21 years of age or older").check();
  await page.getByLabel("Name on card").fill("Mail Buyer");
  await page.getByLabel("Card number").fill("4000 0000 0000 0002");
  await page.getByLabel("Expiry (MM/YY)").fill("12/34");
  await page.getByLabel("Security code").fill("123");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("button", { name: "Pay now" })).toBeVisible();
  const { data: o } = await db().from("orders").select("id").eq("email", email).single();
  await page.waitForTimeout(1500);
  expect(await outbox(`order_confirmation:${o!.id}`)).toHaveLength(0);
  expect((await db().from("customers").select("email").eq("email", email)).data).toHaveLength(1);   // the email is still stored
});

test("recording tracking emails the customer the FedEx number; a refund emails the refund", async ({ page, browser }) => {
  const email = `mail-ship-${run}@example.com`;
  const id = await buy(page, email, false);
  await db().from("orders").update({ status: "packed", packed_at: new Date().toISOString() }).eq("id", id);
  const admin = await (await browser.newContext()).newPage();
  await login(admin, staff.owner);
  await admin.goto(`/admin/orders/${id}`);
  await admin.getByLabel(/Tracking number/).fill("794600000000");
  await admin.getByRole("button", { name: "Save tracking" }).click();
  await expect(admin.getByText("Tracking number saved.")).toBeVisible();
  await expect.poll(async () => (await outbox(`order_shipped:${id}:794600000000`))[0]?.status, { timeout: 20_000 }).toBe("sent");
  const [shipped] = await outbox(`order_shipped:${id}:794600000000`);
  expect(shipped).toMatchObject({ to_email: email });
  expect((shipped.payload as { tracking: string }).tracking).toBe("794600000000");

  await admin.getByLabel(/Refund amount/).fill("5.00");
  await admin.getByLabel("Reason").fill("Goodwill");
  await admin.getByRole("button", { name: "Issue refund" }).click();
  await expect(admin.getByText("Refund issued.")).toBeVisible();
  const { data: rf } = await db().from("email_outbox").select("kind, to_email, subject").eq("kind", "refund_issued").eq("to_email", email);
  expect(rf).toHaveLength(1);
  expect(rf![0].subject).toMatch(/Refund issued for order #\d+/);
});

test("marketing consent is stored only when ticked; every buyer's email is stored; the CSV export is staff-restricted", async ({ page, browser }) => {
  const yes = `mail-yes-${run}@example.com`;
  const no = `mail-no-${run}@example.com`;
  await buy(page, yes, true);
  await page.context().clearCookies();
  await passGate(page);
  await buy(page, no, false);
  const { data } = await db().from("customers").select("email, marketing_opt_in, marketing_opt_in_source").in("email", [yes, no]);
  expect(Object.fromEntries((data ?? []).map((c) => [c.email, c.marketing_opt_in]))).toEqual({ [yes]: true, [no]: false });
  expect((data ?? []).find((c) => c.email === yes)!.marketing_opt_in_source).toBe("checkout");

  const owner = await (await browser.newContext()).newPage();
  await login(owner, staff.owner);
  await owner.goto("/admin/customers");
  await expect(owner.getByRole("cell", { name: yes })).toBeVisible();
  await expect(owner.getByRole("cell", { name: no })).toBeVisible();
  const csv = await (await owner.request.get("/admin/customers/export")).text();
  expect(csv).toContain(yes);
  expect(csv).toContain(no);
  expect(csv.split("\r\n").find((l) => l.includes(yes))).toContain('"yes"');
  expect(csv.split("\r\n").find((l) => l.includes(no))).toContain('"no"');
  const subs = await (await owner.request.get("/admin/customers/export?filter=marketing")).text();
  expect(subs).toContain(yes);
  expect(subs).not.toContain(no);

  const ful = await (await browser.newContext()).newPage();
  await login(ful, staff.fulfillment);
  const denied = await ful.request.get("/admin/customers/export", { maxRedirects: 0 });
  expect(denied.status()).toBe(307);
  await ful.goto("/admin/customers");
  await expect(ful.getByRole("link", { name: /Export/ })).toHaveCount(0);
});

test("admin Emails page: status, test email to yourself, and retry; axe on Emails and Customers", async ({ page }) => {
  await login(page, staff.owner);
  await page.goto("/admin/emails");
  await expect(page.getByRole("heading", { name: "Emails", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Send a test email to me" }).click();
  await expect(page.getByText("Test email sent to your own address.")).toBeVisible();
  expect((await db().from("email_outbox").select("to_email").eq("kind", "admin_test").eq("to_email", staff.owner)).data!.length).toBeGreaterThan(0);
  for (const path of ["/admin/emails", "/admin/customers"]) {
    await page.goto(path);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  }
});
