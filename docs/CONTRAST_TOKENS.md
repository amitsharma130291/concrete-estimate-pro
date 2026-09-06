# Color Contrast Fix (CCP-002) — Token Architecture

**Status: FIXED.** Zero critical or serious axe violations across all 23 public and Pro
routes (`tests/e2e/accessibility.spec.ts`), verified 2026-09-07.

## The problem

A single `--color-orange` token was used both as a background (buttons, with white text)
and as text (links/accents), on both light and dark surfaces. Contrast between white and
orange is symmetric, so one darkened value fixes both the button and light-surface-text
cases at once — but that same darkened value fails against dark (`--color-charcoal`)
backgrounds, which need a *lighter* accent to pop. A single token cannot satisfy both
directions simultaneously.

A prior pass attempted a single-token darken and reverted it for exactly this reason (see
git history on `src/styles/global.css`). This pass fixes it properly with two tokens.

## The fix

```css
--color-orange: #bf3a0c;        /* light surfaces: bg-orange buttons, text-orange on white/warm-white */
--color-orange-dark: #9c2f09;   /* hover state, darker than the base */
--color-orange-ondark: #ff8a5f; /* text-orange-ondark: any text-orange sitting on a dark/charcoal background */
```

Every `text-orange` call site was audited by grep + manual read of surrounding markup
(not just the ones axe happened to flag — a currently-*passing* dark-surface usage would
have silently broken once the base token darkened, so all of them were converted
regardless of prior pass/fail status). Call sites moved to `text-orange-ondark`:

- `src/pages/index.astro` — "For contractors running the business" eyebrow, "Launch price" badge
- `src/pages/pricing.astro` — "Concrete Cost Pro" label, "Save $20" line
- `src/layouts/CalculatorPageLayout.astro`, `src/pages/concrete-estimate-template.astro`,
  `src/pages/concrete-job-cost-calculator.astro` — the "$79 launch price" CTA line
- `src/components/app/AppShell.tsx` — "Pro" in the Pro-app sidebar logo (dark sidebar,
  affects every `/app/*` route)

Two related, adjacent defects surfaced by the same full-site axe pass and fixed alongside:

- **`--color-green` darkened** (`#0a8f47` → `#087a3d`) — failed against both white and
  `--color-green-light` backgrounds (4.17:1 and 3.68:1, both under the 4.5:1 minimum).
  Single token, both usages are light-surface, no dark-surface split needed.
- **`text-red/90` → `text-red`** (two occurrences: `JobCostCalculatorIsland.tsx`,
  `ProjectCalculatorIsland.tsx`, the "below target margin" warning text) — the 90%-opacity
  variant measured 4.22:1 against `--color-red-light`, under the minimum; full-strength red
  measures 4.77:1. Simpler fix than a new token: don't reduce opacity on already-tight text.
- **`text-white/40` → `text-white/55`** (six "$99" strikethrough occurrences across the
  homepage, pricing page, and every calculator page's bottom CTA) — 40% white over
  `--color-charcoal` computes to 3.68:1; 55% computes to a comfortable margin above 4.5:1.

## Additional a11y defects found by the expanded scan (not color-contrast, but same pass)

Expanding the axe scan to cover all 8 Pro tabs (previously only `/app` was checked)
surfaced three more **critical**-impact "missing accessible name" violations, unrelated to
color but caught in the same sweep — fixed alongside:

- `/app/estimates` — the status-filter `<Select>` had no accessible name → added `aria-label`
- `/app/rate-health` — the three scenario-percentage inputs (Ready mix / Labor / Equipment
  change) had a visual-only `<label>` with no `htmlFor` → wired `id`/`htmlFor`
- `/app/settings` — 11 fields (business profile ×4, defaults ×6, notes) had the same
  visual-only-label gap → wired `id`/`htmlFor` on every one

## Verification

`tests/e2e/accessibility.spec.ts` scans all 15 public routes and all 8 Pro routes (23
total) and asserts zero critical-or-serious violations, with no exception list — any
regression here is a hard test failure, not a tracked/known issue.
