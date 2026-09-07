// "Current Estimate vs Actual" (renamed from "Actuals") -- compares the single current
// estimate against one logged actual result for it. The old "eligible projects" / per-job
// list / cross-job historical variance concepts are gone under the single-current-estimate
// model; see ActualsTab.tsx.
import { test, expect } from "@playwright/test";
import { resetWorkspace, getWorkspace } from "./_helpers";

test.describe.configure({ mode: "serial" });

async function createCompletedEstimate(page: import("@playwright/test").Page, name: string) {
  await page.goto("/app/estimates");
  await page.getByPlaceholder("Smith Driveway").fill(name);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: /continue/i }).click(); // -> Costs
  await page.getByRole("button", { name: /continue/i }).click(); // -> Price
  await page.getByRole("button", { name: /continue/i }).click(); // -> Customer
  await page.locator('input[type="text"]').first().fill("Test Customer");
  await page.getByRole("button", { name: /save & mark sent/i }).click();
  await expect(page.getByRole("heading", { name: "Current Estimate" })).toBeVisible();
  await page.getByLabel(/estimate status/i).selectOption("completed");
}

test.describe("Pro app: Current Estimate vs Actual (actuals.spec.ts)", () => {
  test("fresh visit: current estimate always exists (auto-seeded blank draft), Log button is available", async ({ page }) => {
    // The workspace auto-seeds a blank draft as the current estimate from the very first
    // visit (see workspaceContext.tsx's load effect) -- there is no reachable "no current
    // estimate" state through a plain visit, only through code paths this test doesn't
    // exercise. ActualsTab's "No current estimate yet" branch is a defensive fallback.
    await resetWorkspace(page, "/app/actuals");
    await expect(page.getByRole("button", { name: /log actual result/i })).toBeVisible();
  });

  test("log actual: create a completed estimate, log actuals, verify variance display", async ({ page }) => {
    await resetWorkspace(page);
    await createCompletedEstimate(page, "E2E Actuals Estimate");

    await page.goto("/app/actuals");
    await page.getByRole("button", { name: /log actual result/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const numberInputs = page.getByRole("dialog").locator('input[type="number"]');
    // Order: actualQuantityYd3, actualLaborHours, actualLaborCost, actualMaterialCost, actualEquipmentCost, actualOtherCost, finalSellingPrice
    await numberInputs.nth(0).fill("10");
    await numberInputs.nth(2).fill("1200");
    await numberInputs.nth(3).fill("1800");
    await numberInputs.nth(6).fill("3500");
    await page.getByRole("button", { name: /save actual result/i }).click();

    await expect(page.getByText("E2E Actuals Estimate")).toBeVisible();
    await expect(page.getByText(/\+\d+(\.\d+)?%/).first()).toBeVisible();

    const ws = await getWorkspace(page);
    expect(ws.actuals).toHaveLength(1);
    expect(ws.actuals[0].actualQuantityYd3).toBe(10);
    expect(ws.actuals[0].finalSellingPrice).toBe(3500);
  });

  test("actual cost/margin applies the estimate's own overhead rate (not just raw direct costs)", async ({ page }) => {
    await resetWorkspace(page);
    await createCompletedEstimate(page, "E2E Overhead Check Estimate");
    // blankEstimate() defaults to overheadPercent: 15.
    await page.goto("/app/actuals");
    await page.getByRole("button", { name: /log actual result/i }).click();
    const numberInputs = page.getByRole("dialog").locator('input[type="number"]');
    await numberInputs.nth(2).fill("1200");
    await numberInputs.nth(3).fill("1800");
    await numberInputs.nth(6).fill("3500");
    await page.getByRole("button", { name: /save actual result/i }).click();

    // actualCost = direct cost x 1.15 (the estimate's own overhead rate) = $3,450, not the
    // raw $3,000 direct-cost sum.
    await expect(page.getByText("$3,450")).toBeVisible();
    await expect(page.getByText("$3,000")).toHaveCount(0);
    await expect(page.getByText("1%").first()).toBeVisible();
    await expect(page.getByText("14%")).toHaveCount(0);
  });

  test("a negative actual cost field is blocked -- shows an error and disables Save", async ({ page }) => {
    await resetWorkspace(page);
    await createCompletedEstimate(page, "E2E Negative Cost Check Estimate");
    await page.goto("/app/actuals");
    await page.getByRole("button", { name: /log actual result/i }).click();
    const numberInputs = page.getByRole("dialog").locator('input[type="number"]');
    await numberInputs.nth(2).fill("-4000");
    await numberInputs.nth(3).fill("3500");
    await numberInputs.nth(4).fill("700");
    await numberInputs.nth(5).fill("300");
    await numberInputs.nth(6).fill("12000");

    await expect(page.getByText("Must be zero or greater.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /save actual result/i })).toBeDisabled();

    await numberInputs.nth(2).fill("0");
    await expect(page.getByRole("button", { name: /save actual result/i })).toBeEnabled();
    await page.getByRole("button", { name: /save actual result/i }).click();
    await expect(page.getByText("$5,175")).toBeVisible();
    await expect(page.getByText("57%").first()).toBeVisible();
  });

  test("remove actual result: clears the logged actual, back to the empty state for this estimate", async ({ page }) => {
    await resetWorkspace(page);
    await createCompletedEstimate(page, "E2E Removable Actual");
    await page.goto("/app/actuals");
    await page.getByRole("button", { name: /log actual result/i }).click();
    await page.getByRole("button", { name: /save actual result/i }).click();
    await expect(page.getByRole("button", { name: /remove actual result/i })).toBeVisible();

    await page.getByRole("button", { name: /remove actual result/i }).click();
    await expect(page.getByText(/no actual result logged yet/i)).toBeVisible();
    const ws = await getWorkspace(page);
    expect(ws.actuals).toHaveLength(0);
  });

  test("replacing the current estimate also clears its logged actual (no orphaned actual left behind)", async ({ page }) => {
    await resetWorkspace(page);
    await createCompletedEstimate(page, "E2E Actual Cleared On Replace");
    await page.goto("/app/actuals");
    await page.getByRole("button", { name: /log actual result/i }).click();
    await page.getByRole("button", { name: /save actual result/i }).click();
    let ws = await getWorkspace(page);
    expect(ws.actuals).toHaveLength(1);

    await page.goto("/app/estimates");
    await page.getByRole("button", { name: /^new estimate$/i }).click();
    await page.getByRole("button", { name: /start new estimate/i }).click();

    await page.goto("/app/actuals");
    await expect(page.getByText(/no actual result logged yet/i)).toBeVisible();
    ws = await getWorkspace(page);
    expect(ws.actuals).toHaveLength(0);
  });
});
