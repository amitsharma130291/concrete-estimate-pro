import { useState } from "react";
import { ArrowRight, Check, TriangleAlert } from "lucide-react";
import { evaluateEntity, combinedAreaSqFt } from "../../lib/estimateMath";
import { calculateMargin, formatCurrency, formatPercent, formatYd3, getZeroCostWarnings, type Rounding } from "../../lib/calc";
import { numberFieldError, parseRequiredNumber, targetMarginError } from "../../lib/validation";
import type { ProjectSection } from "../../lib/types";
import { Field, Modal, NumberInput, Select } from "../ui/primitives";

const COST_FIELDS = ["readyMixRatePerYd3", "laborCost", "formsCost", "reinforcementCost", "equipmentCost", "otherCost"] as const;
const REQUIRED_FIELDS = ["allowancePercent", "overheadPercent", "sellingPrice"] as const;

function configHasError(config: ScenarioConfig): boolean {
  return COST_FIELDS.some((f) => numberFieldError(config[f]) !== null) || REQUIRED_FIELDS.some((f) => numberFieldError(config[f]) !== null) || targetMarginError(config.targetMarginPercent) !== null;
}

export interface ScenarioConfig {
  label: string;
  allowancePercent: number;
  rounding: Rounding;
  readyMixRatePerYd3: number;
  laborCost: number;
  formsCost: number;
  reinforcementCost: number;
  equipmentCost: number;
  otherCost: number;
  overheadPercent: number;
  targetMarginPercent: number;
  sellingPrice: number;
}

export interface ScenarioResult {
  config: ScenarioConfig;
  orderQuantityYd3: number;
  trueCost: number;
  profit: number;
  margin: number | null;
}

function evaluate(sections: ProjectSection[], config: ScenarioConfig): ScenarioResult {
  const result = evaluateEntity({
    sections,
    allowancePercent: config.allowancePercent,
    rounding: config.rounding,
    costs: {
      readyMixRatePerYd3: config.readyMixRatePerYd3,
      laborCost: config.laborCost,
      formsCost: config.formsCost,
      reinforcementCost: config.reinforcementCost,
      equipmentCost: config.equipmentCost,
      otherCost: config.otherCost,
    },
    overheadPercent: config.overheadPercent,
    targetMarginPercent: config.targetMarginPercent,
    sellingPrice: config.sellingPrice,
  });
  return {
    config,
    orderQuantityYd3: result.orderQuantityYd3,
    trueCost: result.trueCost,
    profit: config.sellingPrice - result.trueCost,
    margin: calculateMargin(config.sellingPrice, result.trueCost),
  };
}

export default function ScenarioCompareModal({
  sections,
  initial,
  onApply,
  onClose,
}: {
  sections: ProjectSection[];
  initial: Omit<ScenarioConfig, "label">;
  onApply: (config: Omit<ScenarioConfig, "label">) => void;
  onClose: () => void;
}) {
  const [a, setA] = useState<ScenarioConfig>({ ...initial, label: "Scenario A" });
  const [b, setB] = useState<ScenarioConfig>({ ...initial, label: "Scenario B" });

  const resultA = evaluate(sections, a);
  const resultB = evaluate(sections, b);
  const diff = {
    trueCost: resultB.trueCost - resultA.trueCost,
    sellingPrice: b.sellingPrice - a.sellingPrice,
    profit: resultB.profit - resultA.profit,
  };

  function apply(config: ScenarioConfig) {
    const { label, ...rest } = config;
    onApply(rest);
    onClose();
  }

  return (
    <Modal title="Compare pricing scenarios" onClose={onClose} wide>
      <p className="mb-4 text-sm text-muted">
        Model two different finishes, material choices, labor assumptions or margins for the same job, then apply
        whichever one you want to the estimate.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ScenarioColumn config={a} onChange={setA} accent="border-border" areaSqFt={combinedAreaSqFt(sections)} />
        <ScenarioColumn config={b} onChange={setB} accent="border-orange" areaSqFt={combinedAreaSqFt(sections)} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-warm-white">
            <tr className="text-xs uppercase text-muted">
              <th className="px-3 py-2 font-medium">Metric</th>
              <th className="px-3 py-2 font-medium">Scenario A</th>
              <th className="px-3 py-2 font-medium">Scenario B</th>
              <th className="px-3 py-2 font-medium">Difference (B − A)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="px-3 py-2 text-muted">Order quantity</td>
              <td className="px-3 py-2 text-ink">{formatYd3(resultA.orderQuantityYd3)}</td>
              <td className="px-3 py-2 text-ink">{formatYd3(resultB.orderQuantityYd3)}</td>
              <td className="px-3 py-2 text-muted">{formatYd3(resultB.orderQuantityYd3 - resultA.orderQuantityYd3)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-muted">True cost</td>
              <td className="px-3 py-2 text-ink">{formatCurrency(resultA.trueCost)}</td>
              <td className="px-3 py-2 text-ink">{formatCurrency(resultB.trueCost)}</td>
              <td className={`px-3 py-2 font-medium ${diff.trueCost > 0 ? "text-red" : "text-green"}`}>
                {diff.trueCost >= 0 ? "+" : ""}
                {formatCurrency(diff.trueCost)}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-muted">Customer price</td>
              <td className="px-3 py-2 text-ink">{formatCurrency(a.sellingPrice)}</td>
              <td className="px-3 py-2 text-ink">{formatCurrency(b.sellingPrice)}</td>
              <td className="px-3 py-2 font-medium text-ink">
                {diff.sellingPrice >= 0 ? "+" : ""}
                {formatCurrency(diff.sellingPrice)}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-muted">Profit</td>
              <td className="px-3 py-2 font-medium text-ink">{formatCurrency(resultA.profit)}</td>
              <td className="px-3 py-2 font-medium text-ink">{formatCurrency(resultB.profit)}</td>
              <td className={`px-3 py-2 font-medium ${diff.profit >= 0 ? "text-green" : "text-red"}`}>
                {diff.profit >= 0 ? "+" : ""}
                {formatCurrency(diff.profit)}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-muted">Margin</td>
              <td className="px-3 py-2 font-medium text-ink">{formatPercent(resultA.margin, 0)}</td>
              <td className="px-3 py-2 font-medium text-ink">{formatPercent(resultB.margin, 0)}</td>
              <td className="px-3 py-2 text-muted">
                {resultA.margin !== null && resultB.margin !== null
                  ? `${(resultB.margin - resultA.margin) * 100 >= 0 ? "+" : ""}${((resultB.margin - resultA.margin) * 100).toFixed(0)}pp`
                  : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <button
            type="button"
            onClick={() => apply(a)}
            disabled={configHasError(a)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={16} /> Use Scenario A
          </button>
          {configHasError(a) && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-red">
              Fix the highlighted field in Scenario A first.
            </p>
          )}
        </div>
        <div>
          <button
            type="button"
            onClick={() => apply(b)}
            disabled={configHasError(b)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={16} /> Use Scenario B
            <ArrowRight size={14} />
          </button>
          {configHasError(b) && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-red">
              Fix the highlighted field in Scenario B first.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ScenarioColumn({
  config,
  onChange,
  accent,
  areaSqFt,
}: {
  config: ScenarioConfig;
  onChange: (c: ScenarioConfig) => void;
  accent: string;
  areaSqFt: number;
}) {
  function patch(p: Partial<ScenarioConfig>) {
    onChange({ ...config, ...p });
  }
  const slug = config.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const id = (field: string) => `${slug}-${field}`;
  const allowanceError = numberFieldError(config.allowancePercent);
  const overheadError = numberFieldError(config.overheadPercent);
  const marginError = targetMarginError(config.targetMarginPercent);
  const sellingPriceError = numberFieldError(config.sellingPrice);
  const zeroCostWarnings = getZeroCostWarnings(config, areaSqFt);

  return (
    <div className={`rounded-xl border-2 ${accent} p-4`}>
      <div className="mb-3 text-sm font-bold text-ink">{config.label}</div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Ready mix ($/yd³)" htmlFor={id("ready-mix")} error={numberFieldError(config.readyMixRatePerYd3)}>
          <NumberInput id={id("ready-mix")} min={0} value={config.readyMixRatePerYd3} error={numberFieldError(config.readyMixRatePerYd3)} onChange={(e) => patch({ readyMixRatePerYd3: parseRequiredNumber(e.target.value) })} />
        </Field>
        <Field label="Labor ($)" htmlFor={id("labor")} error={numberFieldError(config.laborCost)}>
          <NumberInput id={id("labor")} min={0} value={config.laborCost} error={numberFieldError(config.laborCost)} onChange={(e) => patch({ laborCost: parseRequiredNumber(e.target.value) })} />
        </Field>
        <Field label="Forms ($)" htmlFor={id("forms")} error={numberFieldError(config.formsCost)}>
          <NumberInput id={id("forms")} min={0} value={config.formsCost} error={numberFieldError(config.formsCost)} onChange={(e) => patch({ formsCost: parseRequiredNumber(e.target.value) })} />
        </Field>
        <Field label="Reinforcement ($)" htmlFor={id("reinforcement")} error={numberFieldError(config.reinforcementCost)}>
          <NumberInput id={id("reinforcement")} min={0} value={config.reinforcementCost} error={numberFieldError(config.reinforcementCost)} onChange={(e) => patch({ reinforcementCost: parseRequiredNumber(e.target.value) })} />
        </Field>
        <Field label="Equipment ($)" htmlFor={id("equipment")} error={numberFieldError(config.equipmentCost)}>
          <NumberInput id={id("equipment")} min={0} value={config.equipmentCost} error={numberFieldError(config.equipmentCost)} onChange={(e) => patch({ equipmentCost: parseRequiredNumber(e.target.value) })} />
        </Field>
        <Field label="Other ($)" htmlFor={id("other")} error={numberFieldError(config.otherCost)}>
          <NumberInput id={id("other")} min={0} value={config.otherCost} error={numberFieldError(config.otherCost)} onChange={(e) => patch({ otherCost: parseRequiredNumber(e.target.value) })} />
        </Field>
        <Field label="Allowance (%)" error={allowanceError}>
          <NumberInput value={config.allowancePercent} error={allowanceError} onChange={(e) => patch({ allowancePercent: parseRequiredNumber(e.target.value) })} />
        </Field>
        <Field label="Rounding">
          <Select value={config.rounding} onChange={(e) => patch({ rounding: e.target.value as Rounding })}>
            <option value="none">Exact</option>
            <option value="quarter">0.25 yd³</option>
            <option value="half">0.5 yd³</option>
            <option value="whole">1 yd³</option>
          </Select>
        </Field>
        <Field label="Overhead (%)" error={overheadError}>
          <NumberInput value={config.overheadPercent} error={overheadError} onChange={(e) => patch({ overheadPercent: parseRequiredNumber(e.target.value) })} />
        </Field>
        <Field label="Target margin (%)" error={marginError}>
          <NumberInput value={config.targetMarginPercent} error={marginError} onChange={(e) => patch({ targetMarginPercent: parseRequiredNumber(e.target.value) })} />
        </Field>
        <div className="col-span-2">
          <Field label="Selling price ($)" error={sellingPriceError}>
            <NumberInput value={config.sellingPrice} error={sellingPriceError} onChange={(e) => patch({ sellingPrice: parseRequiredNumber(e.target.value) })} />
          </Field>
        </div>
      </div>
      {zeroCostWarnings.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-amber/30 bg-amber-light px-3 py-2.5 text-xs text-amber" role="alert">
          {zeroCostWarnings.map((w) => (
            <div key={w} className="flex items-start gap-2">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
