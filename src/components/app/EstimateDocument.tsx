import { formatCurrency } from "../../lib/calc";
import type { Estimate } from "../../lib/types";
import { useWorkspace } from "../../lib/workspaceContext";

/**
 * Customer-facing estimate document. Only ever renders scope + total selling price —
 * true cost, overhead and margin are internal figures and must never appear here,
 * since this is exactly what gets printed / saved as the customer PDF.
 */
export default function EstimateDocument({ estimate }: { estimate: Estimate }) {
  const { workspace } = useWorkspace();
  const profile = workspace.businessProfile;
  const validUntil = new Date(new Date(estimate.createdAt).getTime() + workspace.settings.estimateValidityDays * 86400000);

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm print:border-0 print:shadow-none sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="text-lg font-bold text-ink">{profile.businessName || "Your Business Name"}</div>
          <div className="text-sm text-muted">{profile.phone}</div>
          <div className="text-sm text-muted">{profile.email}</div>
          <div className="text-sm text-muted">{profile.address}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-wide text-orange">Project Estimate</div>
          <div className="text-sm text-ink">{estimate.estimateNumber}</div>
          <div className="text-xs text-muted">Valid until {validUntil.toLocaleDateString("en-US")}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase text-muted">Customer</div>
          <div className="font-medium text-ink">{estimate.customerName}</div>
          {estimate.customerAddress && <div className="text-muted">{estimate.customerAddress}</div>}
        </div>
        <div>
          <div className="text-xs uppercase text-muted">Project</div>
          <div className="font-medium capitalize text-ink">
            {estimate.projectName} &middot; {estimate.projectType}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-xs uppercase text-muted">Scope</div>
        <ul className="mt-2 space-y-1 text-sm text-ink">
          {estimate.sections.map((s) => (
            <li key={s.id}>
              {s.name}: {s.lengthFt} ft &times; {s.widthFt} ft, {s.thicknessIn} in thick
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex items-center justify-between border-y border-border py-4">
        <span className="text-base font-semibold text-ink">Estimated project total</span>
        <span className="text-3xl font-bold text-green">{formatCurrency(estimate.sellingPrice)}</span>
      </div>

      {estimate.notes && <p className="mt-4 text-xs text-muted">{estimate.notes}</p>}
      <p className="mt-3 text-xs text-muted">
        This estimate covers the scope described above based on the dimensions provided. It does not include
        engineering, permitting or structural specification — those remain the customer's or their engineer's
        responsibility unless separately agreed in writing.
      </p>
    </div>
  );
}
