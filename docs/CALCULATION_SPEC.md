# Concrete Cost Pro — Calculation Specification (Frozen)

**Status:** Frozen for QA audit on branch `qa/full-audit`.
**Source of truth:** This document was written by reading `src/lib/calc.ts` and
`src/lib/estimateMath.ts` verbatim on 2026-09-07. It is the reference used to build an
independent test oracle (`tests/oracle/`). The oracle **must not** import or copy these
production files — it is a from-scratch re-implementation of the formulas below using
`decimal.js`. Any disagreement between production output and the oracle is a candidate
defect, subject to the ambiguity/tolerance rules in §7.

All angle brackets `⟨x⟩` denote a named input. All money/quantity values are plain
JavaScript `number` at the public function boundary (inputs and return values), but as of
the decimal-safe migration (see §7.4 and `docs/TEST_REPORT.md` §4.2), every internal
calculation in `calc.ts`/`estimateMath.ts` runs through Decimal.js — `number` is only used
for the external API, not for the arithmetic itself. The formulas below are unchanged;
only the arithmetic precision performing them changed.

---

## 1. Input sanitization (`safe()`)

Every numeric input to `calc.ts` functions is passed through:

```
safe(n) = n   if Number.isFinite(n) AND n >= 0
        = 0   otherwise
```

i.e. `NaN`, `±Infinity`, `undefined→NaN`, and any negative number are silently clamped to
zero. **Invalid/negative inputs are never rejected or surfaced as errors** — this is a
deliberate, documented product decision (financially conservative: a bad input degrades
toward "zero cost / zero quantity" rather than producing a negative or NaN price). Decided
per the audit's directed rule: "choose the financially conservative and mathematically
defensible rule, document the decision."

`estimateMath.ts`'s per-section clamping uses `Math.max(0, x)` inline instead of calling
`safe()`. This is a style inconsistency (two clamping mechanisms doing the same job) but
is behaviorally equivalent for finite negative inputs. **Known gap:** `Math.max(0, NaN)`
evaluates to `NaN` (NaN fails all comparisons), so a `NaN` section dimension is **not**
clamped to 0 the way it is in `calc.ts`'s `safe()`. This is flagged as a candidate defect
for differential testing (§7, oracle vs. production on `NaN` section inputs).

---

## 2. Quantity calculation (single section) — `calculateQuantity`

Inputs: `lengthFt`, `widthFt`, `thicknessIn`, `allowancePercent`, `rounding?` (all passed
through `safe()` except `rounding`, which defaults to `"none"`).

```
areaSqFt        = lengthFt × widthFt
thicknessFt     = thicknessIn ÷ 12
netCubicFeet    = areaSqFt × thicknessFt
netCubicYards   = netCubicFeet ÷ 27
withAllowance   = netCubicYards × (1 + allowancePercent ÷ 100)
orderQuantityYd3 = roundQuantity(withAllowance, rounding)
```

### 2.1 Rounding (`roundQuantity`)

```
roundQuantity(value, rounding):
  if value is not finite OR value < 0 → return 0
  "quarter" → ceil(value / 0.25) × 0.25
  "half"    → ceil(value / 0.5)  × 0.5
  "whole"   → ceil(value)
  "none" / default → value (unchanged)
```

**Rounding always rounds UP (ceiling)** toward the next increment for `quarter`/`half`/
`whole`. This is a deliberate, documented decision: for a *contractor ordering ready-mix
concrete*, rounding up is the only defensible direction — rounding down risks running out
of concrete mid-pour, which is functionally far worse than over-ordering by a fraction of
a yard. Never round to nearest, never round down.

---

## 3. Multi-section quantity — `combinedAreaSqFt` / `combinedNetCubicYards` / `combinedOrderQuantity`

Used by Estimates/Projects/Templates (anything with a `sections[]` array), in
`src/lib/estimateMath.ts`.

```
combinedAreaSqFt(sections)      = Σ max(0, s.lengthFt) × max(0, s.widthFt)   for each section s
combinedNetCubicYards(sections) = Σ ( max(0, s.lengthFt) × max(0, s.widthFt) × (max(0, s.thicknessIn) ÷ 12) ) ÷ 27
combinedOrderQuantity(sections, allowancePercent, rounding)
                                 = roundQuantity( combinedNetCubicYards(sections) × (1 + allowancePercent ÷ 100), rounding )
```

`allowancePercent` here is **not** clamped via `safe()`/`max(0, …)` before use in
`combinedOrderQuantity` — a negative allowance percent is mathematically applied as-is
(would shrink the order quantity below net volume). Flagged as a candidate boundary defect
for property testing (§7).

### 3.1 `evaluateEntity` — the function that powers Estimates/Projects/Templates/Rate Health

`evaluateEntity` **duplicates** the `combinedOrderQuantity` formula inline rather than
calling it:

```
netCubicYards    = combinedNetCubicYards(entity.sections)
orderQuantityYd3 = roundQuantity( netCubicYards × (1 + entity.allowancePercent ÷ 100), entity.rounding )
```

This is currently byte-identical math to `combinedOrderQuantity(sections, allowancePercent,
rounding)` called with the same arguments — zero observed output divergence — but it is a
code-duplication risk (LOW severity, code-quality note, §9) since a future edit to one path
and not the other would silently diverge. Not a functional defect today; documented as a
maintainability risk only.

---

## 4. Cost calculation — `calculateCost`

Inputs: a `QuantityResult` (only `.orderQuantityYd3` is used), `CostInputs`
(`readyMixRatePerYd3`, `laborCost`, `formsCost`, `reinforcementCost`, `equipmentCost`,
`otherCost`), `overheadPercent`. All cost fields pass through `safe()`.

```
readyMixCost   = orderQuantityYd3 × readyMixRatePerYd3
directCost     = readyMixCost + laborCost + formsCost + reinforcementCost + equipmentCost + otherCost
overheadAmount = directCost × (overheadPercent ÷ 100)
trueCost       = directCost + overheadAmount
```

**Note:** the Job Cost Calculator page (`JobCostCalculatorIsland.tsx`) folds "pump rental"
into `equipmentCost` before calling `calculateCost` (`equipmentCost: equipmentCost +
pumpCost`), and adds a directly-entered `readyMixCost` on top of `cost.directCost` afterward
(since that page has no quantity math — ready-mix is a flat entered dollar figure, not
qty × rate). This is page-level composition, not a change to the core formula, and is
documented here for traceability.

---

## 5. Margin, markup, and required selling price

```
calculateMargin(sellingPrice, trueCost):
  if sellingPrice is not finite OR sellingPrice <= 0 → return null
  else → (sellingPrice − trueCost) ÷ sellingPrice

calculateMarkup(sellingPrice, trueCost):
  if trueCost is not finite OR trueCost <= 0 → return null
  else → (sellingPrice − trueCost) ÷ trueCost

calculateRequiredSellingPrice(trueCost, targetMarginPercent):
  marginDecimal = safe(targetMarginPercent) ÷ 100
  if marginDecimal >= 1 → return Infinity
  else → safe(trueCost) ÷ (1 − marginDecimal)
```

**Margin and markup are explicitly distinct** (margin = profit/price; markup =
profit/cost) and the app always solves pricing off **margin**, never markup — documented
product decision, surfaced to the user in-app FAQ copy on the Job Cost Calculator page.

`calculateMargin` returns `null` (not `0` or an error) when `sellingPrice` is `0` or unset
— this is a deliberate "undefined, not zero" semantic: a $0 selling price has no meaningful
margin. Downstream, `isBelowTarget` is defined as `false` when margin is `null` (see §6) —
i.e. the "below target margin" warning is **suppressed**, not triggered, when no selling
price has been entered yet. This is a documented, deliberate UX decision (don't warn about
underpricing before the user has priced anything) but is flagged for explicit test coverage
since it could be mistaken for a bug (§7, §9).

---

## 6. Full single-entity estimate — `calculateEstimate`

```
quantity = calculateQuantity(dimensions)
cost     = calculateCost(quantity, costs, pricing.overheadPercent)
requiredSellingPrice = calculateRequiredSellingPrice(cost.trueCost, pricing.targetMarginPercent)
currentMargin  = calculateMargin(pricing.sellingPrice, cost.trueCost)
currentMarkup  = calculateMarkup(pricing.sellingPrice, cost.trueCost)
targetDecimal  = safe(pricing.targetMarginPercent) ÷ 100
isBelowTarget  = (currentMargin === null) ? false : (currentMargin < targetDecimal)
profitAtCurrentPrice = safe(pricing.sellingPrice) − cost.trueCost
```

`evaluateEntity` (multi-section: Estimates/Projects) computes the same shape of result but
independently inlines quantity/cost/pricing math rather than calling `calculateEstimate` —
see §3.1.

---

## 7. Labor cost — `calculateLaborCost`

Three modes, selected by `LaborModeInput.mode`:

```
"hourly" → crewSize × hours × ratePerHour     (all safe()'d)
"unit"   → unitRatePerSqft × totalAreaSqFt    (both safe()'d)
"flat"   → returns 0 (caller is expected to use the raw entered flat number directly;
                       this function does not carry the flat value itself)
```

`totalAreaSqFt` for multi-section entities is `combinedAreaSqFt(sections)`.

---

## 8. Formatting (display-layer only, not calculation)

```
formatCurrency(value, {cents?}):
  if value not finite → "—"
  else → Intl.NumberFormat("en-US", {style:"currency", currency:"USD",
           minimumFractionDigits: cents?2:0, maximumFractionDigits: cents?2:0}).format(value)

formatPercent(value, digits=0):
  if value is null or not finite → "—"
  else → `${(value×100).toFixed(digits)}%`

formatYd3(value):
  if value not finite → "—"
  else → `${value.toFixed(2)} yd³`
```

These are **display rounding only** — they do not feed back into any calculation. Any
JS floating-point representation error in the underlying `number` therefore surfaces to
the user only as a formatted string, potentially masking or revealing precision drift
depending on digit count. This is exactly the kind of effect the property/oracle tests in
Phase 4 must check for at the *unrounded* value, not just the formatted string.

---

## 9. Explicitly NOT IMPLEMENTED (confirmed absent by repository inspection)

The following categories appear in the audit's requested formula list but do **not exist**
anywhere in `src/`. They are not "hidden" behind a flag — the code paths simply do not
exist. Each is marked **NOT IMPLEMENTED** in the traceability matrix and confidence score,
per the audit's explicit instruction not to fabricate results for unavailable features:

| Category | Evidence of absence |
|---|---|
| Tax calculation | No `tax` field in `CostInputs`/`PricingInputs`/`types.ts`; no tax-rate input in any calculator UI; grep for `tax` in `src/lib` returns nothing calculation-related. |
| Discount calculation | No `discount` field anywhere in `src/lib/types.ts` or `calc.ts`; no discount input UI. |
| Metric units (m, cm, m³) | All dimension fields are `*Ft`/`*In`, all volume fields are `*Yd3`/`CubicFeet`. No unit-system toggle exists. |
| Bag-quantity calculation (e.g. 80lb bags) | No bag-size constant or bag-count output anywhere in `calc.ts`/`estimateMath.ts`; only ready-mix (`$/yd³`) delivery is modeled. |
| Payment / license gating | `PurchaseButton.tsx` contains only a `// TODO: Dodo Payments` comment; there is no entitlement check, license key, or paid-state field read anywhere before Pro features render. See `docs/TEST_REPORT.md` §Payment/License for the release-critical implication. |

---

## 10. Ambiguity resolutions log

Per the audit instruction ("If implementation behavior is ambiguous, choose the
financially conservative and mathematically defensible rule, document the decision"), the
following pre-existing behaviors are **ratified as intentional** for this audit rather than
treated as defects, each with rationale:

1. **Negative/NaN/undefined numeric inputs clamp to 0** rather than being rejected with a
   validation error. Rationale: a local-first single-user tool with no server-side
   validation boundary; clamping to zero prevents NaN/negative propagation into a
   displayed price, which would be worse (a contractor could show a customer a negative or
   `NaN` quote). Trade-off accepted: silent clamping hides typos from the user instead of
   surfacing them — flagged as a UX (not calculation-correctness) improvement opportunity
   in §9 of `docs/TEST_REPORT.md`, not a bug.
2. **Rounding increments always round up (ceiling)**, never to-nearest. Rationale: concrete
   ordering — running short is materially worse than a small overage. Confirmed correct
   direction; not a defect.
3. **`calculateMargin` returns `null`, and `isBelowTarget` is `false`, when selling price is
   unset/zero.** Rationale: "no price entered" must not visually read as "underpriced."
   Confirmed intentional; test coverage added to lock this behavior in (§7 property suite).
4. **RESOLVED — decimal-safe arithmetic migration.** This spec originally flagged (§4.2 of
   `docs/TEST_REPORT.md`, first pass) that production used raw IEEE-754 doubles throughout,
   tested exhaustively against the independent Decimal.js oracle but not fixed. A later pass
   migrated all internal arithmetic in `calc.ts`/`estimateMath.ts` to Decimal.js, with 5,070
   before/after cases proving zero behavior change in the realistic domain. See
   `docs/TEST_REPORT.md` §4.2 for the full before/after evidence.

---

*End of frozen spec. Any change to `src/lib/calc.ts` or `src/lib/estimateMath.ts` during
this audit invalidates this document and requires a re-freeze before oracle tests can be
trusted.*
