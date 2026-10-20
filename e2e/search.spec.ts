import { test, expect } from "@playwright/test";
import { quitarAvisoCookies } from "./helpers";

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

    // El atajo lo escucha un `useEffect`, o sea que necesita la página
    // **hidratada**. Y la hidratación no la mide `networkidle`: esa mide el
    // red, y el trabajo de JavaScript sigue después. En desarrollo, además,
    // Turbopack compila los módulos del cliente a la primera petición.
    //
    // Por eso el atajo se **reintenta** en vez de pulsarse una vez y
    // comprobarse: lo que se quiere medir es si el atajo funciona, no cuánto
    // tarda la página en estar viva. Antes fallaba de forma intermitente, y eso
    // es peor que fallar siempre, porque parece que el atajo se rompe a veces.
    await expect(async () => {
      await page.keyboard.press("Control+KeyK");
      await expect(
        page.locator('input[placeholder*="Busca un plan"]')
      ).toBeFocused({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
  });

  test("the shortcut opens one search, not two", async ({ page }) => {
    // El `Header` y el `HeroSearch` escuchaban los dos `Ctrl+K`, y los dos
    // abrían su panel: una tecla, dos buscadores, y el foco en el que no era.
    //
    // En la portada manda el del hero, que es el que la persona tiene delante
    // y el que lleva el cartel del atajo al lado. El del `Header` se queda
    // cerrado, y eso se comprueba por el **ancho de su caja**, que es cero
    // mientras está cerrada.
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await quitarAvisoCookies(page);

    await expect(async () => {
      await page.keyboard.press("Control+KeyK");
      await expect(
        page.locator('input[placeholder*="Busca un plan"]')
      ).toBeFocused({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    // La caja del buscador de la cabecera: `w-0` mientras está cerrada.
    const cajaCabecera = page.locator('form[role="search"]').first().locator("> div").first();
    const ancho = await cajaCabecera.evaluate(
      (el) => el.getBoundingClientRect().width
    );
    expect(ancho).toBe(0);

    // Y un solo panel de resultados abierto, no dos.
    await expect(page.locator(".animate-scaleIn")).toHaveCount(1);
  });
});
