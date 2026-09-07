# Feature Claims Audit — Marketing Copy vs. Implementation

**Scope:** every claim on `/` (homepage), `/pricing`, `/concrete-estimating-software`, and the
Pro feature lists embedded in those pages, cross-referenced against the actual Pro app
(`src/components/app/`) as verified by the E2E suite in `tests/e2e/pro/`.

**Method:** every row below is backed by either a passing E2E test (cited) or a direct grep
against the component that would implement it (cited). Nothing in this table is asserted from
memory of what "should" exist.

---

## Promised and implemented

| Claim | Where advertised | Implementation | Verified by |
|---|---|---|---|
| Saved ready-mix, material, labor, equipment rates | Home, Pricing, Software page | `CatalogTab.tsx` (4 sub-tabs) | `tests/e2e/pro/catalog.spec.ts` (6 tests) |
| Multi-section project estimating | Home, Pricing, Software page | `SectionsEditor.tsx` + `evaluateEntity` | `tests/e2e/pro/projects.spec.ts`, `estimates.spec.ts`; property-tested in `tests/property/invariants.property.test.ts` (additivity) |
| Reusable project templates | Home, Pricing, Software page | `TemplatesTab.tsx` | `tests/e2e/pro/templates.spec.ts` (5 tests) |
| Overhead and target-margin pricing | Pricing, Software page | `calc.ts` (`calculateCost`/`calculateRequiredSellingPrice`) | 138+ Vitest cases across golden fixtures, property tests, third-path fixtures |
| Rate Health audit for standard prices | Home, Pricing, Software page | `RateHealthTab.tsx` | `tests/e2e/pro/rateHealth.spec.ts` (4 tests) |
| Required-price solver | Home, Pricing, Software page | `calculateRequiredSellingPrice` | Same as above |
| Cost-change scenarios | Home, Pricing, Software page | Rate Health scenario modeling **and** the separate Scenario A/B compare modal | `rateHealth.spec.ts` (apply-to-templates test), `scenarioCompare.spec.ts` |
| Estimate vs. actual tracking | Pricing, Software page | `ActualsTab.tsx` | `tests/e2e/pro/actuals.spec.ts` (4 tests) |
| Historical quantity/labor/margin variance reports | Pricing, Software page | `ActualsTab.tsx` variance tables | `actuals.spec.ts` (variance-display test) |
| Branded, customer-ready estimate PDFs | Home, Pricing | Logo upload (`SettingsTab.tsx`) rendered in `EstimateDocument.tsx`, printed via `window.print()` | `settings.spec.ts` (logo upload/remove), `estimates.spec.ts` (print test), `printPdf.spec.ts` |
| CSV export | Home, Pricing | `EstimatesTab.tsx`, `CatalogTab.tsx` | `estimates.spec.ts`, `catalog.spec.ts` |
| Full JSON backup/restore | Home, Pricing, Software page | `SettingsTab.tsx` export/import, `src/lib/storage.ts` | `settings.spec.ts` (full round trip through the real UI: export → wipe → import → data matches), `tests/integration/jsonRoundTrip.test.ts` |
| Business profile with saved defaults | Pricing | `SettingsTab.tsx` | `settings.spec.ts` (2 tests) |
| No account required, runs in browser | Home, Pricing, Software page FAQ | Confirmed architecturally — no auth code, no server, `localStorage`-only | Repo-wide grep, confirmed in every E2E test (no login step anywhere) |
| One-click estimate duplication | Pricing ("estimate and project duplication") | `EstimatesTab.tsx` | `estimates.spec.ts` (duplicate test) |
| One-click project duplication | Pricing ("estimate and project duplication") | **Was missing — fixed in this pass, see below** | `projects.spec.ts` (duplicate test, added with the fix) |
| No monthly subscription (architecturally) | Home, Pricing, Software page | Confirmed — no recurring-billing code exists anywhere in the repo | grep for `subscription`, `recurring`, `interval` in `src/` — no matches |

## Promised but missing

| Claim | Where advertised | Status | Resolution |
|---|---|---|---|
| **One-click project duplication** | Pricing page, "Win and track the job": *"One-click estimate and project duplication"* | Confirmed absent — `ProjectsTab.tsx` had zero `duplicate`/`Copy` references while `EstimatesTab.tsx` and `TemplatesTab.tsx` both had the identical pattern | **FIXED in this pass** (CCP-005) — implemented the same one-click duplicate pattern, regression test added first, verified. See `git log` for the fix commit. |
| **"$79 launch price," "one-time payment," "lifetime access" (the purchase itself)** | Home, Pricing, Software page — the entire commercial premise of the site | `PurchaseButton.tsx` is a placeholder: clicking it does not process any payment and explicitly tells the visitor *"Checkout isn't connected yet... no payment has been taken."* There is no entitlement check anywhere — `/app` is fully open today, for free, to any visitor. | **Not implementable in this pass** — this mandate's own instructions (item 7) require the user to select and provide credentials for a payment provider before any checkout can be built; implementing one unilaterally is explicitly out of scope here. **Not flagged for copy removal** either: the placeholder is honest (never claims success), so nothing on the live site is currently deceptive. This is the release-critical blocker already documented in `docs/TEST_REPORT.md` §9 — the marketing claim becomes accurate the moment Phase 7 (payment implementation) lands, and remains a promise the business intends to keep, not dead copy to delete. **Recommendation:** do not enable any purchase-related ad spend or claims of "X customers bought this" until Phase 7 ships. |

No other promised feature was found missing. Every other claim on all three pages traced to a
real, tested implementation.

## Implemented but not promised

These are real, working features with no corresponding marketing copy — not defects, but
missed opportunities to sell what's already built:

| Feature | Implementation | Why it's worth promoting |
|---|---|---|
| Scenario A/B side-by-side compare (distinct from Rate Health) | `ScenarioCompareModal.tsx`, triggered from the estimate wizard's Price step | The current copy ("cost-change scenarios") only describes Rate Health's bulk what-if tool. The wizard's own two-column "Scenario A vs B, apply whichever you want" compare is a stronger, more concrete sales point and isn't named anywhere in marketing copy. |
| CSV import for the Catalog | `CatalogTab.tsx` `importCsv()` | Marketing only says "CSV export." Contractors migrating from a spreadsheet can also import their existing catalog — undersold. |
| Archive / unarchive estimates | `EstimatesTab.tsx` | Useful for keeping a long estimate list workable; not mentioned anywhere. |
| Convert an accepted estimate directly to a tracked project | `EstimatesTab.tsx` `convertToProject()` | Bridges the estimate and project-tracking halves of the product in one click; not called out despite being a meaningful workflow feature. |
| Sample data seeding for first-run onboarding | `OverviewTab.tsx` "Load sample data" | An onboarding aid, reasonably left out of external marketing (it's a first-run UX detail, not a selling point), noted here for completeness rather than as a recommendation to add copy. |

## Summary

- **17 promised claims verified as implemented and tested.**
- **1 promised feature was missing and has been fixed** (project duplication, CCP-005).
- **1 promised claim (the purchase itself) cannot be fulfilled** until payment is implemented —
  this is the same release-critical gap already documented in `docs/TEST_REPORT.md`, restated
  here in feature-claim terms rather than architecture terms. No copy change is recommended;
  the placeholder button is already honest about not having taken payment.
- **5 real features are undersold** — a marketing-copy opportunity, not a defect, listed above
  for whoever next updates these pages.
