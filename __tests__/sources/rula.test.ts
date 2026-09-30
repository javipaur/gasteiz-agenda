import { loadFixture, mockFetchWith } from "../helpers";
import { scrapeRula } from "@/lib/sources/rula";

const TOKEN_PREVIO = process.env.MEC_TOKEN;

describe("scrapeRula", () => {
  // El token viene del entorno y sin el el API responde 500, asi que los tests
  // que llegan al fetch tienen que ponerlo.
  beforeEach(() => {
    process.env.MEC_TOKEN = "token-de-prueba";
  });

  afterAll(() => {
    if (TOKEN_PREVIO === undefined) {
      delete process.env.MEC_TOKEN;
    } else {
      process.env.MEC_TOKEN = TOKEN_PREVIO;
    }
  });

  it("envia el token MEC en la cabecera", async () => {
    const json = loadFixture("rula-response.json");
    const fetchMock = mockFetchWith([
      { match: /lagenterula\.com\/wp-json\/mec\//, content: json },
    ]);

    await scrapeRula();

    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Record<string, string>)["mec-token"]).toBe(
      "token-de-prueba"
    );
  });

  it("sin token no llama a la red y devuelve lista vacia", async () => {
    // Sin token el API responde 500: es mejor no gastar la descarga de 6,5 MB.
    // Y la fuente caerse sola no puede tumbar la agenda.
    delete process.env.MEC_TOKEN;
    const fetchMock = mockFetchWith([
      { match: /lagenterula\.com/, content: loadFixture("rula-response.json") },
    ]);

    const events = await scrapeRula();

    expect(events).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses the MEC API JSON response into normalized events", async () => {
    const json = loadFixture("rula-response.json");

    const fetchMock = mockFetchWith([
      { match: /lagenterula\.com\/wp-json\/mec\//, content: json },
    ]);

    const events = await scrapeRula();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);

    if (events.length > 0) {
      for (const e of events) {
        expect(typeof e.title).toBe("string");
        expect(e.title.length).toBeGreaterThan(0);
        expect(typeof e.date).toBe("string");
        expect(typeof e.link).toBe("string");
      }
    }
  });

  it("returns an empty array when the API returns an error", async () => {
    mockFetchWith([
      { match: /lagenterula\.com/, content: "", status: 500 },
    ]);

    const events = await scrapeRula();
    expect(events).toEqual([]);
  });

  it("filters out past events", async () => {
    const fixture = JSON.parse(loadFixture("rula-response.json"));
    const today = new Date().toISOString().slice(0, 10);

    mockFetchWith([
      { match: /lagenterula\.com/, content: JSON.stringify(fixture) },
    ]);

    const events = await scrapeRula();
    for (const e of events) {
      expect(e.date >= today).toBe(true);
    }
  });
});