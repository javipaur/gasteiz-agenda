import { loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
import { scrapeKoraExperiencias, invalidateKora } from "@/lib/sources/kora";

const LISTING = /koraliving\.com\/greencity\/es\/experiencias-locales/;

describe("scrapeKoraExperiencias", () => {
  beforeEach(() => {
    invalidateKora();
  });

  it("parses the experience cards into experiences", async () => {
    const fetchMock = mockFetchWith([
      { match: LISTING, content: loadFixture("kora-listing.html") },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const experiencias = await scrapeKoraExperiencias();

    expect(fetchMock).toHaveBeenCalled();
    expect(experiencias.length).toBeGreaterThan(0);

    for (const x of experiencias) {
      expect(x.name.length).toBeGreaterThan(0);
      expect(x.description.length).toBeGreaterThan(0);
      expect(x.link).toMatch(/^https:\/\/koraliving\.com\//);
    }
  });

  it("reads the real image from data-src, not the blank.png placeholder", async () => {
    mockFetchWith([{ match: LISTING, content: loadFixture("kora-listing.html") }]);

    const experiencias = await scrapeKoraExperiencias();

    for (const x of experiencias) {
      expect(x.image).toMatch(/^https:\/\//);
      expect(x.image).not.toContain("blank.png");
    }
  });

  it("picks the first URL when data-src lists several sizes", async () => {
    mockFetchWith([{ match: LISTING, content: loadFixture("kora-listing.html") }]);

    const experiencias = await scrapeKoraExperiencias();

    for (const x of experiencias) {
      expect(x.image).not.toContain(",");
    }
  });

  it("keeps the recurring schedule verbatim instead of inventing a date", async () => {
    mockFetchWith([{ match: LISTING, content: loadFixture("kora-listing.html") }]);

    const experiencias = await scrapeKoraExperiencias();

    expect(experiencias.some((x) => /\d{1,2}:\d{2}h/.test(x.schedule))).toBe(true);
  });

  it("maps the three icons to schedule, price and language", async () => {
    mockFetchWith([{ match: LISTING, content: loadFixture("kora-listing.html") }]);

    const experiencias = await scrapeKoraExperiencias();

    for (const x of experiencias) {
      expect(x.schedule.length).toBeGreaterThan(0);
      expect(x.price.length).toBeGreaterThan(0);
      expect(x.language.length).toBeGreaterThan(0);
    }
  });

  it("resolves the booking link, which is usually Eventbrite", async () => {
    mockFetchWith([{ match: LISTING, content: loadFixture("kora-listing.html") }]);

    const experiencias = await scrapeKoraExperiencias();

    for (const x of experiencias) {
      expect(x.reservation).toMatch(/^https:\/\//);
    }
  });

  it("returns an empty array when the request fails", async () => {
    mockFetchWith([{ match: LISTING, content: "", status: 500 }]);

    await expect(scrapeKoraExperiencias()).resolves.toEqual([]);
  });

  it("is resilient to a page without cards", async () => {
    mockFetchWith([{ match: /.*/, content: "<html><body>nada</body></html>" }]);

    await expect(scrapeKoraExperiencias()).resolves.toEqual([]);
  });

  it("caches the result and re-fetches after invalidate", async () => {
    const fetchMock = mockFetchWith([
      { match: LISTING, content: loadFixture("kora-listing.html") },
    ]);

    await scrapeKoraExperiencias();
    const callsAfterFirst = fetchMock.mock.calls.length;

    await scrapeKoraExperiencias();
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);

    invalidateKora();
    await scrapeKoraExperiencias();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});
