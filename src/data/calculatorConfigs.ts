import type { ProjectType } from "../lib/types";

export interface DimensionFieldConfig {
  label: string;
  hint: string;
  defaultUnit: "ft" | "in";
  allowUnitToggle: boolean;
}

export interface CalculatorConfig {
  projectType: ProjectType;
  slug: string;
  h1: string;
  intro: string;
  metaDescription: string;
  length: DimensionFieldConfig;
  width: DimensionFieldConfig;
  thickness: DimensionFieldConfig;
  defaults: {
    lengthFt: number;
    widthValue: number;
    widthUnit: "ft" | "in";
    thicknessIn: number;
    allowancePercent: number;
    readyMixRatePerYd3: number;
    laborCost: number;
    formsCost: number;
    reinforcementCost: number;
    equipmentCost: number;
    otherCost: number;
  };
  marketRatePerSqft: number;
  faqs: { q: string; a: string }[];
  safetyNote?: string;
}

export const CALCULATOR_CONFIGS: Record<string, CalculatorConfig> = {
  driveway: {
    projectType: "driveway",
    slug: "concrete-driveway-cost-calculator",
    h1: "Concrete Driveway Cost Calculator",
    intro:
      "Enter your driveway dimensions and material and labor costs to see the concrete order quantity, total project cost and the price you need to charge to hit your margin.",
    metaDescription:
      "Free concrete driveway cost calculator. Enter length, width and thickness to get order quantity, project cost and a target-margin selling price instantly.",
    length: { label: "Length", hint: "Total length of the driveway", defaultUnit: "ft", allowUnitToggle: false },
    width: { label: "Width", hint: "Total width of the driveway", defaultUnit: "ft", allowUnitToggle: false },
    thickness: { label: "Thickness", hint: "Concrete slab thickness", defaultUnit: "in", allowUnitToggle: false },
    defaults: {
      lengthFt: 60,
      widthValue: 20,
      widthUnit: "ft",
      thicknessIn: 4,
      allowancePercent: 8,
      readyMixRatePerYd3: 165,
      laborCost: 3000,
      formsCost: 500,
      reinforcementCost: 900,
      equipmentCost: 450,
      otherCost: 0,
    },
    marketRatePerSqft: 9.5,
    faqs: [
      {
        q: "How much concrete do I need for a driveway?",
        a: "Multiply length by width to get square footage, multiply by your thickness in feet to get cubic feet, then divide by 27 to get cubic yards. This calculator does that automatically and adds your order allowance so you don't come up short on pour day.",
      },
      {
        q: "What thickness should my driveway be?",
        a: "This tool doesn't set thickness for you — enter the thickness you or your engineer specified for the project. Standard residential driveways are commonly poured thicker than sidewalks to handle vehicle loads, but the correct spec depends on soil, climate and vehicle weight.",
      },
      {
        q: "What's a typical order allowance?",
        a: "Many contractors order 5–10% extra to cover subgrade irregularities, spillage and form variance. Set whatever allowance matches your site conditions and crew's experience.",
      },
      {
        q: "Does this calculator include excavation or base prep?",
        a: "No — it calculates concrete quantity, materials, labor and equipment costs you enter. Add excavation, gravel base or removal costs to Labor, Equipment or Other as needed.",
      },
    ],
  },
  slab: {
    projectType: "slab",
    slug: "concrete-slab-cost-calculator",
    h1: "Concrete Slab Cost Calculator",
    intro:
      "Calculate concrete quantity and total cost for a slab pour — garage floors, shed pads, foundations and more — and see the price required to hit your target margin.",
    metaDescription:
      "Free concrete slab cost calculator. Get concrete volume, order quantity, total project cost and a target-margin selling price for any slab pour.",
    length: { label: "Length", hint: "Slab length", defaultUnit: "ft", allowUnitToggle: false },
    width: { label: "Width", hint: "Slab width", defaultUnit: "ft", allowUnitToggle: false },
    thickness: { label: "Thickness", hint: "Slab thickness", defaultUnit: "in", allowUnitToggle: false },
    defaults: {
      lengthFt: 40,
      widthValue: 30,
      widthUnit: "ft",
      thicknessIn: 4,
      allowancePercent: 8,
      readyMixRatePerYd3: 165,
      laborCost: 2100,
      formsCost: 480,
      reinforcementCost: 920,
      equipmentCost: 750,
      otherCost: 150,
    },
    marketRatePerSqft: 9.0,
    faqs: [
      {
        q: "How is slab concrete volume calculated?",
        a: "Area (length × width) is multiplied by thickness (converted to feet), then divided by 27 to convert cubic feet to cubic yards. An order allowance is added on top for waste and subgrade variance.",
      },
      {
        q: "Does this tool tell me what slab thickness or reinforcement I need?",
        a: "No. Slab thickness, rebar/mesh spacing and concrete strength are structural decisions that depend on load, soil and local code. Enter the specification you or your engineer already determined — this tool only calculates quantity, cost and pricing from those numbers.",
      },
      {
        q: "What's included in 'true cost'?",
        a: "True cost is your direct costs (ready mix, labor, forms, reinforcement, equipment, other) plus your overhead percentage. It's the number your selling price needs to beat to hit your target margin.",
      },
    ],
  },
  patio: {
    projectType: "patio",
    slug: "concrete-patio-cost-calculator",
    h1: "Concrete Patio Cost Calculator",
    intro:
      "Estimate concrete quantity and cost for a patio pour, including finish and forming costs, and see the price needed to protect your margin.",
    metaDescription:
      "Free concrete patio cost calculator. Enter dimensions and costs to get order quantity, total project cost and a target-margin selling price.",
    length: { label: "Length", hint: "Patio length", defaultUnit: "ft", allowUnitToggle: false },
    width: { label: "Width", hint: "Patio width", defaultUnit: "ft", allowUnitToggle: false },
    thickness: { label: "Thickness", hint: "Patio slab thickness", defaultUnit: "in", allowUnitToggle: false },
    defaults: {
      lengthFt: 24,
      widthValue: 16,
      widthUnit: "ft",
      thicknessIn: 4,
      allowancePercent: 8,
      readyMixRatePerYd3: 165,
      laborCost: 1600,
      formsCost: 250,
      reinforcementCost: 300,
      equipmentCost: 150,
      otherCost: 0,
    },
    marketRatePerSqft: 10.0,
    faqs: [
      {
        q: "Does this include stamped or decorative finish costs?",
        a: "Stamping, coloring and sealing add labor and material cost — add those to Labor or Other so they're reflected in your total and required price.",
      },
      {
        q: "How much extra should I order for a patio pour?",
        a: "Patios often have curves, steps or cutouts that increase waste versus a simple rectangle. Many contractors bump the order allowance up from a typical 5–8% for irregular shapes.",
      },
    ],
  },
  footing: {
    projectType: "footing",
    slug: "concrete-footing-cost-calculator",
    h1: "Concrete Footing Cost Calculator",
    intro:
      "Calculate concrete volume and cost for a footing pour from your planned or design-specified footing dimensions.",
    metaDescription:
      "Free concrete footing cost calculator. Enter your specified footing length, width and depth to get order quantity, cost and required selling price.",
    length: { label: "Total footing length", hint: "Combined linear footage of footing", defaultUnit: "ft", allowUnitToggle: false },
    width: { label: "Width", hint: "Footing width, as specified", defaultUnit: "in", allowUnitToggle: true },
    thickness: { label: "Depth", hint: "Footing depth, as specified", defaultUnit: "in", allowUnitToggle: false },
    defaults: {
      lengthFt: 120,
      widthValue: 24,
      widthUnit: "in",
      thicknessIn: 12,
      allowancePercent: 10,
      readyMixRatePerYd3: 165,
      laborCost: 2200,
      formsCost: 600,
      reinforcementCost: 700,
      equipmentCost: 200,
      otherCost: 0,
    },
    marketRatePerSqft: 0,
    safetyNote:
      "This calculator never determines footing size, depth or reinforcement. Enter your planned or design-specified dimensions — those come from your engineer, architect or local code, not from this tool.",
    faqs: [
      {
        q: "Does this calculator tell me what size footing I need?",
        a: "No. Footing dimensions are a structural/engineering decision based on load, soil bearing capacity and local code. Enter the length, width and depth already specified for your project — this tool only converts those into concrete volume and cost.",
      },
      {
        q: "How do I calculate footing concrete volume?",
        a: "Volume = length × width × depth (all converted to feet), divided by 27 for cubic yards. Because footing width and depth are usually specified in inches, this calculator lets you enter those fields in inches directly.",
      },
    ],
  },
  sidewalk: {
    projectType: "sidewalk",
    slug: "concrete-sidewalk-cost-calculator",
    h1: "Concrete Sidewalk Cost Calculator",
    intro:
      "Calculate concrete quantity and cost for a sidewalk or walkway pour and see the price required to hit your target margin.",
    metaDescription:
      "Free concrete sidewalk cost calculator. Enter length, width and thickness to get order quantity, total cost and a target-margin selling price.",
    length: { label: "Length", hint: "Total sidewalk length", defaultUnit: "ft", allowUnitToggle: false },
    width: { label: "Width", hint: "Sidewalk width", defaultUnit: "ft", allowUnitToggle: false },
    thickness: { label: "Thickness", hint: "Sidewalk thickness", defaultUnit: "in", allowUnitToggle: false },
    defaults: {
      lengthFt: 100,
      widthValue: 4,
      widthUnit: "ft",
      thicknessIn: 4,
      allowancePercent: 6,
      readyMixRatePerYd3: 165,
      laborCost: 1800,
      formsCost: 300,
      reinforcementCost: 0,
      equipmentCost: 200,
      otherCost: 0,
    },
    marketRatePerSqft: 8.5,
    faqs: [
      {
        q: "Do municipal sidewalk jobs need different allowances?",
        a: "Public right-of-way work often has stricter finish and joint requirements. Adjust labor and other costs to reflect inspection, traffic control or permit costs specific to the job.",
      },
    ],
  },
  general: {
    projectType: "general",
    slug: "concrete-cost-calculator",
    h1: "Concrete Cost Calculator",
    intro:
      "A flexible concrete cost calculator and concrete estimate calculator for any rectangular pour — slabs, driveways, patios, sidewalks or custom flatwork. Enter your dimensions and your ready-mix price per yard to get quantity, total cost and required selling price.",
    metaDescription:
      "Free concrete cost calculator and estimate calculator for any project type. Enter dimensions and your ready-mix cost per yard to get concrete quantity, total project cost and a target-margin price.",
    length: { label: "Length", hint: "Project length", defaultUnit: "ft", allowUnitToggle: false },
    width: { label: "Width", hint: "Project width", defaultUnit: "ft", allowUnitToggle: false },
    thickness: { label: "Thickness", hint: "Concrete thickness", defaultUnit: "in", allowUnitToggle: false },
    defaults: {
      lengthFt: 30,
      widthValue: 20,
      widthUnit: "ft",
      thicknessIn: 4,
      allowancePercent: 8,
      readyMixRatePerYd3: 165,
      laborCost: 1900,
      formsCost: 400,
      reinforcementCost: 500,
      equipmentCost: 300,
      otherCost: 0,
    },
    marketRatePerSqft: 9.5,
    faqs: [
      {
        q: "What project types can I use this for?",
        a: "Any rectangular concrete pour — slabs, driveways, patios, sidewalks, pads or custom flatwork. For multi-section projects (like an L-shaped driveway), Concrete Estimate Pro lets you add multiple sections to one project.",
      },
      {
        q: "How much does ready-mix concrete cost per yard?",
        a: "Ready-mix pricing varies by region, mix strength and delivery distance — commonly somewhere in the $130–$200 per cubic yard range in the US, though local suppliers may quote higher or lower. Enter your own supplier's price per yard in the calculator above; this tool never assumes a national average for your estimate.",
      },
      {
        q: "Is this a concrete estimate calculator or just a quantity calculator?",
        a: "Both — enter dimensions to get concrete quantity, then add your material, labor and equipment costs to turn that quantity into a full project cost estimate and, with Contractor Pricing, a target-margin selling price.",
      },
      {
        q: "Is this the same as concrete estimating software?",
        a: "This free calculator handles one-off quantity and cost math. Concrete Estimate Pro (sometimes searched as concrete estimator software) adds saved rates, job costing, rate-health tracking, branded estimates and estimate-vs-actual reporting for running an ongoing concrete business.",
      },
    ],
  },
};

export function getConfig(slug: string): CalculatorConfig | undefined {
  return Object.values(CALCULATOR_CONFIGS).find((c) => c.slug === slug);
}
