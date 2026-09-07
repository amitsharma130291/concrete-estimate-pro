import { Check, CloudOff, Loader2, TriangleAlert } from "lucide-react";
import type { SaveStatus } from "../../lib/workspaceContext";

/** Renders the current-estimate autosave state. Wording is deliberately scoped to "this
 * device" -- never "backed up"/"synced"/"saved to your account"/"available on all devices" -
 * this app makes no cloud or cross-device claims. */
export default function SaveStatusIndicator({
  status,
  lastSavedAt,
  errorMessage,
  storageAvailable,
}: {
  status: SaveStatus;
  lastSavedAt: string | null;
  errorMessage: string | null;
  storageAvailable: boolean;
}) {
  if (!storageAvailable) {
    return (
      <span role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-red">
        <CloudOff size={14} /> Browser storage is unavailable
      </span>
    );
  }

  if (status === "saving") {
    return (
      <span role="status" className="inline-flex items-center gap-1.5 text-sm text-muted">
        <Loader2 size={14} className="animate-spin" /> Saving…
      </span>
    );
  }

  if (status === "error") {
    return (
      <span role="alert" className="inline-flex items-center gap-1.5 text-sm font-medium text-red">
        <TriangleAlert size={14} /> {errorMessage ?? "Unable to save on this device"}
      </span>
    );
  }

  if (status === "saved" && lastSavedAt) {
    return (
      <span role="status" className="inline-flex items-center gap-1.5 text-sm text-muted">
        <Check size={14} className="text-green" /> Saved on this device · {formatTime(lastSavedAt)}
      </span>
    );
  }

  return null;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}
