import { loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
import { scrapeVamEvents } from "@/lib/sources/vam";

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
});