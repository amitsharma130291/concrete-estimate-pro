import type { Page } from "@playwright/test";

export const STORAGE_KEYS = {
  currentEstimate: "ccp.current-estimate.v1",
  businessProfile: "ccp.business-profile.v1",
  catalog: "ccp.catalog.v1",
  templates: "ccp.templates.v1",
  preferences: "ccp.preferences.v1",
  migration: "ccp.storage-migration.v1",
  legacyWorkspace: "cep:workspace:v1",
} as const;

export async function resetWorkspace(page: Page, route = "/app") {
  await page.goto(route);
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(route);
}

/** Reads back the current estimate record (`{ estimate, actual, savedAt }`) directly from
 * localStorage, or null if none is saved. */
export async function getCurrentEstimateRecord(page: Page): Promise<any> {
  const raw = await page.evaluate((k) => window.localStorage.getItem(k), STORAGE_KEYS.currentEstimate);
  return raw ? JSON.parse(raw) : null;
}

export async function getCurrentEstimate(page: Page): Promise<any> {
  const record = await getCurrentEstimateRecord(page);
  return record?.estimate ?? null;
}

const DEFAULT_PREFERENCES = {
  defaultOverheadPercent: 15,
  defaultTargetMarginPercent: 30,
  defaultLoadedLaborRate: 36,
  defaultAllowancePercent: 8,
  defaultRounding: "quarter",
  estimateValidityDays: 30,
  defaultNotes: "",
  units: "imperial",
  currency: "USD",
};

function blankSection(overrides: Record<string, unknown> = {}) {
  return { id: "sec_seed", name: "Section 1", lengthFt: 20, widthFt: 20, thicknessIn: 4, ...overrides };
}

/** Seeds a full, valid current-estimate record directly into localStorage -- bypasses the
 * UI entirely, for tests that need a pre-existing estimate to act on (edit/replace/PDF/CSV
 * flows) without re-driving the whole wizard first. Fields not passed fall back to a
 * complete, valid Estimate so persistence.ts's parseEstimate() never rejects it. */
export async function seedCurrentEstimate(page: Page, estimate: Record<string, unknown> = {}, route = "/app") {
  await page.goto(route);
  const now = new Date().toISOString();
  const full = {
    id: "est_seed",
    estimateNumber: "EST-SEED1",
    projectType: "driveway",
    projectName: "Seeded Estimate",
    customerName: "Seed Customer",
    sections: [blankSection()],
    allowancePercent: 8,
    rounding: "quarter",
    costs: { readyMixRatePerYd3: 165, laborCost: 1000, formsCost: 200, reinforcementCost: 200, equipmentCost: 100, otherCost: 0 },
    overheadPercent: 15,
    targetMarginPercent: 30,
    sellingPrice: 5000,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    ...estimate,
  };
  await page.evaluate(
    ({ key, record }) => window.localStorage.setItem(key, JSON.stringify(record)),
    { key: STORAGE_KEYS.currentEstimate, record: { estimate: full, actual: null, savedAt: now } },
  );
  await page.goto(route);
  return full;
}

export async function seedTemplates(page: Page, templates: Record<string, unknown>[], route = "/app") {
  await page.goto(route);
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEYS.templates, value: templates });
  await page.goto(route);
}

export async function seedCatalog(page: Page, catalog: { materials?: unknown[]; laborRates?: unknown[]; equipment?: unknown[] }, route = "/app") {
  await page.goto(route);
  const full = { materials: [], laborRates: [], equipment: [], ...catalog };
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEYS.catalog, value: full });
  await page.goto(route);
}

export async function seedPreferences(page: Page, preferences: Record<string, unknown>, route = "/app") {
  await page.goto(route);
  const full = { ...DEFAULT_PREFERENCES, ...preferences };
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEYS.preferences, value: full });
  await page.goto(route);
}

export async function seedBusinessProfile(page: Page, profile: Record<string, unknown>, route = "/app") {
  await page.goto(route);
  const full = { businessName: "", phone: "", email: "", address: "", ...profile };
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEYS.businessProfile, value: full });
  await page.goto(route);
}

// ---------------------------------------------------------------------------------------
// Legacy-shaped compatibility helpers for older spec files written against the pre-v2
// single-blob `cep:workspace:v1` model. Reconstructs (getWorkspace) / decomposes
// (seedWorkspace) a workspace-shaped object across the new per-concern keys, so tests that
// only ever READ `ws.catalog`/`ws.templates`/`ws.settings`/`ws.businessProfile` (data that
// still exists, just relocated) keep working unchanged. `ws.estimates` reconstructs as a
// 0-or-1-element array from the current estimate; `ws.projects` is always `[]` and
// `ws.actuals` is a 0-or-1-element array from the current actual -- both concepts no longer
// exist as lists, so any assertion relying on more than one element is a real, deliberate
// behavior change and is expected to still fail (that's the point -- see the individual
// spec files' own updates for what replaced those assertions).
export async function getWorkspace(page: Page): Promise<any> {
  const raw = await page.evaluate((keys) => {
    const out: Record<string, string | null> = {};
    for (const [name, key] of Object.entries(keys)) out[name] = window.localStorage.getItem(key);
    return out;
  }, STORAGE_KEYS);
  const currentEstimateRecord = raw.currentEstimate ? JSON.parse(raw.currentEstimate) : null;
  const catalog = raw.catalog ? JSON.parse(raw.catalog) : { materials: [], laborRates: [], equipment: [] };
  return {
    schemaVersion: 2,
    businessProfile: raw.businessProfile ? JSON.parse(raw.businessProfile) : { businessName: "", phone: "", email: "", address: "" },
    settings: raw.preferences ? JSON.parse(raw.preferences) : DEFAULT_PREFERENCES,
    catalog: catalog.materials ?? [],
    laborRates: catalog.laborRates ?? [],
    equipment: catalog.equipment ?? [],
    templates: raw.templates ? JSON.parse(raw.templates) : [],
    projects: [],
    estimates: currentEstimateRecord?.estimate ? [currentEstimateRecord.estimate] : [],
    actuals: currentEstimateRecord?.actual ? [currentEstimateRecord.actual] : [],
  };
}

export async function seedWorkspace(page: Page, partial: Record<string, any>, route = "/app") {
  await page.goto(route);
  if (partial.businessProfile) await seedBusinessProfile(page, partial.businessProfile, route);
  if (partial.settings) await seedPreferences(page, partial.settings, route);
  if (partial.catalog || partial.laborRates || partial.equipment) {
    await seedCatalog(page, { materials: partial.catalog, laborRates: partial.laborRates, equipment: partial.equipment }, route);
  }
  if (partial.templates) await seedTemplates(page, partial.templates, route);
  if (Array.isArray(partial.estimates) && partial.estimates.length > 0) {
    const estimate = partial.estimates[0];
    const actual = Array.isArray(partial.actuals) && partial.actuals.length > 0 ? partial.actuals[0] : null;
    await page.goto(route);
    await page.evaluate(
      ({ key, record }) => window.localStorage.setItem(key, JSON.stringify(record)),
      { key: STORAGE_KEYS.currentEstimate, record: { estimate, actual, savedAt: new Date().toISOString() } },
    );
  }
  await page.goto(route);
}
