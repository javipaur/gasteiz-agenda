import { test, expect } from "@playwright/test";

/**
 * El 404 de verdad, medido por el status HTTP.
 *
 * Ningún test unitario puede cubrir esto. Un `notFound()` es una llamada: se
 * puede espiar, se puede comprobar que se invoca, y con eso el test sale verde
 * aunque la respuesta sea un **200 con `<meta name="robots" content="noindex">`**.
 * Eso es exactamente lo que pasaba: `app/loading.tsx` ponía una frontera de
 * Suspense en la raíz, Next comprometía el `200` con el esqueleto antes de que
 * la página llegara a llamar a `notFound()`, y la página inexistente se servía
 * como «existe, pero no la indexes».
 *
 * Lo único que distingue un 404 real de un soft-404 es el **código de estado de
 * una respuesta de verdad**, así que este fichero habla con un servidor de
 * verdad. Si alguien vuelve a poner un `loading.tsx` por encima de estas rutas,
 * aquí sale rojo —y el test de `estados-carga.test.tsx` también, por el otro
 * lado.
 */

/**
 * Slugs inventados que **no** pueden existir.
 *
 * No se usa un slug real «borrado» a propósito: la agenda se recalcula desde las
 * fuentes, así que un slug que hoy no existe puede existir mañana, y el test se
 * volvería intermitente. Lo que se mide es la ruta, no un evento concreto.
 */
const SLUG_INEXISTENTE = "plan-que-no-existe-2026-01-01-zzzzzz";
const MES_INEXISTENTE = "mes-que-no-existe";
const CATEGORIA_INEXISTENTE = "categoria-que-no-existe";

test.describe("las rutas que llaman a notFound() devuelven un 404 de verdad", () => {
  test("un evento que no existe responde 404, no un 200 con noindex", async ({ request }) => {
    const res = await request.get(`/evento/${SLUG_INEXISTENTE}`, { timeout: 60_000 });

    // Un 200 aquí es el fallo que este fichero existe para cazar: la página
    // vacía se sirve como si existiera y Next le mete un `noindex`.
    expect(res.status()).toBe(404);
  });

  test("un mes que no existe responde 404", async ({ request }) => {
    const res = await request.get(`/agenda/${MES_INEXISTENTE}`, { timeout: 60_000 });

    expect(res.status()).toBe(404);
  });

  test("una categoría que no existe responde 404", async ({ request }) => {
    const res = await request.get(`/culture/${CATEGORIA_INEXISTENTE}`, { timeout: 60_000 });

    expect(res.status()).toBe(404);
  });
});

test.describe("el 404 no se ha comido las rutas que sí existen", () => {
  /**
   * La mitad que impide «arreglar» el soft-404 devolviendo 404 a todo.
   *
   * `dynamicParams = false` en `/culture/[categoria]` hace que solo las
   * categorías de `generateStaticParams` existan. Si esa lista se vaciara, el
   * 404 de arriba seguiría verde y la sección entera desaparecería.
   */
  test("una categoría real sigue respondiendo 200", async ({ request }) => {
    const res = await request.get("/culture/teatro", { timeout: 60_000 });

    expect(res.status()).toBe(200);
  });

  test("un evento real sigue respondiendo 200", async ({ request }) => {
    // Se pide un slug de verdad al agregado en vez de escribir uno a mano: un
    // slug escrito a mano se pudre en cuanto la fuente cambia de título o de
    // enlace, y el test empezaría a medir el 404 en vez del 200.
    const lista = await request.get("/api/v1/events?limit=1", { timeout: 60_000 });
    expect(lista.status()).toBe(200);
    const cuerpo = await lista.json();
    const slug: string | undefined = cuerpo.data?.[0]?.slug;
    expect(slug).toBeTruthy();

    const res = await request.get(`/evento/${slug}`, { timeout: 60_000 });
    expect(res.status()).toBe(200);
  });
});
