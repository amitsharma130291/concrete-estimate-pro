// Pure, unit-tested calculation engine for Concrete Cost Pro.
// No structural/engineering logic lives here — only quantity, cost and pricing math
// from user-supplied dimensions and rates.
//
// Decimal-safe arithmetic: every internal calculation below runs through Decimal.js
// (arbitrary-precision) rather than raw IEEE-754 doubles, so intermediate rounding error
// cannot accumulate across a multi-step chain (area -> volume -> allowance -> rounding ->
// cost -> overhead -> margin). Public function signatures are unchanged — every function
// still accepts and returns plain `number` — so no caller in the app needed to change;
// only the arithmetic performed *between* those boundaries is decimal-safe now.

import Decimal from "decimal.js";

export type Rounding = "none" | "quarter" | "half" | "whole";

export interface DimensionsInput {
  lengthFt: number;
  widthFt: number;
  thicknessIn: number;
  allowancePercent: number;
  rounding?: Rounding;
}

export interface CostInputs {
  readyMixRatePerYd3: number;
  laborCost: number;
  formsCost: number;
  reinforcementCost: number;
  equipmentCost: number;
  otherCost: number;
}

export interface PricingInputs {
  overheadPercent: number;
  targetMarginPercent: number;
  sellingPrice: number;
}

export interface EstimateInput {
  dimensions: DimensionsInput;
  costs: CostInputs;
  pricing: PricingInputs;
}

export interface QuantityResult {
  areaSqFt: number;
  netCubicFeet: number;
  netCubicYards: number;
  orderQuantityYd3: number;
}

export interface CostResult {
  readyMixCost: number;
  directCost: number;
  overheadAmount: number;
  trueCost: number;
}

export interface PricingResult {
  currentMargin: number | null;
  currentMarkup: number | null;
  requiredSellingPrice: number;
  isBelowTarget: boolean;
  profitAtCurrentPrice: number;
}

export interface EstimateResult {
  quantity: QuantityResult;
  cost: CostResult;
  pricing: PricingResult;
}

/** Clamp a raw number to a Decimal, treating non-finite/negative as 0 (same contract as
 * the pre-migration `safe()` helper, checked on the raw JS number since Decimal cannot
 * represent NaN/±Infinity as a usable value). */
function safeD(n: number): Decimal {
  return Number.isFinite(n) && n >= 0 ? new Decimal(n) : new Decimal(0);
}

/** Clamp a raw number to 0 when negative or non-finite. Exported so callers outside this
 * file (e.g. ActualsTab.tsx, which sums logged real-world costs that never go through
 * calculateCost()) can apply the same input-sanitization contract as every calculation in
 * this module, instead of silently summing an unclamped negative. */
export function safe(n: number): number {
  return safeD(n).toNumber();
}

/** Round a cubic-yard quantity to the requested increment. Defaults to no rounding. */
export function roundQuantity(value: number, rounding: Rounding = "none"): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  const v = new Decimal(value);
  switch (rounding) {
    case "quarter":
      return v.dividedBy("0.25").ceil().times("0.25").toNumber();
    case "half":
      return v.dividedBy("0.5").ceil().times("0.5").toNumber();
    case "whole":
      return v.ceil().toNumber();
    case "none":
    default:
      return value;
  }
}

function roundQuantityD(value: Decimal, rounding: Rounding): Decimal {
  if (!value.isFinite() || value.isNegative()) return new Decimal(0);
  switch (rounding) {
    case "quarter":
      return value.dividedBy("0.25").ceil().times("0.25");
    case "half":
      return value.dividedBy("0.5").ceil().times("0.5");
    case "whole":
      return value.ceil();
    case "none":
    default:
      return value;
  }
}

export function calculateQuantity(input: DimensionsInput): QuantityResult {
  const lengthFt = safeD(input.lengthFt);
  const widthFt = safeD(input.widthFt);
  const thicknessIn = safeD(input.thicknessIn);
  const allowancePercent = safeD(input.allowancePercent);

  const areaSqFtD = lengthFt.times(widthFt);
  const thicknessFtD = thicknessIn.dividedBy(12);
  const netCubicFeetD = areaSqFtD.times(thicknessFtD);
  const netCubicYardsD = netCubicFeetD.dividedBy(27);
  const withAllowanceD = netCubicYardsD.times(allowancePercent.dividedBy(100).plus(1));
  const orderQuantityYd3D = roundQuantityD(withAllowanceD, input.rounding ?? "none");

  return {
    areaSqFt: areaSqFtD.toNumber(),
    netCubicFeet: netCubicFeetD.toNumber(),
    netCubicYards: netCubicYardsD.toNumber(),
    orderQuantityYd3: orderQuantityYd3D.toNumber(),
  };
}

export function calculateCost(quantity: QuantityResult, costs: CostInputs, overheadPercent: number): CostResult {
  const readyMixCostD = safeD(quantity.orderQuantityYd3).times(safeD(costs.readyMixRatePerYd3));
  const directCostD = readyMixCostD
    .plus(safeD(costs.laborCost))
    .plus(safeD(costs.formsCost))
    .plus(safeD(costs.reinforcementCost))
    .plus(safeD(costs.equipmentCost))
    .plus(safeD(costs.otherCost));
  const overheadAmountD = directCostD.times(safeD(overheadPercent).dividedBy(100));
  const trueCostD = directCostD.plus(overheadAmountD);

  return {
    readyMixCost: readyMixCostD.toNumber(),
    directCost: directCostD.toNumber(),
    overheadAmount: overheadAmountD.toNumber(),
    trueCost: trueCostD.toNumber(),
  };
}

/** Margin = (sellingPrice - trueCost) / sellingPrice. Returns null when sellingPrice is 0 (undefined). */
export function calculateMargin(sellingPrice: number, trueCost: number): number | null {
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) return null;
  return new Decimal(sellingPrice).minus(trueCost).dividedBy(sellingPrice).toNumber();
}

/** Markup = (sellingPrice - trueCost) / trueCost. Distinct from margin. Returns null when trueCost is 0. */
export function calculateMarkup(sellingPrice: number, trueCost: number): number | null {
  if (!Number.isFinite(trueCost) || trueCost <= 0) return null;
  return new Decimal(sellingPrice).minus(trueCost).dividedBy(trueCost).toNumber();
}

/** Required selling price to hit a target margin (not markup). */
export function calculateRequiredSellingPrice(trueCost: number, targetMarginPercent: number): number {
  const marginDecimal = safeD(targetMarginPercent).dividedBy(100);
  if (marginDecimal.greaterThanOrEqualTo(1)) return Infinity;
  return safeD(trueCost).dividedBy(new Decimal(1).minus(marginDecimal)).toNumber();
}

export type LaborMode = "flat" | "hourly" | "unit";

export interface LaborModeInput {
  mode: LaborMode;
  crewSize: number;
  hours: number;
  ratePerHour: number;
  unitRatePerSqft: number;
}

/**
 * Resolves a labor input (flat/hourly/unit) plus the project's total area into a
 * single dollar labor cost. "flat" ignores every other field and returns it unchanged
 * so callers can pass a plain number through this same path.
 */
export function calculateLaborCost(labor: LaborModeInput, totalAreaSqFt: number): number {
  switch (labor.mode) {
    case "hourly":
      return safeD(labor.crewSize).times(safeD(labor.hours)).times(safeD(labor.ratePerHour)).toNumber();
    case "unit":
      return safeD(labor.unitRatePerSqft).times(safeD(totalAreaSqFt)).toNumber();
    case "flat":
    default:
      return 0;
  }
}

export function calculateEstimate(input: EstimateInput): EstimateResult {
  const quantity = calculateQuantity(input.dimensions);
  const cost = calculateCost(quantity, input.costs, input.pricing.overheadPercent);
  const requiredSellingPrice = calculateRequiredSellingPrice(cost.trueCost, input.pricing.targetMarginPercent);
  const currentMargin = calculateMargin(input.pricing.sellingPrice, cost.trueCost);
  const currentMarkup = calculateMarkup(input.pricing.sellingPrice, cost.trueCost);
  const targetDecimal = safe(input.pricing.targetMarginPercent) / 100;
  const isBelowTarget = currentMargin === null ? false : currentMargin < targetDecimal;
  const profitAtCurrentPrice = safeD(input.pricing.sellingPrice).minus(cost.trueCost).toNumber();

  return {
    quantity,
    cost,
    pricing: {
      currentMargin,
      currentMarkup,
      requiredSellingPrice,
      isBelowTarget,
      profitAtCurrentPrice,
    },
  };
}

/**
 * Flags cost fields that are exactly $0 while the job has real quantity/area to build —
 * almost always a blank/mistyped field rather than a legitimate $0 cost, since ready-mix
 * and labor are essentially never free. Deliberately does NOT flag forms/reinforcement/
 * equipment/other: those are commonly, validly zero on many real jobs. Non-blocking — the
 * caller decides whether to show this as a dismissible warning, since a contractor doing
 * their own labor for free (e.g. a DIY-adjacent quote) is a real, if unusual, case.
 */
export function getZeroCostWarnings(costs: Pick<CostInputs, "readyMixRatePerYd3" | "laborCost">, areaSqFt: number): string[] {
  if (!(areaSqFt > 0)) return [];
  const warnings: string[] = [];
  if (costs.readyMixRatePerYd3 === 0) warnings.push("Ready-mix rate is $0/yd³ — confirm this is intentional, not a blank field.");
  if (costs.laborCost === 0) warnings.push("Labor cost is $0 — confirm this is intentional, not a blank field.");
  return warnings;
}

// ---- Formatting helpers ----

export function formatCurrency(value: number, opts: { cents?: boolean } = {}): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  }).format(value);
}

export function formatPercent(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatYd3(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(2)} yd³`;
}
