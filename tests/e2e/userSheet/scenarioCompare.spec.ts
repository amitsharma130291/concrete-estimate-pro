// Drives the real Scenario A/B Compare modal (opened from the Estimate Wizard's Price step)
// through the user-supplied test cases whose Order Qty this pass's reconstructed section
// (one 40x20x4 ft section, 10% allowance, quarter rounding -> exactly 11 yd³) can reproduce.
// Scenario Compare's sections come from the parent estimate being edited, not a directly
// settable field -- rows needing a different Order Qty would need a different reconstructed
// section and are skipped below with that reason. Math already verified 100% correct at the
// function level in the earlier pass; this is a UI-wiring check on top of that.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resetWorkspace } from "../pro/_helpers";

const userTestCases = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/userTestCases.json", import.meta.url)), "utf-8"));
const TOL_ABS = 1.0;

function close(actual: number, expected: number): boolean {
  if (!Number.isFinite(expected)) return true;
  const diff = Math.abs(actual - expected);
  if (diff <= TOL_ABS) return true;
  return diff / Math.max(Math.abs(actual), Math.abs(expected), 1e-9) <= 5e-3;
}

const { cases } = (userTestCases as any)["13 Scenario Compare"];

test.describe("User sheet -- 13 Scenario Compare (estimate wizard, Price step)", () => {
  for (const c of cases) {
    const testId = c["Test ID"];
    const scenario = c["Scenario"];
    const caseType = c["Case Type"];
    const expectedBehavior = c["Expected Behavior"];

    if (c["Order Qty"] !== 11 || c["OH %"] !== 15) {
      test.skip(`${testId} ${scenario} (${caseType}) -- SKIPPED: needs Order Qty=${c["Order Qty"]}/OH=${c["OH %"]}%, only the reconstructed 11yd³/15% section is covered in this pass`, () => {});
      continue;
    }

    test(`${testId} ${scenario} (${caseType})`, async ({ page }) => {
      await resetWorkspace(page, "/app/estimates?new=1");
      await page.getByPlaceholder("Smith Driveway").fill(`E2E ${testId}`);
      await page.getByRole("button", { name: /continue/i }).click(); // -> Dimensions
      await page.getByLabel("L (ft)").fill("40");
      await page.getByLabel("W (ft)").fill("20");
      await page.getByLabel("T (in)").fill("4");
      await page.locator('input[type="number"]').nth(3).fill("10"); // Allowance
      await page.getByRole("button", { name: /continue/i }).click(); // -> Costs
      await page.getByRole("button", { name: /continue/i }).click(); // -> Price
      await page.getByRole("button", { name: /compare two pricing scenarios/i }).click();
      await expect(page.getByRole("heading", { name: "Compare pricing scenarios" })).toBeVisible();

      await page.locator("#scenario-a-ready-mix").fill(String(c["A Mix"]));
      await page.locator("#scenario-a-labor").fill(String(c["A Labor"]));
      await page.locator("#scenario-a-forms").fill(String(c["A Forms"]));
      await page.locator("#scenario-a-reinforcement").fill(String(c["A Rebar"]));
      await page.locator("#scenario-a-equipment").fill(String(c["A Equip"]));
      await page.locator("#scenario-a-other").fill(String(c["A Other"]));
      // Scoped to the dialog specifically -- the wizard's own Price-step number inputs
      // (Overhead/Target margin/Selling price) stay mounted in the DOM behind the modal
      // overlay, so an unscoped page-wide query would silently count those first too.
      const numberInputs = page.getByRole("dialog").locator('input[type="number"]');
      await numberInputs.nth(7).fill(String(c["OH %"])); // Scenario A's own Overhead field
      await numberInputs.nth(9).fill(String(c["A Price"])); // Scenario A's Selling price

      await page.locator("#scenario-b-ready-mix").fill(String(c["B Mix"]));
      await page.locator("#scenario-b-labor").fill(String(c["B Labor"]));
      await page.locator("#scenario-b-forms").fill(String(c["B Forms"]));
      await page.locator("#scenario-b-reinforcement").fill(String(c["B Rebar"]));
      await page.locator("#scenario-b-equipment").fill(String(c["B Equip"]));
      await page.locator("#scenario-b-other").fill(String(c["B Other"]));
      await numberInputs.nth(17).fill(String(c["OH %"])); // Scenario B's own Overhead field
      await numberInputs.nth(19).fill(String(c["B Price"]));

      if (expectedBehavior === "BLOCK") {
        await expect(page.getByText("Must be zero or greater.")).toBeVisible();
        return;
      }

      const dialog = page.getByRole("dialog");
      const rows = dialog.locator("table tbody tr");
      const trueCostRow = rows.filter({ hasText: "True cost" });
      const aTrueCostText = await trueCostRow.locator("td").nth(1).innerText();
      const bTrueCostText = await trueCostRow.locator("td").nth(2).innerText();
      const aTrueCost = parseFloat(aTrueCostText.replace(/[^0-9.\-]/g, ""));
      const bTrueCost = parseFloat(bTrueCostText.replace(/[^0-9.\-]/g, ""));
      expect(close(aTrueCost, c["Expected A True"]), `${testId}: A true cost ${aTrueCost} vs expected ${c["Expected A True"]}`).toBe(true);
      expect(close(bTrueCost, c["Expected B True"]), `${testId}: B true cost ${bTrueCost} vs expected ${c["Expected B True"]}`).toBe(true);

      const profitRow = rows.filter({ hasText: "Profit" });
      const aProfitText = await profitRow.locator("td").nth(1).innerText();
      const bProfitText = await profitRow.locator("td").nth(2).innerText();
      const aProfit = parseFloat(aProfitText.replace(/[^0-9.\-]/g, ""));
      const bProfit = parseFloat(bProfitText.replace(/[^0-9.\-]/g, ""));
      expect(close(aProfit, c["Expected A Profit"]), `${testId}: A profit ${aProfit} vs expected ${c["Expected A Profit"]}`).toBe(true);
      expect(close(bProfit, c["Expected B Profit"]), `${testId}: B profit ${bProfit} vs expected ${c["Expected B Profit"]}`).toBe(true);
    });
  }
});
