import { useState } from "react";
import { useWorkspace } from "../../../lib/workspaceContext";
import { evaluateEstimate } from "../../../lib/estimateMath";
import { calculateMargin, formatCurrency, formatPercent, formatYd3, safe } from "../../../lib/calc";
import { numberFieldError, parseRequiredNumber } from "../../../lib/validation";
import type { ActualJobResult } from "../../../lib/types";
import { Button, Card, EmptyState, Field, Modal, NumberInput } from "../../ui/primitives";
import SaveStatusIndicator from "../SaveStatusIndicator";

function blankActual(): ActualJobResult {
  return {
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

/** "Current Estimate vs Actual" -- compares the single current estimate against one logged
 * actual result for it. There is no per-job history, no cross-job averages, and no archive:
 * replacing the current estimate also clears whatever actual was logged against it (see
 * Workspace.currentActual's doc comment in types.ts). */
export default function ActualsTab() {
  const { currentEstimate, currentActual, updateCurrentActual, flushCurrentEstimateNow, estimateSaveStatus, estimateLastSavedAt, estimateSaveError, storageAvailable } = useWorkspace();
  const [logging, setLogging] = useState(false);

  if (!currentEstimate) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader />
        <EmptyState title="No current estimate yet" desc="Start an estimate first, then come back here once it's complete to log the actual job result." />
      </div>
    );
  }

  const est = evaluateEstimate(currentEstimate);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader />

      <Card title={currentEstimate.projectName || "Current estimate"} subtitle={currentEstimate.customerName || undefined}>
        {!currentActual ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted">
              No actual result logged yet for this estimate. Once the job is done, log the real quantity, labor and
              costs to see how they compared.
            </p>
            <Button onClick={() => setLogging(true)}>Log actual result</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Compare
                label="Quantity"
                estimated={formatYd3(est.orderQuantityYd3)}
                actual={formatYd3(currentActual.actualQuantityYd3)}
                variancePercent={est.orderQuantityYd3 > 0 ? (safe(currentActual.actualQuantityYd3) - est.orderQuantityYd3) / est.orderQuantityYd3 : null}
              />
              <Compare
                label="Cost"
                estimated={formatCurrency(est.trueCost)}
                actual={formatCurrency(actualCost(currentActual, currentEstimate.overheadPercent))}
                variancePercent={est.trueCost > 0 ? (actualCost(currentActual, currentEstimate.overheadPercent) - est.trueCost) / est.trueCost : null}
              />
              <Compare
                label="Margin"
                estimated={formatPercent(calculateMargin(currentEstimate.sellingPrice, est.trueCost), 0)}
                actual={formatPercent(calculateMargin(currentActual.finalSellingPrice, actualCost(currentActual, currentEstimate.overheadPercent)), 0)}
                variancePercent={null}
              />
              <div>
                <div className="text-xs text-muted">Final price</div>
                <div className="font-medium text-ink">{formatCurrency(currentActual.finalSellingPrice)}</div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setLogging(true)}>
                Edit actual result
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Remove actual result"
                onClick={() => {
                  updateCurrentActual(() => null);
                  flushCurrentEstimateNow();
                }}
              >
                Remove actual result
              </Button>
            </div>
          </>
        )}
      </Card>

      {logging && (
        <ActualEditor
          initial={currentActual ?? blankActual()}
          onSave={(a) => {
            updateCurrentActual(() => a);
            flushCurrentEstimateNow();
            setLogging(false);
          }}
          onCancel={() => setLogging(false)}
        />
      )}

      <div className="no-print">
        <SaveStatusIndicator status={estimateSaveStatus} lastSavedAt={estimateLastSavedAt} errorMessage={estimateSaveError} storageAvailable={storageAvailable} />
      </div>
    </div>
  );
}

function actualCost(a: ActualJobResult, overheadPercent: number): number {
  const direct = safe(a.actualLaborCost) + safe(a.actualMaterialCost) + safe(a.actualEquipmentCost) + safe(a.actualOtherCost);
  return direct * (1 + overheadPercent / 100);
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Current Estimate vs Actual</h1>
      <p className="text-sm text-muted">Log the real job result and see how it compared to your estimate.</p>
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

function ActualEditor({ initial, onSave, onCancel }: { initial: ActualJobResult; onSave: (a: ActualJobResult) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<ActualJobResult>(initial);

  const qtyError = numberFieldError(draft.actualQuantityYd3);
  const hoursError = numberFieldError(draft.actualLaborHours);
  const laborCostError = numberFieldError(draft.actualLaborCost);
  const materialCostError = numberFieldError(draft.actualMaterialCost);
  const equipmentCostError = numberFieldError(draft.actualEquipmentCost);
  const otherCostError = numberFieldError(draft.actualOtherCost);
  const sellingPriceError = numberFieldError(draft.finalSellingPrice);
  const hasBlockingError = !!(qtyError || hoursError || laborCostError || materialCostError || equipmentCostError || otherCostError || sellingPriceError);

  return (
    <Modal title="Log actual job result" onClose={onCancel} size="lg">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Completed date">
          <input
            type="date"
            value={draft.completedAt.slice(0, 10)}
            onChange={(e) => setDraft((d) => ({ ...d, completedAt: new Date(e.target.value).toISOString() }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-orange"
          />
        </Field>
        <Field label="Actual quantity (yd³)" error={qtyError}>
          <NumberInput value={draft.actualQuantityYd3} error={qtyError} onChange={(e) => setDraft((d) => ({ ...d, actualQuantityYd3: parseRequiredNumber(e.target.value) }))} />
        </Field>
        <Field label="Actual labor hours" error={hoursError}>
          <NumberInput value={draft.actualLaborHours} error={hoursError} onChange={(e) => setDraft((d) => ({ ...d, actualLaborHours: parseRequiredNumber(e.target.value) }))} />
        </Field>
        <Field label="Actual labor cost ($)" error={laborCostError}>
          <NumberInput value={draft.actualLaborCost} error={laborCostError} onChange={(e) => setDraft((d) => ({ ...d, actualLaborCost: parseRequiredNumber(e.target.value) }))} />
        </Field>
        <Field label="Actual material cost ($)" error={materialCostError}>
          <NumberInput value={draft.actualMaterialCost} error={materialCostError} onChange={(e) => setDraft((d) => ({ ...d, actualMaterialCost: parseRequiredNumber(e.target.value) }))} />
        </Field>
        <Field label="Actual equipment cost ($)" error={equipmentCostError}>
          <NumberInput value={draft.actualEquipmentCost} error={equipmentCostError} onChange={(e) => setDraft((d) => ({ ...d, actualEquipmentCost: parseRequiredNumber(e.target.value) }))} />
        </Field>
        <Field label="Actual other cost ($)" error={otherCostError}>
          <NumberInput value={draft.actualOtherCost} error={otherCostError} onChange={(e) => setDraft((d) => ({ ...d, actualOtherCost: parseRequiredNumber(e.target.value) }))} />
        </Field>
        <Field label="Final selling price ($)" error={sellingPriceError}>
          <NumberInput value={draft.finalSellingPrice} error={sellingPriceError} onChange={(e) => setDraft((d) => ({ ...d, finalSellingPrice: parseRequiredNumber(e.target.value) }))} />
        </Field>
      </div>
      {hasBlockingError && (
        <p role="alert" className="mt-3 text-sm font-medium text-red">
          Fix the highlighted field above before saving.
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={hasBlockingError} onClick={() => onSave(draft)}>
          Save actual result
        </Button>
      </div>
    </Modal>
  );
}
