import { loadFixture, mockFetchWith } from "../helpers";
import { scrapeFlorida } from "@/lib/sources/cines";

describe("scrapeFlorida", () => {
  it("parses the new reservaentradas listing into peliculas with horarios", async () => {
    const html = loadFixture("florida-listing.html");

    const fetchMock = mockFetchWith([
      { match: /reservaentradas\.com\/cine\/alava\/florida/, content: html },
    ]);

    const peliculas = await scrapeFlorida();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(peliculas)).toBe(true);
    expect(peliculas.length).toBeGreaterThan(0);

    for (const p of peliculas) {
      expect(typeof p.titulo).toBe("string");
      expect(p.titulo.length).toBeGreaterThan(0);
      expect(typeof p.imagen).toBe("string");
      expect(typeof p.link).toBe("string");
      expect(Array.isArray(p.horarios)).toBe(true);
      expect(p.horarios.length).toBeGreaterThan(0);
      for (const h of p.horarios) {
        expect(h).toMatch(/^\d{1,2}:\d{2}$/);
      }
    }
  });

  it("filters out movies without bookable sessions", async () => {
    const html = loadFixture("florida-listing.html");
    mockFetchWith([
      { match: /reservaentradas\.com/, content: html },
    ]);

    const peliculas = await scrapeFlorida();
    // fixture has 14 movies but only 12 with real sessions
    expect(peliculas.length).toBe(12);

    const titles = peliculas.map((p) => p.titulo.toLowerCase());
    expect(titles).not.toContain("cineforum");
    expect(titles).not.toContain("tadeo jones y la lámpara maravillosa");
  });

  it("returns an empty array when the fetch fails", async () => {
    mockFetchWith([
      { match: /reservaentradas\.com/, content: "", status: 500 },
    ]);

    const peliculas = await scrapeFlorida();
    expect(peliculas).toEqual([]);
  });

  it("returns an empty array for HTML without movies", async () => {
    mockFetchWith([
      { match: /reservaentradas\.com/, content: "<html><body><p>vacío</p></body></html>" },
    ]);

    const peliculas = await scrapeFlorida();
    expect(peliculas).toEqual([]);
  });
});