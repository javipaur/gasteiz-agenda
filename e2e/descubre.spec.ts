import { test, expect } from "@playwright/test";

test.describe("Turismo & Gastronomía", () => {
  test("home enlaza a turismo y gastronomía", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href="/turismo"]').first()).toBeVisible();
    await expect(page.locator('a[href="/gastronomia"]').first()).toBeVisible();
  });

  test("página de turismo carga con secciones", async ({ page }) => {
    await page.goto("/turismo");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("tablist", { name: /turismo/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /catedral/i }).first()).toBeVisible();
  });

  test("página de gastronomía carga con rutas de pintxos", async ({ page }) => {
    await page.goto("/gastronomia");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const tab = page.getByRole("tab", { name: /rutas de pintxos/i });
    // `goto` espera al `load`, no a la hidratación: en desarrollo el primer clic
    // puede caer sobre el HTML del servidor, antes de que React enganche el
    // manejador, y no hacer nada. Reintentar hasta que `aria-selected` cambia
    // mide la interacción, no la velocidad de compilación del dev server.
    await expect
      .poll(async () => {
        await tab.click();
        return await tab.getAttribute("aria-selected");
      }, { timeout: 15_000 })
      .toBe("true");
    await expect(page.getByRole("heading", { name: /casco viejo/i }).first()).toBeVisible();
  });
});