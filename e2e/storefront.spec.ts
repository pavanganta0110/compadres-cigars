import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function enter(page: Page, next = "/") {
  await page.goto(`/age-gate?next=${encodeURIComponent(next)}`);
  await page.getByLabel("I confirm I am 21 years of age or older").check();
  await page.getByRole("button", { name: "Enter site" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/age-gate"));
}

test("every page redirects to the age gate without a valid cookie", async ({ page }) => {
  await page.goto("/shop");
  await expect(page).toHaveURL(/\/age-gate\?next=%2Fshop/);
});

test("a forged cookie is rejected", async ({ context, page }) => {
  await context.addCookies([{ name: "cc_age", value: "true", url: "http://localhost:3100" }]);
  await page.goto("/");
  await expect(page).toHaveURL(/age-gate/);
});

test("gate needs the checkbox and blocks open redirects", async ({ page }) => {
  await page.goto("/age-gate?next=//evil.example");
  await page.getByLabel("I confirm I am 21 years of age or older").check();
  await page.getByRole("button", { name: "Enter site" }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
});

test("gate cookie is HttpOnly", async ({ context, page }) => {
  await enter(page);
  const c = (await context.cookies()).find((x) => x.name === "cc_age");
  expect(c?.httpOnly).toBe(true);
});

test("browse: home, shop (no filter bar), brands, product", async ({ page }) => {
  await enter(page, "/shop");
  await expect(page.getByRole("heading", { name: "Shop" })).toBeVisible();
  await expect(page.getByText(/results/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /The Plug/ }).first()).toBeVisible();
  await page.goto("/brands/sugarhill");
  await expect(page.getByRole("heading", { level: 1, name: "Sugarhill" })).toBeVisible();
  await page.goto("/products/the-plug-box-of-10");
  await expect(page.getByText("$149.00").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to Cart" })).toBeDisabled();
});

for (const path of ["/", "/shop", "/brands/ronald-isley", "/brands/sugarhill", "/products/rappers-delight-box-of-10", "/legal/privacy"]) {
  test(`axe: ${path}`, async ({ page }) => {
    await enter(page, path);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });
}
test("axe: age gate", async ({ page }) => {
  await page.goto("/age-gate");
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
});
