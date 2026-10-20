import type { Page } from "@playwright/test";

/**
 * Quita el aviso de cookies, si está.
 *
 * El aviso es un `dialog` fijo en la parte de abajo, con el botón "Aceptar", y
 * **cubre el pie de página**: el selector de tema vive en el pie, así que
 * cualquier test que pulse ahí se encuentra con el botón del aviso encima y
 * el clic no llega.
 *
 * No es un bug de la app: el aviso se cierra con un clic y a partir de ahí el
 * pie queda libre. Es una condición del entorno de prueba, y por eso vive
 * aquí y no repetido en cada spec.
 *
 * De paso, **esperar al aviso es esperar a la hidratación**, y no por casualidad:
 * el componente arranca con `visible = false` y solo lo pone en true dentro de
 * un `useEffect`, así que no aparece en el HTML del servidor. Verlo es ver que
 * React ya ha corrido. Y en desarrollo, que es donde corren estos tests,
 * Turbopack compila los módulos del cliente a la primera petición: `networkidle`
 * mide el red y no ese trabajo, y por eso sola no basta.
 */
export async function quitarAvisoCookies(page: Page): Promise<void> {
  const aceptar = page.getByRole("button", { name: "Aceptar" });
  const visible = await aceptar
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!visible) return;

  await aceptar.click();
  // Y que el aviso se vaya de verdad, que si no el clic siguiente vuelve a
  // encontrárselo delante.
  await aceptar.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
}
