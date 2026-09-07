// Regression test for CCP-004: estimates CSV export used a bare `.join(",")` with no field
// escaping — a customerName or projectName containing a comma silently shifted every
// column after it, corrupting the exported file. This locks in RFC 4180 escaping.
import { describe, it, expect } from "vitest";
import { csvField, csvRow, neutralizeFormulaInjection, toCsv } from "./csv";

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

  it("preserves unicode customer names", () => {
    expect(csvField("José Núñez")).toBe("José Núñez");
    expect(csvField("北京混凝土公司")).toBe("北京混凝土公司");
  });
});

describe("neutralizeFormulaInjection / spreadsheet formula injection", () => {
  it("prefixes a value starting with = so it can't execute as a formula", () => {
    expect(neutralizeFormulaInjection("=cmd|'/c calc'!A1")).toBe("'=cmd|'/c calc'!A1");
  });
  it("prefixes values starting with +, -, @, tab or carriage return", () => {
    expect(neutralizeFormulaInjection("+1+1")).toBe("'+1+1");
    expect(neutralizeFormulaInjection("-1+1")).toBe("'-1+1");
    expect(neutralizeFormulaInjection("@SUM(A1:A9)")).toBe("'@SUM(A1:A9)");
    expect(neutralizeFormulaInjection("\tHIDDEN")).toBe("'\tHIDDEN");
    expect(neutralizeFormulaInjection("\rHIDDEN")).toBe("'\rHIDDEN");
  });
  it("leaves an ordinary value (including one merely containing = later) untouched", () => {
    expect(neutralizeFormulaInjection("Smith Driveway")).toBe("Smith Driveway");
    expect(neutralizeFormulaInjection("A=B")).toBe("A=B");
  });
  it("leaves a negative-number-looking numeric string alone at the csvField level only if never fed through neutralization directly by callers that want real negatives -- csvField itself always neutralizes", () => {
    // csvField is used for free-text fields (names/notes), not for pre-formatted numeric
    // strings -- callers pass numbers through toFixed()/String() into their own columns,
    // never through csvField, so a legitimate "-500" cost never gets this prefix in practice.
    expect(csvField("-500")).toBe("'-500");
  });
  it("csvField applies neutralization before quoting, so an injection attempt that also contains a comma is both safe and correctly quoted", () => {
    expect(csvField("=1,2")).toBe(`"'=1,2"`);
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
