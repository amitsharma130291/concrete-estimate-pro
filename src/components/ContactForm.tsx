import { useState, type ReactNode } from "react";
import { Button, Card, TextInput } from "./ui/primitives";

/** Label-above-input row, full width -- unlike ui/primitives' Field (a label|input|hint grid
 * capped at a 140px-wide input column, built for the calculators' short numeric fields), a
 * contact form's text/textarea fields need the full card width to be usable. */
function FormRow({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="py-2.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

type Status = "idle" | "sending" | "sent" | "error";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState(""); // honeypot -- hidden from real visitors below
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message, company }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error || "Something went wrong. Please try again.");
        return;
      }
      setStatus("sent");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setStatus("error");
      setErrorMessage("Could not reach the server. Check your connection and try again.");
    }
  }

  if (status === "sent") {
    return (
      <Card>
        <p className="text-lg font-semibold text-ink">Message sent — thanks for reaching out.</p>
        <p className="mt-1 text-sm text-muted">We usually reply within one business day.</p>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-1">
        <FormRow label="Name" htmlFor="contact-name">
          <TextInput id="contact-name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </FormRow>
        <FormRow label="Email" htmlFor="contact-email">
          <TextInput id="contact-email" type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </FormRow>
        <FormRow label="Subject" htmlFor="contact-subject">
          <TextInput id="contact-subject" required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </FormRow>
        <FormRow label="Message" htmlFor="contact-message">
          <textarea
            id="contact-message"
            required
            maxLength={5000}
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink shadow-sm transition focus:border-orange"
          />
        </FormRow>

        {/* Honeypot: invisible to real visitors (off-screen, not display:none -- some bots skip
            display:none fields) and excluded from tab order; a filled value marks a bot. */}
        <input
          type="text"
          name="company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />

        {status === "error" && (
          <p role="alert" className="mt-2 text-sm font-medium text-red">
            {errorMessage}
          </p>
        )}

        <Button type="submit" className="mt-4 self-start" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send message"}
        </Button>
      </form>
    </Card>
  );
}
