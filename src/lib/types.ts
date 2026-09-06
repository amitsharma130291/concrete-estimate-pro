// Local-first data model for Concrete Cost Pro.
// Everything here is stored client-side (localStorage). No backend, no accounts.

export const SCHEMA_VERSION = 1;

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

export type EstimateStatus = "draft" | "sent" | "accepted" | "declined";

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
  overheadPercent: number;
  targetMarginPercent: number;
  sellingPrice: number;
  notes?: string;
  status: EstimateStatus;
  createdAt: string;
  updatedAt: string;
  isSample?: boolean;
}

export type ProjectStatus = "estimate" | "sent" | "accepted" | "completed";

export interface Project {
  id: string;
  name: string;
  projectType: ProjectType;
  customerName: string;
  status: ProjectStatus;
  estimateId?: string;
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
  overheadPercent: number;
  targetMarginPercent: number;
  sellingPrice: number;
  createdAt: string;
  updatedAt: string;
  isSample?: boolean;
}

export interface ActualJobResult {
  id: string;
  projectId: string;
  actualQuantityYd3: number;
  actualLaborHours: number;
  actualLaborCost: number;
  actualMaterialCost: number;
  actualEquipmentCost: number;
  actualOtherCost: number;
  finalSellingPrice: number;
  completedAt: string;
  notes?: string;
  isSample?: boolean;
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
  projects: Project[];
  estimates: Estimate[];
  actuals: ActualJobResult[];
}
