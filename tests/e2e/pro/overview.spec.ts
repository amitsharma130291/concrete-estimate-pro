import { test, expect } from "@playwright/test";
import { resetWorkspace, getWorkspace } from "./_helpers";

test.describe("Pro app: Overview tab (/app)", () => {
  test("empty workspace shows the welcome state with Load sample data", async ({ page }) => {
    await resetWorkspace(page);
    await expect(page.getByText("Welcome to Concrete Cost Pro")).toBeVisible();
    await expect(page.getByRole("button", { name: /load sample data/i })).toBeVisible();
  });

  test("Load sample data seeds templates/projects/estimates and persists across reload", async ({ page }) => {
    await resetWorkspace(page);
    await page.getByRole("button", { name: /load sample data/i }).click();
    await expect(page.getByRole("heading", { name: "Rate Health" })).toBeVisible();
    const ws = await getWorkspace(page);
    expect(ws.templates.length).toBeGreaterThan(0);
    expect(ws.estimates.length).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Rate Health" })).toBeVisible();
    const wsAfterReload = await getWorkspace(page);
    expect(wsAfterReload.templates.length).toBe(ws.templates.length);
  });

  test("KPI tiles and recent estimates list render with sample data, no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await resetWorkspace(page);
    await page.getByRole("button", { name: /load sample data/i }).click();
    await expect(page.getByText("Quoted")).toBeVisible();
    await expect(page.getByText("Won")).toBeVisible();
    await expect(page.getByText("Expected profit")).toBeVisible();
    await expect(page.getByText("Average margin")).toBeVisible();
    await expect(page.getByText("Recent estimates")).toBeVisible();
    expect(errors).toEqual([]);
  });
});
