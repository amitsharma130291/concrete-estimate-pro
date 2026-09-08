import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// CCP-002 (docs/TEST_REPORT.md, docs/CONTRAST_TOKENS.md) is now FIXED: separate
// --color-orange (light surfaces) / --color-orange-ondark (dark surfaces) tokens, plus
// darkened --color-green and two stray text-red/90 / text-white/40 opacity issues found in
// the same pass. A comprehensive scan (tests/e2e/_axeFullSiteScan — see docs/CONTRAST_TOKENS.md
// for the full before/after data) confirmed ZERO color-contrast violations across every
// public and Pro route. No exception list remains — any violation here is a hard failure.
const PUBLIC_ROUTES = [
  "/", "/calculators", "/concrete-cost-calculator", "/concrete-driveway-cost-calculator",
  "/concrete-patio-cost-calculator", "/concrete-sidewalk-cost-calculator", "/concrete-slab-cost-calculator",
  "/concrete-footing-cost-calculator", "/concrete-job-cost-calculator", "/concrete-estimate-template",
  "/concrete-estimating-software", "/pricing", "/terms", "/privacy", "/refund", "/contact",
];
const PRO_ROUTES = ["/app", "/app/estimates", "/app/projects", "/app/templates", "/app/rate-health", "/app/catalog", "/app/actuals", "/app/settings"];

for (const route of [...PUBLIC_ROUTES, ...PRO_ROUTES]) {
  test(`axe a11y scan: ${route} has zero critical or serious violations`, async ({ page }) => {
    await page.goto(route);
    await page.waitForTimeout(300); // let the React island hydrate
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();

    const seriousOrWorse = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    if (seriousOrWorse.length > 0) {
      const summary = seriousOrWorse.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`).join("\n");
      // eslint-disable-next-line no-console
      console.log(`axe violations on ${route}:\n${summary}`);
    }
    expect(seriousOrWorse, JSON.stringify(seriousOrWorse.map((v) => v.id))).toEqual([]);
  });
}
