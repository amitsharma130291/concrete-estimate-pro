import Decimal from "decimal.js";
import { roundQuantity, type Rounding } from "./calc";

function finiteNumber(value: Decimal): number {
  const number = value.toNumber();
  if (!Number.isFinite(number))
    throw new Error("The result is too large. Use smaller input values.");
  return number;
}

function nonnegative(value: number, name: string, positive = false): Decimal {
  if (!Number.isFinite(value) || value < 0 || (positive && value === 0)) {
    throw new Error(
      `${name} must be ${positive ? "greater than zero" : "zero or greater"}.`,
    );
  }
  return new Decimal(value);
}

export interface SupplierQuote {
  quantity: number;
  rate: number;
  delivery: number;
  shortLoad: number;
  pump: number;
  other: number;
  taxPercent: number;
}

/** Tax applies to the complete entered subtotal. Supplier-specific taxable exclusions
 * should be entered as an effective tax percentage, as explained beside the input. */
export function supplierCost(input: SupplierQuote) {
  const quantity = nonnegative(input.quantity, "Order quantity", true);
  const material = quantity
    .times(nonnegative(input.rate, "Price per yard"))
    .toDecimalPlaces(2);
  const fees = [
    input.delivery,
    input.shortLoad,
    input.pump,
    input.other,
  ].reduce(
    (sum, value) => sum.plus(nonnegative(value, "Fees").toDecimalPlaces(2)),
    new Decimal(0),
  );
  const subtotal = material.plus(fees);
  const taxPercent = nonnegative(input.taxPercent, "Tax percentage");
  if (taxPercent.gt(100)) throw new Error("Tax percentage cannot exceed 100.");
  const tax = subtotal.times(taxPercent).div(100).toDecimalPlaces(2);
  const total = subtotal.plus(tax);
  return {
    material: finiteNumber(material),
    fees: finiteNumber(fees),
    subtotal: finiteNumber(subtotal),
    tax: finiteNumber(tax),
    total: finiteNumber(total),
    effectiveRate: finiteNumber(total.div(quantity)),
  };
}

export interface PourSection {
  length: number;
  width: number;
  thickness: number;
}
export function pourQuantity(
  sections: PourSection[],
  allowance: number,
  rounding: Rounding,
) {
  if (!sections.length) throw new Error("Add at least one pour section.");
  const allowanceD = nonnegative(allowance, "Allowance");
  if (allowanceD.gt(100)) throw new Error("Allowance cannot exceed 100.");
  const volumes = sections.map((section) =>
    nonnegative(section.length, "Length", true)
      .times(nonnegative(section.width, "Width", true))
      .times(nonnegative(section.thickness, "Thickness", true))
      .div(324),
  );
  const net = volumes.reduce((sum, value) => sum.plus(value), new Decimal(0));
  const allowed = net.times(allowanceD.div(100).plus(1));
  const order = roundQuantity(finiteNumber(allowed), rounding);
  return {
    sections: volumes.map(finiteNumber),
    net: finiteNumber(net),
    allowanceVolume: finiteNumber(allowed.minus(net)),
    order,
    roundingVolume: finiteNumber(new Decimal(order).minus(allowed)),
  };
}

export interface MaterialLine {
  quantity: number;
  waste: number;
  packSize: number;
  unitCost: number;
}
export function materialPurchase(input: MaterialLine) {
  const quantity = nonnegative(input.quantity, "Net quantity");
  const waste = nonnegative(input.waste, "Waste percentage");
  if (waste.gt(100)) throw new Error("Waste percentage cannot exceed 100.");
  const packSize = nonnegative(input.packSize, "Purchase increment", true);
  const order = quantity
    .times(waste.div(100).plus(1))
    .div(packSize)
    .ceil()
    .times(packSize);
  return {
    order: finiteNumber(order),
    cost: finiteNumber(
      order.times(nonnegative(input.unitCost, "Unit cost")).toDecimalPlaces(2),
    ),
  };
}

export interface InvoiceLine {
  quantity: number;
  rate: number;
  taxable: boolean;
}
export function invoiceTotals(
  lines: InvoiceLine[],
  taxPercent: number,
  paid: number,
) {
  const rate = nonnegative(taxPercent, "Tax percentage");
  if (rate.gt(100)) throw new Error("Tax percentage cannot exceed 100.");
  // Each invoice line and the tax amount are rounded to cents so the printed rows add up.
  const amounts = lines.map((line) =>
    nonnegative(line.quantity, "Line quantity")
      .times(nonnegative(line.rate, "Line rate"))
      .toDecimalPlaces(2),
  );
  const subtotal = amounts.reduce(
    (sum, amount) => sum.plus(amount),
    new Decimal(0),
  );
  const taxable = amounts.reduce(
    (sum, amount, i) => (lines[i].taxable ? sum.plus(amount) : sum),
    new Decimal(0),
  );
  const tax = taxable.times(rate).div(100).toDecimalPlaces(2);
  const total = subtotal.plus(tax);
  const payments = nonnegative(paid, "Payments received").toDecimalPlaces(2);
  const difference = total.minus(payments);
  return {
    amounts: amounts.map(finiteNumber),
    subtotal: finiteNumber(subtotal),
    tax: finiteNumber(tax),
    total: finiteNumber(total),
    balance: finiteNumber(Decimal.max(0, difference)),
    credit: finiteNumber(Decimal.max(0, difference.negated())),
  };
}
