import { describe, it, expect } from "vitest";
import { estimateToCsv, estimateToCsvRows, ESTIMATE_CSV_HEADERS } from "./estimateCsv";
import { calculateCost, calculateMargin } from "./calc";
import { combinedNetCubicYards, combinedOrderQuantity } from "./estimateMath";
import type { Estimate } from "./types";

function baseEstimate(overrides: Partial<Estimate> = {}): Estimate {
  const now = new Date("2026-01-15T00:00:00.000Z").toISOString();
  return {
    id: "est_1",
    estimateNumber: "EST-2026001",
    projectType: "driveway",
    projectName: "Smith Driveway",
    customerName: "Smith Residence",
    customerAddress: "142 Maple St",
    sections: [{ id: "sec_1", name: "Driveway", lengthFt: 80, widthFt: 18, thicknessIn: 4 }],
    allowancePercent: 8,
    rounding: "quarter",
    costs: { readyMixRatePerYd3: 165, laborCost: 3400, formsCost: 550, reinforcementCost: 950, equipmentCost: 750, otherCost: 0 },
    overheadPercent: 15,
    targetMarginPercent: 30,
    sellingPrice: 12470,
    status: "sent",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("estimateToCsvRows / estimateToCsv: normal export", () => {
  it("1. a normal estimate exports with the expected header and every section/cost-item row", () => {
    const estimate = baseEstimate();
    const rows = estimateToCsvRows(estimate);
    // 1 section row + 5 cost-item rows (baseEstimate's otherCost is 0, so "Other" is
    // correctly omitted -- see the dedicated zero-value test below).
    expect(rows).toHaveLength(6);
    const csv = estimateToCsv(estimate);
    expect(csv.split("\r\n")[0]).toBe(ESTIMATE_CSV_HEADERS.join(","));
  });

  it("a cost category that's exactly $0 is omitted from the export, but Ready mix always appears", () => {
    const estimate = baseEstimate({ costs: { readyMixRatePerYd3: 165, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 } });
    const rows = estimateToCsvRows(estimate);
    const labelIdx = ESTIMATE_CSV_HEADERS.indexOf("Cost item");
    const labels = rows.map((r) => r[labelIdx]);
    // 1 section row (blank "Cost item") + exactly one cost-item row: Ready mix.
    expect(rows).toHaveLength(2);
    expect(labels).toContain("Ready mix");
    expect(labels).not.toContain("Labor");
    expect(labels).not.toContain("Forms");
    expect(labels).not.toContain("Reinforcement");
    expect(labels).not.toContain("Equipment");
    expect(labels).not.toContain("Other");
  });

  it("9-10. multi-section rows have correct totals that reconcile exactly with the app's own math", () => {
    const estimate = baseEstimate({
      sections: [
        { id: "s1", name: "Driveway", lengthFt: 60, widthFt: 18, thicknessIn: 4 },
        { id: "s2", name: "Apron", lengthFt: 10, widthFt: 12, thicknessIn: 4 },
      ],
    });
    const rows = estimateToCsvRows(estimate);
    // 2 sections + 5 cost items (baseEstimate's otherCost is 0, omitted) = 7 rows.
    expect(rows).toHaveLength(7);

    const netCubicYards = combinedNetCubicYards(estimate.sections);
    const orderQuantityYd3 = combinedOrderQuantity(estimate.sections, estimate.allowancePercent, estimate.rounding);
    const cost = calculateCost({ areaSqFt: 0, netCubicFeet: 0, netCubicYards, orderQuantityYd3 }, estimate.costs, estimate.overheadPercent);
    const profit = estimate.sellingPrice - cost.trueCost;
    const margin = calculateMargin(estimate.sellingPrice, cost.trueCost)!;

    const headerIdx = (name: string) => ESTIMATE_CSV_HEADERS.indexOf(name as any);
    for (const row of rows) {
      expect(row[headerIdx("Direct cost")]).toBe(cost.directCost.toFixed(2));
      expect(row[headerIdx("Overhead")]).toBe(cost.overheadAmount.toFixed(2));
      expect(row[headerIdx("True cost")]).toBe(cost.trueCost.toFixed(2));
      expect(row[headerIdx("Selling price")]).toBe(estimate.sellingPrice.toFixed(2));
      expect(row[headerIdx("Profit")]).toBe(profit.toFixed(2));
      expect(row[headerIdx("Margin")]).toBe((margin * 100).toFixed(1) + "%");
    }

    // The sum of the individual cost-item "Line total" cells reconciles with directCost.
    const costItemRows = rows.slice(2); // after the 2 section rows
    const lineTotalIdx = headerIdx("Line total");
    const sumOfLineTotals = costItemRows.reduce((sum, r) => sum + parseFloat(r[lineTotalIdx]), 0);
    expect(sumOfLineTotals).toBeCloseTo(cost.directCost, 2);
  });

  it("7. negative-number cost fields (already validated elsewhere) still export a correct, non-crashing value", () => {
    // The UI blocks negative costs before they can be saved (see validation.ts), but this
    // module must not crash if it's ever handed one -- it just reports what calc.ts computes.
    const estimate = baseEstimate({ costs: { ...baseEstimate().costs, otherCost: -50 } });
    expect(() => estimateToCsvRows(estimate)).not.toThrow();
  });
});

describe("estimateToCsv: escaping", () => {
  it("2. commas in customer/project names are escaped", () => {
    const estimate = baseEstimate({ customerName: "Smith, John" });
    const csv = estimateToCsv(estimate);
    expect(csv).toContain('"Smith, John"');
  });

  it("3. quotes in project names are escaped per CSV rules (doubled, then wrapped)", () => {
    const estimate = baseEstimate({ projectName: '12" Slab Job', customerAddress: undefined });
    const csv = estimateToCsv(estimate);
    expect(csv).toContain('"12"" Slab Job"');
  });

  it("4. newlines in notes are escaped (quoted, not split into extra rows)", () => {
    const estimate = baseEstimate({ notes: "Line one\nLine two" });
    const csv = estimateToCsv(estimate);
    const rows = estimateToCsvRows(estimate);
    expect(rows[0][rows[0].length - 1]).toBe("Line one\nLine two");
    expect(csv).toContain('"Line one\nLine two"');
  });

  it("5. unicode customer names are preserved", () => {
    const estimate = baseEstimate({ customerName: "José Núñez" });
    const csv = estimateToCsv(estimate);
    expect(csv).toContain("José Núñez");
  });

  it("6. blank optional fields (no notes, no address) preserve column alignment", () => {
    const estimate = baseEstimate({ notes: undefined, customerAddress: undefined });
    const rows = estimateToCsvRows(estimate);
    for (const row of rows) {
      expect(row).toHaveLength(ESTIMATE_CSV_HEADERS.length);
    }
  });

  it("8. formula-injection strings in customer/project/notes fields are neutralized", () => {
    const estimate = baseEstimate({ customerName: "=cmd|'/c calc'!A1", notes: "+1+1" });
    const csv = estimateToCsv(estimate);
    expect(csv).not.toContain(",=cmd|");
    expect(csv).toContain("'=cmd|'/c calc'!A1");
    expect(csv).toContain("'+1+1");
  });
});
