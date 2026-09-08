// Every "Get Concrete Cost Pro" / "$79 Launch Price" CTA across the marketing
// pages links to /pricing by default (the safe, correct SSR fallback -- most
// visitors haven't bought yet, and license state only exists client-side).
// Once a visitor is actually licensed, those same CTAs should point at the
// app they already own instead of re-selling it to them. Call this once per
// page load (see Layout.astro) -- it finds every element marked
// data-pricing-cta and swaps it in place.
//
// Two label strategies, both handled here: a plain-text CTA (no icon) gets
// its whole textContent replaced; a CTA with an icon alongside the text (e.g.
// an ArrowRight svg) wraps just the text portion in a child element marked
// data-pricing-cta-label, which is swapped instead, leaving the icon intact.
import { LICENSE_STORED_EVENT, getStoredLicense } from "./license";

const CTA_SELECTOR = "[data-pricing-cta]";
const GO_TO_APP_LABEL = "Go to App";

function swapOne(el: HTMLAnchorElement) {
  el.href = "/app";
  const labelEl = el.querySelector<HTMLElement>("[data-pricing-cta-label]");
  if (labelEl) labelEl.textContent = GO_TO_APP_LABEL;
  else el.textContent = GO_TO_APP_LABEL;
}

function applySwap() {
  if (!getStoredLicense()) return;
  document.querySelectorAll<HTMLAnchorElement>(CTA_SELECTOR).forEach(swapOne);
}

export function initPricingCtaSwap(): void {
  applySwap();
  // A purchase or key redemption can happen on this same page (e.g. the
  // pricing page itself) without a navigation in between.
  window.addEventListener(LICENSE_STORED_EVENT, applySwap);
}
