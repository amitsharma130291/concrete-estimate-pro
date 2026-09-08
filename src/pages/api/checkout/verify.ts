// The single source of truth for "has this browser paid": always asks Dodo
// directly rather than trusting a client-stored flag, so there's nothing to
// forge and nothing to keep in a database. Called once right after the
// checkout redirect returns (or a recovery-email link is clicked).
export const prerender = false;

import type { APIRoute } from "astro";
import { waitUntil } from "@vercel/functions";
import { getDodoClient, isTransientDodoError, jsonResponse } from "../../../lib/server/dodo";
import { buildLicenseKey, buildRecoveryUrl, sendLicenseEmails, sendPaymentFailedNotice } from "../../../lib/server/license";

export const GET: APIRoute = async ({ url }) => {
  const sessionId = url.searchParams.get("sessionId");
  const paymentId = url.searchParams.get("paymentId");
  const sendEmail = url.searchParams.get("sendEmail") === "1";
  if (!sessionId && !paymentId) {
    return jsonResponse({ error: "Missing sessionId or paymentId." }, 400);
  }

  const client = getDodoClient();
  if (!client) {
    console.error("Dodo Payments not configured (missing API key).");
    // Genuinely "we can't check right now", not "this payment is invalid" --
    // marked transient so a caller with an already-stored license (e.g. a
    // developer testing locally without Dodo credentials) isn't locked out
    // over a config gap. See isTransientDodoError's comment for why this
    // must stay separate from a definitive rejection below.
    return jsonResponse({ error: "Payments aren't set up yet.", transient: true }, 500);
  }

  try {
    // CheckoutSessionStatus (what checkoutSessions.retrieve returns) carries
    // payment_status and payment_id but NOT metadata -- only the underlying
    // Payment object does. A sessionId lookup is really "resolve to a
    // payment_id, then read the Payment" -- same as the recovery-link path,
    // which already has a paymentId and skips straight there.
    let resolvedPaymentId = paymentId;
    if (!resolvedPaymentId) {
      const session = await client.checkoutSessions.retrieve(sessionId!);
      if (!session.payment_id) {
        const status = session.payment_status || "pending";
        // Not awaited -- the owner-notification email doesn't need to hold up the
        // response the browser is waiting on to redirect. waitUntil keeps the
        // serverless function alive for it anyway (a no-op locally, where the dev
        // server just keeps running).
        if (sendEmail) {
          waitUntil(sendPaymentFailedNotice({ status, sessionId }).catch((err) => console.error("verify.ts: payment-failed notice failed:", err)));
        }
        return jsonResponse({ ok: false, status });
      }
      resolvedPaymentId = session.payment_id;
    }

    const payment = await client.payments.retrieve(resolvedPaymentId);
    const status = String(payment.status ?? "").toLowerCase();

    if (status !== "succeeded") {
      if (sendEmail) {
        waitUntil(
          sendPaymentFailedNotice({
            status: status || "unknown",
            paymentId: resolvedPaymentId,
            sessionId,
            customerEmail: payment.customer?.email ?? null,
            customerName: payment.customer?.name ?? null,
            payment,
          }).catch((err) => console.error("verify.ts: payment-failed notice failed:", err)),
        );
      }
      return jsonResponse({ ok: false, status: status || "unknown" });
    }

    const licenseKey = buildLicenseKey(payment.payment_id);

    if (sendEmail) {
      // Not awaited -- the customer is sitting on a redirect back to /app that's
      // waiting on this response, and the license itself is already fully
      // confirmed at this point, so there's nothing left for the email send to
      // gate. waitUntil (a no-op outside Vercel, where the dev/prod Node process
      // just keeps running) keeps the serverless function alive long enough for
      // it to actually go out instead of being frozen mid-send. This is still the
      // primary send path (the webhook is the backstop for a closed-tab purchase,
      // not the other way around) -- see license.ts's sendLicenseEmails comment
      // on why an occasional duplicate with the webhook is an acceptable tradeoff
      // against a purchase that emails nothing at all.
      waitUntil(
        sendLicenseEmails({
          customerEmail: payment.customer?.email ?? null,
          customerName: payment.customer?.name ?? null,
          licenseKey,
          recoveryUrl: buildRecoveryUrl({ paymentId: payment.payment_id }),
          payment,
        }).catch((err) => console.error("verify.ts: license email failed:", err)),
      );
    }

    return jsonResponse({
      ok: true,
      paymentId: payment.payment_id,
      licenseKey,
    });
  } catch (err) {
    console.error("Dodo checkout/payment lookup failed:", err);
    if (isTransientDodoError(err)) {
      return jsonResponse({ error: "Couldn't reach the payment provider. Please try again.", transient: true }, 503);
    }
    // A definitive rejection from Dodo -- most commonly a payment id that
    // doesn't exist at all (e.g. a forged localStorage record). This is a
    // clean "no", not an error the client should retry or fail open on.
    if (sendEmail) {
      waitUntil(sendPaymentFailedNotice({ status: "invalid", paymentId, sessionId }).catch((notifyErr) => console.error("verify.ts: payment-failed notice failed:", notifyErr)));
    }
    return jsonResponse({ ok: false, status: "invalid" });
  }
};
