import Decimal from "decimal.js";
import { calculateCost, calculateEstimate, calculateMargin, calculateRequiredSellingPrice, roundQuantity, type Rounding } from "./calc";
import type { Estimate, Project, ProjectSection } from "./types";

export interface MultiSectionCosts {
  readyMixRatePerYd3: number;
  laborCost: number;
  formsCost: number;
  reinforcementCost: number;
  equipmentCost: number;
  otherCost: number;
}

/** Clamps a raw section dimension exactly like the original `Math.max(0, x)` — including
 * its NaN-passthrough behavior (`Math.max(0, NaN) === NaN`, documented as a known,
 * UI-unreachable gap in docs/CALCULATION_SPEC.md §1) — before handing off to Decimal for
 * the actual arithmetic. This migration is scoped to arithmetic precision, not to changing
 * that pre-existing clamping semantics. */
function clampDim(n: number): Decimal {
  return Number.isNaN(n) ? new Decimal(NaN) : new Decimal(Math.max(0, n));
}

/** Sum footprint area across every rectangular section — used for unit-rate ($/ft²) labor. */
export function combinedAreaSqFt(sections: ProjectSection[]): number {
  return sections
    .reduce((sum, s) => sum.plus(clampDim(s.lengthFt).times(clampDim(s.widthFt))), new Decimal(0))
    .toNumber();
}

/** Sum concrete volume across every rectangular section of a multi-section project. */
export function combinedNetCubicYards(sections: ProjectSection[]): number {
  return sections
    .reduce((sum, s) => {
      const areaSqFt = clampDim(s.lengthFt).times(clampDim(s.widthFt));
      const thicknessFt = clampDim(s.thicknessIn).dividedBy(12);
      return sum.plus(areaSqFt.times(thicknessFt).dividedBy(27));
    }, new Decimal(0))
    .toNumber();
}

export function combinedOrderQuantity(sections: ProjectSection[], allowancePercent: number, rounding: Rounding): number {
  const net = combinedNetCubicYards(sections);
  return roundQuantity(net * (1 + allowancePercent / 100), rounding);
}

export interface EntityEstimateResult {
  netCubicYards: number;
  orderQuantityYd3: number;
  directCost: number;
  overheadAmount: number;
  trueCost: number;
  requiredSellingPrice: number;
  currentMargin: number | null;
  isBelowTarget: boolean;
}

export function evaluateEntity(entity: {
  sections: ProjectSection[];
  allowancePercent: number;
  rounding: Rounding;
  costs: MultiSectionCosts;
  overheadPercent: number;
  targetMarginPercent: number;
  sellingPrice: number;
}): EntityEstimateResult {
  const netCubicYards = combinedNetCubicYards(entity.sections);
  const orderQuantityYd3 = roundQuantity(netCubicYards * (1 + entity.allowancePercent / 100), entity.rounding);
  const cost = calculateCost(
    { areaSqFt: 0, netCubicFeet: 0, netCubicYards, orderQuantityYd3 },
    entity.costs,
    entity.overheadPercent,
  );
  const requiredSellingPrice = calculateRequiredSellingPrice(cost.trueCost, entity.targetMarginPercent);
  const currentMargin = calculateMargin(entity.sellingPrice, cost.trueCost);
  const isBelowTarget = currentMargin !== null && currentMargin < entity.targetMarginPercent / 100;

  return {
    netCubicYards,
    orderQuantityYd3,
    directCost: cost.directCost,
    overheadAmount: cost.overheadAmount,
    trueCost: cost.trueCost,
    requiredSellingPrice,
    currentMargin,
    isBelowTarget,
  };
}

export function evaluateEstimate(e: Estimate): EntityEstimateResult {
  return evaluateEntity(e);
}

export function evaluateProject(p: Project): EntityEstimateResult {
  return evaluateEntity(p);
}

export { calculateEstimate };
