import type { ActualJobResult, CatalogItem, EquipmentItem, Estimate, LaborRateItem, ProjectTemplate } from "./types";
import type { CatalogBundle } from "./persistence";
import { newId } from "./workspaceContext";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

/** One sample current estimate (status "completed", with a matching sample actual) plus
 * reusable sample templates/catalog -- matches the single-current-estimate model: there is
 * only ever one sample estimate to seed, not a list. */
export function buildSampleWorkspace(): { catalog: CatalogBundle; templates: ProjectTemplate[]; estimate: Estimate; actual: ActualJobResult | null } {
  const materials: CatalogItem[] = [
    { id: newId("cat"), kind: "readyMix", name: "Standard 3000 PSI mix", supplier: "Riverside Ready Mix", unit: "yd³", unitCost: 165 },
    { id: newId("cat"), kind: "readyMix", name: "4000 PSI mix", supplier: "Riverside Ready Mix", unit: "yd³", unitCost: 178 },
    { id: newId("cat"), kind: "material", name: "#4 rebar", supplier: "ABC Supply", unit: "each", unitCost: 8.5 },
    { id: newId("cat"), kind: "material", name: "Wire mesh", supplier: "ABC Supply", unit: "ft²", unitCost: 0.48 },
    { id: newId("cat"), kind: "material", name: "Form board (2x4x8)", supplier: "Local Lumber", unit: "each", unitCost: 12 },
  ];

  const laborRates: LaborRateItem[] = [
    { id: newId("lab"), name: "Crew — loaded rate", loadedRatePerHour: 36 },
    { id: newId("lab"), name: "Finisher — loaded rate", loadedRatePerHour: 42 },
  ];

  const equipment: EquipmentItem[] = [
    { id: newId("eq"), name: "Concrete pump", unit: "per job", cost: 750 },
    { id: newId("eq"), name: "Skid steer", unit: "per day", cost: 325 },
    { id: newId("eq"), name: "Power trowel", unit: "per day", cost: 85 },
  ];

  const templates: ProjectTemplate[] = [
    {
      id: newId("tpl"),
      name: "4-inch basic slab",
      projectType: "slab",
      sections: [{ id: newId("sec"), name: "Slab", lengthFt: 20, widthFt: 20, thicknessIn: 4 }],
      allowancePercent: 8,
      rounding: "quarter",
      defaultCosts: { readyMixRatePerYd3: 165, laborCost: 1800, formsCost: 300, reinforcementCost: 400, equipmentCost: 150, otherCost: 0 },
      currentSellingPrice: 3800,
      createdAt: daysAgo(40),
      isSample: true,
    },
    {
      id: newId("tpl"),
      name: "Standard residential driveway",
      projectType: "driveway",
      sections: [{ id: newId("sec"), name: "Driveway", lengthFt: 60, widthFt: 18, thicknessIn: 4 }],
      allowancePercent: 8,
      rounding: "quarter",
      defaultCosts: { readyMixRatePerYd3: 165, laborCost: 3000, formsCost: 500, reinforcementCost: 900, equipmentCost: 450, otherCost: 0 },
      currentSellingPrice: 11880,
      createdAt: daysAgo(35),
      isSample: true,
    },
    {
      id: newId("tpl"),
      name: "Standard patio",
      projectType: "patio",
      sections: [{ id: newId("sec"), name: "Patio", lengthFt: 24, widthFt: 16, thicknessIn: 4 }],
      allowancePercent: 8,
      rounding: "quarter",
      defaultCosts: { readyMixRatePerYd3: 165, laborCost: 1600, formsCost: 250, reinforcementCost: 300, equipmentCost: 150, otherCost: 0 },
      currentSellingPrice: 3840,
      createdAt: daysAgo(30),
      isSample: true,
    },
    {
      id: newId("tpl"),
      name: "Stamped patio",
      projectType: "patio",
      sections: [{ id: newId("sec"), name: "Stamped Patio", lengthFt: 24, widthFt: 16, thicknessIn: 4 }],
      allowancePercent: 8,
      rounding: "quarter",
      defaultCosts: { readyMixRatePerYd3: 178, laborCost: 2600, formsCost: 300, reinforcementCost: 300, equipmentCost: 250, otherCost: 400 },
      currentSellingPrice: 5760,
      createdAt: daysAgo(25),
      isSample: true,
    },
  ];

  const estimate: Estimate = {
    id: newId("est"),
    estimateNumber: "EST-1001",
    projectType: "driveway",
    projectName: "Smith Driveway",
    customerName: "Smith Residence",
    customerAddress: "142 Maple St",
    sections: [{ id: newId("sec"), name: "Driveway", lengthFt: 80, widthFt: 18, thicknessIn: 4 }],
    allowancePercent: 8,
    rounding: "quarter",
    costs: { readyMixRatePerYd3: 165, laborCost: 3400, formsCost: 550, reinforcementCost: 950, equipmentCost: 750, otherCost: 0 },
    overheadPercent: 15,
    targetMarginPercent: 30,
    sellingPrice: 12470,
    status: "completed",
    createdAt: daysAgo(60),
    updatedAt: daysAgo(45),
    isSample: true,
  };

  const actual: ActualJobResult = {
    actualQuantityYd3: 17.2,
    actualLaborHours: 61,
    actualLaborCost: 3660,
    actualMaterialCost: 3388,
    actualEquipmentCost: 750,
    actualOtherCost: 0,
    finalSellingPrice: 12470,
    completedAt: daysAgo(45),
  };

  return { catalog: { materials, laborRates, equipment }, templates, estimate, actual };
}
