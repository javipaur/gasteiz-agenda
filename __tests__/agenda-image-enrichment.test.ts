import { aggregate } from "@/lib/agenda";
import { invalidateOgImageCache } from "@/lib/og-image";
import type { SourceEntry } from "@/lib/source-registry";
import { mockFetchWith } from "./helpers";

function entry(over: Partial<SourceEntry> & Pick<SourceEntry, "run">): SourceEntry {
  return { id: "test", group: "test", label: "Test", priority: 9, ...over };
}

const BASE = {
  title: "Evento sin imagen",
  date: "2027-03-15T20:00:00.000Z",
  link: "https://example.com/evento/1",
};

describe("enriquecimiento de imagen en el agregado", () => {
  const prevForce = process.env.AGENDA_ENRICH_IMAGES_FORCE;

  beforeEach(() => {
    process.env.AGENDA_ENRICH_IMAGES_FORCE = "1";
    invalidateOgImageCache();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (prevForce === undefined) delete process.env.AGENDA_ENRICH_IMAGES_FORCE;
    else process.env.AGENDA_ENRICH_IMAGES_FORCE = prevForce;
  });

  it("rellena la imagen desde og:image cuando el host es servible", async () => {
    mockFetchWith([
      {
        match: /example\.com\/evento\/1/,
        content:
          '<html><head><meta property="og:image" content="https://www.vitoria-gasteiz.org/img/foto.jpg"></head></html>',
      },
    ]);

    const [ev] = await aggregate([entry({ run: async () => [BASE] })]);
    expect(ev.image).toBe("https://www.vitoria-gasteiz.org/img/foto.jpg");
  });

  it("no asigna la imagen si el host de og:image no está permitido", async () => {
    mockFetchWith([
      {
        match: /example\.com\/evento\/2/,
        content:
          '<html><head><meta property="og:image" content="https://no-permitido.example.org/foto.jpg"></head></html>',
      },
    ]);

    const [ev] = await aggregate([
      entry({ run: async () => [{ ...BASE, link: "https://example.com/evento/2" }] }),
    ]);
    expect(ev.image).toBeUndefined();
  });

  it("no pisa una imagen que ya trae el evento", async () => {
    mockFetchWith([
      {
        match: /example\.com\/evento\/3/,
        content:
          '<html><head><meta property="og:image" content="https://www.vitoria-gasteiz.org/img/otra.jpg"></head></html>',
      },
    ]);

    const [ev] = await aggregate([
      entry({
        run: async () => [
          {
            ...BASE,
            link: "https://example.com/evento/3",
            image: "https://www.vitoria-gasteiz.org/img/original.jpg",
          },
        ],
      }),
    ]);
    expect(ev.image).toBe("https://www.vitoria-gasteiz.org/img/original.jpg");
  });
});
