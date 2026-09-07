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

test.describe("Pro app: Templates tab", () => {
  test("create: new template appears as a card and in localStorage", async ({ page }) => {
    await resetWorkspace(page, "/app/templates");
    await createTemplate(page, "E2E Standard Slab");
    const ws = await getWorkspace(page);
    expect(ws.templates.some((t: any) => t.name === "E2E Standard Slab")).toBe(true);
  });

  test("edit: change the template's ready-mix rate and verify recalculation", async ({ page }) => {
    await resetWorkspace(page, "/app/templates");
    await createTemplate(page, "E2E Editable Template");
    let ws = await getWorkspace(page);
    const before = ws.templates.find((t: any) => t.name === "E2E Editable Template").defaultCosts.readyMixRatePerYd3;

    await page.getByRole("button", { name: "Edit", exact: true }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // Number input order in the template dialog: [0]=Length [1]=Width [2]=Thickness
    // [3]=Allowance% [4]=Ready-mix rate ...
    const readyMixInput = page.getByRole("dialog").locator('input[type="number"]').nth(4);
    await readyMixInput.fill("999");
    await page.getByRole("button", { name: /save template/i }).click();

    ws = await getWorkspace(page);
    const after = ws.templates.find((t: any) => t.name === "E2E Editable Template").defaultCosts.readyMixRatePerYd3;
    expect(after).toBe(999);
    expect(after).not.toBe(before);
  });

  test("a negative or blank section dimension shows an error and disables Save template", async ({ page }) => {
    await resetWorkspace(page, "/app/templates");
    await page.goto("/app/templates");
    await page.getByRole("button", { name: /new template/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const saveButton = page.getByRole("button", { name: /save template/i });
    await expect(saveButton).toBeEnabled(); // valid defaults -> starts enabled

    await page.getByLabel("Length (ft)").fill("-30");
    await expect(page.getByText("Must be zero or greater.")).toBeVisible();
    await expect(saveButton).toBeDisabled();

    await page.getByLabel("Length (ft)").fill("10");
    await expect(saveButton).toBeEnabled(); // fixed -> re-enabled
  });

  test("duplicate: creates a (copy) with an independent id", async ({ page }) => {
    await resetWorkspace(page, "/app/templates");
    await createTemplate(page, "E2E Duplicable");
    await page.getByRole("button", { name: /duplicate/i }).click();
    await expect(page.getByText("E2E Duplicable (copy)")).toBeVisible();
    const ws = await getWorkspace(page);
    const original = ws.templates.find((t: any) => t.name === "E2E Duplicable");
    const copy = ws.templates.find((t: any) => t.name === "E2E Duplicable (copy)");
    expect(original).toBeTruthy();
    expect(copy).toBeTruthy();
    expect(copy.id).not.toBe(original.id);
  });

  test("delete: removes the template after confirmation", async ({ page }) => {
    await resetWorkspace(page, "/app/templates");
    await createTemplate(page, "E2E Removable Template");
    await page.getByRole("button", { name: /^delete/i }).first().click();
    await expect(page.getByRole("heading", { name: "Delete template" })).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("E2E Removable Template")).toHaveCount(0);
    const ws = await getWorkspace(page);
    expect(ws.templates.some((t: any) => t.name === "E2E Removable Template")).toBe(false);
  });

  test("start estimate from template: navigates to a pre-filled new estimate", async ({ page }) => {
    await resetWorkspace(page, "/app/templates");
    await createTemplate(page, "E2E Launchable Template");
    const ws = await getWorkspace(page);
    const template = ws.templates.find((t: any) => t.name === "E2E Launchable Template");
    await page.getByRole("button", { name: /start estimate/i }).click();
    // Starting from a template seeds the new current estimate and then rewrites the URL
    // back to the canonical /app/estimates -- the query params don't linger (see
    // EstimatesTab.tsx's window.history.replaceState after handling ?new=1&templateId=).
    await expect(page).toHaveURL(/\/app\/estimates$/);
    await expect(page.getByPlaceholder("Smith Driveway")).toHaveValue(template.name);
    const estimate = (await getWorkspace(page)).estimates[0];
    expect(estimate.projectType).toBe(template.projectType);
    expect(estimate.costs).toEqual(template.defaultCosts);
  });
});
