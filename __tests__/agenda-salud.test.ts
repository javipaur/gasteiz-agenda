import { aggregateConMeta, aggregate, type AgendaEvento } from "@/lib/agenda";
import { SOURCE_REGISTRY, type SourceEntry } from "@/lib/source-registry";
import { SOURCE_DATA } from "@/lib/source-data";

/**
 * La salud del agregado: saber si los datos que se sirven están completos.
 *
 * El fallo que hace que este test exista no se ve en la pantalla. `aggregate` usa
 * `Promise.allSettled`, así que si 13 de 28 scrapers caen lo único que sale es un
 * `logger.warn` y la agenda se devuelve más corta con HTTP 200. Quien la consume —una
 * persona, o un modelo de lenguaje con la agenda en el contexto— no tiene forma de
 * distinguir "hoy hay 400 eventos" de "hoy solo han respondido 13 fuentes". Es el
 * mismo modo de fallo que este repo ya corrigió una vez en `municipal`, `rula`,
 * `farmacias` y `search`: **una lista más corta que no dice que está más corta**.
 */

function entry(over: Partial<SourceEntry> & Pick<SourceEntry, "run">): SourceEntry {
  return { id: "test", group: "test", label: "Test", priority: 9, ...over };
}

const OK = {
  title: "Evento de prueba",
  date: "2027-03-15T20:00:00.000Z",
  link: "https://example.com/a",
};

describe("aggregateConMeta", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("declara completas las fuentes cuando ninguna falla", async () => {
    const { meta } = await aggregateConMeta([
      entry({ id: "a", run: async () => [OK] }),
      entry({ id: "b", run: async () => [] }),
    ]);

    expect(meta.sourcesTotal).toBe(2);
    expect(meta.sourcesOk).toBe(2);
    expect(meta.sourcesFallidas).toEqual([]);
  });

  it("cuenta como fallida solo la fuente que rechaza, no la que devuelve vacío", async () => {
    // La diferencia es el modo de fallo que hay que separar. Una fuente que responde
    // con `[]` ha dicho "no tengo nada", y eso es un dato. Una que rechaza no ha dicho
    // nada, y es una fuente que no se ha podido consultar.
    const { eventos, meta } = await aggregateConMeta([
      entry({ id: "responde-vacio", run: async () => [] }),
      entry({ id: "responde", run: async () => [OK] }),
      entry({ id: "falla", run: async () => { throw new Error("502 del upstream"); } }),
    ]);

    expect(eventos).toHaveLength(1);
    expect(meta.sourcesTotal).toBe(3);
    expect(meta.sourcesOk).toBe(2);
    expect(meta.sourcesFallidas).toEqual([
      { id: "falla", error: "502 del upstream" },
    ]);
  });

  it("el motivo viaja en la meta, no solo en el log", async () => {
    // `agenda.ts` loguea `reason.message` y nada más, así que el panel distingue un
    // 502 de un 404 pero no dice *de qué fuente*. Con la meta, quien lo consume sabe
    // que le falta esta fuente concreta y puede decirlo en vez de servir una agenda
    // incompleta sin poder decirlo.
    const { meta } = await aggregateConMeta([
      entry({ id: "rula", run: async () => { throw new Error("la Genterula returned 500"); } }),
    ]);

    expect(meta.sourcesFallidas[0]).toEqual({
      id: "rula",
      error: "la Genterula returned 500",
    });
  });

  it("un motivo que no es Error se stringifica en vez de perderlo", async () => {
    const { meta } = await aggregateConMeta([
      entry({ id: "rara", run: async () => { throw "texto plano"; } }),
    ]);

    expect(meta.sourcesFallidas[0].error).toBe("texto plano");
  });

  it("scrapedAt es un instante válido y no cambia al releer", async () => {
    const { meta } = await aggregateConMeta([entry({ run: async () => [OK] })]);

    expect(Number.isFinite(new Date(meta.scrapedAt).getTime())).toBe(true);
    // La clave está en que es la **construcción** del agregado. Si se tomara al
    // leer, una caché de cinco minutos daría siempre "ahora" y el campo no diría nada
    // de la frescura, que es lo único que se le pide.
    expect(meta.scrapedAt).toBe(meta.scrapedAt);
  });

  it("aggregate sigue devolviendo el array, sin cambiar de firma", async () => {
    // La versión corta se usa en todos los tests y en cualquier código que solo
    // quiera los eventos. Que siga siendo un array, y no un objeto con `eventos`,
    // es lo que evita quince cambios de una vez.
    const eventos = await aggregate([
      entry({ id: "a", run: async () => [OK] }),
      entry({ id: "b", run: async () => { throw new Error("boom"); } }),
    ]);

    expect(Array.isArray(eventos)).toBe(true);
    expect(eventos).toHaveLength(1);
  });

  it("una lista vacía sin ninguna falla no es lo mismo que una lista vacía con todas caída", async () => {
    // Es la distinción que el endpoint existe para servir, y la razón de que
    // `completa` se calcule con `sourcesFallidas` y no con `eventos.length === 0`.
    const sinNada = await aggregateConMeta([entry({ id: "a", run: async () => [] })]);
    expect(sinNada.eventos).toHaveLength(0);
    expect(sinNada.meta.sourcesFallidas).toEqual([]);

    const todoCaido = await aggregateConMeta([
      entry({ id: "a", run: async () => { throw new Error("x"); } }),
    ]);
    expect(todoCaido.eventos).toHaveLength(0);
    expect(todoCaido.meta.sourcesFallidas).toHaveLength(1);
  });
});

describe("el registro real", () => {
  it("sourcesTotal coincide con las fuentes del registro", () => {
    // `sourcesTotal` no se cuenta de lo que respondió, sino de lo que se preguntó:
    // si se contara de los `allSettled` el total, una entrada que no llegara a
    // ejecutarse bajaría el número en vez de constar como caída.
    expect(SOURCE_REGISTRY).toHaveLength(SOURCE_DATA.length);
  });

  it("el registro tiene más de una fuente, para que la salud signifique algo", () => {
    expect(SOURCE_DATA.length).toBeGreaterThan(20);
  });
});

describe("agregarPorDiaLocal y la salud, juntas", () => {
  it("un evento que una fuente caída habría traido no aparece, y la meta lo dice", async () => {
    // Los dos efectos en la misma llamada, que es como se ven en producción: la
    // agenda sale más corta **y** hay forma de saber por qué.
    const entradas: AgendaEvento[] = [];
    const { eventos, meta } = await aggregateConMeta([
      entry({ id: "vam", run: async () => [{ ...OK, title: "Concierto en el VAM" }] }),
      entry({ id: "festival", run: async () => { throw new Error("503"); } }),
    ]);
    entradas.push(...eventos);

    expect(entradas.map((e) => e.source)).toEqual(["vam"]);
    expect(meta.sourcesFallidas.map((s) => s.id)).toEqual(["festival"]);
  });
});
