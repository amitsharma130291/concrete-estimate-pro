import { useEffect, useMemo, useRef, useState } from "react";
import { Coins, Calculator, TriangleAlert, ArrowRight } from "lucide-react";
import { Card, Field, NumberInput, Button, Badge } from "../ui/primitives";
import { calculateCost, calculateMargin, calculateRequiredSellingPrice, formatCurrency, formatPercent } from "../../lib/calc";
import { track } from "../../lib/analytics";

const emptyQty = { areaSqFt: 0, netCubicFeet: 0, netCubicYards: 0, orderQuantityYd3: 0 };

export default function JobCostCalculatorIsland() {
  const [readyMixCost, setReadyMixCost] = useState(2640);
  const [laborCost, setLaborCost] = useState(2100);
  const [formsCost, setFormsCost] = useState(480);
  const [reinforcementCost, setReinforcementCost] = useState(920);
  const [pumpCost, setPumpCost] = useState(750);
  const [equipmentCost, setEquipmentCost] = useState(300);
  const [otherCost, setOtherCost] = useState(150);

  const [overheadPercent, setOverheadPercent] = useState(15);
  const [targetMarginPercent, setTargetMarginPercent] = useState(30);
  const [sellingPrice, setSellingPrice] = useState(9800);

  const cost = useMemo(
    () =>
      calculateCost(
        emptyQty,
        {
          readyMixRatePerYd3: 0,
          laborCost,
          formsCost,
          reinforcementCost,
          equipmentCost: equipmentCost + pumpCost,
          otherCost,
        },
        overheadPercent,
      ),
    [laborCost, formsCost, reinforcementCost, equipmentCost, pumpCost, otherCost, overheadPercent],
  );
  // Ready mix is a flat entered cost here (no quantity math), so add it directly.
  const directCost = cost.directCost + readyMixCost;
  const overheadAmount = directCost * (overheadPercent / 100);
  const trueCost = directCost + overheadAmount;
  const requiredSellingPrice = calculateRequiredSellingPrice(trueCost, targetMarginPercent);
  const currentMargin = calculateMargin(sellingPrice, trueCost);
  const isBelowTarget = currentMargin !== null && currentMargin < targetMarginPercent / 100;

  const wasBelowTarget = useRef(false);
  useEffect(() => {
    if (isBelowTarget && !wasBelowTarget.current) {
      track("margin_warning_viewed", { calculator: "job-cost" });
    }
    wasBelowTarget.current = isBelowTarget;
  }, [isBelowTarget]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[60%_40%] lg:items-start">
      <div className="flex flex-col gap-6">
        <Card title="Job Costs" icon={<Coins size={18} />} subtitle="Enter your known project costs">
          <DollarField label="Ready mix concrete" hint="Total concrete material cost" value={readyMixCost} onChange={setReadyMixCost} />
          <DollarField label="Labor" hint="Total labor cost" value={laborCost} onChange={setLaborCost} />
          <DollarField label="Forms (framing)" hint="Formwork materials and setup" value={formsCost} onChange={setFormsCost} />
          <DollarField label="Reinforcement" hint="Wire mesh, rebar, etc." value={reinforcementCost} onChange={setReinforcementCost} />
          <DollarField label="Pump" hint="Concrete pump rental" value={pumpCost} onChange={setPumpCost} />
          <DollarField label="Equipment" hint="Other equipment and miscellaneous" value={equipmentCost} onChange={setEquipmentCost} />
          <DollarField label="Other" hint="Permits, cleanup, misc." value={otherCost} onChange={setOtherCost} />
        </Card>

        <Card title="Overhead &amp; Margin" icon={<Calculator size={18} />} subtitle="Set your business targets">
          <Field label="Overhead" hint="% of direct cost added for business overhead" htmlFor="jc-overhead">
            <PercentInput id="jc-overhead" value={overheadPercent} onChange={setOverheadPercent} />
          </Field>
          <Field label="Target margin" hint="Minimum margin you want on this job" htmlFor="jc-margin">
            <PercentInput id="jc-margin" value={targetMarginPercent} onChange={setTargetMarginPercent} />
          </Field>
        </Card>
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <Card title="Job Cost Summary" icon={<Calculator size={18} />} subtitle="Based on your inputs">
          <div className="divide-y divide-border">
            <ResultRow label="Direct cost" value={formatCurrency(directCost)} sub="Sum of all job costs" />
            <ResultRow label="Overhead" value={formatCurrency(overheadAmount)} sub={`${overheadPercent}% of direct cost`} />
            <ResultRow label="True cost" value={formatCurrency(trueCost)} sub="Direct cost + overhead" big />

            <div className="py-3.5">
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="jc-price" className="text-sm font-medium text-ink">
                  Your selling price
                </label>
              </div>
              <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
                <span className="flex items-center border-r border-border bg-warm-white px-2.5 text-sm text-muted">$</span>
                <NumberInput
                  id="jc-price"
                  min={0}
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value === "" ? 0 : parseFloat(e.target.value))}
                  className="rounded-none border-0 text-lg font-semibold shadow-none focus:border-0"
                />
              </div>
            </div>

            <ResultRow label="Required selling price" value={formatCurrency(requiredSellingPrice)} sub={`At ${targetMarginPercent}% target margin`} tone="green" big />
            <ResultRow label="Current margin" value={formatPercent(currentMargin, 0)} sub="Based on your selling price" tone={isBelowTarget ? "red" : "green"} big />
          </div>

          {isBelowTarget ? (
            <div className="mt-4 rounded-lg border border-red/20 bg-red-light p-4">
              <div className="flex items-start gap-2.5">
                <TriangleAlert size={18} className="mt-0.5 shrink-0 text-red" aria-hidden="true" />
                <div>
                  <div className="text-sm font-semibold text-red">Below your {targetMarginPercent}% target</div>
                  <p className="mt-0.5 text-sm text-red">
                    Raise your price to {formatCurrency(requiredSellingPrice)} to hit at least {targetMarginPercent}%.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-green/20 bg-green-light p-4">
              <Badge tone="green">On target</Badge>
            </div>
          )}

          <a href="/pricing">
            <Button size="lg" className="mt-4 w-full">
              Track Every Job with Pro
              <ArrowRight size={18} />
            </Button>
          </a>
          <p className="mt-2 text-center text-xs text-muted">$79 launch price (reg. $99) • No subscription</p>
        </Card>
      </div>
    </div>
  );
}

function DollarField({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (v: number) => void }) {
  const id = `jc-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
        <span className="flex items-center border-r border-border bg-warm-white px-2.5 text-sm text-muted">$</span>
        <NumberInput id={id} min={0} value={value} onChange={(e) => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))} className="rounded-none border-0 shadow-none focus:border-0" />
      </div>
    </Field>
  );
}

function PercentInput({ id, value, onChange }: { id: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
      <NumberInput id={id} min={0} value={value} onChange={(e) => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))} className="rounded-none border-0 shadow-none focus:border-0" />
      <span className="flex items-center border-l border-border bg-warm-white px-2.5 text-sm text-muted">%</span>
    </div>
  );
}

function ResultRow({ label, value, sub, tone = "neutral", big = false }: { label: string; value: string; sub?: string; tone?: "neutral" | "green" | "red"; big?: boolean }) {
  const color = tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-ink";
  return (
    <div className="py-3.5">
      <div className="text-sm text-muted">{label}</div>
      <div className={`${big ? "text-3xl" : "text-2xl"} font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
