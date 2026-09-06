// Regression test for CCP-004: estimates CSV export used a bare `.join(",")` with no field
// escaping — a customerName or projectName containing a comma silently shifted every
// column after it, corrupting the exported file. This locks in RFC 4180 escaping.
import { describe, it, expect } from "vitest";
import { csvField, csvRow, toCsv } from "./csv";

describe("csvField", () => {
  it("passes plain values through unchanged", () => {
    expect(csvField("EST-1001")).toBe("EST-1001");
    expect(csvField("Smith Driveway")).toBe("Smith Driveway");
  });

  it("quotes a value containing a comma (the confirmed CCP-004 defect case)", () => {
    expect(csvField("Smith, John")).toBe('"Smith, John"');
  });

  it("quotes and doubles internal double-quotes", () => {
    expect(csvField('12" Slab Job')).toBe('"12"" Slab Job"');
  });

  it("quotes a value containing a newline", () => {
    expect(csvField("Line1\nLine2")).toBe('"Line1\nLine2"');
  });
});

describe("csvRow / toCsv", () => {
  it("a comma-containing field no longer shifts subsequent columns", () => {
    const row = csvRow(["EST-1001", "123 Main St, Suite 4", "Smith, John", "sent", "3500"]);
    const fields = row.split(",");
    // With proper quoting the row round-trips to exactly 5 logical fields even though the
    // naive split-on-comma below oversplits the quoted fields — the point is the quoted
    // commas are visibly wrapped, not silently merged into neighboring columns.
    expect(row).toContain('"123 Main St, Suite 4"');
    expect(row).toContain('"Smith, John"');
    expect(row.startsWith("EST-1001,")).toBe(true);
    expect(row.endsWith(",sent,3500")).toBe(true);
  });

  it("toCsv joins rows with CRLF per RFC 4180", () => {
    const csv = toCsv([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(csv).toBe("a,b\r\nc,d");
  });
});
