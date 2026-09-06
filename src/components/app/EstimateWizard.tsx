import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Printer, SplitSquareHorizontal } from "lucide-react";
import { useWorkspace } from "../../lib/workspaceContext";
import { newId, upsertBy } from "../../lib/storage";
import { evaluateEntity, combinedAreaSqFt } from "../../lib/estimateMath";
import { formatCurrency, formatPercent, formatYd3 } from "../../lib/calc";
import type { Estimate, ProjectTemplate, ProjectType } from "../../lib/types";
import { Button, Card, Field, NumberInput, Select, TextInput } from "../ui/primitives";
import SectionsEditor from "./SectionsEditor";
import EstimateDocument from "./EstimateDocument";
import LaborCostInput, { DEFAULT_LABOR_INPUT } from "./LaborCostInput";
import ScenarioCompareModal from "./ScenarioCompareModal";
import { track } from "../../lib/analytics";

const STEPS = ["Project", "Dimensions", "Costs", "Price", "Customer"] as const;
type Step = (typeof STEPS)[number];

const PROJECT_TYPES: ProjectType[] = ["driveway", "slab", "patio", "footing", "sidewalk", "general"];

function blankEstimate(defaults: { overheadPercent: number; targetMarginPercent: number; allowancePercent: number; rounding: any; notes: string; readyMixRate: number; laborRate: number }, nextNumber: string): Estimate {
  return {
    id: newId("est"),
    estimateNumber: nextNumber,
    projectType: "driveway",
    projectName: "",
    customerName: "",
    sections: [{ id: newId("sec"), name: "Section 1", lengthFt: 20, widthFt: 20, thicknessIn: 4 }],
    allowancePercent: defaults.allowancePercent,
    rounding: defaults.rounding,
    costs: { readyMixRatePerYd3: defaults.readyMixRate || 165, laborCost: 0, formsCost: 0, reinforcementCost: 0, equipmentCost: 0, otherCost: 0 },
    overheadPercent: defaults.overheadPercent,
    targetMarginPercent: defaults.targetMarginPercent,
    sellingPrice: 0,
    notes: defaults.notes,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function estimateFromTemplate(template: ProjectTemplate, nextNumber: string): Estimate {
  return {
    id: newId("est"),
    estimateNumber: nextNumber,
    projectType: template.projectType,
    projectName: template.name,
    customerName: "",
    sections: template.sections.map((s) => ({ ...s, id: newId("sec") })),
    allowancePercent: template.allowancePercent,
    rounding: template.rounding,
    costs: { ...template.defaultCosts },
    labor: template.labor,
    overheadPercent: 15,
    targetMarginPercent: 30,
    sellingPrice: 0,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function EstimateWizard({
  existing,
  fromTemplate,
  onDone,
}: {
  existing?: Estimate;
  fromTemplate?: ProjectTemplate;
  onDone: (savedId: string) => void;
}) {
  const { workspace, update } = useWorkspace();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<Estimate>(() => {
    if (existing) return existing;
    const nextNumber = `EST-${1000 + workspace.estimates.length + 1}`;
    if (fromTemplate) {
      return {
        ...estimateFromTemplate(fromTemplate, nextNumber),
        overheadPercent: workspace.settings.defaultOverheadPercent,
        targetMarginPercent: workspace.settings.defaultTargetMarginPercent,
        notes: workspace.settings.defaultNotes,
      };
    }
    return blankEstimate(
      {
        overheadPercent: workspace.settings.defaultOverheadPercent,
        targetMarginPercent: workspace.settings.defaultTargetMarginPercent,
        allowancePercent: workspace.settings.defaultAllowancePercent,
        rounding: workspace.settings.defaultRounding,
        notes: workspace.settings.defaultNotes,
        readyMixRate: workspace.catalog.find((c) => c.kind === "readyMix")?.unitCost ?? 165,
        laborRate: workspace.settings.defaultLoadedLaborRate,
      },
      nextNumber,
    );
  });
  const [saved, setSaved] = useState(false);
  const [comparingScenarios, setComparingScenarios] = useState(false);
  const hasTrackedCreate = useRef(false);

  const result = useMemo(
    () =>
      evaluateEntity({
        sections: draft.sections,
        allowancePercent: draft.allowancePercent,
        rounding: draft.rounding,
        costs: draft.costs,
        overheadPercent: draft.overheadPercent,
        targetMarginPercent: draft.targetMarginPercent,
        sellingPrice: draft.sellingPrice,
      }),
    [draft],
  );

  const step = STEPS[stepIndex];
  const canContinue = validateStep(step, draft);

  function persist(status?: Estimate["status"]) {
    const toSave: Estimate = { ...draft, status: status ?? draft.status, updatedAt: new Date().toISOString() };
    update((ws) => ({ ...ws, estimates: upsertBy(ws.estimates, toSave) }));
    if (!existing && !hasTrackedCreate.current) {
      hasTrackedCreate.current = true;
      track("estimate_created", { projectType: toSave.projectType, fromTemplate: !!fromTemplate });
    }
    setDraft(toSave);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    return toSave.id;
  }

  return (
    <div className="flex flex-col gap-6">
      <ProgressBar steps={STEPS as unknown as string[]} activeIndex={stepIndex} />
      {fromTemplate && !existing && (
        <p className="rounded-lg border border-orange/20 bg-orange/5 px-4 py-2.5 text-sm text-ink no-print">
          Started from template <strong>{fromTemplate.name}</strong> — dimensions and costs are pre-filled, edit anything below.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[58%_42%] lg:items-start">
        <Card title={step}>
          {step === "Project" && (
            <div className="flex flex-col gap-1">
              <Field label="Project name">
                <TextInput value={draft.projectName} onChange={(e) => setDraft((d) => ({ ...d, projectName: e.target.value }))} placeholder="Smith Driveway" />
              </Field>
              <Field label="Project type">
                <Select value={draft.projectType} onChange={(e) => setDraft((d) => ({ ...d, projectType: e.target.value as ProjectType }))}>
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
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field label="Order allowance (%)">
                  <NumberInput value={draft.allowancePercent} onChange={(e) => setDraft((d) => ({ ...d, allowancePercent: parseFloat(e.target.value) || 0 }))} />
                </Field>
                <Field label="Rounding">
                  <Select value={draft.rounding} onChange={(e) => setDraft((d) => ({ ...d, rounding: e.target.value as any }))}>
                    <option value="none">Exact amount</option>
                    <option value="quarter">Nearest 0.25 yd³</option>
                    <option value="half">Nearest 0.5 yd³</option>
                    <option value="whole">Nearest 1 yd³</option>
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {step === "Costs" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Ready mix ($/yd³)">
                <NumberInput value={draft.costs.readyMixRatePerYd3} onChange={(e) => setDraft((d) => ({ ...d, costs: { ...d.costs, readyMixRatePerYd3: parseFloat(e.target.value) || 0 } }))} />
              </Field>
              <div className="sm:col-span-2">
                <LaborCostInput
                  labor={draft.labor ?? DEFAULT_LABOR_INPUT}
                  laborCost={draft.costs.laborCost}
                  totalAreaSqFt={combinedAreaSqFt(draft.sections)}
                  onChange={(laborCost, labor) => setDraft((d) => ({ ...d, labor, costs: { ...d.costs, laborCost } }))}
                />
              </div>
              <Field label="Forms ($)">
                <NumberInput value={draft.costs.formsCost} onChange={(e) => setDraft((d) => ({ ...d, costs: { ...d.costs, formsCost: parseFloat(e.target.value) || 0 } }))} />
              </Field>
              <Field label="Reinforcement ($)">
                <NumberInput value={draft.costs.reinforcementCost} onChange={(e) => setDraft((d) => ({ ...d, costs: { ...d.costs, reinforcementCost: parseFloat(e.target.value) || 0 } }))} />
              </Field>
              <Field label="Equipment ($)">
                <NumberInput value={draft.costs.equipmentCost} onChange={(e) => setDraft((d) => ({ ...d, costs: { ...d.costs, equipmentCost: parseFloat(e.target.value) || 0 } }))} />
              </Field>
              <Field label="Other ($)">
                <NumberInput value={draft.costs.otherCost} onChange={(e) => setDraft((d) => ({ ...d, costs: { ...d.costs, otherCost: parseFloat(e.target.value) || 0 } }))} />
              </Field>
            </div>
          )}

          {step === "Price" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Overhead (%)">
                <NumberInput value={draft.overheadPercent} onChange={(e) => setDraft((d) => ({ ...d, overheadPercent: parseFloat(e.target.value) || 0 }))} />
              </Field>
              <Field label="Target margin (%)">
                <NumberInput value={draft.targetMarginPercent} onChange={(e) => setDraft((d) => ({ ...d, targetMarginPercent: parseFloat(e.target.value) || 0 }))} />
              </Field>
              <Field label="Your selling price ($)">
                <NumberInput value={draft.sellingPrice} onChange={(e) => setDraft((d) => ({ ...d, sellingPrice: parseFloat(e.target.value) || 0 }))} />
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
            </div>
          )}

          {step === "Customer" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Customer name">
                <TextInput value={draft.customerName} onChange={(e) => setDraft((d) => ({ ...d, customerName: e.target.value }))} />
              </Field>
              <Field label="Customer email">
                <TextInput value={draft.customerEmail ?? ""} onChange={(e) => setDraft((d) => ({ ...d, customerEmail: e.target.value }))} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Customer address">
                  <TextInput value={draft.customerAddress ?? ""} onChange={(e) => setDraft((d) => ({ ...d, customerAddress: e.target.value }))} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Notes">
                  <textarea
                    value={draft.notes ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-orange"
                  />
                </Field>
              </div>
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
                <Button variant="ghost" onClick={() => persist("draft")}>
                  Save draft
                </Button>
                <Button
                  onClick={() => {
                    const id = persist("sent");
                    onDone(id);
                  }}
                  disabled={!canContinue}
                >
                  <Check size={16} /> Save &amp; mark sent
                </Button>
              </div>
            )}
          </div>
          {saved && <p className="mt-2 text-xs font-medium text-green">Saved</p>}
        </Card>

        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <Card title="Live summary" subtitle="Updates as you go">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <SummaryStat label="Order qty" value={formatYd3(result.orderQuantityYd3)} />
              <SummaryStat label="True cost" value={formatCurrency(result.trueCost)} />
              <SummaryStat label="Selling price" value={formatCurrency(draft.sellingPrice)} />
              <SummaryStat label="Margin" value={formatPercent(result.currentMargin, 0)} tone={result.isBelowTarget ? "red" : "green"} />
            </div>
          </Card>
          {step === "Customer" && (
            <div>
              <div className="mb-2 flex items-center justify-between">
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
    <ol className="flex flex-wrap items-center gap-2 no-print" aria-label="Estimate steps">
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
