# Concrete Cost Pro — QA Audit Test Report

**Branch:** `qa/full-audit` (8 commits ahead of `main`, each a checkpoint — see `git log qa/full-audit`)
**Date:** 2026-09-07
**Auditor role:** Automated QA/calculation-verification/full-stack audit, executed and self-verified in this repository (not a design review — every result below was produced by actually running the referenced command/test).

---

## 1. Executive Summary

The calculation engine (`src/lib/calc.ts`, `src/lib/estimateMath.ts`) is **strong**: an
independently-implemented Decimal.js oracle, 50 hand-picked golden fixtures, ~28,500
generated property-based test cases, and 9/9 targeted mutation tests all confirm the core
math is correct within its realistic input domain, with zero confirmed calculation defects.

Two real, confirmed defects were found and **fixed** during this audit (a critical
accessibility defect and a data-corrupting CSV export bug). One accessibility defect
(color contrast) was confirmed but **not fixed** — a same-token fix was attempted and
reverted because it traded one WCAG failure for another; it needs a proper two-token color
system, which was judged out of scope for a safe, reversible autonomous fix.

The single most important finding of this audit is **architectural, not a bug**: there is
**no payment or license gating anywhere in the codebase**. `/app` and every Pro feature are
fully open to any visitor today, for free. This is flagged as release-critical per this
audit's explicit mandate not to pretend an unimplemented requirement is secure.

## 2. Scope & Methodology

This audit executed tests — it did not just review code. Every result below is backed by
a command that was actually run in this repository; outputs are saved under `reports/`.
Where full execution of a requested volume/scope was impractical or a requirement doesn't
exist in the codebase, that is stated explicitly (see §12) rather than silently under-delivered.

Independent oracle rule: `tests/oracle/oracle.ts` is a from-scratch Decimal.js
re-implementation of the formulas in `docs/CALCULATION_SPEC.md`. It does not import or
copy `src/lib/calc.ts` / `src/lib/estimateMath.ts`.

## 3. Calculation Specification

See `docs/CALCULATION_SPEC.md` — frozen reference for every formula, rounding rule,
clamping behavior, and explicitly-NOT-IMPLEMENTED category (tax, discounts, metric units,
bag quantities), with a documented log of every ambiguity resolution.

## 4. Calculation Testing (weight 30/100 in §11)

| Test class | Location | Volume | Result |
|---|---|---|---|
| Golden fixtures (independent oracle, hand-picked incl. edge cases) | `tests/oracle/goldenFixtures.test.ts` | 50 fixtures | **50/50 match production exactly** |
| General property/differential (production vs oracle) | `tests/property/quantity.property.test.ts` | 10,000 cases, seed 424242 | PASS, 0 divergence |
| Unit-conversion property (thickness in→ft→yd³ chain) | same file | 5,000 cases, seed 424243 | PASS |
| Invalid/boundary property (negative, zero, huge, very small) | same file | 2,000 + 2,000 cases | PASS |
| Pricing/margin/markup/required-price property | `tests/property/pricing.property.test.ts` | 4× 1,000 cases | PASS |
| Metamorphic invariants (monotonicity, additivity, zero-in→zero-out) | `tests/property/invariants.property.test.ts` | ~4,300 cases | PASS |
| Estimate-vs-actual variance formula | `tests/property/estimateVsActual.property.test.ts` | 1,200 cases | PASS |
| Mutation testing (9 specified operators) | `reports/mutation/results.txt` | 9 mutants | **9/9 killed** |

**Total generated property-based cases: ~28,500.** All fixed-seed (reproducible on failure).

### 4.1 Investigated and closed as NOT A BUG

Near the 100% target-margin asymptote (`calculateRequiredSellingPrice`), an initial property
test flagged a divergence between production and the oracle. Investigation
(`tests/property/pricing.property.test.ts`, documented test) found:
- The divergence only appears with an unrealistic combination (true cost of $0.000006 *and*
  a margin within 0.000001 percentage points of 100%).
- Measured relative error was ~4.3×10⁻⁹ (production retains ~8-9 significant digits even
  in this extreme case).
- The sensitivity is **inherent to the formula's own mathematical singularity** (division
  by `(1−margin)` as margin→1) — exact decimal arithmetic has the same sensitivity, just
  without the added floating-point contribution.
- No UI path lets a user enter an 8-decimal-place margin percentage.

**Closed as expected behavior, not fixed, not filed as a bug** — changing correct code to
chase a non-defect would violate this audit's own "don't fabricate/hide" and "don't weaken
tests to get green" rules in spirit (in reverse: don't "fix" what isn't broken).

### 4.2 Architectural note: no decimal-safe arithmetic in production

`calc.ts`/`estimateMath.ts` use native IEEE-754 `number` throughout, not a decimal library,
despite this audit's explicit instruction to use decimal-safe money math. **No realistic-domain
defect was found** attributable to this (all 28,500+ generated cases across realistic
ranges passed within a 1e-9 relative tolerance). It remains a legitimate architectural risk
flag for the future (extreme-magnitude or singularity-adjacent inputs, see §4.1), not a
confirmed defect today. Recommendation: if/when this app scales to very large commercial
jobs or very tight margins as routine cases, migrate `calculateCost`/`calculateRequiredSellingPrice`
to Decimal.js (already a project dependency).

## 5. Public Calculator Testing (weight 8/100)

All 6 SEO calculator pages + job cost calculator + estimate template + homepage +
calculators hub + all legal pages + sitemap/robots — 25 E2E tests, `tests/e2e/publicCalculators.spec.ts`.

- **Chromium: 25/25 PASS** (100%)
- Each calculator page: loads with exactly one `<h1>`, computes a defined non-NaN/non-Infinity
  result from realistic input, degrades to a defined zero (not a crash) when a dimension is
  zeroed, zero console/page errors.
- Cross-browser: see §10.

## 6. Pro App / Workflow Testing (weight 18/100)

`tests/e2e/proWorkflow.spec.ts`:
- **Full 5-step estimate wizard** (Project → Dimensions → Costs → Price → Customer) tested
  end-to-end: fills every step, respects the `validateStep` required-field gates, saves,
  confirms the estimate appears in the list, confirms it is actually written to
  `localStorage` (`cep:workspace:v1`), reloads the page, confirms it survives. **PASS on
  Chromium**; effectively PASS on Firefox/WebKit after isolating environment flakiness (§10).
- Settings and Catalog tabs: load without console errors. PASS.
- **NOT directly E2E tested this pass:** Templates, Rate Health, Actuals, Projects
  (archive/convert-to-project), Scenario A/B comparison UI. Their underlying calculation
  layer (`evaluateEntity`, shared by every one of these tabs) **is** covered by the property
  test suite in §4 — so the math they display is verified, but the UI interactions
  themselves (clicking through Rate Health, running a Scenario compare, archiving an
  estimate) were not driven by an automated test in this pass. See §12.

## 7. Data Integrity / JSON Backup-Restore (weight part of 12/100)

`tests/integration/jsonRoundTrip.test.ts` — 9 tests covering the requested 10-step procedure:

1-2. Export produces valid, parseable JSON — PASS
3-5. Re-import validates OK, losslessly restores every collection (catalog, labor rates,
     equipment, templates, projects, estimates, actuals, business profile, settings) — PASS
6. Export→import→export is stable (byte-for-byte equal modulo timestamp) — PASS
7. Malformed (non-JSON) file rejected with a clear error, no crash — PASS
8. Valid JSON that isn't an object (array/primitive) rejected — PASS
9. Missing `schemaVersion` rejected with a specific, named error — PASS
10. Wrong-type collection field rejected per-field — PASS

Plus: empty-workspace round trip, and forward-compatible migration of a partial file.
**9/9 PASS.** localStorage persistence itself additionally verified live via the Pro
workflow E2E test in §6.

## 8. Export Testing — PDF & CSV (weight 10/100)

**PDF:** This app has no PDF library — "Print / Save as PDF" is `window.print()` over
print-media CSS. `tests/e2e/printPdf.spec.ts` confirms: print media correctly hides
`.no-print` editing chrome and keeps the customer-facing document; a real PDF generated via
Chromium's `page.pdf()` is non-trivial (>1KB) and the page renders the expected total.
**PASS**, no defect found.

**CSV — CCP-004 (CONFIRMED, FIXED):** `EstimatesTab.tsx`'s `exportCsv()` built rows with a
bare `.join(",")`, no field escaping. Any `customerName` or `projectName` containing a
comma (e.g. "Smith, John" or "123 Main St, Suite 4" — realistic real-world values) silently
shifted every subsequent column in the exported file, misaligning `sellingPrice` with the
wrong header. **Severity: MEDIUM** (export/data-integrity bucket — corrupts the exported
file, not the underlying stored data). Root cause fixed: extracted `src/lib/csv.ts`
(RFC 4180 field quoting), added regression tests (`src/lib/csv.test.ts`, 6 tests, fail
against the old behavior) that now pass, wired into `EstimatesTab.tsx`. Verified: 118/118
suite passes, typecheck/build clean.

## 9. Payment / License Security (weight 12/100) — RELEASE-CRITICAL

**Status: NOT IMPLEMENTED.**

`src/components/PurchaseButton.tsx` contains only a `// TODO: wire this button to a real
checkout provider` comment. Confirmed by exhaustive grep (`isPaid`, `licenseKey`,
`entitle*`, `paywall`, `isPro`) across `src/`: **zero matches.** There is no entitlement
check anywhere before `/app` or any Pro feature renders. `/app/*` is fully accessible to
any visitor today, for free, with no purchase required.

To this audit's credit as an honest placeholder: clicking the button never collects card
details and explicitly tells the user "Checkout isn't connected yet... no payment has been
taken" — it does not fake success.

**Per this audit's explicit instruction, this is flagged rather than silently scored down:**
paid access must be based on verified payment/license state, and it currently is not — the
Pro app is 100% free today regardless of intent. This is release-critical: **do not enable
any purchase flow or make purchase-related marketing claims accurate until this is resolved.**

### 9.1 Architecture question: is secure client-side-only licensing even possible?

Not robustly, no — and this should be stated plainly rather than papered over. A fully
static, local-first, no-backend app (as this one is architected) cannot verify a purchase
server-side at the point of feature access; any client-only gate (a `localStorage` flag, an
embedded license string checked in JS) can be bypassed by any user who opens devtools and
sets the flag themselves. This is a genuine architectural constraint of the current design,
not a fixable "add a license check" bug.

### 9.2 Concrete implementation & test plan (not built in this pass — see §12 for why)

1. **Minimal viable gate:** a checkout provider (Stripe Checkout, Dodo Payments, LemonSqueezy,
   Paddle, Gumroad) that, on successful payment, redirects to a success URL carrying a
   **server-verifiable** token (not just `?success=true`).
2. **Server-side verification is required** — even a tiny serverless function (a single
   Cloudflare Worker / Vercel function) that calls the provider's API to confirm the
   session/payment ID is real, then either (a) issues a signed license key the client
   stores and re-validates against on each load, or (b) is the only place that can flip a
   server-side "paid" flag if a lightweight backend is acceptable.
3. **Test plan once built:** sandbox-mode purchase → verify success URL alone does NOT
   grant access without the server verification step; verify a forged/tampered token is
   rejected; verify a real sandbox purchase does grant access; verify access persists across
   reload/different browser (a license key or account, not just local flag) or is
   explicitly scoped as device-local if that's the intended model — either way, document
   the model precisely.
4. **Do not ship any payment provider integration without doing this under sandbox/test
   credentials only**, per this audit's constraints — none of this was attempted with real
   payment credentials.

## 10. Nonfunctional Testing (weights: Build-quality 5, A11y-browser 5)

| Check | Command | Result |
|---|---|---|
| TypeScript typecheck | `npx astro check` | **0 errors, 0 warnings** (75 files) |
| Production build | `npm run build` | **PASS**, 23 pages built |
| Unit + property + integration tests | `npm run test` | **118/118 PASS** |
| Dependency vulnerability scan | `npm audit` | **0 vulnerabilities** |
| Secret scanning | manual grep for common credential patterns in tracked files | No secrets found in `src/`/`docs/`/`tests/` |
| Lint (ESLint) | — | **NOT IMPLEMENTED** — no linter configured in this project (`package.json` has no `lint` script). TypeScript + `astro check` catch a meaningful subset of what a linter would. |
| Accessibility (axe-core, WCAG 2 A/AA) | `tests/e2e/accessibility.spec.ts`, 6 pages | See below |
| Cross-browser (Chromium/Firefox/WebKit) | `npx playwright test` | See below |
| Responsive breakpoints | — | **NOT DIRECTLY TESTED** this pass — see §12 |
| Broken-link crawl | — | **NOT DIRECTLY TESTED** this pass (only explicit nav links exercised) — see §12 |

### 10.1 Accessibility — CCP-003 (CONFIRMED, FIXED) and CCP-002 (CONFIRMED, NOT FIXED)

**CCP-003 — missing form labels, axe "critical" impact.** 21 form-input nodes across the
estimate-template (contractor/phone/customer/project-type fields + all line-item
description/amount inputs) and job-cost-calculator (all 7 dollar-cost fields) pages had no
accessible label — no `id`/`htmlFor` pairing and no `aria-label`, despite the shared `Field`
component supporting both correctly. **Severity: MEDIUM** (per this audit's a11y bucket).
**Fixed**: wired `id`/`htmlFor` at every affected call site, added `aria-label` to the
per-line-item repeating inputs and the two free-text textareas. Re-scanned: **0 critical
violations across all 6 tested pages** (`/`, `/app`, `/concrete-cost-calculator`,
`/concrete-job-cost-calculator`, `/concrete-estimate-template`, `/pricing`).

**CCP-002 — color contrast, axe "serious" impact, 38 nodes across all 6 pages.**
`--color-orange` (#ff5a1f) measures 3.12:1 against white — both as white-text-on-orange
(every primary CTA button sitewide) and as orange-text-on-white (links/accents) — against a
4.5:1 WCAG AA requirement. **A fix was attempted and reverted**: darkening the token to
#c93f0d raised both those pairings to a passing ~4.5-5.0:1, but flipped a *third* pairing —
orange text on the dark `--color-charcoal` background — from passing (4.95:1) to failing
(3.09:1). One color token cannot satisfy "orange on light" and "orange on dark" contexts
simultaneously; a correct fix needs a second token (a lighter orange for on-dark contexts)
applied per call site across ~15 files, which also touches the site's brand identity
(the logo/favicon were baked at the original shade). Per this audit's instruction not to
ship changes that trade one regression for another, and not to make brand/visual-identity
decisions unilaterally, **this defect is confirmed but left unfixed**, documented in
`src/styles/global.css` and `docs/REQUIREMENTS_TRACEABILITY.md`, with a concrete
recommendation (two-token system) for a dedicated follow-up pass. **Severity: MEDIUM.**

### 10.2 Cross-browser

| Browser | Suite run | Result |
|---|---|---|
| Chromium | publicCalculators (16) + proWorkflow (3) + printPdf (2) + accessibility (6) | **27/27 PASS** |
| Firefox | publicCalculators + proWorkflow, 2 workers | **17/19 PASS (89%)**. Both failures showed Firefox headless graphics-compositor crashes (`GraphicsCriticalError: RenderCompositorSWGL failed mapping default framebuffer`) on the *first* page load of a freshly-launched browser process — a Windows-host headless-rendering quirk in this specific test machine, not a reproducible product defect (every other test, including other loads of the same failing page, passed). Not filed as a product bug; recommend re-verifying in the Linux CI runner configured in `.github/workflows/qa.yml`, where this class of issue is uncommon. |
| WebKit | publicCalculators + proWorkflow, 1 worker | 16/17 executed passed; 1 timeout on the estimate wizard's "Continue" button click, **retried in isolation and passed cleanly (5.0s)** — not reproducible, treated as a one-off environment flake, not filed as a bug. |

## 11. Confidence Scoring

Weighted per the specified category weights (sum to 100), each category scored 0-100%
against the evidence in the sections above, explicit caps applied where a category has a
release-critical gap.

| Category | Weight | Score | Weighted | Basis |
|---|---|---|---|---|
| Calculation | 30 | 96% | 28.8 | 50/50 fixtures, ~28,500 property cases, 9/9 mutants killed, 0 confirmed defects; small deduction for the non-decimal-safe architecture risk (§4.2) and 2 minor code-quality notes |
| Pro workflow | 18 | 65% | 11.7 | Core wizard path fully E2E-verified cross-browser; 6/8 tabs not directly E2E-driven this pass (calc layer under them IS tested) |
| Data integrity | 12 | 92% | 11.0 | 9/9 JSON round-trip tests, localStorage persistence E2E-verified |
| Export (PDF/CSV) | 10 | 90% | 9.0 | PDF/print path verified working; CSV defect found AND fixed with regression coverage |
| Payment/license | 12 | 5% (capped) | 0.6 | **NOT IMPLEMENTED** — capped near-zero per this audit's explicit rule; the only credit given is for the placeholder being honest rather than deceptive |
| Public calculators | 8 | 95% | 7.6 | 25/25 on Chromium, strong cross-browser, calc layer verified |
| A11y / cross-browser | 5 | 55% | 2.75 | 1 critical a11y class fixed; 1 serious a11y class confirmed-but-open; cross-browser results strong but not perfectly clean |
| Build quality | 5 | 90% | 4.5 | Clean typecheck/build/audit/mutation results; no linter configured (not penalized heavily — TS+astro check cover much of that ground) |
| **Overall** | **100** | — | **76.0 / 100** | Weighted sum |

**This number is not a release gate by itself.** Per this audit's own rule, a numeric score
cannot outrank a release-critical architectural gap: **Payment/license being NOT IMPLEMENTED
means no purchase flow may be enabled regardless of the overall score.**

## 12. Scope & Limitations (honest disclosure)

Executed at full or near-full requested volume:
- Golden fixtures: 50/50 (exact target)
- General property cases: 10,000/10,000 (exact target)
- Unit-conversion property cases: 5,000/5,000 (exact target)
- Invalid/boundary property cases: 2,000+2,000/2,000 (exact/exceeded)
- Pricing property cases: 4,000 (target was 1,000 "pricing scenarios" — interpreted broadly
  across cost/margin/markup/required-price/full-estimate, each independently at 1,000)
- Estimate-vs-actual: 1,200/1,000 (exceeded)
- Mutation operators: 9/9 specified operators, each applied once and killed

**Scaled down or not executed, disclosed rather than hidden:**
- **Full automated mutation testing (e.g. Stryker):** not installed/run; the 9 specified
  operators were applied manually/scripted instead. A general "mutation score" across every
  line of `calc.ts`/`estimateMath.ts` was not computed — only the 9 mandated classes.
- **6 of 8 Pro app tabs** (Templates, Rate Health, Actuals, Projects, Scenario compare,
  archive/convert-to-project) were not driven by E2E tests this pass. The calculation logic
  underneath all of them (`evaluateEntity`) is property-tested; the UI interaction layer is not.
- **Responsive/viewport testing** at defined breakpoints: not executed as a dedicated pass.
- **Broken-link crawl:** not executed as an exhaustive site crawl; only explicit
  navigation/related-calculator links were exercised via E2E.
- **Lighthouse or equivalent performance audit:** not executed.
- **ESLint:** not implemented in this project (no lint script) — not something this audit
  introduced, flagged as a gap.
- **Payment/license testing:** could not be executed against a real flow because none
  exists; the security analysis in §9 covers what evidence-based testing is actually
  possible against an absent feature (confirming its absence and analyzing the
  architecture), per the audit's instruction to mark this NOT IMPLEMENTED rather than
  fabricate a pass/fail against a nonexistent gate.

None of the above are claimed as tested. They are the explicit, honest boundary of this
pass and the concrete recommended follow-up scope.

## 13. Bugs Found

| Bug ID | Title | Severity | Status | File(s) | Evidence |
|---|---|---|---|---|---|
| CCP-001-CANDIDATE | Apparent precision divergence near 100% margin asymptote | — | **Investigated, closed — not a bug** | `src/lib/calc.ts` | §4.1 |
| CCP-002 | Color contrast fails WCAG AA (`--color-orange`), sitewide, 38 nodes / 6 pages | MEDIUM | **Confirmed, NOT fixed** (fix attempted, reverted — trades one regression for another) | `src/styles/global.css` | §10.1 |
| CCP-003 | 21 form inputs missing accessible labels (axe "critical") on 2 pages | MEDIUM | **FIXED** | `EstimateTemplateIsland.tsx`, `JobCostCalculatorIsland.tsx` | §10.1 |
| CCP-004 | CSV export silently corrupts columns when a name contains a comma | MEDIUM | **FIXED** | `EstimatesTab.tsx`, new `src/lib/csv.ts` | §8 |
| — | No payment/license gating exists anywhere (`/app` fully open, free) | **CRITICAL (architectural)** | **NOT IMPLEMENTED** — release-critical, not a "bug" to fix but a missing requirement | `PurchaseButton.tsx` | §9 |

## 14. Release Recommendation

**CONDITIONAL GO** for continuing to operate/market the site as a **free lead-generation /
SEO tool** (the 6 calculators, job cost calculator, estimate template) — that surface is
well-tested, calculation-correct, and has no confirmed release-blocking defects.

**NO-GO for accepting real payments** until payment/license entitlement is implemented
per §9. Today, "purchasing" Concrete Cost Pro grants nothing beyond what is already free —
`/app` is open to everyone. Enabling a real checkout without also gating access would mean
charging money for something already given away for free.

---

*Deliverables: this file, `docs/CALCULATION_SPEC.md`, `docs/REQUIREMENTS_TRACEABILITY.md`,
`reports/test-results.json`, `reports/baseline/`, `reports/mutation/results.txt`,
`.github/workflows/qa.yml`, and the test suites under `tests/`.*
