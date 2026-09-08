import { useEffect, useState } from "react";
import { Button, TextInput } from "./ui/primitives";
import { LICENSE_STORED_EVENT, getStoredLicense, redeemLicenseKey, requestLicenseRecovery } from "../lib/license";

type Mode = "redeem" | "recover";

export default function LicenseRecovery() {
  const [open, setOpen] = useState(false);
  // PurchaseButton shows its own "you're all set" card once licensed, so this
  // redeem/recover UI would just be redundant clutter beneath it. Re-checked
  // on the license-stored event too, not just at mount -- a checkout redirect
  // resolves asynchronously (see resolvePendingCheckout), often after this
  // component has already mounted and rendered its initial "not licensed" state.
  const [alreadyLicensed, setAlreadyLicensed] = useState(() => Boolean(getStoredLicense()));

  useEffect(() => {
    const onStored = () => setAlreadyLicensed(true);
    window.addEventListener(LICENSE_STORED_EVENT, onStored);
    return () => window.removeEventListener(LICENSE_STORED_EVENT, onStored);
  }, []);
  const [mode, setMode] = useState<Mode>("redeem");
  const [licenseKey, setLicenseKey] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState(false);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setStatus("busy");
    setMessage(null);
    try {
      await redeemLicenseKey(licenseKey.trim());
      setRedeemed(true);
      setStatus("idle");
      // Land the customer straight in the product they already own, rather
      // than leaving them on the pricing page they came from -- matches
      // PurchaseButton's post-checkout redirect.
      window.location.href = "/app";
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Couldn't verify that license key.");
    }
  }

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    setStatus("busy");
    setMessage(null);
    try {
      const result = await requestLicenseRecovery(email.trim());
      setStatus("idle");
      setMessage(result);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Couldn't process that request.");
    }
  }

  if (redeemed) {
    return (
      <p className="mt-3 text-center text-sm font-medium text-green">
        License key accepted — <a href="/app" className="underline">open Concrete Cost Pro</a>.
      </p>
    );
  }

  if (alreadyLicensed) return null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 block w-full text-center text-sm font-medium text-orange hover:underline">
        Already purchased? Enter your license key
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-white p-4">
      <div role="tablist" className="flex gap-1 rounded-lg border border-border bg-warm-white p-1 text-sm">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "redeem"}
          onClick={() => {
            setMode("redeem");
            setMessage(null);
          }}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${mode === "redeem" ? "bg-white text-ink shadow-sm" : "text-muted"}`}
        >
          Enter license key
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "recover"}
          onClick={() => {
            setMode("recover");
            setMessage(null);
          }}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${mode === "recover" ? "bg-white text-ink shadow-sm" : "text-muted"}`}
        >
          Forgot your key?
        </button>
      </div>

      {mode === "redeem" ? (
        <form onSubmit={handleRedeem} className="mt-3 flex flex-col gap-2">
          <label htmlFor="license-key-input" className="text-sm font-medium text-ink">
            License key
          </label>
          <TextInput
            id="license-key-input"
            required
            placeholder="CCP-PRO-..."
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            autoComplete="off"
          />
          <Button type="submit" size="sm" className="mt-1 self-start" disabled={status === "busy"}>
            {status === "busy" ? "Checking…" : "Unlock with key"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleRecover} className="mt-3 flex flex-col gap-2">
          <label htmlFor="recovery-email-input" className="text-sm font-medium text-ink">
            Email used at checkout
          </label>
          <TextInput
            id="recovery-email-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Button type="submit" size="sm" className="mt-1 self-start" disabled={status === "busy"}>
            {status === "busy" ? "Sending…" : "Send my license key"}
          </Button>
        </form>
      )}

      {message && (
        <p role="alert" className={`mt-3 text-sm font-medium ${status === "error" ? "text-red" : "text-green"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
