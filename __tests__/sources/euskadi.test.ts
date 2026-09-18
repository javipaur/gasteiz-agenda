import { loadFixture, mockFetchWith } from "../helpers";
import { scrapeEuskadi } from "@/lib/sources/euskadi";

describe("scrapeEuskadi", () => {
  it("parses the Euskadi API JSON response", async () => {
    const json = loadFixture("euskadi-response.json");

    const fetchMock = mockFetchWith([
      { match: /api\.euskadi\.eus/, content: json },
    ]);

    const events = await scrapeEuskadi();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBe(20);

    for (const e of events) {
      expect(typeof e.title).toBe("string");
      expect(typeof e.date).toBe("string");
      expect(typeof e.source).toBe("string");
      expect(typeof e.category).toBe("string");
    }
  });

  it("returns an empty array when the API returns an error", async () => {
    mockFetchWith([
      { match: /api\.euskadi\.eus/, content: "", status: 500 },
    ]);

    const events = await scrapeEuskadi();
    expect(events).toEqual([]);
  });

  it("returns an empty array when the response has no items", async () => {
    mockFetchWith([
      { match: /api\.euskadi\.eus/, content: JSON.stringify({ items: [] }) },
    ]);

    const events = await scrapeEuskadi();
    expect(events).toEqual([]);
  });
});