// 50 golden fixtures with expected values computed by the independent oracle
// (tests/oracle/generateGoldenFixtures.ts), asserted against production calc.ts.
import { describe, it, expect } from "vitest";
import { calculateEstimate } from "../../src/lib/calc";
import fixtures from "./goldenFixtures.json";

describe(`golden fixtures (${fixtures.length} cases)`, () => {
  it("has exactly 50 fixtures", () => {
    expect(fixtures.length).toBe(50);
  });

  for (const fx of fixtures as any[]) {
    it(`${fx.name}`, () => {
      const result = calculateEstimate(fx.input);
      const tol = (a: number, b: number) => {
        if (a === b) return true;
        if (!Number.isFinite(a) || !Number.isFinite(b)) return Object.is(a, b) || (Number.isNaN(a) && Number.isNaN(b));
        const diff = Math.abs(a - b);
        return diff <= 1e-6 || diff <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));
      };

      expect(tol(result.quantity.areaSqFt, fx.expected.areaSqFt)).toBe(true);
      expect(tol(result.quantity.netCubicYards, fx.expected.netCubicYards)).toBe(true);
      expect(tol(result.quantity.orderQuantityYd3, fx.expected.orderQuantityYd3)).toBe(true);
      expect(tol(result.cost.readyMixCost, fx.expected.readyMixCost)).toBe(true);
      expect(tol(result.cost.directCost, fx.expected.directCost)).toBe(true);
      expect(tol(result.cost.overheadAmount, fx.expected.overheadAmount)).toBe(true);
      expect(tol(result.cost.trueCost, fx.expected.trueCost)).toBe(true);
      expect(result.pricing.currentMargin === null).toBe(fx.expected.currentMargin === null);
      if (result.pricing.currentMargin !== null && fx.expected.currentMargin !== null) {
        expect(tol(result.pricing.currentMargin, fx.expected.currentMargin)).toBe(true);
      }
      expect(tol(result.pricing.requiredSellingPrice, fx.expected.requiredSellingPrice)).toBe(true);
      expect(result.pricing.isBelowTarget).toBe(fx.expected.isBelowTarget);
      expect(tol(result.pricing.profitAtCurrentPrice, fx.expected.profitAtCurrentPrice)).toBe(true);
    });
  }
});
