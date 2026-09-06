import { describe, expect, it } from "vitest";
import { combinedNetCubicYards, combinedOrderQuantity, evaluateEntity } from "./estimateMath";

describe("combinedNetCubicYards", () => {
  it("sums volume across multiple sections", () => {
    const sections = [
      { id: "a", name: "A", lengthFt: 60, widthFt: 18, thicknessIn: 4 },
      { id: "b", name: "B", lengthFt: 20, widthFt: 24, thicknessIn: 4 },
    ];
    const single = combinedNetCubicYards([sections[0]]);
    const combined = combinedNetCubicYards(sections);
    expect(combined).toBeGreaterThan(single);
    // Volume is additive: combined equals the sum of each section computed independently.
    const secondAlone = combinedNetCubicYards([sections[1]]);
    expect(combined).toBeCloseTo(single + secondAlone, 6);
  });

  it("returns 0 for no sections", () => {
    expect(combinedNetCubicYards([])).toBe(0);
  });
});

describe("combinedOrderQuantity", () => {
  it("applies allowance and rounding across the combined total", () => {
    const sections = [{ id: "a", name: "A", lengthFt: 20, widthFt: 20, thicknessIn: 4 }];
    const qty = combinedOrderQuantity(sections, 8, "whole");
    // net = 20*20*(4/12)/27 = 4.938, *1.08 = 5.333, rounded up to whole = 6
    expect(qty).toBe(6);
  });
});

describe("evaluateEntity", () => {
  it("flags below-target margin consistently with the single-section engine", () => {
    const result = evaluateEntity({
      sections: [{ id: "a", name: "Driveway", lengthFt: 80, widthFt: 18, thicknessIn: 4 }],
      allowancePercent: 8,
      rounding: "quarter",
      costs: { readyMixRatePerYd3: 165, laborCost: 3400, formsCost: 550, reinforcementCost: 950, equipmentCost: 750, otherCost: 0 },
      overheadPercent: 15,
      targetMarginPercent: 30,
      sellingPrice: 9000,
    });
    expect(result.orderQuantityYd3).toBeGreaterThan(0);
    expect(result.trueCost).toBeGreaterThan(result.directCost);
    expect(result.isBelowTarget).toBe(true);
  });

  it("solves a required selling price that exceeds true cost", () => {
    const result = evaluateEntity({
      sections: [{ id: "a", name: "Slab", lengthFt: 20, widthFt: 20, thicknessIn: 4 }],
      allowancePercent: 5,
      rounding: "none",
      costs: { readyMixRatePerYd3: 150, laborCost: 800, formsCost: 150, reinforcementCost: 150, equipmentCost: 100, otherCost: 0 },
      overheadPercent: 12,
      targetMarginPercent: 28,
      sellingPrice: 5000,
    });
    expect(result.requiredSellingPrice).toBeGreaterThan(result.trueCost);
  });
});
