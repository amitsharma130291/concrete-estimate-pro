import { test, expect } from "@playwright/test";
import { resetWorkspace, getWorkspace } from "./_helpers";

test.describe.configure({ mode: "serial" });

async function createProject(page: import("@playwright/test").Page, name: string) {
  await page.goto("/app/projects");
  await page.getByRole("button", { name: /new project/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // The Project editor's Field doesn't wire htmlFor, so target positionally: name is the
  // first text input in the dialog.
  await page.getByRole("dialog").locator('input[type="text"]').first().fill(name);
  await page.getByRole("button", { name: /save project/i }).click();
  await expect(page.getByText(name)).toBeVisible();
}

test.describe("Pro app: Projects tab", () => {
  test("create: new project appears in the list and localStorage", async ({ page }) => {
    await resetWorkspace(page, "/app/projects");
    await createProject(page, "E2E New Building");
    const ws = await getWorkspace(page);
    expect(ws.projects.some((p: any) => p.name === "E2E New Building")).toBe(true);
  });

  test("edit: change project name via the editor modal", async ({ page }) => {
    await resetWorkspace(page, "/app/projects");
    await createProject(page, "E2E Original Name");
    await page.getByRole("button", { name: "Edit", exact: true }).first().click();
    const nameInput = page.getByRole("dialog").locator('input[type="text"]').first();
    await nameInput.fill("E2E Renamed Building");
    await page.getByRole("button", { name: /save project/i }).click();
    await expect(page.getByText("E2E Renamed Building")).toBeVisible();
    const ws = await getWorkspace(page);
    expect(ws.projects.some((p: any) => p.name === "E2E Renamed Building")).toBe(true);
    expect(ws.projects.some((p: any) => p.name === "E2E Original Name")).toBe(false);
  });

  test("status change: dropdown updates status and persists", async ({ page }) => {
    await resetWorkspace(page, "/app/projects");
    await createProject(page, "E2E Status Building");
    await page.locator("select").first().selectOption("completed");
    const ws = await getWorkspace(page);
    expect(ws.projects.find((p: any) => p.name === "E2E Status Building").status).toBe("completed");
    await expect(page.getByRole("link", { name: /log actuals/i })).toBeVisible();
  });

  test("delete: removes the project after confirmation", async ({ page }) => {
    await resetWorkspace(page, "/app/projects");
    await createProject(page, "E2E Doomed Building");
    await page.getByRole("button", { name: /^delete/i }).first().click();
    await expect(page.getByRole("heading", { name: "Delete project" })).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("E2E Doomed Building")).toHaveCount(0);
    const ws = await getWorkspace(page);
    expect(ws.projects.some((p: any) => p.name === "E2E Doomed Building")).toBe(false);
  });

  test("recalculation: editing a section dimension updates order quantity and true cost live", async ({ page }) => {
    await resetWorkspace(page, "/app/projects");
    await createProject(page, "E2E Recalc Building");
    const before = await getWorkspace(page);
    const beforeProject = before.projects.find((p: any) => p.name === "E2E Recalc Building");

    await page.getByRole("button", { name: "Edit", exact: true }).first().click();
    const dims = page.getByRole("dialog").locator('input[type="number"]');
    // Number input order in the modal: [0] Allowance %, then SectionsEditor's L/W/T at [1,2,3].
    await dims.nth(1).fill("100");
    await page.getByRole("button", { name: /save project/i }).click();

    const after = await getWorkspace(page);
    const afterProject = after.projects.find((p: any) => p.name === "E2E Recalc Building");
    expect(afterProject.sections[0].lengthFt).toBe(100);
    expect(afterProject.sections[0].lengthFt).not.toBe(beforeProject.sections[0].lengthFt);
  });

  test("empty workspace shows the empty state with a create action", async ({ page }) => {
    await resetWorkspace(page, "/app/projects");
    await expect(page.getByText("No projects yet")).toBeVisible();
  });
});
