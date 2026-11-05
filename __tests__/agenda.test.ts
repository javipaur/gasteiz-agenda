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

  it("resuelve un enlace antiguo si cambió el enlace de origen", async () => {
    const [evento] = await aggregate([
      entry({
        run: async () => [
          {
            ...BASE,
            title: 'Exposición de arte: "Sueños dibujados"',
            date: "2026-11-02T07:30Z",
            link: "https://www.vitoria-gasteiz.org/wb021/was/contenidoAction.do?uid=u62992c29_1a0f4fa44a1_3aaa",
            image: "https://www.vitoria-gasteiz.org/docs/wb021/img/gestor/38/54/gi_93854.png",
          },
        ],
      }),
    ]);

    expect(
      findBySlug(
        [evento],
        "exposicion-de-arte-suenos-dibujados-2026-11-02-8e5a1y"
      )
    ).toBe(evento);
    expect(evento.image).toBe(
      "https://www.vitoria-gasteiz.org/docs/wb021/img/gestor/38/54/gi_93854.png"
    );
  });

  it("no adivina si varios eventos comparten título y fecha", async () => {
    const [evento] = await aggregate([entry({ run: async () => [BASE] })]);
    const eventos = [evento, { ...evento, slug: "otro-slug" }];

    expect(
      findBySlug(eventos, "concierto-de-prueba-2027-03-15-enlaceantiguo")
    ).toBeUndefined();
  });

  it("la clave de dedupe usa el día local, no el prefijo ISO", async () => {
    // `scrapeSenderismo` emite `new Date(y, m, d).toISOString()`, o sea la
    // medianoche local pasada por UTC. Al este de UTC eso es
    // `...T23:00:00.000Z` del día anterior, así que el prefijo ISO marcaría el día
    // 14 en un evento que el usuario ve el día 15 y no colisionaría con la otra
    // fuente: la misma pareja deduplicaría en Dokploy y no en local.
    //
    // Solo muerde al este de UTC, y por eso `process.env.TZ = "Europe/Madrid"`
    // está en `jest.config.ts`: se evalúa antes de que Jest bifurque los workers,
    // así que la variable llega heredada al nascent. Con la máquina en UTC el caso
    // daba un verde que no protegía nada.
    //
    // Dentro de un `beforeAll` **no** funciona: la asignación se lee de vuelta
    // correcta pero V8 la ignora, porque fija la zona por isolate al arrancar el
    // worker de test. Está medido, no supuesto. `__tests__/huso.test.ts` lo fija
    // con un rojo, que es más difícil de pasar por alto que un `console.warn`.
    //
    // Y en UTC el test no es solo débil: es imposible que muerda, porque allí
    // `localDateKey(d)` y `d.slice(0,10)` son la misma función para toda fecha.
    // El aviso se queda por si `huso.test.ts` se desactiva o el pin se rompe.
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

  it("cuenta cuántas fuentes cuentan cada evento, y no lo tira con el perdedor", async () => {
    // El bug que este test existe para que no vuelva: el dedupe roba `image`,
    // `description` y `location` al perdedor y **descarta el resto**. El número de
    // fuentes que contaban el evento se iba con él, y es justo la señal que usa el
    // selector de recomendados: un concierto que anuncia el Ayuntamiento, VAM y
    // Fever es más real que uno que solo aparece en una sala.
    //
    // Va con `group: "municipal"` en las tres entradas a propósito: el dedupe no mira
    // el grupo, así que da igual, pero el nombre de las entradas dice lo que el test
    // cuenta y el diff lo deja claro si alguien lo lee sin contexto.
    const entrada = (id: string, link: string) =>
      entry({ id, priority: 0, run: async () => [{ ...BASE, link }] });

    const evs = await aggregate([
      entrada("municipal-agenda", "https://www.vitoria-gasteiz.org/a"),
      entrada("vam", "https://www.vam.eus/b"),
      entrada("fever", "https://www.feverup.com/c"),
    ]);

    expect(evs).toHaveLength(1);
    expect(evs[0].corrobora).toBe(3);
  });

  it("un evento que solo cuenta una fuente vale uno, no cero", async () => {
    // El otro lado del anterior, y es el que hace que `corrobora` sea opcional en el
    // tipo sin perder información: si el contador empezara en 0 y se sumara por
    // duplicado, un evento sin duplicados saldría con `0`, que se lee como "nadie lo
    // confirma" cuando en realidad lo confirma su única fuente. Y `lib/recomendados.ts`
    // hace `?? 1` en los eventos que los tests construyen a mano, así que un 0 real
    // se colaría por un hueco que el tipo declara opcional.
    const [ev] = await aggregate([entry({ run: async () => [BASE] })]);
    expect(ev.corrobora).toBe(1);
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

  it("prefiere dateIso sobre date, y el slug se calcula con la fecha resuelta", async () => {
    // `scrapeBuscametasInscripciones` sirve `dd/mm/yyyy` porque el móvil la parte
    // con `split('/')` —cambiarlo dejaría la pantalla en blanco sin error—, así que
    // el formato no se puede tocar. Y `new Date("04/10/2026")` no es 4 de octubre:
    // V8 lo lee como 9 de abril. Medido contra el fixture real, eso descartaba 17
    // de las 21 inscripciones de Álava por `normalizeRaw` y fechaba otra en
    // noviembre.
    //
    // Lo que hace este test necesario no es que el evento sobreviva, es que el
    // **slug se calcule con la fecha resuelta**. `agendaSlug` lee `raw.date`, así
    // que sin handing-le la ISO el evento aparecería en octubre con un slug que
    // dice abril, y `/evento/[slug]` daría 404 por un evento que la home acaba de
    // pintar. Es el mismo invariante `id === slug`, aplicado al caso en que hay dos
    // fechas en el mismo objeto.
    const [ev] = await aggregate([
      entry({
        run: async () => [
          { ...BASE, date: "04/10/2026", dateIso: "2026-10-04T00:00:00.000Z" },
        ],
      }),
    ]);
    expect(ev.date).toBe("2026-10-04T00:00:00.000Z");
    expect(ev.slug).toBe(
      eventSlug({ title: BASE.title, date: "2026-10-04T00:00:00.000Z", link: BASE.link })
    );
    expect(ev.id).toBe(ev.slug);
  });

  it("acepta dateIso sin date, para cuando la fuente solo sabe dar la ISO", async () => {
    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, date: undefined, dateIso: "2027-03-15T00:00:00.000Z" }] }),
    ]);
    expect(ev.date).toBe("2027-03-15T00:00:00.000Z");
  });

  it("descarta cuando dateIso esta presente pero es ilegible", async () => {
    // Caer a `date` cuando `dateIso` no parsea sería exactamente el bug que esto
    // arregla: `new Date("04/10/2026")` **sí** parsea, y a abril. Así que un
    // `dateIso` ilegible no se ignora en silencio sino que tumba el evento. Es la
    // regla del repo —una fuente sin fecha no entra en el registro— aplicada al
    // caso nuevo, y es una decisión: se pierde un evento antes que fecharlo en el    // mes equivocado, porque el primero no se ve y el segundo sí.
    const conIsoRoto = await aggregate([
      entry({ run: async () => [{ ...BASE, date: "04/10/2026", dateIso: "tampoco-es-fecha" }] }),
    ]);
    expect(conIsoRoto).toHaveLength(0);

    // Y el caso del otro lado: un campo opcional vacío no puede tirar abajo una
    // fecha buena, así que `dateIso: ""` cae a `date` y el evento entra.
    const conIsoVacio = await aggregate([
      entry({ run: async () => [{ ...BASE, dateIso: "" }] }),
    ]);
    expect(conIsoVacio).toHaveLength(1);
    expect(conIsoVacio[0].date).toBe(BASE.date);
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

  it("descarta el cancelado que solo viene en el título", async () => {
    // Dos fuentes no rellenan `cancelled` y escriben el aviso dentro del título.
    // Es el caso que se coló en el carrusel del 23 de octubre de 2026: una visita
    // guiada cancelada salió como uno de «los diez planes» del día.
    const evs = await aggregate([
      entry({
        run: async () => [
          BASE,
          {
            ...BASE,
            title: "Visita guiada: Palacio de Villa Suso. Cancelada",
            link: "https://e/cancelada",
          },
        ],
      }),
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

describe("dedupe por título normalizado", () => {
  // Las fuentes escriben el mismo plan con comillas, dos puntos, apóstrofos y
  // acentos distintos. Medido el 5 de noviembre de 2026: 33 parejas del mismo
  // día tenían el título igual tras normalizar y distinto en crudo, y todas eran
  // duplicados de verdad. Se colaban por las dos puertas a la vez, porque la
  // clave exacta comparaba el texto crudo y la pasada por contención no funde
  // dos títulos que ya son iguales.
  const DIA = "2027-03-15T20:00:00.000Z";

  it("funde el mismo título con y sin comillas de apertura", async () => {
    // El caso real: `"RESISTENCIA EN LA RESIDENCIA` (una comilla sin cerrar, en
    // mayúsculas) y `Resistencia en la Residencia`.
    const evs = await aggregate([
      entry({
        id: "municipal",
        priority: 0,
        run: async () => [
          {
            ...BASE,
            title: '"RESISTENCIA EN LA RESIDENCIA',
            date: DIA,
            time: "16:30",
            location: "Centro Cívico Iparralde",
          },
        ],
      }),
      entry({
        id: "agregadora",
        priority: 4,
        run: async () => [
          {
            ...BASE,
            title: "Resistencia en la Residencia",
            date: DIA,
            location: "Centro Cívico Iparralde",
            link: "https://example.com/otra",
          },
        ],
      }),
    ]);

    expect(evs).toHaveLength(1);
  });

  it("funde el mismo título con apóstrofo tipográfico y con apóstrofo recto", async () => {
    const evs = await aggregate([
      entry({
        id: "municipal",
        priority: 0,
        run: async () => [{ ...BASE, title: "Thursday's", date: DIA, time: "20:00" }],
      }),
      entry({
        id: "agregadora",
        priority: 4,
        run: async () => [
          { ...BASE, title: "Thursday’s", date: DIA, time: "20:00", link: "https://example.com/otra" },
        ],
      }),
    ]);

    expect(evs).toHaveLength(1);
  });

  it("no funde dos títulos normalizados distintos el mismo día", async () => {
    // La normalización no puede comerse palabras: dos planes del mismo día en el
    // mismo recinto siguen siendo dos.
    const evs = await aggregate([
      entry({
        id: "municipal",
        priority: 0,
        run: async () => [{ ...BASE, title: "Concierto de prueba", date: DIA, time: "20:00" }],
      }),
      entry({
        id: "agregadora",
        priority: 4,
        run: async () => [
          {
            ...BASE,
            title: "Concierto de prueba (segunda sesión)",
            date: DIA,
            time: "22:00",
            link: "https://example.com/otra",
          },
        ],
      }),
    ]);

    expect(evs).toHaveLength(2);
  });
});

describe("dedupe por contención", () => {
  // La primera pasada casa por título exacto. Estas parejas son el caso que se
  // colaba: el mismo plan con el título de la fuente y el título del ciclo, así
  // que el carrusel y el boletín lo publicaban dos veces. La regla se midió sobre
  // 2010 eventos el 4 de noviembre de 2026 y está escrita en
  // `fusionarDuplicadosPorContencion`.
  const DIA = "2027-03-15T20:00:00.000Z";

  function par(
    largo: string,
    corto: string,
    over: { largo?: Record<string, string | undefined>; corto?: Record<string, string | undefined> } = {}
  ) {
    return [
      entry({
        id: "municipal",
        priority: 0,
        run: async () => [
          {
            ...BASE,
            title: largo,
            date: DIA,
            time: "19:30",
            location: "Palacio Europa",
            ...over.largo,
          },
        ],
      }),
      entry({
        id: "agregadora",
        priority: 4,
        run: async () => [
          {
            ...BASE,
            title: corto,
            date: DIA,
            time: "19:30",
            location: "Palacio Europa",
            link: "https://example.com/otra",
            ...over.corto,
          },
        ],
      }),
    ];
  }

  it("funde el título del ciclo con el título del plan", async () => {
    const evs = await aggregate(
      par(
        "Banda Municipal de Música de Vitoria-Gasteiz 2026-2027: El tiempo de los mitos",
        "El tiempo de los mitos"
      )
    );

    expect(evs).toHaveLength(1);
    expect(evs[0].title).toBe(
      "Banda Municipal de Música de Vitoria-Gasteiz 2026-2027: El tiempo de los mitos"
    );
  });

  it("funde un título corto dentro del largo", async () => {
    const evs = await aggregate(
      par(
        "Festival Internacional de Teatro de Vitoria-Gasteiz 2026: Deserto",
        "Deserto",
        { largo: { location: "Teatro Principal" }, corto: { location: "Teatro Principal" } }
      )
    );

    expect(evs).toHaveLength(1);
  });

  it("no funde dos días distintos", async () => {
    const evs = await aggregate(
      par("El tiempo de los mitos en concierto", "El tiempo de los mitos", {
        corto: { date: "2027-03-16T20:00:00.000Z" },
      })
    );

    expect(evs).toHaveLength(2);
  });

  it("no funde dos horas distintas del mismo día", async () => {
    // La hora es la señal de que dos fichas son el mismo pase. Sin ella, una
    // exposición de mes entero se fundiría con cualquier cosa del día.
    const evs = await aggregate(
      par("El tiempo de los mitos en concierto", "El tiempo de los mitos", {
        corto: { time: "21:00" },
      })
    );

    expect(evs).toHaveLength(2);
  });

  it("no funde dos recintos distintos", async () => {
    const evs = await aggregate(
      par("El tiempo de los mitos en concierto", "El tiempo de los mitos", {
        largo: { location: "Palacio Europa" },
        corto: { location: "Teatro Principal" },
      })
    );

    expect(evs).toHaveLength(2);
  });

  it("no funde cuando el título corto no es un nombre", async () => {
    // Cuatro letras son una etiqueta, no un plan: `Jazz` está dentro de `Jazz en
    // la plaza` como palabra y no por eso son el mismo concierto.
    const evs = await aggregate(
      par("Jazz en la plaza", "Jazz", {
        largo: { location: "Plaza de la Virgen Blanca" },
        corto: { location: "Plaza de la Virgen Blanca" },
      })
    );

    expect(evs).toHaveLength(2);
  });

  it("no funde dos centros cívicos que solo comparten las palabras genéricas", async () => {
    // `Centro Cívico Lakua` y `Centro Cívico Hegoalde` comparten dos tokens, y los
    // dos son genéricos. Lo que los distingue es justo el que no lo es.
    const evs = await aggregate(
      par("Taller de cerámica para familias", "Taller de cerámica", {
        largo: { location: "Centro Cívico Lakua" },
        corto: { location: "Centro Cívico Hegoalde" },
      })
    );

    expect(evs).toHaveLength(2);
  });

  it("no funde la exposición con la visita guiada a esa exposición", async () => {
    // Es el único caso medido en el que todas las señales —día, hora, recinto y
    // casi todo el título— dicen que son el mismo plan y no lo son.
    const evs = await aggregate(
      par(
        'Exposición: "1976-M3-2026: Recordar y Contar"',
        'Visita guiada a la exposición: "1976-M3-2026: Recordar y Contar"',
        {
          largo: { location: "Museo de Bellas Artes", time: "18:30" },
          corto: { location: "Museo de Bellas Artes", time: "18:30" },
        }
      )
    );

    expect(evs).toHaveLength(2);
  });

  it("sí funde dos visitas guiadas publicadas por fuentes distintas", async () => {
    // La etiqueta solo separa cuando la lleva una de las dos. Si la llevan las dos,
    // son dos fuentes contando la misma visita.
    const evs = await aggregate(
      par(
        "Visita guiada: Recordar y Contar, una mirada a 1976",
        "Visita guiada: Recordar y Contar",
        {
          largo: { location: "Museo de Bellas Artes", time: "18:30" },
          corto: { location: "Museo de Bellas Artes", time: "18:30" },
        }
      )
    );

    expect(evs).toHaveLength(1);
  });

  it("no funde nada sin hora", async () => {
    const evs = await aggregate(
      par("El tiempo de los mitos en concierto", "El tiempo de los mitos", {
        largo: { time: undefined },
        corto: { time: undefined },
      })
    );

    expect(evs).toHaveLength(2);
  });

  it("funde cuando solo una de las dos trae hora", async () => {
    // Medido el 5 de noviembre de 2026: `MUERDO (Urban Rock Concept)` a las 20:00
    // y `Muerdo` sin hora son el mismo concierto, y sin esta rama salían los dos
    // en el carrusel y en el boletín. Que una fuente no publique la hora no es
    // señal de dos pases; que las dos publiquen horas distintas sí.
    const evs = await aggregate(
      par("MUERDO (Urban Rock Concept)", "Muerdo", {
        largo: { time: "20:00" },
        corto: { time: undefined },
      })
    );

    expect(evs).toHaveLength(1);
  });

  it("no funde la segunda función cuando el título lo dice", async () => {
    // El único caso medido en el que «una trae hora y la otra no» se equivoca.
    // Medido el 5 de noviembre de 2026 sobre 1731 eventos, la única pareja que la
    // rama nueva fundía y no debía era esta: `2ª FUNCIÓN` es un pase distinto del
    // mismo día, y la segunda ficha simplemente no trae hora. Es la misma forma
    // que la visita guiada: todas las demás señales dicen «el mismo plan» y una
    // etiqueta en el título dice que no.
    const evs = await aggregate(
      par(
        'DREAMING BUBBLES, "El Show de Burbujas Mágicas" 2ª FUNCIÓN',
        'DREAMING BUBBLES, "El Show de Burbujas Mágicas"',
        {
          largo: { time: undefined, location: "Teatro Jesús Ibáñez de Matauco" },
          corto: { time: "12:30", location: "Teatro Jesús Ibáñez de Matauco" },
        }
      )
    );

    expect(evs).toHaveLength(2);
  });

  it("sí funde dos segundas funciones publicadas por fuentes distintas", async () => {
    // La etiqueta solo separa cuando la lleva una de las dos. Si la llevan las dos,
    // son dos fuentes contando la misma segunda función, igual que con la visita
    // guiada.
    const evs = await aggregate(
      par(
        'DREAMING BUBBLES, "El Show de Burbujas Mágicas" 2ª FUNCIÓN',
        "El Show de Burbujas Mágicas 2ª FUNCIÓN",
        {
          largo: { time: undefined, location: "Teatro Jesús Ibáñez de Matauco" },
          corto: { time: "12:30", location: "Teatro Jesús Ibáñez de Matauco" },
        }
      )
    );

    expect(evs).toHaveLength(1);
  });

  it("no funde un evento de varios días con uno de un solo día", async () => {
    // Una exposición que dura un mes comparte día con cualquier cosa que caiga
    // dentro, así que el `dateEnd` que la delata tiene que impedir la fusión
    // aunque el título se solape y una de las dos traiga hora.
    const evs = await aggregate(
      par("Exposición: Recordar y Contar", "Recordar y Contar", {
        largo: { dateEnd: "2027-04-20T20:00:00.000Z" },
        corto: { time: undefined },
      })
    );

    expect(evs).toHaveLength(2);
  });

  it("hereda la hora del perdedor cuando el ganador no la trae", async () => {
    // El ganador es el primero por prioridad del registro, y si es justo el que
    // no publica la hora, quedarse sin ella sería perder el único dato que decía
    // cuándo es el plan.
    const [ev] = await aggregate(
      par("El tiempo de los mitos en concierto", "El tiempo de los mitos", {
        largo: { time: undefined },
        corto: { time: "19:30" },
      })
    );

    expect(ev.title).toBe("El tiempo de los mitos en concierto");
    expect(ev.time).toBe("19:30");
  });

  it("hereda la imagen del perdedor y suma la corroboración", async () => {
    const [ev] = await aggregate(
      par("El tiempo de los mitos en concierto", "El tiempo de los mitos", {
        corto: { image: "https://cdn.example.com/cartel.jpg" },
      })
    );

    expect(ev.image).toBe("https://cdn.example.com/cartel.jpg");
    expect(ev.corrobora).toBe(2);
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
 *
 * **Las municipales llegaron después y con el mismo número, y el motivo es del mismo
 * tipo pero no del mismo peso**: allí el coste no son 6,5 MB por petición, son hasta
 * trece peticiones por arranque. El TTL es el mismo porque la respuesta a "cada cuánto
 * puede esta fuente cambiar" también lo es: las dos cambian a ritmo de día.
 */
describe("el TTL propio está solo donde está medido", () => {
  const DOS_HORAS = 2 * 60 * 60 * 1000;

  it("La Genterula declara dos horas", () => {
    const rula = SOURCE_REGISTRY.find((e) => e.id === "rula");
    expect(rula?.cacheTtlMs).toBe(DOS_HORAS);
  });

  it("las diecisiete entradas que van al servlet municipal declaran dos horas", () => {
    // La lista sale del registro por lo que la cubre, no por enumerarla aquí: si
    // mañana hay dieciocho municipales que paginan, esta aserción tiene que cambiar
    // sola y ser `source-registry.test.ts` la que eche de menos a la que se cuele
    // sin TTL. Escribir los ids aquí sería una segunda lista mantenida a mano, y las
    // listas mantenidas a mano son las que dejan de cuadrar sin que nadie lo vea.
    const alServlet = SOURCE_REGISTRY.filter(
      (e) => e.group === "municipal" && e.id !== "municipal-rss"
    );
    expect(alServlet.length).toBe(17);
    for (const e of alServlet) expect(e.cacheTtlMs).toBe(DOS_HORAS);
  });

  it("ninguna otra fuente declara TTL propio", () => {
    const conTtl = SOURCE_REGISTRY.filter((e) => e.cacheTtlMs !== undefined).map((e) => e.id);
    const esperadas = [
      "municipal-agenda",
      "municipal-teatro",
      "municipal-teatros",
      "municipal-conciertos",
      "municipal-exposiciones",
      "municipal-general",
      "municipal-deporte",
      "municipal-charlas",
      "municipal-talleres",
      "municipal-danza",
      "municipal-cine",
      "municipal-fiestas",
      "municipal-concursos",
      "municipal-mercados",
      "municipal-presentaciones",
      "municipal-infantil",
      "municipal-visitas",
      "rula",
    ];
    // Se ordenan los dos lados porque el orden de `conTtl` es el de `SOURCE_REGISTRY`,
    // y este cambia cada vez que alguien mueve una entrada. Lo que ata el test es el
    // conjunto, que es lo que se decide: qué fuentes pesan lo bastante para tener capa.
    expect([...conTtl].sort()).toEqual([...esperadas].sort());
  });
});

describe("invariante: toda tarjeta tiene detalle", () => {
  it("cada evento de cada entrada del registro resuelve por su slug", async () => {
    const evs = await aggregate(
      SOURCE_REGISTRY.map((e) => ({
        ...e,
        // **`cacheTtlMs: undefined` a propósito.** `aggregate` envuelve en
        // `getCachedOrFetch` las entradas que declaran TTL propio, y hoy solo hay una:
        // `rula`, con dos horas. Sin esta línea, el `run` de mentira se sustituye por
        // lo que haya en el fichero `source:rula` de `tmpdir()` —y si alguien ha
        // arrancado `npm run dev` antes de la suite, ahí están los 500 eventos de
        // verdad que La Genterula devuelve, y el recuento da 521 en vez de 29.
        //
        // O sea que el resultado de la suite dependía de si la máquina había tenido un
        // dev server encendido, y el fallo se lee como un bug del agregador. La
        // lectura de disco es lo correcto en producción y lo que hay que anular aquí.
        cacheTtlMs: undefined,
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
