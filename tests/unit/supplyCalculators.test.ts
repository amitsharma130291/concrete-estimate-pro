import { describe, expect, it } from "vitest";
import {
  invoiceTotals,
  materialPurchase,
  pourQuantity,
  supplierCost,
  type SupplierQuote,
} from "../../src/lib/supplyCalculators";
const quote: SupplierQuote = {
  quantity: 8,
  rate: 165,
  delivery: 150,
  shortLoad: 75,
  pump: 300,
  other: 0,
  taxPercent: 6,
};
describe("supplier order costing", () => {
  it("keeps cent-rounded displayed charges reconciled", () => {
    const r = supplierCost({
      ...quote,
      quantity: 3,
      rate: 0.335,
      delivery: 0,
      shortLoad: 0,
      pump: 0,
    });
    expect(r.material).toBe(1.01);
    expect(r.tax).toBe(0.06);
    expect(r.total).toBe(1.07);
  });
  it("rejects overflowing derived results", () => {
    expect(() =>
      supplierCost({ ...quote, quantity: Number.MAX_VALUE, rate: 2 }),
    ).toThrow("too large");
    expect(() =>
      pourQuantity(
        [{ length: Number.MAX_VALUE, width: 2, thickness: 324 }],
        0,
        "quarter",
      ),
    ).toThrow("too large");
  });
  it("reconciles material, fees and tax with the worked example", () => {
    expect(supplierCost(quote)).toEqual({
      material: 1320,
      fees: 525,
      subtotal: 1845,
      tax: 110.7,
      total: 1955.7,
      effectiveRate: 244.4625,
    });
  });
  it("can rank a higher material quote as the cheaper delivered order", () => {
    const a = supplierCost({
      ...quote,
      rate: 155,
      delivery: 250,
      shortLoad: 0,
      pump: 0,
      taxPercent: 0,
    });
    const b = supplierCost({
      ...quote,
      delivery: 100,
      shortLoad: 0,
      pump: 0,
      taxPercent: 0,
    });
    expect(a.total).toBe(1490);
    expect(b.total).toBe(1420);
    expect(b.effectiveRate).toBe(177.5);
  });
  it.each([0, -1, NaN, Infinity])(
    "rejects unusable quantity %s instead of showing a price",
    (quantity) => {
      expect(() => supplierCost({ ...quote, quantity })).toThrow();
    },
  );
  it("rejects invalid fees and tax", () => {
    expect(() => supplierCost({ ...quote, delivery: -1 })).toThrow();
    expect(() => supplierCost({ ...quote, taxPercent: 101 })).toThrow();
  });
});
describe("combined pours", () => {
  it("adds allowance and rounds once across the worked two-section pour", () => {
    const r = pourQuantity(
      [
        { length: 20, width: 10, thickness: 4 },
        { length: 30, width: 3, thickness: 4 },
      ],
      8,
      "quarter",
    );
    expect(r.net).toBeCloseTo(3.580246913580247);
    expect(r.order).toBe(4);
    expect(r.net + r.allowanceVolume + r.roundingVolume).toBeCloseTo(r.order);
  });
  it("does not round each small section independently", () => {
    expect(
      pourQuantity(
        [
          { length: 3, width: 3, thickness: 4 },
          { length: 3, width: 3, thickness: 4 },
        ],
        0,
        "quarter",
      ).order,
    ).toBe(0.25);
  });
  it("rejects missing and invalid section geometry", () => {
    expect(() => pourQuantity([], 0, "none")).toThrow();
    expect(() =>
      pourQuantity([{ length: 0, width: 3, thickness: 4 }], 0, "none"),
    ).toThrow();
  });
});
describe("material purchases", () => {
  it("rounds each material to its own purchase increment", () => {
    expect(
      materialPurchase({
        quantity: 5,
        waste: 8,
        packSize: 0.25,
        unitCost: 165,
      }),
    ).toEqual({ order: 5.5, cost: 907.5 });
    expect(
      materialPurchase({ quantity: 120, waste: 10, packSize: 8, unitCost: 2 }),
    ).toEqual({ order: 136, cost: 272 });
    expect(
      materialPurchase({
        quantity: 400,
        waste: 5,
        packSize: 20,
        unitCost: 0.8,
      }),
    ).toEqual({ order: 420, cost: 336 });
  });
  it("retains exact-increment quantities and allows zero requirements", () => {
    expect(
      materialPurchase({ quantity: 132, waste: 0, packSize: 1, unitCost: 2 })
        .order,
    ).toBe(132);
    expect(
      materialPurchase({ quantity: 0, waste: 8, packSize: 20, unitCost: 2 })
        .cost,
    ).toBe(0);
  });
  it("requires a valid increment", () => {
    expect(() =>
      materialPurchase({ quantity: 1, waste: 0, packSize: 0, unitCost: 2 }),
    ).toThrow();
  });
});
describe("invoice reconciliation", () => {
  it("taxes selected lines and subtracts received deposits", () => {
    expect(
      invoiceTotals(
        [
          { quantity: 12, rate: 200, taxable: true },
          { quantity: 1, rate: 3000, taxable: false },
          { quantity: 1, rate: 600, taxable: false },
        ],
        6,
        2000,
      ),
    ).toEqual({
      amounts: [2400, 3000, 600],
      subtotal: 6000,
      tax: 144,
      total: 6144,
      balance: 4144,
      credit: 0,
    });
  });
  it("rounds lines to cents before totaling and reports overpayment separately", () => {
    expect(
      invoiceTotals(
        [
          { quantity: 3, rate: 0.335, taxable: true },
          { quantity: 1, rate: 0.335, taxable: false },
        ],
        6,
        2,
      ),
    ).toEqual({
      amounts: [1.01, 0.34],
      subtotal: 1.35,
      tax: 0.06,
      total: 1.41,
      balance: 0,
      credit: 0.59,
    });
  });
  it("rejects blanks and negative received payments", () => {
    expect(() =>
      invoiceTotals([{ quantity: NaN, rate: 2, taxable: false }], 0, 0),
    ).toThrow();
    expect(() => invoiceTotals([], 0, -1)).toThrow();
  });
});
