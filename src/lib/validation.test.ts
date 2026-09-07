import { describe, expect, it } from "vitest";
import { numberFieldError, parseRequiredNumber, sectionsAreValid, targetMarginError } from "./validation";

describe("parseRequiredNumber", () => {
  it("returns NaN for a blank string", () => {
    expect(Number.isNaN(parseRequiredNumber(""))).toBe(true);
  });
  it("parses a numeric string", () => {
    expect(parseRequiredNumber("42.5")).toBe(42.5);
  });
  it("parses a negative numeric string", () => {
    expect(parseRequiredNumber("-10")).toBe(-10);
  });
});

describe("numberFieldError", () => {
  it("requires a value (rejects NaN, e.g. from a blank field)", () => {
    expect(numberFieldError(NaN)).toMatch(/required/i);
  });
  it("rejects Infinity", () => {
    expect(numberFieldError(Infinity)).toMatch(/valid number/i);
  });
  it("rejects a negative value by default", () => {
    expect(numberFieldError(-1)).toMatch(/zero or greater/i);
  });
  it("accepts exactly zero", () => {
    expect(numberFieldError(0)).toBeNull();
  });
  it("accepts a positive value", () => {
    expect(numberFieldError(165)).toBeNull();
  });
  it("respects a custom min", () => {
    expect(numberFieldError(-50, { min: -100 })).toBeNull();
    expect(numberFieldError(-150, { min: -100 })).toMatch(/-100 or greater/);
  });
});

describe("targetMarginError", () => {
  it("requires a value", () => {
    expect(targetMarginError(NaN)).toMatch(/required/i);
  });
  it("rejects a negative margin", () => {
    expect(targetMarginError(-5)).toMatch(/zero or greater/i);
  });
  it("accepts zero", () => {
    expect(targetMarginError(0)).toBeNull();
  });
  it("accepts a normal margin like 30%", () => {
    expect(targetMarginError(30)).toBeNull();
  });
  it("accepts up to just under 100%", () => {
    expect(targetMarginError(99.9)).toBeNull();
  });
  it("rejects exactly 100% (mathematically impossible to price for)", () => {
    expect(targetMarginError(100)).toMatch(/less than 100/i);
  });
  it("rejects above 100%", () => {
    expect(targetMarginError(150)).toMatch(/less than 100/i);
  });
});

describe("sectionsAreValid", () => {
  it("rejects an empty section list", () => {
    expect(sectionsAreValid([])).toBe(false);
  });
  it("accepts a section with all-zero dimensions (zero is a valid, non-blank entry)", () => {
    expect(sectionsAreValid([{ lengthFt: 0, widthFt: 0, thicknessIn: 0 }])).toBe(true);
  });
  it("accepts a normal section", () => {
    expect(sectionsAreValid([{ lengthFt: 20, widthFt: 10, thicknessIn: 4 }])).toBe(true);
  });
  it("rejects a section with a blank (NaN) field", () => {
    expect(sectionsAreValid([{ lengthFt: NaN, widthFt: 10, thicknessIn: 4 }])).toBe(false);
  });
  it("rejects a section with a negative field", () => {
    expect(sectionsAreValid([{ lengthFt: 20, widthFt: -10, thicknessIn: 4 }])).toBe(false);
  });
  it("rejects if any section in a multi-section list is invalid", () => {
    expect(
      sectionsAreValid([
        { lengthFt: 20, widthFt: 10, thicknessIn: 4 },
        { lengthFt: NaN, widthFt: 10, thicknessIn: 4 },
      ]),
    ).toBe(false);
  });
});
