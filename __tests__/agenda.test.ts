import crypto from "crypto";
import { aggregate, findBySlug } from "@/lib/agenda";
import { SOURCE_REGISTRY, type SourceEntry } from "@/lib/source-registry";
import { eventSlug } from "@/lib/slug";
import { CATEGORY_COLORS } from "@/lib/categories";

// `run` es obligatorio en toda entrada de verdad, así que el parámetro lo exige
// sin necesitar un `unknown[]` que castear después.
type EntryOverride = Partial<Omit<SourceEntry, "run">> & Pick<SourceEntry, "run">;

function entry(over: EntryOverride): SourceEntry {
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

  it("es estable entre dos llamadas: el id no se regenera", async () => {
    const e = [entry({ run: async () => [BASE] })];
    const a = await aggregate(e);
    const b = await aggregate(e);
    expect(a[0].id).toBe(b[0].id);
  });

  it("deduplica el mismo evento servido por dos fuentes", async () => {
    const evs = await aggregate([
      entry({ id: "a", priority: 0, run: async () => [BASE] }),
      entry({ id: "b", priority: 4, run: async () => [{ ...BASE, link: "https://otro.example.com/b" }] }),
    ]);
    expect(evs).toHaveLength(1);
    expect(evs[0].source).toBe("a");
  });

  it("la clave de dedupe usa el día local, no el prefijo ISO", async () => {
    // `scrapeSenderismo` emite `new Date(y, m, d).toISOString()`, o sea la
    // medianoche local pasada por UTC. Al este de UTC eso es
    // `...T23:00:00.000Z` del día anterior, así que el prefijo ISO marcaría el día
    // 14 en un evento que el usuario ve el día 15 y no colisionaría con la otra
    // fuente: la misma pareja deduplicaría en Dokploy y no en local.
    //
    // Solo muerde al este de UTC, y eso no se puede arreglar desde aquí. Se
    // intentó fijar la zona con `process.env.TZ = "Europe/Madrid"` en un
    // `beforeAll` y **no hace nada**: dentro de un test de Jest la asignación se
    // lee de vuelta correcta pero V8 ignora el cambio, porque fija la zona por
    // isolate al arrancar el worker de test. Medido, no supuesto: con la máquina
    // en UTC, `process.env.TZ` valía "Europe/Madrid", `Intl` seguía resolviendo
    // "UTC" y `new Date(2027, 0, 15).toISOString()` seguía dando
    // `2027-01-15T00:00:00.000Z`. Tampoco vale fijarla en el cuerpo del fichero,
    // que es aún más temprano. Fijarla de verdad exige que nazca el worker con la
    // variable puesta, o sea tocar `jest.config.ts`, que es global y lo necesita
    // la T9.
    //
    // Y en UTC el test no es solo débil: es imposible que muerda, porque allí
    // `localDateKey(d)` y `d.slice(0, 10)` son la misma función para toda fecha.
    // Ningún test en negro puede distinguirlas. Por eso el caso avisa por consola
    // cuando corre en una zona donde no protege, en vez de dejar un verde que
    // alguien se lea como protección.
    const medianoche = new Date(2027, 0, 15, 0, 0, 0).toISOString();
    const mediodia = new Date(2027, 0, 15, 12, 0, 0).toISOString();

    if (medianoche.slice(0, 10) === mediodia.slice(0, 10)) {
      console.warn(
        "[agenda] AVISO: el runner está en UTC o al oeste, así que el caso del " +
          "huso horario no puede detectar una regresión a `date.slice(0, 10)`. " +
          "Zona: " + Intl.DateTimeFormat().resolvedOptions().timeZone
      );
    }

    const evs = await aggregate([
      entry({ id: "senderismo", priority: 0, run: async () => [{ ...BASE, date: medianoche }] }),
      entry({ id: "municipal", priority: 4, run: async () => [{ ...BASE, date: mediodia, link: "https://e/b" }] }),
    ]);
    expect(evs).toHaveLength(1);
    expect(evs[0].source).toBe("senderismo");
  });

  it("no deduplica dos eventos que caen en días locales distintos", async () => {
    // El otro lado de la moneda: normalizar al día local no puede fundir la
    // medianoche de un día con la de la mañana siguiente. No caza el bug de
    // arriba, ata el límite.
    const dia15 = new Date(2027, 0, 15, 0, 0, 0).toISOString();
    const dia16 = new Date(2027, 0, 16, 0, 0, 0).toISOString();
    const evs = await aggregate([
      entry({ run: async () => [
        { ...BASE, date: dia15 },
        { ...BASE, date: dia16, link: "https://e/b" },
      ] }),
    ]);
    expect(evs).toHaveLength(2);
  });

  it("hereda la imagen del perdedor si el ganador no trae", async () => {
    const [ev] = await aggregate([
      entry({ id: "a", priority: 0, run: async () => [{ ...BASE }] }),
      entry({ id: "b", priority: 4, run: async () => [{ ...BASE, link: "https://otro/b", image: "https://cdn/x.jpg" }] }),
    ]);
    expect(ev.image).toBe("https://cdn/x.jpg");
  });

  it("hereda el lugar del perdedor si el ganador no sabe dónde es", async () => {
    // La comparación es contra `SIN_LUGAR` y no contra falsy: `normalizeRaw` deja
    // `location` siempre rellena, así que `!winner.location` no era jamás
    // verdadero y la herencia era una rama muerta. Un evento municipal sin lugar
    // se quedaba en "Vitoria-Gasteiz" aunque Eventbrite supiera el recinto, y
    // `app/evento/[slug]/page.tsx` usa ese mismo string como señal para decidir si
    // añade la localidad, así que el fallo llegaba hasta el texto del detalle.
    const [ev] = await aggregate([
      entry({ id: "municipal", priority: 0, run: async () => [{ ...BASE }] }),
      entry({ id: "comercial", priority: 4, run: async () => [{ ...BASE, link: "https://otro/b", location: "HellDorado" }] }),
    ]);
    expect(ev.location).toBe("HellDorado");
  });

  it("aplica la categoría de la entrada cuando la fuente no trae", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [BASE], category: "Teatro" }),
    ]);
    expect(ev.category).toBe("Teatro");
  });

  it("normaliza la categoría y siempre tiene color", async () => {
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

  it("descarta títulos vacíos y fechas inválidas", async () => {
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

  it("normaliza url y timeStart de las fuentes que los usan así", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, link: undefined, url: "https://x.com/blanca", time: undefined, timeStart: "19:30" }] }),
    ]);
    expect(ev.link).toBe("https://x.com/blanca");
    expect(ev.time).toBe("19:30");
  });

  it("usa venue como ubicación", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, location: undefined, venue: "HellDorado" }] }),
    ]);
    expect(ev.location).toBe("HellDorado");
  });

  it("descarta el enlace # y rellena la localidad por defecto", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, link: "#", location: "" }] }),
    ]);
    expect(ev.link).toBe("");
    expect(ev.location).toBe("Vitoria-Gasteiz");
  });

  it("rechaza imágenes que no son http", async () => {
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
    // fiestas-blanca. El desempate es posicional, así que hay que fijarlo o el
    // próximo grupo al que se le dé prioridad vuelve a colisionar en silencio.
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

  it("descarta los eventos cancelados", async () => {
    // Sin este filtro un concierto anulado se ve en pantalla igual que uno que
    // va a celebrarse: no hay badge de cancelado en ninguna tarjeta, y lo único
    // que leería el campo es el JSON-LD de lib/seo.tsx, que además declara lo
    // contrario de lo que ve el usuario.
    const evs = await aggregate([
      entry({ run: async () => [
        BASE,
        { ...BASE, title: "Cancelado", link: "https://e/c", cancelled: true },
      ] }),
    ]);
    expect(evs.map((e) => e.title)).toEqual(["Concierto de prueba"]);
  });

  it("filtra después del dedupe: manda el cancelado de la fuente que gana", async () => {
    // El filtro va después del dedupe a propósito, así que si la fuente de mayor
    // confianza dice que está cancelado el evento desaparece aunque otra fuente,
    // más pobre, lo siga listando. Mover el filtro antes del dedupe lo traería
    // de vuelta con la ficha incompleta de la otra fuente.
    const evs = await aggregate([
      entry({ id: "fiable", priority: 0, run: async () => [{ ...BASE, cancelled: true }] }),
      entry({ id: "pobre", priority: 4, run: async () => [{ ...BASE, link: "https://e/b" }] }),
    ]);
    expect(evs).toHaveLength(0);
  });
});

describe("caché por fuente", () => {
  const TTL = 2 * 60 * 60 * 1000;

  // La clave de la caché es `source:${id}` y los ids de test llevan un uuid, así
  // que una ejecución anterior no puede dejar una entrada válida que falsee el
  // recuento de llamadas. Si el id fuera fijo, el fichero de `tmpdir` de una
  // corrida anterior serviría de respuesta y estos tests pasarían sin código.
  function conTtl(id: string, cacheTtlMs: number | undefined, run: () => Promise<typeof BASE[]>) {
    return entry({ id, cacheTtlMs, run });
  }

  it("una fuente con cacheTtlMs no vuelve a llamar a su run dentro del TTL", async () => {
    const run = jest.fn().mockResolvedValue([BASE]);
    const fuentes = [conTtl(`con-ttl-${crypto.randomUUID()}`, TTL, run)];

    const a = await aggregate(fuentes);
    const b = await aggregate(fuentes);

    expect(run).toHaveBeenCalledTimes(1);
    // La segunda llamada sale del disco, así que sigue siendo la misma agenda y
    // no una lista vacía: la caché no puede "quedarse sin nada" y apparentemente
    // cumplir el test de arriba.
    expect(b).toHaveLength(1);
    expect(b[0].id).toBe(a[0].id);
  });

  it("una fuente con cacheTtlMs vuelve a llamar cuando el TTL expira", async () => {
    // El reloj se fija como en `__tests__/cache.test.ts`: la primera escritura va
    // con el reloj de verdad, para que el `mtime` del fichero sea real, y luego
    // salta el reloj un minuto más allá del TTL. Nada de TTL negativo ni cero,
    // que es lo que hizo intermitente el test anterior: aquí el margen es de un
    // minuto entero y el desfase de milisegundos entre `mtime` y `Date.now()` no
    // lo cruza en ninguna dirección.
    const run = jest.fn().mockResolvedValue([BASE]);
    const fuentes = [conTtl(`expira-${crypto.randomUUID()}`, TTL, run)];
    const ahora = Date.now();

    await aggregate(fuentes);
    expect(run).toHaveBeenCalledTimes(1);

    jest.spyOn(Date, "now").mockReturnValue(ahora + TTL + 60_000);
    await aggregate(fuentes);

    expect(run).toHaveBeenCalledTimes(2);
  });

  it("una fuente sin cacheTtlMs se llama cada vez que se pide el agregado", async () => {
    // Este es el que protege a las otras 26. Sin él, cambiar la condición de
    // `aggregate` a "cachea todo" o a "cachea lo que no tenga TTL corto" —que
    // es lo que pasa por la cabeza cuando se busca simetría— seguiría dejando
    // verdes los dos tests de arriba.
    const run = jest.fn().mockResolvedValue([BASE]);
    const fuentes = [entry({ id: `sin-ttl-${crypto.randomUUID()}`, run })];

    await aggregate(fuentes);
    await aggregate(fuentes);

    expect(run).toHaveBeenCalledTimes(2);
  });
});

/**
 * Dónde está puesto el TTL y dónde no.
 *
 * La caché de `source:${id}` se crea solo para quien lo declara, así que esto ata
 * el dato, no la mecánica: si alguien quita el de Rula, o lo pone en otra fuente
 * por simetría, falla aquí antes de que nadie lo note en producción. Un TTL de
 * más es un bug de frescura que no se ve; uno de menos es el problema de 6,5 MB
 * que motivó el cambio, solo que repartido.
 */
describe("el TTL propio está solo donde está medido", () => {
  it("La Genterula declara dos horas", () => {
    const rula = SOURCE_REGISTRY.find((e) => e.id === "rula");
    expect(rula?.cacheTtlMs).toBe(2 * 60 * 60 * 1000);
  });

  it("ninguna otra fuente declara TTL propio", () => {
    const conTtl = SOURCE_REGISTRY.filter((e) => e.cacheTtlMs !== undefined).map((e) => e.id);
    expect(conTtl).toEqual(["rula"]);
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

    // Una entrada por fuente: si dos se colisionaran, el recuento lo delataría.
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

describe("contrato de URL pública", () => {
  it("el slug de un evento conocido no cambia", () => {
    // Literal completo, no derivado: si `eventSlug` llegara a depender del id o
    // del nombre de la fuente, este valor se movería y todos los enlaces ya
    // publicados pasarían a 404. Ojo con el prefijo: `slugify` quita acentos y
    // signos, no artículos, así que es "cena-de-gazt-pastor" y no
    // "cena-gazt-pastor".
    expect(
      eventSlug({
        title: "Cena de Gazt Pastor",
        date: "2027-01-15T19:00:00.000Z",
        link: "https://www.lagenterula.com/evento/cena-gazt-pastor",
      })
    ).toBe("cena-de-gazt-pastor-2027-01-15-61c47k");
  });

  it("el slug no depende de si la URL viene en link o en url", async () => {
    // La forma que emite `scrapeFiestasBlanca`: `url` y `timeStart`, sin `link`.
    // El agregador viejo lo traducía a mano en su push de La Blanca; aquí quien
    // resuelve es `normalizeRaw`. Si esa resolución se moviera, el mismo evento
    // saldría con dos slugs distintos y una de las dos tarjetas daría 404.
    const conLink = await aggregate([
      entry({ run: async () => [{ ...BASE, link: "https://x.com/blanca" }] }),
    ]);
    const conUrl = await aggregate([
      entry({ run: async () => [{ ...BASE, link: undefined, url: "https://x.com/blanca" }] }),
    ]);
    expect(conUrl[0].link).toBe("https://x.com/blanca");
    expect(conUrl[0].slug).toBe(conLink[0].slug);
  });
});
