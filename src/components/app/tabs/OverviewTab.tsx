import { useMemo } from "react";
import { PlusCircle } from "lucide-react";
import { isUntouchedBlankEstimate, useWorkspace } from "../../../lib/workspaceContext";
import { evaluateEstimate, evaluateEntity } from "../../../lib/estimateMath";
import { formatCurrency, formatPercent } from "../../../lib/calc";
import { Badge, Button, Card, EmptyState, StatTile } from "../../ui/primitives";
import SaveStatusIndicator from "../SaveStatusIndicator";

export default function OverviewTab() {
  const { currentEstimate, templates, preferences, ready, seedSample, estimateSaveStatus, estimateLastSavedAt, estimateSaveError, storageAvailable } = useWorkspace();

  // "Nothing here yet" means genuinely nothing was ever loaded -- not `hasRealData` (which
  // deliberately excludes sample-flagged records too): after "Load sample data", the
  // current estimate and templates ARE sample-flagged, so this must still resolve to
  // "something to show" rather than looping back to the welcome screen.
  const isPristine = !!currentEstimate && isUntouchedBlankEstimate(currentEstimate) && templates.length === 0;

  const result = useMemo(() => (currentEstimate ? evaluateEstimate(currentEstimate) : null), [currentEstimate]);

  const rateHealthRows = useMemo(
    () =>
      templates.slice(0, 4).map((t) => {
        const r = evaluateEntity({
          sections: t.sections,
          allowancePercent: t.allowancePercent,
          rounding: t.rounding,
          costs: t.defaultCosts,
          overheadPercent: preferences.defaultOverheadPercent,
          targetMarginPercent: preferences.defaultTargetMarginPercent,
          sellingPrice: t.currentSellingPrice,
        });
        return { template: t, result: r };
      }),
    [templates, preferences],
  );

  if (!ready) return <div className="text-sm text-muted">Loading…</div>;

  if (isPristine) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader hasCurrentEstimate={false} />
        <EmptyState
          title="Welcome to Concrete Cost Pro"
          desc="Load sample data to explore Rate Health and job costing — or start fresh with your own estimate."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={seedSample}>Load sample data</Button>
              <a href="/app/estimates?new=1">
                <Button variant="ghost">Start a new estimate</Button>
              </a>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader hasCurrentEstimate={!!currentEstimate} />

      {currentEstimate && result ? (
        <Card title="Current estimate">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-ink">{currentEstimate.projectName || "Untitled project"}</div>
              <div className="text-xs text-muted">
                {currentEstimate.customerName || "No customer yet"} · {currentEstimate.estimateNumber}
              </div>
            </div>
            <StatusBadge status={currentEstimate.status} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Selling price" value={formatCurrency(currentEstimate.sellingPrice)} />
            <StatTile label="True cost" value={formatCurrency(result.trueCost)} />
            <StatTile
              label="Margin"
              value={formatPercent(result.currentMargin, 0)}
              tone={result.isBelowTarget ? "red" : "green"}
            />
            <StatTile label="Required price" value={formatCurrency(result.requiredSellingPrice)} />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <a href="/app/estimates" className="text-sm font-medium text-orange">
              Open current estimate &rarr;
            </a>
            <SaveStatusIndicator status={estimateSaveStatus} lastSavedAt={estimateLastSavedAt} errorMessage={estimateSaveError} storageAvailable={storageAvailable} />
          </div>
        </Card>
      ) : (
        <EmptyState title="No current estimate" desc="Start one to see it summarized here." action={<a href="/app/estimates?new=1"><Button>Start a new estimate</Button></a>} />
      )}

      <Card title="Rate Health" subtitle="Your standard job-type pricing">
        {rateHealthRows.length === 0 ? (
          <p className="text-sm text-muted">No templates yet. Add one from the Templates tab to track standard rates.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted">
                  <th className="pb-2 font-medium">Project type</th>
                  <th className="pb-2 font-medium">Rate</th>
                  <th className="pb-2 font-medium">Margin</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rateHealthRows.map(({ template, result: r }) => (
                  <tr key={template.id}>
                    <td className="py-2.5 text-ink">{template.name}</td>
                    <td className="py-2.5 text-ink">{formatCurrency(template.currentSellingPrice)}</td>
                    <td className={`py-2.5 font-medium ${r.isBelowTarget ? "text-red" : "text-green"}`}>{formatPercent(r.currentMargin, 0)}</td>
                    <td className="py-2.5">
                      <Badge tone={r.isBelowTarget ? "red" : "green"}>{r.isBelowTarget ? "Needs review" : "On target"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <a href="/app/rate-health" className="mt-3 inline-block text-sm font-medium text-orange">
          View full Rate Health &rarr;
        </a>
      </Card>
    </div>
  );
}

function PageHeader({ hasCurrentEstimate }: { hasCurrentEstimate: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-ink">Overview</h1>
        <p className="text-sm text-muted">Your business at a glance.</p>
      </div>
      <a href="/app/estimates?new=1">
        <Button>
          <PlusCircle size={16} /> {hasCurrentEstimate ? "New Estimate" : "New estimate"}
        </Button>
      </a>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "accepted" ? "green" : status === "completed" ? "green" : status === "declined" ? "red" : status === "sent" ? "amber" : "neutral";
  return <Badge tone={tone as any}>{status[0].toUpperCase() + status.slice(1)}</Badge>;
}
