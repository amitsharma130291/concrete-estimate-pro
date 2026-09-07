// This file drove the old, separate "Projects" tab through the same 10 user-supplied test
// cases as "09 Pro Estimates" (../fixtures/userTestCases.json's "10 Pro Projects" sheet is a
// duplicate of "09 Pro Estimates", targeting the Projects UI instead of the Estimates UI --
// both exercised the identical underlying evaluateEntity()/calculateCost() math).
//
// Under the single-current-estimate product decision, the Projects tab was removed entirely
// (see src/pages/app/projects.astro, now a redirect, and tests/e2e/pro/projects.spec.ts).
// There is no second UI left to drive with this sheet's data, and the math it exercised is
// already covered by tests/e2e/userSheet/proEstimates.spec.ts against the real Estimates UI
// (same fixture data, same production calculation functions). This file is intentionally
// left empty rather than adapted, since adapting it would just re-run proEstimates.spec.ts's
// own cases a second time against the same code path under a different UI that no longer
// exists.
import { test } from "@playwright/test";

test.describe("User sheet -- 10 Pro Projects (removed)", () => {
  test.skip("superseded by tests/e2e/userSheet/proEstimates.spec.ts -- see file header", () => {});
});
