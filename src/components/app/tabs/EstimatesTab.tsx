import { useEffect, useState } from "react";
import { Copy, FileDown, Info, Printer, RotateCcw } from "lucide-react";
import { createBlankEstimate, isUntouchedBlankEstimate, newId, useWorkspace } from "../../../lib/workspaceContext";
import { hasCorruptCurrentEstimateData, dismissCorruptCurrentEstimateData } from "../../../lib/persistence";
import { evaluateEstimate } from "../../../lib/estimateMath";
import { formatCurrency, formatPercent } from "../../../lib/calc";
import { downloadCsv } from "../../../lib/csv";
import { estimateToCsvRows, ESTIMATE_CSV_HEADERS } from "../../../lib/estimateCsv";
import type { Estimate, EstimateStatus, ProjectTemplate } from "../../../lib/types";
import { Button, Card, Select } from "../../ui/primitives";
import { StatusBadge } from "./OverviewTab";
import EstimateWizard from "../EstimateWizard";
import EstimateDocument from "../EstimateDocument";
import NewEstimateConfirmDialog from "../NewEstimateConfirmDialog";
import { track } from "../../../lib/analytics";

function getParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function nextEstimateNumber(): string {
  // No archive to count against any more -- a short time-based suffix is unique enough in
  // practice for a single-current-estimate, single-device tool.
  return `EST-${new Date().getFullYear()}${Date.now().toString().slice(-5)}`;
}

function estimateFromTemplate(template: ProjectTemplate, defaults: { overheadPercent: number; targetMarginPercent: number; notes: string }): Estimate {
  const now = new Date().toISOString();
  return {
    id: newId("est"),
    estimateNumber: nextEstimateNumber(),
    projectType: template.projectType,
    projectName: template.name,
    customerName: "",
    sections: template.sections.map((s) => ({ ...s, id: newId("sec") })),
    allowancePercent: template.allowancePercent,
    rounding: template.rounding,
    costs: { ...template.defaultCosts },
    labor: template.labor,
    overheadPercent: defaults.overheadPercent,
    targetMarginPercent: defaults.targetMarginPercent,
    sellingPrice: 0,
    notes: defaults.notes,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

/** Duplicating the current estimate never creates a second record -- it seeds a fresh
 * replacement draft with the same values, which still has to go through the same
 * replace-confirmation as any other new estimate. */
function duplicateSeed(e: Estimate): Estimate {
  const now = new Date().toISOString();
  return { ...e, id: newId("est"), estimateNumber: nextEstimateNumber(), status: "draft", createdAt: now, updatedAt: now, isSample: false };
}

export default function EstimatesTab() {
  const { currentEstimate, replaceCurrentEstimate, templates, preferences, catalog, ready } = useWorkspace();
  const params = getParams();
  const templateId = params.get("templateId") ?? undefined;
  const wantsNew = params.get("new") === "1";
  const fromTemplate = templateId ? templates.find((t) => t.id === templateId) : undefined;

  // Deliberately does NOT initialize from `!currentEstimate` -- WorkspaceProvider
  // guarantees currentEstimate is non-null once `ready` is true (it auto-seeds a blank
  // draft itself if none exists), so this only tracks the user's own explicit edit/new/
  // duplicate actions, never "is there anything to show yet".
  const [editing, setEditing] = useState(false);
  const [pendingSeed, setPendingSeed] = useState<Estimate | null>(null);
  const [showCorruptNotice, setShowCorruptNotice] = useState(false);

  useEffect(() => {
    setShowCorruptNotice(hasCorruptCurrentEstimateData());
  }, []);

  // The very first time `ready` flips true, land directly in the wizard if the current
  // estimate is still the provider's auto-seeded, untouched blank draft -- otherwise a
  // brand new visitor sees a mostly-empty "$0 / no project name" summary card instead of
  // being walked into filling it out. Runs once (not on every currentEstimate change) so
  // deliberately going "Back to current estimate" from the wizard doesn't get overridden.
  useEffect(() => {
    if (!ready || !currentEstimate) return;
    if (isUntouchedBlankEstimate(currentEstimate)) setEditing(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // A direct link into "start from template" or "?new=1" still has to go through the same
  // replace-confirmation as the in-page button UNLESS the current estimate is still an
  // untouched blank draft (nothing real to lose -- e.g. the very first visit already
  // auto-seeded one). Gated on `ready` so this never reads `templates`/`currentEstimate`
  // before WorkspaceProvider's own load has populated them.
  useEffect(() => {
    if (!ready) return;
    if (!wantsNew && !fromTemplate) return;
    const seed = fromTemplate
      ? estimateFromTemplate(fromTemplate, { overheadPercent: preferences.defaultOverheadPercent, targetMarginPercent: preferences.defaultTargetMarginPercent, notes: preferences.defaultNotes })
      : createBlankEstimate({
          overheadPercent: preferences.defaultOverheadPercent,
          targetMarginPercent: preferences.defaultTargetMarginPercent,
          allowancePercent: preferences.defaultAllowancePercent,
          rounding: preferences.defaultRounding,
          notes: preferences.defaultNotes,
          readyMixRate: catalog.materials.find((c) => c.kind === "readyMix")?.unitCost ?? 165,
        });
    if (currentEstimate && !isUntouchedBlankEstimate(currentEstimate)) {
      setPendingSeed(seed);
    } else {
      replaceCurrentEstimate(seed);
      setEditing(true);
    }
    // Clear the query params so re-rendering/back-navigation doesn't re-trigger this.
    window.history.replaceState({}, "", "/app/estimates");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function startNew(seed: Estimate) {
    replaceCurrentEstimate(seed);
    setPendingSeed(null);
    setEditing(true);
  }

  function downloadPdf(estimate: Estimate) {
    track("pdf_generated", { source: "estimate_detail" });
    window.print();
  }
  function exportCsv(estimate: Estimate) {
    downloadCsv(`${estimate.estimateNumber}.csv`, [[...ESTIMATE_CSV_HEADERS], ...estimateToCsvRows(estimate)]);
  }

  if (!ready) {
    return <div className="text-sm text-muted">Loading…</div>;
  }

  if (editing || !currentEstimate) {
    return (
      <div className="flex flex-col gap-4">
        {currentEstimate && (
          <button onClick={() => setEditing(false)} className="w-fit text-sm font-medium text-orange no-print">
            &larr; Back to current estimate
          </button>
        )}
        <EstimateWizard onDone={() => setEditing(false)} />
      </div>
    );
  }

  const result = evaluateEstimate(currentEstimate);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-ink">Current Estimate</h1>
          <p className="text-sm text-muted">Your one active estimate, saved on this device.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setPendingSeed(duplicateSeed(currentEstimate))}>
            <Copy size={15} /> Duplicate Current Estimate
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              setPendingSeed(
                createBlankEstimate({
                  overheadPercent: preferences.defaultOverheadPercent,
                  targetMarginPercent: preferences.defaultTargetMarginPercent,
                  allowancePercent: preferences.defaultAllowancePercent,
                  rounding: preferences.defaultRounding,
                  notes: preferences.defaultNotes,
                  readyMixRate: catalog.materials.find((c) => c.kind === "readyMix")?.unitCost ?? 165,
                }),
              )
            }
          >
            <RotateCcw size={15} /> New Estimate
          </Button>
        </div>
      </div>

      {showCorruptNotice && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-amber/30 bg-amber-light px-4 py-3 text-sm text-amber no-print" role="alert">
          <div className="flex items-start gap-2">
            <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>We couldn't restore your last saved estimate on this device — the saved data was invalid or corrupted. You're starting from the estimate below.</span>
          </div>
          <button type="button" onClick={() => { dismissCorruptCurrentEstimateData(); setShowCorruptNotice(false); }} className="shrink-0 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[58%_42%]">
        <div>
          <EstimateDocument estimate={currentEstimate} />
        </div>
        <Card title="Internal details" subtitle="Never shown to the customer" className="no-print">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Direct cost" value={formatCurrency(result.directCost)} />
            <Stat label="Overhead" value={formatCurrency(result.overheadAmount)} />
            <Stat label="True cost" value={formatCurrency(result.trueCost)} />
            <Stat label="Margin" value={formatPercent(result.currentMargin, 0)} tone={result.isBelowTarget ? "red" : "green"} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-muted">Status</span>
            <StatusBadge status={currentEstimate.status} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => downloadPdf(currentEstimate)}>
              <Printer size={14} /> Print / Download PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={() => exportCsv(currentEstimate)}>
              <FileDown size={14} /> Export CSV
            </Button>
            <StatusSelect estimate={currentEstimate} />
          </div>
        </Card>
      </div>

      {pendingSeed && (
        <NewEstimateConfirmDialog
          onDownloadPdf={() => downloadPdf(currentEstimate)}
          onExportCsv={() => exportCsv(currentEstimate)}
          onConfirm={() => startNew(pendingSeed)}
          onCancel={() => setPendingSeed(null)}
        />
      )}
    </div>
  );
}

function StatusSelect({ estimate }: { estimate: Estimate }) {
  const { updateCurrentEstimate, flushCurrentEstimateNow } = useWorkspace();
  function setStatus(status: EstimateStatus) {
    updateCurrentEstimate((e) => ({ ...e, status, updatedAt: new Date().toISOString() }));
    flushCurrentEstimateNow();
  }
  return (
    <Select aria-label="Estimate status" value={estimate.status} onChange={(e) => setStatus(e.target.value as EstimateStatus)} className="w-auto">
      <option value="draft">Draft</option>
      <option value="sent">Sent</option>
      <option value="accepted">Accepted</option>
      <option value="declined">Declined</option>
      <option value="completed">Completed</option>
    </Select>
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
