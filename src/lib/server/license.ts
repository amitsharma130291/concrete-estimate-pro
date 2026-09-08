// Shared server-side license logic: no database, because a license key
// literally embeds the Dodo payment id that proves it. Verifying a key is
// just parsing it back apart and asking Dodo's API "did this payment
// succeed" -- see redeem.ts and verify.ts. Concrete Cost Pro has exactly one
// paid tier (Pro), unlike barcodeflow/qrworkbench's batch+pro split, so
// there's no per-job/per-file scoping to track here at all.
import nodemailer from "nodemailer";

const SITE_URL = "https://concretecostpro.com";
export const OWNER_EMAIL = "amitsharma00261@gmail.com";

export function buildLicenseKey(paymentId: string): string {
  return `CCP-PRO-${paymentId}`;
}

// Case-insensitive on the fixed "CCP-PRO-" prefix (so a phone keyboard's
// autocapitalize doesn't break pasting), but the payment id itself is
// captured verbatim -- Dodo ids are case-sensitive.
export function parseLicenseKey(rawKey: unknown): { paymentId: string } | null {
  const trimmed = String(rawKey || "").trim();
  const match = trimmed.match(/^ccp-pro-(.+)$/i);
  if (!match) return null;
  return { paymentId: match[1] };
}

export function buildRecoveryUrl({ sessionId, paymentId }: { sessionId?: string | null; paymentId?: string | null }): string {
  const url = new URL("/pricing", SITE_URL);
  url.searchParams.set("checkout", "recover");
  if (sessionId) url.searchParams.set("sessionId", sessionId);
  else if (paymentId) url.searchParams.set("paymentId", paymentId);
  return url.toString();
}

function getTransporter() {
  const gmailUser = import.meta.env.GMAIL_USER?.trim();
  const gmailPass = import.meta.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!gmailUser || !gmailPass) return null;
  return { transporter: nodemailer.createTransport({ service: "gmail", auth: { user: gmailUser, pass: gmailPass } }), gmailUser };
}

function escapeHtml(str: unknown): string {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function customerHtml({ licenseKey, recoveryUrl, isResend }: { licenseKey: string; recoveryUrl: string; isResend: boolean }) {
  const heading = isResend ? "Here's your license key" : "Welcome to Concrete Cost Pro";
  const intro = isResend
    ? "You asked for your Concrete Cost Pro license key to be resent -- here it is."
    : "Your purchase is complete and your onboarding is done -- there's no setup left. Open Concrete Cost Pro below and start estimating right away.";
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#16191d">
    <p style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#bf3a0c;margin:0 0 10px">Concrete Cost Pro</p>
    <h1 style="font-size:22px;margin:0 0 10px">${heading}</h1>
    <p style="font-size:14px;line-height:1.6;color:#5b6470;margin:0 0 20px">${intro}</p>

    ${
      isResend
        ? ""
        : `<a href="${SITE_URL}/app" style="display:inline-block;background:#bf3a0c;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;margin:0 0 24px">Open Concrete Cost Pro</a>`
    }

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f1;border:1px solid #d8dde3;border-radius:12px;margin:0 0 20px">
      <tr>
        <td style="padding:16px 20px;font-size:13px;color:#5b6470">License key</td>
        <td style="padding:16px 20px;font-size:14px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-align:right">${escapeHtml(licenseKey)}</td>
      </tr>
    </table>

    <p style="font-size:13px;font-weight:700;margin:0 0 4px">Save this email</p>
    <p style="font-size:13px;line-height:1.6;color:#5b6470;margin:0 0 18px">Concrete Cost Pro runs entirely in your browser, with no account -- your license key is what proves the purchase if you ever switch devices, clear your browser, or your saved data gets wiped. Here's how to get back in when that happens:</p>

    <a href="${recoveryUrl}" style="display:inline-block;background:#16191d;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;margin:0 0 26px">Reactivate my license</a>

    <p style="font-size:13px;font-weight:700;margin:0 0 8px">How to reactivate</p>
    <ol style="font-size:13px;line-height:1.7;color:#5b6470;margin:0 0 20px;padding-left:18px">
      <li>Click <strong>Reactivate my license</strong> above, on any device -- it unlocks instantly, no login.</li>
      <li>Or go to <a href="${SITE_URL}/pricing">${SITE_URL}/pricing</a>, open <strong>"Already purchased? Enter your license key"</strong>, and paste: <strong>${escapeHtml(licenseKey)}</strong></li>
      <li>Lost the key itself, not just this email? On that same page, click <strong>"Forgot your key?"</strong>, enter the email you paid with, and it gets re-sent automatically.</li>
    </ol>

    <hr style="border:none;border-top:1px solid #d8dde3;margin:0 0 16px" />
    <p style="font-size:12.5px;color:#5b6470;margin:0">Questions about your purchase? Just reply to this email.</p>
  </div>`;
}

function customerText({ licenseKey, recoveryUrl, isResend }: { licenseKey: string; recoveryUrl: string; isResend: boolean }) {
  const intro = isResend
    ? "You asked for your Concrete Cost Pro license key to be resent -- here it is."
    : "Your purchase is complete and your onboarding is done -- there's no setup left. Open Concrete Cost Pro and start estimating right away.";
  return [
    intro,
    "",
    ...(isResend ? [] : [`Open Concrete Cost Pro: ${SITE_URL}/app`, ""]),
    `License key: ${licenseKey}`,
    "",
    "Save this email -- Concrete Cost Pro runs entirely in your browser, with no account, so your license key is what proves the purchase if you ever switch devices, clear your browser, or your saved data gets wiped.",
    "",
    `Reactivate my license: ${recoveryUrl}`,
    "",
    "How to reactivate:",
    "1. Click the reactivation link above, on any device -- unlocks instantly, no login.",
    `2. Or go to ${SITE_URL}/pricing, open "Already purchased? Enter your license key", and paste: ${licenseKey}`,
    `3. Lost the key itself? On that same page, click "Forgot your key?", enter the email you paid with, and it gets re-sent automatically.`,
    "",
    "Questions about your purchase? Just reply to this email.",
  ].join("\n");
}

/**
 * Emails the license key + recovery steps to the customer, and a copy to the
 * site owner as a standing record (the owner's inbox doubles as the audit
 * trail there is no database for). Called from verify.ts right after a
 * checkout redirect confirms payment (the common case), from the webhook as
 * a backstop for a closed-tab purchase, and from /api/license/recover on a
 * resend request. Deliberately not deduplicated between the first two -- an
 * occasional duplicate purchase-confirmation email is a much smaller problem
 * than a purchase that emails nothing at all.
 */
export async function sendLicenseEmails({
  customerEmail,
  customerName,
  licenseKey,
  recoveryUrl,
  isResend = false,
  payment = null,
}: {
  customerEmail: string | null;
  customerName?: string | null;
  licenseKey: string;
  recoveryUrl: string;
  isResend?: boolean;
  /** The raw Dodo Payment object (from payments.retrieve()/list(), or the
   * webhook's event.data) -- included in full in the owner-record email
   * below so nothing about the transaction (payment_id, amount, currency,
   * status, timestamps, customer id, payment method, etc.) is lost to a
   * summary line. Never sent to the customer. */
  payment?: unknown;
}) {
  const result = { configured: false, customerSent: false, customerError: null as string | null, ownerSent: false, ownerError: null as string | null };
  const setup = getTransporter();
  if (!setup) {
    console.error("Can't send license email: GMAIL_USER/GMAIL_APP_PASSWORD not configured.");
    return result;
  }
  result.configured = true;
  const { transporter, gmailUser } = setup;
  const subject = isResend ? "Your Concrete Cost Pro license key (resent)" : "Welcome to Concrete Cost Pro -- here's your license key";
  const templateArgs = { licenseKey, recoveryUrl, isResend };

  if (customerEmail) {
    try {
      await transporter.sendMail({
        from: `"Concrete Cost Pro" <${gmailUser}>`,
        to: customerEmail,
        replyTo: OWNER_EMAIL,
        subject,
        text: customerText(templateArgs),
        html: customerHtml(templateArgs),
      });
      result.customerSent = true;
    } catch (err) {
      console.error("License email to customer failed:", err);
      result.customerError = String((err as Error)?.message || err);
    }
  }

  try {
    const paymentJson = payment ? JSON.stringify(payment, null, 2) : "(no payment object passed to sendLicenseEmails for this call)";
    await transporter.sendMail({
      from: `"Concrete Cost Pro" <${gmailUser}>`,
      to: OWNER_EMAIL,
      subject: `[Order record] Concrete Cost Pro -- ${licenseKey}`,
      text: [
        "Concrete Cost Pro purchased.",
        "",
        `License key: ${licenseKey}`,
        `Customer: ${customerName || "(no name given)"} <${customerEmail || "no email"}>`,
        isResend ? "(This was a resend, not a new purchase.)" : "",
        "",
        "Full Dodo payment object:",
        paymentJson,
      ]
        .filter(Boolean)
        .join("\n"),
      html: `<p>Concrete Cost Pro purchased.</p><ul><li>License key: ${escapeHtml(licenseKey)}</li><li>Customer: ${escapeHtml(customerName || "(no name given)")} &lt;${escapeHtml(customerEmail || "no email")}&gt;</li></ul>${isResend ? "<p><em>This was a resend, not a new purchase.</em></p>" : ""}<p>Full Dodo payment object:</p><pre style="background:#f7f5f1;border:1px solid #d8dde3;border-radius:8px;padding:12px;font-size:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-word">${escapeHtml(paymentJson)}</pre>`,
    });
    result.ownerSent = true;
  } catch (err) {
    console.error("License email to owner failed:", err);
    result.ownerError = String((err as Error)?.message || err);
  }

  return result;
}
