import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "./ui/primitives";
import { track } from "../lib/analytics";
import { LICENSE_STORED_EVENT, getStoredLicense, resolvePendingCheckout, startCheckout } from "../lib/license";

export default function PurchaseButton() {
  const [status, setStatus] = useState<"idle" | "starting" | "unlocked" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredLicense();
    if (stored) {
      setStatus("unlocked");
      setLicenseKey(stored.licenseKey);
    }

    // LicenseRecovery (a separate client:load island on this same page) can
    // also store a license -- via its own redeem/recover flow -- after this
    // component already mounted and rendered its initial state. Without this,
    // pasting a valid key there leaves this button stuck showing "buy" even
    // though the purchase/redeem actually succeeded.
    function onLicenseStored() {
      const license = getStoredLicense();
      if (license) {
        setStatus("unlocked");
        setLicenseKey(license.licenseKey);
      }
    }
    window.addEventListener(LICENSE_STORED_EVENT, onLicenseStored);

    // Runs on every load of this page -- a no-op unless the URL/sessionStorage
    // actually carries a pending checkout or recovery-link params (see
    // resolvePendingCheckout's own doc comment).
    resolvePendingCheckout()
      .then((result) => {
        if (!result) return;
        if ("failed" in result && result.failed) {
          setStatus("error");
          setErrorMessage(
            result.status === "unknown" || result.status === "pending"
              ? "Payment is still processing -- refresh in a moment."
              : "We couldn't confirm that payment. If you were charged, contact us and we'll sort it out.",
          );
          return;
        }
        setStatus("unlocked");
        setLicenseKey(result.licenseKey);
        track("purchase_completed", { price: 79 });
      })
      .catch((err) => {
        setStatus("error");
        setErrorMessage(err.message || "Couldn't confirm your payment.");
      });

    return () => window.removeEventListener(LICENSE_STORED_EVENT, onLicenseStored);
  }, []);

  async function handleClick() {
    track("checkout_started", { price: 79 });
    setStatus("starting");
    setErrorMessage(null);
    try {
      await startCheckout();
      // startCheckout() redirects the page on success -- if we're still here,
      // it threw, which the catch below handles.
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Couldn't start checkout.");
    }
  }

  if (status === "unlocked") {
    return (
      <div className="rounded-lg border border-green-light bg-green-light p-4 text-center">
        <p className="font-semibold text-ink">You're all set — Concrete Cost Pro is unlocked.</p>
        {licenseKey && <p className="mt-1 font-mono text-xs text-muted">License key: {licenseKey}</p>}
        <a href="/app" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-orange hover:underline">
          Open Concrete Cost Pro <ArrowRight size={16} />
        </a>
      </div>
    );
  }

  return (
    <div>
      <Button
        size="lg"
        className="w-full shadow-[0_8px_30px_-8px_rgba(255,90,31,0.7)]"
        onClick={handleClick}
        disabled={status === "starting"}
      >
        {status === "starting" ? "Starting checkout…" : "Get Concrete Cost Pro — $79 Launch Price"}
        <ArrowRight size={18} />
      </Button>
      {status === "error" && errorMessage && (
        <p role="alert" className="mt-3 rounded-lg border border-red-light bg-red-light p-3 text-center text-sm font-medium text-red">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
