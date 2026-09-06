import { test, expect } from "@playwright/test";
import { resetWorkspace, getWorkspace } from "./_helpers";

test.describe.configure({ mode: "serial" });

async function createCompletedProject(page: import("@playwright/test").Page, name: string) {
  await page.goto("/app/projects");
  await page.getByRole("button", { name: /new project/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").locator('input[type="text"]').first().fill(name);
  await page.getByRole("button", { name: /save project/i }).click();
  await expect(page.getByText(name)).toBeVisible();
  await page.locator("select").first().selectOption("completed");
}

test.describe("Pro app: Actuals tab", () => {
  test("no eligible projects: Log actual result button is disabled", async ({ page }) => {
    await resetWorkspace(page, "/app/actuals");
    await expect(page.getByRole("button", { name: /log actual result/i })).toBeDisabled();
  });

  test("log actual: create a completed project, log actuals, verify variance display", async ({ page }) => {
    await resetWorkspace(page);
    await createCompletedProject(page, "E2E Actuals Project");
    const before = await getWorkspace(page);
    const project = before.projects.find((p: any) => p.name === "E2E Actuals Project");

    await page.goto("/app/actuals");
    await page.getByRole("button", { name: /log actual result/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const numberInputs = page.getByRole("dialog").locator('input[type="number"]');
    // Order: actualQuantityYd3, actualLaborHours, actualLaborCost, actualMaterialCost, actualEquipmentCost, actualOtherCost, finalSellingPrice
    await numberInputs.nth(0).fill("10"); // actual qty, deliberately over the small estimated qty for a positive variance
    await numberInputs.nth(2).fill("1200"); // labor cost
    await numberInputs.nth(3).fill("1800"); // material cost
    await numberInputs.nth(6).fill("3500"); // final selling price
    await page.getByRole("button", { name: /save actual result/i }).click();

    await expect(page.getByText("E2E Actuals Project")).toBeVisible();
    await expect(page.getByText(/\+\d+(\.\d+)?%/).first()).toBeVisible(); // positive quantity variance badge

    const ws = await getWorkspace(page);
    const actual = ws.actuals.find((a: any) => a.projectId === project.id);
    expect(actual).toBeTruthy();
    expect(actual.actualQuantityYd3).toBe(10);
    expect(actual.finalSellingPrice).toBe(3500);
  });

  test("a project with actuals logged is no longer eligible for a second log", async ({ page }) => {
    await resetWorkspace(page);
    await createCompletedProject(page, "E2E Single Log Project");
    await page.goto("/app/actuals");
    await page.getByRole("button", { name: /log actual result/i }).click();
    await page.getByRole("button", { name: /save actual result/i }).click();
    // Only one eligible project existed; after logging it, the button should disable again.
    await expect(page.getByRole("button", { name: /log actual result/i })).toBeDisabled();
  });

  test("delete: removes a logged actual result", async ({ page }) => {
    await resetWorkspace(page);
    await createCompletedProject(page, "E2E Deletable Actual");
    await page.goto("/app/actuals");
    await page.getByRole("button", { name: /log actual result/i }).click();
    await page.getByRole("button", { name: /save actual result/i }).click();
    await expect(page.getByText("E2E Deletable Actual")).toBeVisible();

    await page.getByRole("button", { name: /delete actual/i }).click();
    await expect(page.getByText("E2E Deletable Actual")).toHaveCount(0);
    const ws = await getWorkspace(page);
    expect(ws.actuals.length).toBe(0);
  });
});
