// Generates docs-facing golden fixtures: 50 hand-picked, realistic (plus a few deliberate
// edge-case) scenarios with expected values computed by the INDEPENDENT oracle (not
// production code). Run once via `npx tsx tests/oracle/generateGoldenFixtures.ts` to
// (re)produce tests/oracle/goldenFixtures.json; the fixture file itself is what the test
// suite reads, so production calc.ts is never in this generation path.
import { writeFileSync } from "node:fs";
import { oracleCalculateEstimate, type OracleEstimateInput, type Rounding } from "./oracle";

interface Case {
  name: string;
  input: OracleEstimateInput;
}

const cases: Case[] = [];

function push(name: string, input: OracleEstimateInput) {
  cases.push({ name, input });
}

const roundings: Rounding[] = ["none", "quarter", "half", "whole"];

// 1-8: canonical small jobs (sidewalk/patio/driveway/footing scale), one per rounding mode x 2 sizes
[
  { l: 20, w: 4, t: 4 },
  { l: 40, w: 20, t: 5 },
].forEach(({ l, w, t }, i) => {
  roundings.forEach((rounding) => {
    push(`canonical-${i}-${rounding}`, {
      dimensions: { lengthFt: l, widthFt: w, thicknessIn: t, allowancePercent: 10, rounding },
      costs: { readyMixRatePerYd3: 165, laborCost: 800, formsCost: 120, reinforcementCost: 200, equipmentCost: 150, otherCost: 50 },
      pricing: { overheadPercent: 15, targetMarginPercent: 30, sellingPrice: 3500 },
    });
  });
});

// 9-16: zero-dimension edge cases (each dimension independently zero)
push("zero-length", { dimensions: { lengthFt: 0, widthFt: 20, thicknessIn: 4, allowancePercent: 10, rounding: "none" }, costs: { readyMixRatePerYd3: 165, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, pricing: { overheadPercent: 10, targetMarginPercent: 25, sellingPrice: 0 } });
push("zero-width", { dimensions: { lengthFt: 20, widthFt: 0, thicknessIn: 4, allowancePercent: 10, rounding: "none" }, costs: { readyMixRatePerYd3: 165, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, pricing: { overheadPercent: 10, targetMarginPercent: 25, sellingPrice: 0 } });
push("zero-thickness", { dimensions: { lengthFt: 20, widthFt: 10, thicknessIn: 0, allowancePercent: 10, rounding: "none" }, costs: { readyMixRatePerYd3: 165, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, pricing: { overheadPercent: 10, targetMarginPercent: 25, sellingPrice: 0 } });
push("zero-allowance", { dimensions: { lengthFt: 20, widthFt: 10, thicknessIn: 4, allowancePercent: 0, rounding: "none" }, costs: { readyMixRatePerYd3: 165, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, pricing: { overheadPercent: 0, targetMarginPercent: 0, sellingPrice: 0 } });
push("negative-length-clamps", { dimensions: { lengthFt: -20, widthFt: 10, thicknessIn: 4, allowancePercent: 10, rounding: "none" }, costs: { readyMixRatePerYd3: 165, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, pricing: { overheadPercent: 10, targetMarginPercent: 25, sellingPrice: 100 } });
push("negative-cost-clamps", { dimensions: { lengthFt: 20, widthFt: 10, thicknessIn: 4, allowancePercent: 10, rounding: "none" }, costs: { readyMixRatePerYd3: 165, laborCost: -500, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, pricing: { overheadPercent: 10, targetMarginPercent: 25, sellingPrice: 3000 } });
push("nan-length-clamps", { dimensions: { lengthFt: NaN, widthFt: 10, thicknessIn: 4, allowancePercent: 10, rounding: "none" }, costs: { readyMixRatePerYd3: 165, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, pricing: { overheadPercent: 10, targetMarginPercent: 25, sellingPrice: 100 } });
push("selling-price-zero-null-margin", { dimensions: { lengthFt: 20, widthFt: 10, thicknessIn: 4, allowancePercent: 10, rounding: "none" }, costs: { readyMixRatePerYd3: 165, laborCost: 500, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, pricing: { overheadPercent: 10, targetMarginPercent: 25, sellingPrice: 0 } });

// 17-26: rounding boundary cases (values landing exactly on / just past quarter/half/whole increments)
[0.24, 0.25, 0.26, 0.49, 0.50, 0.51, 0.99, 1.0, 1.01, 2.751].forEach((targetYd3, i) => {
  // Solve length so netCubicYards*(1+alw) lands near targetYd3: use 1x1ft width/thickness base, vary length.
  // netCubicYards = length*1*(6/12)/27 = length/54. Choose length = targetYd3*54.
  const lengthFt = targetYd3 * 54;
  push(`rounding-boundary-${i}-${targetYd3}`, {
    dimensions: { lengthFt, widthFt: 1, thicknessIn: 6, allowancePercent: 0, rounding: "quarter" },
    costs: { readyMixRatePerYd3: 150, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 },
    pricing: { overheadPercent: 0, targetMarginPercent: 0, sellingPrice: 0 },
  });
});

// 27-36: margin/markup distinction cases across a range of target margins
[0, 10, 20, 30, 40, 50, 60, 75, 90, 99].forEach((targetMarginPercent) => {
  push(`margin-${targetMarginPercent}pct`, {
    dimensions: { lengthFt: 30, widthFt: 20, thicknessIn: 4, allowancePercent: 8, rounding: "quarter" },
    costs: { readyMixRatePerYd3: 165, laborCost: 1200, formsCost: 200, reinforcementCost: 300, equipmentCost: 100, otherCost: 50 },
    pricing: { overheadPercent: 15, targetMarginPercent, sellingPrice: 8000 },
  });
});

// 37-44: overhead sweep
[0, 5, 10, 15, 20, 25, 35, 50].forEach((overheadPercent) => {
  push(`overhead-${overheadPercent}pct`, {
    dimensions: { lengthFt: 25, widthFt: 15, thicknessIn: 4, allowancePercent: 10, rounding: "none" },
    costs: { readyMixRatePerYd3: 170, laborCost: 900, formsCost: 150, reinforcementCost: 180, equipmentCost: 120, otherCost: 40 },
    pricing: { overheadPercent, targetMarginPercent: 30, sellingPrice: 5000 },
  });
});

// 45-50: large multi-thousand-sqft commercial-scale slabs (stress realistic-but-large magnitude)
[
  { l: 200, w: 150, t: 6 },
  { l: 500, w: 100, t: 8 },
  { l: 1000, w: 50, t: 5 },
  { l: 80, w: 80, t: 12 },
  { l: 300, w: 300, t: 4 },
  { l: 150, w: 60, t: 6 },
].forEach(({ l, w, t }, i) => {
  push(`commercial-scale-${i}`, {
    dimensions: { lengthFt: l, widthFt: w, thicknessIn: t, allowancePercent: 12, rounding: "half" },
    costs: { readyMixRatePerYd3: 160, laborCost: 15000, formsCost: 3000, reinforcementCost: 8000, equipmentCost: 4000, otherCost: 1000 },
    pricing: { overheadPercent: 18, targetMarginPercent: 22, sellingPrice: 250000 },
  });
});

const fixtures = cases.map(({ name, input }) => {
  const result = oracleCalculateEstimate(input);
  return {
    name,
    input,
    expected: {
      areaSqFt: result.quantity.areaSqFt.toNumber(),
      netCubicYards: result.quantity.netCubicYards.toNumber(),
      orderQuantityYd3: result.quantity.orderQuantityYd3.toNumber(),
      readyMixCost: result.cost.readyMixCost.toNumber(),
      directCost: result.cost.directCost.toNumber(),
      overheadAmount: result.cost.overheadAmount.toNumber(),
      trueCost: result.cost.trueCost.toNumber(),
      currentMargin: result.pricing.currentMargin,
      currentMarkup: result.pricing.currentMarkup,
      requiredSellingPrice: result.pricing.requiredSellingPrice,
      isBelowTarget: result.pricing.isBelowTarget,
      profitAtCurrentPrice: result.pricing.profitAtCurrentPrice,
    },
  };
});

writeFileSync(new URL("./goldenFixtures.json", import.meta.url), JSON.stringify(fixtures, null, 2) + "\n");
// eslint-disable-next-line no-console
console.log(`Generated ${fixtures.length} golden fixtures.`);
