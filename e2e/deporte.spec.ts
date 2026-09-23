import { test, expect } from "@playwright/test";

test("deporte page shows the pro teams block", async ({ page }) => {
  await page.goto("/deporte");
  await page.waitForLoadState("networkidle");

  const heading = page.getByRole("heading", { name: /Partidos de los nuestros/i });
  await expect(heading).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Baskonia/i).first()).toBeVisible();
  await expect(page.getByText(/Alavés/i).first()).toBeVisible();
});