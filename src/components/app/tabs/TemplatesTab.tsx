import { useState } from "react";
import { Copy, PlusCircle, Trash2 } from "lucide-react";
import { useWorkspace } from "../../../lib/workspaceContext";
import { newId, removeBy, upsertBy } from "../../../lib/storage";
import { evaluateEntity } from "../../../lib/estimateMath";
import { formatCurrency, formatPercent, formatYd3 } from "../../../lib/calc";
import type { ProjectTemplate, ProjectType } from "../../../lib/types";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Modal, NumberInput, Select, TextInput } from "../../ui/primitives";

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
  const { workspace, update } = useWorkspace();
  const [editing, setEditing] = useState<ProjectTemplate | null>(null);
  const [deleting, setDeleting] = useState<ProjectTemplate | null>(null);

  function save(t: ProjectTemplate) {
    update((ws) => ({ ...ws, templates: upsertBy(ws.templates, t) }));
    setEditing(null);
  }
  function duplicate(t: ProjectTemplate) {
    const copy: ProjectTemplate = { ...t, id: newId("tpl"), name: `${t.name} (copy)`, createdAt: new Date().toISOString(), isSample: false };
    update((ws) => ({ ...ws, templates: upsertBy(ws.templates, copy) }));
  }
  function remove(t: ProjectTemplate) {
    update((ws) => ({ ...ws, templates: removeBy(ws.templates, t.id) }));
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

      {workspace.templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          desc="Save a template for each standard job type so estimating takes seconds."
          action={<Button onClick={() => setEditing(blankTemplate())}>Create your first template</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspace.templates.map((t) => {
            const result = evaluateEntity({
              sections: t.sections,
              allowancePercent: t.allowancePercent,
              rounding: t.rounding,
              costs: t.defaultCosts,
              overheadPercent: workspace.settings.defaultOverheadPercent,
              targetMarginPercent: workspace.settings.defaultTargetMarginPercent,
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
                <div className="mt-4 flex gap-2">
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
        <Field label="Length (ft)">
          <NumberInput value={section.lengthFt} onChange={(e) => patchSection({ lengthFt: parseFloat(e.target.value) || 0 })} />
        </Field>
        <Field label="Width (ft)">
          <NumberInput value={section.widthFt} onChange={(e) => patchSection({ widthFt: parseFloat(e.target.value) || 0 })} />
        </Field>
        <Field label="Thickness (in)">
          <NumberInput value={section.thicknessIn} onChange={(e) => patchSection({ thicknessIn: parseFloat(e.target.value) || 0 })} />
        </Field>
        <Field label="Allowance (%)">
          <NumberInput value={draft.allowancePercent} onChange={(e) => setDraft((d) => ({ ...d, allowancePercent: parseFloat(e.target.value) || 0 }))} />
        </Field>
        <Field label="Ready mix ($/yd³)">
          <NumberInput value={draft.defaultCosts.readyMixRatePerYd3} onChange={(e) => setDraft((d) => ({ ...d, defaultCosts: { ...d.defaultCosts, readyMixRatePerYd3: parseFloat(e.target.value) || 0 } }))} />
        </Field>
        <Field label="Labor ($)">
          <NumberInput value={draft.defaultCosts.laborCost} onChange={(e) => setDraft((d) => ({ ...d, defaultCosts: { ...d.defaultCosts, laborCost: parseFloat(e.target.value) || 0 } }))} />
        </Field>
        <Field label="Forms ($)">
          <NumberInput value={draft.defaultCosts.formsCost} onChange={(e) => setDraft((d) => ({ ...d, defaultCosts: { ...d.defaultCosts, formsCost: parseFloat(e.target.value) || 0 } }))} />
        </Field>
        <Field label="Reinforcement ($)">
          <NumberInput value={draft.defaultCosts.reinforcementCost} onChange={(e) => setDraft((d) => ({ ...d, defaultCosts: { ...d.defaultCosts, reinforcementCost: parseFloat(e.target.value) || 0 } }))} />
        </Field>
        <Field label="Equipment ($)">
          <NumberInput value={draft.defaultCosts.equipmentCost} onChange={(e) => setDraft((d) => ({ ...d, defaultCosts: { ...d.defaultCosts, equipmentCost: parseFloat(e.target.value) || 0 } }))} />
        </Field>
        <Field label="Current selling price ($)">
          <NumberInput value={draft.currentSellingPrice} onChange={(e) => setDraft((d) => ({ ...d, currentSellingPrice: parseFloat(e.target.value) || 0 }))} />
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(draft)}>Save template</Button>
      </div>
    </Modal>
  );
}
