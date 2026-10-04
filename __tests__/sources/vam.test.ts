import { loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
import { scrapeVamEvents, scrapeVamConciertos } from "@/lib/sources/vam";

describe("scrapeVamEvents", () => {
  it("parses VAM API JSON and filters Vitoria-Gasteiz events", async () => {
    const json = loadFixture("vam-response.json");

    const fetchMock = mockFetchWith([
      { match: /app\.vamcultura\.es/, content: json },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeVamEvents();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    for (const e of events) {
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(typeof e.date).toBe("string");
      expect(typeof e.link).toBe("string");
      expect(e.source).toBe("vam");
      expect(typeof e.category).toBe("string");
    }
  });

  it("assigns DEFAULT_EVENT_IMAGE to events with no image", async () => {
    const json = loadFixture("vam-response.json");

    mockFetchWith([
      { match: /app\.vamcultura\.es/, content: json },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeVamEvents();
    for (const e of events) {
      expect(typeof e.image).toBe("string");
      expect(e.image!.length).toBeGreaterThan(0);
    }
  });

  it("returns an empty array when the API returns an error", async () => {
    mockFetchWith([
      { match: /app\.vamcultura\.es/, content: "", status: 500 },
    ]);

    const events = await scrapeVamEvents();
    expect(events).toEqual([]);
  });

  it("includes events whose city is spelled 'Vitoria'", async () => {
    const json = JSON.stringify({
      events: [
        {
          id: "1",
          title: "Magufada",
          city: "Vitoria",
          category: "Concierto / Música",
          date_start: "2026-09-25T21:00:00+02:00",
          image_url: "",
          source_url: "#",
        },
        {
          id: "2",
          title: "No vitoriano",
          city: "Bilbao",
          category: "Concierto / Música",
          date_start: "2026-09-25T21:00:00+02:00",
          image_url: "",
          source_url: "#",
        },
      ],
    });

    mockFetchWith([
      { match: /app\.vamcultura\.es/, content: json },
    ]);

    const events = await scrapeVamEvents();
    expect(events.map((e) => e.title)).toEqual(["Magufada"]);
  });

  it("no inventa una fecha cuando el evento no la trae", async () => {
    // Antes caía en `new Date()`, o sea el día del scrape. Un evento así salía hoy
    // en la agenda y se evaporaba en la siguiente pasada de la caché de 5 minutos,
    // con un día que además se colaba en el slug. La norma del repo es "una fuente
    // sin fecha no entra en el registro" —la misma que sacó a Civitatis y Kora— y
    // `helldorado.ts:115` la aplica con el mismo patrón desde hace tiempo.
    //
    // El filtro está en el scraper y no solo en `normalizeRaw` porque aquí el orden
    // se calcula con `new Date(a.date)` y una fecha vacía da `NaN`, que no ordena.
    const json = JSON.stringify({
      events: [
        {
          id: "1",
          title: "Con fecha",
          city: "Vitoria",
          category: "Teatro",
          date_start: "2026-09-25T21:00:00+02:00",
          image_url: "",
          source_url: "#",
        },
        {
          id: "2",
          title: "Sin fecha",
          city: "Vitoria",
          category: "Teatro",
          image_url: "",
          source_url: "#",
        },
      ],
    });

    mockFetchWith([{ match: /app\.vamcultura\.es/, content: json }]);

    const events = await scrapeVamEvents();
    expect(events.map((e) => e.title)).toEqual(["Con fecha"]);
  });

  it("mapea el precio que publica VAM y no inventa uno donde no lo hay", async () => {
    // VAM publica `price_raw` en 125 de los 200 eventos del catálogo y
    // `is_free` en 71, y el scraper se los deja fuera. "Precio no disponible" es
    // la fuente diciendo que no lo sabe, no un precio: si se pasa tal cual, la
    // tarjeta pinta un precio que no existe, que es peor que no pintar ninguno.
    const json = JSON.stringify({
      events: [
        { id: "1", title: "Con precio", city: "Vitoria", category: "Teatro",
          date_start: "2026-09-25T21:00:00+02:00", price_raw: "12 / 18 €", image_url: "", source_url: "#" },
        { id: "2", title: "Gratis", city: "Vitoria", category: "Charla / Coloquio",
          date_start: "2026-09-26T19:00:00+02:00", price_raw: "Gratis", image_url: "", source_url: "#" },
        { id: "3", title: "Desconocido", city: "Vitoria", category: "Teatro",
          date_start: "2026-09-27T19:00:00+02:00", price_raw: "Precio no disponible", image_url: "", source_url: "#" },
        { id: "4", title: "Sin campo", city: "Vitoria", category: "Teatro",
          date_start: "2026-09-28T19:00:00+02:00", image_url: "", source_url: "#" },
      ],
    });

    mockFetchWith([{ match: /app\.vamcultura\.es/, content: json }]);

    const events = await scrapeVamEvents();
    const porTitulo = Object.fromEntries(events.map((e) => [e.title, e.price]));
    expect(porTitulo["Con precio"]).toBe("12 / 18 €");
    expect(porTitulo["Gratis"]).toBe("Gratis");
    expect(porTitulo["Desconocido"]).toBeUndefined();
    expect(porTitulo["Sin campo"]).toBeUndefined();
  });

  describe("scrapeVamConciertos", () => {
    it("finds Vitoria concerts and ignores other cities/categories", async () => {
      const json = JSON.stringify({
        events: [
          {
            id: "1",
            title: "Magufada",
            city: "Vitoria",
            category: "Concierto / Música",
            date_start: "2026-09-25T21:00:00+02:00",
            image_url: "",
            source_url: "#",
          },
          {
            id: "2",
            title: "Charla vitoriana",
            city: "Vitoria-Gasteiz",
            category: "Conferencia",
            date_start: "2026-09-25T19:00:00+02:00",
            image_url: "",
            source_url: "#",
          },
          {
            id: "3",
            title: "Concierto bilbaíno",
            city: "Bilbao",
            category: "Concierto / Música",
            date_start: "2026-09-25T21:00:00+02:00",
            image_url: "",
            source_url: "#",
          },
        ],
      });

      mockFetchWith([
        { match: /app\.vamcultura\.es/, content: json },
      ]);

      const events = await scrapeVamConciertos();
      expect(events.map((e) => e.title)).toEqual(["Magufada"]);
    });
  });
});