import { loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
import { scrapeGasteizHoy } from "@/lib/sources/gasteizhoy";

const BASE_URL = "https://www.gasteizhoy.com/ociogasteiz/";

describe("scrapeGasteizHoy", () => {
  it("parses the calendar HTML into normalized events", async () => {
    const calendarHtml = loadFixture("gasteizhoy-listing.html");

    const fetchMock = mockFetchWith([
      { match: /gasteizhoy\.com\/ociogasteiz\/\?view=list/, content: calendarHtml },
      { match: /gasteizhoy\.com\/ociogasteiz\/?$/, content: calendarHtml },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeGasteizHoy();
    const today = new Date().toISOString().slice(0, 10);

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    for (const e of events) {
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.date >= today).toBe(true);
      expect(typeof e.link).toBe("string");
      expect(e.source).toBe("gasteizhoy");
    }
  });

  it("returns an empty array when the calendar fetch fails", async () => {
    mockFetchWith([
      { match: /gasteizhoy\.com/, content: "", status: 500 },
    ]);

    const events = await scrapeGasteizHoy();
    expect(events).toEqual([]);
  });

  it("is resilient to malformed HTML", async () => {
    mockFetchWith([
      { match: /.*/, content: "<html><div>no calendar here</div></html>" },
    ]);

    const events = await scrapeGasteizHoy();
    expect(Array.isArray(events)).toBe(true);
  });
});