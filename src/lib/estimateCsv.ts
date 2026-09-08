// Contractor-facing CSV export for the single current estimate. Recordkeeping only -- this
// is NOT a restorable backup (see docs on Workspace in types.ts and the copy in
// SettingsTab/marketing pages): it can't be re-imported into the app.

import { calculateCost } from "./calc";
import { combinedNetCubicYards, combinedOrderQuantity } from "./estimateMath";
import { calculateMargin } from "./calc";
import { toCsv } from "./csv";
import type { Estimate } from "./types";

export const ESTIMATE_CSV_HEADERS = [
  "Estimate number",
  "Date",
  "Customer",
  "Project / address",
  "Section",
  "Cost item",
  "Quantity",
  "Unit",
  "Unit cost",
  "Line total",
  "Direct cost",
  "Overhead",
  "True cost",
  "Selling price",
  "Profit",
  "Margin",
  "Notes",
] as const;

export function estimateToCsvRows(estimate: Estimate): string[][] {
  const netCubicYards = combinedNetCubicYards(estimate.sections);
  const orderQuantityYd3 = combinedOrderQuantity(estimate.sections, estimate.allowancePercent, estimate.rounding);
  const cost = calculateCost({ areaSqFt: 0, netCubicFeet: 0, netCubicYards, orderQuantityYd3 }, estimate.costs, estimate.overheadPercent);
  const profit = estimate.sellingPrice - cost.trueCost;
  const margin = calculateMargin(estimate.sellingPrice, cost.trueCost);
  const marginText = margin === null ? "" : (margin * 100).toFixed(1) + "%";

  const projectAddress = [estimate.projectName, estimate.customerAddress].filter(Boolean).join(" — ");
  const dateText = new Date(estimate.createdAt).toLocaleDateString("en-US");

  const shared = {
    estimateNumber: estimate.estimateNumber,
    date: dateText,
    customer: estimate.customerName,
    projectAddress,
    directCost: cost.directCost.toFixed(2),
    overhead: cost.overheadAmount.toFixed(2),
    trueCost: cost.trueCost.toFixed(2),
    sellingPrice: estimate.sellingPrice.toFixed(2),
    profit: profit.toFixed(2),
    margin: marginText,
    notes: estimate.notes ?? "",
  };

  const rows: string[][] = [];

  for (const section of estimate.sections) {
    rows.push([
      shared.estimateNumber,
      shared.date,
      shared.customer,
      shared.projectAddress,
      section.name,
      `${section.lengthFt} ft x ${section.widthFt} ft, ${section.thicknessIn} in`,
      combinedNetCubicYards([section]).toFixed(2),
      "yd³",
      "",
      "",
      shared.directCost,
      shared.overhead,
      shared.trueCost,
      shared.sellingPrice,
      shared.profit,
      shared.margin,
      shared.notes,
    ]);
  }

  // Every category the wizard's Costs step supports -- but this is a recordkeeping export,
  // not a fixed-schema accounting import target (see the file header), so a category the
  // contractor never used on this job (e.g. no separate Equipment line) is left out of the
  // file entirely rather than padded in as a $0 row. Ready mix always appears: unlike the
  // others it's never legitimately zero for a real pour.
  const costLineItems: { label: string; amount: number; quantity?: string; unit?: string; unitCost?: string }[] = [
    { label: "Ready mix", amount: cost.readyMixCost, quantity: orderQuantityYd3.toFixed(2), unit: "yd³", unitCost: estimate.costs.readyMixRatePerYd3.toFixed(2) },
    { label: "Labor", amount: estimate.costs.laborCost },
    { label: "Forms", amount: estimate.costs.formsCost },
    { label: "Reinforcement", amount: estimate.costs.reinforcementCost },
    { label: "Equipment", amount: estimate.costs.equipmentCost },
    { label: "Other", amount: estimate.costs.otherCost },
  ].filter((item) => item.label === "Ready mix" || item.amount > 0);

  for (const item of costLineItems) {
    rows.push([
      shared.estimateNumber,
      shared.date,
      shared.customer,
      shared.projectAddress,
      "",
      item.label,
      item.quantity ?? "",
      item.unit ?? "",
      item.unitCost ?? "",
      item.amount.toFixed(2),
      shared.directCost,
      shared.overhead,
      shared.trueCost,
      shared.sellingPrice,
      shared.profit,
      shared.margin,
      shared.notes,
    ]);
  }

  return rows;
}

export function estimateToCsv(estimate: Estimate): string {
  return toCsv([[...ESTIMATE_CSV_HEADERS], ...estimateToCsvRows(estimate)]);
}
