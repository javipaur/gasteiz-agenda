import React from "react";
import { loadFixture, mockFetchWith } from "./helpers";

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

/** El día que el test pregunta, dos días por delante de hoy. */
const OBJETIVO = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d;
})();

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const FECHA = ymd(OBJETIVO);
const AYER = ymd(new Date(Date.now() - 86400000));

/**
 * El fixture municipal con todas las fechas en `FECHA`.
 *
 * **Por qué hay que reescribirlo y no usar `loadFixture` tal cual.** El fixture se
 * capturó el 16 de septiembre de 2026 y `getAgendaEventos()` descarta el pasado salvo
 * que se le pida `includePast` —que es lo correcto para la agenda real—. Con las fechas
 * de captura la página pinta el estado vacío, el test pasa por el motivo equivocado y
 * dentro de dos semanas no pinta nada en absoluto: se pudre en silencio, que es la
 * trampa que `loadFixtureWithFutureDates` ya evita para los HTML.
 *
 * Y por qué no se reusa ese helper: solo reescribe el texto `"Fecha: …"` de los
 * fixtures HTML, y este es un JSON donde la fecha viaja en `fechaInicio` y `datetime`.
 *
 * Todos los eventos caen en el **mismo** día a propósito. Así "hoy" no tiene nada y el
 * día que se pregunta sí, que es lo que hace que el caso de `?fecha=` demuestre que
 * la página pinta el día pedido en vez del día actual.
 */
function fixtureEnFuturo(): string {
  const datos = JSON.parse(loadFixture("municipal-response.json")) as Record<
    string,
    { resultados?: Array<Record<string, unknown>> }
  >;

  const yyyymmdd = FECHA.replace(/-/g, "");
  // A las 20:00 hora local, con el offset de `jest.config.ts` —que fija
  // `Europe/Madrid` en el proceso principal, antes de bifurcar los workers—, para
  // que el `new Date(...)` del selector caiga dentro de la ventana local del día.
  const instante = new Date(`${FECHA}T20:00:00`).toISOString();

  for (const seccion of Object.values(datos)) {
    for (const fila of seccion?.resultados ?? []) {
      fila.fechaInicio = yyyymmdd;
      fila.datetime = instante;
      fila.fechaFin = null;
      fila.isCancelado = false;
    }
  }

  return JSON.stringify(datos);
}

async function renderizar(params: Record<string, string> = {}) {
  jest.resetModules();
  mockFetchWith([{ match: /vitoria-gasteiz\.org/, content: fixtureEnFuturo() }]);
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
    // Y el rango se ve escrito, que es lo que hace que el post del finde no parezca
    // el de un solo día.
    expect(html).toContain(AYER);
    expect(html).toContain(FECHA);
  });

  it("un día sin nada lo dice, en vez de pintar una página vacía sin explicación", async () => {
    const html = await texto(await renderizar({ fecha: "1990-01-01" }));

    expect(html).toMatch(/no hay nada recomendado para esa fecha/i);
  });
});