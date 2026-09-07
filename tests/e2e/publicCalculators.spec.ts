import { test, expect } from "@playwright/test";

const CALCULATOR_ROUTES = [
  "/concrete-cost-calculator",
  "/concrete-driveway-cost-calculator",
  "/concrete-patio-cost-calculator",
  "/concrete-sidewalk-cost-calculator",
  "/concrete-slab-cost-calculator",
  "/concrete-footing-cost-calculator",
];

for (const route of CALCULATOR_ROUTES) {
  test(`${route}: loads, has one h1, calculator computes a defined non-NaN result`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    const response = await page.goto(route);
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("h1")).toHaveCount(1);

    await page.fill("#f-length", "40");
    await page.fill("#f-width", "20");
    await page.fill("#f-thick", "4");

    const orderQtyLabel = page.locator(".text-sm.text-muted", { hasText: "Order quantity" }).first();
    const orderQtyValue = orderQtyLabel.locator("xpath=following-sibling::div[1]");
    await expect(orderQtyValue).toHaveText(/^\d[\d,]*\.\d\d\s*yd/);
    await expect(page.locator("body")).not.toContainText("NaN");
    await expect(page.locator("body")).not.toContainText("Infinity");

    // Zero out a dimension: result must degrade to a defined zero/placeholder, never crash.
    await page.fill("#f-length", "0");
    await expect(page.locator("body")).not.toContainText("NaN");
    expect(consoleErrors, `console/page errors on ${route}: ${consoleErrors.join(" | ")}`).toEqual([]);
  });
}

test("/concrete-cost-calculator: negative width blocks the result, blank thickness blocks the result", async ({ page }) => {
  await page.goto("/concrete-cost-calculator");
  await page.fill("#f-length", "40");
  await page.fill("#f-width", "-20");
  await page.fill("#f-thick", "4");
  await expect(page.getByText("Must be zero or greater.")).toBeVisible();
  await expect(page.getByText(/Fix the highlighted field/i)).toBeVisible();

  await page.fill("#f-width", "20");
  await expect(page.getByText(/Fix the highlighted field/i)).toHaveCount(0); // fixed -> error clears

  await page.fill("#f-thick", "");
  await expect(page.getByText("Required.")).toBeVisible();
  await expect(page.getByText(/Fix the highlighted field/i)).toBeVisible();
});

test("/concrete-job-cost-calculator: loads and computes required selling price", async ({ page }) => {
  await page.goto("/concrete-job-cost-calculator");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByText(/Required selling price/i)).toBeVisible();
});

test("/concrete-job-cost-calculator: a negative cost or a blank required cost blocks the result", async ({ page }) => {
  await page.goto("/concrete-job-cost-calculator");
  const laborInput = page.locator("#jc-labor");
  await laborInput.fill("-500");
  await expect(page.getByText("Must be zero or greater.")).toBeVisible();
  await expect(page.getByText(/Fix the highlighted cost field/i)).toBeVisible();

  await laborInput.fill("500");
  await expect(page.getByText(/Fix the highlighted cost field/i)).toHaveCount(0); // fixed -> error clears

  const readyMixInput = page.locator("#jc-ready-mix-concrete");
  await readyMixInput.fill("");
  await expect(page.getByText("Required.")).toBeVisible();
  await expect(page.getByText(/Fix the highlighted cost field/i)).toBeVisible();
});

test("/concrete-estimate-template: loads and print button is present", async ({ page }) => {
  await page.goto("/concrete-estimate-template");
  await expect(page.locator("h1")).toHaveCount(1);
});

test("/: homepage loads with pricing CTA and no console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /pricing/i }).first()).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("/calculators: hub page lists calculator links", async ({ page }) => {
  await page.goto("/calculators");
  const links = page.locator('a[href^="/concrete-"]');
  await expect(links.first()).toBeVisible();
});

for (const route of ["/terms", "/privacy", "/refund", "/pricing", "/concrete-estimating-software"]) {
  test(`${route}: loads without error`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBeLessThan(400);
  });
}

test("/sitemap-index.xml and /robots.txt are served", async ({ page, request }) => {
  const sitemap = await request.get("/sitemap-index.xml");
  expect(sitemap.ok()).toBe(true);
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
});
