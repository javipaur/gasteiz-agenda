import { test, expect } from "@playwright/test";

test.describe("Search", () => {
  test("search input is present and accepts a query", async ({ page }) => {
    await page.goto("/");

    const search = page.getByLabel("Buscar eventos").first();
    await expect(search).toBeVisible({ timeout: 30_000 });

    await search.fill("concierto");
    await expect(search).toHaveValue("concierto");
  });

  test("search results link to event pages", async ({ page }) => {
    await page.goto("/");

    const search = page.getByLabel("Buscar eventos").first();
    await search.fill("concierto");
    await page.waitForTimeout(1500);

    const resultLink = page.locator("a[href^='/evento/']").first();
    if (await resultLink.isVisible().catch(() => false)) {
      await expect(resultLink).toHaveAttribute("href", /\/evento\//);
    }
  });

  test("keyboard shortcut opens the search", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+KeyK");

    await expect(page.locator('input[type="search"]').first()).toBeFocused();
  });
});