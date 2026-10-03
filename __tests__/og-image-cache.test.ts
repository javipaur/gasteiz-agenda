/**
 * La caché de `og:image` de `lib/og-image.ts` era la copia gemela de la que se
 * arregló en `lib/sources/vam.ts`, con los tres fallos de la gemela intactos: un
 * `Map` a nivel de módulo —que en Next **dura lo que dura el proceso**—, sin TTL,
 * sin tope de tamaño y guardando `undefined` en tres sitios.
 *
 * Las dos consecuencias, y conviene no confundirlas:
 *
 * - **Un `og:image` viejo se servía para siempre.** Si el sitio cambiaba la imagen de
 *   un evento, la agenda seguía con la anterior, y como `enrichWithImages` corre en
 *   cada scrape y eso entra en `agenda-all` cada 5 minutos, la imagen rancia se
 *   repinta indefinidamente. Solo un reinicio del proceso lo arreglaba.
 * - **El `Map` crecía sin límite.** Una entrada por cada enlace distinto que aparece
 *   en el catálogo, y el catálogo rota eventos nuevos cada semana.
 *
 * Una cosa que **no** pasaba y que conviene decir porque se dio por hecha al
 * revisar: las entradas negativas —las que guardaban `undefined` al fallar el
 * `fetch`— no se leían nunca. El guard era `if (cached !== undefined)`, así que un
 * `undefined` guardado equivale a no tener entrada y la ficha se vuelve a pedir. O
 * sea que un 503 no dejaba imágenes sin imagen para siempre; lo que dejaba era una
 * entrada muerta por cada URL fallida, que ocupa sitio y nunca se va a leer. Medido:
 *
 *     m.set("u", undefined); m.get("u") !== undefined   // -> false
 *
 * Los números del TTL y del tope viven aquí y no importados del módulo a propósito:
 * importarlos haría que la suite no **compilase** contra el código viejo, y una suite
 * que no compila no es un test rojo — es un test que no se ha escrito. Con los
 * números aquí, el rojo cae en la aserción, que es donde tiene que caer.
 */
import { EMPTY_HTML } from "./helpers";

const TTL_MS = 60 * 60 * 1000;
const MAX = 200;

type ModuloOg = {
  fetchOgImage: (url: string) => Promise<string | undefined>;
  invalidateOgImageCache: () => void;
  OG_IMAGE_CACHE_TTL_MS: number;
  OG_IMAGE_CACHE_MAX: number;
  crearCacheDeImagenes: <T>(ttlMs: number, max: number) => {
    leer: (clave: string) => T | undefined;
    guardar: (clave: string, valor: T) => void;
    invalidar: () => void;
  };
};

const OG_HTML =
  '<html><head><meta property="og:image" content="https://cdn.euskadi.eus/img/portada.jpg">' +
  "</head><body></body></html>";

/**
 * Monta el módulo y registra las peticiones de ficha.
 *
 * `jest.isolateModules` por test porque la caché es un singleton de módulo: sin un
 * registro nuevo por caso, la segunda prueba heredaría las entradas de la primera y
 * el TTL no se podría medir. Es el mismo motivo por el que
 * `__tests__/components/` usa `require()` con su `eslint-disable`, y por eso el
 * import estático no serviría: se resolvería antes de que empezara el aislamiento.
 */
function servir(ogStatus = 200) {
  const fichas: string[] = [];
  const control = { ogStatus };

  let modulo!: ModuloOg;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    modulo = require("@/lib/og-image") as ModuloOg;
  });

  jest
    .spyOn(global, "fetch")
    .mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("ficha.euskadi.eus")) {
        fichas.push(url);
        return new Response(control.ogStatus === 200 ? OG_HTML : "", {
          status: control.ogStatus,
        });
      }
      return new Response(EMPTY_HTML);
    });

  const ficha = (n: string) => `https://ficha.euskadi.eus/evento/${n}`;
  return {
    fichas,
    control,
    modulo,
    leer: (n: string) => modulo.fetchOgImage(ficha(n)),
  };
}

describe("caché de og:image de lib/og-image.ts", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("sirve la imagen cacheada mientras no expire", async () => {
    // El otro lado del TTL: sin caché, `gasteizhoy.ts` pedía la misma ficha en cada
    // scrape y el scraper era de los más caros del registro. Este caso es el que
    // impide que un TTL mal puesto se convierta en "no cachear nada".
    const { fichas, leer } = servir();

    await leer("a");
    await leer("a");

    expect(fichas).toHaveLength(1);
  });

  it("vuelve a pedir la ficha cuando el TTL ha pasado", async () => {
    // Falla con el código viejo: sin TTL, la segunda pasada salía de la caché para
    // nunca y un `og:image` que el sitio cambia no se tornaba nunca.
    jest.useFakeTimers({ doNotFake: ["setTimeout", "setInterval", "setImmediate"] });
    jest.setSystemTime(new Date("2026-10-03T10:00:00Z"));

    const { fichas, leer } = servir();

    await leer("a");
    expect(fichas).toHaveLength(1);

    // Justo antes del TTL todavía se sirve de caché.
    jest.setSystemTime(new Date(Date.now() + TTL_MS - 1000));
    await leer("a");
    expect(fichas).toHaveLength(1);

    // Y pasado el TTL se vuelve a pedir.
    jest.setSystemTime(new Date(Date.now() + 2000));
    await leer("a");
    expect(fichas).toHaveLength(2);
  });

  it("descarta las entradas más antiguas cuando se supera el tope", async () => {
    // Falla con el código viejo: sin tope, el lote A seguía en el `Map` después de
    // que el lote B hubiera pasado, y el proceso acumulaba un enlace por evento
    // nuevo para el resto de su vida.
    //
    // Se hace con tres pasadas y **dos** lotes distintos, y no con uno más grande
    // que el tope, porque un barrido FIFO sobre un catálogo que no cabe falla
    // siempre: cada entrada nueva echa la más antigua y esa era justo la que iba a
    // leerse después. Eso da un cero en las dos implementaciones y no prueba nada.
    jest.useFakeTimers({ doNotFake: ["setTimeout", "setInterval", "setImmediate"] });
    jest.setSystemTime(new Date("2026-10-03T10:00:00Z"));

    const { fichas, leer } = servir();

    for (let i = 0; i < MAX; i++) await leer(`a-${i}`);
    expect(fichas).toHaveLength(MAX);

    // El lote B llena la caché y desplaza al lote A entero.
    for (let i = 0; i < MAX; i++) await leer(`b-${i}`);

    // Volviendo al lote A, sus fichas ya no están y hay que pedirlas otra vez.
    fichas.length = 0;
    for (let i = 0; i < MAX; i++) await leer(`a-${i}`);

    expect(fichas).toHaveLength(MAX);
  });

  it("no guarda el fallo, así que una ficha que se recuperaba se vuelve a leer", async () => {
    // Lo que sí se arregla: un 503 deja de dejar una entrada muerta por cada URL
    // fallida. Con el código viejo este caso también pasaba —el guard de lectura
    // hacía que `undefined` fuera indistinguible de no tener entrada—, así que es un
    // guard: fija el comportamiento bueno para que el "no guardar el fallo" no se
    // lea después como "da igual guardarlo".
    const { fichas, control, leer } = servir(503);

    expect(await leer("a")).toBeUndefined();
    expect(fichas).toHaveLength(1);

    control.ogStatus = 200;
    expect(await leer("a")).toBe("https://cdn.euskadi.eus/img/portada.jpg");
    expect(fichas).toHaveLength(2);
  });

  it("expone `invalidate*` como los scrapers con caché de módulo", () => {
    // `lib/sources/vam.ts` (`invalidateVamImages`), `mercado-abastos.ts`,
    // `civitatis.ts` y `kora.ts` lo exportan. Sin salida no hay forma de que los
    // tests no compartan estado, ni de forzar un re scrape desde código.
    const { modulo } = servir();
    expect(typeof modulo.invalidateOgImageCache).toBe("function");
  });

  it("invalidar deja que la siguiente llamada vuelva a pedir la ficha", async () => {
    // Lo que la puerta sirve: no es decorativa. Sin esto, el caso del TTL sería el
    // único sitio donde una entrada se puede tirar.
    const { fichas, modulo, leer } = servir();

    await leer("a");
    expect(fichas).toHaveLength(1);

    modulo.invalidateOgImageCache();
    await leer("a");

    expect(fichas).toHaveLength(2);
  });

  it("el TTL y el tope son los mismos que los de la caché del VAM", () => {
    // El motivo de que esto sea una comprobación y no un comentario: las dos
    // implementaciones existedían porque cada una se arregló por su lado, y una
    // cambió de valor sin que nadie mirara la otra. Es el bug de "dos copias" en
    // estado de latente, y solo se ve si algo mide las dos.
    const { modulo } = servir();
    expect({
      ttl: modulo.OG_IMAGE_CACHE_TTL_MS,
      max: modulo.OG_IMAGE_CACHE_MAX,
    }).toEqual({ ttl: 60 * 60 * 1000, max: 200 });
  });

  it("la fábrica es reutilizable, con su propio estado y sus propios números", async () => {
    // Lo que hace que la copia de `vam.ts` sea un `import` y no un segundo
    // `Map`: la caché es una instancia, no un singleton de módulo. Dos consumidores
    // con TTL distintos pueden convivir sin negociar, y lo que se rompe al hacerlo
    // mal es que cambien el número del otro.
    jest.useFakeTimers({ doNotFake: ["setTimeout", "setInterval", "setImmediate"] });
    jest.setSystemTime(new Date("2026-10-03T10:00:00Z"));

    const { modulo } = servir();
    const corta = modulo.crearCacheDeImagenes<string>(1000, 1);
    const larga = modulo.crearCacheDeImagenes<string>(TTL_MS, 10);

    corta.guardar("x", "corta");
    larga.guardar("x", "larga");

    jest.setSystemTime(new Date(Date.now() + 2000));

    expect(corta.leer("x")).toBeUndefined();
    // La larga no se entera: es otro reloj, no el mismo.
    expect(larga.leer("x")).toBe("larga");

    // Y el tope es suyo: la corta echa `x` en cuanto entra `y`.
    jest.setSystemTime(new Date(Date.now() - 2000));
    corta.guardar("y", "otra");
    expect(corta.leer("x")).toBeUndefined();
    expect(corta.leer("y")).toBe("otra");
  });
});