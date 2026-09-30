import { aggregate, findBySlug } from "@/lib/agenda";
import { SOURCE_REGISTRY, type SourceEntry } from "@/lib/source-registry";
import { eventSlug } from "@/lib/slug";
import { CATEGORY_COLORS } from "@/lib/categories";

function entry(over: Partial<SourceEntry> & { run: () => Promise<unknown[]> }): SourceEntry {
  return { id: "test", group: "test", label: "Test", priority: 9, ...over };
}

const BASE = {
  title: "Concierto de prueba",
  date: "2027-03-15T20:00:00.000Z",
  link: "https://example.com/a",
};

describe("aggregate", () => {
  it("deriva el id del slug y ambos coinciden", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [BASE] }),
    ]);
    expect(ev.id).toBe(ev.slug);
    expect(ev.id).toBe(eventSlug({ title: BASE.title, date: BASE.date, link: BASE.link }));
  });

  it("es estable entre dos llamadas: no usa UUID", async () => {
    const e = [entry({ run: async () => [BASE] })];
    const a = await aggregate(e);
    const b = await aggregate(e);
    expect(a[0].id).toBe(b[0].id);
    expect(a[0].id).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
  });

  it("deduplica el mismo evento servido por dos fuentes", async () => {
    const evs = await aggregate([
      entry({ id: "a", priority: 0, run: async () => [BASE] }),
      entry({ id: "b", priority: 4, run: async () => [{ ...BASE, link: "https://otro.example.com/b" }] }),
    ]);
    expect(evs).toHaveLength(1);
    expect(evs[0].source).toBe("a");
  });

  it("hereda la imagen del perdedor si el ganador no trae", async () => {
    const [ev] = await aggregate([
      entry({ id: "a", priority: 0, run: async () => [{ ...BASE }] }),
      entry({ id: "b", priority: 4, run: async () => [{ ...BASE, link: "https://otro/b", image: "https://cdn/x.jpg" }] }),
    ]);
    expect(ev.image).toBe("https://cdn/x.jpg");
  });

  it("aplica la categoria de la entrada cuando la fuente no trae", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [BASE], category: "Teatro" }),
    ]);
    expect(ev.category).toBe("Teatro");
  });

  it("normaliza la categoria y siempre tiene color", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, category: "conciertos" }] }),
    ]);
    expect(ev.category).toBe("Música");
    expect(CATEGORY_COLORS[ev.category]).toBeDefined();
  });

  it("arranca con la pista de la entrada, no con la de la fuente", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, category: "lo que sea" }], category: "Música" }),
    ]);
    expect(ev.category).toBe("Música");
  });

  it("propaga kind y tags de la entrada", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [BASE], kind: "inscripciones", tags: ["infantil"] }),
    ]);
    expect(ev.kind).toBe("inscripciones");
    expect(ev.tags).toEqual(["infantil"]);
  });

  it("descarta titulos vacios y fechas invalidas", async () => {
    const evs = await aggregate([
      entry({ run: async () => [
        { ...BASE, title: "" },
        { ...BASE, title: "   " },
        { ...BASE, title: "Sin título" },
        { ...BASE, date: "no-es-fecha" },
        { ...BASE, date: "" },
      ] }),
    ]);
    expect(evs).toHaveLength(0);
  });

  it("normaliza url y timeStart de las fuentes que los usan asi", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, link: undefined, url: "https://x.com/blanca", time: undefined, timeStart: "19:30" }] }),
    ]);
    expect(ev.link).toBe("https://x.com/blanca");
    expect(ev.time).toBe("19:30");
  });

  it("usa venue como ubicacion", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, location: undefined, venue: "HellDorado" }] }),
    ]);
    expect(ev.location).toBe("HellDorado");
  });

  it("descarta el enlace # y deja location vacia", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, link: "#", location: "" }] }),
    ]);
    expect(ev.link).toBe("");
    expect(ev.location).toBe("Vitoria-Gasteiz");
  });

  it("rechaza imagenes que no son http", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, image: "/local/x.png" }] }),
    ]);
    expect(ev.image).toBeUndefined();
  });

  it("una fuente que revienta no se lleva por delante el resto", async () => {
    const evs = await aggregate([
      entry({ id: "rota", run: async () => { throw new Error("boom"); } }),
      entry({ id: "buena", run: async () => [BASE] }),
    ]);
    expect(evs).toHaveLength(1);
    expect(evs[0].source).toBe("buena");
  });

  it("desempata a igual prioridad por el orden del array", async () => {
    // municipal-general empata en priority con vam, euskadi, senderismo y
    // fiestas-blanca. El desempate es posicional, asi que hay que fijarlo o el
    // proximo grupo al que se le de prioridad vuelve a colisionar en silencio.
    const municipal = entry({ id: "municipal-x", priority: 1, run: async () => [BASE] });
    const euskadi = entry({ id: "euskadi-x", priority: 1, run: async () => [{ ...BASE, link: "https://e/b" }] });
    const [primero] = await aggregate([municipal, euskadi]);
    expect(primero.source).toBe("municipal-x");

    const [invertido] = await aggregate([euskadi, municipal]);
    expect(invertido.source).toBe("euskadi-x");
  });

  it("la prioridad manda sobre el orden del array", async () => {
    const sinPrioridad = entry({ id: "sin-prio", priority: 9, run: async () => [BASE] });
    const conPrioridad = entry({ id: "con-prio", priority: 0, run: async () => [{ ...BASE, link: "https://e/b" }] });
    const [ganador] = await aggregate([sinPrioridad, conPrioridad]);
    expect(ganador.source).toBe("con-prio");
  });

  it("ordena por fecha", async () => {
    const evs = await aggregate([
      entry({ run: async () => [
        { ...BASE, title: "Tarde", date: "2027-05-01T10:00:00.000Z" },
        { ...BASE, title: "Temprano", date: "2027-01-01T10:00:00.000Z" },
      ] }),
    ]);
    expect(evs.map((e) => e.title)).toEqual(["Temprano", "Tarde"]);
  });
});

describe("invariante: toda tarjeta tiene detalle", () => {
  it("cada evento de cada entrada del registro resuelve por su slug", async () => {
    const evs = await aggregate(
      SOURCE_REGISTRY.map((e) => ({
        ...e,
        run: async () => [
          {
            title: `Evento de ${e.id}`,
            date: "2027-03-15T20:00:00.000Z",
            link: `https://example.com/${e.id}`,
          },
        ],
      }))
    );

    // Una entrada por fuente: si dos se colisionaran, el recuento lo delataria.
    expect(evs.length).toBe(SOURCE_REGISTRY.length);

    for (const ev of evs) {
      expect(findBySlug(evs, ev.slug)).toBeDefined();
      expect(findBySlug(evs, ev.slug)!.id).toBe(ev.id);
    }
  });

  it("el slug de una tarjeta coincide con el del detalle", async () => {
    const evs = await aggregate([
      entry({ run: async () => [BASE] }),
    ]);
    const tarjeta = evs[0];

    // Esto es lo que hace EventCard y lo que hace /evento/[slug]. Si divergen,
    // el enlace da 404.
    const href = `/evento/${tarjeta.slug}`;
    const slugDeLaUrl = href.replace("/evento/", "");
    expect(findBySlug(evs, slugDeLaUrl)).toBeDefined();
  });
});

describe("contrato de URL publica", () => {
  it("el slug de un evento conocido no cambia", () => {
    // Literal completo, no derivado: si `eventSlug` llegara a depender del id o
    // del nombre de la fuente, este valor se moveria y todos los enlaces ya
    // publicados pasarian a 404. Ojo con el prefijo: `slugify` quita acentos y
    // signos, no articulos, asi que es "cena-de-gazt-pastor" y no
    // "cena-gazt-pastor".
    expect(
      eventSlug({
        title: "Cena de Gazt Pastor",
        date: "2027-01-15T19:00:00.000Z",
        link: "https://www.lagenterula.com/evento/cena-gazt-pastor",
      })
    ).toBe("cena-de-gazt-pastor-2027-01-15-61c47k");
  });
});
