// Generates a frozen snapshot of production calc.ts/estimateMath.ts output across a large,
// fixed-seed, reproducible battery of inputs (golden fixtures + third-path fixtures +
// thousands of fast-check-generated cases). Run BEFORE the decimal-safe migration to capture
// "before" behavior, and again AFTER to prove numeric equivalence within tolerance — this is
// the explicit before/after regression evidence requested for the currency-arithmetic
// migration. Usage: npx tsx tests/decimalMigration/generateSnapshot.ts <before|after>
import { writeFileSync } from "node:fs";
import fc from "fast-check";
import { calculateEstimate, calculateMargin, calculateRequiredSellingPrice, type EstimateInput, type Rounding } from "../../src/lib/calc";
import { evaluateEntity } from "../../src/lib/estimateMath";
import type { ProjectSection } from "../../src/lib/types";
import goldenFixtures from "../oracle/goldenFixtures.json";
import thirdPathFixtures from "../thirdpath/fixtures.json";

const label = process.argv[2];
if (label !== "before" && label !== "after") {
  console.error("usage: generateSnapshot.ts <before|after>");
  process.exit(1);
}

const results: Record<string, unknown>[] = [];

// 1. Golden fixtures (50) — full calculateEstimate output.
for (const fx of goldenFixtures as any[]) {
  results.push({ source: "golden", name: fx.name, output: calculateEstimate(fx.input) });
}

// 2. Third-path fixtures — single-section ones through calculateEstimate, multi-section
//    through evaluateEntity, pricing-only through the pricing functions directly.
for (const fx of thirdPathFixtures as any[]) {
  if (fx.kind === "single-section") {
    const i = fx.input;
    const input: EstimateInput = {
      dimensions: { lengthFt: i.length_ft, widthFt: i.width_ft, thicknessIn: i.thickness_in, allowancePercent: i.allowance_pct, rounding: i.rounding as Rounding },
      costs: { readyMixRatePerYd3: i.ready_mix_rate, laborCost: i.labor, formsCost: i.forms, reinforcementCost: i.reinforcement, equipmentCost: i.equipment, otherCost: i.other },
      pricing: { overheadPercent: i.overhead_pct, targetMarginPercent: i.target_margin_pct, sellingPrice: i.selling_price },
    };
    results.push({ source: "thirdpath", name: fx.id, output: calculateEstimate(input) });
  } else if (fx.kind === "multi-section") {
    const i = fx.input;
    const sections: ProjectSection[] = i.sections.map(([l, w, t]: number[], idx: number) => ({ id: `s${idx}`, name: `s${idx}`, lengthFt: l, widthFt: w, thicknessIn: t }));
    const output = evaluateEntity({
      sections, allowancePercent: i.allowance_pct, rounding: i.rounding as Rounding,
      costs: { readyMixRatePerYd3: i.ready_mix_rate, laborCost: i.labor, formsCost: i.forms, reinforcementCost: i.reinforcement, equipmentCost: i.equipment, otherCost: i.other },
      overheadPercent: i.overhead_pct, targetMarginPercent: i.target_margin_pct, sellingPrice: i.selling_price,
    });
    results.push({ source: "thirdpath", name: fx.id, output });
  } else {
    const i = fx.input;
    results.push({
      source: "thirdpath", name: fx.id,
      output: { requiredSellingPrice: calculateRequiredSellingPrice(i.true_cost, i.target_margin_pct), currentMargin: calculateMargin(i.selling_price, i.true_cost) },
    });
  }
}

// 3. 5,000 fixed-seed fast-check-generated cases across calculateEstimate's full realistic
//    domain, to catch any drift across a broad surface, not just the 70 curated fixtures.
//
// Domain-realistic bound: excludes the IEEE-754 denormal band near 0 (e.g. 1e-300 ft),
// which has no physical meaning as a dimension/dollar amount/percentage and is exactly the
// magnitude range where a double-vs-Decimal comparison diverges purely from double
// underflow-to-exact-zero — not a real precision defect. See tests/property/*.property.test.ts
// for the identical rationale applied throughout the rest of this audit.
const MIN_NONZERO = 1e-6;
const realistic = (max: number) =>
  fc.oneof(fc.constant(0), fc.double({ min: MIN_NONZERO, max, noNaN: true, noDefaultInfinity: true }));
const sample = fc.sample(
  fc.record({
    lengthFt: realistic(300), widthFt: realistic(300), thicknessIn: realistic(24),
    allowancePercent: realistic(50), rounding: fc.constantFrom<Rounding>("none", "quarter", "half", "whole"),
    readyMixRatePerYd3: realistic(400), laborCost: realistic(20000), formsCost: realistic(5000),
    reinforcementCost: realistic(5000), equipmentCost: realistic(5000), otherCost: realistic(2000),
    overheadPercent: realistic(50), targetMarginPercent: realistic(90), sellingPrice: realistic(100000),
  }),
  { seed: 777001, numRuns: 5000 },
);
for (let idx = 0; idx < sample.length; idx++) {
  const s = sample[idx];
  const input: EstimateInput = {
    dimensions: { lengthFt: s.lengthFt, widthFt: s.widthFt, thicknessIn: s.thicknessIn, allowancePercent: s.allowancePercent, rounding: s.rounding },
    costs: { readyMixRatePerYd3: s.readyMixRatePerYd3, laborCost: s.laborCost, formsCost: s.formsCost, reinforcementCost: s.reinforcementCost, equipmentCost: s.equipmentCost, otherCost: s.otherCost },
    pricing: { overheadPercent: s.overheadPercent, targetMarginPercent: s.targetMarginPercent, sellingPrice: s.sellingPrice },
  };
  results.push({ source: "fastcheck", name: `fc-${idx}`, output: calculateEstimate(input) });
}

writeFileSync(new URL(`./${label}Snapshot.json`, import.meta.url), JSON.stringify(results));
console.log(`Wrote ${results.length} snapshot entries to tests/decimalMigration/${label}Snapshot.json`);
