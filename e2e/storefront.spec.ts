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
  await expect(page.getByRole("button", { name: "Add to Cart" })).toBeEnabled();
});

for (const path of ["/", "/shop", "/brands/ronald-isley", "/brands/sugarhill", "/products/rappers-delight-box-of-10", "/legal/privacy", "/legal/terms", "/legal/age-policy", "/legal/shipping", "/legal/returns", "/legal/restrictions"]) {
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

test.describe("legal pages", () => {
  const pages: [string, string][] = [["privacy", "Privacy Policy"], ["terms", "Terms of Sale"], ["age-policy", "Age Policy"], ["shipping", "Shipping Policy"], ["returns", "Returns Policy"], ["restrictions", "Shipping Restrictions"]];
  for (const [slug, title] of pages) {
    test(`/legal/${slug} is a full page, still marked for legal review`, async ({ page }) => {
      await enter(page, `/legal/${slug}`);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByText("Legal review required.")).toBeVisible();
      expect(await page.locator("main h2").count()).toBeGreaterThanOrEqual(4);
      expect((await page.locator("main").innerText()).length).toBeGreaterThan(1200);
    });
  }
  test("shipping restrictions lists where we can and cannot ship, and the footer links every policy", async ({ page }) => {
    await enter(page, "/legal/restrictions");
    await expect(page.getByRole("heading", { name: "Where we can ship right now" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Where we cannot ship right now" })).toBeVisible();
    for (const title of ["Privacy Policy", "Terms of Sale", "Age Policy", "Shipping Policy", "Returns Policy", "Shipping Restrictions"]) {
      await expect(page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: title })).toBeVisible();
    }
  });
});

test.describe("product photo gallery", () => {
  test("thumbnails, arrows, keyboard and enlarge all switch between the photos", async ({ page }) => {
    await enter(page, "/products/the-plug-box-of-10");
    const thumbs = page.getByRole("group", { name: "Product photos" }).getByRole("button");
    const total = await thumbs.count();
    expect(total).toBeGreaterThanOrEqual(2);
    const count = page.getByText(/^Photo \d+ of \d+$/);
    const mainAlt = () => page.locator(".gallery-main img.gallery-on").getAttribute("alt");

    await expect(count).toHaveText(`Photo 1 of ${total}`);
    const first = await mainAlt();
    await thumbs.nth(1).click();
    await expect(count).toHaveText(`Photo 2 of ${total}`);
    await expect(thumbs.nth(1)).toHaveAttribute("aria-current", "true");
    expect(await mainAlt()).not.toBe(first);

    await page.getByRole("button", { name: "Previous photo" }).first().click();
    await expect(count).toHaveText(`Photo 1 of ${total}`);
    await page.getByRole("button", { name: "Previous photo" }).first().click();
    await expect(count).toHaveText(`Photo ${total} of ${total}`);          // wraps to the last photo
    await page.getByRole("button", { name: "Next photo" }).first().click();
    await expect(count).toHaveText(`Photo 1 of ${total}`);                 // and back to the first

    await thumbs.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    await expect(count).toHaveText(`Photo 2 of ${total}`);
    await page.keyboard.press("ArrowLeft");
    await expect(count).toHaveText(`Photo 1 of ${total}`);

    await page.getByRole("button", { name: /Enlarge photo 1 of/ }).click();
    const dialog = page.getByRole("dialog", { name: "Enlarged product photo" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Next photo" }).click();
    await expect(dialog.getByRole("img")).toHaveAttribute("alt", /.+/);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("only the current photo is exposed to assistive technology", async ({ page }) => {
    await enter(page, "/products/the-plug-box-of-10");
    await expect(page.locator(".gallery-main img.gallery-on")).toHaveCount(1);
    const hidden = await page.locator(".gallery-main img.gallery-off").evaluateAll((els) => els.every((e) => e.getAttribute("aria-hidden") === "true" && e.getAttribute("alt") === ""));
    expect(hidden).toBe(true);
  });
});
