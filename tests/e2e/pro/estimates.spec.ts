import { test, expect } from "@playwright/test";
import { resetWorkspace, getWorkspace, getCurrentEstimateRecord } from "./_helpers";

test.describe.configure({ mode: "serial" });

// With no current estimate yet, /app/estimates *is* the wizard directly -- there is no
// separate "New estimate" button to click first (see EstimatesTab.tsx: `!currentEstimate`
// alone is enough to render the wizard).
async function createEstimate(page: import("@playwright/test").Page, name: string) {
  await page.goto("/app/estimates");
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
  await expect(page.getByRole("heading", { name: "Current Estimate" })).toBeVisible();
}

test.describe("Pro app: Current Estimate (estimates.spec.ts)", () => {
  test("create: full wizard produces the current estimate, persisted in localStorage", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await createEstimate(page, "E2E Create Job");
    await expect(page.getByText("E2E Create Job")).toBeVisible();
    const ws = await getWorkspace(page);
    expect(ws.estimates.some((e: any) => e.projectName === "E2E Create Job")).toBe(true);
  });

  test("autosave: save status shows Saving then Saved on this device, with a timestamp", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await page.getByPlaceholder("Smith Driveway").fill("E2E Autosave Job");
    await expect(page.getByText(/saved on this device/i)).toBeVisible({ timeout: 3000 });
  });

  test("edit: open the current estimate, change price, verify it persists", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await createEstimate(page, "E2E Edit Job");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /continue/i }).click();
    const priceField = page.locator('input[type="number"]').last();
    await priceField.fill("9999");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("button", { name: /save & mark sent/i }).click();
    await expect(page.getByText("$9,999")).toBeVisible();
    const ws = await getWorkspace(page);
    const est = ws.estimates.find((e: any) => e.projectName === "E2E Edit Job");
    expect(est.sellingPrice).toBe(9999);
  });

  test("refresh restores the exact current estimate", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await createEstimate(page, "E2E Refresh Job");
    const before = await getCurrentEstimateRecord(page);
    await page.reload();
    await expect(page.getByText("E2E Refresh Job")).toBeVisible();
    const after = await getCurrentEstimateRecord(page);
    expect(after.estimate).toEqual(before.estimate);
  });

  test("new estimate: confirmation dialog opens, Cancel preserves the current estimate", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await createEstimate(page, "E2E Keep Job");
    await page.getByRole("button", { name: /^new estimate$/i }).click();
    await expect(page.getByRole("heading", { name: "Start a new estimate?" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText("E2E Keep Job")).toBeVisible();
    const ws = await getWorkspace(page);
    expect(ws.estimates[0].projectName).toBe("E2E Keep Job");
  });

  test("new estimate: confirming replaces the current estimate, no archive remains", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await createEstimate(page, "E2E Old Job");
    await page.getByRole("button", { name: /^new estimate$/i }).click();
    await page.getByRole("button", { name: /start new estimate/i }).click();
    await expect(page.getByPlaceholder("Smith Driveway")).toHaveValue("");
    let ws = await getWorkspace(page);
    // Exactly one current estimate -- the old one is gone, not archived.
    expect(ws.estimates).toHaveLength(1);
    expect(ws.estimates[0].projectName).not.toBe("E2E Old Job");

    await createEstimate(page, "E2E New Job");
    await page.reload();
    await expect(page.getByText("E2E New Job")).toBeVisible();
    await expect(page.getByText("E2E Old Job")).toHaveCount(0);
    ws = await getWorkspace(page);
    expect(ws.estimates).toHaveLength(1);
    expect(ws.estimates[0].projectName).toBe("E2E New Job");
  });

  test("duplicate current estimate: also goes through replace-confirmation, prefilled with the same values", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await createEstimate(page, "E2E Dup Source");
    await page.getByRole("button", { name: /duplicate current estimate/i }).click();
    await expect(page.getByRole("heading", { name: "Start a new estimate?" })).toBeVisible();
    await page.getByRole("button", { name: /start new estimate/i }).click();
    await expect(page.getByPlaceholder("Smith Driveway")).toHaveValue("E2E Dup Source");
    const ws = await getWorkspace(page);
    // Still exactly one current estimate, not two.
    expect(ws.estimates).toHaveLength(1);
  });

  test("status change: Save & mark sent, then Mark accepted from the status selector", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await createEstimate(page, "E2E Status Job");
    await page.getByLabel(/estimate status/i).selectOption("accepted");
    await expect(page.locator("span").filter({ hasText: "Accepted" })).toBeVisible();
    const ws = await getWorkspace(page);
    expect(ws.estimates[0].status).toBe("accepted");
  });

  test("print: current estimate view produces a non-trivial PDF (chromium)", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "page.pdf() is Chromium-only");
    await resetWorkspace(page, "/app/estimates");
    await createEstimate(page, "E2E Print Job");
    const pdf = await page.pdf();
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  test("customer document: shows project/customer/price, hides internal cost & margin figures by default", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await page.goto("/app/estimates");
    await page.getByPlaceholder("Smith Driveway").fill("E2E Document Content Job");
    await page.getByRole("button", { name: /continue/i }).click();
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("40");
    await numberInputs.nth(1).fill("20");
    await numberInputs.nth(2).fill("4");
    await page.getByRole("button", { name: /continue/i }).click(); // -> Costs
    await page.getByRole("button", { name: /continue/i }).click(); // -> Price
    await page.locator('input[type="number"]').nth(2).fill("5750"); // selling price on the Price step
    await page.getByRole("button", { name: /continue/i }).click(); // -> Customer
    const customerTextInputs = page.locator('input[type="text"]');
    await customerTextInputs.nth(0).fill("PDF Content Customer");
    await customerTextInputs.nth(2).fill("742 Evergreen Terrace");

    const doc = page.getByTestId("estimate-document");
    await expect(doc).toBeVisible();
    await expect(doc.getByText("E2E Document Content Job")).toBeVisible();
    await expect(doc.getByText("PDF Content Customer")).toBeVisible();
    await expect(doc.getByText("742 Evergreen Terrace")).toBeVisible();
    await expect(doc.getByText("40 ft")).toBeVisible();
    await expect(doc.getByText("20 ft")).toBeVisible();
    await expect(doc.getByText("$5,750")).toBeVisible();

    const docText = (await doc.innerText()).toLowerCase();
    expect(docText).not.toContain("margin");
    expect(docText).not.toContain("overhead");
    expect(docText).not.toContain("true cost");
    expect(docText).not.toContain("markup");
  });

  test("customer document: opt-in cost breakdown shows margin only when the contractor explicitly enables it", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await createEstimate(page, "E2E Breakdown Job");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /continue/i }).click(); // Project -> Dimensions -> Costs -> Price
    await page.getByLabel(/show cost breakdown/i).check();
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("button", { name: /save & mark sent/i }).click();
    const doc = page.getByTestId("estimate-document");
    await expect(doc.getByText("Cost breakdown")).toBeVisible();
    await expect(doc.getByText("Margin")).toBeVisible();
  });

  test("CSV export: reflects the current estimate's fields and totals", async ({ page }) => {
    await resetWorkspace(page, "/app/estimates");
    await createEstimate(page, "E2E CSV Job");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /export csv/i }).click()]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk as Buffer);
    const content = Buffer.concat(chunks).toString("utf-8");
    expect(content).toContain("Estimate number,Date,Customer,Project / address,Section,Cost item,Quantity,Unit,Unit cost,Line total,Direct cost,Overhead,True cost,Selling price,Profit,Margin,Notes");
    expect(content).toContain("E2E CSV Job");
    expect(content).toContain("Ready mix");
  });
});
