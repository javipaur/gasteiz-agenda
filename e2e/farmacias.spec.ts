import { test, expect } from "@playwright/test";

/**
 * La página de farmacias de guardia.
 *
 * Lo que se comprueba es que **el cuadrante se enseña**: el título, el
 * recuento de guardias de hoy y el turno de cada una.
 *
 * Antes esta página servía el *directorio* de opendata.euskadi.eus —78
 * farmacias con dirección y teléfono, sin turno— y lo decía: "No es el
 * cuadrante de guardia". Ahora sirve el cuadrante del Colegio de Farmacéuticos
 * de Álava, que sí trae horario y turno.
 */
test.describe("Farmacias de guardia", () => {
  test("muestra el cuadrante de hoy, con su turno", async ({ page }) => {
    await page.goto("/farmacias");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: /Farmacias abiertas hoy/i })
    ).toBeVisible({ timeout: 30_000 });

    // El recuento: "N farmacia de guardia".
    await expect(
      page.getByRole("heading", { name: /farmacias? de guardia/i })
    ).toBeVisible({ timeout: 30_000 });

    // Y el turno, que es lo que no existía con el directorio.
    await expect(page.getByText(/Turno de (d[ií]a|noche)/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // El teléfono es lo que se usa desde el móvil, así que tiene que estar.
    await expect(page.locator('a[href^="tel:"]').first()).toBeVisible();
  });

  test("el contador y la lista hablan del mismo día", async ({ page }) => {
    // El cartel de "Actualizado" solo aparece si la fecha del cuadrante es la
    // de hoy. Con el directorio de antes, `date` salía vacía siempre y el
    // cartel no aparecía nunca.
    await page.goto("/farmacias");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Actualizado").first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
