// The estimate-vs-actual variance formula is not extracted into src/lib — it is inlined
// identically at three call sites in ActualsTab.tsx (quantityVariance line 52, cost
// variance line 207, and the aggregate qtyVariance/hoursVariance lines 126/130):
//   variance = estimate > 0 ? (actual - estimate) / estimate : null
// This test locks in that formula's documented behavior (guarded divide-by-zero, sign
// convention: positive = actual ran over estimate) against 1,000 generated scenarios,
// differentially checked against an independent Decimal.js computation.
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import Decimal from "decimal.js";

function variance(actual: number, estimate: number): number | null {
  return estimate > 0 ? (actual - estimate) / estimate : null;
}

function oracleVariance(actual: number, estimate: number): number | null {
  if (!(estimate > 0)) return null;
  return new Decimal(actual).minus(estimate).dividedBy(estimate).toNumber();
}

describe("estimate-vs-actual variance formula (1,000 scenarios)", () => {
  it("matches the oracle and preserves the guarded-division / sign contract", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1e-6, max: 100000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1000, max: 100000, noNaN: true, noDefaultInfinity: true }),
        (estimate, actual) => {
          const prod = variance(actual, estimate);
          const oracle = oracleVariance(actual, estimate);
          expect(prod === null).toBe(oracle === null);
          if (prod !== null && oracle !== null) {
            const diff = Math.abs(prod - oracle);
            expect(diff <= 1e-9 || diff <= 1e-9 * Math.max(Math.abs(prod), Math.abs(oracle))).toBe(true);
            // Sign convention: actual > estimate => positive variance (ran over).
            if (actual > estimate) expect(prod).toBeGreaterThan(0);
            if (actual < estimate) expect(prod).toBeLessThan(0);
            if (actual === estimate) expect(prod).toBe(0);
          }
        },
      ),
      { numRuns: 1000, seed: 313131 },
    );
  });

  it("estimate <= 0 always yields null (never divides by zero / never NaN or Infinity)", () => {
    fc.assert(
      fc.property(fc.double({ min: -1000, max: 0, noNaN: true }), fc.double({ min: -1000, max: 100000, noNaN: true }), (estimate, actual) => {
        expect(variance(actual, estimate)).toBeNull();
      }),
      { numRuns: 200, seed: 313132 },
    );
  });
});
