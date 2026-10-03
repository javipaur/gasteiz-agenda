import { loadFixture, mockFetchWith } from "../helpers";
import { scrapeMunicipalCalendar } from "@/lib/sources/municipal";

describe("scrapeMunicipalCalendar", () => {
  it("parses the CalendarioServlet JSON response", async () => {
    const json = loadFixture("municipal-response.json");

    const fetchMock = mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: json },
    ]);

    const events = await scrapeMunicipalCalendar();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    for (const e of events) {
      expect(typeof e.title).toBe("string");
      expect(typeof e.date).toBe("string");
      expect(typeof e.link).toBe("string");
    }
  });

  it("maps extra fields (time, dateEnd, cancelled, audience)", async () => {
    const json = loadFixture("municipal-response.json");

    mockFetchWith([{ match: /vitoria-gasteiz\.org/, content: json }]);

    const events = await scrapeMunicipalCalendar();
    const e = events[0];

    expect(e).toMatchObject({
      title: 'Exposición: "Tierra y Cielo"',
      date: "2026-09-16T06:30Z",
      time: "08:30",
      dateEnd: "2026-09-16",
    });
    expect(e.cancelled).toBeUndefined();
    expect(e.description).toBeUndefined();
  });

  it("maps cancelled events and non-generic audiences", async () => {
    const json = loadFixture("municipal-response.json").replace(
      '"Tierra y Cielo"',
      '"Otra Expo"'
    );
    const custom = json.replace(
      '"isCancelado":false',
      '"isCancelado":true'
    ).replace(
      '"destinatario":"Todos los públicos",',
      '"destinatario":"Público infantil",'
    );

    mockFetchWith([{ match: /vitoria-gasteiz\.org/, content: custom }]);

    const events = await scrapeMunicipalCalendar();
    const e = events[0];

    expect(e.cancelled).toBe(true);
    expect(e.description).toBe("Público infantil");
  });

  it("transforms smart image URLs", async () => {
    const json = loadFixture("municipal-response.json");

    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: json },
    ]);

    const events = await scrapeMunicipalCalendar();
    for (const e of events) {
      if (e.image) {
        expect(e.image.startsWith("https://www.vitoria-gasteiz.org")).toBe(true);
      }
    }
  });

  it("propaga el fallo HTTP en vez de devolver una lista vacía", async () => {
    // Devolver `[]` es indistinguible de "hoy no hay nada", y esta es la fuente
    // de `priority: 0`, la que gana todos los dedupes: un 502 del Ayuntamiento
    // vaciaba la agenda municipal entera con HTTP 200 y sin una sola línea de
    // log, porque `agenda.ts` solo registra `scraping_failed` en las promesas que
    // **rechazan**. Por eso propaga, igual que `scrapeBuscametasInscripciones`.
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: "", status: 502 },
    ]);

    await expect(scrapeMunicipalCalendar()).rejects.toThrow(/502/);
  });

  it("el estado del fallo viaja en el mensaje, no solo el texto", async () => {
    // `agenda.ts:107` loguea `result.reason.message`. Sin el estado, un 502 y un
    // 404 salen igual en el panel y no hay forma de saber si es caída del
    // Ayuntamiento o un cambio de URL.
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: "", status: 404 },
    ]);

    await expect(scrapeMunicipalCalendar()).rejects.toThrow(/404/);
  });
});