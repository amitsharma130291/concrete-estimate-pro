# Requirements Traceability Matrix — Concrete Cost Pro QA Audit

Branch: `qa/full-audit`. Status vocabulary: PASS / FAIL / FIXED / NOT IMPLEMENTED / BLOCKED / NOT APPLICABLE.
Evidence paths are relative to the repo root.

| Req ID | Requirement | Implementation | Test location | Test type | Initial result | Final result | Evidence | Bug ID |
|---|---|---|---|---|---|---|---|---|
| CALC-01 | Area = length × width | [src/lib/calc.ts:90](../src/lib/calc.ts#L90) | tests/oracle/goldenFixtures.test.ts, tests/property/quantity.property.test.ts | Golden fixture + property/oracle | PASS | PASS | 50 fixtures + 10,000 generated cases, 0 divergence | — |
| CALC-02 | Volume = area × thickness(ft) ÷ 27 | [src/lib/calc.ts:91-93](../src/lib/calc.ts#L91) | tests/property/quantity.property.test.ts (unit-conversion suite) | Property/oracle | PASS | PASS | 5,000 cases, 0 divergence | — |
| CALC-03 | Order qty = net × (1+waste%), rounded per mode | [src/lib/calc.ts:94-95](../src/lib/calc.ts#L94), [roundQuantity](../src/lib/calc.ts#L65) | tests/property/quantity.property.test.ts, tests/oracle/goldenFixtures.test.ts (rounding-boundary-*) | Golden fixture + property | PASS | PASS | 10 rounding-boundary fixtures at exact 0.25/0.5/1.0 edges, all match | — |
| CALC-04 | Rounding always rounds UP (ceiling), never down/nearest | [src/lib/calc.ts:65-78](../src/lib/calc.ts#L65) | tests/property/invariants.property.test.ts (mutation M6) | Mutation test | PASS | PASS | M6 (ceil→floor) killed: 27/112 tests failed | — |
| CALC-05 | Direct cost = sum of 6 cost categories | [src/lib/calc.ts:100-108](../src/lib/calc.ts#L100) | tests/property/invariants.property.test.ts (additivity) | Property + mutation | PASS | PASS | 500 generated cases; mutation M8 (formsCost omitted) killed | — |
| CALC-06 | True cost = direct cost × (1+overhead%) | [src/lib/calc.ts:109-110](../src/lib/calc.ts#L109) | tests/property/invariants.property.test.ts | Property | PASS | PASS | 500 cases, monotonic in overhead | — |
| CALC-07 | Margin = (price−cost)/price; returns null at price≤0 | [src/lib/calc.ts:116-119](../src/lib/calc.ts#L116) | tests/property/pricing.property.test.ts, src/lib/calc.test.ts | Property + unit + mutation | PASS | PASS | 1,000 cases; mutation M1 (+/−), M7 (boundary), M5 (margin/markup swap) all killed | — |
| CALC-08 | Markup = (price−cost)/cost, distinct from margin | [src/lib/calc.ts:122-125](../src/lib/calc.ts#L122) | tests/property/pricing.property.test.ts | Property | PASS | PASS | 1,000 cases | — |
| CALC-09 | Required selling price solves for target margin (not markup) | [src/lib/calc.ts:128-132](../src/lib/calc.ts#L128) | tests/property/pricing.property.test.ts | Property + oracle | PASS | PASS | 1,000 realistic-domain cases + dedicated near-asymptote test (bounded, documented, not a defect) | CCP-001-CANDIDATE (closed, not a bug) |
| CALC-10 | Negative/NaN/undefined inputs clamp to 0, never crash/negative/NaN output | [src/lib/calc.ts:80-82](../src/lib/calc.ts#L80) (`safe()`) | tests/property/quantity.property.test.ts (boundary suite), mutation M9 | Property + mutation | PASS | PASS | 2,000 boundary cases; M9 (validation removed) killed, 5 tests failed | — |
| CALC-11 | Labor cost: flat/hourly/unit modes | [src/lib/calc.ts:149-159](../src/lib/calc.ts#L149) | src/lib/calc.test.ts | Unit | PASS | PASS | Existing 30 unit tests, unchanged | — |
| CALC-12 | Multi-section aggregation (Estimates/Projects) matches sum of single-section math | [src/lib/estimateMath.ts:14-30](../src/lib/estimateMath.ts#L14) | tests/property/invariants.property.test.ts (additivity) | Property | PASS | PASS | 300 generated multi-section cases (1-8 sections), 0 divergence | — |
| CALC-13 | Tax calculation | Not present anywhere in `src/` | — | — | N/A | **NOT IMPLEMENTED** | grep confirms no tax field in types.ts/calc.ts/UI | — |
| CALC-14 | Discount calculation | Not present anywhere in `src/` | — | — | N/A | **NOT IMPLEMENTED** | grep confirms no discount field | — |
| CALC-15 | Metric units | Not present anywhere in `src/` | — | — | N/A | **NOT IMPLEMENTED** | Only `*Ft`/`*In`/`*Yd3` fields exist | — |
| CALC-16 | Bag-quantity calculation | Not present anywhere in `src/` | — | — | N/A | **NOT IMPLEMENTED** | Only ready-mix $/yd³ modeled | — |
| DATA-01 | JSON export produces valid, re-importable file | [src/lib/storage.ts:130-132](../src/lib/storage.ts#L130) | tests/integration/jsonRoundTrip.test.ts | Integration | PASS | PASS | 9/9 tests, 10-step procedure | — |
| DATA-02 | Import rejects malformed/missing-field/wrong-type files with clear errors | [src/lib/storage.ts:140-163](../src/lib/storage.ts#L140) | tests/integration/jsonRoundTrip.test.ts | Integration | PASS | PASS | Steps 7-10 of the procedure | — |
| DATA-03 | Export→import→export is stable (lossless round trip) | [src/lib/storage.ts:130](../src/lib/storage.ts#L130), [140](../src/lib/storage.ts#L140) | tests/integration/jsonRoundTrip.test.ts | Integration | PASS | PASS | Step 6 | — |
| DATA-04 | Estimate created in the Pro app persists to localStorage and survives reload | [src/lib/storage.ts:81-84](../src/lib/storage.ts#L81), EstimateWizard.tsx | tests/e2e/proWorkflow.spec.ts | E2E (Chromium; cross-browser see NFR-08) | PASS | PASS | Full 5-step wizard → localStorage write → reload → still present | — |
| DATA-05 | evaluateEntity NaN-section handling | [src/lib/estimateMath.ts:52-53](../src/lib/estimateMath.ts#L52) | tests/property/invariants.property.test.ts | Property | Confirmed gap | Confirmed gap, NOT REACHABLE via UI or JSON import | UI coerces via `parseFloat(...) \|\| 0`; JSON has no NaN literal (JSON.parse rejects it) — verified in [SectionsEditor.tsx:55](../src/components/app/SectionsEditor.tsx#L55) | Documented, no bug ID (unreachable) |
| PUB-01 | 6 SEO calculator pages load, compute non-NaN/non-Infinity results | src/pages/concrete-*.astro | tests/e2e/publicCalculators.spec.ts | E2E | PASS | PASS | 6/6 pages, chromium | — |
| PUB-02 | Job cost calculator computes required selling price | [JobCostCalculatorIsland.tsx](../src/components/calculator/JobCostCalculatorIsland.tsx) | tests/e2e/publicCalculators.spec.ts | E2E | PASS | PASS | — | — |
| PUB-03 | Estimate template free tool loads and renders | src/pages/concrete-estimate-template.astro | tests/e2e/publicCalculators.spec.ts | E2E | PASS | PASS | — | — |
| PUB-04 | Homepage, calculators hub, legal pages, sitemap/robots all serve | src/pages/*.astro, public/robots.txt | tests/e2e/publicCalculators.spec.ts | E2E | PASS | PASS | 9 additional route checks | — |
| PRO-01 | 5-step estimate wizard (Project/Dimensions/Costs/Price/Customer) creates and saves an estimate | [EstimateWizard.tsx](../src/components/app/EstimateWizard.tsx) | tests/e2e/proWorkflow.spec.ts | E2E | PASS | PASS | — | — |
| PRO-02 | Settings, Catalog tabs load without console errors | AppShell.tsx, SettingsTab.tsx, tabs/CatalogTab | tests/e2e/proWorkflow.spec.ts | E2E | PASS | PASS | Only 2 of 8 Pro tabs directly E2E-tested | See §Scope in TEST_REPORT.md |
| PRO-03 | Templates, RateHealth, Actuals, Projects tabs, Scenario A/B compare, archive/convert-to-project | tabs/*.tsx, ScenarioCompareModal.tsx | — | — | — | **NOT DIRECTLY E2E TESTED** | Time-boxed out of this pass; calculation layer underneath (evaluateEntity) IS covered by property tests | See TEST_REPORT.md §Scope |
| PAY-01 | Paid access gated on verified payment/license state | None — `PurchaseButton.tsx` has only a TODO comment | — | — | N/A | **NOT IMPLEMENTED** | grep confirms no entitlement check anywhere in `src/` | RELEASE-CRITICAL — see TEST_REPORT.md §Payment/License |
| NFR-01 | TypeScript typecheck clean | tsconfig via `astro check` | `npx astro check` | Static analysis | PASS | PASS | reports/baseline/typecheck-baseline.txt: 0 errors, 0 warnings | — |
| NFR-02 | Production build succeeds | `astro build` | `npm run build` | Build | PASS | PASS | reports/baseline/build-baseline.txt: 23 pages built | — |
| NFR-03 | Unit test suite passes | src/lib/*.test.ts | `npm run test` | Unit | PASS | PASS | 30/30 baseline; 112/112 after full suite added | — |
| NFR-04 | npm audit: no known vulnerabilities | package-lock.json | `npm audit` | Dependency scan | PASS | PASS | reports/baseline/npm-audit-baseline.json: 0 vulnerabilities | — |
| NFR-05 | No console errors / unhandled exceptions on public pages | — | tests/e2e/publicCalculators.spec.ts | E2E | PASS | PASS | Console-error assertions on 2 pages directly; 0 found | — |
| NFR-06 | Accessibility: no CRITICAL axe violations | Field/TextInput/NumberInput ([primitives.tsx](../src/components/ui/primitives.tsx)) | tests/e2e/accessibility.spec.ts | E2E + axe-core | **FAIL** (21 nodes, "label" critical, 2 pages) | **FIXED** | 0 critical violations across 6 pages after fix | CCP-003 (fixed) |
| NFR-07 | Accessibility: no SERIOUS (color-contrast) axe violations | src/styles/global.css `--color-orange` | tests/e2e/accessibility.spec.ts | E2E + axe-core | **FAIL** (38 nodes, 6/6 pages) | **FAIL** (unchanged, documented) | Fix attempted, reverted (traded one failing pairing for another) — see CCP-002 | CCP-002 (confirmed, NOT fixed — needs multi-token color system) |
| NFR-08 | Cross-browser: Chromium/Firefox/WebKit | playwright.config.ts | tests/e2e/*.spec.ts | E2E | — | See TEST_REPORT.md §Nonfunctional | Chromium: full pass (25/25). Firefox/WebKit: see report for pass/fail detail | — |
| NFR-09 | Mutation testing: calc.ts survives targeted attacks | reports/mutation/results.txt | Manual/scripted, 9 operators | Mutation | — | PASS | 9/9 mutants killed | — |
| NFR-10 | Responsive layout at common breakpoints | Tailwind responsive utilities throughout | — | — | — | **NOT DIRECTLY TESTED** | No dedicated viewport-resize E2E pass performed this audit | See TEST_REPORT.md §Scope |
| NFR-11 | Broken-link check across public site | — | — | — | — | **NOT DIRECTLY TESTED** | Only explicit nav/related-calculator links exercised via E2E; no exhaustive crawl | See TEST_REPORT.md §Scope |
| NFR-12 | ESLint / lint script | package.json has no `lint` script | — | — | N/A | **NOT IMPLEMENTED** (no linter configured in this project) | — | — |

## Notes on scope

This matrix reflects what was **actually executed** in this audit pass, not the full universe
of possible test cases. Items marked "NOT DIRECTLY TESTED" are not claimed as passing —
they are the explicit, honest scope boundary of this pass, itemized in
`docs/TEST_REPORT.md` §12 (Scope & Limitations) along with a recommendation for follow-up.
