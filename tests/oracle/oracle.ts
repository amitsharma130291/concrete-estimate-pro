// Independent calculation oracle for Concrete Cost Pro QA audit.
//
// THIS FILE MUST NOT IMPORT FROM src/lib/calc.ts OR src/lib/estimateMath.ts, AND MUST NOT
// COPY THEIR CODE. It is a from-scratch re-implementation of the formulas documented in
// docs/CALCULATION_SPEC.md, using Decimal.js for arbitrary-precision arithmetic, so that
// property-based differential tests can compare production (IEEE-754 double) output
// against a mathematically exact reference and detect real floating-point divergence.
//
// Where the spec's clamp-to-zero behavior differs subtly between calc.ts (safe(), which
// treats NaN as invalid) and estimateMath.ts (Math.max(0,x), which does NOT clamp NaN),
// this oracle deliberately implements the calc.ts-documented "safe" semantics as the
// correctness baseline (§1 of the spec) and tests are expected to surface any divergence
// as a defect, not silently reproduce it.

import Decimal from "decimal.js";

export type Rounding = "none" | "quarter" | "half" | "whole";

function oracleSafe(n: number): Decimal {
  if (!Number.isFinite(n) || n < 0) return new Decimal(0);
  return new Decimal(n);
}

export function oracleRoundQuantity(value: Decimal | number, rounding: Rounding = "none"): Decimal {
  const v = value instanceof Decimal ? value : new Decimal(Number.isFinite(value) ? value : NaN);
  if (!v.isFinite() || v.isNegative()) return new Decimal(0);
  switch (rounding) {
    case "quarter":
      return v.dividedBy(0.25).ceil().times(0.25);
    case "half":
      return v.dividedBy(0.5).ceil().times(0.5);
    case "whole":
      return v.ceil();
    case "none":
    default:
      return v;
  }
}

export interface OracleDimensions {
  lengthFt: number;
  widthFt: number;
  thicknessIn: number;
  allowancePercent: number;
  rounding?: Rounding;
}

export interface OracleQuantity {
  areaSqFt: Decimal;
  netCubicFeet: Decimal;
  netCubicYards: Decimal;
  orderQuantityYd3: Decimal;
}

export function oracleCalculateQuantity(input: OracleDimensions): OracleQuantity {
  const lengthFt = oracleSafe(input.lengthFt);
  const widthFt = oracleSafe(input.widthFt);
  const thicknessIn = oracleSafe(input.thicknessIn);
  const allowancePercent = oracleSafe(input.allowancePercent);

  const areaSqFt = lengthFt.times(widthFt);
  const thicknessFt = thicknessIn.dividedBy(12);
  const netCubicFeet = areaSqFt.times(thicknessFt);
  const netCubicYards = netCubicFeet.dividedBy(27);
  const withAllowance = netCubicYards.times(allowancePercent.dividedBy(100).plus(1));
  const orderQuantityYd3 = oracleRoundQuantity(withAllowance, input.rounding ?? "none");

  return { areaSqFt, netCubicFeet, netCubicYards, orderQuantityYd3 };
}

export interface OracleCostInputs {
  readyMixRatePerYd3: number;
  laborCost: number;
  formsCost: number;
  reinforcementCost: number;
  equipmentCost: number;
  otherCost: number;
}

export interface OracleCostResult {
  readyMixCost: Decimal;
  directCost: Decimal;
  overheadAmount: Decimal;
  trueCost: Decimal;
}

export function oracleCalculateCost(
  orderQuantityYd3: Decimal | number,
  costs: OracleCostInputs,
  overheadPercent: number,
): OracleCostResult {
  const qty = orderQuantityYd3 instanceof Decimal ? orderQuantityYd3 : oracleSafe(orderQuantityYd3);
  const readyMixCost = oracleSafe(qty instanceof Decimal ? qty.toNumber() : qty).times(oracleSafe(costs.readyMixRatePerYd3));
  const directCost = readyMixCost
    .plus(oracleSafe(costs.laborCost))
    .plus(oracleSafe(costs.formsCost))
    .plus(oracleSafe(costs.reinforcementCost))
    .plus(oracleSafe(costs.equipmentCost))
    .plus(oracleSafe(costs.otherCost));
  const overheadAmount = directCost.times(oracleSafe(overheadPercent).dividedBy(100));
  const trueCost = directCost.plus(overheadAmount);

  return { readyMixCost, directCost, overheadAmount, trueCost };
}

export function oracleCalculateMargin(sellingPrice: number, trueCost: Decimal | number): number | null {
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) return null;
  const tc = trueCost instanceof Decimal ? trueCost : new Decimal(trueCost);
  return new Decimal(sellingPrice).minus(tc).dividedBy(sellingPrice).toNumber();
}

export function oracleCalculateMarkup(sellingPrice: number, trueCost: Decimal | number): number | null {
  const tc = trueCost instanceof Decimal ? trueCost : new Decimal(trueCost);
  if (!tc.isFinite() || tc.lessThanOrEqualTo(0)) return null;
  return new Decimal(sellingPrice).minus(tc).dividedBy(tc).toNumber();
}

export function oracleCalculateRequiredSellingPrice(trueCost: Decimal | number, targetMarginPercent: number): number {
  const marginDecimal = oracleSafe(targetMarginPercent).dividedBy(100);
  if (marginDecimal.greaterThanOrEqualTo(1)) return Infinity;
  const tc = trueCost instanceof Decimal ? trueCost : oracleSafe(trueCost);
  return tc.dividedBy(new Decimal(1).minus(marginDecimal)).toNumber();
}

export interface OracleEstimateInput {
  dimensions: OracleDimensions;
  costs: OracleCostInputs;
  pricing: { overheadPercent: number; targetMarginPercent: number; sellingPrice: number };
}

export interface OracleEstimateResult {
  quantity: OracleQuantity;
  cost: OracleCostResult;
  pricing: {
    currentMargin: number | null;
    currentMarkup: number | null;
    requiredSellingPrice: number;
    isBelowTarget: boolean;
    profitAtCurrentPrice: number;
  };
}

export function oracleCalculateEstimate(input: OracleEstimateInput): OracleEstimateResult {
  const quantity = oracleCalculateQuantity(input.dimensions);
  const cost = oracleCalculateCost(quantity.orderQuantityYd3, input.costs, input.pricing.overheadPercent);
  const requiredSellingPrice = oracleCalculateRequiredSellingPrice(cost.trueCost, input.pricing.targetMarginPercent);
  const currentMargin = oracleCalculateMargin(input.pricing.sellingPrice, cost.trueCost);
  const currentMarkup = oracleCalculateMarkup(input.pricing.sellingPrice, cost.trueCost);
  const targetDecimal = oracleSafe(input.pricing.targetMarginPercent).dividedBy(100).toNumber();
  const isBelowTarget = currentMargin === null ? false : currentMargin < targetDecimal;
  const profitAtCurrentPrice = oracleSafe(input.pricing.sellingPrice).minus(cost.trueCost).toNumber();

  return {
    quantity,
    cost,
    pricing: { currentMargin, currentMarkup, requiredSellingPrice, isBelowTarget, profitAtCurrentPrice },
  };
}

// ---- Multi-section (estimateMath.ts equivalent) ----

export interface OracleSection {
  lengthFt: number;
  widthFt: number;
  thicknessIn: number;
}

function clampMax0(n: number): Decimal {
  // Mirrors estimateMath.ts's Math.max(0, x) literally, INCLUDING its NaN behavior
  // (Math.max(0, NaN) === NaN), so the oracle can detect the documented NaN-clamping gap.
  if (Number.isNaN(n)) return new Decimal(NaN);
  return new Decimal(Math.max(0, n));
}

export function oracleCombinedAreaSqFt(sections: OracleSection[]): Decimal {
  return sections.reduce((sum, s) => sum.plus(clampMax0(s.lengthFt).times(clampMax0(s.widthFt))), new Decimal(0));
}

export function oracleCombinedNetCubicYards(sections: OracleSection[]): Decimal {
  return sections.reduce((sum, s) => {
    const areaSqFt = clampMax0(s.lengthFt).times(clampMax0(s.widthFt));
    const thicknessFt = clampMax0(s.thicknessIn).dividedBy(12);
    return sum.plus(areaSqFt.times(thicknessFt).dividedBy(27));
  }, new Decimal(0));
}

export function oracleCombinedOrderQuantity(sections: OracleSection[], allowancePercent: number, rounding: Rounding): Decimal {
  const net = oracleCombinedNetCubicYards(sections);
  // allowancePercent is NOT passed through oracleSafe here, matching the documented
  // §3 gap: a negative allowance percent is applied as-is in production.
  const withAllowance = net.times(new Decimal(allowancePercent).dividedBy(100).plus(1));
  return oracleRoundQuantity(withAllowance, rounding);
}
