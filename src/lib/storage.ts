import {
  SCHEMA_VERSION,
  type ActualJobResult,
  type AppSettings,
  type BusinessProfile,
  type CatalogItem,
  type EquipmentItem,
  type Estimate,
  type LaborRateItem,
  type Project,
  type ProjectTemplate,
  type Workspace,
} from "./types";
import { buildSampleWorkspace } from "./sampleData";

const STORAGE_KEY = "cep:workspace:v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function defaultSettings(): AppSettings {
  return {
    defaultOverheadPercent: 15,
    defaultTargetMarginPercent: 30,
    defaultLoadedLaborRate: 36,
    defaultAllowancePercent: 8,
    defaultRounding: "quarter",
    estimateValidityDays: 30,
    defaultNotes: "Price includes materials, labor and standard finish. Excess spoil removal billed separately unless noted.",
    units: "imperial",
    currency: "USD",
  };
}

export function emptyWorkspace(): Workspace {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    businessProfile: {
      businessName: "",
      phone: "",
      email: "",
      address: "",
    },
    settings: defaultSettings(),
    catalog: [],
    laborRates: [],
    equipment: [],
    templates: [],
    projects: [],
    estimates: [],
    actuals: [],
  };
}

export function loadWorkspace(): Workspace {
  if (!isBrowser()) return emptyWorkspace();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyWorkspace();
  try {
    const parsed = JSON.parse(raw) as Workspace;
    return migrateWorkspace(parsed);
  } catch {
    return emptyWorkspace();
  }
}

function migrateWorkspace(ws: Workspace): Workspace {
  // Single version today; future migrations branch on ws.schemaVersion here.
  const base = emptyWorkspace();
  return {
    ...base,
    ...ws,
    settings: { ...base.settings, ...ws.settings },
    businessProfile: { ...base.businessProfile, ...ws.businessProfile },
    schemaVersion: SCHEMA_VERSION,
  };
}

export function saveWorkspace(ws: Workspace): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...ws, exportedAt: new Date().toISOString() }));
}

export function hasAnyRealData(ws: Workspace): boolean {
  return (
    ws.projects.some((p) => !p.isSample) ||
    ws.estimates.some((e) => !e.isSample) ||
    ws.templates.some((t) => !t.isSample)
  );
}

export function seedSampleData(): Workspace {
  const ws = loadWorkspace();
  const sample = buildSampleWorkspace();
  const merged: Workspace = {
    ...ws,
    catalog: ws.catalog.length ? ws.catalog : sample.catalog,
    laborRates: ws.laborRates.length ? ws.laborRates : sample.laborRates,
    equipment: ws.equipment.length ? ws.equipment : sample.equipment,
    templates: [...ws.templates, ...sample.templates],
    projects: [...ws.projects, ...sample.projects],
    estimates: [...ws.estimates, ...sample.estimates],
    actuals: [...ws.actuals, ...sample.actuals],
  };
  saveWorkspace(merged);
  return merged;
}

export function clearSampleData(): Workspace {
  const ws = loadWorkspace();
  const cleared: Workspace = {
    ...ws,
    templates: ws.templates.filter((t) => !t.isSample),
    projects: ws.projects.filter((p) => !p.isSample),
    estimates: ws.estimates.filter((e) => !e.isSample),
    actuals: ws.actuals.filter((a) => !a.isSample),
  };
  saveWorkspace(cleared);
  return cleared;
}

export function resetWorkspace(): Workspace {
  const empty = emptyWorkspace();
  saveWorkspace(empty);
  return empty;
}

export function exportWorkspaceJson(ws: Workspace): string {
  return JSON.stringify({ ...ws, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString() }, null, 2);
}

export interface ImportValidation {
  ok: boolean;
  errors: string[];
  workspace?: Workspace;
}

export function validateImport(json: string): ImportValidation {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, errors: ["File is not valid JSON."] };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, errors: ["File does not contain a JSON object."] };
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.schemaVersion !== "number") {
    errors.push("Missing schemaVersion — this may not be a Concrete Estimate Pro backup file.");
  }
  const requiredArrays = ["catalog", "laborRates", "equipment", "templates", "projects", "estimates", "actuals"];
  for (const key of requiredArrays) {
    if (obj[key] !== undefined && !Array.isArray(obj[key])) {
      errors.push(`Field "${key}" should be a list.`);
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], workspace: migrateWorkspace(obj as unknown as Workspace) };
}

// ---- Generic id helper ----
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---- Typed collection helpers ----
export function upsertBy<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((i) => i.id === item.id);
  if (idx === -1) return [...list, item];
  const next = [...list];
  next[idx] = item;
  return next;
}

export function removeBy<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((i) => i.id !== id);
}

export type {
  ActualJobResult,
  AppSettings,
  BusinessProfile,
  CatalogItem,
  EquipmentItem,
  Estimate,
  LaborRateItem,
  Project,
  ProjectTemplate,
  Workspace,
};
