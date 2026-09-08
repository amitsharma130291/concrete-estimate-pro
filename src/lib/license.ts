// Client-side license state: no accounts, no server session -- a purchase
// is just a Dodo payment id, self-verifying against Dodo's API on demand.
// Concrete Cost Pro has one paid tier, so unlike barcodeflow/qrworkbench's
// batch+pro split there's no per-file/job scoping here at all.
const PENDING_KEY = "ccp.pending-checkout.v1";
const LICENSE_KEY = "ccp.license.v1";

export interface StoredLicense {
  sessionId: string | null;
  paymentId: string;
  licenseKey: string;
}

export async function startCheckout(): Promise<void> {
  const res = await fetch("/api/checkout/create", { method: "POST" });
  const data = await res.json();
  if (!res.ok || !data.checkoutUrl) {
    throw new Error(data.error || "Couldn't start checkout.");
  }
  // Survives the round trip to Dodo's hosted checkout and back since
  // sessionStorage is same-origin and untouched by the third-party redirect --
  // this is how we recognize "we just came back from paying" without Dodo
  // needing to echo anything through the return_url itself.
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ sessionId: data.sessionId }));
  window.location.href = data.checkoutUrl;
}

function consumePendingCheckout(): { sessionId: string } | null {
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(PENDING_KEY);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getStoredLicense(): StoredLicense | null {
  try {
    return JSON.parse(localStorage.getItem(LICENSE_KEY) || "null");
  } catch {
    return null;
  }
}

// Dispatched whenever a license is newly stored -- lets independently-mounted
// components (PurchaseButton, LicenseRecovery) react to an unlock that
// happened after their own initial mount-time check (e.g. resolving a
// checkout redirect asynchronously), without needing to share React state
// across two separate client:load islands.
export const LICENSE_STORED_EVENT = "ccp:license-stored";

function storeLicense(license: StoredLicense): void {
  localStorage.setItem(LICENSE_KEY, JSON.stringify(license));
  window.dispatchEvent(new CustomEvent(LICENSE_STORED_EVENT));
}

export function clearStoredLicense(): void {
  localStorage.removeItem(LICENSE_KEY);
}

async function verify(params: { sessionId?: string | null; paymentId?: string | null; sendEmail?: boolean }) {
  const search = new URLSearchParams();
  if (params.sessionId) search.set("sessionId", params.sessionId);
  if (params.paymentId) search.set("paymentId", params.paymentId);
  // Only the "we just came back from checkout" call sets this -- a later
  // re-check must never re-trigger a purchase-confirmation email.
  if (params.sendEmail) search.set("sendEmail", "1");
  const res = await fetch(`/api/checkout/verify?${search}`);
  const data = await res.json();
  if (!res.ok) {
    // Distinguish "couldn't reach Dodo" from every other failure -- only the
    // former is safe to fail open on. See verifyAccess() and
    // isTransientDodoError()'s comment server-side for why this matters: a
    // fabricated payment id must be denied, not excused as a network hiccup.
    throw Object.assign(new Error(data.error || "Couldn't verify payment."), { transient: Boolean(data.transient) });
  }
  return data;
}

// A customer who closes the tab right after paying (before the redirect back
// completes) never hits the sessionStorage path below -- the webhook handler
// emails them a link in that case, shaped like ?checkout=recover&sessionId=..
// (or &paymentId=..). Reading it here means "click the email link" and "get
// redirected back by Dodo" both resolve through one function.
function consumeRecoveryParams(): { sessionId: string | null; paymentId: string | null } | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get("checkout") !== "recover" && params.get("checkout") !== "return") return null;
  const sessionId = params.get("sessionId");
  const paymentId = params.get("paymentId");
  const url = new URL(window.location.href);
  ["checkout", "sessionId", "paymentId"].forEach((k) => url.searchParams.delete(k));
  window.history.replaceState({}, "", url);
  if (!sessionId && !paymentId) return null;
  return { sessionId, paymentId };
}

/**
 * Call once on page load. Resolves either a just-completed Dodo checkout
 * redirect (sessionStorage) or a webhook-emailed recovery link (URL params),
 * confirms the payment against Dodo's API, and remembers it.
 */
export async function resolvePendingCheckout(): Promise<(StoredLicense & { failed?: false }) | { failed: true; status: string } | null> {
  // Only the sessionStorage path is "we just paid, this is the first
  // confirmation" -- the URL-param path means they clicked a link from an
  // email they already have, so sending another one would be redundant.
  const freshCheckout = consumePendingCheckout();
  const pending = freshCheckout || consumeRecoveryParams();
  if (!pending) return null;
  const result = await verify({ ...pending, sendEmail: Boolean(freshCheckout) });
  if (result.ok) {
    const license: StoredLicense = {
      sessionId: pending.sessionId ?? null,
      paymentId: result.paymentId,
      licenseKey: result.licenseKey,
    };
    storeLicense(license);
    return license;
  }
  return { failed: true, status: result.status };
}

/**
 * Manual unlock: paste in a license key from the purchase/recovery email.
 * Works on any device, since the key is fully self-verifying against Dodo --
 * no dependency on this browser's sessionStorage/localStorage history.
 */
export async function redeemLicenseKey(licenseKey: string): Promise<StoredLicense> {
  const res = await fetch("/api/license/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ licenseKey }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Couldn't verify that license key.");
  if (!data.ok) {
    const messages: Record<string, string> = {
      unknown: "That payment hasn't gone through yet.",
    };
    throw new Error(messages[data.status] || "That license key isn't valid yet.");
  }
  const license: StoredLicense = { sessionId: null, paymentId: data.paymentId, licenseKey: data.licenseKey };
  storeLicense(license);
  return license;
}

/** "Forgot your key" -- always resolves to a generic message, whether or not
 * anything was actually found for that email. */
export async function requestLicenseRecovery(email: string): Promise<string> {
  const res = await fetch("/api/license/recover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Couldn't process that request.");
  return data.message;
}

/**
 * Re-checks the stored license live against Dodo rather than trusting
 * localStorage indefinitely -- there's no database, so this call *is* the
 * license check, every time.
 */
export async function verifyAccess(): Promise<StoredLicense | null> {
  const stored = getStoredLicense();
  if (!stored) return null;
  try {
    const result = await verify({ sessionId: stored.sessionId, paymentId: stored.paymentId });
    if (result.ok) return stored;
    // A clean, definitive "no" from the server -- including a payment id
    // that doesn't exist at all -- so stop treating this browser as
    // licensed rather than leaving a rejected record lying around.
    clearStoredLicense();
    return null;
  } catch (err) {
    // localStorage is fully attacker-controlled -- ccp.license.v1 can be set
    // directly via devtools with a fabricated paymentId, with no involvement
    // from resolvePendingCheckout() or redeemLicenseKey() at all. A network
    // hiccup genuinely shouldn't lock out someone who already paid, but
    // that's ONLY true when we couldn't ask Dodo at all (err.transient, set
    // in verify() from isTransientDodoError() server-side) -- a definitive
    // rejection is returned as a normal {ok:false} above, not thrown, so it
    // never reaches this branch.
    if ((err as { transient?: boolean }).transient) return stored;
    clearStoredLicense();
    return null;
  }
}
