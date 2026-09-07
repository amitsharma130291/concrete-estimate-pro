// Drives the real free-calculator pages (not the calculation functions directly) through
// all 60 user-supplied test cases (10 per page x 6 pages), reading results back from the
// rendered DOM. This is the UI-level companion to tests/oracle/runUserTestSheet.ts, which
// verified the same 140 cases at the function level.
//
// Overhead% and Target Margin% are NOT editable on these pages (ProjectCalculatorIsland.tsx
// hardcodes them to 15%/30% -- confirmed by reading the component's source, not assumed).
// So for any case whose sheet inputs specify a different overhead/margin, only the
// dimension-driven outputs (order quantity, which overhead/margin can't affect) are
// asserted; the cost-dependent outputs are only asserted when the case's overhead/margin
// already match the page's fixed values.
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const userTestCases = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/userTestCases.json", import.meta.url)), "utf-8"));

const PAGE_OVERHEAD = 15;
const PAGE_TARGET_MARGIN = 30;
// The UI displays currency/percent rounded to whole units (formatCurrency/formatPercent
// use 0 decimal places here) -- this checks the page renders the right ballpark result
// (catching a wiring bug), not sub-dollar precision (already verified at the function
// level in the earlier pass). +/-1 unit comfortably covers display rounding on both sides.
const TOL_ABS = 1.0;

function close(actual: number, expected: number): boolean {
  if (!Number.isFinite(expected)) return true; // Infinity/NaN expectations aren't reachable through the capped UI -- not asserted
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

const ROUTES: Record<string, string> = {
  "01 General": "/concrete-cost-calculator",
  "02 Driveway": "/concrete-driveway-cost-calculator",
  "03 Footing": "/concrete-footing-cost-calculator",
  "04 Patio": "/concrete-patio-cost-calculator",
  "05 Sidewalk": "/concrete-sidewalk-cost-calculator",
  "06 Slab": "/concrete-slab-cost-calculator",
};

for (const [sheetName, route] of Object.entries(ROUTES)) {
  const { header, cases } = (userTestCases as any)[sheetName];
  const col = (name: string) => header.indexOf(name);

  test.describe(`User sheet -- ${sheetName} (${route})`, () => {
    for (const c of cases) {
      const testId = c["Test ID"];
      const scenario = c["Scenario"];
      const caseType = c["Case Type"];
      const lengthFt = c["Length ft"];
      const widthValue = c["Width value"];
      const widthUnit = c["Width unit"];
      const thicknessIn = c["Thickness in"];
      const allowancePercent = c["Allowance %"];
      const rounding = c["Rounding"];
      const mix = c["Mix $/yd³"];
      const labor = c["Labor $"];
      const forms = c["Forms $"];
      const rebar = c["Rebar $"];
      const equip = c["Equipment $"];
      const other = c["Other $"];
      const overheadPercent = c["Overhead %"];
      const targetMarginPercent = c["Target Margin %"];
      const sellingPrice = c["Selling Price $"];
      const expectedBehavior = c["Expected Behavior"];

      test(`${testId} ${scenario} (${caseType})`, async ({ page }) => {
        await page.goto(route);

        // The footing page defaults its width unit to "in" -- always set it explicitly
        // (not just when "in" is wanted), or a case wanting "ft" silently keeps the "in"
        // default and the width is read 12x too small.
        const unitSelect = page.getByLabel(/unit$/i);
        if ((await unitSelect.count()) > 0) await unitSelect.selectOption(widthUnit);

        await page.fill("#f-length", lengthFt === null ? "" : String(lengthFt));
        await page.fill("#f-width", widthValue === null ? "" : String(widthValue));
        await page.fill("#f-thick", thicknessIn === null ? "" : String(thicknessIn));
        await page.fill("#f-allow", String(allowancePercent));
        if (rounding) await page.selectOption("#f-round", rounding);

        // A negative/blank dimension hides the whole "Project Estimate" card (including
        // the cost/price fields it contains) behind an error banner -- check for that
        // BEFORE trying to fill the now-nonexistent fields, or the fill just times out.
        const isDimensionCase = lengthFt === null || widthValue === null || thicknessIn === null || lengthFt < 0 || widthValue < 0 || thicknessIn < 0;
        if (isDimensionCase) {
          await expect(page.getByText(/Fix the highlighted field/i)).toBeVisible();
          expect(expectedBehavior, `${testId}: dimension is invalid, sheet should expect BLOCK`).toBe("BLOCK");
          return;
        }

        await page.fill("#f-readymix", String(mix));
        await page.fill("#f-labor", String(labor));
        await page.fill("#f-forms", String(forms));
        await page.fill("#f-reinf", String(rebar));
        await page.fill("#f-equip", String(equip));
        await page.fill("#f-other", String(other));
        await page.fill("#f-price", String(sellingPrice));

        if (expectedBehavior === "BLOCK") {
          // Every remaining BLOCK case in this sheet is cost-field-based (negative labor,
          // blank ready-mix, etc.) -- out of the agreed scope for this pass (cost fields on
          // the free calculators are not yet blocking, only dimensions are). Documented,
          // not silently skipped.
          return;
        }

        const orderQty = await readResultValue(page, "Order quantity");
        expect(orderQty, `${testId}: order quantity`).not.toBeNull();
        expect(close(orderQty!, c["Expected Order yd³"]), `${testId}: order qty ${orderQty} vs expected ${c["Expected Order yd³"]}`).toBe(true);

        if (overheadPercent === PAGE_OVERHEAD && targetMarginPercent === PAGE_TARGET_MARGIN) {
          const trueCost = await readResultValue(page, "True cost");
          expect(close(trueCost!, c["Expected True Cost $"]), `${testId}: true cost ${trueCost} vs expected ${c["Expected True Cost $"]}`).toBe(true);

          const margin = await readResultValue(page, "Current margin");
          const expectedMarginPct = c["Expected Margin"] === null || c["Expected Margin"] === "" ? null : c["Expected Margin"] * 100;
          if (expectedMarginPct === null) {
            expect(margin, `${testId}: margin should read as undefined ("—")`).toBeNull();
          } else {
            expect(close(margin!, expectedMarginPct), `${testId}: margin ${margin}% vs expected ${expectedMarginPct}%`).toBe(true);
          }
        }
      });
    }
  });
}
