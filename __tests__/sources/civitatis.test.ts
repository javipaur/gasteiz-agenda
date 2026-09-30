import { loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
import { scrapeCivitatisTours, invalidateCivitatis } from "@/lib/sources/civitatis";

const LISTING = /civitatis\.com\/es\/vitoria\//;

describe("scrapeCivitatisTours", () => {
  beforeEach(() => {
    invalidateCivitatis();
  });

  it("parses the listing HTML into tours", async () => {
    const fetchMock = mockFetchWith([
      { match: LISTING, content: loadFixture("civitatis-listing.html") },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const tours = await scrapeCivitatisTours();

    expect(fetchMock).toHaveBeenCalled();
    expect(tours.length).toBeGreaterThan(0);

    for (const t of tours) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.link).toMatch(/^https:\/\//);
      expect(t.categories).toBeTruthy();
    }
  });

  it("reads the real image from data-src, not the 1px placeholder in src", async () => {
    mockFetchWith([{ match: LISTING, content: loadFixture("civitatis-listing.html") }]);

    const tours = await scrapeCivitatisTours();

    for (const t of tours) {
      expect(t.image).toMatch(/^https:\/\//);
      expect(t.image).not.toMatch(/^data:/);
    }
  });

  it("turns the Spanish decimal comma into a number", async () => {
    mockFetchWith([{ match: LISTING, content: loadFixture("civitatis-listing.html") }]);

    const tours = await scrapeCivitatisTours();
    const rated = tours.filter((t) => t.rating !== null);

    expect(rated.length).toBeGreaterThan(0);
    for (const t of rated) {
      expect(t.rating as number).toBeGreaterThan(0);
      expect(t.rating as number).toBeLessThanOrEqual(10);
    }
  });

  it("parses the review count, whose thousands separator is a dot", async () => {
    mockFetchWith([{ match: LISTING, content: loadFixture("civitatis-listing.html") }]);

    const tours = await scrapeCivitatisTours();
    const reviewed = tours.filter((t) => t.reviews !== null);

    expect(reviewed.length).toBeGreaterThan(0);
    for (const t of reviewed) {
      expect(Number.isInteger(t.reviews as number)).toBe(true);
      expect(t.reviews as number).toBeGreaterThan(0);
    }
  });

  it("keeps the price verbatim, including the Spanish format", async () => {
    mockFetchWith([{ match: LISTING, content: loadFixture("civitatis-listing.html") }]);

    const tours = await scrapeCivitatisTours();

    expect(tours.some((t) => /€|Gratis/.test(t.price))).toBe(true);
  });

  it("resolves relative links against the Civitatis origin", async () => {
    mockFetchWith([{ match: LISTING, content: loadFixture("civitatis-listing.html") }]);

    const tours = await scrapeCivitatisTours();

    for (const t of tours) {
      expect(t.link.startsWith("https://www.civitatis.com/")).toBe(true);
    }
  });

  it("returns an empty array when the request fails", async () => {
    mockFetchWith([{ match: LISTING, content: "", status: 503 }]);

    await expect(scrapeCivitatisTours()).resolves.toEqual([]);
  });

  it("is resilient to a listing without cards", async () => {
    mockFetchWith([{ match: /.*/, content: "<html><body>nada aqui</body></html>" }]);

    await expect(scrapeCivitatisTours()).resolves.toEqual([]);
  });

  it("caches the result and re-fetches after invalidate", async () => {
    const fetchMock = mockFetchWith([
      { match: LISTING, content: loadFixture("civitatis-listing.html") },
    ]);

    await scrapeCivitatisTours();
    const callsAfterFirst = fetchMock.mock.calls.length;

    await scrapeCivitatisTours();
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);

    invalidateCivitatis();
    await scrapeCivitatisTours();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});
