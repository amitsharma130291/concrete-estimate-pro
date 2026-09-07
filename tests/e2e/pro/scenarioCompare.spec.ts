import { test, expect } from "@playwright/test";
import { resetWorkspace } from "./_helpers";

test.describe("Pro app: Scenario A/B compare (estimate wizard, Price step)", () => {
  test("comparing two scenarios shows a diff table and Apply writes the chosen scenario back", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates?new=1");
    await page.getByPlaceholder("Smith Driveway").fill("E2E Scenario Job");
    await page.getByRole("button", { name: /continue/i }).click(); // -> Dimensions
    await page.getByRole("button", { name: /continue/i }).click(); // -> Costs
    await page.getByRole("button", { name: /continue/i }).click(); // -> Price

    await page.getByRole("button", { name: /compare two pricing scenarios/i }).click();
    await expect(page.getByRole("heading", { name: "Compare pricing scenarios" })).toBeVisible();

    const dialog = page.getByRole("dialog");
    // Scenario B's selling price is the last number input in the dialog (both columns
    // share the same field order, B rendered second).
    const sellingPriceB = dialog.locator('input[type="number"]').last();
    await sellingPriceB.fill("9000");

    await expect(dialog.getByText("Order quantity")).toBeVisible();
    await expect(dialog.getByText("True cost")).toBeVisible();
    await expect(dialog.getByText("Profit")).toBeVisible();
    await expect(dialog.getByText("Difference (B − A)")).toBeVisible();

    await page.getByRole("button", { name: /use scenario b/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const priceField = page.locator('input[type="number"]').last();
    await expect(priceField).toHaveValue("9000");
  });

  test("a negative cost in Scenario B shows an error and disables only the Use Scenario B button", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates?new=1");
    await page.getByPlaceholder("Smith Driveway").fill("E2E Scenario Invalid Job");
    await page.getByRole("button", { name: /continue/i }).click(); // -> Dimensions
    await page.getByRole("button", { name: /continue/i }).click(); // -> Costs
    await page.getByRole("button", { name: /continue/i }).click(); // -> Price
    await page.getByRole("button", { name: /compare two pricing scenarios/i }).click();
    await expect(page.getByRole("heading", { name: "Compare pricing scenarios" })).toBeVisible();

    await page.locator("#scenario-b-labor").fill("-500");
    await expect(page.getByText("Must be zero or greater.")).toBeVisible();
    await expect(page.getByText(/Fix the highlighted field in Scenario B/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /use scenario b/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: /use scenario a/i })).toBeEnabled(); // A is untouched, unaffected

    await page.locator("#scenario-b-labor").fill("500");
    await expect(page.getByRole("button", { name: /use scenario b/i })).toBeEnabled();
  });
});
