import { calculateLaborCost, formatCurrency, type LaborModeInput } from "../../lib/calc";
import { numberFieldError, parseRequiredNumber } from "../../lib/validation";
import { Field, NumberInput, Select } from "../ui/primitives";

export const DEFAULT_LABOR_INPUT: LaborModeInput = { mode: "flat", crewSize: 4, hours: 8, ratePerHour: 36, unitRatePerSqft: 3.25 };

/** Shared with every parent form (EstimateWizard, TemplatesTab) so Save/Continue
 * can be gated on whichever labor field is actually visible for the selected mode. */
export function laborInputError(labor: LaborModeInput, laborCost: number): string | null {
  if (labor.mode === "flat") return numberFieldError(laborCost);
  if (labor.mode === "hourly") return numberFieldError(labor.crewSize) ?? numberFieldError(labor.hours) ?? numberFieldError(labor.ratePerHour);
  return numberFieldError(labor.unitRatePerSqft);
}

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

  const laborCostError = numberFieldError(laborCost);
  const crewSizeError = numberFieldError(labor.crewSize);
  const hoursError = numberFieldError(labor.hours);
  const rateError = numberFieldError(labor.ratePerHour);
  const unitRateError = numberFieldError(labor.unitRatePerSqft);

  return (
    <div className="flex flex-col gap-2">
      <Field label="Labor method" wide>
        <Select value={labor.mode} onChange={(e) => update({ mode: e.target.value as LaborModeInput["mode"] })}>
          <option value="flat">Flat amount</option>
          <option value="hourly">Hourly (crew × hours × rate)</option>
          <option value="unit">Unit rate ($/ft²)</option>
        </Select>
      </Field>

      {labor.mode === "flat" && (
        <Field label="Labor ($)" error={laborCostError}>
          <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
            <span className="flex items-center border-r border-border bg-warm-white px-2.5 text-sm text-muted">$</span>
            <NumberInput
              value={laborCost}
              error={laborCostError}
              onChange={(e) => onChange(parseRequiredNumber(e.target.value), labor)}
              className="rounded-none border-0 shadow-none focus:border-0"
            />
          </div>
        </Field>
      )}

      {labor.mode === "hourly" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Crew size" error={crewSizeError}>
              <NumberInput value={labor.crewSize} error={crewSizeError} onChange={(e) => update({ crewSize: parseRequiredNumber(e.target.value) })} />
            </Field>
            <Field label="Job duration (hrs)" hint="Hours worked, not crew total" error={hoursError}>
              <NumberInput value={labor.hours} error={hoursError} onChange={(e) => update({ hours: parseRequiredNumber(e.target.value) })} />
            </Field>
            <Field label="Rate ($/hr)" hint="Per person, per hour" error={rateError}>
              <NumberInput value={labor.ratePerHour} error={rateError} onChange={(e) => update({ ratePerHour: parseRequiredNumber(e.target.value) })} />
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
          <Field label="Rate per ft²" error={unitRateError}>
            <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
              <span className="flex items-center border-r border-border bg-warm-white px-2.5 text-sm text-muted">$</span>
              <NumberInput
                step="0.01"
                value={labor.unitRatePerSqft}
                error={unitRateError}
                onChange={(e) => update({ unitRatePerSqft: parseRequiredNumber(e.target.value) })}
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
