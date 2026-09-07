// Local-first data model for Concrete Cost Pro.
// Everything here is stored client-side (localStorage). No backend, no accounts.
//
// v2 (single-current-estimate model): the app keeps exactly one active Estimate plus,
// optionally, one logged Actual result for that same estimate. There is no archive and no
// list of past estimates/projects — "Project" as a separate persisted record was removed;
// an estimate that has been completed on-site is just an Estimate whose status progressed
// to "completed", with one ActualJobResult attached to it.

export const SCHEMA_VERSION = 2;

export type Units = "imperial";
export type Rounding = "none" | "quarter" | "half" | "whole";

export type ProjectType =
  | "driveway"
  | "slab"
  | "patio"
  | "footing"
  | "sidewalk"
  | "general";

export interface BusinessProfile {
  businessName: string;
  logoDataUrl?: string;
  phone: string;
  email: string;
  address: string;
}

export interface AppSettings {
  defaultOverheadPercent: number;
  defaultTargetMarginPercent: number;
  defaultLoadedLaborRate: number;
  defaultAllowancePercent: number;
  defaultRounding: Rounding;
  estimateValidityDays: number;
  defaultNotes: string;
  units: Units;
  currency: "USD";
}

export interface CatalogItem {
  id: string;
  kind: "readyMix" | "material";
  name: string;
  supplier?: string;
  unit: string;
  unitCost: number;
  notes?: string;
}

export interface LaborRateItem {
  id: string;
  name: string;
  loadedRatePerHour: number;
  notes?: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  unit: "per job" | "per day" | "per hour";
  cost: number;
  notes?: string;
}

export interface ProjectSection {
  id: string;
  name: string;
  lengthFt: number;
  widthFt: number;
  thicknessIn: number;
}

export type LaborMode = "flat" | "hourly" | "unit";

/**
 * How labor cost was derived. `costs.laborCost` (on Estimate) or `defaultCosts.laborCost`
 * (on ProjectTemplate) always holds the resolved dollar amount used in every calculation —
 * this is only kept so the editor can re-derive and re-edit the inputs that produced it.
 */
export interface LaborInput {
  mode: LaborMode;
  crewSize: number;
  hours: number;
  ratePerHour: number;
  unitRatePerSqft: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  projectType: ProjectType;
  sections: ProjectSection[];
  allowancePercent: number;
  rounding: Rounding;
  defaultCosts: {
    readyMixRatePerYd3: number;
    laborCost: number;
    formsCost: number;
    reinforcementCost: number;
    equipmentCost: number;
    otherCost: number;
  };
  /** How defaultCosts.laborCost was derived; omitted means a flat-entered amount. */
  labor?: LaborInput;
  /** What you currently charge customers for this standard job type — drives Rate Health. */
  currentSellingPrice: number;
  createdAt: string;
  isSample?: boolean;
}

export interface EstimateLineItem {
  id: string;
  label: string;
  amount: number;
  internal?: boolean; // internal-only line items never render in the customer PDF
}

/**
 * "completed" replaces the old separate Project record: once a job that started as an
 * estimate is finished on-site, its status moves to "completed" in place and one
 * ActualJobResult can be logged against it (Workspace.currentActual) — no second record,
 * no archive, and duplicating it starts a fresh replacement draft rather than a new entry.
 */
export type EstimateStatus = "draft" | "sent" | "accepted" | "declined" | "completed";

export interface Estimate {
  id: string;
  estimateNumber: string;
  projectType: ProjectType;
  projectName: string;
  customerName: string;
  customerEmail?: string;
  customerAddress?: string;
  sections: ProjectSection[];
  allowancePercent: number;
  rounding: Rounding;
  costs: {
    readyMixRatePerYd3: number;
    laborCost: number;
    formsCost: number;
    reinforcementCost: number;
    equipmentCost: number;
    otherCost: number;
  };
  /** How costs.laborCost was derived; omitted means a flat-entered amount. */
  labor?: LaborInput;
  overheadPercent: number;
  targetMarginPercent: number;
  sellingPrice: number;
  notes?: string;
  status: EstimateStatus;
  /** Opt-in only: shows cost/overhead/margin on the printed PDF. Off unless the contractor
   * explicitly turns it on — see EstimateDocument.tsx. */
  showCostBreakdownOnPdf?: boolean;
  createdAt: string;
  updatedAt: string;
  isSample?: boolean;
}

export interface ActualJobResult {
  actualQuantityYd3: number;
  actualLaborHours: number;
  actualLaborCost: number;
  actualMaterialCost: number;
  actualEquipmentCost: number;
  actualOtherCost: number;
  finalSellingPrice: number;
  completedAt: string;
  notes?: string;
}

export interface Workspace {
  schemaVersion: number;
  exportedAt: string;
  businessProfile: BusinessProfile;
  settings: AppSettings;
  catalog: CatalogItem[];
  laborRates: LaborRateItem[];
  equipment: EquipmentItem[];
  templates: ProjectTemplate[];
  /** The single active estimate this browser is working on. Null when none has been
   * started yet or the last one was explicitly replaced. There is no archive. */
  currentEstimate: Estimate | null;
  /** Logged actual results for currentEstimate only. Cleared whenever currentEstimate is
   * replaced -- an actual result with no estimate to compare against has nowhere to live,
   * and there is no historical actuals log to move it into. */
  currentActual: ActualJobResult | null;
}
