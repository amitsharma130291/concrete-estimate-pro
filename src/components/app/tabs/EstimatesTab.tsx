import { useMemo, useState } from "react";
import { Copy, PlusCircle, Printer, Search, Trash2 } from "lucide-react";
import { useWorkspace } from "../../../lib/workspaceContext";
import { newId, removeBy, upsertBy } from "../../../lib/storage";
import { evaluateEstimate } from "../../../lib/estimateMath";
import { formatCurrency, formatPercent } from "../../../lib/calc";
import type { Estimate, EstimateStatus } from "../../../lib/types";
import { Button, Card, ConfirmDialog, EmptyState, Select, TextInput } from "../../ui/primitives";
import { StatusBadge } from "./OverviewTab";
import EstimateWizard from "../EstimateWizard";
import EstimateDocument from "../EstimateDocument";

function getParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function setParams(params: Record<string, string | undefined>) {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  });
  window.history.pushState({}, "", url.toString());
}

export default function EstimatesTab() {
  const { workspace, update } = useWorkspace();
  const [, forceRender] = useState(0);
  const params = getParams();
  const mode = params.get("new") ? "new" : params.has("edit") ? "edit" : params.has("id") ? "view" : "list";
  const activeId = params.get("id") ?? params.get("edit") ?? undefined;
  const activeEstimate = activeId ? workspace.estimates.find((e) => e.id === activeId) : undefined;
  const templateId = params.get("templateId") ?? undefined;
  const fromTemplate = templateId ? workspace.templates.find((t) => t.id === templateId) : undefined;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EstimateStatus | "all">("all");
  const [deleting, setDeleting] = useState<Estimate | null>(null);

  function navigate(next: Record<string, string | undefined>) {
    setParams(next);
    forceRender((n) => n + 1);
  }

  function duplicate(e: Estimate) {
    const copy: Estimate = {
      ...e,
      id: newId("est"),
      estimateNumber: `EST-${1000 + workspace.estimates.length + 1}`,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSample: false,
    };
    update((ws) => ({ ...ws, estimates: upsertBy(ws.estimates, copy) }));
  }
  function remove(e: Estimate) {
    update((ws) => ({ ...ws, estimates: removeBy(ws.estimates, e.id) }));
    setDeleting(null);
  }
  function setStatus(e: Estimate, status: EstimateStatus) {
    update((ws) => ({ ...ws, estimates: upsertBy(ws.estimates, { ...e, status, updatedAt: new Date().toISOString() }) }));
  }
  function exportCsv() {
    const rows = [
      ["estimateNumber", "projectName", "customerName", "status", "sellingPrice"],
      ...workspace.estimates.map((e) => [e.estimateNumber, e.projectName, e.customerName, e.status, String(e.sellingPrice)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estimates.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => {
    return workspace.estimates
      .filter((e) => statusFilter === "all" || e.status === statusFilter)
      .filter((e) => `${e.projectName} ${e.customerName} ${e.estimateNumber}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [workspace.estimates, search, statusFilter]);

  if (mode === "new" || (mode === "edit" && activeEstimate)) {
    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => navigate({ new: undefined, edit: undefined, id: undefined })} className="w-fit text-sm font-medium text-orange no-print">
          &larr; Back to estimates
        </button>
        <EstimateWizard
          existing={mode === "edit" ? activeEstimate : undefined}
          fromTemplate={mode === "new" ? fromTemplate : undefined}
          onDone={(id) => navigate({ new: undefined, edit: undefined, templateId: undefined, id })}
        />
      </div>
    );
  }

  if (mode === "view" && activeEstimate) {
    const result = evaluateEstimate(activeEstimate);
    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => navigate({ id: undefined })} className="w-fit text-sm font-medium text-orange no-print">
          &larr; Back to estimates
        </button>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[58%_42%]">
          <div>
            <EstimateDocument estimate={activeEstimate} />
          </div>
          <Card title="Internal details" subtitle="Never shown to the customer" className="no-print">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Direct cost" value={formatCurrency(result.directCost)} />
              <Stat label="Overhead" value={formatCurrency(result.overheadAmount)} />
              <Stat label="True cost" value={formatCurrency(result.trueCost)} />
              <Stat label="Margin" value={formatPercent(result.currentMargin, 0)} tone={result.isBelowTarget ? "red" : "green"} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => navigate({ edit: activeEstimate.id, id: undefined })}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => window.print()}>
                <Printer size={14} /> Print
              </Button>
              <Button size="sm" variant="ghost" onClick={() => duplicate(activeEstimate)}>
                <Copy size={14} /> Duplicate
              </Button>
              {activeEstimate.status !== "accepted" && (
                <Button size="sm" variant="ghost" onClick={() => setStatus(activeEstimate, "accepted")}>
                  Mark accepted
                </Button>
              )}
              {activeEstimate.status !== "declined" && (
                <Button size="sm" variant="ghost" onClick={() => setStatus(activeEstimate, "declined")}>
                  Mark declined
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Estimates</h1>
          <p className="text-sm text-muted">Every estimate you've built, in one place.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={exportCsv}>
            Export CSV
          </Button>
          <Button onClick={() => navigate({ new: "1" })}>
            <PlusCircle size={16} /> New estimate
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, customer or number" className="pl-9" />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="sm:w-48">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No estimates found" desc="Try a different search or create a new estimate." action={<Button onClick={() => navigate({ new: "1" })}>New estimate</Button>} />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4 shadow-sm hover:border-orange/40">
              <button onClick={() => navigate({ id: e.id })} className="flex-1 text-left">
                <div className="font-medium text-ink">{e.projectName || "Untitled project"}</div>
                <div className="text-xs text-muted">
                  {e.customerName} · {e.estimateNumber}
                </div>
              </button>
              <span className="text-sm font-semibold text-ink">{formatCurrency(e.sellingPrice)}</span>
              <StatusBadge status={e.status} />
              <div className="flex gap-1">
                <button type="button" onClick={() => duplicate(e)} aria-label="Duplicate" className="rounded-lg p-1.5 text-muted hover:bg-warm-white hover:text-ink">
                  <Copy size={15} />
                </button>
                <button type="button" onClick={() => setDeleting(e)} aria-label="Delete" className="rounded-lg p-1.5 text-muted hover:bg-red-light hover:text-red">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleting && (
        <ConfirmDialog title="Delete estimate" message={`Delete "${deleting.projectName}"? This can't be undone.`} confirmLabel="Delete" danger onConfirm={() => remove(deleting)} onCancel={() => setDeleting(null)} />
      )}
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "green" | "red" }) {
  const color = tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-ink";
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`font-semibold ${color}`}>{value}</div>
    </div>
  );
}
