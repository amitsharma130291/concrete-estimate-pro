import { useEffect } from "react";
import { formatCurrency, formatPercent, calculateMargin } from "../../lib/calc";
import { track } from "../../lib/analytics";

// Illustrative-only variance applied to the visitor's own numbers -- not derived from any
// observed data. Picked as a plausible, commonly-cited overrun range for concrete flatwork
// labor and materials, purely to demonstrate the *shape* of estimate-vs-actual tracking.
const EXAMPLE_LABOR_VARIANCE = 0.08;
const EXAMPLE_MATERIAL_VARIANCE = 0.05;

/**
 * Renders directly below the job-cost calculator's result. Uses the visitor's own entered
 * labor/materials/overhead/price -- never a separate hardcoded scenario -- and applies a
 * clearly-labeled illustrative variance to show what Concrete Cost Pro's real Estimate vs.
 * Actual feature compares, without claiming this is a real observed result.
 */
export default function EstimateVsActualExample({
  laborCost,
  materialsCost,
  otherDirectCost,
  overheadPercent,
  sellingPrice,
  estimatedTrueCost,
  estimatedMargin,
}: {
  laborCost: number;
  materialsCost: number;
  /** Every direct-cost line other than labor and materials (forms, reinforcement, pump, equipment, other) -- held constant in the example, since the illustrative variance is only applied to labor and materials. */
  otherDirectCost: number;
  overheadPercent: number;
  sellingPrice: number;
  estimatedTrueCost: number;
  estimatedMargin: number | null;
}) {
  useEffect(() => {
    track("sample_estimate_viewed", { calculator: "job-cost" });
  }, []);

  const exampleLabor = laborCost * (1 + EXAMPLE_LABOR_VARIANCE);
  const exampleMaterials = materialsCost * (1 + EXAMPLE_MATERIAL_VARIANCE);
  const exampleDirectCost = otherDirectCost + exampleLabor + exampleMaterials;
  const exampleTrueCost = exampleDirectCost * (1 + overheadPercent / 100);
  const exampleMargin = calculateMargin(sellingPrice, exampleTrueCost);

  const marginDiff = estimatedMargin !== null && exampleMargin !== null ? exampleMargin - estimatedMargin : null;

  const rows = [
    { label: "Labor", estimate: laborCost, example: exampleLabor, diff: exampleLabor - laborCost },
    { label: "Materials", estimate: materialsCost, example: exampleMaterials, diff: exampleMaterials - materialsCost },
  ];

  return (
    <div className="mt-6 rounded-xl border border-border bg-warm-white p-5">
      <h3 className="font-semibold text-ink">Example: what if the actual job runs over?</h3>
      <p className="mt-1.5 text-sm text-muted">
        Illustrative example, not a projection. Applies a common 5–8% cost variance to your own
        numbers above to show what Concrete Cost Pro's Estimate vs. Actual feature compares once
        a real job is finished.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-3 font-medium">Cost</th>
              <th className="py-2 pr-3 font-medium">Your estimate</th>
              <th className="py-2 pr-3 font-medium">Example actual</th>
              <th className="py-2 font-medium">Difference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="py-2.5 pr-3 font-medium text-ink">{r.label}</td>
                <td className="py-2.5 pr-3 text-ink">{formatCurrency(r.estimate)}</td>
                <td className="py-2.5 pr-3 text-ink">{formatCurrency(r.example)}</td>
                <td className="py-2.5 text-red">+{formatCurrency(r.diff)}</td>
              </tr>
            ))}
            <tr>
              <td className="py-2.5 pr-3 font-medium text-ink">Final margin</td>
              <td className="py-2.5 pr-3 text-ink">{formatPercent(estimatedMargin, 0)}</td>
              <td className="py-2.5 pr-3 text-ink">{formatPercent(exampleMargin, 0)}</td>
              <td className="py-2.5 text-red">{marginDiff !== null ? formatPercent(marginDiff, 0) : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        True cost at the example actual costs: {formatCurrency(exampleTrueCost)} (your estimate: {formatCurrency(estimatedTrueCost)}).
      </p>
    </div>
  );
}
