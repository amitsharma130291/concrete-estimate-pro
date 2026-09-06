import { useMemo, useState } from "react";
import { Copy, PlusCircle, Trash2 } from "lucide-react";
import { useWorkspace } from "../../../lib/workspaceContext";
import { newId, removeBy, upsertBy } from "../../../lib/storage";
import { evaluateProject, combinedAreaSqFt } from "../../../lib/estimateMath";
import { formatCurrency, formatPercent, formatYd3 } from "../../../lib/calc";
import type { Project, ProjectStatus, ProjectType } from "../../../lib/types";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Modal, NumberInput, Select, TextInput } from "../../ui/primitives";
import SectionsEditor from "../SectionsEditor";
import LaborCostInput, { DEFAULT_LABOR_INPUT } from "../LaborCostInput";

const STATUSES: ProjectStatus[] = ["estimate", "sent", "accepted", "completed"];
const PROJECT_TYPES: ProjectType[] = ["driveway", "slab", "patio", "footing", "sidewalk", "general"];

function blankProject(): Project {
  return {
    id: newId("proj"),
    name: "New project",
    projectType: "general",
    customerName: "",
    status: "estimate",
    sections: [{ id: newId("sec"), name: "Section 1", lengthFt: 20, widthFt: 20, thicknessIn: 4 }],
    allowancePercent: 8,
    rounding: "quarter",
    costs: { readyMixRatePerYd3: 165, laborCost: 1000, formsCost: 200, reinforcementCost: 200, equipmentCost: 100, otherCost: 0 },
    overheadPercent: 15,
    targetMarginPercent: 30,
    sellingPrice: 3000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function ProjectsTab() {
  const { workspace, update } = useWorkspace();
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  function save(p: Project) {
    update((ws) => ({ ...ws, projects: upsertBy(ws.projects, { ...p, updatedAt: new Date().toISOString() }) }));
    setEditing(null);
  }
  function remove(p: Project) {
    update((ws) => ({ ...ws, projects: removeBy(ws.projects, p.id) }));
    setDeleting(null);
  }
  function duplicate(p: Project) {
    const copy: Project = {
      ...p,
      id: newId("proj"),
      name: `${p.name} (copy)`,
      status: "estimate",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    update((ws) => ({ ...ws, projects: upsertBy(ws.projects, copy) }));
  }
  function setStatus(p: Project, status: ProjectStatus) {
    update((ws) => ({ ...ws, projects: upsertBy(ws.projects, { ...p, status, updatedAt: new Date().toISOString() }) }));
  }

  const sorted = useMemo(() => [...workspace.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [workspace.projects]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Projects</h1>
          <p className="text-sm text-muted">Track jobs from estimate through completion.</p>
        </div>
        <Button onClick={() => setEditing(blankProject())}>
          <PlusCircle size={16} /> New project
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState title="No projects yet" desc="Create a project to track sections, cost and status through completion." action={<Button onClick={() => setEditing(blankProject())}>Create a project</Button>} />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((p) => {
            const result = evaluateProject(p);
            return (
              <Card key={p.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-ink">{p.name}</div>
                    <div className="text-xs capitalize text-muted">
                      {p.customerName || "No customer"} · {p.projectType} · {p.sections.length} section{p.sections.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={p.status}
                      onChange={(e) => setStatus(p, e.target.value as ProjectStatus)}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-sm capitalize shadow-sm focus:border-orange"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <Badge tone={result.isBelowTarget ? "red" : "green"}>{formatPercent(result.currentMargin, 0)} margin</Badge>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Stat label="Order qty" value={formatYd3(result.orderQuantityYd3)} />
                  <Stat label="True cost" value={formatCurrency(result.trueCost)} />
                  <Stat label="Selling price" value={formatCurrency(p.sellingPrice)} />
                  <Stat label="Required price" value={formatCurrency(result.requiredSellingPrice)} />
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => duplicate(p)}>
                    <Copy size={14} /> Duplicate
                  </Button>
                  {p.status === "completed" && (
                    <a href={`/app/actuals?projectId=${p.id}`}>
                      <Button size="sm" variant="ghost">
                        Log actuals
                      </Button>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleting(p)}
                    aria-label={`Delete ${p.name}`}
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

      {editing && <ProjectEditor project={editing} onSave={save} onCancel={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog title="Delete project" message={`Delete "${deleting.name}"? This can't be undone.`} confirmLabel="Delete" danger onConfirm={() => remove(deleting)} onCancel={() => setDeleting(null)} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-medium text-ink">{value}</div>
    </div>
  );
}

function ProjectEditor({ project, onSave, onCancel }: { project: Project; onSave: (p: Project) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Project>(project);

  return (
    <Modal title={project.name === "New project" ? "New project" : `Edit ${project.name}`} onClose={onCancel} wide>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Project name">
          <TextInput value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        </Field>
        <Field label="Customer">
          <TextInput value={draft.customerName} onChange={(e) => setDraft((d) => ({ ...d, customerName: e.target.value }))} />
        </Field>
        <Field label="Project type">
          <Select value={draft.projectType} onChange={(e) => setDraft((d) => ({ ...d, projectType: e.target.value as ProjectType }))}>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Allowance (%)">
          <NumberInput value={draft.allowancePercent} onChange={(e) => setDraft((d) => ({ ...d, allowancePercent: parseFloat(e.target.value) || 0 }))} />
        </Field>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-sm font-medium text-ink">Sections</div>
        <SectionsEditor sections={draft.sections} onChange={(sections) => setDraft((d) => ({ ...d, sections }))} />
      </div>

      <div className="mt-4">
        <LaborCostInput
          labor={draft.labor ?? DEFAULT_LABOR_INPUT}
          laborCost={draft.costs.laborCost}
          totalAreaSqFt={combinedAreaSqFt(draft.sections)}
          onChange={(laborCost, labor) => setDraft((d) => ({ ...d, labor, costs: { ...d.costs, laborCost } }))}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Ready mix ($/yd³)">
          <NumberInput value={draft.costs.readyMixRatePerYd3} onChange={(e) => setDraft((d) => ({ ...d, costs: { ...d.costs, readyMixRatePerYd3: parseFloat(e.target.value) || 0 } }))} />
        </Field>
        <Field label="Forms ($)">
          <NumberInput value={draft.costs.formsCost} onChange={(e) => setDraft((d) => ({ ...d, costs: { ...d.costs, formsCost: parseFloat(e.target.value) || 0 } }))} />
        </Field>
        <Field label="Reinforcement ($)">
          <NumberInput value={draft.costs.reinforcementCost} onChange={(e) => setDraft((d) => ({ ...d, costs: { ...d.costs, reinforcementCost: parseFloat(e.target.value) || 0 } }))} />
        </Field>
        <Field label="Equipment ($)">
          <NumberInput value={draft.costs.equipmentCost} onChange={(e) => setDraft((d) => ({ ...d, costs: { ...d.costs, equipmentCost: parseFloat(e.target.value) || 0 } }))} />
        </Field>
        <Field label="Overhead (%)">
          <NumberInput value={draft.overheadPercent} onChange={(e) => setDraft((d) => ({ ...d, overheadPercent: parseFloat(e.target.value) || 0 }))} />
        </Field>
        <Field label="Target margin (%)">
          <NumberInput value={draft.targetMarginPercent} onChange={(e) => setDraft((d) => ({ ...d, targetMarginPercent: parseFloat(e.target.value) || 0 }))} />
        </Field>
        <Field label="Selling price ($)">
          <NumberInput value={draft.sellingPrice} onChange={(e) => setDraft((d) => ({ ...d, sellingPrice: parseFloat(e.target.value) || 0 }))} />
        </Field>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(draft)}>Save project</Button>
      </div>
    </Modal>
  );
}
