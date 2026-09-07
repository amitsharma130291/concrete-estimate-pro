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

  test("current-estimate summary and Rate Health render with sample data, no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await resetWorkspace(page);
    await page.getByRole("button", { name: /load sample data/i }).click();
    // Single-current-estimate model: Overview shows the one current estimate's own stats,
    // not cross-estimate aggregates (Quoted/Won/Expected profit/Average margin/Recent
    // estimates were all cross-estimate KPIs and no longer apply -- see OverviewTab.tsx).
    await expect(page.getByRole("heading", { name: "Current estimate" })).toBeVisible();
    await expect(page.getByText("Selling price")).toBeVisible();
    await expect(page.getByText("Required price")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rate Health" })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
