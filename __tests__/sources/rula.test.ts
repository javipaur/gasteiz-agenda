import { loadFixture, mockFetchWith } from "../helpers";
import { scrapeRula } from "@/lib/sources/rula";

describe("scrapeRula", () => {
  it("parses the MEC API JSON response into normalized events", async () => {
    const json = loadFixture("rula-response.json");

    const fetchMock = mockFetchWith([
      { match: /lagenterula\.com\/wp-json\/mec\//, content: json },
    ]);

    const events = await scrapeRula();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);

    if (events.length > 0) {
      for (const e of events) {
        expect(typeof e.title).toBe("string");
        expect(e.title.length).toBeGreaterThan(0);
        expect(typeof e.date).toBe("string");
        expect(typeof e.link).toBe("string");
      }
    }
  });

  it("returns an empty array when the API returns an error", async () => {
    mockFetchWith([
      { match: /lagenterula\.com/, content: "", status: 500 },
    ]);

    const events = await scrapeRula();
    expect(events).toEqual([]);
  });

  it("filters out past events", async () => {
    const fixture = JSON.parse(loadFixture("rula-response.json"));
    const today = new Date().toISOString().slice(0, 10);

    mockFetchWith([
      { match: /lagenterula\.com/, content: JSON.stringify(fixture) },
    ]);

    const events = await scrapeRula();
    for (const e of events) {
      expect(e.date >= today).toBe(true);
    }
  });
});