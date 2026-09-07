// Data-integrity round-trip testing for the business-data JSON backup/restore workflow.
// This exercises exportBackupJson/validateBackupImport as pure data transformations (no
// browser/localStorage -- jsdom is not configured for this project's vitest environment;
// the equivalent through-the-UI/localStorage path is a Playwright E2E concern, see
// tests/e2e). Deliberately excludes the current estimate: per the single-current-estimate
// product decision, the business-data backup only covers business profile, preferences,
// catalog and templates -- see persistence.ts's module doc comment on WorkspaceBackup.
import { describe, it, expect } from "vitest";
import { defaultBusinessProfile, defaultPreferences, emptyCatalogBundle, exportBackupJson, validateBackupImport, type CatalogBundle } from "../../src/lib/persistence";
import { buildSampleWorkspace } from "../../src/lib/sampleData";
import type { AppSettings, BusinessProfile, ProjectTemplate } from "../../src/lib/types";

function fullSampleBackupInput(): { businessProfile: BusinessProfile; preferences: AppSettings; catalog: CatalogBundle; templates: ProjectTemplate[] } {
  const sample = buildSampleWorkspace();
  return {
    businessProfile: { businessName: "Acme Concrete LLC", phone: "555-0100", email: "a@acme.test", address: "123 Main St" },
    preferences: defaultPreferences(),
    catalog: sample.catalog,
    templates: sample.templates,
  };
}

describe("Business-data JSON backup/restore round trip", () => {
  it("export a populated backup produces valid, parseable JSON", () => {
    const input = fullSampleBackupInput();
    const json = exportBackupJson(input);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("re-importing exported JSON validates ok and losslessly restores every collection", () => {
    const input = fullSampleBackupInput();
    const json = exportBackupJson(input);
    const result = validateBackupImport(json);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data).toBeDefined();
    const restored = result.data!;

    expect(restored.catalog).toEqual(input.catalog);
    expect(restored.templates).toEqual(input.templates);
    expect(restored.businessProfile).toEqual(input.businessProfile);
    expect(restored.preferences).toEqual(input.preferences);
  });

  it("re-exporting the restored data is stable (export -> import -> export produces the same data, modulo timestamp)", () => {
    const input = fullSampleBackupInput();
    const json1 = exportBackupJson(input);
    const restored = validateBackupImport(json1).data!;
    const json2 = exportBackupJson(restored);
    const obj1 = JSON.parse(json1);
    const obj2 = JSON.parse(json2);
    delete obj1.exportedAt;
    delete obj2.exportedAt;
    expect(obj2).toEqual(obj1);
  });

  it("malformed (non-JSON) file is rejected with a clear error, not a crash", () => {
    const result = validateBackupImport("{not valid json,,,");
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("valid JSON that isn't an object (array/primitive) is rejected", () => {
    expect(validateBackupImport("[1,2,3]").ok).toBe(false);
    expect(validateBackupImport("42").ok).toBe(false);
    expect(validateBackupImport('"just a string"').ok).toBe(false);
  });

  it("a collection field present but not an array is rejected, not silently coerced", () => {
    const result = validateBackupImport(JSON.stringify({ schemaVersion: 2, templates: "not-an-array" }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /templates/i.test(e))).toBe(true);
  });

  it("a malformed template inside an otherwise-valid array is rejected, not silently dropped or coerced", () => {
    const result = validateBackupImport(JSON.stringify({ schemaVersion: 2, templates: [{ id: "x" }] }));
    expect(result.ok).toBe(false);
  });

  it("empty backup round-trips cleanly (no data is not an error)", () => {
    const json = exportBackupJson({ businessProfile: defaultBusinessProfile(), preferences: defaultPreferences(), catalog: emptyCatalogBundle(), templates: [] });
    const result = validateBackupImport(json);
    expect(result.ok).toBe(true);
    expect(result.data!.templates).toEqual([]);
    expect(result.data!.catalog).toEqual(emptyCatalogBundle());
  });

  it("importing a file missing optional collections fills them from defaults (forward-compat)", () => {
    const partial = { schemaVersion: 2, businessProfile: defaultBusinessProfile() };
    const result = validateBackupImport(JSON.stringify(partial));
    expect(result.ok).toBe(true);
    expect(result.data!.preferences).toBeDefined();
    expect(result.data!.catalog).toEqual(emptyCatalogBundle());
    expect(result.data!.templates).toEqual([]);
  });

  it("does not include a current-estimate field at all -- this backup is business data only", () => {
    const input = fullSampleBackupInput();
    const json = exportBackupJson(input);
    const parsed = JSON.parse(json);
    expect(parsed.currentEstimate).toBeUndefined();
    expect(parsed.estimates).toBeUndefined();
    expect(parsed.projects).toBeUndefined();
  });
});
