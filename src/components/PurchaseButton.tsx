import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { Button } from "./ui/primitives";
import { track } from "../lib/analytics";
import { LICENSE_STORED_EVENT, getStoredLicense, resolvePendingCheckout, startCheckout } from "../lib/license";

export default function PurchaseButton() {
  const [status, setStatus] = useState<"idle" | "starting" | "unlocked" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  // The checkout-return flow resolves on page load, before the visitor has scrolled down to
  // where this button lives -- an inline error here alone would sit below the fold, unseen.
  // A manual "Get Concrete Cost Pro" click failure doesn't need this: the visitor is already
  // looking right at the button they just clicked.
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

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
          const message =
            result.status === "unknown" || result.status === "pending" || result.status === "processing"
              ? "Payment is still processing -- refresh in a moment."
              : result.status === "failed" || result.status === "cancelled" || result.status === "canceled" || result.status === "declined" || result.status === "expired"
                ? "Payment failed -- you haven't been charged. Please try again, or contact us if this keeps happening."
                : "We couldn't confirm that payment. If you were charged, contact us and we'll sort it out.";
          setStatus("error");
          setErrorMessage(message);
          setBannerMessage(message);
          return;
        }
        setStatus("unlocked");
        setLicenseKey(result.licenseKey);
        track("purchase_completed", { price: 79 });
        // Land the customer straight in the product they just bought, rather
        // than leaving them on the pricing page they came from.
        window.location.href = "/app";
      })
      .catch((err) => {
        const message = err.message || "Couldn't confirm your payment.";
        setStatus("error");
        setErrorMessage(message);
        setBannerMessage(message);
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

  const banner = bannerMessage && (
    <div className="fixed inset-x-0 top-0 z-[70] flex items-start justify-center bg-red px-4 py-3 text-white shadow-md sm:items-center">
      <p role="alert" className="text-sm font-medium">
        {bannerMessage}
      </p>
      <button
        type="button"
        onClick={() => setBannerMessage(null)}
        aria-label="Dismiss"
        className="ml-3 shrink-0 rounded p-0.5 text-white/80 hover:bg-white/10 hover:text-white"
      >
        <X size={16} />
      </button>
    </div>
  );

  if (status === "unlocked") {
    return (
      <>
        {banner}
        <div className="rounded-lg border border-green-light bg-green-light p-4 text-center">
          <p className="font-semibold text-ink">You're all set — Concrete Cost Pro is unlocked.</p>
          {licenseKey && <p className="mt-1 font-mono text-xs text-muted">License key: {licenseKey}</p>}
          <a href="/app" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-orange hover:underline">
            Open Concrete Cost Pro <ArrowRight size={16} />
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      {banner}
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
    </>
  );
}
