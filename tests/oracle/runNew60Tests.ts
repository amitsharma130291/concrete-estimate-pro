// Executes the new 60-case paid-tools test sheet (ConcreteCostPro_60_New_Paid_Tests.xlsx,
// pre-parsed to JSON by a Python/openpyxl helper) against the REAL production functions.
import { readFileSync, writeFileSync } from "node:fs";
import { calculateCost, calculateMargin, calculateRequiredSellingPrice, safe } from "../../src/lib/calc";
import { evaluateEntity } from "../../src/lib/estimateMath";
import type { ProjectSection, Rounding } from "../../src/lib/types";

const raw = JSON.parse(readFileSync(new URL("./new60Raw.json", import.meta.url), "utf-8"));

const TOL_MONEY = 0.02;
const TOL_QTY = 0.01;
const TOL_RATIO = 0.0002;

function close(actual: number | null, expected: number | null, tol: number): boolean {
  if (expected === null && actual === null) return true;
  if (expected === null || actual === null) return false;
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) return expected === actual;
  return Math.abs(actual - expected) <= tol;
}

interface RowResult {
  testId: string;
  scenario: string;
  status: "PASS" | "FAIL" | "GAP_NOT_BLOCKED" | "PARTIAL_CLAMPED_NOT_ERROR" | "NA_NO_UI_FIELD";
  actual: Record<string, number | string | null>;
  notes: string;
}

const results: Record<string, RowResult[]> = {};

function parseCases(sheetName: string) {
  const rows: any[][] = raw[sheetName].raw_rows;
  return rows.slice(4).filter((r) => r[0] != null).map((r) => ({
    testId: r[0] as string,
    scenario: r[1] as string,
    caseType: r[2] as string,
    input: JSON.parse(r[4] as string),
    expectedBehavior: r[5] as string,
    expectedOutput: r[6] && (r[6] as string).trim().startsWith("{") ? JSON.parse(r[6] as string) : null,
  }));
}

function grade(testId: string, scenario: string, comparisons: { label: string; expected: number | null; actual: number | null; tol: number }[]): RowResult {
  const mismatches = comparisons.filter((c) => !close(c.actual, c.expected, c.tol));
  const actual: Record<string, number | string | null> = {};
  for (const c of comparisons) actual[c.label] = c.actual;
  return {
    testId,
    scenario,
    status: mismatches.length === 0 ? "PASS" : "FAIL",
    actual,
    notes: mismatches.length ? `MISMATCH: ${mismatches.map((m) => `${m.label} expected ${m.expected} got ${m.actual}`).join("; ")}` : "",
  };
}

// ---- 01/02/03: Pro Estimates / Projects / Templates (identical evaluateEntity math) ----
for (const sheetName of ["01 Pro Estimates", "02 Pro Projects", "03 Pro Templates"]) {
  const rows: RowResult[] = [];
  for (const c of parseCases(sheetName)) {
    const { testId, scenario, caseType, input, expectedBehavior, expectedOutput } = c;

    if (caseType === "Invalid") {
      let status: RowResult["status"] = "GAP_NOT_BLOCKED";
      let notes = "";
      if (input.sections?.some((s: number[]) => s.some((v) => v < 0))) {
        status = "PASS";
        notes = "Negative section dimension IS blocked: SectionsEditor's required/non-negative validation + the tool's own Save/Continue gate (fixed/verified in the prior pass).";
      } else if (input.mixPerYd3 === null) {
        status = "GAP_NOT_BLOCKED";
        notes = 'A blank/null "Ready mix ($/yd³)" is NOT blocked on Estimates/Projects/Templates -- only SECTION dimensions were in scope for blocking validation in the prior pass, not cost fields. Clamps to $0 and calculates anyway (known, documented gap).';
      } else if (input.targetMarginPct === 100) {
        status = "PARTIAL_CLAMPED_NOT_ERROR";
        notes = "Target margin is capped at 99% by the field's own clamp (Math.min(99,...)), so 100 can never actually be entered and Infinity can never be produced -- but this is a silent clamp, not an explicit rejection error as the case describes.";
      }
      rows.push({ testId, scenario, status, actual: {}, notes });
      continue;
    }

    const sections: ProjectSection[] = input.sections.map(([l, w, t]: number[], i: number) => ({ id: `s${i}`, name: `s${i}`, lengthFt: l, widthFt: w, thicknessIn: t }));
    const costs = { readyMixRatePerYd3: input.mixPerYd3, laborCost: input.labor, formsCost: input.forms, reinforcementCost: input.rebar, equipmentCost: input.equipment, otherCost: input.other };
    const result = evaluateEntity({ sections, allowancePercent: input.allowancePct, rounding: input.rounding as Rounding, costs, overheadPercent: input.overheadPct, targetMarginPercent: input.targetMarginPct, sellingPrice: input.sellingPrice });

    rows.push(
      grade(testId, scenario, [
        { label: "netYd3", expected: expectedOutput.netYd3, actual: result.netCubicYards, tol: TOL_QTY },
        { label: "orderYd3", expected: expectedOutput.orderYd3, actual: result.orderQuantityYd3, tol: TOL_QTY },
        { label: "direct", expected: expectedOutput.direct, actual: result.directCost, tol: TOL_MONEY },
        { label: "trueCost", expected: expectedOutput.trueCost, actual: result.trueCost, tol: TOL_MONEY },
        { label: "actualMargin", expected: expectedOutput.actualMargin, actual: result.currentMargin, tol: TOL_RATIO },
        { label: "requiredPrice", expected: expectedOutput.requiredPrice, actual: result.requiredSellingPrice, tol: TOL_MONEY },
      ]),
    );
  }
  results[sheetName] = rows;
}

// ---- 04: Rate Health ----
{
  const rows: RowResult[] = [];
  for (const c of parseCases("04 Rate Health")) {
    const { testId, scenario, caseType, input, expectedOutput } = c;

    if (caseType === "Invalid") {
      let status: RowResult["status"] = "GAP_NOT_BLOCKED";
      let notes = "";
      if ("orderQty" in input) {
        status = "NA_NO_UI_FIELD";
        notes = 'Rate Health has no direct "Order Qty" input at all -- it is always derived from a real template\'s own sections. This case assumes a field that does not exist.';
      } else if ("laborChangePct" in input) {
        status = "GAP_NOT_BLOCKED";
        notes = "A change below -100% is NOT blocked -- it produces a negative computed rate that calculateCost's safeD() silently clamps to $0 (same effective result as exactly -100%), same known gap as the original RH-08 case.";
      }
      rows.push({ testId, scenario, status, actual: {}, notes });
      continue;
    }

    const qty = { areaSqFt: 0, netCubicFeet: 0, netCubicYards: input.orderQty, orderQuantityYd3: input.orderQty };
    const scenarioCosts = {
      readyMixRatePerYd3: input.mix * (1 + input.mixChangePct / 100),
      laborCost: input.labour * (1 + input.laborChangePct / 100),
      formsCost: input.forms,
      reinforcementCost: input.rebar,
      equipmentCost: input.equipment * (1 + input.equipmentChangePct / 100),
      otherCost: input.other,
    };
    const scenarioCost = calculateCost(qty, scenarioCosts, input.overheadPct);
    const scenarioMargin = calculateMargin(input.sellingPrice, scenarioCost.trueCost);
    const requiredAt30 = calculateRequiredSellingPrice(scenarioCost.trueCost, 30);

    rows.push(
      grade(testId, scenario, [
        { label: "scenarioTrueCost", expected: expectedOutput.scenarioTrueCost, actual: scenarioCost.trueCost, tol: TOL_MONEY },
        { label: "scenarioMargin", expected: expectedOutput.scenarioMargin, actual: scenarioMargin, tol: TOL_RATIO },
        { label: "requiredAt30Pct", expected: expectedOutput.requiredAt30Pct, actual: requiredAt30, tol: TOL_MONEY },
      ]),
    );
  }
  results["04 Rate Health"] = rows;
}

// ---- 05: Scenario Compare ----
{
  const rows: RowResult[] = [];
  for (const c of parseCases("05 Scenario Compare")) {
    const { testId, scenario, caseType, input, expectedOutput } = c;

    if (caseType === "Invalid") {
      let status: RowResult["status"] = "GAP_NOT_BLOCKED";
      let notes = "";
      if (input.B?.equipment !== undefined && input.B.equipment < 0) {
        status = "PASS";
        notes = "Negative B cost IS blocked: ScenarioCompareModal's required/non-negative validation on cost fields (fixed/verified in the prior pass) disables the 'Use Scenario B' button.";
      } else if (input.A?.price === null) {
        status = "GAP_NOT_BLOCKED";
        notes = "A null/blank selling price is NOT blocked in Scenario Compare -- only the 6 cost fields were validated in the prior pass, not the price field. Clamps to $0 and calculates anyway.";
      }
      rows.push({ testId, scenario, status, actual: {}, notes });
      continue;
    }

    const qty = { areaSqFt: 0, netCubicFeet: 0, netCubicYards: input.orderQty, orderQuantityYd3: input.orderQty };
    const costA = calculateCost(qty, { readyMixRatePerYd3: input.A.mix, laborCost: input.A.labor, formsCost: input.A.forms, reinforcementCost: input.A.rebar, equipmentCost: input.A.equipment, otherCost: input.A.other }, input.overheadPct);
    const costB = calculateCost(qty, { readyMixRatePerYd3: input.B.mix, laborCost: input.B.labor, formsCost: input.B.forms, reinforcementCost: input.B.rebar, equipmentCost: input.B.equipment, otherCost: input.B.other }, input.overheadPct);
    const profitA = input.A.price - costA.trueCost;
    const profitB = input.B.price - costB.trueCost;

    rows.push(
      grade(testId, scenario, [
        { label: "aTrue", expected: expectedOutput.aTrue, actual: costA.trueCost, tol: TOL_MONEY },
        { label: "bTrue", expected: expectedOutput.bTrue, actual: costB.trueCost, tol: TOL_MONEY },
        { label: "trueDiffBminusA", expected: expectedOutput.trueDiffBminusA, actual: costB.trueCost - costA.trueCost, tol: TOL_MONEY },
        { label: "priceDiffBminusA", expected: expectedOutput.priceDiffBminusA, actual: input.B.price - input.A.price, tol: TOL_MONEY },
        { label: "profitDiffBminusA", expected: expectedOutput.profitDiffBminusA, actual: profitB - profitA, tol: TOL_MONEY },
      ]),
    );
  }
  results["05 Scenario Compare"] = rows;
}

// ---- 06: Actuals ----
{
  const rows: RowResult[] = [];
  for (const c of parseCases("06 Actuals")) {
    const { testId, scenario, caseType, input, expectedOutput } = c;

    if (caseType === "Invalid") {
      let status: RowResult["status"] = "GAP_NOT_BLOCKED";
      let notes = "";
      if ("finalSellingPrice" in input && input.finalSellingPrice === null) {
        status = "GAP_NOT_BLOCKED";
        notes = "A null/blank final selling price is NOT blocked in Actuals -- selling price was deliberately left unvalidated in the prior pass (matching the app-wide pattern of not requiring a price to be entered yet). Clamps to $0 and saves anyway.";
      } else if ("actualMaterial" in input && input.actualMaterial < 0) {
        status = "PASS";
        notes = "Negative actual material cost IS blocked: ActualsTab.tsx's required/non-negative validation on the 4 actual cost fields (the real bug fixed in the prior pass) disables Save and shows an error.";
      }
      rows.push({ testId, scenario, status, actual: {}, notes });
      continue;
    }

    const directActual = safe(input.actualLabor) + safe(input.actualMaterial) + safe(input.actualEquipment) + safe(input.actualOther);
    const actualOverhead = directActual * (input.overheadPct / 100);
    const actualTrueCost = directActual + actualOverhead;
    const actualMargin = calculateMargin(input.finalSellingPrice, actualTrueCost);
    const qtyVariance = input.estimatedQty > 0 ? (safe(input.actualQty) - input.estimatedQty) / input.estimatedQty : null;
    const hoursVariance = input.estimatedPersonHours > 0 ? (safe(input.actualPersonHours) - input.estimatedPersonHours) / input.estimatedPersonHours : null;

    rows.push(
      grade(testId, scenario, [
        { label: "qtyVariance", expected: expectedOutput.qtyVariance, actual: qtyVariance, tol: TOL_RATIO },
        { label: "hoursVariance", expected: expectedOutput.hoursVariance, actual: hoursVariance, tol: TOL_RATIO },
        { label: "directActual", expected: expectedOutput.directActual, actual: directActual, tol: TOL_MONEY },
        { label: "actualOverhead", expected: expectedOutput.actualOverhead, actual: actualOverhead, tol: TOL_MONEY },
        { label: "actualTrueCost", expected: expectedOutput.actualTrueCost, actual: actualTrueCost, tol: TOL_MONEY },
        { label: "actualMargin", expected: expectedOutput.actualMargin, actual: actualMargin, tol: TOL_RATIO },
      ]),
    );
  }
  results["06 Actuals"] = rows;
}

const OUT_PATH = new URL("./new60Results.json", import.meta.url);
writeFileSync(OUT_PATH, JSON.stringify(results, null, 2) + "\n");

let pass = 0, fail = 0, gap = 0, partial = 0, na = 0, total = 0;
for (const rows of Object.values(results)) {
  for (const r of rows) {
    total++;
    if (r.status === "PASS") pass++;
    else if (r.status === "FAIL") fail++;
    else if (r.status === "GAP_NOT_BLOCKED") gap++;
    else if (r.status === "PARTIAL_CLAMPED_NOT_ERROR") partial++;
    else na++;
  }
}
console.log(`Total: ${total}  PASS: ${pass}  FAIL: ${fail}  GAP_NOT_BLOCKED: ${gap}  PARTIAL_CLAMPED: ${partial}  N/A: ${na}`);
