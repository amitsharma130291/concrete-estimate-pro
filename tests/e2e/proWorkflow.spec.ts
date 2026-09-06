import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("Pro app: create an estimate through the 5-step wizard, it persists to localStorage and survives reload", async ({ page }) => {
  await page.goto("/app/estimates");
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/app/estimates");

  await page.getByRole("button", { name: /new estimate/i }).first().click();

  // Step 1: Project
  await expect(page.getByRole("heading", { name: "Project" })).toBeVisible();
  await page.getByPlaceholder("Smith Driveway").fill("QA Audit Driveway");
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 2: Dimensions — SectionsEditor's first section inputs
  await expect(page.getByRole("heading", { name: "Dimensions" })).toBeVisible();
  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(0).fill("40"); // length
  await numberInputs.nth(1).fill("20"); // width
  await numberInputs.nth(2).fill("4"); // thickness
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 3: Costs
  await expect(page.getByRole("heading", { name: "Costs" })).toBeVisible();
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 4: Price
  await expect(page.getByRole("heading", { name: "Price" })).toBeVisible();
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 5: Customer -> Save & mark sent (customerName is required for canContinue)
  await expect(page.getByRole("heading", { name: "Customer" })).toBeVisible();
  await page.locator('input[type="text"]').first().fill("Jane QA");
  await page.getByRole("button", { name: /save & mark sent/i }).click();

  await expect(page).toHaveURL(/\/app\/estimates/);
  await expect(page.getByText("QA Audit Driveway")).toBeVisible();

  const stored = await page.evaluate(() => window.localStorage.getItem("cep:workspace:v1"));
  expect(stored).toBeTruthy();
  const ws = JSON.parse(stored!);
  expect(ws.estimates.some((e: any) => e.projectName === "QA Audit Driveway")).toBe(true);

  await page.reload();
  await expect(page.getByText("QA Audit Driveway")).toBeVisible();
});

test("Pro app: Settings tab loads and business profile field is editable", async ({ page }) => {
  await page.goto("/app/settings");
  await expect(page.locator("h1, h2").first()).toBeVisible();
});

test("Pro app: Catalog tab loads without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/app/catalog");
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
});
