// One-off script: captures clean, consistent screenshots of the app for the
// /how-to-use guide page. Not part of the build or test suite -- run manually
// with `node scripts/captureGuideScreenshots.mjs` against a local dev server.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:4330";
const OUT_DIR = "public/guide";
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 760 } });
// Astro's dev-only toolbar (a fixed-position pill, never shown in production)
// would otherwise show up in every capture -- hide it on every new document.
await page.addInitScript(() => {
  const style = document.createElement("style");
  style.textContent = "astro-dev-toolbar{display:none!important}";
  document.documentElement.appendChild(style);
});

async function shot(name, opts = {}) {
  await page.screenshot({ path: `${OUT_DIR}/${name}.png`, ...opts });
  console.log("saved", name);
}

async function clip(name) {
  // Belt-and-suspenders against the dev toolbar: the addInitScript CSS
  // (below) doesn't reliably win against its own shadow-DOM :host style on
  // every navigation, so also force-hide the live element directly right
  // before capturing.
  await page.evaluate(() => {
    document.querySelectorAll("astro-dev-toolbar").forEach((el) => el.style.setProperty("display", "none", "important"));
  });
  // <main> is flex-1 inside a min-h-screen column, so it always stretches to
  // full viewport height regardless of actual content -- screenshotting it
  // directly captures a lot of dead space below short tabs. The tab's own
  // root element sizes to its real content instead -- it's main's LAST
  // child, not the first: AppShell.tsx also renders an absolutely-positioned
  // "How to use" link as main's first child, hidden below the 1200px
  // breakpoint (this viewport is 1180px), so `main > *` alone grabbed that
  // instead once it was added.
  const el = await page.locator("main > *").last();
  await el.screenshot({ path: `${OUT_DIR}/${name}.png` });
  console.log("saved (clipped)", name);
}

// Fresh workspace with sample data loaded.
await page.goto(`${BASE}/app`);
await page.evaluate(() => window.localStorage.clear());
await page.goto(`${BASE}/app`);
await page.getByRole("button", { name: /load sample data/i }).click();
await page.waitForTimeout(400);

// 1. Overview
await page.goto(`${BASE}/app`);
await page.waitForTimeout(300);
await clip("01-overview");

// 2. Settings
await page.goto(`${BASE}/app/settings`);
await page.waitForTimeout(300);
await clip("02-settings");

// 3. Catalog
await page.goto(`${BASE}/app/catalog`);
await page.waitForTimeout(300);
await clip("03-catalog");

// 4. Templates
await page.goto(`${BASE}/app/templates`);
await page.waitForTimeout(300);
await clip("04-templates");

// 5-9. Estimate wizard steps -- start a fresh estimate via "New Estimate" if a
// current estimate already exists (sample data seeds one), else it's already
// on the wizard.
await page.goto(`${BASE}/app/estimates`);
await page.waitForTimeout(300);
const newEstimateBtn = page.getByRole("button", { name: /^new estimate$/i });
if (await newEstimateBtn.count()) {
  await newEstimateBtn.click();
  const confirmBtn = page.getByRole("button", { name: /start new estimate/i });
  if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click();
  await page.waitForTimeout(300);
}

// Project step
const nameInput = page.getByPlaceholder("Smith Driveway");
await nameInput.click();
await nameInput.press("Control+A");
await nameInput.pressSequentially("Miller Patio", { delay: 30 });
// The field's actual value is correct at this point -- confirmed via
// inputValue(). What's wrong is purely visual: with the cursor still at the
// end of the text, a narrow input scrolls to keep the caret visible,
// clipping the leftmost character out of the screenshot. Blurring resets
// the scroll to show the start of the text, and looks more like a real
// screenshot (no focus ring) besides.
await nameInput.press("Home");
await page.locator("body").click({ position: { x: 5, y: 5 } });
await page.waitForTimeout(300);
await clip("05-wizard-project");

// Dimensions step
await page.getByRole("button", { name: /^continue$/i }).first().click().catch(() => {});
await page.waitForTimeout(200);
await clip("06-wizard-dimensions");

// Costs step
await page.getByRole("button", { name: /^continue$/i }).first().click().catch(() => {});
await page.waitForTimeout(200);
await clip("07-wizard-costs");

// Price step
await page.getByRole("button", { name: /^continue$/i }).first().click().catch(() => {});
await page.waitForTimeout(200);
// Set a real selling price so the finished-estimate screenshot (step 9)
// doesn't show a misleading $0 total. Autosave is debounced, so give it a
// beat to actually persist before the next step navigates away.
await page.getByRole("button", { name: /use required price/i }).click().catch(() => {});
await page.waitForTimeout(1200);
await clip("08-wizard-price");

// 9. Finished current estimate -- Print/Export buttons
await page.goto(`${BASE}/app/estimates`);
await page.waitForTimeout(300);
await clip("09-estimate-summary");

// 10. Rate Health
await page.goto(`${BASE}/app/rate-health`);
await page.waitForTimeout(300);
await clip("10-rate-health");

// 11. Estimate vs Actual
await page.goto(`${BASE}/app/actuals`);
await page.waitForTimeout(300);
await clip("11-actuals");

await browser.close();
console.log("done");
