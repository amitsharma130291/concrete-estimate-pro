import { calculateQuantity, formatCurrency } from "../lib/calc";
import { CALCULATOR_CONFIGS } from "./calculatorConfigs";

interface ProjectGuide {
  title: string;
  explanation: string;
  checks: { title: string; body: string }[];
  exampleNote: string;
  next: { href: string; label: string; body: string }[];
}
export const PROJECT_GUIDES: Record<string, ProjectGuide> = {
  driveway: {
    title: "Measure driveway sections and separate replacement costs",
    explanation:
      "A driveway estimate can include the main approach, an apron and widened parking areas. Measure these as non-overlapping footprints and separate any areas with a different specified thickness. The calculator above handles one rectangular section; a combined pour can be checked in the free pour tool. Replacement work also needs a separate allowance for demolition, loading, hauling and disposal.",
    checks: [
      {
        title: "Keep the apron and parking pad identifiable",
        body: "A wide street apron or extra parking bay is easy to omit from a length-by-width shortcut. Record its footprint independently and make sure the shared edge is not counted twice. For slope or variable-depth work, use the specified quantities rather than assuming a flat rectangle captures every part.",
      },
      {
        title: "Record removal and access expenses",
        body: "Hauling the old driveway, protecting adjacent surfaces and reaching the pour with a truck or pump are different cost items. If your pump fee is already inside a supply quote, do not repeat it in equipment. Add preparation work to the relevant labor, equipment or other field.",
      },
      {
        title: "State exactly what the customer price covers",
        body: "Identify the approved footprint, specified thickness, finish, removal scope and exclusions in the estimate. A per-square-foot selling rate is only comparable when those inclusions match. Your required price comes from the entered costs and target margin; it is not a local market-price recommendation.",
      },
    ],
    exampleNote:
      "This sample represents only the main rectangular driveway. Price an apron or additional pad as another section and include demolition costs only if they are part of the actual scope.",
    next: [
      {
        href: "/concrete-pour-calculator",
        label: "Combine the driveway, apron and pad quantities",
        body: "Calculate one order without overlapping the corner areas.",
      },
      {
        href: "/concrete-price-per-yard-calculator",
        label: "Compare driveway concrete supplier quotes",
        body: "Use the same mix specification and delivery quantity for both suppliers.",
      },
      {
        href: "/concrete-invoice-template",
        label: "Bill the completed driveway work",
        body: "List approved selling charges and deduct deposits already received.",
      },
    ],
  },
  slab: {
    title: "Scope the slab beyond its rectangular footprint",
    explanation:
      "The slab calculator measures a rectangular volume from the thickness you supply. Thickened edges, separate pads and other changes in geometry need their own measured or specified quantities. It does not design a foundation or decide whether a slab needs a vapor barrier, reinforcement or any particular concrete strength. Include the specified work in your estimate so quantity and labor describe the same job.",
    checks: [
      {
        title: "Separate depth changes and excluded areas",
        body: "A uniform slab footprint does not automatically account for edge beams or deeper strips. Measure non-overlapping portions with their appropriate specified depths. For openings, calculate the remaining area as positive sections; do not count the excluded space as poured concrete.",
      },
      {
        title: "Account for preparation and finish work",
        body: "Base preparation, placing the specified vapor barrier, finishing, curing tasks and return visits can use material and crew time beyond the concrete delivery. Enter those agreed tasks once under the relevant cost fields. A polished floor and a simple utility pad should not share an assumed labor amount.",
      },
      {
        title: "Check the unit rate against the complete scope",
        body: "Square-foot pricing can hide fixed costs on a small pad or extra finish work on a large floor. Compare the total price with the fully entered job cost. The target-margin solver divides true cost by one minus your selected margin, rather than adding that margin as a markup.",
      },
    ],
    exampleNote:
      "The example is a uniform rectangular slab. It excludes any thickened edge, footing or opening and uses illustrative thickness and rate inputs rather than design or market guidance.",
    next: [
      {
        href: "/concrete-pour-calculator",
        label: "Calculate separate slab sections",
        body: "Use different specified depths where the rectangular geometry changes.",
      },
      {
        href: "/concrete-material-calculator",
        label: "Price the specified slab material schedule",
        body: "Convert known reinforcement, form and other quantities into purchases.",
      },
      {
        href: "/ready-mix-concrete-cost-calculator",
        label: "Include slab concrete delivery fees",
        body: "Check the order's supplier total rather than the material-only rate.",
      },
    ],
  },
  patio: {
    title: "Separate patio geometry from decorative finish charges",
    explanation:
      "Patios often have planting cutouts, adjoining paths or a separate step area. A bounding rectangle can overstate the concrete footprint if part of that rectangle will remain unpoured. Measure rectangular portions of the approved layout and obtain curved or tapered quantities from the applicable drawing. This calculator uses the thickness you enter and does not specify drainage or structural details.",
    checks: [
      {
        title: "Measure the actual poured footprint",
        body: "Record positive, non-overlapping sections around unpoured areas. Do not add a guessed percentage merely to compensate for an incorrect footprint. Steps and varying levels need their own appropriate geometry; the flat rectangular result does not automatically include them.",
      },
      {
        title: "Make the finish scope visible",
        body: "Color, stamping, sealing and protection of nearby landscaping can change material use and crew time. Add the quoted material and labor costs for the accepted finish. State whether sealing or a later visit is included so the customer estimate matches the work being priced.",
      },
      {
        title: "Price access and small-order fees",
        body: "Backyard access may require pumping or extra handling. A small patio order may also attract a supplier's short-load fee. Use the supply calculator to see these charges, then carry each expense into your job cost once; do not duplicate the same pump charge under two headings.",
      },
    ],
    exampleNote:
      "This example covers a rectangular patio only. Decorative finishes, landscaping protection and separate steps must be priced according to the actual approved job.",
    next: [
      {
        href: "/concrete-pour-calculator",
        label: "Check patio and adjoining path quantities",
        body: "Split the footprint into rectangles without counting planting cutouts.",
      },
      {
        href: "/ready-mix-concrete-cost-calculator",
        label: "Price a small patio concrete order",
        body: "Include quoted short-load charges and site delivery fees.",
      },
      {
        href: "/concrete-invoice-template",
        label: "Invoice the completed patio and approved extras",
        body: "Keep decorative changes identifiable and reconcile received deposits.",
      },
    ],
  },
  footing: {
    title: "Convert specified footing dimensions into a costed quantity",
    explanation:
      "Footing length, width and depth must come from the approved design or other responsible specification. This tool accepts inch-based width and depth so you can calculate a rectangular continuous run without manually converting those fields to feet. A footing with depth changes, isolated pads or a stepped profile requires quantities matched to that geometry. The result is quantity and pricing math, not an adequacy check.",
    checks: [
      {
        title: "Check inch and foot units before calculating",
        body: "A width of 24 inches is 2 feet, not 24 feet. Confirm the unit displayed beside width and the depth entered in inches. For separate pads, measure each rectangular footprint and depth; do not treat a collection of pads as one continuous run unless its net volume has been verified.",
      },
      {
        title: "Reconcile intersections and stepped sections",
        body: "Intersecting runs can count the same corner volume twice. Work from non-overlapping sections or a specified takeoff that already resolves intersections. Stepped footings and tapered profiles may require drawing-based quantities beyond the uniform rectangle supported above.",
      },
      {
        title: "Keep excavation and reinforcing work in scope",
        body: "Trenching, dewatering, spoil handling and the specified bar schedule affect labor and equipment independently of concrete volume. Use the specified reinforcement takeoff when purchasing bars. Do not infer spacing, laps, size or concrete strength from the cost calculator.",
      },
    ],
    exampleNote:
      "The sample is a uniform continuous run with illustrative design-specified dimensions. It does not establish frost depth, bearing capacity, reinforcing details or a suitable footing size.",
    next: [
      {
        href: "/concrete-material-calculator",
        label: "Price the specified footing bar schedule",
        body: "Start with known takeoff quantities and account for purchase increments.",
      },
      {
        href: "/concrete-pour-calculator",
        label: "Combine non-overlapping footing pour sections",
        body: "Convert width to feet in that tool and enter depth in inches.",
      },
      {
        href: "/ready-mix-concrete-cost-calculator",
        label: "Calculate the footing ready-mix purchase",
        body: "Use the required mix quote and delivery quantity from the approved plan.",
      },
    ],
  },
  sidewalk: {
    title: "Estimate walkway runs, crossings and restoration separately",
    explanation:
      "A sidewalk estimate starts with the actual measured runs and their specified widths and thicknesses. A narrow straight path is not the same scope as a crossing, ramp or right-of-way repair. Break changes in width or depth into non-overlapping sections, and price any separate features from the responsible specification. This tool does not set accessibility slopes, joint spacing or municipal construction requirements.",
    checks: [
      {
        title: "Separate runs with different geometry",
        body: "Measure the straight walkway, widened crossing and other portions individually where dimensions change. Use the pour calculator to total rectangular sections. Ramps or irregular transitions need the appropriate measured volume rather than a flat-strip shortcut.",
      },
      {
        title: "Include non-pour obligations",
        body: "Traffic management, permits, inspection scheduling, excavation, hauling and surrounding restoration may belong to the job scope. They consume money even when they add no concrete volume. Enter their quoted costs in labor, equipment or other and explain included work in the customer document.",
      },
      {
        title: "Allow for handling and finish time",
        body: "A long narrow path can require more moving and edge-form work per square foot than a broad pad. Price the crew time needed for access, the specified finish and joint work. Use your own rates; the sample labor input is a calculation example rather than a productivity benchmark.",
      },
    ],
    exampleNote:
      "The sample assumes one uniform rectangular walkway. It excludes ramps, crossings and restoration unless you add their quantities and costs separately.",
    next: [
      {
        href: "/concrete-pour-calculator",
        label: "Combine walkway runs and widened sections",
        body: "Calculate allowance and rounding for the complete delivery group.",
      },
      {
        href: "/concrete-material-calculator",
        label: "Plan forms and specified walkway materials",
        body: "Round known material requirements to actual purchase increments.",
      },
      {
        href: "/concrete-invoice-template",
        label: "Bill completed sidewalk and restoration work",
        body: "Show the agreed charges, received payments and remaining balance.",
      },
    ],
  },
  general: {
    title: "Choose the calculation that matches your next decision",
    explanation:
      "This general calculator starts with one rectangular footprint and adds the job costs you enter. Use it when you want quantity, installation cost and optional contractor pricing in the same calculation. If the next decision is ordering material, comparing suppliers or billing completed work, the focused tools below expose the relevant details without turning every workflow into the same generic estimate.",
    checks: [
      {
        title: "Quantity first, then procurement",
        body: "For several rectangular sections, the pour tool shows each net volume and one combined order. Use that final quantity in the ready-mix supply tool. It includes delivery, short-load fees and entered tax; those expenses should appear only once when you move into full job costing.",
      },
      {
        title: "Supplier comparison is a different calculation",
        body: "A lower quoted material rate does not necessarily produce a lower order total. Compare equivalent supplier quotes using the same quantity, specifications and delivery terms. The effective rate is total order cost divided by yards ordered, which applies only to the tested order size.",
      },
      {
        title: "Keep internal costs and customer charges distinct",
        body: "Material and crew costs are business expenses. A required selling price also accounts for overhead and your chosen margin. Put proposed customer charges in the estimate template, then use the invoice tool to record completed work, tax and received deposits. The free tools do not create an estimate archive.",
      },
    ],
    exampleNote:
      "This sample illustrates a custom rectangular pour. Replace dimensions and every rate with the actual project scope; specialized layouts need their own specified takeoff.",
    next: [
      {
        href: "/concrete-pour-calculator",
        label: "Calculate quantity for multiple pour sections",
        body: "Total separate rectangles before applying order allowance and rounding.",
      },
      {
        href: "/concrete-price-per-yard-calculator",
        label: "Compare two supplier quotes fairly",
        body: "Normalize material rates and fixed fees for the same order.",
      },
      {
        href: "/concrete-material-calculator",
        label: "Build the complete material purchase schedule",
        body: "Price known concrete, forms and specified reinforcement quantities.",
      },
      {
        href: "/concrete-invoice-template",
        label: "Create a completed-work invoice",
        body: "Bill agreed customer charges and reconcile deposits and tax.",
      },
    ],
  },
};

export function projectWorkedExample(key: string) {
  const { defaults: d } = CALCULATOR_CONFIGS[key];
  const widthFt = d.widthUnit === "in" ? d.widthValue / 12 : d.widthValue;
  const quantity = calculateQuantity({
    lengthFt: d.lengthFt,
    widthFt,
    thicknessIn: d.thicknessIn,
    allowancePercent: d.allowancePercent,
    rounding: "quarter",
  });
  return {
    dimensions: `${d.lengthFt} ft × ${d.widthValue} ${d.widthUnit} × ${d.thicknessIn} in`,
    net: quantity.netCubicYards.toFixed(3),
    allowance: `${d.allowancePercent}%`,
    order: quantity.orderQuantityYd3.toFixed(2),
    material: formatCurrency(quantity.orderQuantityYd3 * d.readyMixRatePerYd3),
  };
}
