import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#choreogrid-locale-select")).toBeVisible();
    await expect(page.getByRole("link", { name: /新規|New project|Start new/i })).toBeVisible();
  });

  test("new editor session opens", async ({ page }) => {
    await page.goto("/editor/new");
    await expect(page.locator(".editor-timeline-mobile-dock, .wave-compact-time-above-wave").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Spanish locale updates home UI", async ({ page }) => {
    await page.goto("/");
    await page.selectOption("#choreogrid-locale-select", "es");
    await expect(page.getByRole("link", { name: /Nuevo proyecto/i })).toBeVisible();
    await expect(page.locator("#choreogrid-locale-select")).toHaveValue("es");
  });
});
