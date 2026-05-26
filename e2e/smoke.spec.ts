import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("library page loads", async ({ page }) => {
    await page.goto("/library");
    await expect(page.locator("#choreogrid-locale-select")).toBeVisible();
    await expect(page.getByRole("link", { name: /新規|Start new|editor/i })).toBeVisible();
  });

  test("new editor session opens", async ({ page }) => {
    await page.goto("/editor/new");
    await expect(page.locator(".editor-timeline-mobile-dock, .wave-compact-time-above-wave").first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
