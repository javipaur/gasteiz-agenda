import { espiaErrores, loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
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

  it("propaga el fallo cuando la API devuelve error", async () => {
    mockFetchWith([
      { match: /app\.vamcultura\.es/, content: "", status: 500 },
    ]);
    const errorSpy = espiaErrores();

    await expect(scrapeVamEvents()).rejects.toThrow(/vam/i);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("includes events whose city is spelled 'Vitoria'", async () => {
    const json = JSON.stringify({
      events: [
        {
          id: "1",
          title: "Magufada",
          city: "Vitoria",
          category: "Concierto / MÃºsica",
          date_start: "2026-09-25T21:00:00+02:00",
          image_url: "",
          source_url: "#",
        },
        {
          id: "2",
          title: "No vitoriano",
          city: "Bilbao",
          category: "Concierto / MÃºsica",
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
    // Antes caÃ­a en `new Date()`, o sea el dÃ­a del scrape. Un evento asÃ­ salÃ­a hoy
    // en la agenda y se evaporaba en la siguiente pasada de la cachÃ© de 5 minutos,
    // con un dÃ­a que ademÃ¡s se colaba en el slug. La norma del repo es "una fuente
    // sin fecha no entra en el registro" â€”la misma que sacÃ³ a Civitatis y Koraâ€” y
    // `helldorado.ts:115` la aplica con el mismo patrÃ³n desde hace tiempo.
    //
    // El filtro estÃ¡ en el scraper y no solo en `normalizeRaw` porque aquÃ­ el orden
    // se calcula con `new Date(a.date)` y una fecha vacÃ­a da `NaN`, que no ordena.
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
    // VAM publica `price_raw` en 125 de los 200 eventos del catÃ¡logo y
    // `is_free` en 71, y el scraper se los deja fuera. "Precio no disponible" es
    // la fuente diciendo que no lo sabe, no un precio: si se pasa tal cual, la
    // tarjeta pinta un precio que no existe, que es peor que no pintar ninguno.
    const json = JSON.stringify({
      events: [
        { id: "1", title: "Con precio", city: "Vitoria", category: "Teatro",
          date_start: "2026-09-25T21:00:00+02:00", price_raw: "12 / 18 â‚¬", image_url: "", source_url: "#" },
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
    expect(porTitulo["Con precio"]).toBe("12 / 18 â‚¬");
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
            category: "Concierto / MÃºsica",
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
            title: "Concierto bilbaÃ­no",
            city: "Bilbao",
            category: "Concierto / MÃºsica",
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
