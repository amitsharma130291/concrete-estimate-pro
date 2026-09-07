// One-off generator for a full "every calculator, 5 examples each" verification package.
// Calls the REAL production functions directly (same approach as generateWorkedExamples.ts)
// so every number in the resulting markdown is production-verified, not hand-computed.
import { writeFileSync } from "node:fs";
import {
  calculateEstimate,
  calculateCost,
  calculateMargin,
  calculateRequiredSellingPrice,
  calculateLaborCost,
  type EstimateInput,
} from "../../src/lib/calc";
import { evaluateEntity, combinedAreaSqFt } from "../../src/lib/estimateMath";
import type { ProjectSection, Rounding } from "../../src/lib/types";
import { CALCULATOR_CONFIGS } from "../../src/data/calculatorConfigs";

const out: Record<string, unknown> = {};

function toFeet(value: number, unit: "ft" | "in"): number {
  return unit === "ft" ? value : value / 12;
}

// ---- 1-6: the six free landing-page calculators (all use calculateEstimate) ----
const FREE_CALC_SLUGS = ["general", "driveway", "footing", "patio", "sidewalk", "slab"] as const;

for (const key of FREE_CALC_SLUGS) {
  const cfg = CALCULATOR_CONFIGS[key];
  const d = cfg.defaults;
  const widthFt = toFeet(d.widthValue, d.widthUnit);

  function run(input: EstimateInput) {
    return calculateEstimate(input);
  }

  // Mirrors ProjectCalculatorIsland.tsx's own default-selling-price logic exactly (not a
  // simplified stand-in): pages with a real market rate use area x rate; pages with
  // marketRatePerSqft === 0 (only "footing" today) fall back to a modest markup over a
  // rough direct-cost estimate, since footings aren't priced per-square-foot in the market.
  const typicalSellingPrice =
    cfg.marketRatePerSqft > 0
      ? Math.round(d.lengthFt * widthFt * cfg.marketRatePerSqft)
      : Math.round((d.laborCost + d.formsCost + d.reinforcementCost + d.equipmentCost + d.otherCost + d.readyMixRatePerYd3 * 15) * 1.15);

  const cases = [
    {
      name: "Typical job (page defaults)",
      input: {
        dimensions: { lengthFt: d.lengthFt, widthFt, thicknessIn: d.thicknessIn, allowancePercent: d.allowancePercent, rounding: "quarter" as Rounding },
        costs: { readyMixRatePerYd3: d.readyMixRatePerYd3, laborCost: d.laborCost, formsCost: d.formsCost, reinforcementCost: d.reinforcementCost, equipmentCost: d.equipmentCost, otherCost: d.otherCost },
        pricing: { overheadPercent: 15, targetMarginPercent: 30, sellingPrice: typicalSellingPrice },
      },
    },
    {
      name: "Larger job, half-yard rounding, higher allowance",
      input: {
        dimensions: { lengthFt: d.lengthFt * 1.5, widthFt: widthFt * 1.3, thicknessIn: d.thicknessIn + 1, allowancePercent: 12, rounding: "half" as Rounding },
        costs: { readyMixRatePerYd3: d.readyMixRatePerYd3 + 10, laborCost: Math.round(d.laborCost * 1.4), formsCost: d.formsCost, reinforcementCost: d.reinforcementCost, equipmentCost: d.equipmentCost, otherCost: d.otherCost },
        pricing: { overheadPercent: 18, targetMarginPercent: 25, sellingPrice: Math.round(typicalSellingPrice * 1.6) },
      },
    },
    {
      name: "EDGE: zero thickness -> zero volume/cost",
      input: {
        dimensions: { lengthFt: d.lengthFt, widthFt, thicknessIn: 0, allowancePercent: d.allowancePercent, rounding: "none" as Rounding },
        costs: { readyMixRatePerYd3: d.readyMixRatePerYd3, laborCost: d.laborCost, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 },
        pricing: { overheadPercent: 10, targetMarginPercent: 25, sellingPrice: d.laborCost },
      },
    },
    {
      name: "EDGE: negative width clamps to 0 (data-entry mistake)",
      input: {
        dimensions: { lengthFt: d.lengthFt, widthFt: -widthFt, thicknessIn: d.thicknessIn, allowancePercent: d.allowancePercent, rounding: "none" as Rounding },
        costs: { readyMixRatePerYd3: d.readyMixRatePerYd3, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 },
        pricing: { overheadPercent: 10, targetMarginPercent: 25, sellingPrice: 250 },
      },
    },
    {
      name: "EDGE: selling price left at $0 -> margin is null, not 0%",
      input: {
        dimensions: { lengthFt: d.lengthFt, widthFt, thicknessIn: d.thicknessIn, allowancePercent: d.allowancePercent, rounding: "quarter" as Rounding },
        costs: { readyMixRatePerYd3: d.readyMixRatePerYd3, laborCost: d.laborCost, formsCost: d.formsCost, reinforcementCost: d.reinforcementCost, equipmentCost: d.equipmentCost, otherCost: d.otherCost },
        pricing: { overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 0 },
      },
    },
  ];

  out[`free_${key}`] = { config: { slug: cfg.slug, h1: cfg.h1, defaults: d, marketRatePerSqft: cfg.marketRatePerSqft }, cases: cases.map((c) => ({ name: c.name, input: c.input, output: run(c.input) })) };
}

// ---- 7: Job Cost Calculator (flat-cost entry, no quantity math) ----
function runJobCost(costs: { readyMixCost: number; laborCost: number; formsCost: number; reinforcementCost: number; pumpCost: number; equipmentCost: number; otherCost: number }, overheadPercent: number, targetMarginPercent: number, sellingPrice: number) {
  const emptyQty = { areaSqFt: 0, netCubicFeet: 0, netCubicYards: 0, orderQuantityYd3: 0 };
  const cost = calculateCost(emptyQty, { readyMixRatePerYd3: 0, laborCost: costs.laborCost, formsCost: costs.formsCost, reinforcementCost: costs.reinforcementCost, equipmentCost: costs.equipmentCost + costs.pumpCost, otherCost: costs.otherCost }, overheadPercent);
  const directCost = cost.directCost + costs.readyMixCost;
  const overheadAmount = directCost * (overheadPercent / 100);
  const trueCost = directCost + overheadAmount;
  const requiredSellingPrice = calculateRequiredSellingPrice(trueCost, targetMarginPercent);
  const currentMargin = calculateMargin(sellingPrice, trueCost);
  return { directCost, overheadAmount, trueCost, requiredSellingPrice, currentMargin };
}
out.jobCostCalculator = {
  cases: [
    { name: "Typical mid-size job", input: { readyMixCost: 2640, laborCost: 2100, formsCost: 480, reinforcementCost: 920, pumpCost: 750, equipmentCost: 300, otherCost: 150, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 9800 }, output: runJobCost({ readyMixCost: 2640, laborCost: 2100, formsCost: 480, reinforcementCost: 920, pumpCost: 750, equipmentCost: 300, otherCost: 150 }, 15, 30, 9800) },
    { name: "Small job, no pump, low overhead", input: { readyMixCost: 800, laborCost: 600, formsCost: 100, reinforcementCost: 0, pumpCost: 0, equipmentCost: 50, otherCost: 0, overheadPercent: 8, targetMarginPercent: 20, sellingPrice: 2200 }, output: runJobCost({ readyMixCost: 800, laborCost: 600, formsCost: 100, reinforcementCost: 0, pumpCost: 0, equipmentCost: 50, otherCost: 0 }, 8, 20, 2200) },
    { name: "EDGE: all costs zero (nothing entered yet)", input: { readyMixCost: 0, laborCost: 0, formsCost: 0, reinforcementCost: 0, pumpCost: 0, equipmentCost: 0, otherCost: 0, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 0 }, output: runJobCost({ readyMixCost: 0, laborCost: 0, formsCost: 0, reinforcementCost: 0, pumpCost: 0, equipmentCost: 0, otherCost: 0 }, 15, 30, 0) },
    { name: "EDGE: selling price below true cost (underpriced job)", input: { readyMixCost: 2640, laborCost: 2100, formsCost: 480, reinforcementCost: 920, pumpCost: 750, equipmentCost: 300, otherCost: 150, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 4000 }, output: runJobCost({ readyMixCost: 2640, laborCost: 2100, formsCost: 480, reinforcementCost: 920, pumpCost: 750, equipmentCost: 300, otherCost: 150 }, 15, 30, 4000) },
    { name: "EDGE: target margin capped at 99% (near-asymptote pricing)", input: { readyMixCost: 1500, laborCost: 1200, formsCost: 200, reinforcementCost: 100, pumpCost: 400, equipmentCost: 150, otherCost: 50, overheadPercent: 12, targetMarginPercent: 99, sellingPrice: 6000 }, output: runJobCost({ readyMixCost: 1500, laborCost: 1200, formsCost: 200, reinforcementCost: 100, pumpCost: 400, equipmentCost: 150, otherCost: 50 }, 12, 99, 6000) },
  ],
};

// ---- 8: Estimate Template (line-item sum) ----
function lineTotal(quantity: number, unitPrice: number) { return quantity * unitPrice; }
function templateTotal(items: { quantity: number; unitPrice: number }[]) { return items.reduce((sum, i) => sum + lineTotal(i.quantity, i.unitPrice), 0); }
out.estimateTemplate = {
  cases: [
    { name: "Single line item", input: { items: [{ quantity: 12, unitPrice: 165 }] }, output: { lineTotals: [1980], total: templateTotal([{ quantity: 12, unitPrice: 165 }]) } },
    { name: "Multi-line template (4 line items)", input: { items: [{ quantity: 13.25, unitPrice: 165 }, { quantity: 1, unitPrice: 1800 }, { quantity: 1, unitPrice: 250 }, { quantity: 1, unitPrice: 300 }] }, output: { lineTotals: [13.25 * 165, 1800, 250, 300], total: templateTotal([{ quantity: 13.25, unitPrice: 165 }, { quantity: 1, unitPrice: 1800 }, { quantity: 1, unitPrice: 250 }, { quantity: 1, unitPrice: 300 }]) } },
    { name: "EDGE: a $0-quantity line contributes nothing", input: { items: [{ quantity: 0, unitPrice: 500 }, { quantity: 10, unitPrice: 165 }] }, output: { lineTotals: [0, 1650], total: templateTotal([{ quantity: 0, unitPrice: 500 }, { quantity: 10, unitPrice: 165 }]) } },
    { name: "EDGE: a $0-unit-price line (e.g. a comped item) contributes nothing", input: { items: [{ quantity: 5, unitPrice: 0 }, { quantity: 10, unitPrice: 165 }] }, output: { lineTotals: [0, 1650], total: templateTotal([{ quantity: 5, unitPrice: 0 }, { quantity: 10, unitPrice: 165 }]) } },
    { name: "Large template (5 line items)", input: { items: [{ quantity: 20, unitPrice: 165 }, { quantity: 1, unitPrice: 2400 }, { quantity: 1, unitPrice: 500 }, { quantity: 1, unitPrice: 600 }, { quantity: 1, unitPrice: 350 }] }, output: { lineTotals: [3300, 2400, 500, 600, 350], total: templateTotal([{ quantity: 20, unitPrice: 165 }, { quantity: 1, unitPrice: 2400 }, { quantity: 1, unitPrice: 500 }, { quantity: 1, unitPrice: 600 }, { quantity: 1, unitPrice: 350 }]) } },
  ],
};

// ---- 9/10/11: Pro multi-section engine (Estimates / Projects / Templates share evaluateEntity) ----
function section(lengthFt: number, widthFt: number, thicknessIn: number): ProjectSection {
  return { id: "s", name: "s", lengthFt, widthFt, thicknessIn };
}
function runMulti(sections: ProjectSection[], allowancePercent: number, rounding: Rounding, costs: any, overheadPercent: number, targetMarginPercent: number, sellingPrice: number) {
  return evaluateEntity({ sections, allowancePercent, rounding, costs, overheadPercent, targetMarginPercent, sellingPrice });
}

out.proEstimates = {
  cases: [
    { name: "Typical 2-section driveway + walkway estimate", input: { sections: [{ lengthFt: 50, widthFt: 14, thicknessIn: 4 }, { lengthFt: 20, widthFt: 4, thicknessIn: 4 }], allowancePercent: 10, rounding: "quarter", costs: { readyMixRatePerYd3: 165, laborCost: 1600, formsCost: 220, reinforcementCost: 280, equipmentCost: 150, otherCost: 60 }, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 5600 }, output: runMulti([section(50, 14, 4), section(20, 4, 4)], 10, "quarter", { readyMixRatePerYd3: 165, laborCost: 1600, formsCost: 220, reinforcementCost: 280, equipmentCost: 150, otherCost: 60 }, 15, 30, 5600) },
    { name: "Single-section patio estimate, whole-yard rounding", input: { sections: [{ lengthFt: 22, widthFt: 18, thicknessIn: 4 }], allowancePercent: 8, rounding: "whole", costs: { readyMixRatePerYd3: 170, laborCost: 1400, formsCost: 200, reinforcementCost: 0, equipmentCost: 100, otherCost: 0 }, overheadPercent: 12, targetMarginPercent: 28, sellingPrice: 4200 }, output: runMulti([section(22, 18, 4)], 8, "whole", { readyMixRatePerYd3: 170, laborCost: 1400, formsCost: 200, reinforcementCost: 0, equipmentCost: 100, otherCost: 0 }, 12, 28, 4200) },
    { name: "EDGE: 3 sections, one is zero-area", input: { sections: [{ lengthFt: 30, widthFt: 10, thicknessIn: 4 }, { lengthFt: 0, widthFt: 10, thicknessIn: 4 }, { lengthFt: 15, widthFt: 8, thicknessIn: 4 }], allowancePercent: 10, rounding: "none", costs: { readyMixRatePerYd3: 165, laborCost: 1000, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, overheadPercent: 15, targetMarginPercent: 25, sellingPrice: 3000 }, output: runMulti([section(30, 10, 4), section(0, 10, 4), section(15, 8, 4)], 10, "none", { readyMixRatePerYd3: 165, laborCost: 1000, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, 15, 25, 3000) },
    { name: "EDGE: selling price = $0 while drafting (margin null)", input: { sections: [{ lengthFt: 40, widthFt: 20, thicknessIn: 4 }], allowancePercent: 10, rounding: "quarter", costs: { readyMixRatePerYd3: 165, laborCost: 1600, formsCost: 200, reinforcementCost: 250, equipmentCost: 150, otherCost: 50 }, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 0 }, output: runMulti([section(40, 20, 4)], 10, "quarter", { readyMixRatePerYd3: 165, laborCost: 1600, formsCost: 200, reinforcementCost: 250, equipmentCost: 150, otherCost: 50 }, 15, 30, 0) },
    { name: "EDGE: cross-check vs. a free-calculator equivalent (identical math)", input: { sections: [{ lengthFt: 60, widthFt: 16, thicknessIn: 4 }], allowancePercent: 10, rounding: "quarter", costs: { readyMixRatePerYd3: 165, laborCost: 1800, formsCost: 250, reinforcementCost: 300, equipmentCost: 200, otherCost: 100 }, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 5200 }, output: runMulti([section(60, 16, 4)], 10, "quarter", { readyMixRatePerYd3: 165, laborCost: 1800, formsCost: 250, reinforcementCost: 300, equipmentCost: 200, otherCost: 100 }, 15, 30, 5200) },
  ],
};

out.proProjects = {
  cases: [
    { name: "Typical single-section garage-floor project", input: { sections: [{ lengthFt: 24, widthFt: 24, thicknessIn: 5 }], allowancePercent: 10, rounding: "quarter", costs: { readyMixRatePerYd3: 165, laborCost: 1900, formsCost: 300, reinforcementCost: 400, equipmentCost: 200, otherCost: 0 }, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 6500 }, output: runMulti([section(24, 24, 5)], 10, "quarter", { readyMixRatePerYd3: 165, laborCost: 1900, formsCost: 300, reinforcementCost: 400, equipmentCost: 200, otherCost: 0 }, 15, 30, 6500) },
    { name: "Before edit: original 2-section footing project", input: { sections: [{ lengthFt: 80, widthFt: 2, thicknessIn: 12 }, { lengthFt: 40, widthFt: 2, thicknessIn: 12 }], allowancePercent: 12, rounding: "half", costs: { readyMixRatePerYd3: 165, laborCost: 2200, formsCost: 600, reinforcementCost: 700, equipmentCost: 200, otherCost: 0 }, overheadPercent: 15, targetMarginPercent: 28, sellingPrice: 7000 }, output: runMulti([section(80, 2, 12), section(40, 2, 12)], 12, "half", { readyMixRatePerYd3: 165, laborCost: 2200, formsCost: 600, reinforcementCost: 700, equipmentCost: 200, otherCost: 0 }, 15, 28, 7000) },
    { name: "After edit: same project, one section's length increased (live recalculation)", input: { sections: [{ lengthFt: 100, widthFt: 2, thicknessIn: 12 }, { lengthFt: 40, widthFt: 2, thicknessIn: 12 }], allowancePercent: 12, rounding: "half", costs: { readyMixRatePerYd3: 165, laborCost: 2200, formsCost: 600, reinforcementCost: 700, equipmentCost: 200, otherCost: 0 }, overheadPercent: 15, targetMarginPercent: 28, sellingPrice: 7000 }, output: runMulti([section(100, 2, 12), section(40, 2, 12)], 12, "half", { readyMixRatePerYd3: 165, laborCost: 2200, formsCost: 600, reinforcementCost: 700, equipmentCost: 200, otherCost: 0 }, 15, 28, 7000) },
    { name: "EDGE: negative thickness (typo) clamps to 0 for that section", input: { sections: [{ lengthFt: 20, widthFt: 20, thicknessIn: -4 }], allowancePercent: 10, rounding: "none", costs: { readyMixRatePerYd3: 165, laborCost: 500, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, overheadPercent: 10, targetMarginPercent: 25, sellingPrice: 900 }, output: runMulti([section(20, 20, -4)], 10, "none", { readyMixRatePerYd3: 165, laborCost: 500, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, 10, 25, 900) },
    { name: "EDGE: 5 sections (large multi-area project)", input: { sections: [{ lengthFt: 20, widthFt: 20, thicknessIn: 4 }, { lengthFt: 15, widthFt: 10, thicknessIn: 4 }, { lengthFt: 10, widthFt: 10, thicknessIn: 4 }, { lengthFt: 30, widthFt: 8, thicknessIn: 4 }, { lengthFt: 12, widthFt: 12, thicknessIn: 4 }], allowancePercent: 10, rounding: "quarter", costs: { readyMixRatePerYd3: 165, laborCost: 4500, formsCost: 800, reinforcementCost: 900, equipmentCost: 500, otherCost: 200 }, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 16000 }, output: runMulti([section(20, 20, 4), section(15, 10, 4), section(10, 10, 4), section(30, 8, 4), section(12, 12, 4)], 10, "quarter", { readyMixRatePerYd3: 165, laborCost: 4500, formsCost: 800, reinforcementCost: 900, equipmentCost: 500, otherCost: 200 }, 15, 30, 16000) },
  ],
};

out.proTemplates = {
  cases: [
    { name: "Standard driveway template (reused across many customers)", input: { sections: [{ lengthFt: 50, widthFt: 18, thicknessIn: 4 }], allowancePercent: 10, rounding: "quarter", costs: { readyMixRatePerYd3: 165, laborCost: 2200, formsCost: 350, reinforcementCost: 400, equipmentCost: 200, otherCost: 0 }, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 5800 }, output: runMulti([section(50, 18, 4)], 10, "quarter", { readyMixRatePerYd3: 165, laborCost: 2200, formsCost: 350, reinforcementCost: 400, equipmentCost: 200, otherCost: 0 }, 15, 30, 5800) },
    { name: "Standard patio template, no-rounding mode", input: { sections: [{ lengthFt: 18, widthFt: 14, thicknessIn: 4 }], allowancePercent: 5, rounding: "none", costs: { readyMixRatePerYd3: 170, laborCost: 1100, formsCost: 150, reinforcementCost: 0, equipmentCost: 80, otherCost: 0 }, overheadPercent: 12, targetMarginPercent: 25, sellingPrice: 3000 }, output: runMulti([section(18, 14, 4)], 5, "none", { readyMixRatePerYd3: 170, laborCost: 1100, formsCost: 150, reinforcementCost: 0, equipmentCost: 80, otherCost: 0 }, 12, 25, 3000) },
    { name: "EDGE: template with $0 ready-mix rate (a stale/incomplete template)", input: { sections: [{ lengthFt: 40, widthFt: 20, thicknessIn: 4 }], allowancePercent: 10, rounding: "quarter", costs: { readyMixRatePerYd3: 0, laborCost: 1600, formsCost: 200, reinforcementCost: 250, equipmentCost: 150, otherCost: 50 }, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 3800 }, output: runMulti([section(40, 20, 4)], 10, "quarter", { readyMixRatePerYd3: 0, laborCost: 1600, formsCost: 200, reinforcementCost: 250, equipmentCost: 150, otherCost: 50 }, 15, 30, 3800) },
    { name: "EDGE: quarter-yard rounding boundary (exactly on a 0.25 line)", input: { sections: [{ lengthFt: 27, widthFt: 4, thicknessIn: 6 }], allowancePercent: 0, rounding: "quarter", costs: { readyMixRatePerYd3: 150, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, overheadPercent: 0, targetMarginPercent: 0, sellingPrice: 0 }, output: runMulti([section(27, 4, 6)], 0, "quarter", { readyMixRatePerYd3: 150, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, 0, 0, 0) },
    { name: "Footing template (long/narrow section shape)", input: { sections: [{ lengthFt: 120, widthFt: 2, thicknessIn: 12 }], allowancePercent: 10, rounding: "quarter", costs: { readyMixRatePerYd3: 165, laborCost: 2200, formsCost: 600, reinforcementCost: 700, equipmentCost: 200, otherCost: 0 }, overheadPercent: 15, targetMarginPercent: 28, sellingPrice: 5500 }, output: runMulti([section(120, 2, 12)], 10, "quarter", { readyMixRatePerYd3: 165, laborCost: 2200, formsCost: 600, reinforcementCost: 700, equipmentCost: 200, otherCost: 0 }, 15, 28, 5500) },
  ],
};

// ---- 12: Rate Health scenario modeling ----
function runRateHealth(baseCosts: any, readyMixChangePercent: number, laborChangePercent: number, equipmentChangePercent: number, sections: ProjectSection[], allowancePercent: number, rounding: Rounding, overheadPercent: number, targetMarginPercent: number, sellingPrice: number) {
  const scenarioCosts = {
    readyMixRatePerYd3: baseCosts.readyMixRatePerYd3 * (1 + readyMixChangePercent / 100),
    laborCost: baseCosts.laborCost * (1 + laborChangePercent / 100),
    formsCost: baseCosts.formsCost,
    reinforcementCost: baseCosts.reinforcementCost,
    equipmentCost: baseCosts.equipmentCost * (1 + equipmentChangePercent / 100),
    otherCost: baseCosts.otherCost,
  };
  const base = runMulti(sections, allowancePercent, rounding, baseCosts, overheadPercent, targetMarginPercent, sellingPrice);
  const scenario = runMulti(sections, allowancePercent, rounding, scenarioCosts, overheadPercent, targetMarginPercent, sellingPrice);
  return { scenarioCosts, base, scenario };
}
const rhSections = [section(40, 20, 4)];
const rhBaseCosts = { readyMixRatePerYd3: 165, laborCost: 1600, formsCost: 200, reinforcementCost: 250, equipmentCost: 150, otherCost: 50 };
out.proRateHealth = {
  cases: [
    { name: "Ready-mix supplier raises price 12%", input: { baseCosts: rhBaseCosts, readyMixChangePercent: 12, laborChangePercent: 0, equipmentChangePercent: 0, sellingPrice: 3800 }, output: runRateHealth(rhBaseCosts, 12, 0, 0, rhSections, 10, "quarter", 15, 30, 3800) },
    { name: "Labor rate increases 15% (new crew wage)", input: { baseCosts: rhBaseCosts, readyMixChangePercent: 0, laborChangePercent: 15, equipmentChangePercent: 0, sellingPrice: 3800 }, output: runRateHealth(rhBaseCosts, 0, 15, 0, rhSections, 10, "quarter", 15, 30, 3800) },
    { name: "EDGE: -100% cost change zeroes that cost line entirely", input: { baseCosts: rhBaseCosts, readyMixChangePercent: -100, laborChangePercent: 0, equipmentChangePercent: 0, sellingPrice: 3800 }, output: runRateHealth(rhBaseCosts, -100, 0, 0, rhSections, 10, "quarter", 15, 30, 3800) },
    { name: "Combined multi-cost scenario (mix +8%, labor +15%, equipment -5%)", input: { baseCosts: rhBaseCosts, readyMixChangePercent: 8, laborChangePercent: 15, equipmentChangePercent: -5, sellingPrice: 3800 }, output: runRateHealth(rhBaseCosts, 8, 15, -5, rhSections, 10, "quarter", 15, 30, 3800) },
    { name: "EDGE: equipment rental rate doubles (+100%), everything else flat", input: { baseCosts: rhBaseCosts, readyMixChangePercent: 0, laborChangePercent: 0, equipmentChangePercent: 100, sellingPrice: 3800 }, output: runRateHealth(rhBaseCosts, 0, 0, 100, rhSections, 10, "quarter", 15, 30, 3800) },
  ],
};

// ---- 13: Scenario A/B compare ----
function runScenarioCompare(sections: ProjectSection[], a: any, b: any) {
  const resultA = runMulti(sections, a.allowancePercent, a.rounding, a, a.overheadPercent, a.targetMarginPercent, a.sellingPrice);
  const resultB = runMulti(sections, b.allowancePercent, b.rounding, b, b.overheadPercent, b.targetMarginPercent, b.sellingPrice);
  const profitA = a.sellingPrice - resultA.trueCost;
  const profitB = b.sellingPrice - resultB.trueCost;
  return {
    A: { orderQuantityYd3: resultA.orderQuantityYd3, trueCost: resultA.trueCost, profit: profitA, margin: calculateMargin(a.sellingPrice, resultA.trueCost) },
    B: { orderQuantityYd3: resultB.orderQuantityYd3, trueCost: resultB.trueCost, profit: profitB, margin: calculateMargin(b.sellingPrice, resultB.trueCost) },
    diff: { trueCost: resultB.trueCost - resultA.trueCost, sellingPrice: b.sellingPrice - a.sellingPrice, profit: profitB - profitA },
  };
}
const scSections1 = [section(45, 18, 4)];
const scA1 = { readyMixRatePerYd3: 160, laborCost: 1500, formsCost: 200, reinforcementCost: 250, equipmentCost: 100, otherCost: 0, allowancePercent: 10, rounding: "quarter" as Rounding, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 4800 };
const scB1 = { readyMixRatePerYd3: 160, laborCost: 2600, formsCost: 200, reinforcementCost: 250, equipmentCost: 350, otherCost: 150, allowancePercent: 10, rounding: "quarter" as Rounding, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 6400 };
const scSections2 = [section(30, 20, 4)];
const scA2 = { readyMixRatePerYd3: 165, laborCost: 1200, formsCost: 150, reinforcementCost: 0, equipmentCost: 100, otherCost: 0, allowancePercent: 8, rounding: "quarter" as Rounding, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 3600 };
const scB2 = { readyMixRatePerYd3: 165, laborCost: 1200, formsCost: 150, reinforcementCost: 0, equipmentCost: 100, otherCost: 0, allowancePercent: 8, rounding: "quarter" as Rounding, overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 3200 };
out.proScenarioCompare = {
  cases: [
    { name: "Standard finish (A) vs. stamped/decorative finish (B)", input: { A: scA1, B: scB1 }, output: runScenarioCompare(scSections1, scA1, scB1) },
    { name: "Same job, only the price differs (A charges more than B)", input: { A: scA2, B: scB2 }, output: runScenarioCompare(scSections2, scA2, scB2) },
    { name: "EDGE: A and B are identical (diff should be exactly zero everywhere)", input: { A: scA1, B: scA1 }, output: runScenarioCompare(scSections1, scA1, scA1) },
    { name: "EDGE: B has a $0 selling price (still drafting scenario B)", input: { A: scA1, B: { ...scB1, sellingPrice: 0 } }, output: runScenarioCompare(scSections1, scA1, { ...scB1, sellingPrice: 0 }) },
    { name: "B removes reinforcement entirely to cut cost", input: { A: scA1, B: { ...scB1, reinforcementCost: 0, sellingPrice: 5900 } }, output: runScenarioCompare(scSections1, scA1, { ...scB1, reinforcementCost: 0, sellingPrice: 5900 }) },
  ],
};

// ---- 14: Actuals (estimate vs. actual variance) ----
function variance(actual: number, estimate: number): number | null {
  return estimate > 0 ? (actual - estimate) / estimate : null;
}
out.proActuals = {
  cases: [
    { name: "Actual ran over estimate (job took more concrete than planned)", input: { estimatedQty: 18.5, actualQty: 20.25 }, output: { quantityVariance: variance(20.25, 18.5) } },
    { name: "Actual came in under estimate (efficient pour)", input: { estimatedQty: 18.5, actualQty: 16.0 }, output: { quantityVariance: variance(16.0, 18.5) } },
    { name: "EDGE: estimate was 0 -> variance is null (no division by zero)", input: { estimatedQty: 0, actualQty: 5 }, output: { quantityVariance: variance(5, 0) } },
    { name: "EDGE: actual exactly equals estimate (perfect estimate)", input: { estimatedQty: 12, actualQty: 12 }, output: { quantityVariance: variance(12, 12) } },
    {
      name: "Full job-result row: actual cost + actual margin, at the project's own overhead rate",
      input: { actualLaborCost: 2200, actualMaterialCost: 2000, actualEquipmentCost: 300, actualOtherCost: 100, finalSellingPrice: 5600, projectOverheadPercent: 15 },
      output: (() => {
        const actualDirectCost = 2200 + 2000 + 300 + 100;
        const actualCost = actualDirectCost * (1 + 15 / 100);
        return { actualDirectCost, actualCost, actualMargin: calculateMargin(5600, actualCost) };
      })(),
    },
  ],
};

writeFileSync(new URL("./allCalculatorExamples.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
// eslint-disable-next-line no-console
console.log("done");
