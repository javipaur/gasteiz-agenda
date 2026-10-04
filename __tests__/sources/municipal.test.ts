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

  it("el calendario 392 sale con su calendariosID en la URL", async () => {
    // El 392 es la red de teatros de los centros cívicos y no aparece en el
    // `tipo: [13]` de arriba. Lo que ata la entrada `municipal-teatros` del registro
    // es **la URL**, no el resultado: si alguien cambia el id y el calendario
    // empieza a devolver la agenda general, la prueba seguiría viendo "eventos" y
    // no fallaría. Mirando el id que se pidió, sí.
    //
    // Medido contra el sitio el 4 de octubre de 2026: 46 eventos en los doce meses
    // siguientes, convenues en el Félix Petite (23), Matauco (15), Lorca (2), Aldabe
    // (2) y el Palacio de Congresos (1). De ellos, 36 no salen en la página 1 del
    // calendario 196.
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
    ]);

    await scrapeMunicipalCalendar({ calendariosID: 392 });

    const llamada = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(llamada).toContain("calendariosID=392");
    expect(llamada).toContain("accion=buscar");
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