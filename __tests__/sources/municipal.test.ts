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

  it("returns an empty array when the API returns an error", async () => {
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: "", status: 500 },
    ]);

    const events = await scrapeMunicipalCalendar();
    expect(events).toEqual([]);
  });
});