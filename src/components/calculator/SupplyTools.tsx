import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  Field,
  NumberInput,
  Select,
  TextInput,
} from "../ui/primitives";
import { formatCurrency as currency, type Rounding } from "../../lib/calc";
import {
  supplierCost,
  pourQuantity,
  materialPurchase,
  type SupplierQuote,
} from "../../lib/supplyCalculators";
const formatCurrency = (value: number) => currency(value, { cents: true });

export function NumericField({
  id,
  label,
  value,
  onChange,
  positive = false,
  max,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  positive?: boolean;
  max?: number;
  hint?: string;
}) {
  const error =
    !Number.isFinite(value) ||
    value < 0 ||
    (positive && value === 0) ||
    (max !== undefined && value > max)
      ? `Enter ${positive ? "a positive number" : "zero or a positive number"}${max !== undefined ? ` up to ${max}` : ""}.`
      : null;
  return (
    <Field label={label} htmlFor={id} wide error={error} hint={hint}>
      <NumberInput
        id={id}
        value={value}
        min={positive ? 0.001 : 0}
        max={max}
        step="any"
        error={error}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
      {hint && (
        <span id={`${id}-hint`} className="sr-only">
          {hint}
        </span>
      )}
    </Field>
  );
}

function Result({
  children,
  title = "Your result",
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-xl border border-orange/25 bg-white p-5 shadow-sm"
    >
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-4" aria-live="polite">
        {children}
      </div>
    </section>
  );
}
function Row({
  label,
  value,
  major = false,
}: {
  label: string;
  value: string;
  major?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap justify-between gap-2 border-b border-border py-3 ${major ? "text-lg font-bold" : "text-sm"}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
function errorMessage(error: unknown) {
  return (
    <p role="alert" className="text-sm text-red">
      {error instanceof Error ? error.message : "Check your inputs."} Results
      are hidden until all inputs are valid.
    </p>
  );
}
const initialQuote: SupplierQuote = {
  quantity: 8,
  rate: 165,
  delivery: 150,
  shortLoad: 0,
  pump: 0,
  other: 0,
  taxPercent: 0,
};
const quoteFields = [
  ["rate", "Quoted price ($/yd³)"],
  ["delivery", "Delivery ($)"],
  ["shortLoad", "Short-load fees ($)"],
  ["pump", "Pumping ($)"],
  ["other", "Other supplier fees ($)"],
  ["taxPercent", "Effective tax (%)"],
] as const;

export function ReadyMixTool() {
  const [quote, setQuote] = useState(initialQuote);
  let output: ReactNode;
  try {
    const r = supplierCost(quote);
    output = (
      <>
        <Row label="Concrete material" value={formatCurrency(r.material)} />
        <Row label="Delivery and other fees" value={formatCurrency(r.fees)} />
        <Row label="Tax" value={formatCurrency(r.tax)} />
        <Row label="Total order cost" value={formatCurrency(r.total)} major />
        <Row
          label="Effective cost per yard"
          value={`${formatCurrency(r.effectiveRate)}/yd³`}
        />
        <p className="mt-4 text-sm text-muted">
          Supplier order cost only. Site labor, forms, reinforcement and your
          selling margin are separate.
        </p>
      </>
    );
  } catch (error) {
    output = errorMessage(error);
  }
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card title="Price your concrete order">
        <p className="mb-3 text-sm text-muted">
          Sample inputs, not a local quote. Replace every value with your
          supplier's terms. All money is USD.
        </p>
        <NumericField
          id="rm-quantity"
          label="Order quantity (yd³)"
          value={quote.quantity}
          positive
          onChange={(quantity) => setQuote({ ...quote, quantity })}
        />
        {quoteFields.map(([key, label]) => (
          <NumericField
            key={key}
            id={`rm-${key}`}
            label={label}
            value={quote[key]}
            max={key === "taxPercent" ? 100 : undefined}
            hint={
              key === "taxPercent"
                ? "Applied to the entire subtotal. If only some charges are taxable, use quoted tax ÷ subtotal × 100."
                : undefined
            }
            onChange={(value) => setQuote({ ...quote, [key]: value })}
          />
        ))}
      </Card>
      <Result title="Ready-mix order cost">{output}</Result>
    </div>
  );
}

export function PricePerYardTool() {
  const [quantity, setQuantity] = useState(8);
  const [quotes, setQuotes] = useState([
    { ...initialQuote, rate: 155, delivery: 250 },
    { ...initialQuote, rate: 165, delivery: 100 },
  ]);
  const update = (i: number, key: string, value: number) =>
    setQuotes(quotes.map((q, j) => (i === j ? { ...q, [key]: value } : q)));
  let output: ReactNode;
  try {
    const results = quotes.map((q) => supplierCost({ ...q, quantity }));
    const difference = Math.abs(results[0].total - results[1].total);
    output = (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          {results.map((r, i) => (
            <div key={i}>
              <h3 className="font-semibold">Supplier {i === 0 ? "A" : "B"}</h3>
              <Row label="Total order" value={formatCurrency(r.total)} />
              <Row
                label="Delivered cost/yd³"
                value={formatCurrency(r.effectiveRate)}
                major
              />
            </div>
          ))}
        </div>
        <p className="mt-5 font-semibold">
          {difference < 0.005
            ? "Both entered quotes have the same total."
            : `Supplier ${results[0].total < results[1].total ? "A" : "B"} costs ${formatCurrency(difference)} less for this order.`}
        </p>
        <p className="mt-2 text-sm text-muted">
          Compare matching mix specifications, quantity and delivery terms. This
          is a price comparison, not a supplier quality rating.
        </p>
      </>
    );
  } catch (error) {
    output = errorMessage(error);
  }
  return (
    <div className="space-y-6">
      <Card title="Compare the same order">
        <p className="text-sm text-muted">
          Illustrative USD quotes. Enter current quotes from your suppliers.
        </p>
        <NumericField
          id="py-quantity"
          label="Shared order quantity (yd³)"
          value={quantity}
          positive
          onChange={setQuantity}
        />
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        {quotes.map((q, i) => (
          <Card key={i} title={`Supplier ${i === 0 ? "A" : "B"}`}>
            {quoteFields.map(([key, label]) => (
              <NumericField
                key={key}
                id={`py-${i}-${key}`}
                label={label}
                value={q[key]}
                max={key === "taxPercent" ? 100 : undefined}
                hint={
                  key === "taxPercent"
                    ? "Tax applies to all entered charges; use an effective percentage if only part is taxable."
                    : undefined
                }
                onChange={(value) => update(i, key, value)}
              />
            ))}
          </Card>
        ))}
      </div>
      <Result title="Supplier price comparison">{output}</Result>
    </div>
  );
}

export function PourTool() {
  const [sections, setSections] = useState([
    { name: "Main pour", length: 20, width: 10, thickness: 4 },
  ]);
  const [allowance, setAllowance] = useState(8);
  const [rounding, setRounding] = useState<Rounding>("quarter");
  const update = (index: number, key: string, value: number | string) =>
    setSections(
      sections.map((section, i) =>
        i === index ? { ...section, [key]: value } : section,
      ),
    );
  let output: ReactNode;
  try {
    const r = pourQuantity(sections, allowance, rounding);
    output = (
      <>
        {r.sections.map((volume, i) => (
          <Row
            key={i}
            label={`${sections[i].name || `Section ${i + 1}`} net volume`}
            value={`${volume.toFixed(3)} yd³`}
          />
        ))}
        <Row label="Combined net concrete" value={`${r.net.toFixed(3)} yd³`} />
        <Row
          label="Allowance volume"
          value={`${r.allowanceVolume.toFixed(3)} yd³`}
        />
        <Row
          label="Rounding addition"
          value={`${r.roundingVolume.toFixed(3)} yd³`}
        />
        <Row label="Order quantity" value={`${r.order.toFixed(3)} yd³`} major />
        <p className="mt-3 text-sm text-muted">
          Allowance is applied once to the combined volume, then the order is
          rounded upward once. Inputs are illustrative dimensions, not a
          thickness recommendation.
        </p>
      </>
    );
  } catch (error) {
    output = errorMessage(error);
  }
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        {sections.map((section, i) => (
          <Card key={i} title={`Pour section ${i + 1}`}>
            <Field label="Section name" htmlFor={`pour-name-${i}`} wide>
              <TextInput
                id={`pour-name-${i}`}
                value={section.name}
                onChange={(e) => update(i, "name", e.target.value)}
              />
            </Field>
            {(
              [
                ["length", "Length (ft)"],
                ["width", "Width (ft)"],
                ["thickness", "Specified thickness/depth (in)"],
              ] as const
            ).map(([key, label]) => (
              <NumericField
                key={key}
                id={`pour-${key}-${i}`}
                label={label}
                value={section[key]}
                positive
                onChange={(value) => update(i, key, value)}
              />
            ))}
            {sections.length > 1 && (
              <Button
                variant="ghost"
                onClick={() => setSections(sections.filter((_, j) => i !== j))}
              >
                <Trash2 size={16} /> Remove section {i + 1}
              </Button>
            )}
          </Card>
        ))}
        <Button
          variant="secondary"
          onClick={() =>
            setSections([
              ...sections,
              {
                name: `Section ${sections.length + 1}`,
                length: 10,
                width: 5,
                thickness: 4,
              },
            ])
          }
        >
          <Plus size={16} /> Add pour section
        </Button>
        <Card title="Order allowance and rounding">
          <NumericField
            id="pour-allowance"
            label="Order allowance (%)"
            value={allowance}
            max={100}
            onChange={setAllowance}
          />
          <Field label="Round total order up to" htmlFor="pour-rounding" wide>
            <Select
              id="pour-rounding"
              value={rounding}
              onChange={(e) => setRounding(e.target.value as Rounding)}
            >
              <option value="none">No rounding</option>
              <option value="quarter">Next 0.25 yd³</option>
              <option value="half">Next 0.5 yd³</option>
              <option value="whole">Next whole yd³</option>
            </Select>
          </Field>
        </Card>
      </div>
      <Result title="Concrete pour quantity">{output}</Result>
    </div>
  );
}

export function MaterialTool() {
  const [lines, setLines] = useState([
    {
      name: "Ready-mix concrete",
      unit: "yd³",
      quantity: 5,
      waste: 8,
      packSize: 0.25,
      unitCost: 165,
    },
    {
      name: "Form boards",
      unit: "linear ft",
      quantity: 120,
      waste: 10,
      packSize: 8,
      unitCost: 2,
    },
    {
      name: "Specified reinforcement",
      unit: "linear ft",
      quantity: 400,
      waste: 5,
      packSize: 20,
      unitCost: 0.8,
    },
  ]);
  const update = (index: number, key: string, value: number | string) =>
    setLines(
      lines.map((line, i) => (i === index ? { ...line, [key]: value } : line)),
    );
  let output: ReactNode;
  try {
    const results = lines.map(materialPurchase);
    output = (
      <>
        {results.map((r, i) => (
          <div key={i} className="border-b border-border py-3">
            <h3 className="font-semibold">
              {lines[i].name || `Material ${i + 1}`}
            </h3>
            <p className="mt-1 text-sm">
              Buy {r.order.toFixed(3)} {lines[i].unit} ·{" "}
              {formatCurrency(r.cost)}
            </p>
          </div>
        ))}
        <Row
          label="Total material purchase cost"
          value={formatCurrency(
            results.reduce((total, r) => total + r.cost, 0),
          )}
          major
        />
        <p className="mt-3 text-sm text-muted">
          Unit cost is per unit shown, not per pack. Delivery, tax, labor and
          equipment are excluded. No reinforcement layout or mix design is
          inferred.
        </p>
      </>
    );
  } catch (error) {
    output = errorMessage(error);
  }
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Sample takeoff quantities and USD rates. Replace them with your
          specified material schedule.
        </p>
        {lines.map((line, i) => (
          <Card key={i} title={`Material ${i + 1}`}>
            <Field label="Material name" htmlFor={`mat-name-${i}`} wide>
              <TextInput
                id={`mat-name-${i}`}
                value={line.name}
                onChange={(e) => update(i, "name", e.target.value)}
              />
            </Field>
            <Field label="Unit" htmlFor={`mat-unit-${i}`} wide>
              <TextInput
                id={`mat-unit-${i}`}
                value={line.unit}
                onChange={(e) => update(i, "unit", e.target.value)}
              />
            </Field>
            {(
              [
                ["quantity", "Net quantity"],
                ["waste", "Waste/allowance (%)"],
                ["packSize", "Purchase increment (units)"],
                ["unitCost", "Cost per unit ($)"],
              ] as const
            ).map(([key, label]) => (
              <NumericField
                key={key}
                id={`mat-${key}-${i}`}
                label={label}
                value={line[key]}
                positive={key === "packSize"}
                max={key === "waste" ? 100 : undefined}
                onChange={(value) => update(i, key, value)}
              />
            ))}
            {lines.length > 1 && (
              <Button
                variant="ghost"
                onClick={() => setLines(lines.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} /> Remove material {i + 1}
              </Button>
            )}
          </Card>
        ))}
        <Button
          variant="secondary"
          onClick={() =>
            setLines([
              ...lines,
              {
                name: "Additional material",
                unit: "each",
                quantity: 1,
                waste: 0,
                packSize: 1,
                unitCost: 0,
              },
            ])
          }
        >
          <Plus size={16} /> Add material
        </Button>
      </div>
      <Result title="Material purchase schedule">{output}</Result>
    </div>
  );
}
