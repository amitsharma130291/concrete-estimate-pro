// One-off script to compute exact, production-verified input->output pairs for the
// worked-examples reference document. Imports the REAL production functions (this is a
// documentation aid, not the independent oracle) so every number matches what the live app
// actually shows.
import { writeFileSync } from "node:fs";
import {
  calculateEstimate,
  calculateCost,
  calculateMargin,
  calculateRequiredSellingPrice,
  calculateLaborCost,
  roundQuantity,
  type EstimateInput,
} from "../../src/lib/calc";
import { evaluateEntity, combinedAreaSqFt, combinedNetCubicYards } from "../../src/lib/estimateMath";
import type { ProjectSection, Rounding } from "../../src/lib/types";

const out: Record<string, unknown> = {};

// A. Free SEO calculators (calculateEstimate) --------------------------------
function runA(input: EstimateInput) {
  return calculateEstimate(input);
}
out.A_freeCalculators = [
  {
    name: "Driveway, normal case",
    input: { lengthFt: 60, widthFt: 16, thicknessIn: 4, allowancePercent: 10, rounding: "quarter", readyMixRatePerYd3: 165, laborCost: 1800, formsCost: 250, reinforcementCost: 300, equipmentCost: 200, otherCost: 100, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 5200 },
    output: runA({
      dimensions: { lengthFt: 60, widthFt: 16, thicknessIn: 4, allowancePercent: 10, rounding: "quarter" },
      costs: { readyMixRatePerYd3: 165, laborCost: 1800, formsCost: 250, reinforcementCost: 300, equipmentCost: 200, otherCost: 100 },
      pricing: { overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 5200 },
    }),
  },
  {
    name: "Patio, no rounding",
    input: { lengthFt: 20, widthFt: 20, thicknessIn: 4, allowancePercent: 5, rounding: "none", readyMixRatePerYd3: 175, laborCost: 900, formsCost: 100, reinforcementCost: 0, equipmentCost: 80, otherCost: 0, overheadPercent: 12, targetMarginPercent: 25, sellingPrice: 3200 },
    output: runA({
      dimensions: { lengthFt: 20, widthFt: 20, thicknessIn: 4, allowancePercent: 5, rounding: "none" },
      costs: { readyMixRatePerYd3: 175, laborCost: 900, formsCost: 100, reinforcementCost: 0, equipmentCost: 80, otherCost: 0 },
      pricing: { overheadPercent: 12, targetMarginPercent: 25, sellingPrice: 3200 },
    }),
  },
  {
    name: "EDGE: zero thickness -> zero volume/cost",
    input: { lengthFt: 30, widthFt: 12, thicknessIn: 0, allowancePercent: 10, rounding: "none", readyMixRatePerYd3: 165, laborCost: 500, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0, overheadPercent: 10, targetMarginPercent: 25, sellingPrice: 800 },
    output: runA({
      dimensions: { lengthFt: 30, widthFt: 12, thicknessIn: 0, allowancePercent: 10, rounding: "none" },
      costs: { readyMixRatePerYd3: 165, laborCost: 500, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 },
      pricing: { overheadPercent: 10, targetMarginPercent: 25, sellingPrice: 800 },
    }),
  },
  {
    name: "EDGE: negative length clamps to 0",
    input: { lengthFt: -20, widthFt: 10, thicknessIn: 4, allowancePercent: 10, rounding: "none", readyMixRatePerYd3: 165, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0, overheadPercent: 10, targetMarginPercent: 25, sellingPrice: 100 },
    output: runA({
      dimensions: { lengthFt: -20, widthFt: 10, thicknessIn: 4, allowancePercent: 10, rounding: "none" },
      costs: { readyMixRatePerYd3: 165, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 },
      pricing: { overheadPercent: 10, targetMarginPercent: 25, sellingPrice: 100 },
    }),
  },
  {
    name: "EDGE: selling price = 0 -> margin is null",
    input: { lengthFt: 20, widthFt: 10, thicknessIn: 4, allowancePercent: 10, rounding: "none", readyMixRatePerYd3: 165, laborCost: 500, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0, overheadPercent: 10, targetMarginPercent: 25, sellingPrice: 0 },
    output: runA({
      dimensions: { lengthFt: 20, widthFt: 10, thicknessIn: 4, allowancePercent: 10, rounding: "none" },
      costs: { readyMixRatePerYd3: 165, laborCost: 500, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 },
      pricing: { overheadPercent: 10, targetMarginPercent: 25, sellingPrice: 0 },
    }),
  },
  {
    name: "EDGE: whole-yard rounding boundary (exactly 2.0 before rounding)",
    input: { lengthFt: 27, widthFt: 4, thicknessIn: 6, allowancePercent: 0, rounding: "whole", readyMixRatePerYd3: 150, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0, overheadPercent: 0, targetMarginPercent: 0, sellingPrice: 0 },
    output: runA({
      dimensions: { lengthFt: 27, widthFt: 4, thicknessIn: 6, allowancePercent: 0, rounding: "whole" },
      costs: { readyMixRatePerYd3: 150, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 },
      pricing: { overheadPercent: 0, targetMarginPercent: 0, sellingPrice: 0 },
    }),
  },
  {
    name: "EDGE: target margin = 100% -> required price is Infinity",
    input: { lengthFt: 20, widthFt: 10, thicknessIn: 4, allowancePercent: 10, rounding: "none", readyMixRatePerYd3: 165, laborCost: 500, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0, overheadPercent: 10, targetMarginPercent: 100, sellingPrice: 5000 },
    output: runA({
      dimensions: { lengthFt: 20, widthFt: 10, thicknessIn: 4, allowancePercent: 10, rounding: "none" },
      costs: { readyMixRatePerYd3: 165, laborCost: 500, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 },
      pricing: { overheadPercent: 10, targetMarginPercent: 100, sellingPrice: 5000 },
    }),
  },
];

// B. Job Cost Calculator (direct cost entry, no quantity math) --------------
function runB(costs: { readyMixRatePerYd3: number; laborCost: number; formsCost: number; reinforcementCost: number; equipmentCost: number; otherCost: number }, overheadPercent: number, targetMarginPercent: number, sellingPrice: number) {
  // Mirrors JobCostCalculatorIsland.tsx: quantity math bypassed (orderQuantityYd3: 0,
  // readyMixRatePerYd3 forced to 0), ready-mix is a flat entered dollar figure added after.
  const readyMixCostEntered = costs.readyMixRatePerYd3; // field is actually a flat $ in this UI
  const cost = calculateCost({ areaSqFt: 0, netCubicFeet: 0, netCubicYards: 0, orderQuantityYd3: 0 }, { ...costs, readyMixRatePerYd3: 0 }, overheadPercent);
  const directCost = cost.directCost + readyMixCostEntered;
  const overheadAmount = directCost * (overheadPercent / 100);
  const trueCost = directCost + overheadAmount;
  const requiredSellingPrice = calculateRequiredSellingPrice(trueCost, targetMarginPercent);
  const currentMargin = calculateMargin(sellingPrice, trueCost);
  return { directCost, overheadAmount, trueCost, requiredSellingPrice, currentMargin };
}
out.B_jobCostCalculator = [
  {
    name: "Normal case",
    input: { readyMixCost: 2640, laborCost: 2100, formsCost: 480, reinforcementCost: 920, pumpCost: 750, equipmentCost: 300, otherCost: 150, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 9800 },
    output: runB({ readyMixRatePerYd3: 2640, laborCost: 2100, formsCost: 480, reinforcementCost: 920, equipmentCost: 300 + 750, otherCost: 150 }, 15, 30, 9800),
  },
  {
    name: "EDGE: all costs zero",
    input: { readyMixCost: 0, laborCost: 0, formsCost: 0, reinforcementCost: 0, pumpCost: 0, equipmentCost: 0, otherCost: 0, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 0 },
    output: runB({ readyMixRatePerYd3: 0, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, 15, 30, 0),
  },
  {
    name: "EDGE: selling price below true cost (underpriced)",
    input: { readyMixCost: 2640, laborCost: 2100, formsCost: 480, reinforcementCost: 920, pumpCost: 750, equipmentCost: 300, otherCost: 150, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 4000 },
    output: runB({ readyMixRatePerYd3: 2640, laborCost: 2100, formsCost: 480, reinforcementCost: 920, equipmentCost: 300 + 750, otherCost: 150 }, 15, 30, 4000),
  },
];

// D. Pro app multi-section (evaluateEntity) ----------------------------------
function section(lengthFt: number, widthFt: number, thicknessIn: number): ProjectSection {
  return { id: "s", name: "s", lengthFt, widthFt, thicknessIn };
}
function runD(sections: ProjectSection[], allowancePercent: number, rounding: Rounding, costs: any, overheadPercent: number, targetMarginPercent: number, sellingPrice: number) {
  return evaluateEntity({ sections, allowancePercent, rounding, costs, overheadPercent, targetMarginPercent, sellingPrice });
}
out.D_proMultiSection = [
  {
    name: "Two-section estimate (driveway + walkway)",
    input: { sections: [{ lengthFt: 50, widthFt: 14, thicknessIn: 4 }, { lengthFt: 20, widthFt: 4, thicknessIn: 4 }], allowancePercent: 10, rounding: "quarter", costs: { readyMixRatePerYd3: 165, laborCost: 1600, formsCost: 220, reinforcementCost: 280, equipmentCost: 150, otherCost: 60 }, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 5600 },
    output: runD([section(50, 14, 4), section(20, 4, 4)], 10, "quarter", { readyMixRatePerYd3: 165, laborCost: 1600, formsCost: 220, reinforcementCost: 280, equipmentCost: 150, otherCost: 60 }, 15, 30, 5600),
    combinedArea: combinedAreaSqFt([section(50, 14, 4), section(20, 4, 4)]),
    combinedNetYd3: combinedNetCubicYards([section(50, 14, 4), section(20, 4, 4)]),
  },
  {
    name: "EDGE: one of three sections is zero-area",
    input: { sections: [{ lengthFt: 30, widthFt: 10, thicknessIn: 4 }, { lengthFt: 0, widthFt: 10, thicknessIn: 4 }, { lengthFt: 15, widthFt: 8, thicknessIn: 4 }], allowancePercent: 10, rounding: "none", costs: { readyMixRatePerYd3: 165, laborCost: 1000, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, overheadPercent: 15, targetMarginPercent: 25, sellingPrice: 3000 },
    output: runD([section(30, 10, 4), section(0, 10, 4), section(15, 8, 4)], 10, "none", { readyMixRatePerYd3: 165, laborCost: 1000, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, 15, 25, 3000),
  },
  {
    name: "EDGE: single section identical to free-calculator equivalent (cross-check)",
    input: { sections: [{ lengthFt: 60, widthFt: 16, thicknessIn: 4 }], allowancePercent: 10, rounding: "quarter", costs: { readyMixRatePerYd3: 165, laborCost: 1800, formsCost: 250, reinforcementCost: 300, equipmentCost: 200, otherCost: 100 }, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 5200 },
    output: runD([section(60, 16, 4)], 10, "quarter", { readyMixRatePerYd3: 165, laborCost: 1800, formsCost: 250, reinforcementCost: 300, equipmentCost: 200, otherCost: 100 }, 15, 30, 5200),
  },
];

// E. Labor cost modes --------------------------------------------------------
out.E_laborModes = [
  { name: "Hourly mode", input: { mode: "hourly", crewSize: 3, hours: 8, ratePerHour: 28, unitRatePerSqft: 0, totalAreaSqFt: 0 }, output: calculateLaborCost({ mode: "hourly", crewSize: 3, hours: 8, ratePerHour: 28, unitRatePerSqft: 0 }, 0) },
  { name: "Unit mode ($/sqft)", input: { mode: "unit", crewSize: 0, hours: 0, ratePerHour: 0, unitRatePerSqft: 1.75, totalAreaSqFt: 960 }, output: calculateLaborCost({ mode: "unit", crewSize: 0, hours: 0, ratePerHour: 0, unitRatePerSqft: 1.75 }, 960) },
  { name: "Flat mode (function returns 0; caller uses raw entered number)", input: { mode: "flat", crewSize: 0, hours: 0, ratePerHour: 0, unitRatePerSqft: 0, totalAreaSqFt: 0 }, output: calculateLaborCost({ mode: "flat", crewSize: 0, hours: 0, ratePerHour: 0, unitRatePerSqft: 0 }, 0) },
  { name: "EDGE: negative crew size clamps to 0", input: { mode: "hourly", crewSize: -2, hours: 8, ratePerHour: 28, unitRatePerSqft: 0, totalAreaSqFt: 0 }, output: calculateLaborCost({ mode: "hourly", crewSize: -2, hours: 8, ratePerHour: 28, unitRatePerSqft: 0 }, 0) },
];

// F. Rate Health scenario math -----------------------------------------------
function runF(baseCosts: any, readyMixChangePercent: number, laborChangePercent: number, equipmentChangePercent: number, sections: ProjectSection[], allowancePercent: number, rounding: Rounding, overheadPercent: number, targetMarginPercent: number, sellingPrice: number) {
  const scenarioCosts = {
    readyMixRatePerYd3: baseCosts.readyMixRatePerYd3 * (1 + readyMixChangePercent / 100),
    laborCost: baseCosts.laborCost * (1 + laborChangePercent / 100),
    formsCost: baseCosts.formsCost,
    reinforcementCost: baseCosts.reinforcementCost,
    equipmentCost: baseCosts.equipmentCost * (1 + equipmentChangePercent / 100),
    otherCost: baseCosts.otherCost,
  };
  const base = runD(sections, allowancePercent, rounding, baseCosts, overheadPercent, targetMarginPercent, sellingPrice);
  const scenario = runD(sections, allowancePercent, rounding, scenarioCosts, overheadPercent, targetMarginPercent, sellingPrice);
  return { scenarioCosts, base, scenario };
}
const rhSections = [section(40, 20, 4)];
const rhBaseCosts = { readyMixRatePerYd3: 165, laborCost: 1600, formsCost: 200, reinforcementCost: 250, equipmentCost: 150, otherCost: 50 };
out.F_rateHealth = [
  {
    name: "Ready-mix price +12% scenario",
    input: { baseCosts: rhBaseCosts, readyMixChangePercent: 12, laborChangePercent: 0, equipmentChangePercent: 0, sellingPrice: 3800 },
    output: runF(rhBaseCosts, 12, 0, 0, rhSections, 10, "quarter", 15, 30, 3800),
  },
  {
    name: "EDGE: -100% cost change zeroes that cost line",
    input: { baseCosts: rhBaseCosts, readyMixChangePercent: -100, laborChangePercent: 0, equipmentChangePercent: 0, sellingPrice: 3800 },
    output: runF(rhBaseCosts, -100, 0, 0, rhSections, 10, "quarter", 15, 30, 3800),
  },
  {
    name: "Combined multi-cost scenario (ready-mix +8%, labor +15%, equipment -5%)",
    input: { baseCosts: rhBaseCosts, readyMixChangePercent: 8, laborChangePercent: 15, equipmentChangePercent: -5, sellingPrice: 3800 },
    output: runF(rhBaseCosts, 8, 15, -5, rhSections, 10, "quarter", 15, 30, 3800),
  },
];

// G. Scenario A/B compare ----------------------------------------------------
function runG(sections: ProjectSection[], a: any, b: any) {
  const resultA = runD(sections, a.allowancePercent, a.rounding, a, a.overheadPercent, a.targetMarginPercent, a.sellingPrice);
  const resultB = runD(sections, b.allowancePercent, b.rounding, b, b.overheadPercent, b.targetMarginPercent, b.sellingPrice);
  const profitA = a.sellingPrice - resultA.trueCost;
  const profitB = b.sellingPrice - resultB.trueCost;
  return {
    A: { orderQuantityYd3: resultA.orderQuantityYd3, trueCost: resultA.trueCost, profit: profitA, margin: calculateMargin(a.sellingPrice, resultA.trueCost) },
    B: { orderQuantityYd3: resultB.orderQuantityYd3, trueCost: resultB.trueCost, profit: profitB, margin: calculateMargin(b.sellingPrice, resultB.trueCost) },
    diff: { trueCost: resultB.trueCost - resultA.trueCost, sellingPrice: b.sellingPrice - a.sellingPrice, profit: profitB - profitA },
  };
}
const scSections = [section(45, 18, 4)];
out.G_scenarioCompare = [
  {
    name: "Standard finish (A) vs stamped/decorative finish (B)",
    input: {
      A: { readyMixRatePerYd3: 160, laborCost: 1500, formsCost: 200, reinforcementCost: 250, equipmentCost: 100, otherCost: 0, allowancePercent: 10, rounding: "quarter", overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 4800 },
      B: { readyMixRatePerYd3: 160, laborCost: 2600, formsCost: 200, reinforcementCost: 250, equipmentCost: 350, otherCost: 150, allowancePercent: 10, rounding: "quarter", overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 6400 },
    },
    output: runG(scSections, { readyMixRatePerYd3: 160, laborCost: 1500, formsCost: 200, reinforcementCost: 250, equipmentCost: 100, otherCost: 0, allowancePercent: 10, rounding: "quarter", overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 4800 }, { readyMixRatePerYd3: 160, laborCost: 2600, formsCost: 200, reinforcementCost: 250, equipmentCost: 350, otherCost: 150, allowancePercent: 10, rounding: "quarter", overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 6400 }),
  },
];

// H. Estimate-vs-actual variance ---------------------------------------------
function variance(actual: number, estimate: number): number | null {
  return estimate > 0 ? (actual - estimate) / estimate : null;
}
out.H_estimateVsActual = [
  { name: "Actual ran over estimate", input: { estimatedQty: 18.5, actualQty: 20.25 }, output: { quantityVariance: variance(20.25, 18.5) } },
  { name: "Actual came in under estimate", input: { estimatedQty: 18.5, actualQty: 16.0 }, output: { quantityVariance: variance(16.0, 18.5) } },
  { name: "EDGE: estimate is 0 -> variance is null (no division by zero)", input: { estimatedQty: 0, actualQty: 5 }, output: { quantityVariance: variance(5, 0) } },
  { name: "EDGE: actual exactly equals estimate", input: { estimatedQty: 12, actualQty: 12 }, output: { quantityVariance: variance(12, 12) } },
];

writeFileSync(new URL("./workedExamples.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
// eslint-disable-next-line no-console
console.log("done");
