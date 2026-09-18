export interface ToolPage {
  slug: string;
  title: string;
  description: string;
  intro: string;
  steps: string[];
  example: {
    title: string;
    intro: string;
    rows: [string, string][];
    takeaway: string;
  };
  sections: { title: string; paragraphs: string[] }[];
  faqs: { q: string; a: string }[];
  links: { href: string; label: string; why: string }[];
  pro: { title: string; body: string; cta: string; image: string; alt: string };
}

export const SUPPLY_TOOL_PAGES: Record<string, ToolPage> = {
  invoice: {
    slug: "concrete-invoice-template",
    title: "Concrete Invoice Template",
    description:
      "Create a free concrete invoice with quantities, rates, tax, deposits and balance due. Print or save a customer-ready PDF without signup.",
    intro:
      "Bill completed concrete work with a clear invoice. Enter your business and customer details, completed work, taxable line items and payments already received. Preview the balance due and print or save the invoice as a PDF.",
    steps: [
      "Enter the business, billing customer, invoice number, issue date and payment due date. Include the job address so the customer can identify the work.",
      "Add agreed charges for completed work. Each line uses quantity × rate; choose job, yd³, ft², hours or another unit that matches your agreement.",
      "Mark only the lines that are taxable under your applicable rules, enter the tax percentage and subtract deposits or payments already received.",
      "Check the scope and balance, then print. Your browser can save the clean invoice document as a PDF. Export before leaving; the free tool does not retain your entries.",
    ],
    example: {
      title: "Example: final invoice after a driveway pour",
      intro:
        "These are illustrative agreed customer charges, not supplier costs or market-price guidance. The example assumes only the material line is taxable at 6%.",
      rows: [
        ["Concrete charge: 12 yd³ × $200", "$2,400.00"],
        ["Completed placement and finishing", "$3,000.00"],
        ["Approved removal charge", "$600.00"],
        ["Subtotal", "$6,000.00"],
        ["Tax: $2,400 × 6%", "$144.00"],
        ["Invoice total", "$6,144.00"],
        ["Deposit received", "$2,000.00"],
        ["Balance due", "$4,144.00"],
      ],
      takeaway:
        "A deposit reduces the amount still due; it does not reduce the value of the completed work. List it once under payments received so it is not also deducted as a negative charge.",
    },
    sections: [
      {
        title: "Estimate, quote and invoice serve different stages",
        paragraphs: [
          "An estimate describes expected work and pricing before a job starts. A quote states the proposed price and scope for acceptance. This invoice documents agreed charges for completed work and the payment still due. Changing a document heading alone does not record deposits, tax or due dates; those fields belong in the billing document.",
          "Keep approved change orders identifiable. A line such as ‘Additional 200 ft² removal — approved September 12’ is easier to reconcile than a vague miscellaneous charge. Describe only work you can substantiate from your agreement and job records.",
        ],
      },
      {
        title: "Use customer charges, then reconcile payments",
        paragraphs: [
          "Your invoice rate is the agreed selling rate. It can differ from what you paid for concrete, labor or equipment. Putting internal supplier costs into the invoice by mistake can underbill the job and expose information you intended to keep private.",
          "Enter all received deposits and payments in the payments field. If the customer has paid more than the invoice total, the preview shows an overpayment credit rather than a negative balance due. The tool does not collect payments, send reminders or maintain an accounting ledger.",
        ],
      },
      {
        title: "Check tax and print before you leave",
        paragraphs: [
          "The taxable checkbox allows mixed taxable and non-taxable lines. Confirm which charges are taxable and the correct rate for your location; this calculator applies your selections and does not determine tax obligations. Each line and the final tax are rounded to cents so the displayed charges reconcile.",
          "Use a unique invoice number and a due date that follows the issue date. The Print / Save invoice as PDF button becomes available after required details and a positive valid total are present. Proofread the saved PDF, record it with your job paperwork and remove browser-added headers or footers in the print dialog if you do not want them.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is this invoice template free?",
        a: "Yes. You can edit the invoice, add charges, calculate tax and payments, and print or save a PDF without an account or purchase.",
      },
      {
        q: "Does it send invoices or accept online payments?",
        a: "No. Download the PDF and send it using your own email or billing process. Payment instructions are text on the document; they do not create a payment link or process a transaction.",
      },
      {
        q: "Can I invoice per square foot or cubic yard?",
        a: "Yes. Enter the unit, quantity and agreed price per unit. For lump-sum work, use quantity 1 and the agreed charge as the rate.",
      },
      {
        q: "Are invoices saved in Concrete Cost Pro?",
        a: "This free billing tool does not save invoices. The paid product focuses on estimating, saved business rates, the current estimate and estimate-versus-actual tracking; it is not an invoice archive or accounting system.",
      },
    ],
    links: [
      {
        href: "/concrete-estimate-template",
        label: "Prepare a concrete estimate or quote",
        why: "Use this before the customer approves the work; return to the invoice tool when billing completed work.",
      },
      {
        href: "/concrete-job-cost-calculator",
        label: "Check job cost and target-margin price",
        why: "Determine a sustainable selling price before agreeing to the charges you will invoice.",
      },
      {
        href: "/concrete-price-per-yard-calculator",
        label: "Compare delivered concrete prices",
        why: "Check supplier costs before setting customer material charges.",
      },
    ],
    pro: {
      title: "Price the work confidently before you invoice it",
      body: "Concrete Cost Pro saves your material, labor and equipment rates, combines project sections and calculates the selling price needed for your target margin. Create a customer-facing estimate and compare the current job with its actual result. Keep invoicing in your existing billing process.",
      cta: "See Pro estimating and pricing",
      image: "/guide/09-estimate-summary.png",
      alt: "Concrete Cost Pro customer estimate with scope and price, separate from internal job costs",
    },
  },
  readyMix: {
    slug: "ready-mix-concrete-cost-calculator",
    title: "Ready-Mix Concrete Cost Calculator",
    description:
      "Calculate ready-mix order cost from cubic yards and your supplier rate, including delivery, short-load fees, pumping, other charges and tax.",
    intro:
      "Already know how many cubic yards to order? Enter your supplier's quoted rate and order-level fees to calculate the full ready-mix purchase cost. This tool prices the supply order; it does not estimate installation labor or your customer selling price.",
    steps: [
      "Use the final order quantity in cubic yards, including any allowance and supplier rounding. Do not add the allowance again here.",
      "Enter the supplier's price per yard for the specified mix. Verify whether delivery or other charges are already included.",
      "Add delivery, short-load, pumping and other fees as totals for the whole order. Convert per-truck or per-hour fees to their full quoted amount first.",
      "Enter the effective tax percentage and review the material, fee and tax breakdown. Transfer the supplier cost into your complete job-cost estimate.",
    ],
    example: {
      title: "Example: an 8-yard ready-mix order",
      intro:
        "These sample charges illustrate the arithmetic. They are not current prices for your location. This example taxes the entire subtotal at 6%.",
      rows: [
        ["Concrete: 8 yd³ × $165", "$1,320.00"],
        ["Delivery", "$150.00"],
        ["Short-load charge", "$75.00"],
        ["Pumping allowance", "$300.00"],
        ["Other fees", "$0.00"],
        ["Subtotal", "$1,845.00"],
        ["Tax: $1,845 × 6%", "$110.70"],
        ["Total order cost", "$1,955.70"],
        ["Effective cost: $1,955.70 ÷ 8", "$244.46/yd³"],
      ],
      takeaway:
        "The quoted $165 per yard is the material rate. It becomes $244.46 per yard for this particular order after the entered fees and tax. Neither figure includes placement labor or contractor profit.",
    },
    sections: [
      {
        title: "Start with the supplier's actual charging terms",
        paragraphs: [
          "Ready-mix quotes can separate the material rate from delivery, minimum-load charges, waiting time, fuel surcharges and pumping. Ask which items are included so you do not add an included fee twice. A quote for one mix specification should not be treated as a quote for another.",
          "The delivery and short-load fields are order totals. If a supplier charges $120 for each of two deliveries, enter $240. If a short-load fee is charged for each missing yard below a minimum, calculate that quoted total first and enter it as a fee. The calculator does not assume truck capacity or a supplier's minimum load.",
        ],
      },
      {
        title: "Separate concrete procurement from the installed job",
        paragraphs: [
          "This result answers ‘What will this ready-mix order cost?’ An installed job also needs labor, site preparation, formwork, reinforcement, finishing and any other project expenses. Those costs belong in the project calculator or job-cost calculator rather than being hidden inside your supplier's material rate.",
          "Pumping is available here because it may appear on the procurement quote. If you include it in this supply total, do not count the same pumping charge again under job equipment. Keep your cost records consistent so the complete estimate reflects each expense once.",
        ],
      },
      {
        title: "Tax and order size change the final amount",
        paragraphs: [
          "The tax input applies to every entered charge. Where the supplier taxes only part of the subtotal, use the effective percentage: quoted tax amount ÷ entered subtotal × 100. A supplier quote with $90 tax on a $1,800 subtotal has an effective rate of 5%, regardless of how individual charges are classified.",
          "Changing order quantity changes the concrete charge while entered fixed fees stay fixed. Short-load charges or delivery counts may also change under your supplier's terms, so revise those fields when testing another quantity. Confirm the final amount with the supplier before booking the delivery.",
        ],
      },
    ],
    faqs: [
      {
        q: "Where do I get my ready-mix price?",
        a: "Request a current quote from a supplier for the specified mix, delivery address, order quantity and schedule. The sample rate in this tool is illustrative, not a national average or live supplier feed.",
      },
      {
        q: "Does the total include concrete installation?",
        a: "No. It includes only the material, supply fees, pumping and tax you enter. Use a project cost calculator for labor, forms, reinforcement, site costs and selling-price calculations.",
      },
      {
        q: "Should I add an order allowance here?",
        a: "No. Enter the already-adjusted order quantity. Use the pour calculator to calculate dimensions, allowance and order rounding first.",
      },
      {
        q: "Can I compare two suppliers?",
        a: "Use the Concrete Price Per Yard Calculator for two matching quotes. This page gives a detailed breakdown of one supply order.",
      },
    ],
    links: [
      {
        href: "/concrete-pour-calculator",
        label: "Calculate pour and order quantity",
        why: "Start here if you have dimensions but do not yet know your final cubic-yard order.",
      },
      {
        href: "/concrete-price-per-yard-calculator",
        label: "Compare supplier cost per yard",
        why: "Normalize two quotes with different material rates and delivery fees.",
      },
      {
        href: "/concrete-material-calculator",
        label: "Build a material purchase schedule",
        why: "Add specified formwork and reinforcement alongside your concrete purchase.",
      },
      {
        href: "/concrete-job-cost-calculator",
        label: "Turn supply cost into full job pricing",
        why: "Combine this purchase with labor and other costs, then account for overhead and target margin.",
      },
    ],
    pro: {
      title: "Keep your supplier rates ready for the next estimate",
      body: "Save ready-mix and other business rates in Concrete Cost Pro's catalog. Use them in project templates and multi-section estimates, then add labor, equipment and overhead to calculate the price required for your target margin. Your reusable data stays in this browser and can be exported as a backup.",
      cta: "Explore saved rates in Pro",
      image: "/guide/03-catalog.png",
      alt: "Concrete Cost Pro catalog showing saved ready-mix entries with supplier and unit cost",
    },
  },
  pour: {
    slug: "concrete-pour-calculator",
    title: "Concrete Pour Calculator",
    description:
      "Calculate concrete pour volume for multiple rectangular sections. See net cubic yards, allowance and the final order rounded to your chosen increment.",
    intro:
      "Calculate the concrete needed for one pour or several rectangular sections. Enter your specified length, width and thickness for each section, add an order allowance and round the combined quantity upward to your supplier's increment.",
    steps: [
      "Divide the pour into non-overlapping rectangular sections. Enter length and width in feet, and the specified concrete thickness or depth in inches.",
      "Add separate sections for changes in width or depth. Label each so you can reconcile it with your drawing or measurements.",
      "Set the allowance for your site and choose the supplier's order increment. The tool applies allowance to the combined net volume and rounds the total once.",
      "Review section volumes and the final cubic-yard order. Confirm dimensions and ordering terms before sending the quantity to your supplier.",
    ],
    example: {
      title: "Example: main pad plus a separate walkway",
      intro:
        "The dimensions below are arithmetic examples, not structural specifications. The pad and walkway do not overlap.",
      rows: [
        ["Pad: 20 ft × 10 ft × 4 in ÷ 324", "2.469 yd³"],
        ["Walkway: 30 ft × 3 ft × 4 in ÷ 324", "1.111 yd³"],
        ["Combined net volume", "3.580 yd³"],
        ["After 8% allowance", "3.867 yd³"],
        ["Round total upward to 0.25 yd³", "4.000 yd³"],
      ],
      takeaway:
        "Calculate the volume of each section first. Applying allowance and rounding once at the end avoids adding a separate rounding increment to every small section. This tool does not split the order into truckloads.",
    },
    sections: [
      {
        title: "The formula behind a concrete pour",
        paragraphs: [
          "For these input units, cubic yards = length in feet × width in feet × thickness in inches ÷ 324. The divisor combines 12 inches per foot and 27 cubic feet per cubic yard. For example, 20 × 10 × 4 ÷ 324 gives 2.469 cubic yards before allowance.",
          "A larger footprint or specified depth increases the volume directly. If thickness varies over the pour, use measured or design-specified sections rather than treating the deepest area as the thickness of the whole footprint. The tool does not choose thickness, strength, reinforcement or footing dimensions.",
        ],
      },
      {
        title: "Measure L-shapes without double-counting",
        paragraphs: [
          "Split an L-shaped footprint into two rectangles that meet at an edge. Do not use the full length of both legs if that counts the corner twice. For openings or excluded areas, calculate the remaining footprint as smaller positive rectangles; this calculator does not accept negative sections.",
          "Steps, slopes, curved edges and tapered footings may require geometry outside this rectangular tool. Break only genuinely rectangular parts into sections and obtain the remaining volume from a reliable drawing or takeoff. Do not disguise an unknown shape by guessing a rectangular dimension.",
        ],
      },
      {
        title: "Net volume, allowance and rounding are separate",
        paragraphs: [
          "Net volume is the geometric amount. Allowance is the additional percentage you select for site variation and handling. Order rounding is a further increase to the next available supplier increment. The result shows each addition so you can see why the ordered amount exceeds the measured pour.",
          "If sections will be poured on different days, run each delivery group separately because each order may have its own rounding and supply fees. An allowance is not a guarantee against shortage, and more concrete is not always better. Confirm subgrade conditions, dimensions and delivery planning with the people responsible for the work.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I calculate an L-shaped pour?",
        a: "Yes, if you split it into non-overlapping rectangles. Add each rectangle separately; do not count the shared corner twice.",
      },
      {
        q: "Why divide by 324 instead of 27?",
        a: "Thickness is entered in inches while length and width are feet. Dividing by 324 converts inches to feet and cubic feet to cubic yards in one step. If all dimensions were feet, the divisor would be 27.",
      },
      {
        q: "What allowance should I enter?",
        a: "Use the allowance appropriate to your measurements, site conditions and delivery plan. The sample 8% is for illustration; this tool does not prescribe a universal percentage.",
      },
      {
        q: "Can this calculate the pour cost too?",
        a: "This page focuses on quantity. Send the final order quantity to the ready-mix cost tool, or use a project-specific cost calculator to add installation costs.",
      },
    ],
    links: [
      {
        href: "/ready-mix-concrete-cost-calculator",
        label: "Price the final ready-mix order",
        why: "Use the order quantity from this result to add supplier rates and delivery fees.",
      },
      {
        href: "/concrete-material-calculator",
        label: "Plan other material purchases",
        why: "Add material schedule quantities for specified formwork and reinforcement.",
      },
      {
        href: "/concrete-slab-cost-calculator",
        label: "Estimate a complete slab project",
        why: "Include labor, forms, reinforcement and equipment for a slab installation.",
      },
      {
        href: "/concrete-footing-cost-calculator",
        label: "Calculate specified footing volume and cost",
        why: "Use inch-based footing width and depth with footing-specific cost guidance.",
      },
    ],
    pro: {
      title: "Carry multiple sections through to a customer estimate",
      body: "Concrete Cost Pro combines project sections with saved business rates, labor and equipment costs. Calculate true job cost and target-margin selling price, create a customer estimate and compare the current job's estimated and actual results. The free pour tool gives you quantity; Pro builds the estimating workflow.",
      cta: "See multi-section estimating in Pro",
      image: "/guide/06-wizard-dimensions.png",
      alt: "Concrete Cost Pro dimensions step with project sections and live concrete order quantity",
    },
  },
  material: {
    slug: "concrete-material-calculator",
    title: "Concrete Material Calculator",
    description:
      "Build a concrete material purchase schedule from your specified quantities. Add waste, round to purchase increments and calculate material costs.",
    intro:
      "Turn known material takeoff quantities into a purchase list. Enter concrete, formwork, specified reinforcement or other materials, apply a separate allowance to each and round purchases to the increments you can actually buy.",
    steps: [
      "Take the net quantity for each material from your measurements or specified material schedule. Enter its unit, such as yd³, linear feet, sheets or each.",
      "Set a waste or order allowance for that material. If your quantity already includes allowance, use 0% so it is not added twice.",
      "Enter the purchase increment in the same unit: 8 for an 8-foot board, 20 for a 20-foot bar, or 0.25 for quarter-yard concrete orders.",
      "Enter cost per unit, not per pack. Review the rounded purchase quantities and total material cost, then add delivery and installation separately.",
    ],
    example: {
      title: "Example: purchasing from a specified material schedule",
      intro:
        "The takeoff quantities and rates are examples. Reinforcement dimensions and quantities must come from the applicable specification; the tool does not design a bar layout.",
      rows: [
        ["Concrete: 5 yd³ + 8%, next 0.25 yd³", "5.50 yd³ × $165 = $907.50"],
        ["Form boards: 120 ft + 10%, next 8 ft", "136 ft × $2 = $272.00"],
        ["Specified bars: 400 ft + 5%, next 20 ft", "420 ft × $0.80 = $336.00"],
        ["Total material purchase cost", "$1,515.50"],
      ],
      takeaway:
        "An 8-foot board costing $16 has a cost of $2 per linear foot. Entering $16 as the per-foot cost would multiply the intended amount by eight. Keep quantity, purchase increment and unit cost in matching units.",
    },
    sections: [
      {
        title: "A purchase schedule is different from mix design",
        paragraphs: [
          "This tool answers how much of a listed material to purchase and what it costs. It starts with your known takeoff quantity. It does not determine cement, sand, aggregate or water proportions, specify reinforcement spacing, or substitute for a structural material schedule.",
          "Ready-mix quantity can come from the pour calculator. Form-board length, reinforcement totals, mesh sheets and other material quantities should come from measurements or the specified design. Because these are different units, the result keeps each material on its own row rather than adding incompatible quantities into one total.",
        ],
      },
      {
        title: "Round each material to the units you can buy",
        paragraphs: [
          "Purchase quantity = round upward to the purchase increment after applying the selected allowance. A 132-foot board requirement bought in 8-foot lengths becomes 136 feet. That is a purchasing total; it does not prove that a particular cutting layout will fit within 17 boards.",
          "Lengths lost to cuts, reinforcement laps, concrete allowance and sheet offcuts are different sources of additional material. Enter the known requirements and allowances appropriate to each line. Do not assume a single waste percentage works for every material, and do not add a second allowance to a schedule that already includes it.",
        ],
      },
      {
        title: "Keep purchase cost separate from delivery and labor",
        paragraphs: [
          "The price field is cost per unit displayed on the line. Divide a pack price by the number of units in the pack before entering it. For a $90 sheet, use unit ‘sheet’ and cost $90; for a $16 board measured in feet, use linear-foot cost instead.",
          "The material total excludes tax, delivery, equipment and placement labor. Include those once in your overall job cost. When pricing a supplier concrete order with short-load and delivery charges, use the ready-mix calculator so those fees are visible rather than buried in the material quantity or rate.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does this calculate cement, sand and gravel proportions?",
        a: "No. It builds a purchase schedule from your known specified quantities. It is not a concrete mix-design calculator and does not recommend ingredient proportions.",
      },
      {
        q: "Can I calculate reinforcement requirements?",
        a: "You can calculate a purchase quantity and cost from an already-specified reinforcement total. The tool does not determine bar sizes, spacing, laps, structural adequacy or code compliance.",
      },
      {
        q: "What if I already added waste to my takeoff?",
        a: "Enter the adjusted quantity and set waste to 0%. Purchase rounding can still apply, but the percentage will not be added again.",
      },
      {
        q: "Does purchase rounding optimize board or bar cuts?",
        a: "No. It rounds the total required length to your purchase increment. A cutting list can require more stock depending on individual lengths and offcuts; verify it separately.",
      },
    ],
    links: [
      {
        href: "/concrete-pour-calculator",
        label: "Calculate net concrete from dimensions",
        why: "Get geometric concrete volume before applying this schedule's allowance.",
      },
      {
        href: "/ready-mix-concrete-cost-calculator",
        label: "Add concrete delivery and supply fees",
        why: "Use the final concrete order quantity to calculate full procurement cost.",
      },
      {
        href: "/concrete-job-cost-calculator",
        label: "Add labor, overhead and target margin",
        why: "Convert purchases into a complete contractor job-cost and pricing calculation.",
      },
      {
        href: "/concrete-invoice-template",
        label: "Invoice agreed charges for completed work",
        why: "Bill your customer after completion using selling charges, not these internal purchase costs.",
      },
    ],
    pro: {
      title: "Reuse material rates across future estimates",
      body: "Concrete Cost Pro keeps reusable material, labor and equipment rates in a local catalog. Build project templates from your own costs, combine sections into the current estimate and calculate a customer price using overhead and target margin. Export your reusable business data regularly for backup.",
      cta: "See the Pro catalog and templates",
      image: "/guide/04-templates.png",
      alt: "Concrete Cost Pro reusable project templates with order quantity, true cost and margin",
    },
  },
  pricePerYard: {
    slug: "concrete-price-per-yard-calculator",
    title: "Concrete Price Per Yard Calculator",
    description:
      "Compare two concrete supplier quotes by effective delivered price per yard. Include delivery, short-load charges, pumping and tax for the same order.",
    intro:
      "Compare two supplier quotes on the same cubic-yard order. A lower advertised material rate can cost more after fees. Enter both quotes to see each delivered total, effective cost per yard and the price difference for your order.",
    steps: [
      "Enter one shared cubic-yard order quantity. Compare the same specified mix, delivery address and schedule for both suppliers.",
      "Enter Supplier A's material rate and total quoted fees, then enter Supplier B's matching terms. Do not compare a material-only rate with an all-inclusive rate.",
      "Enter each quote's effective tax percentage. Charges included in an advertised delivered rate should not be added again as separate fees.",
      "Compare final order totals and effective cost per yard. Check availability, delivery conditions and specifications before choosing a supplier.",
    ],
    example: {
      title: "Example: the lower material rate is not the lower order cost",
      intro:
        "Both quotes cover 8 yd³ of the same mix with no short-load, pump or tax charges in this illustrative comparison.",
      rows: [
        ["Supplier A material: 8 × $155", "$1,240.00"],
        ["Supplier A delivery", "$250.00"],
        ["Supplier A total / effective rate", "$1,490.00 / $186.25 per yd³"],
        ["Supplier B material: 8 × $165", "$1,320.00"],
        ["Supplier B delivery", "$100.00"],
        ["Supplier B total / effective rate", "$1,420.00 / $177.50 per yd³"],
        ["Supplier B order saving", "$70.00"],
      ],
      takeaway:
        "Supplier B's material rate is $10 per yard higher but its delivery charge is $150 lower. At 8 yards it is cheaper overall. At 15 yards these particular fee/rate assumptions break even; any quantity-dependent fee changes must be entered separately.",
    },
    sections: [
      {
        title: "Quoted material rate versus effective delivered rate",
        paragraphs: [
          "A quoted rate is the charge for each cubic yard of material. Effective delivered rate is the total entered order cost divided by cubic yards ordered. It spreads fixed fees across this order so you can compare matching quotes in one unit.",
          "The formula is effective price per yard = (quantity × material rate + delivery + short-load + pumping + other fees + entered tax) ÷ quantity. This normalized rate applies to the tested order size. It is not a market average or a supplier's standing price for every order.",
        ],
      },
      {
        title: "Order size can reverse the comparison",
        paragraphs: [
          "A supplier with a low material rate and a high delivery fee may become cheaper as quantity increases. Another supplier may be better for a small job because its fixed fees are lower. Change the shared quantity to test the order you actually intend to book.",
          "The entered fees remain fixed when quantity changes. If another truck, a different short-load band or more pumping time is required, revise each quote accordingly. The tool does not infer supplier charging rules from one set of numbers, so a mathematical break-even is valid only while those fee assumptions still hold.",
        ],
      },
      {
        title: "Compare equivalent specifications before choosing",
        paragraphs: [
          "Two prices are comparable only when both suppliers are quoting the required mix and service. Confirm specifications, additives, delivery location, timing, waiting-time terms and included charges. A lower total for a different mix or narrower delivery service is not an equivalent saving.",
          "For tax that applies to only part of a quote, enter the effective rate: total quoted tax ÷ pre-tax subtotal × 100. This comparison ranks entered monetary cost; it does not rate supplier reliability, quality or availability. Once you choose, use the ready-mix cost page for the detailed single-order breakdown.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is this a live concrete price lookup?",
        a: "No. Enter current supplier quotes. The initial example values show how fees affect a comparison and do not represent prices in your area.",
      },
      {
        q: "Can the higher per-yard material quote be cheaper?",
        a: "Yes. Lower delivery or other fees can outweigh a higher material rate. Compare both entered order totals and effective delivered rates for your quantity.",
      },
      {
        q: "Does the lowest result tell me which supplier to use?",
        a: "It identifies the lower entered monetary cost. Confirm equivalent specifications, availability and delivery terms yourself before ordering.",
      },
      {
        q: "How is this different from the ready-mix cost calculator?",
        a: "This tool compares two matching supplier quotes using one shared quantity. The ready-mix tool provides a detailed cost breakdown for a single concrete supply order.",
      },
    ],
    links: [
      {
        href: "/ready-mix-concrete-cost-calculator",
        label: "Break down the selected ready-mix order",
        why: "Review material, fee and tax totals for the quote you choose.",
      },
      {
        href: "/concrete-pour-calculator",
        label: "Check the cubic-yard order quantity",
        why: "Calculate your sections, allowance and order increment before comparing suppliers.",
      },
      {
        href: "/concrete-cost-calculator",
        label: "Estimate installed project cost",
        why: "Add your labor, forms, reinforcement and equipment beyond the supplier quote.",
      },
      {
        href: "/concrete-invoice-template",
        label: "Create the completed-job invoice",
        why: "Use your agreed customer charges when billing; supplier cost is an internal expense.",
      },
    ],
    pro: {
      title: "Use current purchase costs to check your selling rates",
      body: "Save your chosen ready-mix rate in Concrete Cost Pro and reuse it in templates and the current estimate. Rate Health shows whether your standard project rates still reach the target margin. Supplier fees need to be included in the appropriate job-cost fields; Pro does not fetch or compare live supplier quotes.",
      cta: "Explore Pro Rate Health",
      image: "/guide/10-rate-health.png",
      alt: "Concrete Cost Pro Rate Health table showing standard rates, margins and required selling prices",
    },
  },
};
