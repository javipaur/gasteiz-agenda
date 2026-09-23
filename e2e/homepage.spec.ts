import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("loads the homepage and shows the hero + navigation", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Agenda|Vitoria|Gasteiz|eventos/i);
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByLabel("Navegación principal")).toBeVisible();
  });

  test("shows event cards linking to event pages", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const eventLinks = page.locator("a[href^='/evento/']").first();
    await expect(eventLinks).toBeVisible({ timeout: 30_000 });
  });

  test("navigates to the conciertos page", async ({ page }) => {
    await page.goto("/");
    await page.locator('a[href="/conciertos"]').first().click();

    await page.waitForURL(/\/conciertos/i);
    await expect(page).toHaveURL(/\/conciertos/i);
  });

  test("shows the pro sports section linking to /deporte", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const heading = page.getByRole("heading", { name: /Nuestros equipos en acción/i });
    await expect(heading).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('a[href="/deporte"]').first()).toBeVisible();
  });
});

test.describe("Event detail", () => {
  test("opens an event and shows its title", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const firstEvent = page.locator("a[href^='/evento/']").first();
    await expect(firstEvent).toBeVisible({ timeout: 30_000 });
    await Promise.all([
      page.waitForURL(/\/evento\//, { timeout: 60_000 }),
      firstEvent.click(),
    ]);
    await expect(page).toHaveURL(/\/evento\//);
  });
});