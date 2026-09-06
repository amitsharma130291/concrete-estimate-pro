import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useWorkspace } from "../../../lib/workspaceContext";
import { upsertBy } from "../../../lib/storage";
import { evaluateEntity } from "../../../lib/estimateMath";
import { formatCurrency, formatPercent } from "../../../lib/calc";
import { Badge, Button, Card, ConfirmDialog, EmptyState, NumberInput } from "../../ui/primitives";

export default function RateHealthTab() {
  const { workspace, update } = useWorkspace();
  const [readyMixChangePercent, setReadyMixChangePercent] = useState(0);
  const [laborChangePercent, setLaborChangePercent] = useState(0);
  const [equipmentChangePercent, setEquipmentChangePercent] = useState(0);
  const [targetMarginOverride, setTargetMarginOverride] = useState(workspace.settings.defaultTargetMarginPercent);
  const [confirmingApply, setConfirmingApply] = useState(false);
  const [appliedFlash, setAppliedFlash] = useState(false);

  const rows = useMemo(
    () =>
      workspace.templates.map((t) => {
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
          overheadPercent: workspace.settings.defaultOverheadPercent,
          targetMarginPercent: targetMarginOverride,
          sellingPrice: t.currentSellingPrice,
        });
        const scenario = evaluateEntity({
          sections: t.sections,
          allowancePercent: t.allowancePercent,
          rounding: t.rounding,
          costs: scenarioCosts,
          overheadPercent: workspace.settings.defaultOverheadPercent,
          targetMarginPercent: targetMarginOverride,
          sellingPrice: t.currentSellingPrice,
        });
        return { template: t, scenarioCosts, base, scenario };
      }),
    [workspace.templates, workspace.settings.defaultOverheadPercent, targetMarginOverride, readyMixChangePercent, laborChangePercent, equipmentChangePercent],
  );

  const scenarioActive = readyMixChangePercent !== 0 || laborChangePercent !== 0 || equipmentChangePercent !== 0;
  const belowTargetCount = rows.filter((r) => r.scenario.isBelowTarget).length;

  function applyScenario() {
    update((ws) => ({
      ...ws,
      templates: rows.reduce(
        (templates, r) => upsertBy(templates, { ...r.template, defaultCosts: r.scenarioCosts }),
        ws.templates,
      ),
    }));
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
          <ScenarioInput label="Ready mix change" value={readyMixChangePercent} onChange={setReadyMixChangePercent} />
          <ScenarioInput label="Labor change" value={laborChangePercent} onChange={setLaborChangePercent} />
          <ScenarioInput label="Equipment change" value={equipmentChangePercent} onChange={setEquipmentChangePercent} />
          <div>
            <label className="text-sm font-medium text-ink" htmlFor="rh-target">
              Target margin
            </label>
            <div className="mt-1 flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
              <NumberInput id="rh-target" value={targetMarginOverride} onChange={(e) => setTargetMarginOverride(parseFloat(e.target.value) || 0)} className="rounded-none border-0 shadow-none focus:border-0" />
              <span className="flex items-center border-l border-border bg-warm-white px-2.5 text-sm text-muted">%</span>
            </div>
          </div>
        </div>
        {scenarioActive && (
          <>
            <p className="mt-4 rounded-lg bg-amber-light px-3 py-2 text-sm text-amber">
              {belowTargetCount} of {rows.length} standard rates would fall below target under this scenario.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" onClick={() => setConfirmingApply(true)}>
                Apply to templates
              </Button>
              <span className="text-xs text-muted">
                Updates every template's saved costs permanently. Open estimates and projects are not affected.
              </span>
            </div>
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
                    <td className="py-2.5 text-muted">{targetMarginOverride}%</td>
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
          message={`This permanently updates the saved ready-mix, labor and equipment costs on all ${rows.length} template${rows.length === 1 ? "" : "s"} to reflect this scenario. It does not change any already-saved estimates or projects.`}
          confirmLabel="Apply"
          onConfirm={applyScenario}
          onCancel={() => setConfirmingApply(false)}
        />
      )}
    </div>
  );
}

function ScenarioInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-sm font-medium text-ink">{label}</label>
      <div className="mt-1 flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
        <NumberInput value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="rounded-none border-0 shadow-none focus:border-0" />
        <span className="flex items-center border-l border-border bg-warm-white px-2.5 text-sm text-muted">%</span>
      </div>
    </div>
  );
}
