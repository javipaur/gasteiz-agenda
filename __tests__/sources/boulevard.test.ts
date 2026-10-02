import { loadFixture, mockFetchWith } from "../helpers";
import { scrapeBoulevard } from "@/app/services/boulevard";

/**
 * Boulevard no tenia **ningun** test: era el unico scraper de cine sin cobertura,
 * y en parte porque usaba `axios` mientras `mockFetchWith` solo intercepta
 * `global.fetch`. Ahora usa `fetch`, asi que entra en la convencion del repo.
 */
describe("scrapeBoulevard", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("extrae las peliculas con sus horarios del listado de sensacine", async () => {
    const html = loadFixture("boulevard-listing.html");
    mockFetchWith([{ match: /sensacine\.com\/cines\/cine\/E0786/, content: html }]);

    const peliculas = await scrapeBoulevard();

    expect(peliculas.length).toBeGreaterThan(0);
    for (const p of peliculas) {
      expect(p.titulo.length).toBeGreaterThan(0);
      expect(Array.isArray(p.horarios)).toBe(true);
      expect(p.horarios.length).toBeGreaterThan(0);
      for (const h of p.horarios) {
        expect(h.length).toBeGreaterThan(0);
      }
    }
  });

  it("no inventa un punto suelto en un genero vacio", async () => {
    // El bug: `genero.replace(/\.$/, "") + "."` dejaba `"."` cuando el genero
    // venia vacio, y la app lo pintaba como si fuera el genero de la pelicula.
    const html = loadFixture("boulevard-listing.html");
    mockFetchWith([{ match: /sensacine\.com/, content: html }]);

    const peliculas = await scrapeBoulevard();

    for (const p of peliculas) {
      // Sin el segundo argumento de `expect`: los tipos de Jest de este repo no
      // lo declaran, y el repositorio compila los tests con `tsc`.
      expect(p.genero).not.toBe(".");
      expect(p.genero.trim()).toBe(p.genero);
    }
  });

  it("deduplica los horarios", async () => {
    // Florida lo hacia con `[...new Set()]` y Boulevard no: una misma hora
    // aparecia una vez por cada modo de visionado.
    const html = loadFixture("boulevard-listing.html");
    mockFetchWith([{ match: /sensacine\.com/, content: html }]);

    const peliculas = await scrapeBoulevard();

    for (const p of peliculas) {
      expect(new Set(p.horarios).size).toBe(p.horarios.length);
    }
  });

  it("deja la duracion vacia en vez de inventarla", async () => {
    // Sensacine no publica la duracion en la pagina del cine: medido sobre el
    // HTML en vivo, 0 coincidencias de `\d+ min` en 397 KB. El campo se mantiene
    // en el contrato porque Florida si lo trae, pero no se rellena de mentira.
    const html = loadFixture("boulevard-listing.html");
    mockFetchWith([{ match: /sensacine\.com/, content: html }]);

    const peliculas = await scrapeBoulevard();

    expect(peliculas.length).toBeGreaterThan(0);
    for (const p of peliculas) {
      expect(p.duracion).toBe("");
    }
  });

  it("consigue el link de compra decodificado del class de sensacine", async () => {
    // El enlace va escondido en una clase ofuscada ("ACr<base64>"), no en un
    // href. Sin esto la app no puede comprar entradas.
    const html = loadFixture("boulevard-listing.html");
    mockFetchWith([{ match: /sensacine\.com/, content: html }]);

    const peliculas = await scrapeBoulevard();

    expect(peliculas.length).toBeGreaterThan(0);
    for (const p of peliculas) {
      expect(p.link.length).toBeGreaterThan(0);
      expect(p.link).toMatch(/^https?:\/\//);
    }
  });

  it("descarta las peliculas sin sesiones reservables", async () => {
    const html = loadFixture("boulevard-listing.html");
    mockFetchWith([{ match: /sensacine\.com/, content: html }]);

    const peliculas = await scrapeBoulevard();

    for (const p of peliculas) {
      expect(p.horarios.length).toBeGreaterThan(0);
    }
  });

  it("falla hacia arriba cuando la fuente no responde", async () => {
    // Con `axios` esto reventaba dentro del handler y la ruta lo envolvia en un
    // 200 con lista vacia: indistinguible de un cine sin peliculas.
    mockFetchWith([{ match: /sensacine\.com/, content: "", status: 503 }]);

    await expect(scrapeBoulevard()).rejects.toThrow(/503/);
  });

  it("devuelve una lista vacia para HTML sin peliculas", async () => {
    mockFetchWith([
      { match: /sensacine\.com/, content: "<html><body></body></html>" },
    ]);

    const peliculas = await scrapeBoulevard();
    expect(peliculas).toEqual([]);
  });
});