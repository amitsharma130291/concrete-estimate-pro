// Explicit before/after regression test for the decimal-safe currency-arithmetic migration
// (src/lib/calc.ts, src/lib/estimateMath.ts). beforeSnapshot.json was captured from the
// pre-migration (raw IEEE-754 double) implementation; afterSnapshot.json from the
// post-migration (Decimal.js-internal) implementation, both run across the identical
// 5,070-case battery (50 golden fixtures + 20 third-path fixtures + 5,000 fixed-seed
// fast-check-generated cases spanning the realistic input domain). This test diffs them
// directly, proving numeric equivalence rather than merely asserting each independently.
import { describe, it, expect } from "vitest";
import beforeSnapshot from "./beforeSnapshot.json";
import afterSnapshot from "./afterSnapshot.json";

const REL_TOL = 1e-9;
const ABS_TOL = 1e-6;

function close(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  if (Object.is(a, b)) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
  const diff = Math.abs(a - b);
  return diff <= ABS_TOL || diff <= REL_TOL * Math.max(Math.abs(a), Math.abs(b));
}

function diffPaths(before: unknown, after: unknown, path: string, out: string[]) {
  if (typeof before === "number" || before === null) {
    if (!close(before as number | null, after as number | null)) {
      out.push(`${path}: before=${before} after=${after}`);
    }
    return;
  }
  if (typeof before === "boolean") {
    if (before !== after) out.push(`${path}: before=${before} after=${after}`);
    return;
  }
  if (typeof before === "object" && before !== null) {
    for (const key of Object.keys(before as Record<string, unknown>)) {
      diffPaths((before as any)[key], (after as any)?.[key], `${path}.${key}`, out);
    }
  }
}

describe("decimal-safe migration: before vs after numeric equivalence", () => {
  it("snapshot files have the same case count and same case ordering", () => {
    expect(beforeSnapshot.length).toBe(5070);
    expect(afterSnapshot.length).toBe(beforeSnapshot.length);
    for (let i = 0; i < beforeSnapshot.length; i++) {
      expect(afterSnapshot[i].name).toBe(beforeSnapshot[i].name);
      expect(afterSnapshot[i].source).toBe(beforeSnapshot[i].source);
    }
  });

  it("every one of the 5,070 cases produces numerically equivalent output before and after migration", () => {
    const allDiffs: string[] = [];
    for (let i = 0; i < beforeSnapshot.length; i++) {
      const b = beforeSnapshot[i];
      const a = afterSnapshot[i];
      const caseDiffs: string[] = [];
      diffPaths(b.output, a.output, `${b.source}/${b.name}`, caseDiffs);
      allDiffs.push(...caseDiffs);
    }
    if (allDiffs.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`${allDiffs.length} diverging values:\n${allDiffs.slice(0, 20).join("\n")}`);
    }
    expect(allDiffs).toEqual([]);
  });

  it("golden fixtures (the 50 hand-picked, independently-oracle-verified cases) are unaffected", () => {
    const beforeGolden = beforeSnapshot.filter((r) => r.source === "golden");
    const afterGolden = afterSnapshot.filter((r) => r.source === "golden");
    expect(beforeGolden.length).toBe(50);
    for (let i = 0; i < beforeGolden.length; i++) {
      const diffs: string[] = [];
      diffPaths(beforeGolden[i].output, afterGolden[i].output, beforeGolden[i].name, diffs);
      expect(diffs).toEqual([]);
    }
  });

  it("third-path fixtures (Python/decimal-verified) are unaffected", () => {
    const beforeTP = beforeSnapshot.filter((r) => r.source === "thirdpath");
    const afterTP = afterSnapshot.filter((r) => r.source === "thirdpath");
    expect(beforeTP.length).toBe(20);
    for (let i = 0; i < beforeTP.length; i++) {
      const diffs: string[] = [];
      diffPaths(beforeTP[i].output, afterTP[i].output, beforeTP[i].name, diffs);
      expect(diffs).toEqual([]);
    }
  });
});
