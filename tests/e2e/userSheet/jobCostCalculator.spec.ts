// Drives the real /concrete-job-cost-calculator page through all 10 user-supplied test
// cases, reading results back from the rendered DOM.
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const userTestCases = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/userTestCases.json", import.meta.url)), "utf-8"));
const TOL_ABS = 1.0;

function close(actual: number, expected: number): boolean {
  if (!Number.isFinite(expected)) return true;
  const diff = Math.abs(actual - expected);
  if (diff <= TOL_ABS) return true;
  return diff / Math.max(Math.abs(actual), Math.abs(expected), 1e-9) <= 5e-3;
}

async function readResultValue(page: Page, label: string): Promise<number | null> {
  const row = page.locator(".text-sm.text-muted", { hasText: label }).first();
  if ((await row.count()) === 0) return null;
  const valueEl = row.locator("xpath=following-sibling::div[1]");
  const text = await valueEl.innerText();
  if (text.trim() === "—") return null;
  const cleaned = text.replace(/[^0-9.\-]/g, "");
  return cleaned === "" || cleaned === "-" ? null : parseFloat(cleaned);
}

const { cases } = (userTestCases as any)["07 Job Cost"];

test.describe("User sheet -- 07 Job Cost (/concrete-job-cost-calculator)", () => {
  for (const c of cases) {
    const testId = c["Test ID"];
    const scenario = c["Scenario"];
    const caseType = c["Case Type"];
    const expectedBehavior = c["Expected Behavior"];

    test(`${testId} ${scenario} (${caseType})`, async ({ page }) => {
      await page.goto("/concrete-job-cost-calculator");

      const fill = async (id: string, value: number | null) => page.fill(`#${id}`, value === null ? "" : String(value));
      await fill("jc-ready-mix-concrete", c["Ready Mix $"]);
      await fill("jc-labor", c["Labor $"]);
      await fill("jc-forms-framing", c["Forms $"]);
      await fill("jc-reinforcement", c["Rebar $"]);
      await fill("jc-pump", c["Pump $"]);
      await fill("jc-equipment", c["Equipment $"]);
      await fill("jc-other", c["Other $"]);

      // An invalid cost field hides the whole "Job Cost Summary" card (including jc-price,
      // which lives inside it) behind an error banner -- check BEFORE trying to fill it.
      if (expectedBehavior === "BLOCK") {
        await expect(page.getByText(/Fix the highlighted cost field/i)).toBeVisible();
        return;
      }

      await page.fill("#jc-overhead", String(c["Overhead %"]));
      await page.fill("#jc-margin", String(c["Target Margin %"]));
      await page.fill("#jc-price", String(c["Selling Price $"]));

      const trueCost = await readResultValue(page, "True cost");
      expect(close(trueCost!, c["Expected True Cost $"]), `${testId}: true cost ${trueCost} vs expected ${c["Expected True Cost $"]}`).toBe(true);

      const margin = await readResultValue(page, "Current margin");
      const expectedMarginPct = c["Expected Margin"] === null || c["Expected Margin"] === "" ? null : c["Expected Margin"] * 100;
      if (expectedMarginPct === null) {
        expect(margin, `${testId}: margin should read as undefined ("—")`).toBeNull();
      } else {
        expect(close(margin!, expectedMarginPct), `${testId}: margin ${margin}% vs expected ${expectedMarginPct}%`).toBe(true);
      }
    });
  }
});
