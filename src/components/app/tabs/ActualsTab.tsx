import { useMemo, useState } from "react";
import { PlusCircle, Trash2 } from "lucide-react";
import { useWorkspace } from "../../../lib/workspaceContext";
import { newId, removeBy, upsertBy } from "../../../lib/storage";
import { evaluateProject } from "../../../lib/estimateMath";
import { calculateMargin, formatCurrency, formatPercent, formatYd3 } from "../../../lib/calc";
import type { ActualJobResult } from "../../../lib/types";
import { Button, Card, EmptyState, Field, Modal, NumberInput, Select } from "../../ui/primitives";

function blankActual(projectId: string): ActualJobResult {
  return {
    id: newId("act"),
    projectId,
    actualQuantityYd3: 0,
    actualLaborHours: 0,
    actualLaborCost: 0,
    actualMaterialCost: 0,
    actualEquipmentCost: 0,
    actualOtherCost: 0,
    finalSellingPrice: 0,
    completedAt: new Date().toISOString(),
  };
}

export default function ActualsTab() {
  const { workspace, update } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [preselectProjectId] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return new URLSearchParams(window.location.search).get("projectId") ?? undefined;
  });

  const eligibleProjects = workspace.projects.filter((p) => !workspace.actuals.some((a) => a.projectId === p.id));

  function save(a: ActualJobResult) {
    update((ws) => ({ ...ws, actuals: upsertBy(ws.actuals, a) }));
    setCreating(false);
  }
  function remove(id: string) {
    update((ws) => ({ ...ws, actuals: removeBy(ws.actuals, id) }));
  }

  const rows = useMemo(
    () =>
      workspace.actuals
        .map((a) => {
          const project = workspace.projects.find((p) => p.id === a.projectId);
          if (!project) return null;
          const est = evaluateProject(project);
          const actualCost = a.actualLaborCost + a.actualMaterialCost + a.actualEquipmentCost + a.actualOtherCost;
          const actualMargin = calculateMargin(a.finalSellingPrice, actualCost);
          const quantityVariance = est.orderQuantityYd3 > 0 ? (a.actualQuantityYd3 - est.orderQuantityYd3) / est.orderQuantityYd3 : null;
          return { actual: a, project, est, actualCost, actualMargin, quantityVariance };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    [workspace.actuals, workspace.projects],
  );

  const byType = useMemo(() => {
    const groups: Record<string, { count: number; estMarginSum: number; actMarginSum: number }> = {};
    for (const r of rows) {
      const key = r.project.projectType;
      groups[key] ??= { count: 0, estMarginSum: 0, actMarginSum: 0 };
      const estMargin = calculateMargin(r.project.sellingPrice, r.est.trueCost) ?? 0;
      groups[key].count += 1;
      groups[key].estMarginSum += estMargin;
      groups[key].actMarginSum += r.actualMargin ?? 0;
    }
    return groups;
  }, [rows]);

  // Estimated person-hours are only meaningful for projects whose labor was entered in
  // hourly mode (crew size x hours) — flat or unit-rate labor has no hours estimate to compare.
  const varianceByType = useMemo(() => {
    const groups: Record<
      string,
      { count: number; estQtySum: number; actQtySum: number; hoursCount: number; estHoursSum: number; actHoursSum: number }
    > = {};
    for (const r of rows) {
      const key = r.project.projectType;
      groups[key] ??= { count: 0, estQtySum: 0, actQtySum: 0, hoursCount: 0, estHoursSum: 0, actHoursSum: 0 };
      groups[key].count += 1;
      groups[key].estQtySum += r.est.orderQuantityYd3;
      groups[key].actQtySum += r.actual.actualQuantityYd3;
      if (r.project.labor?.mode === "hourly") {
        groups[key].hoursCount += 1;
        groups[key].estHoursSum += r.project.labor.crewSize * r.project.labor.hours;
        groups[key].actHoursSum += r.actual.actualLaborHours;
      }
    }
    return groups;
  }, [rows]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Actuals</h1>
          <p className="text-sm text-muted">Log real job results and see how they compare to your estimate.</p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={eligibleProjects.length === 0}>
          <PlusCircle size={16} /> Log actual result
        </Button>
      </div>

      {Object.keys(varianceByType).length > 0 && (
        <Card title="Historical quantity & labor variance" subtitle={rows.length < 5 ? "Small sample — treat as directional, not statistically reliable" : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted">
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Jobs</th>
                  <th className="pb-2 font-medium">Avg. est. quantity</th>
                  <th className="pb-2 font-medium">Avg. actual quantity</th>
                  <th className="pb-2 font-medium">Quantity variance</th>
                  <th className="pb-2 font-medium">Avg. est. labor hrs</th>
                  <th className="pb-2 font-medium">Avg. actual labor hrs</th>
                  <th className="pb-2 font-medium">Labor variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(varianceByType).map(([type, g]) => {
                  const avgEstQty = g.estQtySum / g.count;
                  const avgActQty = g.actQtySum / g.count;
                  const qtyVariance = avgEstQty > 0 ? (avgActQty - avgEstQty) / avgEstQty : null;
                  const hasHours = g.hoursCount > 0;
                  const avgEstHours = hasHours ? g.estHoursSum / g.hoursCount : null;
                  const avgActHours = hasHours ? g.actHoursSum / g.hoursCount : null;
                  const hoursVariance = hasHours && avgEstHours! > 0 ? (avgActHours! - avgEstHours!) / avgEstHours! : null;
                  return (
                    <tr key={type}>
                      <td className="py-2 capitalize text-ink">{type}</td>
                      <td className="py-2 text-ink">{g.count}</td>
                      <td className="py-2 text-ink">{formatYd3(avgEstQty)}</td>
                      <td className="py-2 text-ink">{formatYd3(avgActQty)}</td>
                      <td className={`py-2 font-medium ${qtyVariance !== null && qtyVariance > 0 ? "text-red" : "text-green"}`}>
                        {qtyVariance !== null ? `${qtyVariance >= 0 ? "+" : ""}${(qtyVariance * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-2 text-ink">{avgEstHours !== null ? `${avgEstHours.toFixed(1)} hrs` : "—"}</td>
                      <td className="py-2 text-ink">{avgActHours !== null ? `${avgActHours.toFixed(1)} hrs` : "—"}</td>
                      <td className={`py-2 font-medium ${hoursVariance !== null && hoursVariance > 0 ? "text-red" : "text-green"}`}>
                        {hoursVariance !== null ? `${hoursVariance >= 0 ? "+" : ""}${(hoursVariance * 100).toFixed(1)}%` : `— ${g.hoursCount === 0 ? "(no hourly-mode jobs)" : ""}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Labor variance only includes jobs whose labor was entered in hourly mode (crew size × hours) — flat or
            $/ft² labor has no hours estimate to compare against.
          </p>
        </Card>
      )}

      {Object.keys(byType).length > 0 && (
        <Card title="Historical profitability by project type" subtitle={rows.length < 5 ? "Small sample — treat as directional, not statistically reliable" : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted">
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Jobs</th>
                  <th className="pb-2 font-medium">Avg. expected margin</th>
                  <th className="pb-2 font-medium">Avg. actual margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(byType).map(([type, g]) => (
                  <tr key={type}>
                    <td className="py-2 capitalize text-ink">{type}</td>
                    <td className="py-2 text-ink">{g.count}</td>
                    <td className="py-2 text-ink">{formatPercent(g.estMarginSum / g.count, 0)}</td>
                    <td className={`py-2 font-medium ${g.actMarginSum / g.count < g.estMarginSum / g.count ? "text-red" : "text-green"}`}>
                      {formatPercent(g.actMarginSum / g.count, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="No actuals logged yet"
          desc="Mark a project as Completed, then log its actual quantity, labor and costs here to compare against your estimate."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map(({ actual, project, est, actualCost, actualMargin, quantityVariance }) => (
            <Card key={actual.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-ink">{project.name}</div>
                  <div className="text-xs text-muted">Completed {new Date(actual.completedAt).toLocaleDateString("en-US")}</div>
                </div>
                <button type="button" onClick={() => remove(actual.id)} aria-label="Delete actual" className="rounded-lg p-1.5 text-muted hover:bg-red-light hover:text-red">
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <Compare label="Quantity" estimated={formatYd3(est.orderQuantityYd3)} actual={formatYd3(actual.actualQuantityYd3)} variancePercent={quantityVariance} />
                <Compare label="Cost" estimated={formatCurrency(est.trueCost)} actual={formatCurrency(actualCost)} variancePercent={est.trueCost > 0 ? (actualCost - est.trueCost) / est.trueCost : null} />
                <Compare
                  label="Margin"
                  estimated={formatPercent(calculateMargin(project.sellingPrice, est.trueCost), 0)}
                  actual={formatPercent(actualMargin, 0)}
                  variancePercent={null}
                />
                <div>
                  <div className="text-xs text-muted">Final price</div>
                  <div className="font-medium text-ink">{formatCurrency(actual.finalSellingPrice)}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <ActualEditor
          projects={eligibleProjects}
          initialProjectId={preselectProjectId}
          onSave={save}
          onCancel={() => setCreating(false)}
        />
      )}
    </div>
  );
}

function Compare({ label, estimated, actual, variancePercent }: { label: string; estimated: string; actual: string; variancePercent: number | null }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-ink">
        <span className="text-muted">Est.</span> {estimated}
      </div>
      <div className="font-medium text-ink">
        <span className="text-muted font-normal">Actual</span> {actual}
        {variancePercent !== null && (
          <span className={`ml-1.5 text-xs font-medium ${variancePercent > 0 ? "text-red" : "text-green"}`}>
            ({variancePercent >= 0 ? "+" : ""}
            {(variancePercent * 100).toFixed(1)}%)
          </span>
        )}
      </div>
    </div>
  );
}

function ActualEditor({
  projects,
  initialProjectId,
  onSave,
  onCancel,
}: {
  projects: { id: string; name: string }[];
  initialProjectId?: string;
  onSave: (a: ActualJobResult) => void;
  onCancel: () => void;
}) {
  const defaultProjectId = initialProjectId && projects.some((p) => p.id === initialProjectId) ? initialProjectId : projects[0]?.id ?? "";
  const [draft, setDraft] = useState<ActualJobResult>(blankActual(defaultProjectId));

  return (
    <Modal title="Log actual job result" onClose={onCancel} wide>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Project">
          <Select value={draft.projectId} onChange={(e) => setDraft((d) => ({ ...d, projectId: e.target.value }))}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Completed date">
          <input
            type="date"
            value={draft.completedAt.slice(0, 10)}
            onChange={(e) => setDraft((d) => ({ ...d, completedAt: new Date(e.target.value).toISOString() }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-orange"
          />
        </Field>
        <Field label="Actual quantity (yd³)">
          <NumberInput value={draft.actualQuantityYd3} onChange={(e) => setDraft((d) => ({ ...d, actualQuantityYd3: parseFloat(e.target.value) || 0 }))} />
        </Field>
        <Field label="Actual labor hours">
          <NumberInput value={draft.actualLaborHours} onChange={(e) => setDraft((d) => ({ ...d, actualLaborHours: parseFloat(e.target.value) || 0 }))} />
        </Field>
        <Field label="Actual labor cost ($)">
          <NumberInput value={draft.actualLaborCost} onChange={(e) => setDraft((d) => ({ ...d, actualLaborCost: parseFloat(e.target.value) || 0 }))} />
        </Field>
        <Field label="Actual material cost ($)">
          <NumberInput value={draft.actualMaterialCost} onChange={(e) => setDraft((d) => ({ ...d, actualMaterialCost: parseFloat(e.target.value) || 0 }))} />
        </Field>
        <Field label="Actual equipment cost ($)">
          <NumberInput value={draft.actualEquipmentCost} onChange={(e) => setDraft((d) => ({ ...d, actualEquipmentCost: parseFloat(e.target.value) || 0 }))} />
        </Field>
        <Field label="Actual other cost ($)">
          <NumberInput value={draft.actualOtherCost} onChange={(e) => setDraft((d) => ({ ...d, actualOtherCost: parseFloat(e.target.value) || 0 }))} />
        </Field>
        <Field label="Final selling price ($)">
          <NumberInput value={draft.finalSellingPrice} onChange={(e) => setDraft((d) => ({ ...d, finalSellingPrice: parseFloat(e.target.value) || 0 }))} />
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!draft.projectId} onClick={() => onSave(draft)}>
          Save actual result
        </Button>
      </div>
    </Modal>
  );
}
