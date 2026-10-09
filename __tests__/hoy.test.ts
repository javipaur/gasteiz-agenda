import React from "react";
import { mockSoloMunicipal, ymdEnDias } from "./helpers";
import { MAX_DIAPOSITIVAS } from "@/lib/promo";

/**
 * **Los dos scrapers que no pasan por `fetch` están mockeados, y no es opcional.**
 * `lib/sources/buscametas.ts` es el único fichero del repo que usa `axios` en vez de
 * `fetch`, y `mockFetchWith` solo intercepta `global.fetch`: sin este `jest.mock` el
 * scraper se sale a `www.buscametas.com` de verdad. Se nota en el número de eventos,
 * que pasa de los 111 del fixture municipal a 1.504 eventos reales con fechas
 * repartidas en semanas, y en que un test que promete "hoy no tiene nada" encuentra
 * ocho tarjetas. Es la misma razón por la que `__tests__/eventos.test.ts` los mockea,
 * y el motivo de fondo es la regla del repo: **los tests no usan red**.
 */
jest.mock("@/lib/sources/buscametas", () => ({
  scrapeBuscametasCalendario: jest.fn().mockResolvedValue([]),
  scrapeBuscametasInscripciones: jest.fn().mockResolvedValue([]),
}));

/**
 * **Y la caché también, porque escribe en disco y sobrevive al proceso.**
 * `getCachedOrFetch` guarda el resultado en `tmpdir/gasteiz-cache`, así que
 * `jest.resetModules()` —que solo limpia el registro de módulos— no la invalida: la
 * clave `agenda-all-v2` de una ejecución anterior sigue ahí y este test lee la agenda
 * que grabó la anterior. Es lo mismo que hace el `mockFetchWith` de una prueba de
 * `Task 4` del plan de cobertura al medir arranques en frío, y por eso allí hubo que
 * borrar el directorio a mano.
 *
 * El mock deja pasar al `fetcher` sin guardar, que es lo que un test quiere: el
 * agregado se construye con el `fetch` de este caso y solo con el de este caso.
 */
jest.mock("@/lib/cache", () => ({
  getCachedOrFetch: jest.fn(
    async (_key: string, _ttlMs: number, fetcher: () => Promise<unknown>) => fetcher()
  ),
}));

/**
 * La página se llama como una función, sin React.
 *
 * Un server component de App Router es una función async que recibe props, así que
 * se puede llamar directamente: `{ searchParams }` es lo único que necesita y aquí no
 * hay ni cookies ni cabeceras. Es lo que hace `__tests__/api/actividades-agenda.test.ts`
 * con su route handler, con la diferencia de que aquí no hay `Response` que leer sino
 * un árbol de React, y lo que se comprueba es el texto que sale.
 *
 * **Sin JSX.** `EventCard` es `"use client"` y arrastra `next/image` y `next/link`,
 * que no están cableados fuera del bundler; el árbol se pinta a texto con
 * `renderToStaticMarkup`, que es lo que lee una persona.
 */

/**
 * Todos los eventos del fixture caen en el **mismo** día, dos días por delante de hoy.
 * Así "hoy" no tiene nada y el día que se pregunta sí, que es lo que hace que el caso
 * de `?fecha=` demuestre que la página pinta el día pedido en vez del día actual.
 */
const FECHA = ymdEnDias(2);
const AYER = ymdEnDias(-1);

async function renderizar(params: Record<string, string> = {}) {
  jest.resetModules();
  mockSoloMunicipal(FECHA);
  const mod = await import("@/app/hoy/page");
  return mod.default({
    searchParams: Promise.resolve(params),
    params: Promise.resolve({}),
  });
}

/**
 * El texto plano del árbol, que es lo que lee una persona.
 *
 * **El `FavoritesProvider` va aquí y no dentro de la página porque no es suyo.**
 * `EventCard` pinta un `FavoriteButton`, que llama a `useFavorites()` y **lanza** si
 * no encuentra el contexto. En la web no hay problema: `app/layout.tsx` envuelve todo
 * en `FavoritesProvider`. Llamando a la página suelta —que es lo que hace este test—
 * el provider no está, así que hay que ponerlo a mano para estar en las mismas
 * condiciones que el navegador. No es andamiaje del test: es lo que el layout hace en
 * producción.
 */
async function texto(nodo: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { FavoritesProvider } = await import("@/app/context/FavoritesContext");
  return renderToStaticMarkup(
    React.createElement(FavoritesProvider, null, nodo as React.ReactElement)
  );
}

/**
 * Los títulos que salen pintados, que es lo que se puede comprobar de una tarjeta.
 *
 * Del `<h3>` y no del `alt`, que viene vacío a propósito: la imagen y el título viven
 * en el mismo enlace y con el `alt` puesto el lector oye el título dos veces. Un test
 * que leyera el `alt` se pondría rojo el día que alguien arreglara la accesibilidad.
 */
function titulos(html: string): string[] {
  return [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1]);
}

describe("/hoy", () => {
  it("pinta los recomendados del día que se le pide, no los de hoy", async () => {
    // La razón de que `?fecha=` exista: el paquete de redes necesita la página de un
    // día distinto al de hoy, y sin esto la URL del pie de foto llevaría a una página
    // que no es la que anuncia. Aquí el fixture está en `FECHA`, que es dos días por
    // delante, así que si la página ignorara el parámetro y pintara "hoy" saldría el
    // estado vacío —y eso es lo que se mira abajo.
    const html = await texto(await renderizar({ fecha: FECHA }));

    expect(html).toContain("Recomendados");
    expect(html).not.toMatch(/No hay nada/);
    expect(titulos(html).length).toBeGreaterThan(0);
  });

  it("sin parámetros es el día de hoy, y hoy no tiene nada del fixture", async () => {
    // El otro lado del anterior, y es el que le da sentido a `?fecha=`: si el
    // parámetro no está, la ventana es hoy. Con el fixture puesto en `FECHA` el estado
    // vacío es la respuesta correcta, y por eso este caso fija que la página **no**
    // inventa una lista para tapar el hueco.
    const html = await texto(await renderizar({}));

    expect(html).toMatch(/No hay nada recomendado/);
    expect(titulos(html)).toHaveLength(0);
  });

  it("acepta `?desde=` y `?hasta=` para la ventana larga de semana o finde", async () => {
    const html = await texto(await renderizar({ desde: AYER, hasta: FECHA }));

    expect(html).toContain("Recomendados");
    expect(titulos(html).length).toBeGreaterThan(0);

    // Y el rango se ve escrito, que es lo que hace que el post del finde no parezca el
    // de un solo día.
    //
    // **Este test miraba que saliera el ISO** —`expect(html).toContain(AYER)`— y se
    // puso rojo al arreglar la cabecera de la página. No era un test roto: estaba
    // defendiendo el defecto. Ahora mira los dos extremos nombrados en castellano, que
    // es lo que distingue el finde de un día suelto.
    const parrafo = html.match(/<p class="mt-1[^"]*">([^<]*)<\/p>/)?.[1] ?? "";

    expect(parrafo).toContain(" — ");
    const dias = parrafo.match(/lunes|martes|miércoles|jueves|viernes|sábado|domingo/gi) ?? [];
    expect(dias).toHaveLength(2);
  });

  it("un día sin nada lo dice, en vez de pintar una página vacía sin explicación", async () => {
    const html = await texto(await renderizar({ fecha: "1990-01-01" }));

    expect(html).toMatch(/no hay nada recomendado para esa fecha/i);
  });

  it("pinta tantos como el post enseña, ni uno menos", async () => {
    // **Este es el bug que cierra la promesa del paquete.** El post de Instagram
    // lleva hasta `MAX_DIAPOSITIVAS` diapositivas y esta página lleva
    // `LIMITE_POR_DEFECTO`, que son 8. Con 9 planes en el finde, el noveno sale en la
    // imagen del carrusel y quien la sigue no lo encuentra en la página a la que
    // llegaba: el enlace prometía 9 y entregaba 8.
    //
    // Medido el 9 de octubre de 2026 sobre el finde del 10 y 11: `/api/promo` daba 9
    // imágenes y `/hoy` pintaba 8 tarjetas.
    const html = await texto(await renderizar({ fecha: FECHA }));

    // El fixture trae muchos más que nueve, así que lo que decide es el tope, no
    // que falten eventos.
    expect(titulos(html)).toHaveLength(MAX_DIAPOSITIVAS);
  });

  it("la cabecera se aparta el sitio de la barra fija, como todas las demás páginas", async () => {
    // La `Header` es `fixed` (`Header.tsx:329`), así que **no ocupa sitio en el
    // flujo**, y `<main>` no lleva `padding-top` (`layout.tsx:143`): cada página
    // tiene que apartarla por su cuenta. Las otras quince usan `pt-28`; `/hoy` usaba
    // `py-10`, y medido en móvil son 40 px contra una cabecera de 66: **26 px del
    // título quedaban debajo de la barra.**
    //
    // Se comprueba la clase y no el píxel porque en este entorno no hay
    // motor de layout: lo que se fija es que la página **siga la convención**, que
    // es la única forma de que volver a `py-10` se ponga rojo aquí.
    const html = await texto(await renderizar({}));

    expect(html).toMatch(/class="[^"]*\bpt-28\b/);
    expect(html).not.toMatch(/class="[^"]*\bpy-10\b/);
  });

  it("la fecha se escribe en castellano y no en ISO", async () => {
    const html = await texto(await renderizar({ desde: AYER, hasta: FECHA }));

    // El `2026-10-08 — 2026-10-10` es lo primero que ve quien llega del post de
    // Instagram, y es un formato de máquinas.
    //
    // **No se puede comprobar con `not.toContain(FECHA)`**: los slugs llevan la fecha
    // dentro —`...-2026-10-10-n9bmim`— y el enlace está en el HTML. Por eso se mira
    // el párrafo de la cabecera y solo él.
    const parrafo = html.match(/<p class="mt-1[^"]*">([^<]*)<\/p>/)?.[1] ?? "";

    expect(parrafo).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(parrafo).toMatch(/lunes|martes|miércoles|jueves|viernes|sábado|domingo/i);
  });

  it("el título del navegador dice el finde cuando lo que se pinta es el finde", async () => {
    // `metadata` era un objeto fijo con `"Recomendados para hoy"`, y en una URL con
    // `?desde=&hasta=` eso es falso: es la pestaña, y es lo que Google indexa para
    // esas direcciones.
    jest.resetModules();
    mockSoloMunicipal(FECHA);
    const mod = await import("@/app/hoy/page");

    const finde = await mod.generateMetadata({
      searchParams: Promise.resolve({ desde: AYER, hasta: FECHA }),
      params: Promise.resolve({}),
    });
    const hoy = await mod.generateMetadata({
      searchParams: Promise.resolve({}),
      params: Promise.resolve({}),
    });

    expect(String(finde.title)).not.toMatch(/para hoy/);
    expect(String(hoy.title)).toMatch(/para hoy/);
  });
});