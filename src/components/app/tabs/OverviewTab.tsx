import { useMemo } from "react";
import {
  PlusCircle,
  HelpCircle,
  ArrowRight,
  Settings as SettingsIcon,
  FileText,
  LayoutTemplate,
  Activity,
  Zap,
  ShieldCheck,
  Send,
  TrendingUp,
} from "lucide-react";
import { isUntouchedBlankEstimate, useWorkspace } from "../../../lib/workspaceContext";
import { evaluateEstimate, evaluateEntity } from "../../../lib/estimateMath";
import { formatCurrency, formatPercent } from "../../../lib/calc";
import { Badge, Button, Card, EmptyState, StatTile } from "../../ui/primitives";
import SaveStatusIndicator from "../SaveStatusIndicator";

const GETTING_STARTED = [
  { icon: SettingsIcon, title: "Set up your business", desc: "Logo, contact info and default rates — appears on every estimate you send.", href: "/app/settings" },
  { icon: FileText, title: "Build your first estimate", desc: "Dimensions, costs and pricing in one guided flow.", href: "/app/estimates?new=1" },
  { icon: LayoutTemplate, title: "Save your standard jobs", desc: "Turn a driveway or patio job into a reusable template.", href: "/app/templates" },
  { icon: Activity, title: "Check your Rate Health", desc: "See which standard prices are underpriced before you quote again.", href: "/app/rate-health" },
];

const FEATURE_HIGHLIGHTS = [
  { icon: Zap, title: "Estimate faster", desc: "Saved catalog, labor rates and templates — no more rebuilding a bid from scratch." },
  { icon: ShieldCheck, title: "Price with confidence", desc: "Overhead and target-margin pricing, plus a required-price solver for every job." },
  { icon: Send, title: "Win the job", desc: "Branded, customer-ready PDFs your competitors' spreadsheets can't match." },
  { icon: TrendingUp, title: "Track profitability", desc: "Log the actual job cost and see exactly where your estimate was right — or wrong." },
];

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

        <div className="overflow-hidden rounded-xl border border-border bg-charcoal text-white shadow-sm">
          <div className="relative overflow-hidden px-6 py-10 text-center sm:px-10">
            <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange/25 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <h2 className="text-2xl font-bold sm:text-3xl">Welcome to Concrete Cost Pro</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-white/70">
                You're all set up — load sample data to explore Rate Health and job costing, or jump straight into your
                own estimate.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button onClick={seedSample}>Load sample data</Button>
                <a href="/app/estimates?new=1">
                  <Button variant="secondary">Start a new estimate</Button>
                </a>
              </div>
              <a href="/how-to-use" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-orange-ondark hover:text-white">
                <HelpCircle size={15} />
                Read the full how-to-use guide
                <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>

        <Card title="Getting started" subtitle="Four steps to your first customer-ready estimate">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {GETTING_STARTED.map((step, i) => {
              const Icon = step.icon;
              return (
                <a
                  key={step.title}
                  href={step.href}
                  className="group flex items-start gap-3 rounded-lg border border-border p-3.5 transition hover:border-orange/40 hover:bg-warm-white"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warm-white text-xs font-bold text-muted group-hover:bg-orange group-hover:text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold text-ink">
                      <Icon size={15} className="shrink-0 text-orange" aria-hidden="true" />
                      {step.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">{step.desc}</span>
                  </span>
                </a>
              );
            })}
          </div>
        </Card>

        <Card title="What you get with Pro">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURE_HIGHLIGHTS.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-lg border border-border bg-warm-white p-4">
                  <Icon size={18} className="text-orange" aria-hidden="true" />
                  <div className="mt-2 font-semibold text-ink">{f.title}</div>
                  <div className="mt-1 text-sm text-muted">{f.desc}</div>
                </div>
              );
            })}
          </div>
        </Card>
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
