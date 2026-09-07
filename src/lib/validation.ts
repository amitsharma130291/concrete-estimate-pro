// Shared blocking-validation helpers. Distinct from calc.ts's safe()/safeD(), which exist
// so a bad value degrades to a defined, non-crashing calculation result — these helpers
// exist so the UI can tell a blank/negative required field apart from an intentionally
// entered 0, and refuse to calculate/save/export until it's fixed, instead of silently
// treating it as $0 or 0 ft.

/** Parses a raw <input type="number"> string, returning NaN for a blank field so "cleared
 * the field" is distinguishable from "typed 0" -- unlike the app's usual
 * `parseFloat(e.target.value) || 0` pattern, which collapses both to the same value. */
export function parseRequiredNumber(raw: string): number {
  return raw === "" ? NaN : parseFloat(raw);
}

/** Validation message for a required numeric field, or null when the value is valid.
 * `min` defaults to 0 (the overwhelming majority of fields in this app are quantities or
 * dollar amounts, which are never legitimately negative); pass `min: -Infinity` to allow
 * negative values on the rare field where that's meaningful. */
export function numberFieldError(value: number, opts: { min?: number; label?: string } = {}): string | null {
  const min = opts.min ?? 0;
  if (Number.isNaN(value)) return "Required.";
  if (!Number.isFinite(value)) return "Enter a valid number.";
  if (value < min) return min === 0 ? "Must be zero or greater." : `Must be ${min} or greater.`;
  return null;
}

/** True when every section's length/width/thickness is present and non-negative -- shared
 * by Estimates/Projects/Templates (all built on SectionsEditor.tsx) to gate Continue/Save. */
export function sectionsAreValid(sections: { lengthFt: number; widthFt: number; thicknessIn: number }[]): boolean {
  return (
    sections.length > 0 &&
    sections.every((s) => numberFieldError(s.lengthFt) === null && numberFieldError(s.widthFt) === null && numberFieldError(s.thicknessIn) === null)
  );
}

/** Validation for a target-margin percent field. Rejects 100+ explicitly (a 100%+ target
 * margin is mathematically impossible to price for -- required selling price would be
 * infinite or negative) instead of the app's older pattern of silently clamping the typed
 * value to 99 in the onChange handler, which hid the mistake instead of surfacing it. */
export function targetMarginError(value: number): string | null {
  if (Number.isNaN(value)) return "Required.";
  if (!Number.isFinite(value)) return "Enter a valid number.";
  if (value < 0) return "Must be zero or greater.";
  if (value >= 100) return "Must be less than 100%.";
  return null;
}
