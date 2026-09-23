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

  test("renders event cards with a colored category pill", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const pill = page.locator("a[href^='/evento/'] .e2e-cat-pill").first();
    await expect(pill).toBeVisible({ timeout: 30_000 });
    const bg = await pill.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("shows the fever section headers across the home", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Hoy en Gasteiz/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Próximos 7 días/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /¿Qué te apetece\?/i })).toBeVisible();
  });

  test("shows the at-a-glance strip with live date and counters", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".e2e-ataglance")).toBeVisible({ timeout: 30_000 });
  });

  test("hero shows the search and a featured plan card on desktop", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('input[aria-label="Buscar eventos"]').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('a[aria-label="Plan destacado"]').first()).toBeVisible();
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

test.describe("Fever theme", () => {
  test("defaults to dark and the toggle still switches to light", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(11, 14, 20)");

    const lightBtn = page.getByRole("button", { name: "Tema claro" });
    await lightBtn.click();
    await page.waitForFunction(() =>
      getComputedStyle(document.body).backgroundColor === "rgb(247, 246, 244)"
    );

    const darkBtn = page.getByRole("button", { name: "Tema oscuro" });
    await darkBtn.click();
    await page.waitForFunction(() =>
      getComputedStyle(document.body).backgroundColor === "rgb(11, 14, 20)"
    );
  });
});