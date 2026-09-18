import { loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
import { scrapeMusikaze } from "@/lib/sources/musikaze";

describe("scrapeMusikaze", () => {
  it("parses ticket items and filters future events", async () => {
    const html = loadFixture("musikaze-listing.html");

    const fetchMock = mockFetchWith([
      { match: /musikaze\.com/, content: html },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeMusikaze();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    const today = new Date().toISOString().slice(0, 10);
    for (const e of events) {
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.date >= today).toBe(true);
      expect(typeof e.link).toBe("string");
    }
  });

  it("returns an empty array when the fetch fails", async () => {
    mockFetchWith([
      { match: /musikaze\.com/, content: "", status: 500 },
    ]);

    const events = await scrapeMusikaze();
    expect(events).toEqual([]);
  });

  it("is resilient to HTML with no ticket items", async () => {
    mockFetchWith([
      { match: /.*/, content: "<html><body><p>sin eventos</p></body></html>" },
    ]);

    const events = await scrapeMusikaze();
    expect(events).toEqual([]);
  });
});