// Pure, unit-tested calculation engine for Concrete Cost Pro.
// No structural/engineering logic lives here — only quantity, cost and pricing math
// from user-supplied dimensions and rates.

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

/** Round a cubic-yard quantity to the requested increment. Defaults to no rounding. */
export function roundQuantity(value: number, rounding: Rounding = "none"): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  switch (rounding) {
    case "quarter":
      return Math.ceil(value / 0.25) * 0.25;
    case "half":
      return Math.ceil(value / 0.5) * 0.5;
    case "whole":
      return Math.ceil(value);
    case "none":
    default:
      return value;
  }
}

function safe(n: number): number {
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function calculateQuantity(input: DimensionsInput): QuantityResult {
  const lengthFt = safe(input.lengthFt);
  const widthFt = safe(input.widthFt);
  const thicknessIn = safe(input.thicknessIn);
  const allowancePercent = safe(input.allowancePercent);

  const areaSqFt = lengthFt * widthFt;
  const thicknessFt = thicknessIn / 12;
  const netCubicFeet = areaSqFt * thicknessFt;
  const netCubicYards = netCubicFeet / 27;
  const withAllowance = netCubicYards * (1 + allowancePercent / 100);
  const orderQuantityYd3 = roundQuantity(withAllowance, input.rounding ?? "none");

  return { areaSqFt, netCubicFeet, netCubicYards, orderQuantityYd3 };
}

export function calculateCost(quantity: QuantityResult, costs: CostInputs, overheadPercent: number): CostResult {
  const readyMixCost = safe(quantity.orderQuantityYd3) * safe(costs.readyMixRatePerYd3);
  const directCost =
    readyMixCost +
    safe(costs.laborCost) +
    safe(costs.formsCost) +
    safe(costs.reinforcementCost) +
    safe(costs.equipmentCost) +
    safe(costs.otherCost);
  const overheadAmount = directCost * (safe(overheadPercent) / 100);
  const trueCost = directCost + overheadAmount;

  return { readyMixCost, directCost, overheadAmount, trueCost };
}

/** Margin = (sellingPrice - trueCost) / sellingPrice. Returns null when sellingPrice is 0 (undefined). */
export function calculateMargin(sellingPrice: number, trueCost: number): number | null {
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) return null;
  return (sellingPrice - trueCost) / sellingPrice;
}

/** Markup = (sellingPrice - trueCost) / trueCost. Distinct from margin. Returns null when trueCost is 0. */
export function calculateMarkup(sellingPrice: number, trueCost: number): number | null {
  if (!Number.isFinite(trueCost) || trueCost <= 0) return null;
  return (sellingPrice - trueCost) / trueCost;
}

/** Required selling price to hit a target margin (not markup). */
export function calculateRequiredSellingPrice(trueCost: number, targetMarginPercent: number): number {
  const marginDecimal = safe(targetMarginPercent) / 100;
  if (marginDecimal >= 1) return Infinity;
  return safe(trueCost) / (1 - marginDecimal);
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
      return safe(labor.crewSize) * safe(labor.hours) * safe(labor.ratePerHour);
    case "unit":
      return safe(labor.unitRatePerSqft) * safe(totalAreaSqFt);
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
  const profitAtCurrentPrice = safe(input.pricing.sellingPrice) - cost.trueCost;

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
