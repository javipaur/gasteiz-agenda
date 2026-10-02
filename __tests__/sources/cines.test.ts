import { loadFixture, mockFetchWith } from "../helpers";
import { scrapeFlorida } from "@/lib/sources/cines";

describe("scrapeFlorida", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it("trae la duracion, que Florida si publica", async () => {
    // Bouya no puede: Sensacine no la da. Aqui se fija que Florida no la pierda.
    const html = loadFixture("florida-listing.html");
    mockFetchWith([{ match: /reservaentradas\.com/, content: html }]);

    const peliculas = await scrapeFlorida();

    expect(peliculas.length).toBeGreaterThan(0);
    for (const p of peliculas) {
      expect(p.duracion.length).toBeGreaterThan(0);
    }
  });

  it("falla hacia arriba cuando la fuente no responde", async () => {
    // Antes devolvia `[]` con un console.error, y la ruta lo envolvia en un
    // 200: un fallo era indistinguible de "no hay peliculas", que es
    // justamente lo que el cliente no puede permitirse cachear.
    mockFetchWith([{ match: /reservaentradas\.com/, content: "", status: 500 }]);

    await expect(scrapeFlorida()).rejects.toThrow(/500/);
  });

  it("devuelve una lista vacia para HTML sin peliculas", async () => {
    // Aqui si es un 200 con lista vacia, porque la fuente respondio bien y no
    // tenia nada. Es el caso que el error anterior hacia pasar por fallo.
    mockFetchWith([
      { match: /reservaentradas\.com/, content: "<html><body><p>vacío</p></body></html>" },
    ]);

    const peliculas = await scrapeFlorida();
    expect(peliculas).toEqual([]);
  });

  it("descarta las peliculas sin sesiones", async () => {
    const html = loadFixture("florida-listing.html");
    mockFetchWith([{ match: /reservaentradas\.com/, content: html }]);

    const peliculas = await scrapeFlorida();

    // Todas las que sobreviven tienen al menos una sesion reservable: es la
    // condicion del scraper, y sin ella la cartelera Annunciaria peliculas
    // donde no se puede comprar entrada.
    for (const p of peliculas) {
      expect(p.horarios.length).toBeGreaterThan(0);
    }
  });

  it("deduplica los horarios", async () => {
    const html = loadFixture("florida-listing.html");
    mockFetchWith([{ match: /reservaentradas\.com/, content: html }]);

    const peliculas = await scrapeFlorida();

    for (const p of peliculas) {
      expect(new Set(p.horarios).size).toBe(p.horarios.length);
    }
  });
});