// This was an early smoke-test file (predates the tests/e2e/pro/ directory) driving the
// same 5-step wizard flow, reading back from the legacy single-blob `cep:workspace:v1` key.
// Under the single-current-estimate rewrite:
//   - The wizard flow itself, more thoroughly, is covered by tests/e2e/pro/estimates.spec.ts
//     ("create: full wizard produces the current estimate, persisted in localStorage").
//   - The Settings/Catalog smoke checks are covered, more thoroughly, by
//     tests/e2e/pro/settings.spec.ts and tests/e2e/pro/catalog.spec.ts.
//   - `cep:workspace:v1` is now only ever read once, for one-time legacy migration (see
//     migrateLegacyDataIfNeeded() in src/lib/persistence.ts) -- the app never writes to it,
//     so this file's own localStorage assertion could never pass under the new model
//     regardless of the UI flow above it.
// Left empty rather than adapted, to avoid maintaining the same coverage in two places.
import { test } from "@playwright/test";

test.describe("Pro app workflow smoke test (superseded)", () => {
  test.skip("superseded by tests/e2e/pro/estimates.spec.ts, settings.spec.ts, catalog.spec.ts -- see file header", () => {});
});
