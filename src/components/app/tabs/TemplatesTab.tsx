import { useState } from "react";
import { Copy, PlusCircle, Trash2, TriangleAlert } from "lucide-react";
import { newId, removeBy, upsertBy, useWorkspace } from "../../../lib/workspaceContext";
import { evaluateEntity, combinedAreaSqFt } from "../../../lib/estimateMath";
import { formatCurrency, formatPercent, formatYd3, getZeroCostWarnings } from "../../../lib/calc";
import { numberFieldError, parseRequiredNumber, sectionsAreValid } from "../../../lib/validation";
import type { ProjectTemplate, ProjectType } from "../../../lib/types";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Modal, NumberInput, Select, TextInput } from "../../ui/primitives";
import LaborCostInput, { DEFAULT_LABOR_INPUT, laborInputError } from "../LaborCostInput";

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: "driveway", label: "Driveway" },
  { value: "slab", label: "Slab" },
  { value: "patio", label: "Patio" },
  { value: "footing", label: "Footing" },
  { value: "sidewalk", label: "Sidewalk" },
  { value: "general", label: "General" },
];

function blankTemplate(): ProjectTemplate {
  return {
    id: newId("tpl"),
    name: "New template",
    projectType: "general",
    sections: [{ id: newId("sec"), name: "Section 1", lengthFt: 20, widthFt: 20, thicknessIn: 4 }],
    allowancePercent: 8,
    rounding: "quarter",
    defaultCosts: { readyMixRatePerYd3: 165, laborCost: 1000, formsCost: 200, reinforcementCost: 200, equipmentCost: 100, otherCost: 0 },
    currentSellingPrice: 3000,
    createdAt: new Date().toISOString(),
  };
}

export default function TemplatesTab() {
  const { templates, updateTemplates, preferences } = useWorkspace();
  const [editing, setEditing] = useState<ProjectTemplate | null>(null);
  const [deleting, setDeleting] = useState<ProjectTemplate | null>(null);

  function save(t: ProjectTemplate) {
    updateTemplates((list) => upsertBy(list, t));
    setEditing(null);
  }
  function duplicate(t: ProjectTemplate) {
    const copy: ProjectTemplate = { ...t, id: newId("tpl"), name: `${t.name} (copy)`, createdAt: new Date().toISOString(), isSample: false };
    updateTemplates((list) => upsertBy(list, copy));
  }
  function remove(t: ProjectTemplate) {
    updateTemplates((list) => removeBy(list, t.id));
    setDeleting(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Templates</h1>
          <p className="text-sm text-muted">Reusable project setups for your standard job types.</p>
        </div>
        <Button onClick={() => setEditing(blankTemplate())}>
          <PlusCircle size={16} /> New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          desc="Save a template for each standard job type so estimating takes seconds."
          action={<Button onClick={() => setEditing(blankTemplate())}>Create your first template</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const result = evaluateEntity({
              sections: t.sections,
              allowancePercent: t.allowancePercent,
              rounding: t.rounding,
              costs: t.defaultCosts,
              overheadPercent: preferences.defaultOverheadPercent,
              targetMarginPercent: preferences.defaultTargetMarginPercent,
              sellingPrice: t.currentSellingPrice,
            });
            return (
              <Card key={t.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-ink">{t.name}</div>
                    <div className="text-xs capitalize text-muted">{t.projectType}</div>
                  </div>
                  <Badge tone={result.isBelowTarget ? "red" : "green"}>{result.isBelowTarget ? "Below target" : "On target"}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted">Order qty</dt>
                    <dd className="font-medium text-ink">{formatYd3(result.orderQuantityYd3)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">True cost</dt>
                    <dd className="font-medium text-ink">{formatCurrency(result.trueCost)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Current rate</dt>
                    <dd className="font-medium text-ink">{formatCurrency(t.currentSellingPrice)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Margin</dt>
                    <dd className={`font-medium ${result.isBelowTarget ? "text-red" : "text-green"}`}>{formatPercent(result.currentMargin, 0)}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={`/app/estimates?new=1&templateId=${t.id}`}>
                    <Button size="sm">Start estimate</Button>
                  </a>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => duplicate(t)}>
                    <Copy size={14} /> Duplicate
                  </Button>
                  <button
                    type="button"
                    onClick={() => setDeleting(t)}
                    aria-label={`Delete ${t.name}`}
                    className="ml-auto rounded-lg p-2 text-muted hover:bg-red-light hover:text-red"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && <TemplateEditor template={editing} onSave={save} onCancel={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete template"
          message={`Delete "${deleting.name}"? This can't be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function TemplateEditor({ template, onSave, onCancel }: { template: ProjectTemplate; onSave: (t: ProjectTemplate) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<ProjectTemplate>(template);
  const section = draft.sections[0];

  function patchSection(patch: Partial<typeof section>) {
    setDraft((d) => ({ ...d, sections: [{ ...d.sections[0], ...patch }] }));
  }

  const allowanceError = numberFieldError(draft.allowancePercent);
  const readyMixError = numberFieldError(draft.defaultCosts.readyMixRatePerYd3);
  const laborError = laborInputError(draft.labor ?? DEFAULT_LABOR_INPUT, draft.defaultCosts.laborCost);
  const formsError = numberFieldError(draft.defaultCosts.formsCost);
  const reinforcementError = numberFieldError(draft.defaultCosts.reinforcementCost);
  const equipmentError = numberFieldError(draft.defaultCosts.equipmentCost);
  const otherError = numberFieldError(draft.defaultCosts.otherCost);
  const sellingPriceError = numberFieldError(draft.currentSellingPrice);
  const hasBlockingError = !!(
    allowanceError ||
    readyMixError ||
    laborError ||
    formsError ||
    reinforcementError ||
    equipmentError ||
    otherError ||
    sellingPriceError
  );
  const canSave = sectionsAreValid(draft.sections) && !hasBlockingError;
  const zeroCostWarnings = getZeroCostWarnings(draft.defaultCosts, combinedAreaSqFt(draft.sections));

  return (
    <Modal title={template.name === "New template" ? "New template" : `Edit ${template.name}`} onClose={onCancel} wide>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name">
          <TextInput value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        </Field>
        <Field label="Project type">
          <Select value={draft.projectType} onChange={(e) => setDraft((d) => ({ ...d, projectType: e.target.value as ProjectType }))}>
            {PROJECT_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Length (ft)" htmlFor="tpl-length" error={numberFieldError(section.lengthFt)}>
          <NumberInput id="tpl-length" value={section.lengthFt} error={numberFieldError(section.lengthFt)} onChange={(e) => patchSection({ lengthFt: parseRequiredNumber(e.target.value) })} />
        </Field>
        <Field label="Width (ft)" htmlFor="tpl-width" error={numberFieldError(section.widthFt)}>
          <NumberInput id="tpl-width" value={section.widthFt} error={numberFieldError(section.widthFt)} onChange={(e) => patchSection({ widthFt: parseRequiredNumber(e.target.value) })} />
        </Field>
        <Field label="Thickness (in)" htmlFor="tpl-thickness" error={numberFieldError(section.thicknessIn)}>
          <NumberInput id="tpl-thickness" value={section.thicknessIn} error={numberFieldError(section.thicknessIn)} onChange={(e) => patchSection({ thicknessIn: parseRequiredNumber(e.target.value) })} />
        </Field>
        <Field label="Allowance (%)" error={allowanceError}>
          <NumberInput value={draft.allowancePercent} error={allowanceError} onChange={(e) => setDraft((d) => ({ ...d, allowancePercent: parseRequiredNumber(e.target.value) }))} />
        </Field>
        <Field label="Ready mix ($/yd³)" error={readyMixError}>
          <NumberInput value={draft.defaultCosts.readyMixRatePerYd3} error={readyMixError} onChange={(e) => setDraft((d) => ({ ...d, defaultCosts: { ...d.defaultCosts, readyMixRatePerYd3: parseRequiredNumber(e.target.value) } }))} />
        </Field>
        <Field label="Forms ($)" error={formsError}>
          <NumberInput value={draft.defaultCosts.formsCost} error={formsError} onChange={(e) => setDraft((d) => ({ ...d, defaultCosts: { ...d.defaultCosts, formsCost: parseRequiredNumber(e.target.value) } }))} />
        </Field>
        <Field label="Reinforcement ($)" error={reinforcementError}>
          <NumberInput value={draft.defaultCosts.reinforcementCost} error={reinforcementError} onChange={(e) => setDraft((d) => ({ ...d, defaultCosts: { ...d.defaultCosts, reinforcementCost: parseRequiredNumber(e.target.value) } }))} />
        </Field>
        <Field label="Equipment ($)" error={equipmentError}>
          <NumberInput value={draft.defaultCosts.equipmentCost} error={equipmentError} onChange={(e) => setDraft((d) => ({ ...d, defaultCosts: { ...d.defaultCosts, equipmentCost: parseRequiredNumber(e.target.value) } }))} />
        </Field>
        <Field label="Other ($)" error={otherError}>
          <NumberInput value={draft.defaultCosts.otherCost} error={otherError} onChange={(e) => setDraft((d) => ({ ...d, defaultCosts: { ...d.defaultCosts, otherCost: parseRequiredNumber(e.target.value) } }))} />
        </Field>
        <Field label="Current selling price ($)" error={sellingPriceError}>
          <NumberInput value={draft.currentSellingPrice} error={sellingPriceError} onChange={(e) => setDraft((d) => ({ ...d, currentSellingPrice: parseRequiredNumber(e.target.value) }))} />
        </Field>
      </div>
      <div className="mt-4">
        <LaborCostInput
          labor={draft.labor ?? DEFAULT_LABOR_INPUT}
          laborCost={draft.defaultCosts.laborCost}
          totalAreaSqFt={combinedAreaSqFt(draft.sections)}
          onChange={(laborCost, labor) => setDraft((d) => ({ ...d, labor, defaultCosts: { ...d.defaultCosts, laborCost } }))}
        />
      </div>

      {zeroCostWarnings.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-amber/30 bg-amber-light px-3 py-2.5 text-sm text-amber" role="alert">
          {zeroCostWarnings.map((w) => (
            <div key={w} className="flex items-start gap-2">
              <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {!sectionsAreValid(draft.sections) && (
        <p role="alert" className="mt-3 text-sm font-medium text-red">
          Fix the highlighted section field{draft.sections.length > 1 ? "s" : ""} above before saving.
        </p>
      )}
      {sectionsAreValid(draft.sections) && hasBlockingError && (
        <p role="alert" className="mt-3 text-sm font-medium text-red">
          Fix the highlighted field above before saving.
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(draft)} disabled={!canSave}>
          Save template
        </Button>
      </div>
    </Modal>
  );
}
