import { formatCurrency, formatPercent } from "../../lib/calc";
import { evaluateEstimate } from "../../lib/estimateMath";
import type { Estimate } from "../../lib/types";
import { useWorkspace } from "../../lib/workspaceContext";

/**
 * Customer-facing estimate document. Renders scope + total selling price only — true cost,
 * overhead, margin, markup, internal labor rate and required-price figures never appear
 * here UNLESS the contractor has explicitly turned on `estimate.showCostBreakdownOnPdf`
 * (off by default) — this is exactly what gets printed / saved as the customer PDF, so a
 * default-off toggle is the only way an internal figure can end up in a customer's hands.
 */
export default function EstimateDocument({ estimate }: { estimate: Estimate }) {
  const { businessProfile, preferences } = useWorkspace();
  const validUntil = new Date(new Date(estimate.createdAt).getTime() + preferences.estimateValidityDays * 86400000);
  const showBreakdown = estimate.showCostBreakdownOnPdf === true;
  const result = showBreakdown ? evaluateEstimate(estimate) : null;

  return (
    <div data-testid="estimate-document" className="rounded-xl border border-border bg-white p-6 shadow-sm print:border-0 print:shadow-none sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-start gap-3">
          {businessProfile.logoDataUrl && (
            <img src={businessProfile.logoDataUrl} alt="" className="h-12 w-12 shrink-0 object-contain" />
          )}
          <div>
            <div className="text-lg font-bold text-ink">{businessProfile.businessName || "Your Business Name"}</div>
            <div className="text-sm text-muted">{businessProfile.phone}</div>
            <div className="text-sm text-muted">{businessProfile.email}</div>
            <div className="text-sm text-muted break-words">{businessProfile.address}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-wide text-orange">Project Estimate</div>
          <div className="text-sm text-ink">{estimate.estimateNumber}</div>
          <div className="text-xs text-muted">Date {new Date(estimate.createdAt).toLocaleDateString("en-US")}</div>
          <div className="text-xs text-muted">Valid until {validUntil.toLocaleDateString("en-US")}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <div className="text-xs uppercase text-muted">Customer</div>
          <div className="font-medium text-ink break-words">{estimate.customerName}</div>
          {estimate.customerAddress && <div className="text-muted break-words">{estimate.customerAddress}</div>}
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase text-muted">Project</div>
          <div className="font-medium capitalize text-ink break-words">
            {estimate.projectName} &middot; {estimate.projectType}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-xs uppercase text-muted">Scope</div>
        <ul className="mt-2 space-y-1 text-sm text-ink">
          {estimate.sections.map((s) => (
            <li key={s.id} className="break-words">
              {s.name}: {s.lengthFt} ft &times; {s.widthFt} ft, {s.thicknessIn} in thick
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex items-center justify-between border-y border-border py-4">
        <span className="text-base font-semibold text-ink">Estimated project total</span>
        <span className="text-3xl font-bold text-green">{formatCurrency(estimate.sellingPrice)}</span>
      </div>

      {showBreakdown && result && (
        <div className="mt-4 rounded-lg border border-border bg-warm-white p-4 text-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Cost breakdown</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <BreakdownStat label="Direct cost" value={formatCurrency(result.directCost)} />
            <BreakdownStat label="Overhead" value={formatCurrency(result.overheadAmount)} />
            <BreakdownStat label="True cost" value={formatCurrency(result.trueCost)} />
            <BreakdownStat label="Margin" value={formatPercent(result.currentMargin, 0)} />
          </div>
        </div>
      )}

      {estimate.notes && <p className="mt-4 whitespace-pre-wrap text-xs text-muted break-words">{estimate.notes}</p>}
      <p className="mt-3 text-xs text-muted">
        This estimate covers the scope described above based on the dimensions provided. It does not include
        engineering, permitting or structural specification — those remain the customer's or their engineer's
        responsibility unless separately agreed in writing.
      </p>
    </div>
  );
}

function BreakdownStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="font-semibold text-ink">{value}</div>
    </div>
  );
}
