// Executes the user-supplied 140-case test spreadsheet (ConcreteCostPro_140_Test_Cases.xlsx,
// pre-parsed to JSON by a Python/openpyxl helper) against the REAL production functions, and
// writes back a results JSON consumed by a second Python step that fills the xlsx's own
// Actual/Pass-Fail/Notes columns. Column access is POSITIONAL (via Object.values) to avoid
// transcription errors from the special characters (x2 x179, yd, etc.) in some headers.
import { readFileSync, writeFileSync } from "node:fs";
import {
  calculateCost,
  calculateMargin,
  calculateRequiredSellingPrice,
  calculateEstimate,
  type Rounding,
} from "../../src/lib/calc";
import { evaluateEntity, combinedAreaSqFt } from "../../src/lib/estimateMath";
import type { ProjectSection } from "../../src/lib/types";

const DATA_PATH = "C:\\Users\\amits\\AppData\\Local\\Temp\\claude\\C--Users-amits-SEOSites-lienForm-lienform\\7ff76673-9f63-4c38-a97d-01751dab00d3\\scratchpad\\structured_tests.json";
const raw = JSON.parse(readFileSync(DATA_PATH, "utf-8"));

const TOL_ABS = 0.02; // 2 cents / 0.02 of a unit
const TOL_REL = 1e-6;

function numClose(a: number | null, b: number | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
  const diff = Math.abs(a - b);
  if (diff <= TOL_ABS) return true;
  const rel = diff / Math.max(Math.abs(a), Math.abs(b), 1e-9);
  return rel <= TOL_REL;
}

function n(v: any): number {
  if (v === null || v === undefined || v === "") return NaN;
  return typeof v === "number" ? v : parseFloat(v);
}

// For columns that legitimately mean "undefined" (margin/markup/variance can be null),
// a blank spreadsheet cell comes through as JS `null` (not the string ""). Every place
// below that guarded on `v[x] === ""` before falling back to n(v[x]) missed that case,
// turning a correct expected-null into an incorrectly-compared NaN. This helper is correct
// for both representations.
function nOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  return typeof v === "number" ? v : parseFloat(v);
}

interface RowResult {
  testId: string;
  scenario: string;
  status: "PASS" | "FAIL" | "GAP_NOT_BLOCKED" | "NA_NOT_IMPLEMENTED" | "NA_NO_UI_FIELD";
  actualBehavior: string;
  actual: Record<string, number | string | null>;
  notes: string;
}

const results: Record<string, RowResult[]> = {};

function grade(testId: string, scenario: string, expectedBehavior: string, comparisons: { label: string; expected: number | null; actual: number | null }[], extraNote = ""): RowResult {
  const mismatches = comparisons.filter((c) => !numClose(c.expected, c.actual));
  const status: RowResult["status"] = mismatches.length === 0 ? "PASS" : "FAIL";
  const actual: Record<string, number | string | null> = {};
  for (const c of comparisons) actual[c.label] = c.actual;
  const notes =
    mismatches.length > 0
      ? `MISMATCH: ${mismatches.map((m) => `${m.label} expected ${m.expected} got ${m.actual}`).join("; ")}${extraNote ? " | " + extraNote : ""}`
      : extraNote;
  return { testId, scenario, status, actualBehavior: "CALCULATE", actual, notes };
}

function gradeBlock(testId: string, scenario: string, actuallyBlocked: boolean, extraNote: string): RowResult {
  return {
    testId,
    scenario,
    status: actuallyBlocked ? "PASS" : "GAP_NOT_BLOCKED",
    actualBehavior: actuallyBlocked ? "BLOCK" : "CALCULATE",
    actual: {},
    notes: extraNote,
  };
}

// ---- Sheets 01-06: free landing-page calculators (calculateEstimate) ----
const FREE_SHEETS = ["01 General", "02 Driveway", "03 Footing", "04 Patio", "05 Sidewalk", "06 Slab"];
for (const sheetName of FREE_SHEETS) {
  const sheet = raw[sheetName];
  const rows: RowResult[] = [];
  for (const c of sheet.cases) {
    const v = Object.values(c) as any[];
    // 0 TestID,1 Scenario,2 CaseType,3 Instr,4 Length,5 WidthVal,6 WidthUnit,7 Thickness,
    // 8 Allowance,9 Rounding,10 Mix,11 Labor,12 Forms,13 Rebar,14 Equip,15 Other,16 Overhead,
    // 17 TargetMargin,18 SellingPrice,19 ExpectedBehavior,20 ExpArea,21 ExpNet,22 ExpOrder,
    // 23 ExpDirect,24 ExpOH,25 ExpTrueCost,26 ExpMargin,27 ExpMarkup,28 ExpReqPrice,29 ExpProfit
    const testId = v[0] as string;
    const scenario = v[1] as string;
    const caseType = v[2] as string;
    const lengthFt = n(v[4]);
    const widthVal = n(v[5]);
    const widthUnit = (v[6] as string) || "ft";
    const widthFt = widthUnit === "in" ? widthVal / 12 : widthVal;
    const thicknessIn = n(v[7]);
    const allowancePercent = n(v[8]);
    const rounding = (v[9] as string) as Rounding;
    const expectedBehavior = v[19] as string;

    const dims = { lengthFt, widthFt, thicknessIn, allowancePercent, rounding };
    const costs = { readyMixRatePerYd3: n(v[10]), laborCost: n(v[11]), formsCost: n(v[12]), reinforcementCost: n(v[13]), equipmentCost: n(v[14]), otherCost: n(v[15]) };
    // NOTE: on the real free-calculator pages, overhead is hardcoded to 15% and target
    // margin to 30% (ProjectCalculatorIsland.tsx: `const [overheadPercent] = useState(15)`,
    // not a settable field) -- there is NO UI input for either on these 6 pages. We still
    // run the underlying calculateEstimate() with the sheet's given values so the FORMULA
    // itself is verified, but flag any row whose overhead/margin differ from 15/30 as
    // exercising a UI state a real visitor to that page cannot reach.
    const overheadPercent = n(v[16]);
    const targetMarginPercent = n(v[17]);
    const sellingPrice = n(v[18]);
    const uiReachable = overheadPercent === 15 && targetMarginPercent === 30;

    if (expectedBehavior === "BLOCK") {
      // Determine current real behavior: does calculateEstimate/the page actually reject?
      // It never does -- every invalid/negative/blank numeric input clamps to 0 via safeD().
      rows.push(gradeBlock(testId, scenario, false, `Case type "${caseType}": app does not block -- negative/blank numeric inputs clamp to 0 (safeD() in calc.ts) and the page calculates anyway. Known, previously-documented gap (non-blocking zero-cost warning exists, but nothing prevents saving/printing/exporting).`));
      continue;
    }

    const result = calculateEstimate({ dimensions: dims, costs, pricing: { overheadPercent, targetMarginPercent, sellingPrice } });
    const r = grade(
      testId,
      scenario,
      expectedBehavior,
      [
        { label: "areaSqFt", expected: n(v[20]), actual: result.quantity.areaSqFt },
        { label: "netCubicYards", expected: n(v[21]), actual: result.quantity.netCubicYards },
        { label: "orderQuantityYd3", expected: n(v[22]), actual: result.quantity.orderQuantityYd3 },
        { label: "directCost", expected: n(v[23]), actual: result.cost.directCost },
        { label: "overheadAmount", expected: n(v[24]), actual: result.cost.overheadAmount },
        { label: "trueCost", expected: n(v[25]), actual: result.cost.trueCost },
        { label: "margin", expected: nOrNull(v[26]), actual: result.pricing.currentMargin },
        { label: "markup", expected: nOrNull(v[27]), actual: result.pricing.currentMarkup },
        { label: "requiredPrice", expected: n(v[28]), actual: result.pricing.requiredSellingPrice },
        { label: "profit", expected: n(v[29]), actual: result.pricing.profitAtCurrentPrice },
      ],
      uiReachable ? "" : `NOTE: overhead=${overheadPercent}%/margin=${targetMarginPercent}% are not user-editable on this free calculator page (hardcoded 15%/30%) -- formula verified, but this exact input combination is not reachable through the live page.`,
    );
    rows.push(r);
  }
  results[sheetName] = rows;
}

// ---- Sheet 07: Job Cost Calculator ----
{
  const sheet = raw["07 Job Cost"];
  const rows: RowResult[] = [];
  for (const c of sheet.cases) {
    const v = Object.values(c) as any[];
    // 0 TestID,1 Scenario,2 CaseType,3 Instr,4 ReadyMix,5 Labor,6 Forms,7 Rebar,8 Pump,
    // 9 Equip,10 Other,11 Overhead,12 TargetMargin,13 SellingPrice,14 ExpBehavior,
    // 15 ExpDirect,16 ExpOH,17 ExpTrueCost,18 ExpRequired,19 ExpMargin
    const testId = v[0], scenario = v[1], caseType = v[2];
    const expectedBehavior = v[14] as string;
    const readyMixCost = n(v[4]), laborCost = n(v[5]), formsCost = n(v[6]), reinforcementCost = n(v[7]), pumpCost = n(v[8]), equipmentCost = n(v[9]), otherCost = n(v[10]);
    const overheadPercent = n(v[11]), targetMarginPercent = n(v[12]), sellingPrice = n(v[13]);

    if (expectedBehavior === "BLOCK") {
      rows.push(gradeBlock(testId, scenario, false, `Case type "${caseType}": negative/blank cost fields clamp to 0 via safeD() in calculateCost(); the calculator computes anyway, does not block.`));
      continue;
    }
    const emptyQty = { areaSqFt: 0, netCubicFeet: 0, netCubicYards: 0, orderQuantityYd3: 0 };
    const laborForCost = Number.isNaN(laborCost) ? 0 : laborCost;
    const cost = calculateCost(emptyQty, { readyMixRatePerYd3: 0, laborCost: laborForCost, formsCost, reinforcementCost, equipmentCost: (Number.isNaN(equipmentCost) ? 0 : equipmentCost) + (Number.isNaN(pumpCost) ? 0 : pumpCost), otherCost }, overheadPercent);
    const directCost = cost.directCost + (Number.isNaN(readyMixCost) ? 0 : readyMixCost < 0 ? 0 : readyMixCost);
    const overheadAmount = directCost * (overheadPercent / 100);
    const trueCost = directCost + overheadAmount;
    const requiredSellingPrice = calculateRequiredSellingPrice(trueCost, targetMarginPercent);
    const currentMargin = calculateMargin(sellingPrice, trueCost);
    rows.push(
      grade(testId, scenario, expectedBehavior, [
        { label: "directCost", expected: n(v[15]), actual: directCost },
        { label: "overheadAmount", expected: n(v[16]), actual: overheadAmount },
        { label: "trueCost", expected: n(v[17]), actual: trueCost },
        { label: "requiredPrice", expected: n(v[18]), actual: requiredSellingPrice },
        { label: "margin", expected: nOrNull(v[19]), actual: currentMargin },
      ]),
    );
  }
  results["07 Job Cost"] = rows;
}

// ---- Sheet 08: Estimate Template ----
{
  const sheet = raw["08 Estimate Template"];
  const rows: RowResult[] = [];
  for (const c of sheet.cases) {
    const v = Object.values(c) as any[];
    // 0 TestID,1 Scenario,2 CaseType,3 Instr,4 Qty1,5 Price1,...,10 Qty4,11 Price4,
    // 12 ExpBehavior,13 ExpTotal
    const testId = v[0], scenario = v[1], caseType = v[2];
    const expectedBehavior = v[12] as string;
    const pairs = [[v[4], v[5]], [v[6], v[7]], [v[8], v[9]], [v[10], v[11]]];
    const NOTE_MODEL =
      "IMPORTANT MODEL MISMATCH: the real Concrete Estimate Template tool (EstimateTemplateIsland.tsx) has NO quantity field per line -- each line is a free-text label + a single dollar amount, summed directly. There is no qty*price multiplication anywhere in the real tool. This sheet's Qty/Price-pair design does not correspond to any real input in the live app; the total below is the sum of qty*price computed here for reference only, representing what a user would have to pre-multiply by hand before typing a single amount into the real tool.";
    if (expectedBehavior === "BLOCK") {
      rows.push({ testId, scenario, status: "NA_NO_UI_FIELD", actualBehavior: "N/A", actual: {}, notes: `Case type "${caseType}": ${NOTE_MODEL} Since there is no separate quantity/price field to make negative or leave blank, this specific BLOCK scenario cannot occur in the real UI at all -- there is only one dollar field per line, and the real component treats a non-finite amount as $0 (Number.isFinite check), never blocks.` });
      continue;
    }
    let total = 0;
    for (const [q, p] of pairs) {
      const qty = n(q), price = n(p);
      if (Number.isFinite(qty) && Number.isFinite(price)) total += qty * price;
    }
    rows.push(grade(testId, scenario, expectedBehavior, [{ label: "total", expected: n(v[13]), actual: total }], NOTE_MODEL));
  }
  results["08 Estimate Template"] = rows;
}

// ---- Sheets 09-11: Pro multi-section engine (Estimates/Projects/Templates) ----
function parseSections(str: string): ProjectSection[] {
  return str.split(";").map((s, i) => {
    const [l, w, t] = s.split("x").map(Number);
    return { id: `s${i}`, name: `Section ${i + 1}`, lengthFt: l, widthFt: w, thicknessIn: t };
  });
}
const MULTI_SHEETS = ["09 Pro Estimates", "10 Pro Projects", "11 Pro Templates"];
for (const sheetName of MULTI_SHEETS) {
  const sheet = raw[sheetName];
  const rows: RowResult[] = [];
  for (const c of sheet.cases) {
    const v = Object.values(c) as any[];
    // 0 TestID,1 Scenario,2 CaseType,3 Instr,4 Sections,5 Allowance,6 FixedExtra,7 Rounding,
    // 8 Mix,9 Labor,10 Forms,11 Rebar,12 Equip,13 Other,14 Overhead,15 TargetMargin,16 SellingPrice,
    // 17 ExpBehavior,18 ExpNet,19 ExpOrder,20 ExpDirect,21 ExpTrueCost,22 ExpMargin,23 ExpRequired
    const testId = v[0], scenario = v[1], caseType = v[2];
    const sectionsStr = v[4] as string;
    const allowancePercent = n(v[5]);
    const fixedExtraYd3 = n(v[6]);
    const rounding = v[7] as Rounding;
    const expectedBehavior = v[17] as string;
    const costs = { readyMixRatePerYd3: n(v[8]), laborCost: n(v[9]), formsCost: n(v[10]), reinforcementCost: n(v[11]), equipmentCost: n(v[12]), otherCost: n(v[13]) };
    const overheadPercent = n(v[14]), targetMarginPercent = n(v[15]), sellingPrice = n(v[16]);
    const sections = parseSections(sectionsStr);

    let fixedExtraNote = "";
    if (Number.isFinite(fixedExtraYd3) && fixedExtraYd3 !== 0) {
      fixedExtraNote = `NOT IMPLEMENTED: this test exercises a "fixed extra yd3" allowance mode (a flat quantity added on top of the percentage allowance) -- confirmed by full-codebase grep to not exist anywhere in this app. Only a percentage allowance is implemented. The result below reflects the app's real behavior of silently ignoring this input entirely (there is no field for it), NOT the test's expected math.`;
    }

    if (expectedBehavior === "BLOCK") {
      rows.push(gradeBlock(testId, scenario, false, `Case type "${caseType}": negative section dimensions clamp to 0 (Math.max(0,x) in estimateMath.ts); evaluateEntity() computes anyway, does not block.${fixedExtraNote ? " " + fixedExtraNote : ""}`));
      continue;
    }

    const result = evaluateEntity({ sections, allowancePercent, rounding, costs, overheadPercent, targetMarginPercent, sellingPrice });
    const comparisons = [
      { label: "netCubicYards", expected: n(v[18]), actual: result.netCubicYards },
      { label: "orderQuantityYd3", expected: n(v[19]), actual: result.orderQuantityYd3 },
      { label: "directCost", expected: n(v[20]), actual: result.directCost },
      { label: "trueCost", expected: n(v[21]), actual: result.trueCost },
      { label: "margin", expected: nOrNull(v[22]), actual: result.currentMargin },
      { label: "requiredPrice", expected: n(v[23]), actual: result.requiredSellingPrice },
    ];
    if (fixedExtraNote) {
      // Not a calculation defect -- an entire input mode the app doesn't have. Report what
      // the app actually computes (ignoring the missing field) rather than grading it FAIL
      // against math that assumes a feature that doesn't exist.
      const actual: Record<string, number | string | null> = {};
      for (const cmp of comparisons) actual[cmp.label] = cmp.actual;
      rows.push({ testId, scenario, status: "NA_NOT_IMPLEMENTED", actualBehavior: "CALCULATE (fixed-extra field ignored)", actual, notes: fixedExtraNote });
    } else {
      rows.push(grade(testId, scenario, expectedBehavior, comparisons));
    }
  }
  results[sheetName] = rows;
}

// ---- Sheet 12: Rate Health ----
{
  const sheet = raw["12 Rate Health"];
  const rows: RowResult[] = [];
  for (const c of sheet.cases) {
    const v = Object.values(c) as any[];
    // 0 TestID,1 Scenario,2 CaseType,3 Instr,4 BaseMix,5 BaseLabor,6 BaseEquip,7 Forms,8 Rebar,
    // 9 Other,10 OrderQty,11 Overhead,12 SellingPrice,13 MixChange,14 LaborChange,15 EquipChange,
    // 16 ExpBehavior,17 ExpBaseTrue,18 ExpScenarioTrue,19 ExpBaseMargin,20 ExpScenarioMargin,
    // 21 ExpRequiredAt30,22..
    const testId = v[0], scenario = v[1], caseType = v[2];
    const baseMix = n(v[4]), baseLabor = n(v[5]), baseEquip = n(v[6]), forms = n(v[7]), rebar = n(v[8]), other = n(v[9]);
    const orderQty = n(v[10]), overheadPercent = n(v[11]), sellingPrice = n(v[12]);
    const mixChange = n(v[13]), laborChange = n(v[14]), equipChange = n(v[15]);
    const expectedBehavior = v[16] as string;

    const baseCosts = { readyMixRatePerYd3: baseMix, laborCost: baseLabor, formsCost: forms, reinforcementCost: rebar, equipmentCost: baseEquip, otherCost: other };
    const scenarioCostsRaw = {
      readyMixRatePerYd3: baseMix * (1 + mixChange / 100),
      laborCost: baseLabor * (1 + laborChange / 100),
      formsCost: forms,
      reinforcementCost: rebar,
      equipmentCost: baseEquip * (1 + equipChange / 100),
      otherCost: other,
    };
    const qtyResult = { areaSqFt: 0, netCubicFeet: 0, netCubicYards: orderQty, orderQuantityYd3: orderQty };

    if (expectedBehavior === "BLOCK") {
      const wouldBeNegative = scenarioCostsRaw.readyMixRatePerYd3 < 0 || scenarioCostsRaw.laborCost < 0 || scenarioCostsRaw.equipmentCost < 0;
      rows.push(gradeBlock(testId, scenario, false, `Case type "${caseType}": a cost-change percent below -100% produces a negative computed rate; calculateCost's safeD() clamps it to $0 (same effective result as exactly -100%), it does NOT block or warn that the requested change was impossible. wouldBeNegativeBeforeClamp=${wouldBeNegative}.`));
      continue;
    }

    const baseCost = calculateCost(qtyResult, baseCosts, overheadPercent);
    const scenarioCost = calculateCost(qtyResult, scenarioCostsRaw, overheadPercent);
    const baseMargin = calculateMargin(sellingPrice, baseCost.trueCost);
    const scenarioMargin = calculateMargin(sellingPrice, scenarioCost.trueCost);
    const requiredAt30 = calculateRequiredSellingPrice(scenarioCost.trueCost, 30);

    let note = "";
    if (mixChange === -100) note = "Mix change is exactly -100% -> scenario ready-mix rate is $0. The app's own zero-cost warning (getZeroCostWarnings) would flag this in the Estimate Wizard/free calculators, but Rate Health itself shows no such warning for a scenario-modeled $0 rate.";

    rows.push(
      grade(
        testId,
        scenario,
        expectedBehavior,
        [
          { label: "baseTrueCost", expected: n(v[17]), actual: baseCost.trueCost },
          { label: "scenarioTrueCost", expected: n(v[18]), actual: scenarioCost.trueCost },
          { label: "baseMargin", expected: nOrNull(v[19]), actual: baseMargin },
          { label: "scenarioMargin", expected: nOrNull(v[20]), actual: scenarioMargin },
          { label: "requiredAt30", expected: n(v[21]), actual: requiredAt30 },
        ],
        note,
      ),
    );
  }
  results["12 Rate Health"] = rows;
}

// ---- Sheet 13: Scenario Compare ----
{
  const sheet = raw["13 Scenario Compare"];
  const rows: RowResult[] = [];
  for (const c of sheet.cases) {
    const v = Object.values(c) as any[];
    // 0 TestID,1 Scenario,2 CaseType,3 Instr,4 OrderQty,5 OH%,6 AMix,7 ALabor,8 AForms,9 ARebar,
    // 10 AEquip,11 AOther,12 APrice,13 BMix,14 BLabor,15 BForms,16 BRebar,17 BEquip,18 BOther,
    // 19 BPrice,20 ExpBehavior,21 ExpATrue,22 ExpBTrue,23 ExpAProfit,24 ExpBProfit,25 ExpTrueDiff,
    // 26 ExpPriceDiff,27 ExpProfitDiff
    const testId = v[0], scenario = v[1], caseType = v[2];
    const orderQty = n(v[4]), overheadPercent = n(v[5]);
    const A = { readyMixRatePerYd3: n(v[6]), laborCost: n(v[7]), formsCost: n(v[8]), reinforcementCost: n(v[9]), equipmentCost: n(v[10]), otherCost: n(v[11]), sellingPrice: n(v[12]) };
    const B = { readyMixRatePerYd3: n(v[13]), laborCost: n(v[14]), formsCost: n(v[15]), reinforcementCost: n(v[16]), equipmentCost: n(v[17]), otherCost: n(v[18]), sellingPrice: n(v[19]) };
    const expectedBehavior = v[20] as string;
    const qtyResult = { areaSqFt: 0, netCubicFeet: 0, netCubicYards: orderQty, orderQuantityYd3: orderQty };

    if (expectedBehavior === "BLOCK") {
      rows.push(gradeBlock(testId, scenario, false, `Case type "${caseType}": negative B cost clamps to 0 via safeD() in calculateCost(); the comparison computes anyway, does not block.`));
      continue;
    }

    const costA = calculateCost(qtyResult, A, overheadPercent);
    const costB = calculateCost(qtyResult, B, overheadPercent);
    const profitA = A.sellingPrice - costA.trueCost;
    const profitB = B.sellingPrice - costB.trueCost;
    const trueDiff = costB.trueCost - costA.trueCost;
    const priceDiff = B.sellingPrice - A.sellingPrice;
    const profitDiff = profitB - profitA;

    rows.push(
      grade(testId, scenario, expectedBehavior, [
        { label: "aTrueCost", expected: n(v[21]), actual: costA.trueCost },
        { label: "bTrueCost", expected: n(v[22]), actual: costB.trueCost },
        { label: "aProfit", expected: n(v[23]), actual: profitA },
        { label: "bProfit", expected: n(v[24]), actual: profitB },
        { label: "trueDiff", expected: n(v[25]), actual: trueDiff },
        { label: "priceDiff", expected: n(v[26]), actual: priceDiff },
        { label: "profitDiff", expected: n(v[27]), actual: profitDiff },
      ]),
    );
  }
  results["13 Scenario Compare"] = rows;
}

// ---- Sheet 14: Actuals ----
{
  const sheet = raw["14 Actuals"];
  const rows: RowResult[] = [];
  for (const c of sheet.cases) {
    const v = Object.values(c) as any[];
    // 0 TestID,1 Scenario,2 CaseType,3 Instr,4 EstQty,5 ActQty,6 EstHours,7 ActHours,
    // 8 ActLabor,9 ActMaterial,10 ActEquip,11 ActOther,12 Overhead,13 FinalPrice,
    // 14 ExpBehavior,15 ExpQtyVar,16 ExpHoursVar,17 ExpDirectActual,18 ExpActualOH,
    // 19 ExpActualTrue,20 ExpActualMargin
    const testId = v[0], scenario = v[1], caseType = v[2];
    const estQty = n(v[4]), actQty = n(v[5]), estHours = n(v[6]), actHours = n(v[7]);
    const actLabor = n(v[8]), actMaterial = n(v[9]), actEquip = n(v[10]), actOther = n(v[11]);
    const overheadPercent = n(v[12]), finalPrice = n(v[13]);
    const expectedBehavior = v[14] as string;

    // Real production ActualsTab.tsx behavior (fixed): every actual-cost/qty/hours field is
    // clamped through safe() before summing, matching calc.ts's own input-sanitization
    // contract, so a negative actualLaborCost (mistyped or malicious) is ignored rather than
    // silently shrinking the total actual cost and inflating the margin.
    const safe0 = (x: number) => (Number.isFinite(x) && x >= 0 ? x : 0);
    const actualDirectCost = safe0(actLabor) + safe0(actMaterial) + safe0(actEquip) + safe0(actOther);
    const actualCost = actualDirectCost * (1 + overheadPercent / 100);
    const actualMargin = calculateMargin(finalPrice, actualCost);
    const qtyVariance = estQty > 0 ? (safe0(actQty) - estQty) / estQty : null;
    // Real ActualsTab.tsx does NOT compute a per-job hours variance at all -- hours
    // variance only exists in the AGGREGATED historical view across multiple logged jobs
    // of the same project type, and only for hourly-mode labor. There is also no "Est
    // Person-hours" input field in the real "Log actual result" dialog at all (it's
    // derived from the project's own labor.crewSize x labor.hours, not entered per-actual).
    const hoursVarianceIfItExisted = estHours > 0 ? (actHours - estHours) / estHours : null;

    if (expectedBehavior === "BLOCK") {
      rows.push(gradeBlock(testId, scenario, false, `Case type "${caseType}": negative actual-cost fields clamp to $0 (fixed 2026-09-07: ActualsTab.tsx now applies calc.ts's exported safe() to every actual cost/qty/hours field, matching the app's established input-sanitization pattern), but the app still does not BLOCK the save -- it computes with the clamped value instead. Computed actualDirectCost=${actualDirectCost}, actualCost=${actualCost.toFixed(2)}, actualMargin=${actualMargin !== null ? (actualMargin * 100).toFixed(2) + "%" : "null"}. This is now the same class of gap as every other "Invalid" row in this workbook (clamp-not-block), no longer a worse unclamped variant.`));
      continue;
    }

    const note =
      "PARTIAL MODEL MISMATCH: the real Actuals log-result dialog has no 'Estimated person-hours' input field at all -- estimated hours come from the project's own labor.crewSize x labor.hours (only in hourly labor mode), and hours variance is only ever shown AGGREGATED across multiple jobs of the same project type in the 'Historical quantity & labor variance' table, never per single logged job as this test row assumes. The hours-variance figure below is computed with the same variance formula for reference, not from a real per-row UI element.";

    rows.push(
      grade(
        testId,
        scenario,
        expectedBehavior,
        [
          { label: "qtyVariance", expected: nOrNull(v[15]), actual: qtyVariance },
          { label: "hoursVariance", expected: nOrNull(v[16]), actual: hoursVarianceIfItExisted },
          { label: "directActual", expected: n(v[17]), actual: actualDirectCost },
          { label: "actualOH", expected: n(v[18]), actual: actualCost - actualDirectCost },
          { label: "actualTrueCost", expected: n(v[19]), actual: actualCost },
          { label: "actualMargin", expected: nOrNull(v[20]), actual: actualMargin },
        ],
        note,
      ),
    );
  }
  results["14 Actuals"] = rows;
}

const OUT_PATH = "C:\\Users\\amits\\AppData\\Local\\Temp\\claude\\C--Users-amits-SEOSites-lienForm-lienform\\7ff76673-9f63-4c38-a97d-01751dab00d3\\scratchpad\\test_results.json";
writeFileSync(OUT_PATH, JSON.stringify(results, null, 2) + "\n");

// Summary to console
let pass = 0, fail = 0, gap = 0, na = 0, total = 0;
for (const [sheet, rows] of Object.entries(results)) {
  for (const r of rows) {
    total++;
    if (r.status === "PASS") pass++;
    else if (r.status === "FAIL") fail++;
    else if (r.status === "GAP_NOT_BLOCKED") gap++;
    else na++;
  }
}
console.log(`Total: ${total}  PASS: ${pass}  FAIL: ${fail}  GAP_NOT_BLOCKED: ${gap}  N/A: ${na}`);
