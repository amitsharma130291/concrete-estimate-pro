// Data-integrity round-trip testing for the JSON backup/restore workflow, per the audit's
// 10-step procedure. This exercises exportWorkspaceJson/validateImport as pure data
// transformations (no browser/localStorage — jsdom is not configured for this project's
// vitest environment; the equivalent through-the-UI/localStorage path is a Playwright E2E
// concern, see tests/e2e).
import { describe, it, expect } from "vitest";
import { emptyWorkspace, exportWorkspaceJson, validateImport, defaultSettings } from "../../src/lib/storage";
import { buildSampleWorkspace } from "../../src/lib/sampleData";
import type { Workspace } from "../../src/lib/types";

function fullSampleWorkspace(): Workspace {
  const empty = emptyWorkspace();
  const sample = buildSampleWorkspace();
  return {
    ...empty,
    businessProfile: { businessName: "Acme Concrete LLC", phone: "555-0100", email: "a@acme.test", address: "123 Main St" },
    settings: defaultSettings(),
    ...sample,
  };
}

describe("JSON backup/restore round trip (10-step procedure)", () => {
  it("1-2. export a populated workspace produces valid, parseable JSON", () => {
    const ws = fullSampleWorkspace();
    const json = exportWorkspaceJson(ws);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("3-5. re-importing exported JSON validates ok and losslessly restores every collection", () => {
    const ws = fullSampleWorkspace();
    const json = exportWorkspaceJson(ws);
    const result = validateImport(json);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.workspace).toBeDefined();
    const restored = result.workspace!;

    expect(restored.catalog).toEqual(ws.catalog);
    expect(restored.laborRates).toEqual(ws.laborRates);
    expect(restored.equipment).toEqual(ws.equipment);
    expect(restored.templates).toEqual(ws.templates);
    expect(restored.projects).toEqual(ws.projects);
    expect(restored.estimates).toEqual(ws.estimates);
    expect(restored.actuals).toEqual(ws.actuals);
    expect(restored.businessProfile).toEqual(ws.businessProfile);
    expect(restored.settings).toEqual(ws.settings);
  });

  it("6. re-exporting the restored workspace is stable (export -> import -> export produces the same data, modulo timestamp)", () => {
    const ws = fullSampleWorkspace();
    const json1 = exportWorkspaceJson(ws);
    const restored = validateImport(json1).workspace!;
    const json2 = exportWorkspaceJson(restored);
    const obj1 = JSON.parse(json1);
    const obj2 = JSON.parse(json2);
    delete obj1.exportedAt;
    delete obj2.exportedAt;
    expect(obj2).toEqual(obj1);
  });

  it("7. malformed (non-JSON) file is rejected with a clear error, not a crash", () => {
    const result = validateImport("{not valid json,,,");
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("8. valid JSON that isn't an object (array/primitive) is rejected", () => {
    expect(validateImport("[1,2,3]").ok).toBe(false);
    expect(validateImport("42").ok).toBe(false);
    expect(validateImport('"just a string"').ok).toBe(false);
  });

  it("9. JSON object missing schemaVersion is rejected with a specific error", () => {
    const result = validateImport(JSON.stringify({ catalog: [] }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /schemaVersion/i.test(e))).toBe(true);
  });

  it("10. a collection field present but not an array is rejected per-field, not silently coerced", () => {
    const result = validateImport(JSON.stringify({ schemaVersion: 1, catalog: "not-an-array", estimates: [] }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /catalog/i.test(e))).toBe(true);
  });

  it("empty workspace round-trips cleanly (no data is not an error)", () => {
    const empty = emptyWorkspace();
    const json = exportWorkspaceJson(empty);
    const result = validateImport(json);
    expect(result.ok).toBe(true);
    expect(result.workspace!.catalog).toEqual([]);
  });

  it("importing a workspace missing newer fields fills them from defaults via migration (forward-compat)", () => {
    const partial = { schemaVersion: 1, catalog: [], estimates: [] };
    const result = validateImport(JSON.stringify(partial));
    expect(result.ok).toBe(true);
    expect(result.workspace!.settings).toBeDefined();
    expect(result.workspace!.businessProfile).toBeDefined();
    expect(result.workspace!.laborRates).toEqual([]);
  });
});
