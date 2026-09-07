import { describe, expect, it } from "vitest";
import {
  calculateCost,
  calculateEstimate,
  calculateLaborCost,
  calculateMargin,
  calculateMarkup,
  calculateQuantity,
  calculateRequiredSellingPrice,
  getZeroCostWarnings,
  roundQuantity,
} from "./calc";

describe("calculateQuantity", () => {
  it("matches the reference driveway example (60x20x4in, 8% allowance)", () => {
    const result = calculateQuantity({
      lengthFt: 60,
      widthFt: 20,
      thicknessIn: 4,
      allowancePercent: 8,
    });
    expect(result.areaSqFt).toBe(1200);
    expect(result.netCubicFeet).toBe(400);
    expect(result.netCubicYards).toBeCloseTo(14.8148, 4);
    expect(result.orderQuantityYd3).toBeCloseTo(16.0, 1);
  });

  it("treats negative or non-finite inputs as zero", () => {
    const result = calculateQuantity({
      lengthFt: -10,
      widthFt: NaN,
      thicknessIn: 4,
      allowancePercent: 8,
    });
    expect(result.areaSqFt).toBe(0);
    expect(result.orderQuantityYd3).toBe(0);
  });

  it("applies zero allowance correctly", () => {
    const result = calculateQuantity({
      lengthFt: 10,
      widthFt: 10,
      thicknessIn: 4,
      allowancePercent: 0,
    });
    expect(result.netCubicYards).toBeCloseTo(1.2346, 4);
    expect(result.orderQuantityYd3).toBeCloseTo(1.2346, 4);
  });
});

describe("roundQuantity", () => {
  it("rounds up to nearest quarter yard", () => {
    expect(roundQuantity(14.81, "quarter")).toBeCloseTo(15.0, 2);
  });
  it("rounds up to nearest half yard", () => {
    expect(roundQuantity(14.81, "half")).toBeCloseTo(15.0, 2);
  });
  it("rounds up to nearest whole yard", () => {
    expect(roundQuantity(14.01, "whole")).toBe(15);
  });
  it("passes through unrounded when 'none'", () => {
    expect(roundQuantity(14.8148, "none")).toBeCloseTo(14.8148, 4);
  });
  it("never returns negative", () => {
    expect(roundQuantity(-5, "whole")).toBe(0);
  });
});

describe("calculateCost", () => {
  it("matches the reference driveway example cost breakdown", () => {
    const quantity = calculateQuantity({
      lengthFt: 60,
      widthFt: 20,
      thicknessIn: 4,
      allowancePercent: 8,
    });
    const cost = calculateCost(
      quantity,
      {
        readyMixRatePerYd3: 165,
        laborCost: 3000,
        formsCost: 500,
        reinforcementCost: 900,
        equipmentCost: 450,
        otherCost: 0,
      },
      0,
    );
    // 16.0 yd3 (rounded default is "none" here so use the raw order qty)
    expect(cost.readyMixCost).toBeCloseTo(quantity.orderQuantityYd3 * 165, 2);
    expect(cost.directCost).toBeCloseTo(cost.readyMixCost + 3000 + 500 + 900 + 450, 2);
    expect(cost.trueCost).toBeCloseTo(cost.directCost, 2);
  });

  it("adds overhead on top of direct cost", () => {
    const quantity = { areaSqFt: 0, netCubicFeet: 0, netCubicYards: 0, orderQuantityYd3: 0 };
    const cost = calculateCost(
      quantity,
      { readyMixRatePerYd3: 0, laborCost: 1000, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 },
      15,
    );
    expect(cost.directCost).toBe(1000);
    expect(cost.overheadAmount).toBeCloseTo(150, 2);
    expect(cost.trueCost).toBeCloseTo(1150, 2);
  });
});

describe("margin vs markup", () => {
  it("computes margin as profit over selling price", () => {
    expect(calculateMargin(100, 70)).toBeCloseTo(0.3, 5);
  });
  it("computes markup as profit over cost", () => {
    expect(calculateMarkup(100, 70)).toBeCloseTo(0.42857, 4);
  });
  it("margin and markup diverge (not interchangeable)", () => {
    const margin = calculateMargin(100, 70)!;
    const markup = calculateMarkup(100, 70)!;
    expect(margin).not.toBeCloseTo(markup, 2);
  });
  it("returns null margin for zero selling price", () => {
    expect(calculateMargin(0, 70)).toBeNull();
  });
  it("returns null markup for zero cost", () => {
    expect(calculateMarkup(100, 0)).toBeNull();
  });
});

describe("calculateRequiredSellingPrice", () => {
  it("solves price for a 30% margin target", () => {
    // trueCost 7000 at 30% margin => price = 7000 / 0.7 = 10000
    expect(calculateRequiredSellingPrice(7000, 30)).toBeCloseTo(10000, 2);
  });
  it("round-trips: selling at the required price yields the target margin", () => {
    const trueCost = 8560;
    const targetMarginPercent = 30;
    const price = calculateRequiredSellingPrice(trueCost, targetMarginPercent);
    const margin = calculateMargin(price, trueCost)!;
    expect(margin).toBeCloseTo(targetMarginPercent / 100, 4);
  });
});

describe("calculateEstimate (driveway scenario)", () => {
  it("produces internally consistent quantity, cost and pricing for the driveway example", () => {
    const result = calculateEstimate({
      dimensions: { lengthFt: 60, widthFt: 20, thicknessIn: 4, allowancePercent: 8, rounding: "none" },
      costs: {
        readyMixRatePerYd3: 165,
        laborCost: 3000,
        formsCost: 500,
        reinforcementCost: 900,
        equipmentCost: 450,
        otherCost: 0,
      },
      pricing: { overheadPercent: 0, targetMarginPercent: 30, sellingPrice: 9300 },
    });

    expect(result.quantity.orderQuantityYd3).toBeCloseTo(16.0, 1);
    expect(result.cost.trueCost).toBeCloseTo(
      result.quantity.orderQuantityYd3 * 165 + 3000 + 500 + 900 + 450,
      2,
    );
    // Required price, sold at, must itself yield exactly the target margin.
    const impliedMargin = calculateMargin(result.pricing.requiredSellingPrice, result.cost.trueCost)!;
    expect(impliedMargin).toBeCloseTo(0.3, 4);
    // Selling at 9300 against a ~7490 true cost is below the 30% target.
    expect(result.pricing.currentMargin).toBeCloseTo(calculateMargin(9300, result.cost.trueCost)!, 4);
    expect(result.pricing.isBelowTarget).toBe(true);
  });

  it("flags healthy margin as not below target", () => {
    const result = calculateEstimate({
      dimensions: { lengthFt: 20, widthFt: 20, thicknessIn: 4, allowancePercent: 5 },
      costs: { readyMixRatePerYd3: 150, laborCost: 500, formsCost: 100, reinforcementCost: 100, equipmentCost: 50, otherCost: 0 },
      pricing: { overheadPercent: 10, targetMarginPercent: 25, sellingPrice: 5000 },
    });
    expect(result.pricing.isBelowTarget).toBe(false);
  });
});

describe("calculateLaborCost", () => {
  it("computes hourly labor as crew size × hours × loaded rate", () => {
    const cost = calculateLaborCost({ mode: "hourly", crewSize: 4, hours: 12, ratePerHour: 36, unitRatePerSqft: 0 }, 0);
    expect(cost).toBe(4 * 12 * 36);
  });

  it("computes unit-based labor as rate per square foot × total area", () => {
    const cost = calculateLaborCost({ mode: "unit", crewSize: 0, hours: 0, ratePerHour: 0, unitRatePerSqft: 3.25 }, 1200);
    expect(cost).toBeCloseTo(3.25 * 1200, 2);
  });

  it("returns 0 for flat mode — the caller uses the entered amount directly", () => {
    const cost = calculateLaborCost({ mode: "flat", crewSize: 4, hours: 12, ratePerHour: 36, unitRatePerSqft: 3.25 }, 1200);
    expect(cost).toBe(0);
  });

  it("treats negative or invalid inputs as zero", () => {
    const cost = calculateLaborCost({ mode: "hourly", crewSize: -4, hours: NaN, ratePerHour: 36, unitRatePerSqft: 0 }, 0);
    expect(cost).toBe(0);
  });
});

describe("getZeroCostWarnings", () => {
  it("flags a $0 ready-mix rate on a job with real area", () => {
    const warnings = getZeroCostWarnings({ readyMixRatePerYd3: 0, laborCost: 500 }, 960);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/ready-mix/i);
  });

  it("flags a $0 labor cost on a job with real area", () => {
    const warnings = getZeroCostWarnings({ readyMixRatePerYd3: 165, laborCost: 0 }, 960);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/labor/i);
  });

  it("flags both when both are $0", () => {
    const warnings = getZeroCostWarnings({ readyMixRatePerYd3: 0, laborCost: 0 }, 960);
    expect(warnings).toHaveLength(2);
  });

  it("does not flag a fully-priced job", () => {
    const warnings = getZeroCostWarnings({ readyMixRatePerYd3: 165, laborCost: 500 }, 960);
    expect(warnings).toHaveLength(0);
  });

  it("does not flag anything when there is no area yet (nothing entered)", () => {
    const warnings = getZeroCostWarnings({ readyMixRatePerYd3: 0, laborCost: 0 }, 0);
    expect(warnings).toHaveLength(0);
  });
});
