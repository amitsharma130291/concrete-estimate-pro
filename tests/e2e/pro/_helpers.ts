import type { Page } from "@playwright/test";

export async function resetWorkspace(page: import("@playwright/test").Page, route = "/app") {
  await page.goto(route);
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(route);
}

export async function getWorkspace(page: Page): Promise<any> {
  const raw = await page.evaluate(() => window.localStorage.getItem("cep:workspace:v1"));
  return raw ? JSON.parse(raw) : null;
}

export async function seedWorkspace(page: Page, partial: Record<string, unknown>, route = "/app") {
  await page.goto(route);
  await page.evaluate((data) => {
    const empty = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      businessProfile: { businessName: "", phone: "", email: "", address: "" },
      settings: {
        defaultOverheadPercent: 15,
        defaultTargetMarginPercent: 30,
        defaultLoadedLaborRate: 36,
        defaultAllowancePercent: 8,
        defaultRounding: "quarter",
        estimateValidityDays: 30,
        defaultNotes: "",
        units: "imperial",
        currency: "USD",
      },
      catalog: [],
      laborRates: [],
      equipment: [],
      templates: [],
      projects: [],
      estimates: [],
      actuals: [],
    };
    window.localStorage.setItem("cep:workspace:v1", JSON.stringify({ ...empty, ...data }));
  }, partial);
  await page.goto(route);
}
