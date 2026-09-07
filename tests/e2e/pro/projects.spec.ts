// The "Projects" tab (a separate saved-project list, distinct from Estimates) was removed
// under the single-current-estimate product decision -- a completed job is now just the
// current Estimate with status "completed" plus one logged actual result, not a second
// persisted record or list. This file previously drove the old Projects CRUD UI; it's
// replaced with a single test confirming the route redirects cleanly instead of 404ing or
// showing a dead/broken page, per the requirement to leave no dead routes or broken links.
import { test, expect } from "@playwright/test";

test.describe("Pro app: /app/projects (removed)", () => {
  test("redirects to the canonical Current Estimate route instead of 404ing", async ({ page }) => {
    const response = await page.goto("/app/projects");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/app\/estimates$/);
    // A fresh visit auto-seeds a blank draft and lands directly in the wizard (see
    // EstimatesTab.tsx), so the page shown here can be either the wizard's first step or the
    // Current Estimate summary view depending on prior state -- check for either heading
    // rather than assuming one, and don't assume desktop nav visibility (it's a collapsed
    // drawer below the 1200px breakpoint on mobile).
    await expect(page.getByRole("heading", { name: /current estimate|project/i }).first()).toBeVisible();
  });
});
