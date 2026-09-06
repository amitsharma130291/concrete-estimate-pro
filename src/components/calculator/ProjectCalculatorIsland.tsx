import { useEffect, useMemo, useRef, useState } from "react";
import { Ruler, Coins, Calculator, TriangleAlert, ArrowRight } from "lucide-react";
import { Card, Field, NumberInput, Select, Button, Badge } from "../ui/primitives";
import { calculateEstimate, formatCurrency, formatPercent, formatYd3, type Rounding } from "../../lib/calc";
import type { CalculatorConfig } from "../../data/calculatorConfigs";
import { track } from "../../lib/analytics";

const OVERHEAD_DEFAULT = 15;
const TARGET_MARGIN_DEFAULT = 30;

function toFeet(value: number, unit: "ft" | "in"): number {
  return unit === "ft" ? value : value / 12;
}

export default function ProjectCalculatorIsland({ config }: { config: CalculatorConfig }) {
  const d = config.defaults;
  const [lengthFt, setLengthFt] = useState(d.lengthFt);
  const [widthValue, setWidthValue] = useState(d.widthValue);
  const [widthUnit, setWidthUnit] = useState<"ft" | "in">(d.widthUnit);
  const [thicknessIn, setThicknessIn] = useState(d.thicknessIn);
  const [allowancePercent, setAllowancePercent] = useState(d.allowancePercent);
  const [rounding, setRounding] = useState<Rounding>("quarter");

  const [readyMixRate, setReadyMixRate] = useState(d.readyMixRatePerYd3);
  const [laborCost, setLaborCost] = useState(d.laborCost);
  const [formsCost, setFormsCost] = useState(d.formsCost);
  const [reinforcementCost, setReinforcementCost] = useState(d.reinforcementCost);
  const [equipmentCost, setEquipmentCost] = useState(d.equipmentCost);
  const [otherCost, setOtherCost] = useState(d.otherCost);

  const [overheadPercent] = useState(OVERHEAD_DEFAULT);
  const [targetMarginPercent] = useState(TARGET_MARGIN_DEFAULT);

  const [sellingPrice, setSellingPrice] = useState<number>(() => {
    if (config.marketRatePerSqft > 0) {
      const defaultAreaSqFt = d.lengthFt * toFeet(d.widthValue, d.widthUnit);
      return Math.round(defaultAreaSqFt * config.marketRatePerSqft);
    }
    // Footings and other linear items: fall back to a modest markup over the default direct cost.
    const roughDirectCost =
      d.laborCost + d.formsCost + d.reinforcementCost + d.equipmentCost + d.otherCost + d.readyMixRatePerYd3 * 15;
    return Math.round(roughDirectCost * 1.15);
  });

  const widthFt = toFeet(widthValue, widthUnit);

  const result = useMemo(
    () =>
      calculateEstimate({
        dimensions: { lengthFt, widthFt, thicknessIn, allowancePercent, rounding },
        costs: {
          readyMixRatePerYd3: readyMixRate,
          laborCost,
          formsCost,
          reinforcementCost,
          equipmentCost,
          otherCost,
        },
        pricing: { overheadPercent, targetMarginPercent, sellingPrice },
      }),
    [lengthFt, widthFt, thicknessIn, allowancePercent, rounding, readyMixRate, laborCost, formsCost, reinforcementCost, equipmentCost, otherCost, overheadPercent, targetMarginPercent, sellingPrice],
  );

  const wasBelowTarget = useRef(false);
  useEffect(() => {
    if (result.pricing.isBelowTarget && !wasBelowTarget.current) {
      track("margin_warning_viewed", { calculator: config.slug });
    }
    wasBelowTarget.current = result.pricing.isBelowTarget;
  }, [result.pricing.isBelowTarget, config.slug]);

  const marginTone = result.pricing.isBelowTarget ? "text-red" : "text-green";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[60%_40%] lg:items-start">
      <div className="flex flex-col gap-6">
        <Card title="Project Dimensions" icon={<Ruler size={18} />} subtitle="Calculate your concrete volume">
          <Field label={config.length.label} hint={config.length.hint} htmlFor="f-length">
            <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
              <NumberInput
                id="f-length"
                min={0}
                value={lengthFt}
                onChange={(e) => setLengthFt(e.target.value === "" ? 0 : parseFloat(e.target.value))}
                className="rounded-none border-0 shadow-none focus:border-0"
              />
              <span className="flex items-center border-l border-border bg-warm-white px-2.5 text-sm text-muted">ft</span>
            </div>
          </Field>
          <Field label={config.width.label} hint={config.width.hint} htmlFor="f-width">
            <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
              <NumberInput
                id="f-width"
                min={0}
                value={widthValue}
                onChange={(e) => setWidthValue(e.target.value === "" ? 0 : parseFloat(e.target.value))}
                className="rounded-none border-0 shadow-none focus:border-0"
              />
              {config.width.allowUnitToggle ? (
                <select
                  value={widthUnit}
                  onChange={(e) => setWidthUnit(e.target.value as "ft" | "in")}
                  aria-label={`${config.width.label} unit`}
                  className="border-l border-border bg-warm-white px-2 text-sm text-muted focus:outline-none"
                >
                  <option value="ft">ft</option>
                  <option value="in">in</option>
                </select>
              ) : (
                <span className="flex items-center border-l border-border bg-warm-white px-2.5 text-sm text-muted">
                  {config.width.defaultUnit}
                </span>
              )}
            </div>
          </Field>
          <Field label={config.thickness.label} hint={config.thickness.hint} htmlFor="f-thick">
            <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
              <NumberInput
                id="f-thick"
                min={0}
                value={thicknessIn}
                onChange={(e) => setThicknessIn(e.target.value === "" ? 0 : parseFloat(e.target.value))}
                className="rounded-none border-0 shadow-none focus:border-0"
              />
              <span className="flex items-center border-l border-border bg-warm-white px-2.5 text-sm text-muted">in</span>
            </div>
          </Field>
          <Field label="Order allowance" hint="Extra for waste and overage" htmlFor="f-allow">
            <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
              <NumberInput
                id="f-allow"
                min={0}
                value={allowancePercent}
                onChange={(e) => setAllowancePercent(e.target.value === "" ? 0 : parseFloat(e.target.value))}
                className="rounded-none border-0 shadow-none focus:border-0"
              />
              <span className="flex items-center border-l border-border bg-warm-white px-2.5 text-sm text-muted">%</span>
            </div>
          </Field>
          <Field label="Round order to" hint="How you round the ready-mix order" htmlFor="f-round">
            <Select id="f-round" value={rounding} onChange={(e) => setRounding(e.target.value as Rounding)}>
              <option value="none">Exact amount</option>
              <option value="quarter">Nearest 0.25 yd³</option>
              <option value="half">Nearest 0.5 yd³</option>
              <option value="whole">Nearest 1 yd³</option>
            </Select>
          </Field>
        </Card>

        <Card title="Cost Inputs" icon={<Coins size={18} />} subtitle="Enter your estimated costs">
          <Field label="Ready mix concrete" hint="Cost per cubic yard" htmlFor="f-readymix">
            <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
              <span className="flex items-center border-r border-border bg-warm-white px-2.5 text-sm text-muted">$</span>
              <NumberInput
                id="f-readymix"
                min={0}
                value={readyMixRate}
                onChange={(e) => setReadyMixRate(e.target.value === "" ? 0 : parseFloat(e.target.value))}
                className="rounded-none border-0 shadow-none focus:border-0"
              />
              <span className="flex items-center border-l border-border bg-warm-white px-2.5 text-sm text-muted">/yd³</span>
            </div>
          </Field>
          <Field label="Labor" hint="Total labor cost" htmlFor="f-labor">
            <DollarInput id="f-labor" value={laborCost} onChange={setLaborCost} />
          </Field>
          <Field label="Forms (framing)" hint="Formwork materials and setup" htmlFor="f-forms">
            <DollarInput id="f-forms" value={formsCost} onChange={setFormsCost} />
          </Field>
          <Field label="Reinforcement" hint="Wire mesh, rebar, etc." htmlFor="f-reinf">
            <DollarInput id="f-reinf" value={reinforcementCost} onChange={setReinforcementCost} />
          </Field>
          <Field label="Equipment" hint="Pump, saw, equipment rental" htmlFor="f-equip">
            <DollarInput id="f-equip" value={equipmentCost} onChange={setEquipmentCost} />
          </Field>
          <Field label="Other" hint="Permits, cleanup, misc." htmlFor="f-other">
            <DollarInput id="f-other" value={otherCost} onChange={setOtherCost} />
          </Field>
        </Card>

        {config.safetyNote && (
          <div className="rounded-xl border border-border bg-warm-white p-4 text-sm text-muted">
            <strong className="text-ink">A note on scope: </strong>
            {config.safetyNote}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <Card title="Project Estimate" icon={<Calculator size={18} />} subtitle="Based on your inputs">
          <div className="divide-y divide-border">
            <ResultRow label="Order quantity" value={formatYd3(result.quantity.orderQuantityYd3)} sub={`Including ${allowancePercent}% allowance`} />
            <ResultRow label="Project cost" value={formatCurrency(result.cost.directCost)} sub="Total direct cost" />
            <ResultRow label="True cost" value={formatCurrency(result.cost.trueCost)} sub={`Direct cost + ${overheadPercent}% overhead`} />

            <div className="py-3.5">
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="f-price" className="text-sm font-medium text-ink">
                  Your selling price
                </label>
                <span className="text-xs text-muted">What you plan to quote</span>
              </div>
              <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
                <span className="flex items-center border-r border-border bg-warm-white px-2.5 text-sm text-muted">$</span>
                <NumberInput
                  id="f-price"
                  min={0}
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value === "" ? 0 : parseFloat(e.target.value))}
                  className="rounded-none border-0 text-lg font-semibold shadow-none focus:border-0"
                />
              </div>
            </div>

            <ResultRow
              label="Required selling price"
              value={formatCurrency(result.pricing.requiredSellingPrice)}
              sub={`At ${targetMarginPercent}% target margin`}
              tone="green"
              big
            />
            <ResultRow
              label="Current margin"
              value={formatPercent(result.pricing.currentMargin, 0)}
              sub="Based on your selling price"
              tone={result.pricing.isBelowTarget ? "red" : "green"}
              big
            />
          </div>

          {result.pricing.isBelowTarget ? (
            <div className="mt-4 rounded-lg border border-red/20 bg-red-light p-4">
              <div className="flex items-start gap-2.5">
                <TriangleAlert size={18} className="mt-0.5 shrink-0 text-red" aria-hidden="true" />
                <div>
                  <div className="text-sm font-semibold text-red">Below your {targetMarginPercent}% target</div>
                  <p className="mt-0.5 text-sm text-red">
                    Your current margin is {formatPercent(result.pricing.currentMargin, 0)}. Consider raising your price to{" "}
                    {formatCurrency(result.pricing.requiredSellingPrice)} to reach at least {targetMarginPercent}%.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-green/20 bg-green-light p-4">
              <Badge tone="green">On target</Badge>
              <p className="mt-1.5 text-sm text-ink/80">
                This price clears your {targetMarginPercent}% margin target by {formatPercent((result.pricing.currentMargin ?? 0) - targetMarginPercent / 100, 0)}.
              </p>
            </div>
          )}

          <a href="/pricing">
            <Button size="lg" className="mt-4 w-full">
              Fix My Pricing with Pro
              <ArrowRight size={18} />
            </Button>
          </a>
          <p className="mt-2 text-center text-xs text-muted">$79 launch price (reg. $99) • No subscription</p>
          <p className="mt-1 text-center text-xs text-muted">Get advanced pricing tools, save estimates, and more.</p>
        </Card>
      </div>

      {/* Mobile sticky summary */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">
              {formatYd3(result.quantity.orderQuantityYd3)} · {formatCurrency(result.pricing.requiredSellingPrice)}
            </div>
            <div className={`text-xs font-medium ${marginTone}`}>
              {formatPercent(result.pricing.currentMargin, 0)} margin {result.pricing.isBelowTarget ? `(below ${targetMarginPercent}%)` : "(on target)"}
            </div>
          </div>
          <a href="/pricing" className="shrink-0">
            <Button size="sm">View pricing</Button>
          </a>
        </div>
      </div>
      <div className="h-16 md:hidden" aria-hidden="true" />
    </div>
  );
}

function DollarInput({ id, value, onChange }: { id: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
      <span className="flex items-center border-r border-border bg-warm-white px-2.5 text-sm text-muted">$</span>
      <NumberInput
        id={id}
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
        className="rounded-none border-0 shadow-none focus:border-0"
      />
    </div>
  );
}

function ResultRow({
  label,
  value,
  sub,
  tone = "neutral",
  big = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "green" | "red";
  big?: boolean;
}) {
  const color = tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-ink";
  return (
    <div className="py-3.5">
      <div className="text-sm text-muted">{label}</div>
      <div className={`${big ? "text-3xl" : "text-2xl"} font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
