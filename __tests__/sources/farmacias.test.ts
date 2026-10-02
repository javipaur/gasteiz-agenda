import { loadFixture, mockFetchWith } from "../helpers";
import { parseFarmaciasGeojson, scrapeFarmacias } from "@/lib/sources/farmacias";

/**
 * Farmacias de Vitoria-Gasteiz.
 *
 * Este test no existía, y por eso `scrapeFarmacias` estuvo roto sin que nada se
 * enterara: la unica otra referencia es `app/api/farmacias/route.ts`. No lo
 * cubria ningun test, ni de scraper ni de ruta. Con `cofalava.org` devolviendo
 * 403, `extractPlacesFromHtml` recibia HTML de error, no encontraba el marcador
 * `"places":[` y devolvia `[]` — una lista vacia con status 200, que es
 * exactamente lo que se ve en la app.
 *
 * El fixture es el GeoJSON real del Gobierno Vasco: 843 feature en 150
 * municipios. Fijar el recuento de Vitoria (78) es lo que ata el scraper a la
 * fuente. Sin ese numero, un filtro que se rompe devuelve `[]` y el test sigue
 * verde, porque `expect([]).toEqual([])`.
 */
describe("parseFarmaciasGeojson", () => {
  const geojson = () => loadFixture("farmacias-euskadi.geojson");

  it("devuelve exactamente las 78 farmacias de Vitoria-Gasteiz", () => {
    const farmacias = parseFarmaciasGeojson(geojson());

    // De 843 feature en todo Euskadi se queda solo con las de Vitoria. Si el
    // filtro de municipio se rompe el numero sube a 843; si se rompe el nombre
    // exacto, baja a 0. Los dos fallos son visibles aqui.
    expect(farmacias).toHaveLength(78);
    expect(farmacias.every((f) => f.city === "VITORIA-GASTEIZ")).toBe(true);
  });

  it("mapea los campos del GeoJSON al contrato que ya consume la web", () => {
    const [f] = parseFarmaciasGeojson(geojson());

    expect(f.name).toMatch(/\S/);
    expect(f.name).toBe(f.name.trim());
    expect(f.address).toContain(f.shortAddress);
    expect(f.id).toMatch(/^\d+$/);

    // `FarmaciasMap.tsx` ya consume estos dos como string y los pasa por
    // `Number()`, asi que tienen que seguir siendo string y ser numericos.
    expect(typeof f.lat).toBe("string");
    expect(typeof f.lng).toBe("string");
    expect(Number.isFinite(Number(f.lat))).toBe(true);
    expect(Number.isFinite(Number(f.lng))).toBe(true);
  });

  it("da id unico a cada farmacia de Vitoria", () => {
    const ids = parseFarmaciasGeojson(geojson()).map((f) => f.id);

    // `idif` es el identificador sanitario. Sin id unico la lista y el mapa no
    // tienen clave estable y React avisa de claves duplicadas.
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id !== "")).toBe(true);
  });

  it("interpreta las coordenadas como [longitud, latitud]", () => {
    const [f] = parseFarmaciasGeojson(geojson());
    const lat = Number(f.lat);
    const lng = Number(f.lng);

    // Vitoria esta en ~42.85 N, ~2.67 O. GeoJSON entrega [lng, lat]; si se
    // invirtiese, la latitud caeria en 2.67 y el mapa centraria en el mar.
    expect(lat).toBeGreaterThan(42.5);
    expect(lat).toBeLessThan(43.2);
    expect(lng).toBeLessThan(-2.4);
    expect(lng).toBeGreaterThan(-3);
  });

  it("deja vacios el turno y el horario en vez de inventarlos", () => {
    const farmacias = parseFarmaciasGeojson(geojson());

    // El directorio oficial no publica turno ni horario. La razon de que esta
    // pantalla ya no diga "de guardia" es exactamente esta asercion: no hay
    // dato de guardia que mostrar.
    expect(farmacias.every((f) => f.date === "")).toBe(true);
    expect(farmacias.every((f) => f.horarios === "")).toBe(true);
  });

  it("conserva la farmacia que la fuente publica sin nombre", () => {
    const farmacias = parseFarmaciasGeojson(geojson());
    const sinNombre = farmacias.filter((f) => f.name === "Farmacia (nombre no publicado)");

    // El Colegio publica `direccion` y `telefono` pero no el `titular1` de
    // `idif` 010091. Es una farmacia real con un telefono al que llamar, asi que
    // se conserva con etiqueta en vez de droparla: filtrarla seria esconderla y
    // haria que el recuento no cuadrase con los 78 de la fuente.
    expect(sinNombre).toHaveLength(1);
    expect(sinNombre[0].id).toBe("010091");
    expect(sinNombre[0].shortAddress).toMatch(/\S/);
    expect(sinNombre[0].phone).toMatch(/\S/);
  });

  it("ordena por nombre para que la lista no baucle entre recargas", () => {
    const nombres = parseFarmaciasGeojson(geojson()).map((f) => f.name);

    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, "es")));
  });

  it("devuelve vacio ante un cuerpo que no es JSON, sin lanzar", () => {
    // El WAF de Cofalava devolvia HTML de error con status 200 en cache. Un
    // `JSON.parse` sin try/catch tumbo la ruta entera; el fallo se controla y la
    // lista queda vacia.
    expect(parseFarmaciasGeojson("<html><body>403 Forbidden</body></html>")).toEqual([]);
    expect(parseFarmaciasGeojson("")).toEqual([]);
    expect(parseFarmaciasGeojson("{}")).toEqual([]);
  });
});

describe("scrapeFarmacias", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    // `scrapeFarmacias` cachea en el modulo. Sin `resetModules` la segunda
    // prueba recibiria la cache de la primera y el mock no se veria.
    jest.resetModules();
  });

  it("devuelve 78 farmacias al pedir el GeoJSON", async () => {
    mockFetchWith([
      {
        match: /opendata\.euskadi\.eus/,
        content: loadFixture("farmacias-euskadi.geojson"),
      },
    ]);

    const { scrapeFarmacias: scrape } = await import("@/lib/sources/farmacias");

    expect(await scrape()).toHaveLength(78);
  });

  it("devuelve vacio si la fuente responde 403, sin tumbar la ruta", async () => {
    mockFetchWith([
      {
        match: /opendata\.euskadi\.eus/,
        content: "Forbidden",
        status: 403,
      },
    ]);

    const { scrapeFarmacias: scrape } = await import("@/lib/sources/farmacias");

    // Coincide con el comportamiento que tenia el scraper de Cofalava: si no
    // hay `ok`, lista vacia. Lo que no se permite es una excepcion sin captura.
    expect(await scrape()).toEqual([]);
  });

  it("usa la fuente oficial y no el sitio bloqueado", async () => {
    const fetchSpy = mockFetchWith([
      {
        match: /opendata\.euskadi\.eus/,
        content: loadFixture("farmacias-euskadi.geojson"),
      },
    ]);

    const { scrapeFarmacias: scrape } = await import("@/lib/sources/farmacias");
    await scrape();

    const llamadas = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(llamadas.every((u) => u.includes("opendata.euskadi.eus"))).toBe(true);
    expect(llamadas.some((u) => u.includes("cofalava"))).toBe(false);
  });
});