import type { APIRoute } from "astro";
import nodemailer from "nodemailer";

// Runs on-demand as a Vercel serverless function -- every other route stays static.
export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = { name: 200, email: 254, subject: 200, message: 5000 };

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  // Honeypot: a field real visitors never see or fill in (hidden via CSS in the form) --
  // any value here means a bot filled every field blindly. Silently "succeed" instead of
  // telling the bot its submission was rejected.
  const honeypot = typeof body.company === "string" ? body.company.trim() : "";

  if (honeypot) {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (!name || !email || !subject || !message) {
    return badRequest("Name, email, subject and message are all required.");
  }
  if (!EMAIL_RE.test(email)) {
    return badRequest("Enter a valid email address.");
  }
  if (name.length > MAX_LEN.name || email.length > MAX_LEN.email || subject.length > MAX_LEN.subject || message.length > MAX_LEN.message) {
    return badRequest("One of the fields is too long.");
  }

  const gmailUser = import.meta.env.GMAIL_USER;
  const gmailAppPassword = import.meta.env.GMAIL_APP_PASSWORD;
  const toAddress = import.meta.env.CONTACT_TO_EMAIL || "amitsharma00261@gmail.com";

  if (!gmailUser || !gmailAppPassword) {
    // eslint-disable-next-line no-console
    console.error("Contact form: GMAIL_USER / GMAIL_APP_PASSWORD are not configured.");
    return new Response(JSON.stringify({ error: "Email is not configured on the server yet." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailAppPassword },
  });

  try {
    await transporter.sendMail({
      from: `"Concrete Cost Pro Contact Form" <${gmailUser}>`,
      to: toAddress,
      replyTo: `"${name}" <${email}>`,
      subject: `[Concrete Cost Pro Contact] ${subject}`,
      text: `From: ${name} <${email}>\nSubject: ${subject}\n\n${message}`,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Contact form: failed to send email.", err);
    return new Response(JSON.stringify({ error: "Could not send your message. Please try again shortly." }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};
