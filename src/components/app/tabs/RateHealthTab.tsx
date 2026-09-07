import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { upsertBy, useWorkspace } from "../../../lib/workspaceContext";
import { evaluateEntity } from "../../../lib/estimateMath";
import { formatCurrency, formatPercent } from "../../../lib/calc";
import { targetMarginError } from "../../../lib/validation";
import { Badge, Button, Card, ConfirmDialog, EmptyState, NumberInput } from "../../ui/primitives";

export default function RateHealthTab() {
  const { templates, updateTemplates, preferences } = useWorkspace();
  const [readyMixChangePercent, setReadyMixChangePercent] = useState(0);
  const [laborChangePercent, setLaborChangePercent] = useState(0);
  const [equipmentChangePercent, setEquipmentChangePercent] = useState(0);
  const [targetMarginOverride, setTargetMarginOverride] = useState(preferences.defaultTargetMarginPercent);
  const [confirmingApply, setConfirmingApply] = useState(false);
  const [appliedFlash, setAppliedFlash] = useState(false);

  // An invalid (blank/negative/>=100) typed override falls back to the workspace default for
  // the actual calculation, so the table never renders NaN margins mid-edit -- the field
  // still shows the real typed value and its error, and "Apply to templates" stays blocked
  // (via hasInvalidChange below) until it's fixed.
  const effectiveTargetMargin = targetMarginError(targetMarginOverride) === null ? targetMarginOverride : preferences.defaultTargetMarginPercent;

  const rows = useMemo(
    () =>
      templates.map((t) => {
        const scenarioCosts = {
          readyMixRatePerYd3: t.defaultCosts.readyMixRatePerYd3 * (1 + readyMixChangePercent / 100),
          laborCost: t.defaultCosts.laborCost * (1 + laborChangePercent / 100),
          formsCost: t.defaultCosts.formsCost,
          reinforcementCost: t.defaultCosts.reinforcementCost,
          equipmentCost: t.defaultCosts.equipmentCost * (1 + equipmentChangePercent / 100),
          otherCost: t.defaultCosts.otherCost,
        };
        const base = evaluateEntity({
          sections: t.sections,
          allowancePercent: t.allowancePercent,
          rounding: t.rounding,
          costs: t.defaultCosts,
          overheadPercent: preferences.defaultOverheadPercent,
          targetMarginPercent: effectiveTargetMargin,
          sellingPrice: t.currentSellingPrice,
        });
        const scenario = evaluateEntity({
          sections: t.sections,
          allowancePercent: t.allowancePercent,
          rounding: t.rounding,
          costs: scenarioCosts,
          overheadPercent: preferences.defaultOverheadPercent,
          targetMarginPercent: effectiveTargetMargin,
          sellingPrice: t.currentSellingPrice,
        });
        return { template: t, scenarioCosts, base, scenario };
      }),
    [templates, preferences.defaultOverheadPercent, effectiveTargetMargin, readyMixChangePercent, laborChangePercent, equipmentChangePercent],
  );

  const scenarioActive = readyMixChangePercent !== 0 || laborChangePercent !== 0 || equipmentChangePercent !== 0;
  const belowTargetCount = rows.filter((r) => r.scenario.isBelowTarget).length;

  // A change below -100% would make the scenario cost negative, which calculateCost's
  // safeD() would silently clamp to $0 -- the same effective (and misleading) result as
  // exactly -100%. Block it instead: a cost cannot become *more* than fully eliminated.
  const readyMixError = changeError(readyMixChangePercent);
  const laborError = changeError(laborChangePercent);
  const equipmentError = changeError(equipmentChangePercent);
  const marginError = targetMarginError(targetMarginOverride);
  const hasInvalidChange = !!(readyMixError || laborError || equipmentError || marginError);

  function applyScenario() {
    updateTemplates((list) => rows.reduce((acc, r) => upsertBy(acc, { ...r.template, defaultCosts: r.scenarioCosts }), list));
    setReadyMixChangePercent(0);
    setLaborChangePercent(0);
    setEquipmentChangePercent(0);
    setConfirmingApply(false);
    setAppliedFlash(true);
    setTimeout(() => setAppliedFlash(false), 2500);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Rate Health</h1>
        <p className="text-sm text-muted">See which standard rates clear your target margin — and model cost changes before they hit you.</p>
      </div>

      <Card title="Scenario analysis" subtitle="Model a cost or margin change across every template">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <ScenarioInput label="Ready mix change" value={readyMixChangePercent} error={readyMixError} onChange={setReadyMixChangePercent} />
          <ScenarioInput label="Labor change" value={laborChangePercent} error={laborError} onChange={setLaborChangePercent} />
          <ScenarioInput label="Equipment change" value={equipmentChangePercent} error={equipmentError} onChange={setEquipmentChangePercent} />
          <div>
            <label className="text-sm font-medium text-ink" htmlFor="rh-target">
              Target margin
            </label>
            <div className="mt-1 flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
              <NumberInput
                id="rh-target"
                value={targetMarginOverride}
                error={marginError}
                onChange={(e) => setTargetMarginOverride(e.target.value === "" ? NaN : parseFloat(e.target.value))}
                className="rounded-none border-0 shadow-none focus:border-0"
              />
              <span className="flex items-center border-l border-border bg-warm-white px-2.5 text-sm text-muted">%</span>
            </div>
            {marginError && (
              <span role="alert" className="text-xs font-medium text-red">
                {marginError}
              </span>
            )}
          </div>
        </div>
        {scenarioActive && (
          <>
            <p className="mt-4 rounded-lg bg-amber-light px-3 py-2 text-sm text-amber">
              {belowTargetCount} of {rows.length} standard rates would fall below target under this scenario.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" onClick={() => setConfirmingApply(true)} disabled={hasInvalidChange}>
                Apply to templates
              </Button>
              <span className="text-xs text-muted">
                Updates every template's saved costs permanently. Your current estimate is not affected, even if it
                was started from one of these templates.
              </span>
            </div>
            {hasInvalidChange && (
              <p role="alert" className="mt-2 text-sm font-medium text-red">
                Fix the highlighted field above before applying.
              </p>
            )}
          </>
        )}
        {appliedFlash && (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-green">
            <CheckCircle2 size={15} /> Applied — template costs updated.
          </p>
        )}
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="No templates yet" desc="Add templates for your standard job types to start tracking rate health." />
      ) : (
        <Card title="Standard rates">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted">
                  <th className="pb-2 font-medium">Project type</th>
                  <th className="pb-2 font-medium">Current rate</th>
                  <th className="pb-2 font-medium">True cost</th>
                  <th className="pb-2 font-medium">Margin</th>
                  <th className="pb-2 font-medium">Target</th>
                  <th className="pb-2 font-medium">Required price</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ template, scenario }) => (
                  <tr key={template.id}>
                    <td className="py-2.5 font-medium text-ink">{template.name}</td>
                    <td className="py-2.5 text-ink">{formatCurrency(template.currentSellingPrice)}</td>
                    <td className="py-2.5 text-ink">{formatCurrency(scenario.trueCost)}</td>
                    <td className={`py-2.5 font-medium ${scenario.isBelowTarget ? "text-red" : "text-green"}`}>{formatPercent(scenario.currentMargin, 0)}</td>
                    <td className="py-2.5 text-muted">{effectiveTargetMargin}%</td>
                    <td className="py-2.5 font-medium text-ink">{formatCurrency(scenario.requiredSellingPrice)}</td>
                    <td className="py-2.5">
                      <Badge tone={scenario.isBelowTarget ? "red" : "green"}>{scenario.isBelowTarget ? "Needs review" : "On target"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {confirmingApply && (
        <ConfirmDialog
          title="Apply cost changes to templates"
          message={`This permanently updates the saved ready-mix, labor and equipment costs on all ${rows.length} template${rows.length === 1 ? "" : "s"} to reflect this scenario. It does not change your current estimate, even if it was started from one of these templates.`}
          confirmLabel="Apply"
          onConfirm={applyScenario}
          onCancel={() => setConfirmingApply(false)}
        />
      )}
    </div>
  );
}

/** A change percent below -100% would make the scenario cost negative -- calculateCost's
 * safeD() would clamp it to $0, silently indistinguishable from exactly -100%. Blocked
 * instead of silently clamped, unlike the general blank/negative safeD() pattern, because
 * -100% is itself a legitimate value here (zeroing out a cost line on purpose). */
function changeError(value: number): string | null {
  if (Number.isNaN(value)) return "Required.";
  if (!Number.isFinite(value)) return "Enter a valid number.";
  if (value < -100) return "Cannot reduce a cost by more than 100%.";
  return null;
}

function ScenarioInput({ label, value, error, onChange }: { label: string; value: number; error?: string | null; onChange: (v: number) => void }) {
  const id = `rh-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <div className="mt-1 flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
        <NumberInput id={id} value={value} error={error} onChange={(e) => onChange(e.target.value === "" ? NaN : parseFloat(e.target.value))} className="rounded-none border-0 shadow-none focus:border-0" />
        <span className="flex items-center border-l border-border bg-warm-white px-2.5 text-sm text-muted">%</span>
      </div>
      {error && (
        <span role="alert" className="text-xs font-medium text-red">
          {error}
        </span>
      )}
    </div>
  );
}
