/**
 * Lo que todo script suelto de este repositorio necesita antes de tocar `lib/agenda.ts`.
 *
 * **Las tres cosas de aquí estaban en `scripts/enviar-promo.ts` y se han copiado a cada
 * script nuevo**, que es exactamente cómo se cuela el mismo fallo dos veces. Lo que se
 * repite se escribe una vez: el apaño de `AsyncLocalStorage`, el `.env` y la comprobación
 * de que la ventana de publicación toca.
 */

/**
 * `AsyncLocalStorage` no es global en Node 24 y `lib/agenda.ts` →
 * `lib/axiom/server.ts` → `@axiomhq/nextjs` lo lee de `globalThis` al importarse.
 * Dentro de Next ya está resuelto; en un script suelto con `tsx` no, y el fallo es un
 * `TypeError: globalThis.AsyncLocalStorage is not a constructor` que no dice qué lo ha
 * provocado.
 *
 * **La comprobación mira que sea un constructor, y no solo que exista.** El
 * `typeof ... === "undefined"` de la primera versión daba por bueno un valor presente pero
 * no construible, así que el apaño se saltaba y el fallo reventaba más tarde, en
 * `getAgendaSalud()`, con un error que señalaba a `AsyncLocalStorage` y a nada de lo que
 * el mensaje hablaba: la puerta de salud y `rula`.
 *
 * **Antes de cualquier import de `lib/`.** Un import dinámico dentro de una función se
 * resuelve cuando se llega a él, y el `globalThis` tiene que estar puesto antes: por eso
 * esto va al principio de `main` y no en el momento de usarlo.
 */
export async function prepararEntornoScript(): Promise<void> {
  const actual = (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage;
  if (typeof actual !== "function") {
    const { AsyncLocalStorage } = await import("node:async_hooks");
    (globalThis as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage =
      AsyncLocalStorage;
  }

  /*
   * **El `.env` se carga aquí y no lo carga Next, porque esto no es Next.**
   *
   * Dentro de Next, `loadEnvConfig` la pone en el proceso al arrancar y todo lo que se
   * importa después la ve. Un script suelto con `tsx` no pasa por ahí: lee
   * `process.env.MEC_TOKEN` y encuentra `undefined`, aunque la variable esté exportada.
   * Medido: sin esto, `npm run promo:send` se paraba en la puerta de salud con 36/37 y
   * `rula` en la lista de caídas.
   *
   * **Se leen los dos ficheros y en el orden de Next**, que carga `.env.local` por
   * delante de `.env`. Y `override: false` en los dos, para que una variable ya
   * presente en el entorno real gane sobre el fichero: es lo que necesita el contenedor
   * de Dokploy, donde sus variables mandan sobre lo que haya en la imagen.
   */
  const { config } = await import("dotenv");
  config({ path: ".env.local", override: false, quiet: true });
  config({ path: ".env", override: false, quiet: true });
}