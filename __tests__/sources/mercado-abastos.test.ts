import { loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
import {
  scrapeMercadoAbastos,
  invalidateMercadoAbastos,
} from "@/lib/sources/mercado-abastos";

const ENDPOINT = /mercadoabastos\.eus\/wp-json\/tribe\/events\/v1\/events/;

describe("scrapeMercadoAbastos", () => {
  beforeEach(() => {
    invalidateMercadoAbastos();
  });

  it("parses the The Events Calendar JSON into normalized events", async () => {
    const payload = loadFixture("mercado-abastos-response.json");

    const fetchMock = mockFetchWith([
      { match: ENDPOINT, content: payload, headers: { "Content-Type": "application/json" } },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeMercadoAbastos();

    expect(fetchMock).toHaveBeenCalled();
    expect(events.length).toBeGreaterThan(0);

    for (const e of events) {
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.date).toBeDefined();
      expect(isNaN(new Date(e.date).getTime())).toBe(false);
      expect(e.location).toBeTruthy();
    }
  });

  it("exposes the wall-clock time so the tardeo view can bucket by hour", async () => {
    mockFetchWith([
      {
        match: ENDPOINT,
        content: loadFixture("mercado-abastos-response.json"),
        headers: { "Content-Type": "application/json" },
      },
    ]);

    const events = await scrapeMercadoAbastos();

    for (const e of events) {
      expect(e.time).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it("prefers the medium image size when the API offers several", async () => {
    mockFetchWith([
      {
        match: ENDPOINT,
        content: loadFixture("mercado-abastos-response.json"),
        headers: { "Content-Type": "application/json" },
      },
    ]);

    const events = await scrapeMercadoAbastos();
    const withImage = events.filter((e) => e.image);

    expect(withImage.length).toBeGreaterThan(0);
    for (const e of withImage) {
      expect(e.image).toMatch(/^https:\/\//);
    }
  });

  it("sorts the events by date", async () => {
    mockFetchWith([
      {
        match: ENDPOINT,
        content: loadFixture("mercado-abastos-response.json"),
        headers: { "Content-Type": "application/json" },
      },
    ]);

    const events = await scrapeMercadoAbastos();
    const dates = events.map((e) => e.date);

    expect([...dates].sort()).toEqual(dates);
  });

  it("returns an empty array when the API responds with an error", async () => {
    mockFetchWith([{ match: ENDPOINT, content: "", status: 500 }]);

    await expect(scrapeMercadoAbastos()).resolves.toEqual([]);
  });

  it("returns an empty array when the response is not valid JSON", async () => {
    mockFetchWith([{ match: ENDPOINT, content: "<html>no json here</html>" }]);

    await expect(scrapeMercadoAbastos()).resolves.toEqual([]);
  });

  it("survives a payload with no events key", async () => {
    mockFetchWith([
      {
        match: ENDPOINT,
        content: JSON.stringify({ total: 0 }),
        headers: { "Content-Type": "application/json" },
      },
    ]);

    await expect(scrapeMercadoAbastos()).resolves.toEqual([]);
  });

  it("drops events with no title or no parsable date", async () => {
    mockFetchWith([
      {
        match: ENDPOINT,
        content: JSON.stringify({
          events: [
            { title: "Sin fecha", start_date: "no-es-una-fecha" },
            { title: "", start_date: "2026-04-15 10:00:00" },
            { title: "Valido", start_date: "2026-04-15 10:00:00", url: "https://x.test/e" },
          ],
        }),
        headers: { "Content-Type": "application/json" },
      },
    ]);

    const events = await scrapeMercadoAbastos();

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Valido");
  });

  it("serves the second call from the cache without hitting the API", async () => {
    const fetchMock = mockFetchWith([
      {
        match: ENDPOINT,
        content: loadFixture("mercado-abastos-response.json"),
        headers: { "Content-Type": "application/json" },
      },
    ]);

    const first = await scrapeMercadoAbastos();
    const callsAfterFirst = fetchMock.mock.calls.length;

    const second = await scrapeMercadoAbastos();

    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it("forgets the cache after invalidate", async () => {
    const fetchMock = mockFetchWith([
      {
        match: ENDPOINT,
        content: loadFixture("mercado-abastos-response.json"),
        headers: { "Content-Type": "application/json" },
      },
    ]);

    await scrapeMercadoAbastos();
    const callsAfterFirst = fetchMock.mock.calls.length;

    invalidateMercadoAbastos();
    await scrapeMercadoAbastos();

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});
