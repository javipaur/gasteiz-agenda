import { espiaErrores, loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
import { scrapeFever } from "@/lib/sources/fever";

describe("scrapeFever", () => {
  it("parses event detail pages and returns normalized events", async () => {
    const listingHtml = loadFixture("fever-listing.html");

    const detailHtml = loadFixture("fever-detail.html");

    const routes = [];
    routes.push({
      match: /https:\/\/feverup\.com\/en\/vitoria-gasteiz\/?$/,
      content: listingHtml,
    });
    routes.push({
      match: /feverup\.com.*\/m\/\d+/,
      content: detailHtml,
    });
    routes.push({
      match: /.*/,
      content: EMPTY_HTML,
    });

    const fetchMock = mockFetchWith(routes);

    const events = await scrapeFever();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    for (const e of events) {
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.link).toMatch(/\/m\/\d+/);
      expect(typeof e.date).toBe("string");
      expect(typeof e.location).toBe("string");
    }
  });

  it("returns an empty array when the listing fetch fails, and says so", async () => {
    mockFetchWith([
      { match: /feverup\.com/, content: "", status: 500 },
    ]);
    const errorSpy = espiaErrores();

    const events = await scrapeFever();
    expect(events).toEqual([]);
    /*
     * Este es el caso por el que `fever` no miraba el estado: un 500 de Cloudflare
     * llega con HTML de página de error, el `urlPattern` no encuentra enlaces y el
     * scraper salía con `[]` como si la agenda de la noche estuviera vacía.
     */
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/fever/i));
  });

  it("returns an empty array when the listing has no event links", async () => {
    mockFetchWith([
      { match: /feverup\.com/, content: "<html><body><p>no events</p></body></html>" },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeFever();
    expect(events).toEqual([]);
  });
});