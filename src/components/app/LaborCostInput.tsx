import { calculateLaborCost, formatCurrency, type LaborModeInput } from "../../lib/calc";
import { Field, NumberInput, Select } from "../ui/primitives";

export const DEFAULT_LABOR_INPUT: LaborModeInput = { mode: "flat", crewSize: 4, hours: 8, ratePerHour: 36, unitRatePerSqft: 3.25 };

export default function LaborCostInput({
  labor,
  laborCost,
  totalAreaSqFt,
  onChange,
}: {
  labor: LaborModeInput;
  laborCost: number;
  totalAreaSqFt: number;
  onChange: (laborCost: number, labor: LaborModeInput) => void;
}) {
  function update(patch: Partial<LaborModeInput>) {
    const next = { ...labor, ...patch };
    const resolved = next.mode === "flat" ? laborCost : calculateLaborCost(next, totalAreaSqFt);
    onChange(resolved, next);
  }

  return (
    <div className="flex flex-col gap-2">
      <Field label="Labor method">
        <Select value={labor.mode} onChange={(e) => update({ mode: e.target.value as LaborModeInput["mode"] })}>
          <option value="flat">Flat amount</option>
          <option value="hourly">Hourly (crew × hours × rate)</option>
          <option value="unit">Unit rate ($/ft²)</option>
        </Select>
      </Field>

      {labor.mode === "flat" && (
        <Field label="Labor ($)">
          <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
            <span className="flex items-center border-r border-border bg-warm-white px-2.5 text-sm text-muted">$</span>
            <NumberInput
              min={0}
              value={laborCost}
              onChange={(e) => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value), labor)}
              className="rounded-none border-0 shadow-none focus:border-0"
            />
          </div>
        </Field>
      )}

      {labor.mode === "hourly" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Crew size">
              <NumberInput min={0} value={labor.crewSize} onChange={(e) => update({ crewSize: parseFloat(e.target.value) || 0 })} />
            </Field>
            <Field label="Hours">
              <NumberInput min={0} value={labor.hours} onChange={(e) => update({ hours: parseFloat(e.target.value) || 0 })} />
            </Field>
            <Field label="Rate ($/hr)">
              <NumberInput min={0} value={labor.ratePerHour} onChange={(e) => update({ ratePerHour: parseFloat(e.target.value) || 0 })} />
            </Field>
          </div>
          <p className="text-xs text-muted">
            {labor.crewSize} crew × {labor.hours} hrs × {formatCurrency(labor.ratePerHour, { cents: true })}/hr ={" "}
            <span className="font-semibold text-ink">{formatCurrency(laborCost)}</span>
          </p>
        </>
      )}

      {labor.mode === "unit" && (
        <>
          <Field label="Rate per ft²">
            <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
              <span className="flex items-center border-r border-border bg-warm-white px-2.5 text-sm text-muted">$</span>
              <NumberInput
                min={0}
                step="0.01"
                value={labor.unitRatePerSqft}
                onChange={(e) => update({ unitRatePerSqft: parseFloat(e.target.value) || 0 })}
                className="rounded-none border-0 shadow-none focus:border-0"
              />
              <span className="flex items-center border-l border-border bg-warm-white px-2.5 text-sm text-muted">/ft²</span>
            </div>
          </Field>
          <p className="text-xs text-muted">
            {formatCurrency(labor.unitRatePerSqft, { cents: true })}/ft² × {totalAreaSqFt.toFixed(0)} ft² ={" "}
            <span className="font-semibold text-ink">{formatCurrency(laborCost)}</span>
          </p>
        </>
      )}
    </div>
  );
}
