import DodoPayments, {
  APIConnectionError,
  APIConnectionTimeoutError,
  RateLimitError,
  InternalServerError,
} from "dodopayments";

// One client per warm serverless instance -- cheap to construct, but no
// reason to rebuild it on every request within the same instance.
let cached: DodoPayments | null = null;

export function getDodoClient(): DodoPayments | null {
  const apiKey = import.meta.env.DODO_PAYMENTS_API_KEY?.trim();
  if (!apiKey) return null;
  if (!cached) {
    cached = new DodoPayments({
      bearerToken: apiKey,
      environment: import.meta.env.DODO_ENVIRONMENT?.trim() === "live_mode" ? "live_mode" : "test_mode",
    });
  }
  return cached;
}

// Single one-time-payment product (Pro) -- created in the Dodo dashboard,
// not via API. Lazy (a function, not a module-level const) because reading
// import.meta.env at module-evaluation time would make this module
// impossible to import outside Astro/Vite's env injection.
export function getProProductId(): string | undefined {
  return import.meta.env.DODO_PRODUCT_ID_PRO?.trim();
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// True only for "we couldn't ask Dodo" -- a dropped connection, a timeout, a
// rate limit, or Dodo's own infrastructure erroring. Deliberately false for
// a definitive answer from Dodo, even a rejection: NotFoundError (no such
// payment id), BadRequestError (malformed id), AuthenticationError/
// PermissionDeniedError (bad API key). Those must never be treated the same
// as a network hiccup -- a fabricated payment id in a forged localStorage
// record throws NotFoundError, and if that were "transient" too, forging a
// license would silently unlock Pro for anyone, for free, forever. Callers
// only fail open (trust a stored license without a fresh confirmation) when
// this returns true; everything else is a hard "no."
export function isTransientDodoError(err: unknown): boolean {
  return (
    err instanceof APIConnectionError ||
    err instanceof APIConnectionTimeoutError ||
    err instanceof RateLimitError ||
    err instanceof InternalServerError ||
    (typeof (err as { status?: unknown })?.status === "number" && (err as { status: number }).status >= 500)
  );
}
