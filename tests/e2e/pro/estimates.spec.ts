import { test, expect } from "@playwright/test";
import { resetWorkspace, getWorkspace } from "./_helpers";

test.describe.configure({ mode: "serial" });

// Test estimate names deliberately avoid action-verb substrings ("Archive", "Delete",
// "Duplicate") — the row's whole-row navigation button's accessible name includes the
// project name, so e.g. an estimate named "Archive Test" would make a non-exact
// getByRole("button", { name: "Archive" }) locator ALSO match that navigation button.
async function createEstimate(page: import("@playwright/test").Page, name: string) {
  await page.goto("/app/estimates");
  await page.getByRole("button", { name: /new estimate/i }).first().click();
  await page.getByPlaceholder("Smith Driveway").fill(name);
  await page.getByRole("button", { name: /continue/i }).click();
  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(0).fill("30");
  await numberInputs.nth(1).fill("15");
  await numberInputs.nth(2).fill("4");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.locator('input[type="text"]').first().fill("Test Customer");
  await page.getByRole("button", { name: /save & mark sent/i }).click();
  await expect(page).toHaveURL(/\/app\/estimates/);
}

test.describe("Pro app: Estimates tab", () => {
  test("create: full wizard produces an estimate visible in the list and in localStorage", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await createEstimate(page, "E2E Create Job");
    await expect(page.getByText("E2E Create Job")).toBeVisible();
    const ws = await getWorkspace(page);
    expect(ws.estimates.some((e: any) => e.projectName === "E2E Create Job")).toBe(true);
  });

  test("edit: open an estimate, change price, verify it persists", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await createEstimate(page, "E2E Edit Job");
    await page.getByText("E2E Edit Job").click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /continue/i }).click();
    const priceField = page.locator('input[type="number"]').last();
    await priceField.fill("9999");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("button", { name: /save & mark sent/i }).click();
    await page.getByText("E2E Edit Job").click();
    await expect(page.getByText("$9,999")).toBeVisible();
    const ws = await getWorkspace(page);
    const est = ws.estimates.find((e: any) => e.projectName === "E2E Edit Job");
    expect(est.sellingPrice).toBe(9999);
  });

  test("duplicate: creates a second estimate with the same project name", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await createEstimate(page, "E2E Copy Source");
    let ws = await getWorkspace(page);
    expect(ws.estimates.filter((e: any) => e.projectName === "E2E Copy Source").length).toBe(1);

    await page.goto("/app/estimates");
    await page.getByRole("button", { name: "Duplicate", exact: true }).first().click();
    await expect(page.getByText("E2E Copy Source")).toHaveCount(2);
    ws = await getWorkspace(page);
    expect(ws.estimates.filter((e: any) => e.projectName === "E2E Copy Source").length).toBe(2);
    const ids = ws.estimates.filter((e: any) => e.projectName === "E2E Copy Source").map((e: any) => e.id);
    expect(new Set(ids).size).toBe(2);
  });

  test("archive / unarchive: toggles archived flag and list visibility", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await createEstimate(page, "E2E Stash Job");
    // "Save & mark sent" lands on the estimate's DETAIL view (?id=...), not the list — the
    // detail view's own Archive button toggles the same underlying flag as the list's icon
    // button, but the detail view itself doesn't filter by archived status, so list-hiding
    // behavior must be checked by navigating back to the list afterward.
    await page.getByRole("button", { name: "Archive", exact: true }).first().click();
    let ws = await getWorkspace(page);
    expect(ws.estimates.find((e: any) => e.projectName === "E2E Stash Job").archived).toBe(true);

    await page.goto("/app/estimates");
    await expect(page.getByText("E2E Stash Job")).toHaveCount(0);
    await page.getByLabel(/show archived/i).check();
    await expect(page.getByText("E2E Stash Job")).toBeVisible();
    await page.getByRole("button", { name: "Unarchive", exact: true }).click();
    ws = await getWorkspace(page);
    expect(ws.estimates.find((e: any) => e.projectName === "E2E Stash Job").archived).toBe(false);
    await page.goto("/app/estimates");
    await expect(page.getByText("E2E Stash Job")).toBeVisible();
  });

  test("delete: removes the estimate after confirmation", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await createEstimate(page, "E2E Remove Job");
    // Delete only exists on the list row (not the detail view createEstimate lands on).
    await page.goto("/app/estimates");
    await page.getByRole("button", { name: "Delete", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Delete estimate" })).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).last().click();
    await expect(page.getByText("E2E Remove Job")).toHaveCount(0);
    const ws = await getWorkspace(page);
    expect(ws.estimates.some((e: any) => e.projectName === "E2E Remove Job")).toBe(false);
  });

  test("status change + convert to project: accepted estimate can become a project", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    // createEstimate lands directly on the new estimate's detail view.
    await createEstimate(page, "E2E Convert Job");
    await page.getByRole("button", { name: /mark accepted/i }).click();
    await expect(page.getByRole("button", { name: /convert to project/i })).toBeVisible();
    await page.getByRole("button", { name: /convert to project/i }).click();
    await expect(page).toHaveURL(/\/app\/projects/);
    const ws = await getWorkspace(page);
    expect(ws.projects.some((p: any) => p.name === "E2E Convert Job")).toBe(true);
    const est = ws.estimates.find((e: any) => e.projectName === "E2E Convert Job");
    expect(est.status).toBe("accepted");
  });

  test("print: estimate detail print produces a non-trivial PDF (chromium)", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "page.pdf() is Chromium-only");
    await resetWorkspace(page, "/app/estimates");
    // createEstimate lands directly on the new estimate's detail/document view.
    await createEstimate(page, "E2E Print Job");
    const pdf = await page.pdf();
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  test("CSV export: estimates.csv reflects the created estimate", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await createEstimate(page, "E2E CSV Job");
    // Export CSV only exists on the list view.
    await page.goto("/app/estimates");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /export csv/i }).click()]);
    expect(download.suggestedFilename()).toBe("estimates.csv");
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk as Buffer);
    const content = Buffer.concat(chunks).toString("utf-8");
    expect(content).toContain("E2E CSV Job");
    expect(content).toContain("estimateNumber,projectName,customerName,status,sellingPrice");
  });
});
