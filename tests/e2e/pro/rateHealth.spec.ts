import { test, expect } from "@playwright/test";
import { resetWorkspace, getWorkspace } from "./_helpers";

test.describe.configure({ mode: "serial" });

async function createTemplate(page: import("@playwright/test").Page, name: string) {
  await page.goto("/app/templates");
  await page.getByRole("button", { name: /new template/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").locator('input[type="text"]').first().fill(name);
  await page.getByRole("button", { name: /save template/i }).click();
  await expect(page.getByText(name)).toBeVisible();
}

test.describe("Pro app: Rate Health tab", () => {
  test("no templates: empty state shown", async ({ page }) => {
    await resetWorkspace(page, "/app/rate-health");
    await expect(page.getByText("No templates yet")).toBeVisible();
  });

  test("scenario: a ready-mix cost increase changes true cost and margin in the table", async ({ page }) => {
    await resetWorkspace(page);
    await createTemplate(page, "E2E RH Template");
    await page.goto("/app/rate-health");
    await expect(page.getByText("E2E RH Template")).toBeVisible();

    const marginCellBefore = await page.locator("table tbody tr").first().locator("td").nth(3).innerText();

    const scenarioInputs = page.locator('input[type="number"]');
    await scenarioInputs.nth(0).fill("50"); // Ready mix change %
    await expect(page.getByText(/of 1 standard rates would fall below target/i)).toBeVisible();

    const marginCellAfter = await page.locator("table tbody tr").first().locator("td").nth(3).innerText();
    expect(marginCellAfter).not.toBe(marginCellBefore);
  });

  test("apply to templates: scenario cost change is written back to the template's defaultCosts", async ({ page }) => {
    await resetWorkspace(page);
    await createTemplate(page, "E2E RH Apply Template");
    let ws = await getWorkspace(page);
    const originalRate = ws.templates.find((t: any) => t.name === "E2E RH Apply Template").defaultCosts.readyMixRatePerYd3;

    await page.goto("/app/rate-health");
    const scenarioInputs = page.locator('input[type="number"]');
    await scenarioInputs.nth(0).fill("20"); // Ready mix +20%
    await page.getByRole("button", { name: /apply to templates/i }).click();
    await expect(page.getByRole("heading", { name: "Apply cost changes to templates" })).toBeVisible();
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.getByText(/applied/i)).toBeVisible();

    ws = await getWorkspace(page);
    const newRate = ws.templates.find((t: any) => t.name === "E2E RH Apply Template").defaultCosts.readyMixRatePerYd3;
    expect(newRate).toBeCloseTo(originalRate * 1.2, 5);
  });

  test("target margin override: changing target margin updates the Target column", async ({ page }) => {
    await resetWorkspace(page);
    await createTemplate(page, "E2E RH Target Template");
    await page.goto("/app/rate-health");
    const targetInput = page.locator("#rh-target");
    await targetInput.fill("45");
    await expect(page.locator("table tbody tr").first()).toContainText("45%");
  });
});
