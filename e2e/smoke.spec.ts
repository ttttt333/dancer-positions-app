import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#choreogrid-locale-select")).toBeVisible();
    // Guest landing: ログイン／新規登録（/editor/new 直リンクは未ログイン時は出さない）
    await expect(
      page.getByRole("banner").getByRole("link", { name: /ログイン|Log in|Iniciar/i })
    ).toBeVisible();
    await expect(page.locator('a[href="/register"]').first()).toBeVisible();
  });

  test("new editor session opens", async ({ page }) => {
    await page.goto("/editor/new");
    const nameDialog = page.getByRole("dialog", {
      name: /作品名をつけて始めましょう|Name this work/i,
    });
    await expect(nameDialog).toBeVisible({ timeout: 15_000 });
    await nameDialog.getByRole("textbox", { name: /作品名|Project name/i }).fill(
      "E2E Smoke"
    );
    await nameDialog
      .getByRole("button", { name: /編集を始める|Start editing/i })
      .click();
    await expect(nameDialog).toBeHidden({ timeout: 15_000 });
    await expect(
      page
        .locator(
          ".editor-timeline-mobile-dock, .wave-compact-time-above-wave"
        )
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Spanish locale updates home UI", async ({ page }) => {
    await page.goto("/");
    await page.selectOption("#choreogrid-locale-select", "es");
    // Guest landing のヘッダーログイン（Nuevo proyecto はログイン後ライブラリ用）
    await expect(
      page.getByRole("banner").getByRole("link", { name: /Iniciar sesión/i })
    ).toBeVisible();
    await expect(page.locator("#choreogrid-locale-select")).toHaveValue("es");
  });
});
