import { useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { useWorkspace } from "../../../lib/workspaceContext";
import { exportWorkspaceJson, saveWorkspace, validateImport } from "../../../lib/storage";
import type { Rounding } from "../../../lib/types";
import { Button, Card, ConfirmDialog, Field, NumberInput, Select, TextInput } from "../../ui/primitives";

const MAX_LOGO_BYTES = 500_000; // keep the base64 copy small — this lives in every backup/localStorage write

export default function SettingsTab() {
  const { workspace, update, clearSample, resetAll } = useWorkspace();
  const fileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingClearSample, setConfirmingClearSample] = useState(false);

  function handleLogoFile(file: File) {
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(`That image is too large (${Math.round(file.size / 1000)}KB) — please use one under ${Math.round(MAX_LOGO_BYTES / 1000)}KB.`);
      return;
    }
    setLogoError(null);
    const reader = new FileReader();
    reader.onload = () => {
      update((ws) => ({ ...ws, businessProfile: { ...ws.businessProfile, logoDataUrl: reader.result as string } }));
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    update((ws) => ({ ...ws, businessProfile: { ...ws.businessProfile, logoDataUrl: undefined } }));
    setLogoError(null);
  }

  function exportJson() {
    const json = exportWorkspaceJson(workspace);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `concrete-estimate-pro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImportFile(file: File) {
    file.text().then((text) => {
      const result = validateImport(text);
      if (!result.ok || !result.workspace) {
        setImportErrors(result.errors);
        return;
      }
      setImportErrors([]);
      saveWorkspace(result.workspace);
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Settings</h1>
        <p className="text-sm text-muted">Your business profile and defaults. Everything here is stored on this device.</p>
      </div>

      <Card title="Business profile">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-warm-white">
            {workspace.businessProfile.logoDataUrl ? (
              <img src={workspace.businessProfile.logoDataUrl} alt="Business logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-[10px] text-muted">No logo</span>
            )}
          </div>
          <div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => logoFileRef.current?.click()}>
                {workspace.businessProfile.logoDataUrl ? "Replace logo" : "Upload logo"}
              </Button>
              {workspace.businessProfile.logoDataUrl && (
                <button
                  type="button"
                  onClick={removeLogo}
                  aria-label="Remove logo"
                  className="rounded-lg p-2 text-muted hover:bg-red-light hover:text-red"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <input
              ref={logoFileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleLogoFile(e.target.files[0])}
            />
            <p className="mt-1 text-xs text-muted">Appears on your branded customer estimate PDFs. PNG, JPG or SVG, under 500KB.</p>
            {logoError && <p className="mt-1 text-xs text-red">{logoError}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Business name" htmlFor="set-business-name">
            <TextInput
              id="set-business-name"
              value={workspace.businessProfile.businessName}
              onChange={(e) => update((ws) => ({ ...ws, businessProfile: { ...ws.businessProfile, businessName: e.target.value } }))}
            />
          </Field>
          <Field label="Phone" htmlFor="set-phone">
            <TextInput
              id="set-phone"
              value={workspace.businessProfile.phone}
              onChange={(e) => update((ws) => ({ ...ws, businessProfile: { ...ws.businessProfile, phone: e.target.value } }))}
            />
          </Field>
          <Field label="Email" htmlFor="set-email">
            <TextInput
              id="set-email"
              value={workspace.businessProfile.email}
              onChange={(e) => update((ws) => ({ ...ws, businessProfile: { ...ws.businessProfile, email: e.target.value } }))}
            />
          </Field>
          <Field label="Address" htmlFor="set-address">
            <TextInput
              id="set-address"
              value={workspace.businessProfile.address}
              onChange={(e) => update((ws) => ({ ...ws, businessProfile: { ...ws.businessProfile, address: e.target.value } }))}
            />
          </Field>
        </div>
      </Card>

      <Card title="Defaults" subtitle="Used to pre-fill new templates, projects and estimates">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Default overhead (%)" htmlFor="set-overhead">
            <NumberInput
              id="set-overhead"
              value={workspace.settings.defaultOverheadPercent}
              onChange={(e) => update((ws) => ({ ...ws, settings: { ...ws.settings, defaultOverheadPercent: parseFloat(e.target.value) || 0 } }))}
            />
          </Field>
          <Field label="Default target margin (%)" htmlFor="set-target-margin">
            <NumberInput
              id="set-target-margin"
              value={workspace.settings.defaultTargetMarginPercent}
              onChange={(e) => update((ws) => ({ ...ws, settings: { ...ws.settings, defaultTargetMarginPercent: parseFloat(e.target.value) || 0 } }))}
            />
          </Field>
          <Field label="Default loaded labor rate ($/hr)" htmlFor="set-labor-rate">
            <NumberInput
              id="set-labor-rate"
              value={workspace.settings.defaultLoadedLaborRate}
              onChange={(e) => update((ws) => ({ ...ws, settings: { ...ws.settings, defaultLoadedLaborRate: parseFloat(e.target.value) || 0 } }))}
            />
          </Field>
          <Field label="Default order allowance (%)" htmlFor="set-allowance">
            <NumberInput
              id="set-allowance"
              value={workspace.settings.defaultAllowancePercent}
              onChange={(e) => update((ws) => ({ ...ws, settings: { ...ws.settings, defaultAllowancePercent: parseFloat(e.target.value) || 0 } }))}
            />
          </Field>
          <Field label="Default rounding" htmlFor="set-rounding">
            <Select
              id="set-rounding"
              value={workspace.settings.defaultRounding}
              onChange={(e) => update((ws) => ({ ...ws, settings: { ...ws.settings, defaultRounding: e.target.value as Rounding } }))}
            >
              <option value="none">Exact amount</option>
              <option value="quarter">Nearest 0.25 yd³</option>
              <option value="half">Nearest 0.5 yd³</option>
              <option value="whole">Nearest 1 yd³</option>
            </Select>
          </Field>
          <Field label="Estimate validity (days)" htmlFor="set-validity-days">
            <NumberInput
              id="set-validity-days"
              value={workspace.settings.estimateValidityDays}
              onChange={(e) => update((ws) => ({ ...ws, settings: { ...ws.settings, estimateValidityDays: parseFloat(e.target.value) || 0 } }))}
            />
          </Field>
        </div>
        <Field label="Default estimate notes" htmlFor="set-notes">
          <textarea
            id="set-notes"
            value={workspace.settings.defaultNotes}
            onChange={(e) => update((ws) => ({ ...ws, settings: { ...ws.settings, defaultNotes: e.target.value } }))}
            rows={3}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-orange"
          />
        </Field>
      </Card>

      <Card title="Backup & restore" subtitle="Your data lives in this browser — export regularly">
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportJson}>
            <Download size={16} /> Export workspace (JSON)
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Import workspace
          </Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && handleImportFile(e.target.files[0])} />
        </div>
        {importErrors.length > 0 && (
          <ul className="mt-3 list-inside list-disc text-sm text-red">
            {importErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Sample data" subtitle="Danger zone">
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setConfirmingClearSample(true)}>
            Remove sample data
          </Button>
          <Button variant="danger" onClick={() => setConfirmingReset(true)}>
            Reset all data
          </Button>
        </div>
      </Card>

      {confirmingClearSample && (
        <ConfirmDialog
          title="Remove sample data"
          message="This removes only the sample templates, projects and estimates marked as examples. Your own data is untouched."
          confirmLabel="Remove sample data"
          onConfirm={() => {
            clearSample();
            setConfirmingClearSample(false);
          }}
          onCancel={() => setConfirmingClearSample(false)}
        />
      )}
      {confirmingReset && (
        <ConfirmDialog
          title="Reset all data"
          message="This permanently deletes everything — catalog, templates, projects, estimates and actuals — on this device. This can't be undone. Export a backup first if you're not sure."
          confirmLabel="Reset everything"
          danger
          onConfirm={() => {
            resetAll();
            setConfirmingReset(false);
          }}
          onCancel={() => setConfirmingReset(false)}
        />
      )}
    </div>
  );
}
