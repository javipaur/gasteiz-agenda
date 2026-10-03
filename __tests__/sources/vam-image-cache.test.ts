import { EMPTY_HTML } from "../helpers";

/**
 * La caché de `og:image` del VAM vivía a nivel de módulo, o sea **durante todo el
 * proceso** del servidor de Next: sin TTL, sin tope de tamaño y sin
 * `invalidate*` —que `mercado-abastos.ts`, `civitatis.ts` y `kora.ts` sí
 * exportan—. Dos consecuencias, y conviene no confundirlas:
 *
 * - **Un `og:image` viejo se sirve para siempre.** Si el sitio cambia la imagen de
 *   un evento, la agenda sigue con la anterior hasta que reinicia el proceso. Y
 *   como `enrichWithImages` corre en cada `scrapeVamEvents`, y eso entra en
 *   `agenda-all` cada 5 minutos, la imagen rancia se repinta indefinidamente. Solo
 *   un reinicio lo arregla.
 * - **El Map crece sin límite.** Cada enlace distinto que aparece en el catálogo
 *   deja una entrada para siempre, y el catálogo del VAM rota eventos nuevos cada
 *   semana.
 *
 * Una cosa que **no** pasaba, y que conviene decir porque se dio por hecha al
 * revisar el código: las entradas negativas —las que guardan `undefined` cuando el
 * `fetch` falla— no se leían nunca. El guard es `if (cached !== undefined)`, así
 * que un `undefined` guardado equivale a no tener entrada y la ficha se vuelve a
 * pedir. O sea que un 503 no dejaba imágenes sin imagen para siempre; lo que
 * dejaba era una entrada muerta por cada URL fallida. Medido, no supuesto:
 *
 *     m.set("u", undefined); m.get("u") !== undefined   // -> false
 *
 * Arreglarlo tampoco es dejar de guardar el fallo por descuido: es que una entrada
 * que no se va a leer no tiene por qué ocupar sitio.
 */

/**
 * El TTL y el tope que se esperan. Viven aquí y no importados de `vam.ts` a
 * propósito: importarlos haría que la suite no **compilase** contra el código
 * viejo, y una suite que no compila no es un test rojo — es un test que no se ha
 * escrito. Con los números aquí, el rojo cae en la aserción, que es donde tiene que
 * caer.
 */
const TTL_MS = 60 * 60 * 1000;
const MAX = 200;

const OG_HTML =
  '<html><head><meta property="og:image" content="https://cdn.euskadi.eus/img/portada.jpg">' +
  "</head><body></body></html>";

/**
 * Un catálogo del VAM con `prefijo` y `n` eventos sin imagen, cada uno con su URL.
 *
 * La imagen viene vacía a propósito (`image_url: ""`) porque es lo que hace que
 * `enrichWithImages` tenga que ir a buscar el `og:image`, que es lo que se mide. Y
 * `source_url` distinto en cada uno porque la caché es por enlace; el `prefijo` es
 * lo que permite montar un catálogo con enlaces **nuevos** sin volver a aislar el
 * módulo, que es como se comprueba que lo viejo se echó.
 */
function catalogo(prefijo: string, n: number) {
  return JSON.stringify({
    events: Array.from({ length: n }, (_, i) => ({
      id: `${prefijo}-${i}`,
      title: `Evento ${prefijo}-${i}`,
      city: "Vitoria-Gasteiz",
      category: "Concierto / Música",
      date_start: "2030-09-25T21:00:00+02:00",
      image_url: "",
      source_url: `https://kulturklik.euskadi.eus/evento/${prefijo}-${i}`,
    })),
  });
}

/**
 * Monta el módulo y registra las peticiones de ficha de `og:image`.
 *
 * `jest.isolateModules` por test porque `imageCache` es un singleton de módulo: sin
 * un registro nuevo por caso, la segunda prueba heredaría las entradas de la
 * primera y el TTL no se podría medir. Es el mismo motivo por el que
 * `__tests__/components/` usa `require()` con su `eslint-disable`, y por eso el
 * import estático no serviría: se resolvería antes de que empezara el aislamiento.
 *
 * `control` se devuelve y es mutable a propósito: hay que poder cambiar el catálogo
 * y el estado de las fichas **entre** dos llamadas a `scrapeVamEvents` sin volver a
 * montar el módulo, porque si no quedan congelados y la segunda pasada no prueba
 * nada.
 */
function servir(n = 0, ogStatus = 200) {
  const fichas: string[] = [];
  const control = { prefijo: "a", n, ogStatus };

  let modulo!: { scrapeVamEvents: () => Promise<{ image?: string }[]> };
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    modulo = require("@/lib/sources/vam") as typeof modulo;
  });

  jest.spyOn(global, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    if (url.includes("vamcultura.es")) return new Response(catalogo(control.prefijo, control.n));
    if (url.includes("kulturklik.euskadi.eus")) {
      fichas.push(url);
      return new Response(control.ogStatus === 200 ? OG_HTML : "", {
        status: control.ogStatus,
      });
    }
    return new Response(EMPTY_HTML);
  });

  return { fichas, control, scrape: () => modulo.scrapeVamEvents() };
}

describe("caché de og:image del VAM", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("sirve el og:image cacheado mientras no expire", async () => {
    // El otro lado del TTL: sin caché, cada `scrapeVamEvents` volvía a pedir las
    // fichas y el scraper era el más caro del registro. Este caso es el que impide
    // que un TTL mal puesto se convierta en "no cachear nada".
    const { fichas, scrape } = servir(3);

    await scrape();
    expect(fichas).toHaveLength(3);

    await scrape();
    expect(fichas).toHaveLength(3);
  });

  it("vuelve a pedir el og:image cuando el TTL ha pasado", async () => {
    // Falla con el código viejo: sin TTL, la segunda pasada salía de la caché para
    // nunca, y un `og:image` que el sitio cambia no se tornaba nunca.
    jest.useFakeTimers({ doNotFake: ["setTimeout", "setInterval", "setImmediate"] });
    jest.setSystemTime(new Date("2026-10-03T10:00:00Z"));

    const { fichas, scrape } = servir(2);

    await scrape();
    expect(fichas).toHaveLength(2);

    // Justo antes del TTL todavía se sirve de caché.
    jest.setSystemTime(new Date(Date.now() + TTL_MS - 1000));
    await scrape();
    expect(fichas).toHaveLength(2);

    // Y pasado el TTL se vuelve a pedir.
    jest.setSystemTime(new Date(Date.now() + 2000));
    await scrape();
    expect(fichas).toHaveLength(4);
  });

  it("descarta las entradas más antiguas cuando se supera el tope", async () => {
    // Falla con el código viejo: sin tope, el lote A seguía en el Map después de
    // que el lote B hubiera pasado, y el proceso accumulates un enlace por evento
    // nuevo para el resto de su vida.
    //
    // Se hace con tres pasadas y **dos** catálogos distintos, y no con uno más
    // grande que el tope, porque un barrido FIFO sobre un catálogo que no cabe
    // falla siempre: cada entrada nueva echa la más antigua y esa era justo la que
    // iba a leerse después. Eso da un cero en las dos implementaciones y no prueba
    // nada. Con dos lotes, lo que se mide es justo lo que se quiere: que lo viejo
    // se va.
    const { fichas, control, scrape } = servir(MAX);

    control.prefijo = "a";
    await scrape();
    expect(fichas).toHaveLength(MAX);

    // El lote B llena la caché y desplaza al lote A entero.
    control.prefijo = "b";
    await scrape();

    // Volviendo al lote A, sus fichas ya no están y hay que pedirlas otra vez.
    fichas.length = 0;
    control.prefijo = "a";
    await scrape();

    expect(fichas).toHaveLength(MAX);
  });

  it("no guarda el fallo, así que una ficha que se recuperaba se vuelve a leer", async () => {
    // Lo que sí se arregla: un 503 deja de dejar una entrada muerta por cada URL
    // fallida. La prueba es que el siguiente intento —con el sitio ya bien— devuelve
    // la imagen de verdad en vez de quedarse para siempre con la de reserva.
    const { fichas, control, scrape } = servir(1, 503);

    const con503 = await scrape();
    expect(con503[0].image).toContain("opendata.euskadi.eus");

    control.ogStatus = 200;
    fichas.length = 0;
    const con200 = await scrape();

    expect(fichas).toHaveLength(1);
    expect(con200[0].image).toBe("https://cdn.euskadi.eus/img/portada.jpg");
  });

  it("expone invalidate* como los otros tres scrapers con caché de módulo", () => {
    // `mercado-abastos.ts`, `civitatis.ts` y `kora.ts` lo exportan; el VAM era el
    // cuarto singleton sin salida. Es lo que hace falta para que los tests no
    // compartan estado y para poder forzar un re scrape desde código.
    let modulo!: Record<string, unknown>;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      modulo = require("@/lib/sources/vam") as Record<string, unknown>;
    });

    expect(typeof modulo.invalidateVamImages).toBe("function");
  });
});