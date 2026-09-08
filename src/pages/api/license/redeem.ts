// Manual unlock path: paste in a license key (from the purchase email) to
// activate on a new device/browser where localStorage never had it. Fully
// self-verifying with no database -- the key contains the real Dodo
// payment_id, so redeeming it is just "look that payment up and check it
// actually succeeded."
export const prerender = false;

import type { APIRoute } from "astro";
import { getDodoClient, isTransientDodoError, jsonResponse } from "../../../lib/server/dodo";
import { buildLicenseKey, parseLicenseKey } from "../../../lib/server/license";

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const parsedKey = parseLicenseKey(body?.licenseKey);
  if (!parsedKey) {
    return jsonResponse({ error: "That doesn't look like a valid license key." }, 400);
  }

  const client = getDodoClient();
  if (!client) {
    console.error("Dodo Payments not configured (missing API key).");
    return jsonResponse({ error: "Payments aren't set up yet.", transient: true }, 500);
  }

  try {
    const payment = await client.payments.retrieve(parsedKey.paymentId);
    const status = String(payment.status ?? "").toLowerCase();

    if (status !== "succeeded") {
      return jsonResponse({ ok: false, status: status || "unknown" });
    }

    return jsonResponse({
      ok: true,
      paymentId: payment.payment_id,
      licenseKey: buildLicenseKey(payment.payment_id),
    });
  } catch (err) {
    console.error("License redeem failed:", err);
    if (isTransientDodoError(err)) {
      return jsonResponse({ error: "Couldn't reach the payment provider. Please try again.", transient: true }, 503);
    }
    // Most commonly a payment id embedded in the key that doesn't exist at
    // all -- a clean "no" (renders as "That license key isn't valid yet."
    // client-side), not a retry-me error.
    return jsonResponse({ ok: false, status: "invalid" });
  }
};
