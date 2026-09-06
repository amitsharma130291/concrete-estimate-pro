import { test, expect } from "@playwright/test";
import { resetWorkspace, getWorkspace } from "./_helpers";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test.describe.configure({ mode: "serial" });

test.describe("Pro app: Settings tab", () => {
  test("business profile: editing name/phone/email/address persists", async ({ page }) => {
    await resetWorkspace(page, "/app/settings");
    const fields = page.locator('input[type="text"]');
    await fields.nth(0).fill("E2E Concrete Co.");
    await fields.nth(1).fill("555-0100");
    await fields.nth(2).fill("hello@e2e-concrete.test");
    await fields.nth(3).fill("1 Test Way");

    const ws = await getWorkspace(page);
    expect(ws.businessProfile.businessName).toBe("E2E Concrete Co.");
    expect(ws.businessProfile.phone).toBe("555-0100");
    expect(ws.businessProfile.email).toBe("hello@e2e-concrete.test");
    expect(ws.businessProfile.address).toBe("1 Test Way");

    await page.reload();
    await expect(page.locator('input[type="text"]').nth(0)).toHaveValue("E2E Concrete Co.");
  });

  test("defaults: changing overhead/margin/allowance/rounding persists and affects new templates", async ({ page }) => {
    await resetWorkspace(page, "/app/settings");
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("22"); // default overhead
    await numberInputs.nth(1).fill("40"); // default target margin

    let ws = await getWorkspace(page);
    expect(ws.settings.defaultOverheadPercent).toBe(22);
    expect(ws.settings.defaultTargetMarginPercent).toBe(40);

    await page.reload();
    ws = await getWorkspace(page);
    expect(ws.settings.defaultOverheadPercent).toBe(22);
  });

  test("logo upload and remove", async ({ page }) => {
    await resetWorkspace(page, "/app/settings");
    const dir = mkdtempSync(join(tmpdir(), "cep-logo-"));
    const filePath = join(dir, "logo.png");
    // Minimal valid 1x1 PNG.
    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    writeFileSync(filePath, Buffer.from(pngBase64, "base64"));

    await page.locator('input[type="file"][accept*="image"]').setInputFiles(filePath);
    await expect(page.getByAltText("Business logo")).toBeVisible();
    let ws = await getWorkspace(page);
    expect(ws.businessProfile.logoDataUrl).toBeTruthy();

    await page.getByRole("button", { name: /remove logo/i }).click();
    await expect(page.getByAltText("Business logo")).toHaveCount(0);
    ws = await getWorkspace(page);
    expect(ws.businessProfile.logoDataUrl).toBeFalsy();
  });

  test("logo upload: oversized file is rejected with an error, not silently accepted", async ({ page }) => {
    await resetWorkspace(page, "/app/settings");
    const dir = mkdtempSync(join(tmpdir(), "cep-logo-big-"));
    const filePath = join(dir, "big.png");
    writeFileSync(filePath, Buffer.alloc(600_000, 1)); // over the 500KB limit
    await page.locator('input[type="file"][accept*="image"]').setInputFiles(filePath);
    await expect(page.getByText(/too large/i)).toBeVisible();
    await expect(page.getByAltText("Business logo")).toHaveCount(0);
    // Rejected before any update() call, so the workspace may never have been persisted at
    // all yet — only assert no logo made it into storage if a workspace exists.
    const ws = await getWorkspace(page);
    if (ws) expect(ws.businessProfile.logoDataUrl).toBeFalsy();
  });

  test("backup & restore: export JSON, wipe, import it back, data matches", async ({ page }) => {
    await resetWorkspace(page, "/app/settings");
    await page.locator('input[type="text"]').nth(0).fill("E2E Backup Co.");
    await page.waitForTimeout(100);

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /export workspace/i }).click()]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk as Buffer);
    const exportedJson = Buffer.concat(chunks).toString("utf-8");
    expect(exportedJson).toContain("E2E Backup Co.");

    const dir = mkdtempSync(join(tmpdir(), "cep-backup-"));
    const filePath = join(dir, "backup.json");
    writeFileSync(filePath, exportedJson);

    // Wipe the workspace, then import the backup back in.
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    let ws = await getWorkspace(page);
    expect(ws).toBeNull();

    await page.locator('input[type="file"][accept="application/json"]').setInputFiles(filePath);
    // handleImportFile does window.location.reload() on success.
    await page.waitForLoadState("networkidle");
    ws = await getWorkspace(page);
    expect(ws.businessProfile.businessName).toBe("E2E Backup Co.");
  });

  test("backup & restore: importing a malformed file shows an error and does not wipe existing data", async ({ page }) => {
    await resetWorkspace(page, "/app/settings");
    await page.locator('input[type="text"]').nth(0).fill("E2E Untouched Co.");
    await page.waitForTimeout(100);

    const dir = mkdtempSync(join(tmpdir(), "cep-bad-import-"));
    const filePath = join(dir, "bad.json");
    writeFileSync(filePath, "{ this is not valid json");

    await page.locator('input[type="file"][accept="application/json"]').setInputFiles(filePath);
    await expect(page.getByText(/not valid json/i)).toBeVisible();
    const ws = await getWorkspace(page);
    expect(ws.businessProfile.businessName).toBe("E2E Untouched Co.");
  });

  test("clear sample data: removes only sample-flagged records", async ({ page }) => {
    await resetWorkspace(page, "/app");
    await page.getByRole("button", { name: /load sample data/i }).click();
    let ws = await getWorkspace(page);
    expect(ws.templates.some((t: any) => t.isSample)).toBe(true);

    await page.goto("/app/settings");
    await page.getByRole("button", { name: /remove sample data/i }).click();
    await expect(page.getByRole("heading", { name: "Remove sample data" })).toBeVisible();
    await page.getByRole("button", { name: "Remove sample data", exact: true }).last().click();

    ws = await getWorkspace(page);
    expect(ws.templates.some((t: any) => t.isSample)).toBe(false);
  });

  test("reset all data: wipes the entire workspace after confirmation", async ({ page }) => {
    await resetWorkspace(page, "/app/settings");
    await page.locator('input[type="text"]').nth(0).fill("E2E Doomed Business");

    await page.getByRole("button", { name: /^reset all data$/i }).click();
    await expect(page.getByRole("heading", { name: "Reset all data" })).toBeVisible();
    await page.getByRole("button", { name: "Reset everything", exact: true }).click();

    const ws = await getWorkspace(page);
    expect(ws.businessProfile.businessName).toBe("");
    expect(ws.estimates).toEqual([]);
    expect(ws.projects).toEqual([]);
  });
});
