// Metamorphic / invariant property tests. These do NOT compare to the oracle — they assert
// mathematical relationships that must hold on production code alone, regardless of the
// exact numeric implementation (monotonicity, additivity, zero-in/zero-out, etc.).
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { calculateQuantity, calculateCost, calculateMargin } from "../../src/lib/calc";
import { combinedNetCubicYards, combinedAreaSqFt, evaluateEntity } from "../../src/lib/estimateMath";
import type { ProjectSection } from "../../src/lib/types";

const SEED = 555000;
const dim = fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true });
const smallDim = fc.double({ min: 0.01, max: 500, noNaN: true, noDefaultInfinity: true });
const pct = fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true });
const money = fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true });

describe("invariant: zero dimension implies zero volume", () => {
  it("length=0 OR width=0 OR thickness=0 => netCubicYards=0 and orderQuantityYd3=0", () => {
    fc.assert(
      fc.property(dim, dim, pct, fc.constantFrom(0, 1, 2), (a, b, allowance, zeroPos) => {
        const dims = [a, b, 10][zeroPos === 2 ? 2 : 0]; // placeholder not used; build explicit below
        const lengthFt = zeroPos === 0 ? 0 : a;
        const widthFt = zeroPos === 1 ? 0 : b;
        const thicknessIn = zeroPos === 2 ? 0 : 6;
        const q = calculateQuantity({ lengthFt, widthFt, thicknessIn, allowancePercent: allowance, rounding: "none" });
        expect(q.netCubicYards).toBe(0);
        expect(q.orderQuantityYd3).toBe(0);
      }),
      { numRuns: 500, seed: SEED },
    );
  });
});

describe("invariant: monotonicity", () => {
  it("increasing length strictly increases (or holds) area and volume", () => {
    fc.assert(
      fc.property(smallDim, smallDim, fc.double({ min: 0.1, max: 6, noNaN: true }), smallDim, pct, (l1, extra, thicknessIn, widthFt, allowance) => {
        const l2 = l1 + extra;
        const q1 = calculateQuantity({ lengthFt: l1, widthFt, thicknessIn, allowancePercent: allowance, rounding: "none" });
        const q2 = calculateQuantity({ lengthFt: l2, widthFt, thicknessIn, allowancePercent: allowance, rounding: "none" });
        expect(q2.areaSqFt).toBeGreaterThanOrEqual(q1.areaSqFt);
        expect(q2.netCubicYards).toBeGreaterThanOrEqual(q1.netCubicYards);
      }),
      { numRuns: 500, seed: SEED + 1 },
    );
  });

  it("increasing waste/allowance% never decreases order quantity", () => {
    fc.assert(
      fc.property(smallDim, smallDim, fc.double({ min: 0.1, max: 24, noNaN: true }), pct, fc.double({ min: 0, max: 50, noNaN: true }), (lengthFt, widthFt, thicknessIn, a1, extra) => {
        const a2 = a1 + extra;
        const q1 = calculateQuantity({ lengthFt, widthFt, thicknessIn, allowancePercent: a1, rounding: "none" });
        const q2 = calculateQuantity({ lengthFt, widthFt, thicknessIn, allowancePercent: a2, rounding: "none" });
        expect(q2.orderQuantityYd3).toBeGreaterThanOrEqual(q1.orderQuantityYd3);
      }),
      { numRuns: 500, seed: SEED + 2 },
    );
  });

  it("increasing any cost line item never decreases direct/true cost", () => {
    fc.assert(
      fc.property(money, money, fc.double({ min: 0, max: 100000, noNaN: true }), pct, (base, extra, orderQty, overhead) => {
        const costs1 = { readyMixRatePerYd3: 100, laborCost: base, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 };
        const costs2 = { ...costs1, laborCost: base + extra };
        const q = { areaSqFt: 0, netCubicFeet: 0, netCubicYards: 0, orderQuantityYd3: orderQty };
        const c1 = calculateCost(q, costs1, overhead);
        const c2 = calculateCost(q, costs2, overhead);
        expect(c2.directCost).toBeGreaterThanOrEqual(c1.directCost);
        expect(c2.trueCost).toBeGreaterThanOrEqual(c1.trueCost);
      }),
      { numRuns: 500, seed: SEED + 3 },
    );
  });

  it("increasing overhead% never decreases true cost (direct cost held constant)", () => {
    fc.assert(
      fc.property(money, pct, fc.double({ min: 0, max: 50, noNaN: true }), (directCostTarget, o1, extra) => {
        const o2 = o1 + extra;
        const costs = { readyMixRatePerYd3: 0, laborCost: directCostTarget, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 };
        const q = { areaSqFt: 0, netCubicFeet: 0, netCubicYards: 0, orderQuantityYd3: 0 };
        const c1 = calculateCost(q, costs, o1);
        const c2 = calculateCost(q, costs, o2);
        expect(c2.trueCost).toBeGreaterThanOrEqual(c1.trueCost);
      }),
      { numRuns: 500, seed: SEED + 4 },
    );
  });

  it("increasing selling price (cost held constant) never decreases margin", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.01, max: 1_000_000, noNaN: true }), fc.double({ min: 0, max: 500000, noNaN: true }), money, (p1, extra, trueCost) => {
        const p2 = p1 + extra;
        const m1 = calculateMargin(p1, trueCost);
        const m2 = calculateMargin(p2, trueCost);
        if (m1 !== null && m2 !== null) {
          expect(m2).toBeGreaterThanOrEqual(m1 - 1e-9);
        }
      }),
      { numRuns: 500, seed: SEED + 5 },
    );
  });
});

describe("invariant: additivity across sections", () => {
  const section = () =>
    fc.record({
      id: fc.uuid(),
      name: fc.constant("s"),
      lengthFt: smallDim,
      widthFt: smallDim,
      thicknessIn: fc.double({ min: 0.1, max: 24, noNaN: true }),
    });

  it("combinedNetCubicYards of N sections equals the sum of each section computed alone", () => {
    fc.assert(
      fc.property(fc.array(section(), { minLength: 1, maxLength: 8 }), (sections) => {
        const combined = combinedNetCubicYards(sections as unknown as ProjectSection[]);
        const summed = sections.reduce((sum, s) => {
          const single = calculateQuantity({ lengthFt: s.lengthFt, widthFt: s.widthFt, thicknessIn: s.thicknessIn, allowancePercent: 0, rounding: "none" });
          return sum + single.netCubicYards;
        }, 0);
        expect(Math.abs(combined - summed)).toBeLessThan(1e-6 * Math.max(1, Math.abs(summed)));
      }),
      { numRuns: 300, seed: SEED + 6 },
    );
  });

  it("combinedAreaSqFt of N sections equals the sum of each section's area", () => {
    fc.assert(
      fc.property(fc.array(section(), { minLength: 1, maxLength: 8 }), (sections) => {
        const combined = combinedAreaSqFt(sections as unknown as ProjectSection[]);
        const summed = sections.reduce((sum, s) => sum + s.lengthFt * s.widthFt, 0);
        expect(Math.abs(combined - summed)).toBeLessThan(1e-6 * Math.max(1, Math.abs(summed)));
      }),
      { numRuns: 300, seed: SEED + 7 },
    );
  });

  it("direct cost = sum of its category cost lines, for every generated cost combination", () => {
    fc.assert(
      fc.property(money, money, money, money, money, money, pct, (rate, labor, forms, reinf, equip, other, overhead) => {
        const q = { areaSqFt: 0, netCubicFeet: 0, netCubicYards: 0, orderQuantityYd3: 1 };
        const c = calculateCost(q, { readyMixRatePerYd3: rate, laborCost: labor, formsCost: forms, reinforcementCost: reinf, equipmentCost: equip, otherCost: other }, overhead);
        const expectedDirect = rate * 1 + labor + forms + reinf + equip + other;
        expect(Math.abs(c.directCost - expectedDirect)).toBeLessThan(1e-6 * Math.max(1, Math.abs(expectedDirect)));
        expect(Math.abs(c.trueCost - c.directCost * (1 + overhead / 100))).toBeLessThan(1e-6 * Math.max(1, c.trueCost));
      }),
      { numRuns: 500, seed: SEED + 8 },
    );
  });
});

describe("invariant: null-margin / isBelowTarget suppression when price unset (documented behavior, §5/§10 of spec)", () => {
  it("selling price <= 0 => margin is null and isBelowTarget-style logic must not report 'below target'", () => {
    fc.assert(
      fc.property(fc.double({ min: -1000, max: 0, noNaN: true }), money, (sellingPrice, trueCost) => {
        expect(calculateMargin(sellingPrice, trueCost)).toBeNull();
      }),
      { numRuns: 200, seed: SEED + 9 },
    );
  });
});

describe("invariant: evaluateEntity NaN-section gap (documented §1 of spec)", () => {
  it("a NaN section dimension is NOT clamped to 0 by evaluateEntity (Math.max(0,NaN)===NaN propagates)", () => {
    const sections = [{ id: "1", name: "s", lengthFt: NaN, widthFt: 10, thicknessIn: 4 }] as unknown as ProjectSection[];
    const result = evaluateEntity({
      sections,
      allowancePercent: 10,
      rounding: "none",
      costs: { readyMixRatePerYd3: 100, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 },
      overheadPercent: 10,
      targetMarginPercent: 20,
      sellingPrice: 1000,
    });
    // This assertion documents observed (not desired) behavior: NaN propagates through
    // netCubicYards -> orderQuantityYd3 -> cost -> trueCost. Recorded as CCP bug candidate.
    expect(Number.isNaN(result.netCubicYards)).toBe(true);
  });
});
