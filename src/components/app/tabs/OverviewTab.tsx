import { useMemo } from "react";
import { PlusCircle } from "lucide-react";
import { useWorkspace } from "../../../lib/workspaceContext";
import { evaluateEstimate, evaluateEntity } from "../../../lib/estimateMath";
import { calculateMargin, formatCurrency, formatPercent } from "../../../lib/calc";
import { Badge, Button, Card, EmptyState, StatTile } from "../../ui/primitives";

export default function OverviewTab() {
  const { workspace, ready, seedSample, hasRealData } = useWorkspace();

  const kpis = useMemo(() => {
    const quoted = workspace.estimates.filter((e) => e.status === "sent" || e.status === "draft");
    const won = workspace.estimates.filter((e) => e.status === "accepted");
    const quotedTotal = quoted.reduce((s, e) => s + e.sellingPrice, 0);
    const wonTotal = won.reduce((s, e) => s + e.sellingPrice, 0);
    const expectedProfit = won.reduce((s, e) => s + (e.sellingPrice - evaluateEstimate(e).trueCost), 0);
    const margins = won.map((e) => calculateMargin(e.sellingPrice, evaluateEstimate(e).trueCost)).filter((m): m is number => m !== null);
    const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : null;
    return { quotedTotal, wonTotal, wonCount: won.length, expectedProfit, avgMargin };
  }, [workspace.estimates]);

  const rateHealthRows = useMemo(
    () =>
      workspace.templates.slice(0, 4).map((t) => {
        const result = evaluateEntity({
          sections: t.sections,
          allowancePercent: t.allowancePercent,
          rounding: t.rounding,
          costs: t.defaultCosts,
          overheadPercent: workspace.settings.defaultOverheadPercent,
          targetMarginPercent: workspace.settings.defaultTargetMarginPercent,
          sellingPrice: t.currentSellingPrice,
        });
        return { template: t, result };
      }),
    [workspace.templates, workspace.settings],
  );

  const recentEstimates = [...workspace.estimates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  if (!ready) return <div className="text-sm text-muted">Loading…</div>;

  if (!hasRealData && workspace.estimates.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader />
        <EmptyState
          title="Welcome to Concrete Cost Pro"
          desc="Load sample data to explore Rate Health, estimates and job costing — or start fresh with your own project."
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
      <PageHeader />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Quoted" value={formatCurrency(kpis.quotedTotal)} sub="Draft + sent estimates" />
        <StatTile label="Won" value={formatCurrency(kpis.wonTotal)} sub={`${kpis.wonCount} accepted`} />
        <StatTile label="Expected profit" value={formatCurrency(kpis.expectedProfit)} sub="On accepted jobs" tone="green" />
        <StatTile
          label="Average margin"
          value={formatPercent(kpis.avgMargin, 0)}
          sub="Across accepted jobs"
          tone={kpis.avgMargin !== null && kpis.avgMargin < workspace.settings.defaultTargetMarginPercent / 100 ? "red" : "green"}
        />
      </div>

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
                {rateHealthRows.map(({ template, result }) => (
                  <tr key={template.id}>
                    <td className="py-2.5 text-ink">{template.name}</td>
                    <td className="py-2.5 text-ink">{formatCurrency(template.currentSellingPrice)}</td>
                    <td className={`py-2.5 font-medium ${result.isBelowTarget ? "text-red" : "text-green"}`}>{formatPercent(result.currentMargin, 0)}</td>
                    <td className="py-2.5">
                      <Badge tone={result.isBelowTarget ? "red" : "green"}>{result.isBelowTarget ? "Needs review" : "On target"}</Badge>
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

      <Card title="Recent estimates">
        {recentEstimates.length === 0 ? (
          <p className="text-sm text-muted">No estimates yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {recentEstimates.map((e) => (
              <a key={e.id} href={`/app/estimates?id=${e.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-warm-white">
                <div>
                  <div className="text-sm font-medium text-ink">{e.projectName}</div>
                  <div className="text-xs text-muted">
                    {e.customerName} · {e.estimateNumber}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-ink">{formatCurrency(e.sellingPrice)}</span>
                  <StatusBadge status={e.status} />
                </div>
              </a>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-ink">Overview</h1>
        <p className="text-sm text-muted">Your business at a glance.</p>
      </div>
      <a href="/app/estimates?new=1">
        <Button>
          <PlusCircle size={16} /> New estimate
        </Button>
      </a>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "accepted" ? "green" : status === "declined" ? "red" : status === "sent" ? "amber" : "neutral";
  return <Badge tone={tone as any}>{status[0].toUpperCase() + status.slice(1)}</Badge>;
}
