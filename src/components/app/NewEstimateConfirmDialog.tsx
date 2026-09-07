import { useState } from "react";
import { Download, FileDown, RotateCcw } from "lucide-react";
import { Button, Modal } from "../ui/primitives";

/** Step 5's replace-confirmation dialog. Shared by "New Estimate" and "Duplicate Current
 * Estimate" -- both replace the single saved current estimate, so both go through the same
 * confirmation, with the same warning that there is no archive to recover it from. */
export default function NewEstimateConfirmDialog({
  onDownloadPdf,
  onExportCsv,
  onConfirm,
  onCancel,
  errorMessage,
}: {
  onDownloadPdf: () => void;
  onExportCsv: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  errorMessage?: string | null;
}) {
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    if (confirming) return; // guards against a double-click causing inconsistent state
    setConfirming(true);
    onConfirm();
  }

  return (
    <Modal title="Start a new estimate?" onClose={onCancel}>
      <p className="text-sm text-muted">
        Your current saved estimate will be replaced. Download its PDF or CSV first if you want to retain a copy.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button variant="ghost" size="sm" onClick={onDownloadPdf} className="flex-1">
          <FileDown size={15} /> Download PDF
        </Button>
        <Button variant="ghost" size="sm" onClick={onExportCsv} className="flex-1">
          <Download size={15} /> Export CSV
        </Button>
      </div>
      {errorMessage && (
        <p role="alert" className="mt-3 text-sm font-medium text-red">
          {errorMessage}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={confirming}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleConfirm} disabled={confirming}>
          <RotateCcw size={15} /> Start New Estimate
        </Button>
      </div>
    </Modal>
  );
}
