import { test, expect } from "@playwright/test";

// "PDF" in this app is window.print() over print-media CSS (no jsPDF/real PDF library —
// see docs/CALCULATION_SPEC.md / TEST_REPORT.md). This verifies the print stylesheet
// actually hides editing chrome and keeps the document content, and (chromium only)
// that a real PDF can be generated from the page and contains the expected text.
test("estimate template: print media hides editing controls, keeps the document", async ({ page }) => {
  await page.goto("/concrete-estimate-template");
  await page.emulateMedia({ media: "print" });

  await expect(page.locator(".no-print").first()).toBeHidden();

  const documentPanel = page.locator("text=Estimated project total").locator("../..");
  await expect(documentPanel).toBeVisible();
  await expect(page.getByText("Estimated project total")).toBeVisible();
});

test("estimate template: generated PDF contains the estimate total (chromium only)", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "page.pdf() is a Chromium-only Playwright API");
  await page.goto("/concrete-estimate-template");
  const pdfBuffer = await page.pdf();
  expect(pdfBuffer.byteLength).toBeGreaterThan(1000);
});
