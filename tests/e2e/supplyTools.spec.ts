import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const slugs = [
  "concrete-invoice-template",
  "ready-mix-concrete-cost-calculator",
  "concrete-pour-calculator",
  "concrete-material-calculator",
  "concrete-price-per-yard-calculator",
];
async function openTool(page: Page, path: string) {
  await page.goto(path);
  // Native SSR inputs are visible before their React event handlers are attached.
  // Wait for hydration before editing so a pre-hydration fill cannot be reset.
  await page.waitForFunction(() => {
    const island = document.querySelector("#tool astro-island");
    return island && !island.hasAttribute("ssr");
  });
}
for (const slug of slugs) {
  test(`${slug}: rendered SEO, links, accessible tool and responsive layout`, async ({
    page,
  }) => {
    const exceptions: string[] = [];
    page.on("pageerror", (error) => exceptions.push(error.message));
    await openTool(page, `/${slug}`);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://concretecostpro.com/${slug}`,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /.+/,
    );
    await expect(page.locator("#tool input").first()).toBeVisible();
    await expect(page.locator('main a[href="/pricing"]')).toBeVisible();
    await expect(
      page.locator('main a[href="/concrete-estimating-software"]'),
    ).toBeVisible();
    const schema = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(schema.map((s) => JSON.parse(s)["@type"])).toContain(
      "WebApplication",
    );
    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(a11y.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    expect(exceptions).toEqual([]);
  });
}
test("ready-mix tool includes all charges and hides invalid results", async ({
  page,
}) => {
  await openTool(page, "/ready-mix-concrete-cost-calculator");
  await page.locator("#rm-shortLoad").fill("75");
  await page.locator("#rm-pump").fill("300");
  await page.locator("#rm-taxPercent").fill("6");
  const result = page.getByRole("region", { name: "Ready-mix order cost" });
  await expect(result).toContainText("$1,955.70");
  await expect(result).toContainText("$244.46");
  await page.locator("#rm-quantity").fill("");
  await expect(result).toContainText("Results are hidden");
  await expect(result).not.toContainText("$1,955.70");
});
test("supplier comparison ranks total order cost rather than the material rate", async ({
  page,
}) => {
  await openTool(page, "/concrete-price-per-yard-calculator");
  const result = page.getByRole("region", {
    name: "Supplier price comparison",
  });
  await expect(result).toContainText("Supplier B costs $70.00 less");
  await expect(result).toContainText("$177.50");
  await page.locator("#py-quantity").fill("15");
  await expect(result).toContainText("same total");
});
test("combined pour adds and removes sections and rounds the total once", async ({
  page,
}) => {
  await openTool(page, "/concrete-pour-calculator");
  await page.getByRole("button", { name: "Add pour section" }).click();
  await page.locator("#pour-length-1").fill("30");
  await page.locator("#pour-width-1").fill("3");
  const result = page.getByRole("region", { name: "Concrete pour quantity" });
  await expect(result).toContainText("4.000 yd³");
  await page.getByRole("button", { name: "Remove section 2" }).click();
  await expect(result).toContainText("2.750 yd³");
});
test("material schedule applies each purchase increment and validates cleared inputs", async ({
  page,
}) => {
  await openTool(page, "/concrete-material-calculator");
  const result = page.getByRole("region", {
    name: "Material purchase schedule",
  });
  await expect(result).toContainText("$1,515.50");
  await expect(result).toContainText("136.000 linear ft");
  await page.locator("#mat-packSize-0").fill("0");
  await expect(result).toContainText("Results are hidden");
});
test("invoice reconciles selected-line tax, payments and printable customer document", async ({
  page,
}) => {
  await openTool(page, "/concrete-invoice-template");
  await expect(
    page.getByRole("button", { name: "Print / Save invoice as PDF" }),
  ).toBeDisabled();
  await page.locator("#inv-company").fill("Sample Concrete");
  await page.locator("#inv-customer").fill("Sample Customer");
  await page.locator("#inv-date").fill("2026-09-18");
  await page.locator("#inv-due").fill("2026-10-02");
  await page.locator("#inv-quantity-0").fill("12");
  await page.locator("#inv-rate-0").fill("200");
  await page.getByLabel("Apply tax to line 1").check();
  await page.locator("#inv-tax").fill("6");
  await page.locator("#inv-paid").fill("2000");
  const preview = page.getByRole("article", { name: "Invoice preview" });
  await expect(preview).toContainText("$544.00");
  await expect(
    page.getByRole("button", { name: "Print / Save invoice as PDF" }),
  ).toBeEnabled();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("h1")).not.toBeVisible();
  await expect(page.locator("header")).not.toBeVisible();
  await expect(preview).toBeVisible();
  await expect(page.locator("#inv-company")).not.toBeVisible();
  const widths = await preview.evaluate((element) => ({
    document: element.getBoundingClientRect().width,
    container: document.querySelector("#tool")!.getBoundingClientRect().width,
  }));
  expect(widths.document / widths.container).toBeGreaterThan(0.95);
});
test("directory search includes new tools and filters invoices", async ({
  page,
}) => {
  await page.goto("/calculators");
  for (const slug of slugs)
    await expect(
      page.locator(`[data-tool-card][href="/${slug}"]`),
    ).toBeVisible();
  await page
    .getByRole("button", { name: "Estimates & Invoices", exact: true })
    .click();
  await expect(
    page.locator('[data-tool-card][href="/concrete-invoice-template"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-tool-card][href="/concrete-pour-calculator"]'),
  ).not.toBeVisible();
});
test("new pages retain unique instructions and worked examples without JavaScript", async ({
  browser,
}) => {
  for (const slug of slugs) {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`http://localhost:4319/${slug}`);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: /How to use this/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Example:/ }),
    ).toBeVisible();
    // Playwright's text engine deliberately excludes noscript descendants.
    const fallback = await page.locator("noscript p").evaluate((element) => ({
      text: element.textContent,
      height: element.getBoundingClientRect().height,
    }));
    expect(fallback.text).toContain("Enable JavaScript");
    expect(fallback.height).toBeGreaterThan(0);
    await context.close();
  }
});
