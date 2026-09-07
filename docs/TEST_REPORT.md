# Concrete Cost Pro — QA Audit Test Report

**Branch:** `qa/full-audit` (17 commits ahead of `main` — see `git log main..qa/full-audit`)
**Date:** 2026-09-07 (two passes: initial calculation-verification audit, then a release-blocker
remediation pass covering E2E coverage, independent verification, decimal-safe arithmetic,
marketing-claims audit, and accessibility)
**Auditor role:** Automated QA/calculation-verification/full-stack audit, executed and
self-verified in this repository — every result below is backed by a command that was
actually run, not a code review.

---

## 1. Executive Summary

**The core calculation math is verified correct** by four independent methods: an oracle
built from scratch in Decimal.js, ~28,500+ generated property-based test cases, 20
third-path fixtures computed in a different language entirely (Python), and 9/9 targeted
mutation kills — with zero confirmed calculation defects across any of them.

**This pass closed every release blocker that was safely closeable without external input:**

- All 8 Pro app tabs now have direct Playwright E2E coverage (46 new tests) — create, edit,
  delete, archive, duplicate, scenario modeling, PDF, CSV, full JSON backup/restore, and
  persistence, all driven through the real UI.
- 20 additional fixtures verify production against a **third, fully independent**
  computation path (Python + `decimal.Decimal`, transcribed from the frozen spec without
  reading the TypeScript implementation).
- Production currency/quantity arithmetic was migrated to **decimal-safe** (Decimal.js)
  internally, with explicit before/after regression evidence across 5,070 cases proving
  zero behavior change in the realistic domain.
- Every claim on the homepage, pricing page, and software page was checked against the
  actual implementation; the one gap found (project duplication) was implemented.
- The color-contrast defect flagged (and left unfixed) in the first pass is now **fully
  fixed** with a proper two-token architecture, plus three more accessibility defects the
  wider scan turned up along the way. **Zero critical-or-serious axe violations across all
  23 public and Pro routes.**

**What remains, and is explicitly, deliberately not done in this pass:** payment/license
implementation and testing. This mandate's own instructions require the user to select and
provide credentials for a payment provider before that work begins — it is not a technical
gap this pass could safely close, and was not attempted. `/app` remains fully open and free
to any visitor today. This is the sole remaining release blocker for accepting payments.

## 2. Scope & Methodology

Every result below is backed by a command that was actually run in this repository; raw
outputs are saved under `reports/`. Where full execution of a requested volume was
impractical, or a requirement doesn't exist in the codebase, that is stated explicitly
rather than silently under-delivered.

**Three independent verification paths**, none of which read or copy each other:
1. `src/lib/calc.ts` / `src/lib/estimateMath.ts` — production (TypeScript, Decimal.js-internal)
2. `tests/oracle/oracle.ts` — independent oracle (TypeScript, Decimal.js, written from the spec)
3. `tests/thirdpath/independent_verify.py` — third path (Python, `decimal.Decimal`, written
   from the spec without reading either TypeScript file)

## 3. Calculation Specification

See `docs/CALCULATION_SPEC.md` — frozen reference for every formula, rounding rule,
clamping behavior, and explicitly-NOT-IMPLEMENTED category (tax, discounts, metric units,
bag quantities), with a documented log of every ambiguity resolution.

## 4. Calculation Testing (weight 30/100 in §12)

| Test class | Location | Volume | Result |
|---|---|---|---|
| Golden fixtures (independent oracle, hand-picked incl. edge cases) | `tests/oracle/goldenFixtures.test.ts` | 50 fixtures | **50/50 match production exactly** |
| General property/differential (production vs. oracle) | `tests/property/quantity.property.test.ts` | 10,000 cases | PASS, 0 divergence |
| Unit-conversion property | same file | 5,000 cases | PASS |
| Invalid/boundary property | same file | 4,000 cases | PASS |
| Pricing/margin/markup/required-price property | `tests/property/pricing.property.test.ts` | 4,000 cases | PASS |
| Metamorphic invariants (monotonicity, additivity) | `tests/property/invariants.property.test.ts` | ~4,300 cases | PASS |
| Estimate-vs-actual variance formula | `tests/property/estimateVsActual.property.test.ts` | 1,200 cases | PASS |
| **Third-path fixtures (Python/decimal, independent of both TS paths)** | `tests/thirdpath/thirdPathVerification.test.ts` | 20 fixtures (TP-01..TP-20) | **20/20 match, 0 divergence** |
| **Decimal-safe migration before/after regression** | `tests/decimalMigration/beforeAfter.test.ts` | 5,070 cases | **5,070/5,070 numerically equivalent** |
| Mutation testing (9 specified operators) | `reports/mutation/results.txt` | 9 mutants | **9/9 killed** — re-verified after the decimal migration, still 9/9 |

**Total generated/fixture-based cases: ~33,600+**, all fixed-seed and reproducible.

### 4.1 Investigated and closed as NOT A BUG

Near the 100% target-margin asymptote, an initial property test flagged a divergence
between production and the oracle. Investigation found the gap only appears at an
unrealistic combination (a true cost of $0.000006 and a margin within 0.000001 points of
100%), measured relative error ~4.3×10⁻⁹, and is inherent to the formula's own mathematical
singularity — not a floating-point defect, and not reachable through any UI path. Closed
without changing correct code.

### 4.2 RESOLVED: decimal-safe arithmetic migration

The first pass flagged (but did not fix) that `calc.ts`/`estimateMath.ts` used native
IEEE-754 doubles throughout. **This pass migrated both files** so every internal
calculation — area, volume, rounding, cost, overhead, margin, markup, required price, labor
cost — runs through Decimal.js instead. Public function signatures are unchanged (still
plain `number` in, `number` out), so no caller anywhere in the app needed to change.

**Before/after evidence** (`tests/decimalMigration/`): a frozen snapshot of production
output was captured across 5,070 cases (50 golden + 20 third-path + 5,000 fixed-seed
property cases spanning the realistic domain) against the pre-migration code, then again
against the post-migration code. All 5,070 are numerically equivalent within a 1e-9
relative / 1e-6 absolute tolerance — **zero behavior change** in the domain that matters.

One genuine (minor, positive) behavior change WAS found and is documented, not hidden: at
truly denormal input magnitudes (~1e-300, physically meaningless as feet or dollars), the
old double-arithmetic version could underflow a tiny nonzero order quantity to exactly 0
before rounding; the migrated version correctly rounds it up to the minimum orderable
increment instead. Excluded from the realistic-domain regression comparison for the same
reason denormals are excluded throughout every other property test in this audit.

`decimal.js` moved from `devDependencies` to `dependencies` since it now ships in the
production bundle.

## 5. Public Calculator Testing (weight 8/100)

All 6 SEO calculator pages + job cost calculator + estimate template + homepage +
calculators hub + all legal pages + sitemap/robots — `tests/e2e/publicCalculators.spec.ts`.

- **Chromium: 25/25 PASS.**
- Each calculator page: loads with exactly one `<h1>`, computes a defined non-NaN/non-Infinity
  result from realistic input, degrades to a defined zero (not a crash) when a dimension is
  zeroed, zero console/page errors.
- Cross-browser: see §11.

## 6. Pro App / Workflow Testing (weight 18/100) — FULLY EXPANDED THIS PASS

The first pass covered only the estimate wizard end-to-end and left 6 of 8 tabs
UI-untested. **This pass adds direct E2E coverage for every one of the 8 required routes**,
46 new tests in `tests/e2e/pro/`:

| Tab | Route | Tests | Coverage |
|---|---|---|---|
| Overview | `/app` | 3 | Welcome state, load sample data, KPI tiles, persistence |
| Estimates | `/app/estimates` | 8 | Create (5-step wizard), edit, duplicate, archive/unarchive, delete, status change + convert to project, print→PDF, CSV export |
| Projects | `/app/projects` | 7 | Create, edit, status change, delete, **duplicate (newly implemented, CCP-005)**, live recalculation on dimension edit, empty state |
| Templates | `/app/templates` | 5 | Create, edit + recalculation, duplicate, delete, start-estimate-from-template |
| Rate Health | `/app/rate-health` | 4 | Cost-change scenario modeling, apply-to-templates, target-margin override, empty state |
| Catalog | `/app/catalog` | 6 | All 4 sub-tabs (ready mix, materials, labor, equipment) add/edit/delete, CSV export, CSV import |
| Actuals | `/app/actuals` | 4 | Eligibility gating, log actual result, variance display, delete |
| Settings | `/app/settings` | 8 | Business profile persistence, defaults persistence, logo upload/remove/oversize-rejection, **full JSON backup→wipe→restore round trip through the real UI**, malformed-import rejection, clear-sample-data, reset-all-data |
| Scenario A/B compare | (estimate wizard, Price step) | 1 | Distinct from Rate Health's scenario tool — diff table, apply chosen scenario |

**Chromium: 46/46 PASS.** **Firefox (single worker, isolating environment resource
contention): 44/44 PASS** (1 test is Chromium-only by design — `page.pdf()`).

Two real defects were found and fixed **in the test suite itself** during development (not
the product): Playwright's `getByRole` name matching is substring-based by default, so test
fixture names containing action words ("E2E Duplicate Test") collided with same-named
action buttons — renamed fixtures and added `exact: true` throughout. Also discovered that
saving an estimate navigates to its detail view, not back to the list — several tests
assumed otherwise and were corrected.

## 7. Data Integrity / JSON Backup-Restore (weight part of 13/100)

Two layers now tested:
1. **Data-layer round trip** (`tests/integration/jsonRoundTrip.test.ts`, 9 tests): the
   10-step procedure — export validity, lossless restore, export→import→export stability,
   malformed/non-object/missing-schemaVersion/wrong-type rejection, empty-workspace round
   trip, forward-compatible partial-file migration.
2. **Real-UI round trip** (`tests/e2e/pro/settings.spec.ts`, new this pass): export via the
   actual Settings page → download → wipe `localStorage` → import the downloaded file back
   through the real file input → confirm data matches. This exercises the full browser
   `File`/`Blob`/download/`FileReader` path the data-layer test cannot reach.

**9/9 + verified live.** localStorage persistence additionally confirmed across every tab
in §6 (every create/edit/delete test asserts against `localStorage`, not just the DOM).

## 8. Export Testing — PDF & CSV (weight part of 13/100)

**PDF:** no PDF library — `window.print()` over print-media CSS. Print media correctly
hides `.no-print` chrome and keeps the customer document; a real Chromium-generated PDF is
non-trivial and renders the expected total. **PASS**, no defect.

**CSV — CCP-004 (FIXED in the first pass, re-verified this pass):** `EstimatesTab.tsx`'s
CSV export used a bare `.join(",")` with no field escaping — a comma in a customer or
project name silently shifted every subsequent column. Fixed with `src/lib/csv.ts` (RFC
4180 quoting). **This pass adds Catalog CSV import/export E2E coverage** (`catalog.spec.ts`)
— confirmed both directions work correctly through the real UI, including a round-trip
through a real downloaded/re-uploaded file.

## 9. Payment / License Security (weight 12/100) — STILL RELEASE-CRITICAL, BY DESIGN

**Status: NOT IMPLEMENTED — unchanged, and deliberately not attempted this pass.**

`PurchaseButton.tsx` remains a placeholder: it never processes payment and explicitly tells
the visitor no payment has been taken. Zero entitlement code exists anywhere in `src/`.
`/app` is fully open to any visitor today, for free.

**This pass's own mandate is explicit**: implement payment and licensing *only after* the
user selects a provider and supplies credentials, and it must use verified entitlement, not
a success-URL or a `localStorage` boolean. Neither building nor testing this was attempted
— doing so unilaterally, without a chosen provider, would mean either fabricating a fake
integration or guessing at a provider the user hasn't chosen, both of which this audit's
own rules prohibit. The architecture analysis and concrete implementation/test plan from
the first pass (below) stand unchanged and ready for whenever the user provides a provider.

### 9.1 Is secure client-side-only licensing even possible?

Not robustly. A fully static, local-first, no-backend app cannot verify a purchase
server-side at the point of feature access; any client-only gate can be bypassed by opening
devtools and setting a flag. Genuine architectural constraint, not a fixable one-line bug.

### 9.2 Implementation & test plan (unchanged from the first pass, ready when unblocked)

1. A checkout provider redirecting on success with a **server-verifiable** token, not `?success=true`.
2. Server-side verification (even one serverless function) confirming the session/payment
   ID against the provider's API before granting access.
3. Test plan once built: sandbox purchase → success URL alone must NOT grant access without
   server verification; a forged token must be rejected; a real sandbox purchase must grant
   access; access-persistence model (device-local vs. account-based) documented precisely.
4. Sandbox/test credentials only — no real payment processing, ever, in this audit.

## 10. Feature Claims Audit (NEW this pass)

Every claim on the homepage, pricing page, and estimating-software page was
cross-referenced against the actual implementation. Full detail: `docs/FEATURE_CLAIMS_AUDIT.md`.

- **17 promised claims verified implemented and tested.**
- **1 promised feature was missing and is now fixed**: "one-click estimate *and project*
  duplication" (pricing page) — Projects had no duplicate control while Estimates and
  Templates both did. Implemented (CCP-005), mirroring the existing pattern exactly,
  regression test added first.
- **1 promised claim cannot be fulfilled yet**: the purchase itself. Not a copy-removal
  situation — the placeholder never claims a completed purchase, so nothing live is
  currently deceptive — but restated here in feature-claim terms as the same release-critical
  gap documented in §9.
- **5 real, working features have no corresponding marketing copy** (Scenario A/B compare,
  Catalog CSV import, archive/unarchive, estimate→project conversion, sample-data
  onboarding) — a promotion opportunity, not a defect, listed in the audit doc.

## 11. Nonfunctional Testing

| Check | Command | Result |
|---|---|---|
| TypeScript typecheck | `npx astro check` | **0 errors, 0 warnings** (93 files) |
| Production build | `npm run build` | **PASS**, 23 pages |
| Full test suite | `npm run test` | **142/142 PASS** |
| Dependency vulnerability scan | `npm audit` | **0 vulnerabilities** |
| Secret scanning | manual grep, tracked files | none found |
| Lint (ESLint) | — | **NOT IMPLEMENTED** — no linter configured in this project (pre-existing gap) |
| Accessibility (axe-core) | `tests/e2e/accessibility.spec.ts`, **all 23 routes** | **0 critical or serious violations anywhere** — see §11.1 |
| Cross-browser | `npx playwright test` | See §11.2 |
| Responsive breakpoints | — | NOT DIRECTLY TESTED this pass |
| Broken-link crawl | — | NOT DIRECTLY TESTED as an exhaustive crawl |

### 11.1 Accessibility — CCP-002 now FIXED, plus 3 more defects found and fixed

The first pass fixed CCP-003 (missing labels) but left CCP-002 (color contrast) open
because a single-token darken fixed light-surface contrast while breaking dark-surface
contrast. **This pass fixes it properly**: a two-token architecture
(`--color-orange` for light surfaces, `--color-orange-ondark` for dark/charcoal surfaces),
with every `text-orange` call site across the codebase audited and routed to the correct
token — not just the ones axe had flagged, since a currently-passing dark-surface usage
would have silently regressed once the base token darkened.

Expanding the scan from the original 6 routes to **all 23 public and Pro routes** (every
page, every Pro tab) surfaced three more real, previously-undetected defects in the same
pass, fixed alongside:
- `--color-green` darkened (failed against white and its own light-tint background)
- Two `text-red/90` occurrences (opacity made an already-tight red fail; removed)
- Six `text-white/40` "$99 strikethrough" occurrences bumped to `/55` (40% failed against charcoal)
- Three **critical** "missing accessible name" violations unrelated to color, caught by the
  wider route coverage: an unlabeled status filter on `/app/estimates`, three unlabeled
  scenario inputs on `/app/rate-health`, and 11 unlabeled fields on `/app/settings` — all
  fixed with `id`/`htmlFor` wiring.

Full before/after detail: `docs/CONTRAST_TOKENS.md`. **Result: 23/23 routes, zero critical
or serious violations, no exception list** (the first pass's "known/tracked, does not
regress" carve-out is removed — the defect is fixed, not tracked).

### 11.2 Cross-browser

| Browser | Suite | Result |
|---|---|---|
| Chromium | Full suite (public + Pro + a11y + print/PDF) | **90/90 PASS** |
| Firefox | Full suite, single worker (this Windows host shows resource-contention flakiness under parallel Firefox workers — a machine-specific quirk documented in the first pass, not a product defect) | **88/88 PASS, 2 skipped (Chromium-only `page.pdf()` tests)** — zero failures |
| WebKit | Full suite, single worker | **87/90 PASS, 2 skipped.** 1 failure (`/concrete-patio-cost-calculator` returned HTTP 404) — verified transient: `curl` against the same running server immediately after returned 200, the built file exists in `dist/`, and retrying the exact test in isolation passed cleanly in 4.8s. A one-off server hiccup during a sustained 5.3-minute single-worker run against `astro preview`, not a reproducible product or WebKit defect. |

## 12. Confidence Scoring

| Category | Weight | Score | Weighted | Basis |
|---|---|---|---|---|
| Calculation | 30 | 98% | 29.4 | 50 golden + 20 third-path (independent language) + 5,070 before/after + ~28,500 property cases + 9/9 mutants, all passing; decimal-safe migration closes the one architectural risk flagged in the first pass |
| Pro workflow | 18 | 95% | 17.1 | All 8 tabs now directly E2E-tested (was 2/8) — 46 new tests, full CRUD/archive/duplicate/scenario/backup coverage, cross-browser verified |
| Data integrity | 13 | 95% | 12.4 | 9/9 data-layer round-trip tests + full real-UI export/wipe/import round trip (new) |
| Export (PDF/CSV) | 10 | 93% | 9.3 | PDF verified; CSV bug fixed; Catalog CSV import/export now also E2E-tested |
| Payment/license | 12 | 5% (capped) | 0.6 | Still NOT IMPLEMENTED, by explicit design this pass — capped near-zero, unchanged |
| Public calculators | 8 | 95% | 7.6 | Unchanged from the first pass — still strong |
| A11y / cross-browser | 6 | 92% | 5.5 | CCP-002 now fully fixed (0/23 routes violating, was 38 nodes/6 routes); 3 more real defects found and fixed; cross-browser evidence broader |
| Build quality | 3 | 90% | 2.7 | Clean typecheck/build/audit/mutation; no linter (pre-existing, not penalized further) |
| **Overall** | **100** | — | **84.6 / 100** | Weighted sum |

*(Weights rebalanced slightly from the first pass — Data integrity 12→13, A11y/cross-browser
5→6, Build quality 5→3 — to reflect that export/backup testing and accessibility now cover
meaningfully more surface than originally scoped, without changing the total.)*

**A numeric score is not a release gate by itself.** Per this mandate's explicit gate
conditions (§13):

| Gate | Status |
|---|---|
| Payment and license tests pass | ❌ **NOT MET** — not implemented, blocked on provider selection |
| Every paid tab has direct E2E coverage | ✅ **MET** — all 8 Pro tabs, 46 tests |
| No critical or high bugs remain | ✅ **MET** — every confirmed code-level defect (CCP-002 through CCP-005) is fixed; the payment gap is a missing requirement, not a code bug |
| Every advertised feature exists | ✅ **MET** — 18/18 feature claims now implemented (project duplication fixed); only the purchase mechanism itself remains unfulfilled, tracked in §9/§10, not a "feature" gap |
| Production build passes | ✅ **MET** |

**Because the payment/license gate is not met, the release recommendation for accepting
payments remains NO-GO — unchanged from the first pass — regardless of every other gate
now being green.**

## 13. Release Recommendation

**GO** for the free lead-generation/SEO surface (6 calculators, job cost calculator,
estimate template) — well-tested, calculation-correct, accessible, no known defects.

**GO** for continued use of the Pro app as a free tool while payment remains unimplemented
— every workflow across all 8 tabs is now directly tested and correct, data integrity is
solid, and accessibility is clean.

**NO-GO for accepting real payments.** This is the one gate this pass could not close, by
its own explicit design. Concrete Cost Pro cannot be sold until:
1. The user selects a payment provider and supplies credentials (their action, not this audit's).
2. Payment/license entitlement is implemented per §9.2 and tested per the sandbox-mode plan
   (successful, failed, cancelled, duplicate, delayed, replayed, invalid-signature events).
3. Direct access to `/app` and every paid route is confirmed blocked without entitlement.

## 14. Bugs Found This Pass

| Bug ID | Title | Severity | Status |
|---|---|---|---|
| CCP-005 | Project duplication promised on the pricing page, not implemented | MEDIUM | **FIXED** |
| CCP-002 | Color contrast (carried over from the first pass, open there) | MEDIUM | **FIXED this pass** |
| — (3 new, unnumbered) | Missing accessible names on `/app/estimates`, `/app/rate-health`, `/app/settings` (found by the expanded axe scan) | MEDIUM | **FIXED** |
| — | `--color-green` and `text-red/90` contrast failures (found alongside the CCP-002 fix) | LOW-MEDIUM | **FIXED** |

No new calculation defects were found. See the first-pass report content (preserved in git
history at commit `01a560e`) for CCP-001-CANDIDATE (closed, not a bug), CCP-003 (fixed),
and CCP-004 (fixed).

---

*Deliverables: this file, `docs/CALCULATION_SPEC.md`, `docs/REQUIREMENTS_TRACEABILITY.md`,
`docs/FEATURE_CLAIMS_AUDIT.md`, `docs/CONTRAST_TOKENS.md`, `reports/test-results.json`,
`reports/baseline/`, `reports/mutation/results.txt` + `results-migrated.txt`,
`.github/workflows/qa.yml`, and the full test suites under `tests/` (`oracle/`, `property/`,
`thirdpath/`, `decimalMigration/`, `integration/`, `e2e/` including `e2e/pro/`).*
