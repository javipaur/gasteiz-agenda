import { test, expect } from "@playwright/test";
import { quitarAvisoCookies } from "./helpers";

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

  test("partidos section uses the sports lime tag", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const tag = page
      .locator('[aria-label="Partidos de los equipos de Vitoria"]')
      .getByText("Deporte", { exact: true })
      .first();
    await expect(tag).toBeVisible({ timeout: 30_000 });
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
    // "Hoy en Gasteiz" ya no está: el teaser que repetía los mismos 35 eventos
    // que la rejilla de "Próximos 7 días" se quitó, porque una home que enseña
    // dos veces lo mismo no explica nada. Las dos cabeceras que quedan son las
    // que se comprueban.
    await expect(page.getByRole("heading", { name: /Próximos 7 días/i })).toBeVisible({ timeout: 30_000 });
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
    // El destacado ya no es una etiqueta con nombre: es la primera tarjeta del
    // hero, que enlaza a su evento. Se comprueba el enlace y no un
    // `aria-label` que hace meses que no existe.
    const destacado = page.locator('section a[href^="/evento/"]').first();
    await expect(destacado).toBeVisible();
  });

  test("hub links cover the main categories", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    for (const href of ["/conciertos", "/movies", "/kids", "/culture", "/deporte", "/turismo", "/gastronomia"]) {
      await expect(page.locator(`[data-testid="e2e-hub"] a[href="${href}"]`).first()).toBeVisible({ timeout: 30_000 });
    }
  });

  test("shows carousels, top10 and events headers", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // El riel ya no es el "Top 10": son los recomendados de hoy. El rótulo
    // cambió a propósito, con el motivo escrito en `TopEventsSection.tsx`, y
    // decir "Top 10" sobre una lista de un solo día es mentira en la primera
    // pantalla, que es donde más se lee.
    await expect(page.getByRole("heading", { name: /Lo que recomendamos para hoy/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Más adelante/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Conciertos/i }).first()).toBeVisible();
  });

  test("shows Gasteiz Click en cifras with the sports metric", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Gasteiz Click en cifras/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/3 clubes · 2 deportes · 1 ciudad/i)).toBeVisible();
  });

  test("newsletter panel is visible with subscribe form", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/No te pierdas/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Suscribir" })).toBeVisible();
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
  test("defaults to light and the toggle switches to dark and back", async ({ page }) => {
    // El tema por defecto del sitio es el **claro**, no el del sistema: se
    // decidió así al rehacer la paleta, porque la referencia visual no tiene
    // modo oscuro. El test decía lo contrario y con la paleta anterior, así que
    // llevaba meses fallando sin que nadie lo mirase.
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await quitarAvisoCookies(page);

    // Claro: `#F6F3E8`, el `--bg` del tema claro.
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(246, 243, 232)");

    const darkBtn = page.getByRole("button", { name: "Tema oscuro" });
    await darkBtn.click();
    await page.waitForFunction(() =>
      getComputedStyle(document.body).backgroundColor === "rgb(22, 22, 15)"
    );

    const lightBtn = page.getByRole("button", { name: "Tema claro" });
    await lightBtn.click();
    await page.waitForFunction(() =>
      getComputedStyle(document.body).backgroundColor === "rgb(246, 243, 232)"
    );
  });

  test("the system theme follows the operating system", async ({ page }) => {
    // El tercer botón del selector. Antes no hacía nada: la elección no se
    // guardaba, así que al recargar la página volvía al tema por defecto.
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await quitarAvisoCookies(page);

    await page.getByRole("button", { name: "Tema del sistema" }).click();

    // Con el sistema en oscuro, "Tema del sistema" tiene que ser oscuro.
    await page.waitForFunction(() =>
      getComputedStyle(document.body).backgroundColor === "rgb(22, 22, 15)"
    );

    // Y tiene que seguir siéndolo al recargar, que es donde se perdía.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() =>
      getComputedStyle(document.body).backgroundColor === "rgb(22, 22, 15)"
    );
  });
});