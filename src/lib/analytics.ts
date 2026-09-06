// Thin analytics wrapper. Safe to call from anywhere — if no analytics provider is
// configured (no PUBLIC_GA_MEASUREMENT_ID set), every call here is a silent no-op.
// See the events tracked list in README-style comments near each call site.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function track(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag === "function") {
    window.gtag("event", event, params);
  }
}

/**
 * Wires up click-delegation for any element carrying data-analytics-event, so plain
 * Astro/HTML links (not just React components) can fire analytics without extra JS.
 * Optional data-analytics-* attributes become event params.
 */
export function initAnalyticsDelegation(): void {
  if (typeof document === "undefined") return;
  document.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement)?.closest<HTMLElement>("[data-analytics-event]");
    if (!target) return;
    const event = target.getAttribute("data-analytics-event");
    if (!event) return;
    const params: Record<string, string> = {};
    for (const attr of target.attributes) {
      if (attr.name.startsWith("data-analytics-") && attr.name !== "data-analytics-event") {
        params[attr.name.replace("data-analytics-", "")] = attr.value;
      }
    }
    track(event, params);
  });
}
