// Unit tests for the single persistence layer (src/lib/persistence.ts). No jsdom is
// configured for this project's Vitest environment (see jsonRoundTrip.test.ts's note), so
// `window`/`localStorage` are polyfilled here with a minimal in-memory mock that can also
// simulate failure modes (quota exceeded, unavailable storage, corrupted data) that a real
// browser rarely produces on demand.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Estimate } from "./types";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

let mockStorage: MemoryStorage;

beforeEach(() => {
  mockStorage = new MemoryStorage();
  vi.stubGlobal("window", { localStorage: mockStorage });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function sampleEstimate(overrides: Partial<Estimate> = {}): Estimate {
  const now = new Date().toISOString();
  return {
    id: "est_1",
    estimateNumber: "EST-1001",
    projectType: "driveway",
    projectName: "Smith Driveway",
    customerName: "Smith Residence",
    sections: [{ id: "sec_1", name: "Section 1", lengthFt: 20, widthFt: 20, thicknessIn: 4 }],
    allowancePercent: 8,
    rounding: "quarter",
    costs: { readyMixRatePerYd3: 165, laborCost: 1000, formsCost: 200, reinforcementCost: 200, equipmentCost: 100, otherCost: 0 },
    overheadPercent: 15,
    targetMarginPercent: 30,
    sellingPrice: 5000,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("persistence: current estimate save/load", () => {
  it("1. a current estimate saves successfully", async () => {
    const { repository } = await import("./persistence");
    const result = repository.saveCurrentEstimate({ estimate: sampleEstimate(), actual: null, savedAt: new Date().toISOString() });
    expect(result.ok).toBe(true);
  });

  it("2. only one current estimate exists (a second save overwrites, not appends)", async () => {
    const { repository, CURRENT_ESTIMATE_KEY } = await import("./persistence");
    repository.saveCurrentEstimate({ estimate: sampleEstimate({ id: "est_1" }), actual: null, savedAt: new Date().toISOString() });
    repository.saveCurrentEstimate({ estimate: sampleEstimate({ id: "est_2" }), actual: null, savedAt: new Date().toISOString() });
    const raw = mockStorage.getItem(CURRENT_ESTIMATE_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed.estimate.id).toBe("est_2");
    // Exactly one record under one key -- no array, no second key holding a prior version.
    expect(Array.isArray(parsed.estimate)).toBe(false);
  });

  it("3. editing replaces the current saved state", async () => {
    const { repository } = await import("./persistence");
    repository.saveCurrentEstimate({ estimate: sampleEstimate({ sellingPrice: 5000 }), actual: null, savedAt: new Date().toISOString() });
    repository.saveCurrentEstimate({ estimate: sampleEstimate({ sellingPrice: 7500 }), actual: null, savedAt: new Date().toISOString() });
    const loaded = repository.loadCurrentEstimate();
    expect(loaded?.estimate.sellingPrice).toBe(7500);
  });

  it("4. reloading (simulating refresh) restores the exact latest state", async () => {
    const { repository } = await import("./persistence");
    const estimate = sampleEstimate({ projectName: "Jones Patio", customerName: "Jones Residence" });
    repository.saveCurrentEstimate({ estimate, actual: null, savedAt: new Date().toISOString() });
    // Fresh module import simulates a fresh page load reading only from the (persisted) mock store.
    vi.resetModules();
    const { repository: freshRepository } = await import("./persistence");
    const loaded = freshRepository.loadCurrentEstimate();
    expect(loaded?.estimate).toEqual(estimate);
  });

  it("5-7. business profile, catalog and templates are unaffected by replacing the current estimate", async () => {
    const { repository, defaultBusinessProfile } = await import("./persistence");
    const profile = { ...defaultBusinessProfile(), businessName: "Acme Concrete" };
    repository.saveBusinessProfile(profile);
    repository.saveCatalog({ materials: [{ id: "c1", kind: "readyMix", name: "Mix", unit: "yd³", unitCost: 165 }], laborRates: [], equipment: [] });
    repository.saveTemplates([{ id: "t1", name: "Tpl", projectType: "slab", sections: [{ id: "s1", name: "S", lengthFt: 10, widthFt: 10, thicknessIn: 4 }], allowancePercent: 8, rounding: "quarter", defaultCosts: { readyMixRatePerYd3: 165, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 }, currentSellingPrice: 1000, createdAt: new Date().toISOString() }]);

    repository.saveCurrentEstimate({ estimate: sampleEstimate({ id: "est_a" }), actual: null, savedAt: new Date().toISOString() });
    repository.saveCurrentEstimate({ estimate: sampleEstimate({ id: "est_b" }), actual: null, savedAt: new Date().toISOString() });

    expect(repository.loadBusinessProfile()).toEqual(profile);
    expect(repository.loadCatalog().materials).toHaveLength(1);
    expect(repository.loadTemplates()).toHaveLength(1);
  });

  it("8. malformed JSON in the current-estimate key does not crash the application", async () => {
    const { repository, CURRENT_ESTIMATE_KEY } = await import("./persistence");
    mockStorage.setItem(CURRENT_ESTIMATE_KEY, "{not valid json,,,");
    expect(() => repository.loadCurrentEstimate()).not.toThrow();
    expect(repository.loadCurrentEstimate()).toBeNull();
  });

  it("8b. malformed JSON does not leave a corrupt diagnostic payload silently mistaken for real data", async () => {
    const { repository, CURRENT_ESTIMATE_KEY, hasCorruptCurrentEstimateData } = await import("./persistence");
    mockStorage.setItem(CURRENT_ESTIMATE_KEY, "{not valid json,,,");
    repository.loadCurrentEstimate();
    expect(hasCorruptCurrentEstimateData()).toBe(true);
  });

  it("9. an unsafe/invalid shape (missing required fields) is rejected, not partially loaded", async () => {
    const { repository, CURRENT_ESTIMATE_KEY } = await import("./persistence");
    mockStorage.setItem(CURRENT_ESTIMATE_KEY, JSON.stringify({ estimate: { id: "est_1", projectName: "Missing lots of fields" }, actual: null, savedAt: new Date().toISOString() }));
    expect(repository.loadCurrentEstimate()).toBeNull();
  });

  it("9b. an estimate with an invalid status value is rejected", async () => {
    const { repository, CURRENT_ESTIMATE_KEY } = await import("./persistence");
    const bad = { ...sampleEstimate(), status: "archived-forever" };
    mockStorage.setItem(CURRENT_ESTIMATE_KEY, JSON.stringify({ estimate: bad, actual: null, savedAt: new Date().toISOString() }));
    expect(repository.loadCurrentEstimate()).toBeNull();
  });

  it("10. QuotaExceededError on write produces a visible, specific failure result", async () => {
    const { repository } = await import("./persistence");
    const quotaError = new DOMException("quota", "QuotaExceededError");
    vi.spyOn(mockStorage, "setItem").mockImplementation(() => {
      throw quotaError;
    });
    const result = repository.saveCurrentEstimate({ estimate: sampleEstimate(), actual: null, savedAt: new Date().toISOString() });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("quota-exceeded");
      expect(result.message).toMatch(/storage is full/i);
    }
  });

  it("11. unavailable storage (no window.localStorage) is handled without throwing", async () => {
    vi.stubGlobal("window", {});
    const { repository } = await import("./persistence");
    expect(repository.isStorageAvailable()).toBe(false);
    const result = repository.saveCurrentEstimate({ estimate: sampleEstimate(), actual: null, savedAt: new Date().toISOString() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("unavailable");
    expect(repository.loadCurrentEstimate()).toBeNull();
  });

  it("11b. a localStorage that throws on every access (e.g. Safari private mode) is treated as unavailable", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new DOMException("blocked", "SecurityError");
        },
        setItem: () => {
          throw new DOMException("blocked", "SecurityError");
        },
        removeItem: () => {
          throw new DOMException("blocked", "SecurityError");
        },
      },
    });
    const { repository } = await import("./persistence");
    expect(repository.isStorageAvailable()).toBe(false);
    expect(repository.loadCurrentEstimate()).toBeNull();
  });

  it("clearCurrentEstimate removes the record", async () => {
    const { repository } = await import("./persistence");
    repository.saveCurrentEstimate({ estimate: sampleEstimate(), actual: null, savedAt: new Date().toISOString() });
    expect(repository.loadCurrentEstimate()).not.toBeNull();
    repository.clearCurrentEstimate();
    expect(repository.loadCurrentEstimate()).toBeNull();
  });
});

describe("persistence: legacy migration", () => {
  it("is a no-op (not-needed) when no legacy key exists", async () => {
    const { migrateLegacyDataIfNeeded } = await import("./persistence");
    const record = migrateLegacyDataIfNeeded();
    expect(record.status).toBe("not-needed");
  });

  it("migrates the most-recently-updated real (non-sample) legacy estimate into the current-estimate key", async () => {
    const { LEGACY_WORKSPACE_KEY, migrateLegacyDataIfNeeded, repository } = await import("./persistence");
    const older = sampleEstimate({ id: "old", updatedAt: "2024-01-01T00:00:00.000Z" });
    const newer = sampleEstimate({ id: "newer", updatedAt: "2024-06-01T00:00:00.000Z", projectName: "Newer Job" });
    mockStorage.setItem(
      LEGACY_WORKSPACE_KEY,
      JSON.stringify({ schemaVersion: 1, estimates: [older, newer], projects: [], catalog: [], laborRates: [], equipment: [], templates: [] }),
    );
    const record = migrateLegacyDataIfNeeded();
    expect(record.status).toBe("migrated");
    expect(record.sourceEstimateId).toBe("newer");
    expect(repository.loadCurrentEstimate()?.estimate.projectName).toBe("Newer Job");
  });

  it("never runs twice -- re-running after a migrated record is a no-op and does not duplicate or overwrite", async () => {
    const { LEGACY_WORKSPACE_KEY, migrateLegacyDataIfNeeded, repository } = await import("./persistence");
    mockStorage.setItem(LEGACY_WORKSPACE_KEY, JSON.stringify({ schemaVersion: 1, estimates: [sampleEstimate({ id: "first" })], projects: [] }));
    migrateLegacyDataIfNeeded();
    // Simulate the user then creating their own new current estimate under the new model.
    repository.saveCurrentEstimate({ estimate: sampleEstimate({ id: "users-own" }), actual: null, savedAt: new Date().toISOString() });
    const second = migrateLegacyDataIfNeeded();
    expect(second.status).toBe("migrated"); // returns the stored record, doesn't re-run
    expect(repository.loadCurrentEstimate()?.estimate.id).toBe("users-own");
  });

  it("never deletes the legacy key", async () => {
    const { LEGACY_WORKSPACE_KEY, migrateLegacyDataIfNeeded } = await import("./persistence");
    mockStorage.setItem(LEGACY_WORKSPACE_KEY, JSON.stringify({ schemaVersion: 1, estimates: [sampleEstimate()], projects: [] }));
    migrateLegacyDataIfNeeded();
    expect(mockStorage.getItem(LEGACY_WORKSPACE_KEY)).not.toBeNull();
  });

  it("does not overwrite a current estimate the user already created under the new model", async () => {
    const { LEGACY_WORKSPACE_KEY, migrateLegacyDataIfNeeded, repository } = await import("./persistence");
    repository.saveCurrentEstimate({ estimate: sampleEstimate({ id: "already-here" }), actual: null, savedAt: new Date().toISOString() });
    mockStorage.setItem(LEGACY_WORKSPACE_KEY, JSON.stringify({ schemaVersion: 1, estimates: [sampleEstimate({ id: "legacy" })], projects: [] }));
    const record = migrateLegacyDataIfNeeded();
    expect(record.status).toBe("not-needed");
    expect(repository.loadCurrentEstimate()?.estimate.id).toBe("already-here");
  });

  it("does not crash on non-JSON legacy data, and leaves it untouched for diagnostics", async () => {
    const { LEGACY_WORKSPACE_KEY, migrateLegacyDataIfNeeded } = await import("./persistence");
    mockStorage.setItem(LEGACY_WORKSPACE_KEY, "not json at all");
    expect(() => migrateLegacyDataIfNeeded()).not.toThrow();
    const record = migrateLegacyDataIfNeeded();
    expect(mockStorage.getItem(LEGACY_WORKSPACE_KEY)).toBe("not json at all");
  });
});
