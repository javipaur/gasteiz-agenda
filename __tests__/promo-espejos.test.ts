import {
  crearBuscadorDeEspejos,
  crearResolutorDeImagenPromo,
} from "@/lib/promo-espejos";

const MUNICIPAL =
  "https://www.vitoria-gasteiz.org/docs/wb021/img/gestor/30/95/gi_93095.jpg";
const ESPEJO =
  "https://www.gasteizhoy.com/wp-content/uploads/2026/11/gi_93095.webp";

function respuestaCon(source_url: string): Response {
  return new Response(JSON.stringify([{ source_url }]), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("el espejo de una foto municipal que no carga", () => {
  it("sirve la copia del otro medio en vez de la URL del host caído", async () => {
    // El 26 de noviembre de 2026 nueve diapositivas traían una URL del Ayuntamiento
    // que agotaba el timeout: Satori pintaba el rectángulo de reserva y Graph rechazaba
    // el carrusel con 9004. La copia es la misma foto con otro host.
    const resolver = crearResolutorDeImagenPromo(async () => ESPEJO);

    expect(await resolver(MUNICIPAL)).toBe(ESPEJO);
  });

  it("sin copia deja la tarjeta sin foto, no la URL que no carga", async () => {
    // `gi_94488` no tiene copia. Devolver la municipal habría sido volver al fallo:
    // diez segundos de espera y un rectángulo que parece una imagen.
    const resolver = crearResolutorDeImagenPromo(async () => null);

    expect(await resolver(MUNICIPAL)).toBeNull();
  });

  it("una foto de otro host no se busca y sigue su camino", async () => {
    const buscar = jest.fn(async () => ESPEJO);
    const resolver = crearResolutorDeImagenPromo(buscar);
    const directa = "https://opendata.euskadi.eus/cartel.jpg";

    expect(await resolver(directa)).toBe(directa);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("dos diapositivas con el mismo id comparten una sola búsqueda", async () => {
    // Las diez tarjetas se piden a la vez desde el workflow. Sin caché, diez peticiones
    // al WP de GasteizHoy por la misma foto, y una caída del espejo se multiplica por diez.
    const buscar = jest.fn(async () => ESPEJO);
    const resolver = crearResolutorDeImagenPromo(buscar);
    const otraRuta =
      "https://www.vitoria-gasteiz.org/docs/wb021/img/gestor/otro/gi_93095.png";

    expect(await Promise.all([resolver(MUNICIPAL), resolver(otraRuta)])).toEqual([
      ESPEJO,
      ESPEJO,
    ]);
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("un fallo del espejo no tumba la tarjeta", async () => {
    // Un error del WP del otro medio no puede convertir una tarjeta en un 502:
    // la marca de reserva es una imagen honesta y el workflow la deja pasar.
    const resolver = crearResolutorDeImagenPromo(async () => {
      throw new Error("WP caído");
    });

    expect(await resolver(MUNICIPAL)).toBeNull();
  });
});

describe("la búsqueda en el WP de GasteizHoy", () => {
  it("pregunta por el id y acepta la foto que lleva ese id", async () => {
    const fetchImpl = jest.fn(async (_url: string | URL | Request) =>
      respuestaCon("https://www.gasteizhoy.com/wp-content/uploads/2026/11/gi_93095.webp")
    );
    const buscar = crearBuscadorDeEspejos(fetchImpl as unknown as typeof fetch);

    expect(await buscar("gi_93095")).toBe(ESPEJO);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("search=gi_93095");
  });

  it("un resultado con otro id no se acepta como copia", async () => {
    // Una búsqueda por "gi_93095" que devuelva otra foto sería un dato falso en el
    // post: el título diría un plan y la imagen sería la de otro.
    const fetchImpl = jest.fn(async (_url: string | URL | Request) =>
      respuestaCon("https://www.gasteizhoy.com/wp-content/uploads/2026/11/gi_93096.webp")
    );
    const buscar = crearBuscadorDeEspejos(fetchImpl as unknown as typeof fetch);

    expect(await buscar("gi_93095")).toBeNull();
  });
});
