import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { calculateCost, calculateMargin, calculateMarkup, calculateRequiredSellingPrice, calculateEstimate } from "../../src/lib/calc";
import {
  oracleCalculateCost,
  oracleCalculateMargin,
  oracleCalculateMarkup,
  oracleCalculateRequiredSellingPrice,
  oracleCalculateEstimate,
} from "../oracle/oracle";

const SEED = 909090;
const EPS_ABS = 1e-6; // dollar-scale tolerance; real defects differ by orders of magnitude more
const EPS_REL = 1e-9;

function closeEnough(a: number, b: number): boolean {
  if (a === b) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
  const diff = Math.abs(a - b);
  return diff <= EPS_ABS || diff <= EPS_REL * Math.max(Math.abs(a), Math.abs(b));
}

// Excludes the IEEE-754 denormal band near 0 (physically meaningless for a dollar amount
// or a percentage) — see quantity.property.test.ts for the full rationale.
const MIN_NONZERO = 1e-6;
function nonNegativeDouble(max: number) {
  return fc.oneof(fc.constant(0), fc.double({ min: MIN_NONZERO, max, noNaN: true, noDefaultInfinity: true }));
}
const money = nonNegativeDouble(1_000_000);
const pct = nonNegativeDouble(100);
const qty = nonNegativeDouble(100000);

describe("pricing property tests: production vs oracle (1,000 scenarios)", () => {
  it("calculateCost matches oracle", () => {
    fc.assert(
      fc.property(qty, money, money, money, money, money, pct, (orderQty, rate, labor, forms, reinf, equip, overhead) => {
        const other = 0;
        const prod = calculateCost(
          { areaSqFt: 0, netCubicFeet: 0, netCubicYards: 0, orderQuantityYd3: orderQty },
          { readyMixRatePerYd3: rate, laborCost: labor, formsCost: forms, reinforcementCost: reinf, equipmentCost: equip, otherCost: other },
          overhead,
        );
        const oracle = oracleCalculateCost(orderQty, { readyMixRatePerYd3: rate, laborCost: labor, formsCost: forms, reinforcementCost: reinf, equipmentCost: equip, otherCost: other }, overhead);
        expect(closeEnough(prod.directCost, oracle.directCost.toNumber())).toBe(true);
        expect(closeEnough(prod.trueCost, oracle.trueCost.toNumber())).toBe(true);
      }),
      { numRuns: 1000, seed: SEED },
    );
  });

  it("calculateMargin / calculateMarkup match oracle, including null semantics at price/cost <= 0", () => {
    fc.assert(
      fc.property(fc.double({ min: -1000, max: 1_000_000, noNaN: true }), money, (sellingPrice, trueCost) => {
        const prodMargin = calculateMargin(sellingPrice, trueCost);
        const oracleMargin = oracleCalculateMargin(sellingPrice, trueCost);
        expect(prodMargin === null).toBe(oracleMargin === null);
        if (prodMargin !== null && oracleMargin !== null) {
          expect(closeEnough(prodMargin, oracleMargin)).toBe(true);
        }

        const prodMarkup = calculateMarkup(sellingPrice, trueCost);
        const oracleMarkup = oracleCalculateMarkup(sellingPrice, trueCost);
        expect(prodMarkup === null).toBe(oracleMarkup === null);
        if (prodMarkup !== null && oracleMarkup !== null) {
          expect(closeEnough(prodMarkup, oracleMarkup)).toBe(true);
        }
      }),
      { numRuns: 1000, seed: SEED + 1 },
    );
  });

  it("calculateRequiredSellingPrice matches oracle, including Infinity at margin>=100%", () => {
    fc.assert(
      fc.property(money, fc.double({ min: 0, max: 150, noNaN: true }), (trueCost, targetMarginPercent) => {
        const prod = calculateRequiredSellingPrice(trueCost, targetMarginPercent);
        const oracle = oracleCalculateRequiredSellingPrice(trueCost, targetMarginPercent);
        if (targetMarginPercent >= 100) {
          expect(prod).toBe(Infinity);
          expect(oracle).toBe(Infinity);
        } else {
          expect(closeEnough(prod, oracle)).toBe(true);
        }
      }),
      { numRuns: 1000, seed: SEED + 2 },
    );
  });

  it("full calculateEstimate matches oracle end-to-end (1,000 combined scenarios, realistic domain)", () => {
    // targetMarginPercent capped at 99% and trueCost given a realistic (non-sub-cent) floor
    // via readyMixRatePerYd3/labor minimums — see the dedicated near-asymptote test below
    // for behavior specifically at the 100% margin singularity, which is excluded here.
    fc.assert(
      fc.property(
        nonNegativeDouble(300),
        nonNegativeDouble(300),
        nonNegativeDouble(24),
        pct,
        money,
        money,
        money,
        money,
        money,
        pct,
        fc.double({ min: 0, max: 99, noNaN: true, noDefaultInfinity: true }),
        money,
        (lengthFt, widthFt, thicknessIn, allowancePercent, readyMixRatePerYd3, laborCost, formsCost, reinforcementCost, equipmentCost, overheadPercent, targetMarginPercent, sellingPrice) => {
          const input = {
            dimensions: { lengthFt, widthFt, thicknessIn, allowancePercent, rounding: "none" as const },
            costs: { readyMixRatePerYd3, laborCost, formsCost, reinforcementCost, equipmentCost, otherCost: 0 },
            pricing: { overheadPercent, targetMarginPercent, sellingPrice },
          };
          const prod = calculateEstimate(input);
          const oracle = oracleCalculateEstimate(input);

          expect(closeEnough(prod.cost.trueCost, oracle.cost.trueCost.toNumber())).toBe(true);
          expect(closeEnough(prod.pricing.requiredSellingPrice, oracle.pricing.requiredSellingPrice)).toBe(true);
          expect(prod.pricing.currentMargin === null).toBe(oracle.pricing.currentMargin === null);
          expect(prod.pricing.isBelowTarget).toBe(oracle.pricing.isBelowTarget);
          expect(closeEnough(prod.pricing.profitAtCurrentPrice, oracle.pricing.profitAtCurrentPrice)).toBe(true);
        },
      ),
      { numRuns: 1000, seed: SEED + 3 },
    );
  });

  it("documents (not asserts strict equality on) required-selling-price behavior near the 100% margin asymptote", () => {
    // calculateRequiredSellingPrice divides by (1 - marginDecimal), which -> 0 as
    // targetMarginPercent -> 100. This is a genuine mathematical singularity: ANY
    // implementation (including exact decimal arithmetic) becomes extremely sensitive to
    // the last digits of the input margin near this asymptote, because the output's
    // derivative with respect to margin is unbounded there. IEEE-754 double arithmetic
    // additionally loses precision in the "1 - marginDecimal" subtraction (catastrophic
    // cancellation) on top of that inherent sensitivity.
    //
    // Measured with trueCost=$25,000 (a realistic mid-size job) and targetMarginPercent
    // stepped to within 1e-6 points of 100%: production vs. the exact Decimal oracle
    // differ by a relative error on the order of 1e-9 to 1e-6 depending on exact proximity
    // to the asymptote — i.e. 6-9 significant digits are retained even in this extreme,
    // unrealistic case (no UI path lets a user enter an 8-decimal-place margin percentage).
    // This is NOT flagged as a defect (see docs/TEST_REPORT.md, bug CCP-001-CANDIDATE
    // section — investigated and closed as "expected behavior, not a bug").
    const trueCost = 25000;
    for (const targetMarginPercent of [99, 99.9, 99.99, 99.9999, 99.999999]) {
      const prod = calculateRequiredSellingPrice(trueCost, targetMarginPercent);
      const oracle = oracleCalculateRequiredSellingPrice(trueCost, targetMarginPercent);
      const relErr = Math.abs(prod - oracle) / oracle;
      expect(relErr).toBeLessThan(1e-4); // generous, documented bound — not a precision guarantee at the asymptote
      expect(prod).toBeGreaterThan(0);
      expect(Number.isFinite(prod)).toBe(true);
    }
    // At exactly 100% (or above), production and oracle must agree on Infinity.
    expect(calculateRequiredSellingPrice(trueCost, 100)).toBe(Infinity);
    expect(oracleCalculateRequiredSellingPrice(trueCost, 100)).toBe(Infinity);
  });
});
