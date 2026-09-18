import { loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
import { scrapeHelldorado } from "@/lib/sources/helldorado";

describe("scrapeHelldorado", () => {
  it("parses future events from the WordPress REST API", async () => {
    const listJson = loadFixture("helldorado-future.json");
    const detailHtml = loadFixture("helldorado-detail.html");

    const fetchMock = mockFetchWith([
      { match: /helldorado\.net\/wp-json/, content: listJson },
      { match: /helldorado\.net\/evento\//, content: detailHtml },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeHelldorado();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    for (const e of events) {
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(typeof e.date).toBe("string");
      expect(e.date.length).toBeGreaterThan(0);
      expect(typeof e.location).toBe("string");
    }
  });

  it("parses the real captured list (past events are filtered out)", async () => {
    const realList = loadFixture("helldorado-response.json");

    mockFetchWith([
      { match: /helldorado\.net\/wp-json/, content: realList },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeHelldorado();
    expect(Array.isArray(events)).toBe(true);
  });

  it("returns an empty array when the API is unreachable", async () => {
    mockFetchWith([
      { match: /helldorado\.net/, content: "", status: 500 },
    ]);

    const events = await scrapeHelldorado();
    expect(events).toEqual([]);
  });
});