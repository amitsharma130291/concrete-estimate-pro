import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  repository,
  migrateLegacyDataIfNeeded,
  defaultBusinessProfile,
  defaultPreferences,
  emptyCatalogBundle,
  type CatalogBundle,
  type SaveResult,
} from "./persistence";
import { buildSampleWorkspace } from "./sampleData";
import type { ActualJobResult, AppSettings, BusinessProfile, Estimate, ProjectTemplate } from "./types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const ESTIMATE_DEBOUNCE_MS = 700;

/** The single canonical "blank draft" shape -- used both for the provider's own
 * auto-seeded first estimate and by EstimatesTab's "New Estimate" flow, so there is exactly
 * one definition of what a fresh, untouched estimate looks like. */
export function createBlankEstimate(defaults: {
  overheadPercent: number;
  targetMarginPercent: number;
  allowancePercent: number;
  rounding: Estimate["rounding"];
  notes: string;
  validityDays: number;
  readyMixRate: number;
}): Estimate {
  const now = new Date().toISOString();
  return {
    id: newId("est"),
    estimateNumber: `EST-${new Date().getFullYear()}${Date.now().toString().slice(-5)}`,
    projectType: "driveway",
    projectName: "",
    customerName: "",
    sections: [{ id: newId("sec"), name: "Section 1", lengthFt: 20, widthFt: 20, thicknessIn: 4 }],
    allowancePercent: defaults.allowancePercent,
    rounding: defaults.rounding,
    costs: { readyMixRatePerYd3: defaults.readyMixRate || 165, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 },
    overheadPercent: defaults.overheadPercent,
    targetMarginPercent: defaults.targetMarginPercent,
    sellingPrice: 0,
    notes: defaults.notes,
    validityDays: defaults.validityDays,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

/** True for a draft that's still exactly what createBlankEstimate() produces, modulo id/
 * timestamps/number -- i.e. the user hasn't entered anything yet. Used to skip the
 * replace-confirmation dialog when there is nothing real to lose. */
export function isUntouchedBlankEstimate(e: Estimate): boolean {
  return (
    e.projectName === "" &&
    e.customerName === "" &&
    e.sellingPrice === 0 &&
    e.sections.length === 1 &&
    e.sections[0].lengthFt === 20 &&
    e.sections[0].widthFt === 20 &&
    e.sections[0].thicknessIn === 4 &&
    e.costs.laborCost === 0 &&
    e.costs.formsCost === 0 &&
    e.costs.reinforcementCost === 0 &&
    e.costs.equipmentCost === 0 &&
    e.costs.otherCost === 0
  );
}

export interface WorkspaceContextValue {
  ready: boolean;
  storageAvailable: boolean;

  businessProfile: BusinessProfile;
  updateBusinessProfile: (updater: (p: BusinessProfile) => BusinessProfile) => void;

  preferences: AppSettings;
  updatePreferences: (updater: (p: AppSettings) => AppSettings) => void;

  catalog: CatalogBundle;
  updateCatalog: (updater: (c: CatalogBundle) => CatalogBundle) => void;

  templates: ProjectTemplate[];
  updateTemplates: (updater: (t: ProjectTemplate[]) => ProjectTemplate[]) => void;

  currentEstimate: Estimate | null;
  currentActual: ActualJobResult | null;
  /** Debounced (~700ms) autosave for in-progress edits to the current estimate. */
  updateCurrentEstimate: (updater: (e: Estimate) => Estimate) => void;
  updateCurrentActual: (updater: (a: ActualJobResult | null) => ActualJobResult | null) => void;
  /** Replaces the current estimate (and clears any logged actual) immediately, no debounce
   * -- only call this after the user has explicitly confirmed replacement. */
  replaceCurrentEstimate: (estimate: Estimate) => SaveResult;
  /** Forces an immediate save of whatever is currently pending (or the current in-memory
   * state if nothing is pending), bypassing the debounce -- for explicit "Save" actions
   * where the user expects instant confirmation rather than waiting out the debounce. */
  flushCurrentEstimateNow: () => SaveResult;
  estimateSaveStatus: SaveStatus;
  estimateLastSavedAt: string | null;
  estimateSaveError: string | null;

  hasRealData: boolean;
  seedSample: () => void;
  clearSample: () => void;
  resetAll: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  const [businessProfile, setBusinessProfileState] = useState<BusinessProfile>(defaultBusinessProfile());
  const [preferences, setPreferencesState] = useState<AppSettings>(defaultPreferences());
  const [catalog, setCatalogState] = useState<CatalogBundle>(emptyCatalogBundle());
  const [templates, setTemplatesState] = useState<ProjectTemplate[]>([]);
  const [currentEstimate, setCurrentEstimateState] = useState<Estimate | null>(null);
  const [currentActual, setCurrentActualState] = useState<ActualJobResult | null>(null);

  const [estimateSaveStatus, setEstimateSaveStatus] = useState<SaveStatus>("idle");
  const [estimateLastSavedAt, setEstimateLastSavedAt] = useState<string | null>(null);
  const [estimateSaveError, setEstimateSaveError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always holds the latest in-memory estimate/actual, even mid-debounce, so a flush (e.g.
  // triggered by replaceCurrentEstimate or unmount) never writes a stale value.
  const pendingRef = useRef<{ estimate: Estimate; actual: ActualJobResult | null } | null>(null);

  useEffect(() => {
    setStorageAvailable(repository.isStorageAvailable());
    migrateLegacyDataIfNeeded();
    const loadedProfile = repository.loadBusinessProfile() ?? defaultBusinessProfile();
    const loadedPreferences = repository.loadPreferences();
    const loadedCatalog = repository.loadCatalog();
    setBusinessProfileState(loadedProfile);
    setPreferencesState(loadedPreferences);
    setCatalogState(loadedCatalog);
    setTemplatesState(repository.loadTemplates());
    const record = repository.loadCurrentEstimate();
    if (record) {
      setCurrentEstimateState(record.estimate);
      setCurrentActualState(record.actual);
      setEstimateSaveStatus("saved");
      setEstimateLastSavedAt(record.savedAt);
    } else {
      // Guarantees `ready && !currentEstimate` never happens for a plain first visit --
      // seeded here, synchronously as part of the same load, rather than in a child
      // component's own effect keyed off `ready`. The previous design (seed lazily in
      // EstimatesTab once `ready` flipped) had a real, intermittent race: a page can
      // navigate again (e.g. a test's reset-workspace helper, or a user's fast double-click)
      // before that child effect's own state updates finish committing, occasionally
      // leaving `currentEstimate` null with nothing left to create it.
      const blank = createBlankEstimate({
        overheadPercent: loadedPreferences.defaultOverheadPercent,
        targetMarginPercent: loadedPreferences.defaultTargetMarginPercent,
        allowancePercent: loadedPreferences.defaultAllowancePercent,
        rounding: loadedPreferences.defaultRounding,
        notes: loadedPreferences.defaultNotes,
        validityDays: loadedPreferences.estimateValidityDays,
        readyMixRate: loadedCatalog.materials.find((c) => c.kind === "readyMix")?.unitCost ?? 165,
      });
      setCurrentEstimateState(blank);
      setCurrentActualState(null);
      const result = repository.saveCurrentEstimate({ estimate: blank, actual: null, savedAt: new Date().toISOString() });
      if (result.ok) {
        setEstimateSaveStatus("saved");
        setEstimateLastSavedAt(new Date().toISOString());
      } else {
        setEstimateSaveStatus("error");
        setEstimateSaveError(result.message);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Flush any unsaved edit on unmount so the final change is never lost.
      if (pendingRef.current) {
        repository.saveCurrentEstimate({ estimate: pendingRef.current.estimate, actual: pendingRef.current.actual, savedAt: new Date().toISOString() });
      }
    };
  }, []);

  const flushEstimateSave = useCallback((estimate: Estimate, actual: ActualJobResult | null) => {
    setEstimateSaveStatus("saving");
    const result = repository.saveCurrentEstimate({ estimate, actual, savedAt: new Date().toISOString() });
    if (result.ok) {
      const savedAt = new Date().toISOString();
      setEstimateSaveStatus("saved");
      setEstimateLastSavedAt(savedAt);
      setEstimateSaveError(null);
    } else {
      setEstimateSaveStatus("error");
      setEstimateSaveError(result.message);
    }
    pendingRef.current = null;
    return result;
  }, []);

  const scheduleEstimateSave = useCallback(
    (estimate: Estimate, actual: ActualJobResult | null) => {
      pendingRef.current = { estimate, actual };
      setEstimateSaveStatus("saving");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const pending = pendingRef.current;
        if (pending) flushEstimateSave(pending.estimate, pending.actual);
      }, ESTIMATE_DEBOUNCE_MS);
    },
    [flushEstimateSave],
  );

  // Deliberately does NOT perform the scheduleEstimateSave side effect inside the
  // setState updater function passed to setCurrentEstimateState/setCurrentActualState --
  // React does not guarantee an updater function runs exactly once, synchronously, before
  // the setter call returns (this bit us for real: calling updateCurrentActual immediately
  // followed by flushCurrentEstimateNow() in the same click handler could flush a stale
  // pendingRef because the updater's side effect hadn't necessarily run yet). Instead, both
  // the new value and the save-scheduling side effect are computed directly here, from the
  // already-current `currentEstimate`/`currentActual` closure values, fully synchronously.
  const updateCurrentEstimate = useCallback(
    (updater: (e: Estimate) => Estimate) => {
      if (!currentEstimate) return;
      const next = updater(currentEstimate);
      setCurrentEstimateState(next);
      scheduleEstimateSave(next, currentActual);
    },
    [scheduleEstimateSave, currentEstimate, currentActual],
  );

  const updateCurrentActual = useCallback(
    (updater: (a: ActualJobResult | null) => ActualJobResult | null) => {
      const next = updater(currentActual);
      setCurrentActualState(next);
      if (currentEstimate) scheduleEstimateSave(currentEstimate, next);
    },
    [scheduleEstimateSave, currentEstimate, currentActual],
  );

  const replaceCurrentEstimate = useCallback((estimate: Estimate): SaveResult => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pendingRef.current = null;
    setCurrentEstimateState(estimate);
    setCurrentActualState(null);
    return flushEstimateSave(estimate, null);
  }, [flushEstimateSave]);

  const flushCurrentEstimateNow = useCallback((): SaveResult => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const pending = pendingRef.current;
    if (pending) return flushEstimateSave(pending.estimate, pending.actual);
    if (currentEstimate) return flushEstimateSave(currentEstimate, currentActual);
    return { ok: true };
  }, [flushEstimateSave, currentEstimate, currentActual]);

  const updateBusinessProfile = useCallback((updater: (p: BusinessProfile) => BusinessProfile) => {
    setBusinessProfileState((prev) => {
      const next = updater(prev);
      repository.saveBusinessProfile(next);
      return next;
    });
  }, []);

  const updatePreferences = useCallback((updater: (p: AppSettings) => AppSettings) => {
    setPreferencesState((prev) => {
      const next = updater(prev);
      repository.savePreferences(next);
      return next;
    });
  }, []);

  const updateCatalog = useCallback((updater: (c: CatalogBundle) => CatalogBundle) => {
    setCatalogState((prev) => {
      const next = updater(prev);
      repository.saveCatalog(next);
      return next;
    });
  }, []);

  const updateTemplates = useCallback((updater: (t: ProjectTemplate[]) => ProjectTemplate[]) => {
    setTemplatesState((prev) => {
      const next = updater(prev);
      repository.saveTemplates(next);
      return next;
    });
  }, []);

  const seedSample = useCallback(() => {
    const sample = buildSampleWorkspace();
    setCatalogState((prev) => {
      const next = prev.materials.length || prev.laborRates.length || prev.equipment.length ? prev : sample.catalog;
      repository.saveCatalog(next);
      return next;
    });
    setTemplatesState((prev) => {
      const next = prev.length ? prev : sample.templates;
      repository.saveTemplates(next);
      return next;
    });
    // Replaces the current estimate with the sample only if it's still an untouched blank
    // draft (the provider's own auto-seeded one, or truly none) -- never overwrites real
    // work the user has already started.
    if (!currentEstimate || isUntouchedBlankEstimate(currentEstimate)) {
      setCurrentEstimateState(sample.estimate);
      setCurrentActualState(sample.actual);
      flushEstimateSave(sample.estimate, sample.actual);
    }
  }, [flushEstimateSave, currentEstimate]);

  const clearSample = useCallback(() => {
    // Catalog/rates/equipment are reusable business data, not sample-flagged records --
    // matches the original app's behavior (seedSample only fills them in when empty;
    // clearSample never removed them).
    setTemplatesState((prev) => {
      const next = prev.filter((t) => !t.isSample);
      repository.saveTemplates(next);
      return next;
    });
    // Replaced with a fresh blank draft, not null -- ready && !currentEstimate must never
    // happen (see the load effect above); a null current estimate here would silently
    // resurrect the exact race this file was rewritten to eliminate.
    if (currentEstimate?.isSample) {
      const blank = createBlankEstimate({
        overheadPercent: preferences.defaultOverheadPercent,
        targetMarginPercent: preferences.defaultTargetMarginPercent,
        allowancePercent: preferences.defaultAllowancePercent,
        rounding: preferences.defaultRounding,
        notes: preferences.defaultNotes,
        validityDays: preferences.estimateValidityDays,
        readyMixRate: catalog.materials.find((c) => c.kind === "readyMix")?.unitCost ?? 165,
      });
      setCurrentEstimateState(blank);
      setCurrentActualState(null);
      flushEstimateSave(blank, null);
    }
  }, [currentEstimate, preferences, catalog, flushEstimateSave]);

  const resetAll = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pendingRef.current = null;
    const freshPreferences = defaultPreferences();
    // Replaced with a fresh blank draft, not null -- see the same note in clearSample above.
    const blank = createBlankEstimate({
      overheadPercent: freshPreferences.defaultOverheadPercent,
      targetMarginPercent: freshPreferences.defaultTargetMarginPercent,
      allowancePercent: freshPreferences.defaultAllowancePercent,
      rounding: freshPreferences.defaultRounding,
      notes: freshPreferences.defaultNotes,
      validityDays: freshPreferences.estimateValidityDays,
      readyMixRate: 165,
    });
    repository.saveCurrentEstimate({ estimate: blank, actual: null, savedAt: new Date().toISOString() });
    repository.saveBusinessProfile(defaultBusinessProfile());
    repository.savePreferences(freshPreferences);
    repository.saveCatalog(emptyCatalogBundle());
    repository.saveTemplates([]);
    setBusinessProfileState(defaultBusinessProfile());
    setPreferencesState(freshPreferences);
    setCatalogState(emptyCatalogBundle());
    setTemplatesState([]);
    setCurrentEstimateState(blank);
    setCurrentActualState(null);
    setEstimateSaveStatus("saved");
    setEstimateLastSavedAt(new Date().toISOString());
    setEstimateSaveError(null);
  }, []);

  // An auto-seeded, never-touched blank draft doesn't count as "real data" -- otherwise the
  // Overview welcome/sample-data empty state would never show, since currentEstimate is now
  // guaranteed non-null once ready (see the load effect above).
  const hasRealData = useMemo(
    () => (currentEstimate !== null && !currentEstimate.isSample && !isUntouchedBlankEstimate(currentEstimate)) || templates.some((t) => !t.isSample),
    [currentEstimate, templates],
  );

  const value: WorkspaceContextValue = {
    ready,
    storageAvailable,
    businessProfile,
    updateBusinessProfile,
    preferences,
    updatePreferences,
    catalog,
    updateCatalog,
    templates,
    updateTemplates,
    currentEstimate,
    currentActual,
    updateCurrentEstimate,
    updateCurrentActual,
    replaceCurrentEstimate,
    flushCurrentEstimateNow,
    estimateSaveStatus,
    estimateLastSavedAt,
    estimateSaveError,
    hasRealData,
    seedSample,
    clearSample,
    resetAll,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}

// ---- Generic id helper (kept here; not localStorage-related) ----
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

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
