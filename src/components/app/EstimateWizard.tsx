import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Printer, SplitSquareHorizontal } from "lucide-react";
import { useWorkspace } from "../../lib/workspaceContext";
import { evaluateEntity, combinedAreaSqFt } from "../../lib/estimateMath";
import { formatCurrency, formatPercent, formatYd3, getZeroCostWarnings } from "../../lib/calc";
import { numberFieldError, parseRequiredNumber, targetMarginError } from "../../lib/validation";
import { AlertTriangle } from "lucide-react";
import type { Estimate, ProjectType } from "../../lib/types";
import { Button, Card, Field, NumberInput, Select, TextInput } from "../ui/primitives";
import SectionsEditor from "./SectionsEditor";
import EstimateDocument from "./EstimateDocument";
import LaborCostInput, { DEFAULT_LABOR_INPUT, laborInputError } from "./LaborCostInput";
import ScenarioCompareModal from "./ScenarioCompareModal";
import SaveStatusIndicator from "./SaveStatusIndicator";
import { track } from "../../lib/analytics";

const STEPS = ["Project", "Dimensions", "Costs", "Price", "Customer"] as const;
type Step = (typeof STEPS)[number];

const PROJECT_TYPES: ProjectType[] = ["driveway", "slab", "patio", "footing", "sidewalk", "general"];

/** Edits the workspace's single current estimate in place -- there is no separate "draft"
 * copy that gets upserted into a list on save. Every field change autosaves (debounced, via
 * updateCurrentEstimate); "Save draft" / "Save & mark sent" just set status and flush
 * immediately so the status change is confirmed without waiting out the debounce. */
export default function EstimateWizard({ onDone }: { onDone: () => void }) {
  const { currentEstimate, updateCurrentEstimate, flushCurrentEstimateNow, estimateSaveStatus, estimateLastSavedAt, estimateSaveError, storageAvailable, preferences } = useWorkspace();
  const [stepIndex, setStepIndex] = useState(0);
  const [comparingScenarios, setComparingScenarios] = useState(false);
  const hasTrackedCreate = useRef(false);

  const draft = currentEstimate;

  const result = useMemo(
    () =>
      draft
        ? evaluateEntity({
            sections: draft.sections,
            allowancePercent: draft.allowancePercent,
            rounding: draft.rounding,
            costs: draft.costs,
            overheadPercent: draft.overheadPercent,
            targetMarginPercent: draft.targetMarginPercent,
            sellingPrice: draft.sellingPrice,
          })
        : null,
    [draft],
  );

  if (!draft || !result) return null;

  function setDraft(updater: (d: Estimate) => Estimate) {
    if (!hasTrackedCreate.current && draft && draft.projectName === "" && draft.customerName === "") {
      hasTrackedCreate.current = true;
      track("estimate_created", { projectType: draft.projectType });
    }
    updateCurrentEstimate(updater);
  }

  const step = STEPS[stepIndex];
  const readyMixError = numberFieldError(draft.costs.readyMixRatePerYd3);
  const laborError = laborInputError(draft.labor ?? DEFAULT_LABOR_INPUT, draft.costs.laborCost);
  const formsError = numberFieldError(draft.costs.formsCost);
  const reinforcementError = numberFieldError(draft.costs.reinforcementCost);
  const equipmentError = numberFieldError(draft.costs.equipmentCost);
  const otherError = numberFieldError(draft.costs.otherCost);
  const costsHaveError = !!(readyMixError || laborError || formsError || reinforcementError || equipmentError || otherError);
  const overheadError = numberFieldError(draft.overheadPercent);
  const marginError = targetMarginError(draft.targetMarginPercent);
  const sellingPriceError = numberFieldError(draft.sellingPrice);
  const priceHasError = !!(overheadError || marginError || sellingPriceError);
  const canContinue =
    validateStep(step, draft) && (step !== "Costs" || !costsHaveError) && (step !== "Price" || !priceHasError);
  const zeroCostWarnings = getZeroCostWarnings(draft.costs, combinedAreaSqFt(draft.sections));

  function saveWithStatus(status: Estimate["status"]) {
    setDraft((d) => ({ ...d, status, updatedAt: new Date().toISOString() }));
    flushCurrentEstimateNow();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <ProgressBar steps={STEPS as unknown as string[]} activeIndex={stepIndex} />
        <SaveStatusIndicator status={estimateSaveStatus} lastSavedAt={estimateLastSavedAt} errorMessage={estimateSaveError} storageAvailable={storageAvailable} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[58%_42%] lg:items-start">
        <Card title={step} className="no-print">
          {step === "Project" && (
            <div className="flex flex-col gap-1">
              <Field label="Project name" htmlFor="ew-project-name" wide>
                <TextInput id="ew-project-name" value={draft.projectName} onChange={(e) => setDraft((d) => ({ ...d, projectName: e.target.value }))} placeholder="Smith Driveway" />
              </Field>
              <Field label="Project type" htmlFor="ew-project-type">
                <Select id="ew-project-type" value={draft.projectType} onChange={(e) => setDraft((d) => ({ ...d, projectType: e.target.value as ProjectType }))}>
                  {PROJECT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t[0].toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          {step === "Dimensions" && (
            <div>
              <SectionsEditor sections={draft.sections} onChange={(sections) => setDraft((d) => ({ ...d, sections }))} />
              {/* Stacked, not a 2-column grid -- the wizard's own left pane is already
                  capped at 58% of the page width, and Rounding's option text ("Round up to
                  next 0.25 yd³") needs more room than half of that leaves it. */}
              <div className="mt-4 flex flex-col gap-1">
                <Field label="Order allowance (%)" htmlFor="ew-allowance" wide>
                  <NumberInput id="ew-allowance" value={draft.allowancePercent} onChange={(e) => setDraft((d) => ({ ...d, allowancePercent: parseFloat(e.target.value) || 0 }))} />
                </Field>
                <Field label="Rounding" htmlFor="ew-rounding" wide>
                  <Select id="ew-rounding" value={draft.rounding} onChange={(e) => setDraft((d) => ({ ...d, rounding: e.target.value as any }))}>
                    <option value="none">Exact amount</option>
                    <option value="quarter">Round up to next 0.25 yd³</option>
                    <option value="half">Round up to next 0.5 yd³</option>
                    <option value="whole">Round up to next whole yd³</option>
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {step === "Costs" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Ready mix ($/yd³)" error={readyMixError}>
                <NumberInput value={draft.costs.readyMixRatePerYd3} error={readyMixError} onChange={(e) => setDraft((d) => ({ ...d, costs: { ...d.costs, readyMixRatePerYd3: parseRequiredNumber(e.target.value) } }))} />
              </Field>
              <div className="sm:col-span-2">
                <LaborCostInput
                  labor={draft.labor ?? DEFAULT_LABOR_INPUT}
                  laborCost={draft.costs.laborCost}
                  totalAreaSqFt={combinedAreaSqFt(draft.sections)}
                  onChange={(laborCost, labor) => setDraft((d) => ({ ...d, labor, costs: { ...d.costs, laborCost } }))}
                />
              </div>
              <Field label="Forms ($)" error={formsError}>
                <NumberInput value={draft.costs.formsCost} error={formsError} onChange={(e) => setDraft((d) => ({ ...d, costs: { ...d.costs, formsCost: parseRequiredNumber(e.target.value) } }))} />
              </Field>
              <Field label="Reinforcement ($)" error={reinforcementError}>
                <NumberInput value={draft.costs.reinforcementCost} error={reinforcementError} onChange={(e) => setDraft((d) => ({ ...d, costs: { ...d.costs, reinforcementCost: parseRequiredNumber(e.target.value) } }))} />
              </Field>
              <Field label="Equipment ($)" error={equipmentError}>
                <NumberInput value={draft.costs.equipmentCost} error={equipmentError} onChange={(e) => setDraft((d) => ({ ...d, costs: { ...d.costs, equipmentCost: parseRequiredNumber(e.target.value) } }))} />
              </Field>
              <Field label="Other ($)" error={otherError}>
                <NumberInput value={draft.costs.otherCost} error={otherError} onChange={(e) => setDraft((d) => ({ ...d, costs: { ...d.costs, otherCost: parseRequiredNumber(e.target.value) } }))} />
              </Field>
              {zeroCostWarnings.length > 0 && (
                <div className="sm:col-span-2 flex flex-col gap-1.5 rounded-lg border border-amber/30 bg-amber-light px-3 py-2.5 text-sm text-amber" role="alert">
                  {zeroCostWarnings.map((w) => (
                    <div key={w} className="flex items-start gap-2">
                      <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
              {costsHaveError && (
                <p role="alert" className="sm:col-span-2 text-sm font-medium text-red">
                  Fix the highlighted field above before continuing.
                </p>
              )}
            </div>
          )}

          {step === "Price" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Overhead (%)" error={overheadError}>
                <NumberInput value={draft.overheadPercent} error={overheadError} onChange={(e) => setDraft((d) => ({ ...d, overheadPercent: parseRequiredNumber(e.target.value) }))} />
              </Field>
              <Field label="Target margin (%)" error={marginError}>
                <NumberInput
                  value={draft.targetMarginPercent}
                  error={marginError}
                  onChange={(e) => setDraft((d) => ({ ...d, targetMarginPercent: parseRequiredNumber(e.target.value) }))}
                />
              </Field>
              <Field label="Your selling price ($)" error={sellingPriceError}>
                <NumberInput value={draft.sellingPrice} error={sellingPriceError} onChange={(e) => setDraft((d) => ({ ...d, sellingPrice: parseRequiredNumber(e.target.value) }))} />
              </Field>
              <div className="flex flex-col justify-end">
                <Button variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, sellingPrice: Math.round(result.requiredSellingPrice) }))}>
                  Use required price ({formatCurrency(result.requiredSellingPrice)})
                </Button>
              </div>
              <div className="sm:col-span-2">
                <Button variant="ghost" size="sm" onClick={() => setComparingScenarios(true)}>
                  <SplitSquareHorizontal size={15} /> Compare two pricing scenarios
                </Button>
              </div>
              <label className="sm:col-span-2 flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={draft.showCostBreakdownOnPdf === true}
                  onChange={(e) => setDraft((d) => ({ ...d, showCostBreakdownOnPdf: e.target.checked }))}
                  className="rounded border-border text-orange focus:ring-orange"
                />
                Show cost breakdown (direct cost, overhead, margin) on the customer PDF
              </label>
              {priceHasError && (
                <p role="alert" className="sm:col-span-2 text-sm font-medium text-red">
                  Fix the highlighted field above before continuing.
                </p>
              )}
            </div>
          )}

          {step === "Customer" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Customer name"
                required
                error={draft.customerName.trim().length === 0 ? "Customer name is required." : null}
                wide
              >
                <TextInput value={draft.customerName} onChange={(e) => setDraft((d) => ({ ...d, customerName: e.target.value }))} />
              </Field>
              <Field label="Customer email" wide>
                <TextInput value={draft.customerEmail ?? ""} onChange={(e) => setDraft((d) => ({ ...d, customerEmail: e.target.value }))} />
              </Field>
              <Field label="Estimate valid for (days)" htmlFor="ew-validity-days" hint='Shown to the customer as "Valid until"' wide>
                <NumberInput
                  id="ew-validity-days"
                  min={1}
                  value={draft.validityDays ?? preferences.estimateValidityDays}
                  onChange={(e) => setDraft((d) => ({ ...d, validityDays: parseFloat(e.target.value) || 1 }))}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Customer address" wide>
                  <TextInput value={draft.customerAddress ?? ""} onChange={(e) => setDraft((d) => ({ ...d, customerAddress: e.target.value }))} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Notes" wide>
                  <textarea
                    value={draft.notes ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-orange"
                  />
                </Field>
              </div>
              {!canContinue && (
                <p className="sm:col-span-2 text-sm text-muted">
                  Add a customer name to enable <strong>Save &amp; mark sent</strong> — or use <strong>Save draft</strong> to keep working on it first.
                </p>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setStepIndex((i) => Math.max(0, i - 1))} disabled={stepIndex === 0}>
              <ArrowLeft size={16} /> Back
            </Button>
            {stepIndex < STEPS.length - 1 ? (
              <Button onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))} disabled={!canContinue}>
                Continue <ArrowRight size={16} />
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    saveWithStatus("draft");
                    onDone();
                  }}
                >
                  Save draft
                </Button>
                <Button
                  onClick={() => {
                    saveWithStatus("sent");
                    onDone();
                  }}
                  disabled={!canContinue}
                >
                  <Check size={16} /> Save &amp; mark sent
                </Button>
              </div>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <Card title="Live summary" subtitle="Updates as you go" className="no-print">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <SummaryStat label="Order qty" value={formatYd3(result.orderQuantityYd3)} />
              <SummaryStat label="True cost" value={formatCurrency(result.trueCost)} />
              <SummaryStat label="Selling price" value={formatCurrency(draft.sellingPrice)} />
              <SummaryStat label="Margin" value={formatPercent(result.currentMargin, 0)} tone={result.isBelowTarget ? "red" : "green"} />
            </div>
          </Card>
          {step === "Customer" && (
            <div>
              {/* Only EstimateDocument below should ever hit paper -- everything else on this
                  page (sidebar, wizard form, Live summary, this row itself) is marked
                  no-print, matching the same pattern EstimatesTab.tsx uses for its own Print
                  button. Without it, window.print() here printed the entire app chrome. */}
              <div className="mb-2 flex items-center justify-between no-print">
                <span className="text-sm font-semibold text-ink">Document preview</span>
                <Button size="sm" variant="ghost" onClick={() => { track("pdf_generated", { source: "wizard" }); window.print(); }}>
                  <Printer size={14} /> Print
                </Button>
              </div>
              <EstimateDocument estimate={draft} />
            </div>
          )}
        </div>
      </div>

      {comparingScenarios && (
        <ScenarioCompareModal
          sections={draft.sections}
          initial={{
            allowancePercent: draft.allowancePercent,
            rounding: draft.rounding,
            readyMixRatePerYd3: draft.costs.readyMixRatePerYd3,
            laborCost: draft.costs.laborCost,
            formsCost: draft.costs.formsCost,
            reinforcementCost: draft.costs.reinforcementCost,
            equipmentCost: draft.costs.equipmentCost,
            otherCost: draft.costs.otherCost,
            overheadPercent: draft.overheadPercent,
            targetMarginPercent: draft.targetMarginPercent,
            sellingPrice: draft.sellingPrice,
          }}
          onApply={(chosen) =>
            setDraft((d) => ({
              ...d,
              allowancePercent: chosen.allowancePercent,
              rounding: chosen.rounding,
              costs: {
                readyMixRatePerYd3: chosen.readyMixRatePerYd3,
                laborCost: chosen.laborCost,
                formsCost: chosen.formsCost,
                reinforcementCost: chosen.reinforcementCost,
                equipmentCost: chosen.equipmentCost,
                otherCost: chosen.otherCost,
              },
              overheadPercent: chosen.overheadPercent,
              targetMarginPercent: chosen.targetMarginPercent,
              sellingPrice: chosen.sellingPrice,
            }))
          }
          onClose={() => setComparingScenarios(false)}
        />
      )}
    </div>
  );
}

function validateStep(step: Step, draft: Estimate): boolean {
  switch (step) {
    case "Project":
      return draft.projectName.trim().length > 0;
    case "Dimensions":
      return draft.sections.length > 0 && draft.sections.every((s) => s.lengthFt > 0 && s.widthFt > 0 && s.thicknessIn > 0);
    case "Costs":
      return true;
    case "Price":
      return draft.sellingPrice >= 0;
    case "Customer":
      return draft.customerName.trim().length > 0;
    default:
      return true;
  }
}

function ProgressBar({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Estimate steps">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              i < activeIndex ? "bg-green text-white" : i === activeIndex ? "bg-orange text-white" : "bg-border text-muted"
            }`}
          >
            {i < activeIndex ? <Check size={14} /> : i + 1}
          </span>
          <span className={`text-sm font-medium ${i === activeIndex ? "text-ink" : "text-muted"}`}>{s}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

function SummaryStat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "green" | "red" }) {
  const color = tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-ink";
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`font-semibold ${color}`}>{value}</div>
    </div>
  );
}
