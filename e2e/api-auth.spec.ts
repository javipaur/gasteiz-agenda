import { test, expect } from "@playwright/test";

/**
 * Que el middleware llegue de verdad a ejecutarse.
 *
 * Las pruebas unitarias de `middleware.test.ts` lo llaman a mano, así que la
 * política se puede comprobar entera sin que el middleware esté registrado en
 * absoluto. Este fichero es la otra mitad: habla con un servidor de verdad, y por
 * eso es el único sitio donde se nota si `config.matcher` dejó de cubrir algo,
 * o si el middleware desapareció —que es lo que va a pasar cuando Next 16 cumpla
 * el aviso de migrar `middleware` a `proxy` y nadie toque esta línea.
 *
 * **Ninguna lleva `test.skip(!API_KEY)`.** Las de `api.spec.ts` se saltan enteras
 * cuando el proceso de Playwright no ve la clave, que es la mayoría de las
 * ejecuciones. Estas no la necesitan: la propiedad que comprueban es que la
 * ruta **no** se abre, y no se abre precisamente por no mandarle la clave. El
 * camino autenticado ya lo cubre `api.spec.ts`.
 */
test.describe("la política de /api, contra un servidor de verdad", () => {
  test("una ruta protegida sin clave no devuelve los datos", async ({ request }) => {
    // Sin cabecera `x-api-key` y sin `?api_key=`.
    const res = await request.get("/api/v1/events?limit=1", { timeout: 60_000 });

    // 401 con la clave configurada en el servidor, que es lo normal porque
    // `npm run dev` carga `.env`. 503 si no la tiene, que es el fail-closed de
    // la fase 2 y también significa «cerrada». Lo que no puede salir es un 200
    // con la agenda dentro, así que la aserción va sobre la forma de la
    // respuesta y no sobre un número suelto.
    expect([401, 503]).toContain(res.status());

    const cuerpo = await res.json();
    expect(cuerpo.data).toBeUndefined();
    expect(typeof cuerpo.error).toBe("string");
  });

  test("una ruta protegida corta en el borde, no dentro del handler", async ({ request }) => {
    // Si el middleware dejara de registrarse, la petición de arriba seguiría
    // dando error —por el 404 o el 500 que devolviera el handler—, pero después
    // de haber scrapeado veintiocho fuentes. Midiendo se distingue un sitio del
    // otro, y además aguanta el día que alguien mueva la comprobación de la
    // clave a las rutas.
    //
    // Se calienta antes de medir porque en `next dev` la primera petición
    // compila el middleware, y eso no es lo que se quiere cronometrar.
    await request.get("/api/v1/events?limit=1", { timeout: 60_000 });

    const inicio = Date.now();
    const res = await request.get("/api/v1/events?limit=1", { timeout: 60_000 });
    const ms = Date.now() - inicio;

    expect([401, 503]).toContain(res.status());
    // Un scrape de la agenda no baja de decenas de segundos. El margen es
    // ancho a propósito: esto compara órdenes de magnitud, no mide un SLA.
    expect(ms).toBeLessThan(20_000);
  });

  test("una ruta pública contesta sin clave, porque la web no puede mandar ninguna", async ({ request }) => {
    // El buscador del navegador pide esto sin cabeceras: si exigiera `API_KEY`,
    // `Header.tsx` y `HeroSearch.tsx` dejarían de encontrar nada. Y sin
    // `API_KEY` en el entorno tampoco, porque el componente cliente no puede
    // obtenerla.
    const res = await request.get("/api/search?q=teatro", { timeout: 60_000 });

    expect(res.status()).toBe(200);
    const cuerpo = await res.json();
    expect(Array.isArray(cuerpo.results)).toBe(true);
  });
});
