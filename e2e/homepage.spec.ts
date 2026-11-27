import { test, expect } from "@playwright/test";
import { quitarAvisoCookies } from "./helpers";

test.describe("Homepage", () => {
  /**
   * Solo este fichero, y no la config global: la portada en desarrollo pide
   * imágenes a fuentes externas y una de ellas puede tardar más de 30 s en
   * responder, así que `page.goto("/", { waitUntil: "load" })` agotaba el tiempo
   * antes de empezar la aserción. Medido el 24 de noviembre de 2026: cuatro
   * casos fallaron por `page.goto` y los cuatro pasaron al reintentar con el
   * servidor caliente. El resto de la suite conserva el techo de 30 s.
   */
  test.describe.configure({ timeout: 60_000 });
  test.use({ navigationTimeout: 60_000 });

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

  test("navigates to the conciertos page from Explorar", async ({ page }) => {
    await page.goto("/");
    // Los accesos rápidos que había al lado de «Explorar» se quitaron: ya
    // estaban dentro del panel. La navegación se comprueba por su puerta real.
    await page.getByRole("button", { name: /Explorar/i }).click();
    await page.locator('#explorar-panel a[href="/conciertos"]').click();

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

  test("shows the three central blocks in order: day, picks, week", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // La home ya no se ordena por fuentes sino por preguntas: cuándo, qué
    // merece la pena y todo lo que queda. «¿Qué te apetece?» desapareció con
    // `MoodFilter`, que era otra rejilla con los mismos datos.
    await expect(page.getByRole("heading", { name: /Hoy en Vitoria/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Qué recomendamos/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Próximos 7 días/i })).toBeVisible();

    const hoy = await page.getByRole("heading", { name: /Hoy en Vitoria/i }).boundingBox();
    const recomendados = await page.getByRole("heading", { name: /Qué recomendamos/i }).boundingBox();
    const semana = await page.getByRole("heading", { name: /Próximos 7 días/i }).boundingBox();
    expect(hoy!.y).toBeLessThan(recomendados!.y);
    expect(recomendados!.y).toBeLessThan(semana!.y);
  });

  test("hero shows the search and live counters, not a featured card", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('input[aria-label="Buscar eventos"]').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/planes hoy/i).first()).toBeVisible();
    await expect(page.getByText(/esta semana/i).first()).toBeVisible();
  });

  test("Explorar covers the main categories", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /Explorar/i }).click();
    // El panel no ofrece un `/culture` genérico: abre directamente en las vistas
    // que existen —`/culture/agenda`, `/culture/teatro`, `/culture/exposiciones`—.
    // Escribir `/culture` aquí era un test que seguía la home anterior, no un fallo.
    for (const href of [
      "/conciertos",
      "/movies",
      "/kids",
      "/culture/agenda",
      "/deporte",
      "/turismo",
      "/gastronomia",
    ]) {
      await expect(page.locator(`#explorar-panel a[href="${href}"]`).first()).toBeVisible({ timeout: 30_000 });
    }
  });

  test("shows carousels, recommendations and future events headers", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // El riel ya no es el "Top 10": son los recomendados de hoy, con el mismo
    // criterio que `/hoy` y el post. El rótulo cambió a propósito.
    await expect(page.getByRole("heading", { name: /Qué recomendamos/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Más adelante/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Conciertos/i }).first()).toBeVisible();
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