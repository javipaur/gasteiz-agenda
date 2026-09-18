import { loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
import { scrapeJimmyJazz } from "@/lib/sources/jimmyjazz";

describe("scrapeJimmyJazz", () => {
  it("parses ticket items from the Jimmy Jazz HTML", async () => {
    const html = loadFixture("jimmyjazz-listing.html");

    const fetchMock = mockFetchWith([
      { match: /jimmyjazzgasteiz\.com/, content: html },
    ]);

    const events = await scrapeJimmyJazz();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    for (const e of events) {
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(typeof e.date).toBe("string");
      expect(typeof e.location).toBe("string");
    }
  });

  it("returns an empty array when the fetch fails", async () => {
    mockFetchWith([
      { match: /jimmyjazzgasteiz\.com/, content: "", status: 500 },
    ]);

    const events = await scrapeJimmyJazz();
    expect(events).toEqual([]);
  });

  it("is resilient to HTML with no ticket items", async () => {
    mockFetchWith([
      { match: /.*/, content: "<html><body><p>sin eventos</p></body></html>" },
    ]);

    const events = await scrapeJimmyJazz();
    expect(events).toEqual([]);
  });
});