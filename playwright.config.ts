import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "reports/e2e/results.json" }]],
  use: {
    baseURL: "http://localhost:4319",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4319",
    url: "http://localhost:4319",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
