import { test, expect } from "@playwright/test";
import { resetWorkspace, getWorkspace } from "./_helpers";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test.describe.configure({ mode: "serial" });

test.describe("Pro app: Catalog tab", () => {
  test("Ready Mix sub-tab: add, edit, delete a row", async ({ page }) => {
    await resetWorkspace(page, "/app/catalog");
    await expect(page.getByText("Nothing here yet")).toBeVisible();

    await page.getByRole("button", { name: /add item/i }).click();
    const row = page.locator("table tbody tr").first();
    await row.locator("input").nth(0).fill("E2E Ready Mix 3500 PSI");
    await row.locator("input").nth(3).fill("172.50");

    let ws = await getWorkspace(page);
    let item = ws.catalog.find((c: any) => c.kind === "readyMix");
    expect(item.name).toBe("E2E Ready Mix 3500 PSI");
    expect(item.unitCost).toBe(172.5);

    await row.getByRole("button", { name: /remove/i }).click();
    await expect(page.getByText("Nothing here yet")).toBeVisible();
    ws = await getWorkspace(page);
    expect(ws.catalog.some((c: any) => c.kind === "readyMix")).toBe(false);
  });

  test("Materials sub-tab: independent from Ready Mix", async ({ page }) => {
    await resetWorkspace(page, "/app/catalog");
    await page.getByRole("tab", { name: "Materials" }).click();
    await page.getByRole("button", { name: /add item/i }).click();
    const row = page.locator("table tbody tr").first();
    await row.locator("input").nth(0).fill("E2E Rebar #4");
    const ws = await getWorkspace(page);
    expect(ws.catalog.some((c: any) => c.kind === "material" && c.name === "E2E Rebar #4")).toBe(true);
    expect(ws.catalog.some((c: any) => c.kind === "readyMix")).toBe(false);
  });

  test("Labor sub-tab: add and edit a labor rate", async ({ page }) => {
    await resetWorkspace(page, "/app/catalog");
    await page.getByRole("tab", { name: "Labor" }).click();
    await page.getByRole("button", { name: /add labor rate/i }).click();
    const row = page.locator(".flex.items-center.gap-2").filter({ has: page.locator('input[type="text"]') }).first();
    await row.locator('input[type="text"]').fill("E2E Finish Crew");
    await row.locator('input[type="number"]').fill("42");
    const ws = await getWorkspace(page);
    const rate = ws.laborRates.find((l: any) => l.name === "E2E Finish Crew");
    expect(rate).toBeTruthy();
    expect(rate.loadedRatePerHour).toBe(42);
  });

  test("Equipment sub-tab: add equipment with a unit selector", async ({ page }) => {
    await resetWorkspace(page, "/app/catalog");
    await page.getByRole("tab", { name: "Equipment" }).click();
    await page.getByRole("button", { name: /add equipment/i }).click();
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.fill("E2E Concrete Pump");
    await page.locator("select").first().selectOption("per day");
    await page.locator('input[type="number"]').first().fill("650");
    const ws = await getWorkspace(page);
    const eq = ws.equipment.find((e: any) => e.name === "E2E Concrete Pump");
    expect(eq).toBeTruthy();
    expect(eq.unit).toBe("per day");
    expect(eq.cost).toBe(650);
  });

  test("CSV export: Ready Mix catalog downloads a matching CSV", async ({ page }) => {
    await resetWorkspace(page, "/app/catalog");
    await page.getByRole("button", { name: /add item/i }).click();
    const row = page.locator("table tbody tr").first();
    await row.locator("input").nth(0).fill("E2E Export Mix");
    await row.locator("input").nth(3).fill("180");

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /export csv/i }).click()]);
    expect(download.suggestedFilename()).toBe("readyMix-catalog.csv");
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk as Buffer);
    const content = Buffer.concat(chunks).toString("utf-8");
    expect(content).toContain("E2E Export Mix");
    expect(content).toContain("180");
  });

  test("CSV import: uploading a CSV adds catalog rows", async ({ page }) => {
    await resetWorkspace(page, "/app/catalog");
    const dir = mkdtempSync(join(tmpdir(), "cep-csv-"));
    const filePath = join(dir, "import.csv");
    writeFileSync(filePath, "name,supplier,unit,unitCost\nE2E Imported Mix,Acme Supply,yd³,199.99\n");

    // Set files directly on the hidden <input type="file"> rather than clicking the visible
    // "Import CSV" button first — that button programmatically opens a real OS file dialog
    // (fileRef.current.click()), which conflicts with setInputFiles.
    await page.locator('input[type="file"][accept=".csv"]').setInputFiles(filePath);
    // Catalog rows render as <input value=...> — a value, not a text node — so getByText
    // won't match it; check the input's value directly instead.
    await expect(page.locator('input[value="E2E Imported Mix"]')).toBeVisible();
    const ws = await getWorkspace(page);
    const imported = ws.catalog.find((c: any) => c.name === "E2E Imported Mix");
    expect(imported).toBeTruthy();
    expect(imported.unitCost).toBe(199.99);
    expect(imported.supplier).toBe("Acme Supply");
  });
});
